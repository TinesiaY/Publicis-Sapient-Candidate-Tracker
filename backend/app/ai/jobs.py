"""Final status changes for summary jobs, and the checks that run outside the worker.

Every final status change goes through finish_job. It writes only while the job is still pending,
so a job that was superseded or timed out is never overwritten by a late result.
"""

from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import SummaryJob

JOB_TIMEOUT = timedelta(minutes=3)


def finish_job(session: Session, job: SummaryJob, status: str, **values) -> str:
    """Set the job's final status while it is still pending. Returns the status the job ends with."""
    session.execute(
        update(SummaryJob)
        .where(SummaryJob.id == job.id, SummaryJob.status == "pending")
        .values(status=status, **values)
    )
    session.commit()
    session.refresh(job)
    return job.status


def sweep_interrupted(session: Session, now: datetime) -> int:
    """Mark every pending job as failed with interrupted. Returns how many were marked.

    Runs at startup. A job still pending then was left behind by an earlier run that stopped.
    """
    pending = session.scalars(select(SummaryJob).where(SummaryJob.status == "pending")).all()
    for job in pending:
        finish_job(session, job, "failed", error_code="interrupted", completed_at=now)
    return len(pending)


def expire_timed_out(session: Session, candidate_id: int, now: datetime) -> None:
    """Mark the candidate's pending jobs older than the job timeout as failed with timeout."""
    cutoff = now - JOB_TIMEOUT
    stuck = session.scalars(
        select(SummaryJob).where(
            SummaryJob.candidate_id == candidate_id,
            SummaryJob.status == "pending",
            SummaryJob.created_at < cutoff,
        )
    ).all()
    for job in stuck:
        finish_job(session, job, "failed", error_code="timeout", completed_at=now)
