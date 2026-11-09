"""Shared FastAPI dependencies."""

from collections.abc import Iterator

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import make_engine, make_session_factory
from app.models import Candidate

engine = make_engine()
SessionLocal = make_session_factory(engine)


def get_session() -> Iterator[Session]:
    """Give each request its own database session, and close it when the request ends."""
    with SessionLocal() as session:
        yield session


def find_candidate(session: Session, candidate_id: int) -> Candidate:
    """Return the candidate, or raise 404. Archived candidates are found too."""
    candidate = session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate
