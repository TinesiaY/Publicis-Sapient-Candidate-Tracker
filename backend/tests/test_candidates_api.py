"""Candidate API tests: each test checks one rule the endpoints must follow."""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.db import make_session_factory
from app.deps import get_session
from app.main import app
from app.routers.candidates import _is_duplicate_application


@pytest.fixture
def client(engine):
    session_factory = make_session_factory(engine)

    def override_get_session():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def candidate_form(role_id, **overrides):
    form = {
        "name": "Ann Tan",
        "email": "ann@example.com",
        "role_id": str(role_id),
        "phone": "",
        "source": "Referral",
        "resume_text": "Python developer, 2 years",
    }
    form.update(overrides)
    return form


def test_valid_post_returns_201_and_lowercases_email(client, role_ids):
    response = client.post(
        "/candidates",
        data=candidate_form(role_ids["backend"], email="Ann@Example.com"),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ann@example.com"
    assert body["stage"] == "Applied"
    assert body["phone"] is None
    assert body["resume_text"] == "Python developer, 2 years"


def test_created_at_is_returned_with_utc_offset(client, role_ids):
    response = client.post("/candidates", data=candidate_form(role_ids["backend"]))

    created_at = datetime.fromisoformat(response.json()["created_at"])
    assert created_at.utcoffset() == timedelta(0)


def test_bad_email_returns_422(client, role_ids):
    response = client.post(
        "/candidates",
        data=candidate_form(role_ids["backend"], email="not-an-email"),
    )

    assert response.status_code == 422


@pytest.mark.parametrize("resume_text", ["", "   \n  ", "\n\t"])
def test_blank_resume_returns_422(client, role_ids, resume_text):
    response = client.post(
        "/candidates",
        data=candidate_form(role_ids["backend"], resume_text=resume_text),
    )

    assert response.status_code == 422


def test_null_character_in_resume_returns_422_not_409(client, role_ids):
    response = client.post(
        "/candidates",
        data=candidate_form(role_ids["backend"], resume_text="\x00abc"),
    )

    assert response.status_code == 422


def test_null_character_in_name_returns_422(client, role_ids):
    response = client.post(
        "/candidates",
        data=candidate_form(role_ids["backend"], name="Ann\x00Tan"),
    )

    assert response.status_code == 422


def test_missing_resume_returns_422(client, role_ids):
    form = candidate_form(role_ids["backend"])
    del form["resume_text"]

    response = client.post("/candidates", data=form)

    assert response.status_code == 422


def test_same_email_and_role_returns_409(client, role_ids):
    form = candidate_form(role_ids["backend"])
    assert client.post("/candidates", data=form).status_code == 201

    response = client.post("/candidates", data=form)

    assert response.status_code == 409


def test_same_email_with_another_role_returns_201(client, role_ids):
    assert client.post("/candidates", data=candidate_form(role_ids["backend"])).status_code == 201

    response = client.post("/candidates", data=candidate_form(role_ids["frontend"]))

    assert response.status_code == 201


def test_unknown_role_returns_422(client, role_ids):
    response = client.post("/candidates", data=candidate_form(role_id=999))

    assert response.status_code == 422


def test_list_returns_created_candidates_without_resume_text(client, role_ids):
    client.post("/candidates", data=candidate_form(role_ids["backend"]))
    client.post("/candidates", data=candidate_form(role_ids["frontend"]))

    response = client.get("/candidates")

    assert response.status_code == 200
    rows = response.json()
    assert [row["role_id"] for row in rows] == [role_ids["backend"], role_ids["frontend"]]
    assert "resume_text" not in rows[0]


def test_detail_returns_candidate_with_resume_text(client, role_ids):
    created = client.post("/candidates", data=candidate_form(role_ids["backend"])).json()

    response = client.get(f"/candidates/{created['id']}")

    assert response.status_code == 200
    assert response.json()["resume_text"] == "Python developer, 2 years"


def test_unknown_id_returns_404(client):
    response = client.get("/candidates/999")

    assert response.status_code == 404


def test_only_the_email_and_role_violation_counts_as_duplicate():
    duplicate = IntegrityError(
        "INSERT", {}, Exception("UNIQUE constraint failed: candidates.email, candidates.role_id")
    )
    other = IntegrityError(
        "INSERT", {}, Exception("CHECK constraint failed: ck_candidates_resume_not_blank")
    )

    assert _is_duplicate_application(duplicate)
    assert not _is_duplicate_application(other)
