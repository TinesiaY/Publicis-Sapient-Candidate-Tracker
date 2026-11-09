"""Candidate endpoints: create, list, count, view, change stage, archive, restore and replace the resume."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import find_candidate, get_session
from app.models import Candidate, Role, Stage, utc_now
from app.queries import SortOrder, candidate_list_query, stage_counts
from app.resume_input import resolve_resume
from app.schemas import CandidateCounts, CandidateCreate, CandidateDetail, CandidateSummary, StageUpdate
from app.summaries import request_summary

router = APIRouter(prefix="/candidates", tags=["candidates"])

DUPLICATE_MESSAGE = "This email has already applied for this role"
ARCHIVED_DUPLICATE_MESSAGE = (
    "This candidate is archived for this role. Restore them from the archive instead of adding them again."
)
ARCHIVED_STAGE_MESSAGE = "Restore this candidate before changing their stage"
ARCHIVED_RESUME_MESSAGE = "Restore this candidate before replacing their resume"


def _is_duplicate_application(error: IntegrityError) -> bool:
    """True only when the failed insert broke the (email, role_id) unique key.

    This matches SQLite's error text. On PostgreSQL, check the constraint name instead.
    """
    message = str(error.orig)
    return "candidates.email" in message and "candidates.role_id" in message


@router.post("", status_code=201, response_model=CandidateDetail)
def create_candidate(
    data: Annotated[CandidateCreate, Form()],
    resume_file: UploadFile | None = File(None),
    session: Session = Depends(get_session),
) -> Candidate:
    # Check the resume input first, so a bad upload is reported before any database lookup.
    resume = resolve_resume(data.resume_text, resume_file)

    # Check the role next, so a bad role_id gives a clear error and not a foreign-key failure.
    if session.get(Role, data.role_id) is None:
        raise HTTPException(status_code=422, detail="Unknown role_id")

    # An archived application still counts as applied, so the message points to the archive.
    existing = session.execute(
        select(Candidate.id, Candidate.archived_at).where(
            Candidate.email == data.email,
            Candidate.role_id == data.role_id,
        )
    ).first()
    if existing is not None:
        message = ARCHIVED_DUPLICATE_MESSAGE if existing.archived_at is not None else DUPLICATE_MESSAGE
        raise HTTPException(status_code=409, detail=message)

    candidate = Candidate(**data.model_dump(exclude={"resume_text"}), resume_text=resume)
    session.add(candidate)
    try:
        # The candidate and its summary request are saved together, or not at all.
        session.flush()
        request_summary(session, candidate)
        session.commit()
    except IntegrityError as error:
        session.rollback()
        # Another request may have inserted the same email and role after our check.
        if _is_duplicate_application(error):
            raise HTTPException(status_code=409, detail=DUPLICATE_MESSAGE) from error
        raise

    # Load the saved values now, while the session is still open.
    session.refresh(candidate)
    return candidate


@router.get("", response_model=list[CandidateSummary])
def list_candidates(
    stage: Stage | None = None,
    role_id: int | None = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    sort: SortOrder = "added",
    archived: bool = False,
    session: Session = Depends(get_session),
) -> list[Candidate]:
    # archived=false (the default) lists active candidates only. archived=true lists archived candidates only.
    query = candidate_list_query(
        stage=stage,
        role_id=role_id,
        search=search,
        sort=sort,
        archived=archived,
    )
    return list(session.scalars(query))


# Defined before /{candidate_id}, so "counts" is not read as an id.
@router.get("/counts", response_model=CandidateCounts)
def get_candidate_counts(session: Session = Depends(get_session)) -> CandidateCounts:
    by_stage = stage_counts(session)
    return CandidateCounts(total=sum(by_stage.values()), by_stage=by_stage)


@router.get("/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: int, session: Session = Depends(get_session)) -> Candidate:
    return find_candidate(session, candidate_id)


@router.patch("/{candidate_id}/stage", response_model=CandidateDetail)
def change_stage(
    candidate_id: int,
    data: StageUpdate,
    session: Session = Depends(get_session),
) -> Candidate:
    candidate = find_candidate(session, candidate_id)
    if candidate.archived_at is not None:
        raise HTTPException(status_code=409, detail=ARCHIVED_STAGE_MESSAGE)

    # Only the stage changes. The creation date, resume and notes are left alone.
    candidate.stage = data.stage.value
    session.commit()
    session.refresh(candidate)
    return candidate


@router.put("/{candidate_id}/resume", response_model=CandidateDetail)
def replace_resume(
    candidate_id: int,
    resume_text: Annotated[str | None, Form()] = None,
    resume_file: UploadFile | None = File(None),
    session: Session = Depends(get_session),
) -> Candidate:
    candidate = find_candidate(session, candidate_id)
    if candidate.archived_at is not None:
        raise HTTPException(status_code=409, detail=ARCHIVED_RESUME_MESSAGE)

    # Only the resume and its summary request change. Stage, creation date and notes are left alone.
    candidate.resume_text = resolve_resume(resume_text, resume_file)
    request_summary(session, candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


@router.post("/{candidate_id}/archive", response_model=CandidateDetail)
def archive_candidate(candidate_id: int, session: Session = Depends(get_session)) -> Candidate:
    candidate = find_candidate(session, candidate_id)
    # Archiving twice keeps the first archive time.
    if candidate.archived_at is None:
        candidate.archived_at = utc_now()
        session.commit()
        session.refresh(candidate)
    return candidate


@router.post("/{candidate_id}/restore", response_model=CandidateDetail)
def restore_candidate(candidate_id: int, session: Session = Depends(get_session)) -> Candidate:
    candidate = find_candidate(session, candidate_id)
    # Restoring an active candidate changes nothing.
    if candidate.archived_at is not None:
        candidate.archived_at = None
        session.commit()
        session.refresh(candidate)
    return candidate
