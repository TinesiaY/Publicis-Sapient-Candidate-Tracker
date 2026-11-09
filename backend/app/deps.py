"""Shared FastAPI dependencies."""

from collections.abc import Iterator
from datetime import datetime

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.db import make_engine, make_session_factory
from app.models import Candidate, utc_now
from app.worker import SummaryWorker

engine = make_engine()
# The app's real database. create_app uses it unless a test passes its own session factory.
SessionLocal = make_session_factory(engine)


def get_session(request: Request) -> Iterator[Session]:
    """Give each request its own session, from the factory the app was built with."""
    with request.app.state.session_factory() as session:
        yield session


def get_worker(request: Request) -> SummaryWorker:
    return request.app.state.worker


def get_provider_configured(request: Request) -> bool:
    """True when the server was started with a Gemini key."""
    return request.app.state.provider_configured


def get_clock() -> datetime:
    """The current time. Tests replace this to move the clock forward."""
    return utc_now()


def find_candidate(session: Session, candidate_id: int) -> Candidate:
    """Return the candidate, or raise 404. Archived candidates are found too."""
    candidate = session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate
