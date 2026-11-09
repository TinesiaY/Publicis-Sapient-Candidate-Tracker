"""Runs one summary job: confirm it is still current, call the provider, validate the reply, save the result.

Every final status change goes through finish_job, which writes only while the job is still pending.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.jobs import finish_job
from app.ai.prompts import PROMPT_VERSION, build_prompt
from app.ai.provider import ProviderError, SummaryProvider
from app.ai.validate import InvalidOutput, validate_output
from app.models import Candidate, SummaryJob, utc_now
from app.resume import resume_hash


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
        return finish_job(session, job, "superseded", completed_at=utc_now())

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
        return finish_job(session, job, "ready", result_json=reusable.result_json, completed_at=utc_now())

    system, prompt = build_prompt(resume_text)
    try:
        reply = provider.generate(system, prompt)
    except ProviderError as error:
        return finish_job(session, job, "failed", error_code=error.code, completed_at=utc_now())

    try:
        summary, _ = validate_output(reply, resume_text)
    except InvalidOutput:
        return finish_job(session, job, "failed", error_code="invalid_output", completed_at=utc_now())

    return finish_job(session, job, "ready", result_json=summary.model_dump_json(), completed_at=utc_now())
