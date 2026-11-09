"""A pending job older than three minutes reads as timed out. The clock is replaced, so no test waits."""

from datetime import timedelta

from sqlalchemy import select

from app.deps import get_clock
from app.models import SummaryJob
from tests.helpers import create, summary, valid_reply


def set_clock(client, moment) -> None:
    client.app.dependency_overrides[get_clock] = lambda: moment


def created_at(client, candidate_id: int):
    with client.app.state.session_factory() as session:
        return session.scalars(select(SummaryJob).where(SummaryJob.candidate_id == candidate_id)).one().created_at


def test_a_job_is_pending_just_before_three_minutes_and_timed_out_just_after(client, role_ids):
    candidate_id = create(client, role_ids["backend"])
    started = created_at(client, candidate_id)

    set_clock(client, started + timedelta(minutes=2, seconds=59))
    assert summary(client, candidate_id).json()["status"] == "pending"

    set_clock(client, started + timedelta(minutes=3, seconds=1))
    body = summary(client, candidate_id).json()
    assert body["status"] == "failed"
    assert body["error_code"] == "timeout"


def test_a_worker_that_runs_after_the_timeout_does_not_change_the_row(client, provider, executor, role_ids):
    provider.add_reply(valid_reply("Too late."))
    candidate_id = create(client, role_ids["backend"])
    started = created_at(client, candidate_id)
    set_clock(client, started + timedelta(minutes=4))
    summary(client, candidate_id)  # Times the job out.

    executor.run_queued()

    body = summary(client, candidate_id).json()
    assert body["status"] == "failed"
    assert body["error_code"] == "timeout"
    assert provider.calls == []
