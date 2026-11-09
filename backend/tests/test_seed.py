"""Seed script tests: running the seed again must not duplicate rows."""

from app.seed import CANDIDATES, ROLES, count_rows, seed_database


def test_seed_twice_creates_no_duplicates(engine):
    seed_database(engine)
    first = count_rows(engine)

    seed_database(engine)
    second = count_rows(engine)

    assert first == (len(ROLES), len(CANDIDATES))
    assert second == first
