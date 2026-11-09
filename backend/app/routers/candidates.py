"""Candidate endpoints: create, list and view candidates."""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_session
from app.models import Candidate, Role
from app.schemas import CandidateCreate, CandidateDetail, CandidateSummary

router = APIRouter(prefix="/candidates", tags=["candidates"])

DUPLICATE_MESSAGE = "This email has already applied for this role"


def _is_duplicate_application(error: IntegrityError) -> bool:
    """True only when the failed insert broke the (email, role_id) unique key.

    This matches SQLite's error text. On PostgreSQL, check the constraint name instead.
    """
    message = str(error.orig)
    return "candidates.email" in message and "candidates.role_id" in message


@router.post("", status_code=201, response_model=CandidateDetail)
def create_candidate(
    data: Annotated[CandidateCreate, Form()],
    session: Session = Depends(get_session),
) -> Candidate:
    # Check the role first, so a bad role_id gives a clear error and not a foreign-key failure.
    if session.get(Role, data.role_id) is None:
        raise HTTPException(status_code=422, detail="Unknown role_id")

    already_applied = session.scalar(
        select(Candidate.id).where(
            Candidate.email == data.email,
            Candidate.role_id == data.role_id,
        )
    )
    if already_applied is not None:
        raise HTTPException(status_code=409, detail=DUPLICATE_MESSAGE)

    candidate = Candidate(**data.model_dump())
    session.add(candidate)
    try:
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
def list_candidates(session: Session = Depends(get_session)) -> list[Candidate]:
    return list(session.scalars(select(Candidate).order_by(Candidate.id)))


@router.get("/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: int, session: Session = Depends(get_session)) -> Candidate:
    candidate = session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate
