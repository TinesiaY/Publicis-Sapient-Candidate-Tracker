"""The Gemini key: without it a summary fails with not_configured and is not retried; once the key is set, that failure can be retried."""

from fastapi.testclient import TestClient

from app.ai.gemini_provider import make_provider
from app.ai.provider import SUMMARY_MODEL
from app.db import make_session_factory
from app.main import create_app
from tests.helpers import create, retry, summary, valid_reply


def test_without_a_key_the_summary_reports_provider_not_configured(engine, executor, role_ids):
    app = create_app(
        session_factory=make_session_factory(engine),
        provider=make_provider(None, SUMMARY_MODEL),
        executor=executor,
    )

    with TestClient(app) as client:
        candidate_id = create(client, role_ids["backend"])
        executor.run_queued()
        body = summary(client, candidate_id).json()

    assert body["provider_configured"] is False
    assert body["error_code"] == "not_configured"


def test_a_summary_that_failed_without_a_key_can_be_retried_once_the_key_is_set(
    engine, executor, provider, role_ids
):
    session_factory = make_session_factory(engine)

    # The server starts without a key, so the summary fails.
    without_key = create_app(session_factory=session_factory, provider=make_provider(None, SUMMARY_MODEL), executor=executor)
    with TestClient(without_key) as client:
        candidate_id = create(client, role_ids["backend"])
        executor.run_queued()
        assert summary(client, candidate_id).json()["error_code"] == "not_configured"

    # The server starts again with a key, and the same failed summary can now be retried.
    provider.add_reply(valid_reply("Summary made after the key was set."))
    with_key = create_app(session_factory=session_factory, provider=provider, executor=executor)
    with TestClient(with_key) as client:
        assert summary(client, candidate_id).json()["provider_configured"] is True

        response = retry(client, candidate_id)
        assert response.status_code == 202
        executor.run_queued()

        body = summary(client, candidate_id).json()
    assert body["status"] == "ready"
    assert body["summary"] == "Summary made after the key was set."
