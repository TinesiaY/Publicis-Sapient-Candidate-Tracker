"""On startup, jobs left pending by an earlier run are marked interrupted. Finished jobs are left alone."""

from fastapi.testclient import TestClient

from app.db import make_session_factory
from app.main import create_app
from tests.helpers import create, job_rows, summary, valid_reply


def test_jobs_left_pending_are_marked_interrupted_when_the_app_starts(client, engine, provider, executor, role_ids):
    provider.add_reply(valid_reply("Finished earlier."))
    provider.add_reply(valid_reply("Also finished."))
    finished_a = create(client, role_ids["backend"], email="one@example.com")
    finished_b = create(client, role_ids["backend"], email="two@example.com")
    executor.run_queued()
    left_pending = create(client, role_ids["frontend"], email="three@example.com")

    restarted = create_app(session_factory=make_session_factory(engine), provider=provider, executor=executor)
    with TestClient(restarted):
        pass

    assert job_rows(client, left_pending)[0]["status"] == "failed"
    assert job_rows(client, left_pending)[0]["error_code"] == "interrupted"
    assert summary(client, finished_a).json()["status"] == "ready"
    assert summary(client, finished_b).json()["status"] == "ready"
