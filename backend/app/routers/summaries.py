"""Summary endpoints: read the summary of a candidate's current resume, retry a failed one, and regenerate a ready one."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.jobs import expire_timed_out
from app.ai.schema import SummaryResult
from app.deps import find_candidate, get_clock, get_provider_configured, get_session, get_worker
from app.models import SummaryJob
from app.schemas import SummaryRead
from app.summaries import current_job, request_summary
from app.worker import SummaryWorker

router = APIRouter(prefix="/candidates/{candidate_id}/summary", tags=["summaries"])

NOT_REQUESTED_MESSAGE = "No summary has been requested for this resume"
NOT_FAILED_MESSAGE = "Only a failed summary can be retried"
ARCHIVED_RETRY_MESSAGE = "Restore this candidate before retrying their summary"
ARCHIVED_REGENERATE_MESSAGE = "Restore this candidate before regenerating their summary"
NOT_READY_MESSAGE = "Only a ready summary can be regenerated"


def _to_read(job: SummaryJob, provider_configured: bool) -> SummaryRead:
    """The result fields are filled only when the job is ready."""
    if job.status != "ready" or job.result_json is None:
        return SummaryRead(
            status=job.status,
            input_hash=job.input_hash,
            created_at=job.created_at,
            provider_configured=provider_configured,
            error_code=job.error_code,
        )
    result = SummaryResult.model_validate_json(job.result_json)
    return SummaryRead(
        status=job.status,
        input_hash=job.input_hash,
        created_at=job.created_at,
        provider_configured=provider_configured,
        summary=result.summary,
        skills=result.skills,
        highlights=result.highlights,
        suspicious_input=result.suspicious_input,
    )


@router.get("", response_model=SummaryRead)
def get_summary(
    candidate_id: int,
    session: Session = Depends(get_session),
    now: datetime = Depends(get_clock),
    configured: bool = Depends(get_provider_configured),
) -> SummaryRead:
    candidate = find_candidate(session, candidate_id)
    expire_timed_out(session, candidate.id, now)
    job = current_job(session, candidate)
    if job is None:
        raise HTTPException(status_code=404, detail=NOT_REQUESTED_MESSAGE)
    return _to_read(job, configured)


@router.post("/retry", status_code=202, response_model=SummaryRead)
def retry_summary(
    candidate_id: int,
    session: Session = Depends(get_session),
    worker: SummaryWorker = Depends(get_worker),
    now: datetime = Depends(get_clock),
    configured: bool = Depends(get_provider_configured),
) -> SummaryRead:
    candidate = find_candidate(session, candidate_id)
    if candidate.archived_at is not None:
        raise HTTPException(status_code=409, detail=ARCHIVED_RETRY_MESSAGE)
    expire_timed_out(session, candidate.id, now)
    job = current_job(session, candidate)
    if job is None:
        raise HTTPException(status_code=404, detail=NOT_REQUESTED_MESSAGE)
    if job.status != "failed":
        raise HTTPException(status_code=409, detail=NOT_FAILED_MESSAGE)

    new_job_id = request_summary(session, candidate)
    session.commit()
    if new_job_id is not None:
        worker.submit(new_job_id)
    return _to_read(current_job(session, candidate), configured)


@router.post("/regenerate", status_code=202, response_model=SummaryRead)
def regenerate_summary(
    candidate_id: int,
    session: Session = Depends(get_session),
    worker: SummaryWorker = Depends(get_worker),
    now: datetime = Depends(get_clock),
    configured: bool = Depends(get_provider_configured),
) -> SummaryRead:
    """Run the summary again for the current resume, even though a ready result exists. The old result stays as history."""
    candidate = find_candidate(session, candidate_id)
    if candidate.archived_at is not None:
        raise HTTPException(status_code=409, detail=ARCHIVED_REGENERATE_MESSAGE)
    expire_timed_out(session, candidate.id, now)
    job = current_job(session, candidate)
    if job is None:
        raise HTTPException(status_code=404, detail=NOT_REQUESTED_MESSAGE)
    if job.status != "ready":
        raise HTTPException(status_code=409, detail=NOT_READY_MESSAGE)

    new_job_id = request_summary(session, candidate, force=True)
    session.commit()
    if new_job_id is not None:
        worker.submit(new_job_id)
    return _to_read(current_job(session, candidate), configured)
