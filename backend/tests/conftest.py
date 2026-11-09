"""Shared test fixtures: a fresh in-memory database for every test."""

import pytest
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import Base, make_engine
from app.models import Role


@pytest.fixture
def engine():
    # StaticPool keeps one connection, so every session sees the same in-memory database.
    engine = make_engine(
        "sqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine):
    with Session(engine) as session:
        yield session

@pytest.fixture
def role_ids(session):
    backend = Role(name="Backend Engineer", jd_text="Build APIs")
    frontend = Role(name="Frontend Engineer", jd_text="Build UIs")
    session.add_all([backend, frontend])
    session.commit()
    return {"backend": backend.id, "frontend": frontend.id}

