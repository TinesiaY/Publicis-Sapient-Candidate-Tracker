"""Role API tests: the jobs list, job details, and creating a job."""

import pytest


def candidate_form(role_id):
    return {
        "name": "Ann Tan",
        "email": "ann@example.com",
        "role_id": str(role_id),
        "phone": "",
        "source": "Referral",
        "resume_text": "Python developer, 2 years",
    }


def test_list_roles_returns_name_and_candidate_count_ordered_by_name(client, role_ids):
    response = client.get("/api/roles")

    assert response.status_code == 200
    rows = response.json()
    assert [row["name"] for row in rows] == ["Backend Engineer", "Frontend Engineer"]
    assert rows[0]["id"] == role_ids["backend"]
    assert set(rows[0]) == {"id", "name", "candidate_count"}


def test_candidate_count_counts_applications_for_the_job(client, role_ids):
    client.post("/api/candidates", data=candidate_form(role_ids["backend"]))

    rows = client.get("/api/roles").json()

    counts = {row["name"]: row["candidate_count"] for row in rows}
    assert counts == {"Backend Engineer": 1, "Frontend Engineer": 0}


def test_role_detail_includes_the_job_description(client, role_ids):
    response = client.get(f"/api/roles/{role_ids['backend']}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Backend Engineer"
    assert body["jd_text"] == "Build APIs"


def test_unknown_role_detail_returns_404(client):
    assert client.get("/api/roles/999").status_code == 404


def test_create_role_returns_201_with_the_saved_job(client):
    response = client.post(
        "/api/roles",
        json={"name": "Data Analyst", "jd_text": "Analyse product data and report on it."},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Data Analyst"
    assert body["jd_text"] == "Analyse product data and report on it."
    assert body["candidate_count"] == 0


def test_create_role_trims_the_name(client):
    response = client.post("/api/roles", json={"name": "  Data Analyst  ", "jd_text": "Analyse data."})

    assert response.json()["name"] == "Data Analyst"


@pytest.mark.parametrize("name", ["", "   ", "\n\t"])
def test_blank_job_name_returns_422(client, name):
    response = client.post("/api/roles", json={"name": name, "jd_text": "Analyse data."})

    assert response.status_code == 422


@pytest.mark.parametrize("jd_text", ["", "   ", "\n\t"])
def test_blank_job_description_returns_422(client, jd_text):
    response = client.post("/api/roles", json={"name": "Data Analyst", "jd_text": jd_text})

    assert response.status_code == 422


def test_null_character_in_job_description_returns_422(client):
    response = client.post("/api/roles", json={"name": "Data Analyst", "jd_text": "Analyse\x00data."})

    assert response.status_code == 422


def test_duplicate_job_name_returns_409(client, role_ids):
    response = client.post("/api/roles", json={"name": "Backend Engineer", "jd_text": "Something else."})

    assert response.status_code == 409
    assert response.json()["detail"] == "A job with this name already exists"


@pytest.mark.parametrize("name", ["backend engineer", "BACKEND ENGINEER", "  Backend Engineer  "])
def test_job_names_that_differ_only_in_case_or_spacing_are_duplicates(client, role_ids, name):
    response = client.post("/api/roles", json={"name": name, "jd_text": "Something else."})

    assert response.status_code == 409
