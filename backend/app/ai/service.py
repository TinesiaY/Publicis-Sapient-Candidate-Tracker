"""Runs one summary job: confirm it is still current, call the provider, validate the reply, save the result.

Every final status change goes through _finish, which writes only while the job is still pending.
"""

import logging

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.ai.prompts import PROMPT_VERSION, build_prompt
from app.ai.provider import ProviderError, SummaryProvider
from app.ai.validate import InvalidOutput, validate_output
from app.models import Candidate, SummaryJob, utc_now
from app.resume import resume_hash

logger = logging.getLogger(__name__)


def _finish(session: Session, job: SummaryJob, status: str, **values) -> str:
    """Set the job's final status, but only while it is still pending. Returns the status the job ends with.

    If the job was superseded or finished by someone else in the meantime, nothing is written.
    """
    session.execute(
        update(SummaryJob)
        .where(SummaryJob.id == job.id, SummaryJob.status == "pending")
        .values(status=status, **values)
    )
    session.commit()
    session.refresh(job)
    return job.status


def run_summary_job(session: Session, job_id: int, provider: SummaryProvider) -> str:
    """Run one job and return the status it ends with."""
    job = session.get(SummaryJob, job_id)
    if job is None:
        raise LookupError(f"No summary job with id {job_id}")
    if job.status != "pending":
        return job.status

    # A job is run only by the model and prompt it was requested for. Otherwise its result
    # would be stored under the wrong label.
    if job.model != provider.model_name or job.prompt_version != PROMPT_VERSION:
        raise RuntimeError(
            f"Job {job.id} was requested for model {job.model!r} and prompt {job.prompt_version!r}, "
            f"but the provider uses model {provider.model_name!r} and the prompt is {PROMPT_VERSION!r}"
        )

    candidate = session.get(Candidate, job.candidate_id)
    resume_text = candidate.resume_text

    # The job stores only a hash of the resume. Check that the text about to be sent has that hash,
    # so a result is never saved against a resume it was not made from.
    if resume_hash(resume_text) != job.input_hash:
        return _finish(session, job, "superseded", completed_at=utc_now())

    # A ready result for the same resume, prompt and model is reused, so the provider is not called again.
    reusable = session.scalar(
        select(SummaryJob)
        .where(
            SummaryJob.candidate_id == job.candidate_id,
            SummaryJob.id != job.id,
            SummaryJob.status == "ready",
            SummaryJob.input_hash == job.input_hash,
            SummaryJob.prompt_version == job.prompt_version,
            SummaryJob.model == job.model,
        )
        .order_by(SummaryJob.id.desc())
        .limit(1)
    )
    if reusable is not None:
        return _finish(session, job, "ready", result_json=reusable.result_json, completed_at=utc_now())

    system, prompt = build_prompt(resume_text)
    try:
        reply = provider.generate(system, prompt)
    except ProviderError as error:
        return _finish(session, job, "failed", error_code=error.code, completed_at=utc_now())

    try:
        summary, _ = validate_output(reply, resume_text)
    except InvalidOutput:
        return _finish(session, job, "failed", error_code="invalid_output", completed_at=utc_now())

    return _finish(session, job, "ready", result_json=summary.model_dump_json(), completed_at=utc_now())
