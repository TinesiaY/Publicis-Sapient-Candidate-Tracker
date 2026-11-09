"""Shared test fixtures: a fresh in-memory database for every test, a manual executor and a fake provider.

The app is built with create_app, so no test touches backend/data/app.db.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.ai.fake import FakeProvider
from app.db import Base, make_engine, make_session_factory
from app.main import create_app
from app.models import Role


class ManualExecutor:
    """Holds submitted work until a test runs it, so a test can check the state before a job runs."""

    def __init__(self) -> None:
        self._queued: list[tuple] = []

    def submit(self, fn, *args):
        self._queued.append((fn, args))

    def run_queued(self) -> None:
        while self._queued:
            fn, args = self._queued.pop(0)
            fn(*args)

    @property
    def queued_count(self) -> int:
        return len(self._queued)

    def shutdown(self, wait: bool = True) -> None:
        pass


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
def executor() -> ManualExecutor:
    return ManualExecutor()


@pytest.fixture
def provider() -> FakeProvider:
    return FakeProvider([])


@pytest.fixture
def app(engine, executor, provider):
    return create_app(session_factory=make_session_factory(engine), provider=provider, executor=executor)


@pytest.fixture
def client(app):
    """An HTTP test client. Entering it runs the app's startup, including the startup sweep."""
    with TestClient(app) as test_client:
        yield test_client
