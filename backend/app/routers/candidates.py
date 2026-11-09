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


@router.post("", status_code=201, response_model=CandidateDetail)
def create_candidate(
    data: Annotated[CandidateCreate, Form()],
    session: Session = Depends(get_session),
) -> Candidate:
    
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
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_MESSAGE)

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
