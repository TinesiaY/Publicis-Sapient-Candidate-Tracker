"""Summary requests: record that a resume needs a summary. Milestone 9 processes these requests."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Candidate, SummaryJob
from app.resume import resume_hash

PROMPT_VERSION = "v1"
# The real model is chosen in milestone 9. Until then, requests are recorded with this placeholder.
SUMMARY_MODEL = "not-yet-configured"


def request_summary(session: Session, candidate: Candidate) -> None:
    """Ask for a summary of the candidate's current resume.

    Requests for earlier versions of the resume are marked superseded. If a pending or ready
    result already exists for this exact text, nothing new is recorded.
    """
    current_hash = resume_hash(candidate.resume_text)

    stale = session.scalars(
        select(SummaryJob).where(
            SummaryJob.candidate_id == candidate.id,
            SummaryJob.status == "pending",
            SummaryJob.input_hash != current_hash,
        )
    ).all()
    for job in stale:
        job.status = "superseded"

    existing = session.scalar(
        select(SummaryJob.id).where(
            SummaryJob.candidate_id == candidate.id,
            SummaryJob.input_hash == current_hash,
            SummaryJob.status.in_(("pending", "ready")),
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
