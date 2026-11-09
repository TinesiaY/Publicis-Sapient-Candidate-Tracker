"""Summary requests: saving or replacing a resume records a summary request for its current text.

A request is identified by three things: the resume's hash, the prompt version and the model.
A result is reused only when all three match. The worker (app/worker.py) runs the requests.
"""

from sqlalchemy import and_, select, update
from sqlalchemy.orm import Session

from app.ai.prompts import PROMPT_VERSION
from app.ai.provider import SUMMARY_MODEL
from app.models import Candidate, SummaryJob
from app.resume import resume_hash


def request_summary(session: Session, candidate: Candidate, *, force: bool = False) -> int | None:
    """Ask for a summary of the candidate's current resume. The caller commits, then submits the job.

    Returns the id of the new pending job, or None when a pending or ready job already covers this
    request and nothing new was recorded. Pending requests for anything else are superseded.

    force=True records a new request even when a ready result exists. Regenerate uses it.
    """
    current_hash = resume_hash(candidate.resume_text)
    same_request = and_(
        SummaryJob.input_hash == current_hash,
        SummaryJob.prompt_version == PROMPT_VERSION,
        SummaryJob.model == SUMMARY_MODEL,
    )

    # The status condition is part of the write, so a job the worker has just finished
    # is not overwritten with "superseded".
    session.execute(
        update(SummaryJob)
        .where(
            SummaryJob.candidate_id == candidate.id,
            SummaryJob.status == "pending",
            ~same_request,
        )
        .values(status="superseded")
        .execution_options(synchronize_session="fetch")
    )

    if not force:
        existing = session.scalar(
            select(SummaryJob.id).where(
                SummaryJob.candidate_id == candidate.id,
                SummaryJob.status.in_(("pending", "ready")),
                same_request,
            )
        )
        if existing is not None:
            return None

    job = SummaryJob(
        candidate_id=candidate.id,
        status="pending",
        input_hash=current_hash,
        prompt_version=PROMPT_VERSION,
        model=SUMMARY_MODEL,
        forced=force,
    )
    session.add(job)
    session.flush()  # Assigns the id, so the caller can submit the job after the commit.
    return job.id


def current_job(session: Session, candidate: Candidate) -> SummaryJob | None:
    """The newest job for the candidate's current resume, made with the current prompt and model. Any status."""
    return session.scalar(
        select(SummaryJob)
        .where(
            SummaryJob.candidate_id == candidate.id,
            SummaryJob.input_hash == resume_hash(candidate.resume_text),
            SummaryJob.prompt_version == PROMPT_VERSION,
            SummaryJob.model == SUMMARY_MODEL,
        )
        .order_by(SummaryJob.created_at.desc(), SummaryJob.id.desc())
        .limit(1)
    )
