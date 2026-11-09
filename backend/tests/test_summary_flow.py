"""The summary flow through the API: saving starts a job, the job runs later, and the summary always matches the current resume."""

import pytest
from sqlalchemy import func, select

from app.ai.provider import ProviderError
from app.models import Candidate
from app.resume import resume_hash
from tests.helpers import ANN, SENIOR, create, job_rows, regenerate, replace, retry, summary, valid_reply


def test_saving_returns_at_once_and_the_summary_is_pending_until_the_worker_runs(client, provider, executor, role_ids):
    provider.add_reply(valid_reply())
    candidate_id = create(client, role_ids["backend"])

    assert summary(client, candidate_id).json()["status"] == "pending"
    assert provider.calls == []
    assert executor.queued_count == 1

    executor.run_queued()

    assert summary(client, candidate_id).json()["status"] == "ready"
    assert len(provider.calls) == 1


def test_a_ready_summary_carries_the_result(client, provider, executor, role_ids):
    provider.add_reply(valid_reply("Backend developer with Python skills."))
    candidate_id = create(client, role_ids["backend"])
    executor.run_queued()

    body = summary(client, candidate_id).json()

    assert body["summary"] == "Backend developer with Python skills."
    assert body["skills"] == ["Python"]
    assert body["highlights"] == []
    assert body["suspicious_input"] is False
    assert body["error_code"] is None


def test_replacing_the_resume_shows_pending_for_the_new_text_and_never_the_old_result(
    client, provider, executor, role_ids
):
    provider.add_reply(valid_reply("About the first resume."))
    candidate_id = create(client, role_ids["backend"])
    executor.run_queued()

    replace(client, candidate_id, SENIOR)

    body = summary(client, candidate_id).json()
    assert body["status"] == "pending"
    assert body["input_hash"] == resume_hash(SENIOR)
    assert body["summary"] is None


def test_going_back_to_an_earlier_resume_reuses_its_ready_result_without_a_new_call(
    client, provider, executor, role_ids
):
    provider.add_reply(valid_reply("First resume."))
    provider.add_reply(valid_reply("Second resume."))
    candidate_id = create(client, role_ids["backend"], ANN)
    executor.run_queued()  # ANN is ready after one call.
    replace(client, candidate_id, SENIOR)
    executor.run_queued()  # SENIOR is ready after a second call.

    replace(client, candidate_id, ANN)

    assert executor.queued_count == 0
    body = summary(client, candidate_id).json()
    assert body["status"] == "ready"
    assert body["summary"] == "First resume."
    assert len(provider.calls) == 2


def test_a_job_for_an_earlier_resume_that_runs_late_does_not_call_the_provider(client, provider, executor, role_ids):
    provider.add_reply(valid_reply("Current."))
    candidate_id = create(client, role_ids["backend"], ANN)  # Job 1 is queued for ANN.
    replace(client, candidate_id, SENIOR)  # Job 1 is superseded. Job 2 is queued for SENIOR.

    executor.run_queued()

    assert [row["status"] for row in job_rows(client, candidate_id)] == ["superseded", "ready"]
    assert len(provider.calls) == 1
    assert summary(client, candidate_id).json()["summary"] == "Current."


@pytest.mark.parametrize("texts", [[ANN], [ANN, SENIOR], [ANN, SENIOR, ANN]])
def test_after_every_save_the_current_resume_has_a_job(client, provider, executor, role_ids, texts):
    for _ in texts:
        provider.add_reply(valid_reply())
    candidate_id = create(client, role_ids["backend"], texts[0])
    executor.run_queued()
    assert summary(client, candidate_id).json()["input_hash"] == resume_hash(texts[0])

    for text in texts[1:]:
        replace(client, candidate_id, text)
        executor.run_queued()
        response = summary(client, candidate_id)
        assert response.status_code == 200
        assert response.json()["input_hash"] == resume_hash(text)


def test_a_failed_summary_can_be_retried_and_the_new_job_can_succeed(client, provider, executor, role_ids):
    provider.add_reply(ProviderError("rate_limited"))
    provider.add_reply(valid_reply("Second try."))
    candidate_id = create(client, role_ids["backend"])
    executor.run_queued()
    failed = summary(client, candidate_id).json()
    assert failed["status"] == "failed"
    assert failed["error_code"] == "rate_limited"

    response = retry(client, candidate_id)
    assert response.status_code == 202
    assert response.json()["status"] == "pending"

    executor.run_queued()
    assert summary(client, candidate_id).json()["status"] == "ready"
    assert [row["status"] for row in job_rows(client, candidate_id)] == ["failed", "ready"]


def test_retry_is_refused_with_409_while_the_summary_is_pending_or_ready(client, provider, executor, role_ids):
    provider.add_reply(valid_reply())
    candidate_id = create(client, role_ids["backend"])

    pending = retry(client, candidate_id)
    assert pending.status_code == 409
    assert pending.json()["detail"] == "Only a failed summary can be retried"

    executor.run_queued()
    assert retry(client, candidate_id).status_code == 409


def test_retry_on_an_archived_candidate_is_refused_with_409(client, provider, executor, role_ids):
    provider.add_reply(ProviderError("provider_error"))
    candidate_id = create(client, role_ids["backend"])
    executor.run_queued()
    assert client.post(f"/candidates/{candidate_id}/archive").status_code == 200

    response = retry(client, candidate_id)

    assert response.status_code == 409
    assert "Restore this candidate" in response.json()["detail"]


def test_summary_of_an_unknown_candidate_is_404(client):
    assert client.get("/candidates/999/summary").status_code == 404


def test_a_failure_while_recording_the_request_leaves_no_candidate_behind(client, role_ids, monkeypatch):
    from tests.helpers import form

    def broken(session, candidate):
        raise RuntimeError("the request could not be recorded")

    monkeypatch.setattr("app.routers.candidates.request_summary", broken)

    with pytest.raises(RuntimeError):
        client.post("/candidates", data=form(role_ids["backend"]))

    with client.app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Candidate)) == 0


def test_regenerate_runs_the_provider_again_even_when_a_ready_result_exists(client, provider, executor, role_ids):
    provider.add_reply(valid_reply("First summary."))
    provider.add_reply(valid_reply("Regenerated summary."))
    candidate_id = create(client, role_ids["backend"])
    executor.run_queued()

    response = regenerate(client, candidate_id)

    assert response.status_code == 202
    assert response.json()["status"] == "pending"
    executor.run_queued()
    assert summary(client, candidate_id).json()["summary"] == "Regenerated summary."
    assert len(provider.calls) == 2
    # The earlier result stays in the history.
    assert [row["status"] for row in job_rows(client, candidate_id)] == ["ready", "ready"]


def test_regenerate_is_refused_with_409_unless_the_summary_is_ready(client, provider, executor, role_ids):
    provider.add_reply(ProviderError("provider_error"))
    candidate_id = create(client, role_ids["backend"])

    assert regenerate(client, candidate_id).status_code == 409  # Still pending.

    executor.run_queued()  # Now failed.
    response = regenerate(client, candidate_id)
    assert response.status_code == 409
    assert response.json()["detail"] == "Only a ready summary can be regenerated"


def test_regenerate_on_an_archived_candidate_is_refused_with_409(client, provider, executor, role_ids):
    provider.add_reply(valid_reply())
    candidate_id = create(client, role_ids["backend"])
    executor.run_queued()
    assert client.post(f"/candidates/{candidate_id}/archive").status_code == 200

    response = regenerate(client, candidate_id)

    assert response.status_code == 409
    assert "Restore this candidate" in response.json()["detail"]
