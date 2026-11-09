"""The seed records one summary request per candidate, so the samples have summaries waiting to run."""

from sqlalchemy import select

from app.db import make_session_factory
from app.models import SummaryJob
from app.seed import CANDIDATES, seed_database


def load_jobs(engine):
    with make_session_factory(engine)() as session:
        return session.scalars(select(SummaryJob)).all()


def test_seed_records_one_pending_request_per_candidate(engine):
    seed_database(engine)

    jobs = load_jobs(engine)

    assert len(jobs) == len(CANDIDATES)
    assert {job.status for job in jobs} == {"pending"}


def test_seed_twice_still_records_one_request_per_candidate(engine):
    seed_database(engine)
    seed_database(engine)

    assert len(load_jobs(engine)) == len(CANDIDATES)
