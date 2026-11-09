"""Candidate filters: search, stage and role filters, sorting, and stage counts."""

from datetime import datetime, timedelta, timezone
import pytest
from app.models import STAGES, Candidate, Stage

BASE_TIME = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)

def add_candidate(session, role_id, name, email, stage="Applied", days=0):
    """Insert a candidate with a fixed created_at, so the order in each test is predictable."""
    candidate = Candidate(
        name=name,
        email=email,
        role_id=role_id,
        stage=stage,
        resume_text="Resume text",
        created_at=BASE_TIME + timedelta(days=days),
    )
    session.add(candidate)
    session.commit()
    return candidate.id

@pytest.fixture
def pipeline(session, role_ids):
    """Five candidates across two roles and several stages. Later "days" means newer."""
    add_candidate(session, role_ids["backend"], "Ann Tan", "ann@example.com", "Interview", days=0)
    add_candidate(session, role_ids["frontend"], "Ben Lee", "ben@example.com", "Applied", days=1)
    add_candidate(session, role_ids["backend"], "Cara Diaz", "cara@example.com", "Rejected", days=2)
    add_candidate(session, role_ids["backend"], "Dev Patel", "dev@example.com", "Applied", days=3)
    add_candidate(session, role_ids["frontend"], "Eli Moss", "eli@example.com", "Offer", days=4)

def names(response):
    return [row["name"] for row in response.json()]

# The stage names must match the database exactly.
def test_stage_enum_values_match_the_database_strings():
    assert [stage.value for stage in Stage] == ["Applied", "Screening", "Interview", "Offer", "Rejected"]
    assert list(STAGES) == [stage.value for stage in Stage]

# Default order and sorting.
def test_no_filters_returns_newest_first(client, pipeline):
    response = client.get("/api/candidates")

    assert names(response) == ["Eli Moss", "Dev Patel", "Cara Diaz", "Ben Lee", "Ann Tan"]

def test_date_sort_is_newest_first_when_asked_for_explicitly(client, pipeline):
    response = client.get("/api/candidates", params={"sort": "added"})

    assert names(response) == ["Eli Moss", "Dev Patel", "Cara Diaz", "Ben Lee", "Ann Tan"]

def test_stage_sort_follows_pipeline_order_then_newest_first(client, pipeline):
    response = client.get("/api/candidates", params={"sort": "stage"})

    # Applied, then Interview, Offer and Rejected. Within Applied, the newer candidate comes first.
    assert names(response) == ["Dev Patel", "Ben Lee", "Ann Tan", "Eli Moss", "Cara Diaz"]

# Filters.
def test_stage_filter_returns_only_that_stage(client, pipeline):
    response = client.get("/api/candidates", params={"stage": "Applied"})

    assert names(response) == ["Dev Patel", "Ben Lee"]

def test_role_filter_returns_only_that_role(client, pipeline, role_ids):
    response = client.get("/api/candidates", params={"role_id": role_ids["frontend"]})

    assert names(response) == ["Eli Moss", "Ben Lee"]

def test_stage_and_role_filters_combine(client, pipeline, role_ids):
    response = client.get("/api/candidates", params={"stage": "Applied", "role_id": role_ids["backend"]})

    assert names(response) == ["Dev Patel"]

def test_role_with_no_candidates_returns_an_empty_list(client, role_ids):
    response = client.get("/api/candidates", params={"role_id": role_ids["backend"]})

    assert response.status_code == 200
    assert response.json() == []

# Search.
def test_search_matches_name_or_email_ignoring_case(client, pipeline):
    assert names(client.get("/api/candidates", params={"search": "ANN"})) == ["Ann Tan"]
    assert names(client.get("/api/candidates", params={"search": "ben@"})) == ["Ben Lee"]

def test_search_ignores_surrounding_spaces(client, pipeline):
    assert names(client.get("/api/candidates", params={"search": "  eli  "})) == ["Eli Moss"]

def test_search_treats_underscore_and_percent_literally(client, session, role_ids, pipeline):
    add_candidate(session, role_ids["backend"], "Ann_Tan", "underscore@example.com", days=5)

    # "_" must not act as a wildcard, so it matches only the name that contains an underscore.
    assert names(client.get("/api/candidates", params={"search": "_"})) == ["Ann_Tan"]
    # Without escaping, "Ann_" would also match "Ann Tan".
    assert names(client.get("/api/candidates", params={"search": "Ann_"})) == ["Ann_Tan"]
    # "%" is not in any name or email, so nothing matches.
    assert client.get("/api/candidates", params={"search": "%"}).json() == []

# Validation.
def test_unknown_stage_returns_422(client):
    assert client.get("/api/candidates", params={"stage": "Hired"}).status_code == 422

def test_stage_names_are_case_sensitive(client):
    assert client.get("/api/candidates", params={"stage": "interview"}).status_code == 422

def test_unknown_sort_returns_422(client):
    assert client.get("/api/candidates", params={"sort": "name"}).status_code == 422

def test_search_longer_than_200_characters_returns_422(client):
    assert client.get("/api/candidates", params={"search": "a" * 201}).status_code == 422

# Stage counts.
def test_counts_on_an_empty_database_return_zero_for_every_stage(client):
    response = client.get("/api/candidates/counts")

    assert response.status_code == 200
    assert response.json() == {
        "total": 0,
        "by_stage": {"Applied": 0, "Screening": 0, "Interview": 0, "Offer": 0, "Rejected": 0},
    }

def test_counts_include_zero_stages_and_the_total(client, pipeline):
    response = client.get("/api/candidates/counts")

    assert response.json() == {
        "total": 5,
        "by_stage": {"Applied": 2, "Screening": 0, "Interview": 1, "Offer": 1, "Rejected": 1},
    }

def test_counts_do_not_change_with_list_filters(client, pipeline):
    response = client.get("/api/candidates/counts", params={"stage": "Applied"})

    assert response.json()["total"] == 5
