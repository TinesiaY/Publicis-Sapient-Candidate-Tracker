"""Shared FastAPI dependencies."""

from collections.abc import Iterator

from sqlalchemy.orm import Session

from app.db import make_engine, make_session_factory

engine = make_engine()
SessionLocal = make_session_factory(engine)


def get_session() -> Iterator[Session]:
    """Give each request its own database session, and close it when the request ends."""
    with SessionLocal() as session:
        yield session
