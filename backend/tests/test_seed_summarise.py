"""The seed's summary run: every sample candidate gets a request, pending requests run one at a time, and a second run calls nothing."""

from sqlalchemy import select

from app.ai.fake import FakeProvider
from app.db import make_session_factory
from app.models import Candidate, SummaryJob
from app.seed import CANDIDATES, main, run_seed_summaries, seed_database
from tests.helpers import valid_reply


def test_every_sample_candidate_is_summarised_one_job_at_a_time(engine):
    seed_database(engine)
    provider = FakeProvider([valid_reply()] * len(CANDIDATES))

    results = run_seed_summaries(engine, provider)

    assert len(results) == len(CANDIDATES)
    assert {result.status for result in results} == {"ready"}
    assert len(provider.calls) == len(CANDIDATES)


def test_running_it_again_calls_nothing(engine):
    seed_database(engine)
    run_seed_summaries(engine, FakeProvider([valid_reply()] * len(CANDIDATES)))
    provider = FakeProvider([])

    assert run_seed_summaries(engine, provider) == []
    assert provider.calls == []


def test_one_failed_summary_does_not_stop_the_others(engine):
    seed_database(engine)
    provider = FakeProvider(["not json"] + [valid_reply()] * (len(CANDIDATES) - 1))

    results = run_seed_summaries(engine, provider)

    failed = [result for result in results if result.status == "failed"]
    assert len(failed) == 1
    assert failed[0].error_code == "invalid_output"
    assert sum(result.status == "ready" for result in results) == len(CANDIDATES) - 1


def test_an_archived_candidate_whose_request_failed_is_summarised_again(engine):
    seed_database(engine)
    with make_session_factory(engine)() as session:
        job = session.scalars(select(SummaryJob).join(SummaryJob.candidate).where(Candidate.name == "Charlotte Lee")).one()
        job.status = "failed"
        job.error_code = "interrupted"
        session.commit()
    provider = FakeProvider([valid_reply()] * len(CANDIDATES))

    results = run_seed_summaries(engine, provider)

    charlotte = [result for result in results if result.name == "Charlotte Lee"]
    assert [result.status for result in charlotte] == ["ready"]
    assert len(results) == len(CANDIDATES)


def test_without_a_key_the_command_runs_nothing(engine, monkeypatch, capsys):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    seed_database(engine)
    with make_session_factory(engine)() as session:
        before = session.scalars(select(SummaryJob.status).order_by(SummaryJob.id)).all()

    exit_code = main(["--summarise"], engine=engine)

    with make_session_factory(engine)() as session:
        after = session.scalars(select(SummaryJob.status).order_by(SummaryJob.id)).all()
    assert exit_code == 1
    assert before == after
    assert "Nothing was run" in capsys.readouterr().out
