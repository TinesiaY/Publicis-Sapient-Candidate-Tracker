"""Summary requests: saving or replacing a resume records a summary request for its current text.

A request is identified by three things: the resume's hash, the prompt version and the model.
A result is reused only when all three match. Milestone 9 adds the worker that runs the requests.
"""

from sqlalchemy import and_, select, update
from sqlalchemy.orm import Session

from app.ai.prompts import PROMPT_VERSION
from app.ai.provider import SUMMARY_MODEL
from app.models import Candidate, SummaryJob
from app.resume import resume_hash


def request_summary(session: Session, candidate: Candidate) -> None:
    """Ask for a summary of the candidate's current resume. The caller commits.

    Pending requests for anything other than this request are superseded. If a pending or ready
    result already exists for this request, nothing new is recorded.
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

    existing = session.scalar(
        select(SummaryJob.id).where(
            SummaryJob.candidate_id == candidate.id,
            SummaryJob.status.in_(("pending", "ready")),
            same_request,
        )
    )
    if existing is None:
        session.add(
            SummaryJob(
                candidate_id=candidate.id,
                status="pending",
                input_hash=current_hash,
                prompt_version=PROMPT_VERSION,
                model=SUMMARY_MODEL,
            )
        )
