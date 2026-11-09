"""Seed script tests: running the seed again must not duplicate rows, and the samples must cover archiving."""

from sqlalchemy import select

from app.db import make_session_factory
from app.models import Candidate
from app.queries import stage_counts
from app.seed import CANDIDATES, ROLES, count_rows, seed_database


def test_seed_twice_creates_no_duplicates(engine):
    seed_database(engine)
    first = count_rows(engine)

    seed_database(engine)
    second = count_rows(engine)

    assert first == (len(ROLES), len(CANDIDATES))
    assert second == first


def test_seed_includes_archived_candidates_that_counts_leave_out(engine):
    seed_database(engine)
    archived_expected = [candidate for candidate in CANDIDATES if candidate.get("archived_at")]
    active_expected = [candidate for candidate in CANDIDATES if not candidate.get("archived_at")]
    assert archived_expected, "the seed should include at least one archived sample"

    with make_session_factory(engine)() as session:
        archived = session.scalars(select(Candidate).where(Candidate.archived_at.is_not(None))).all()
        counts = stage_counts(session)

    assert len(archived) == len(archived_expected)
    assert sum(counts.values()) == len(active_expected)
