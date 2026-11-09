"""The real background thread, with a file database in a temporary folder. The app's own database is not touched."""

import time

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.ai.fake import FakeProvider
from app.db import Base, make_engine, make_session_factory
from app.main import create_app
from app.models import Role
from tests.helpers import create, summary, valid_reply


def wait_until_not_pending(client, candidate_id: int, timeout: float = 10.0) -> dict:
    deadline = time.monotonic() + timeout
    while True:
        body = summary(client, candidate_id).json()
        if body["status"] != "pending" or time.monotonic() > deadline:
            return body
        time.sleep(0.05)


def test_a_job_runs_on_the_background_thread_and_becomes_ready(tmp_path):
    engine = make_engine(f"sqlite:///{(tmp_path / 'threads.db').as_posix()}")
    Base.metadata.create_all(engine)
    factory = make_session_factory(engine)
    with factory() as session:
        role = Role(name="Backend Engineer", jd_text="Build APIs")
        session.add(role)
        session.commit()
        role_id = role.id

    provider = FakeProvider([valid_reply("Background summary.")])
    app = create_app(session_factory=factory, provider=provider)  # No executor given, so a real thread runs the job.

    try:
        with TestClient(app) as client:
            candidate_id = create(client, role_id)
            body = wait_until_not_pending(client, candidate_id)
    finally:
        engine.dispose()

    assert body["status"] == "ready"
    assert body["summary"] == "Background summary."
    assert len(provider.calls) == 1
