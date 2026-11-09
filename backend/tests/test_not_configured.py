"""Without GEMINI_API_KEY the app still runs: candidates save, and each summary fails with not_configured."""

from fastapi.testclient import TestClient

from app.ai.gemini_provider import make_provider
from app.ai.provider import SUMMARY_MODEL
from app.db import make_session_factory
from app.main import create_app
from tests.helpers import create, summary


def test_saving_still_works_and_the_summary_reports_not_configured(engine, executor, role_ids):
    app = create_app(
        session_factory=make_session_factory(engine),
        provider=make_provider(None, SUMMARY_MODEL),
        executor=executor,
    )

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        candidate_id = create(client, role_ids["backend"])
        executor.run_queued()
        body = summary(client, candidate_id).json()

    assert body["status"] == "failed"
    assert body["error_code"] == "not_configured"
