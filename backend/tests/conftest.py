"""Shared test fixtures: a fresh in-memory database for every test."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import Base, make_engine, make_session_factory
from app.deps import get_session
from app.main import app
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


@pytest.fixture
def client(engine):
    """An HTTP test client whose requests use the same in-memory database as the test."""
    session_factory = make_session_factory(engine)

    def override_get_session():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
