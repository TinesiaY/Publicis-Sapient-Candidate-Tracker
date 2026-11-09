"""Candidate lifecycle: stage moves, archive and restore, and what each one must leave unchanged."""

import pytest
from sqlalchemy import func, select

from app.models import Note


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


def create(client, role_id, **overrides):
    response = client.post("/candidates", data=candidate_form(role_id, **overrides))
    assert response.status_code == 201
    return response.json()


def note_bodies(session, candidate_id):
    return list(
        session.scalars(
            select(Note.body).where(Note.candidate_id == candidate_id).order_by(Note.id)
        )
    )


# Stage moves.

def test_stage_can_move_forward_and_back(client, role_ids):
    candidate = create(client, role_ids["backend"])

    forward = client.patch(f"/candidates/{candidate['id']}/stage", json={"stage": "Interview"})
    back = client.patch(f"/candidates/{candidate['id']}/stage", json={"stage": "Applied"})

    assert forward.status_code == 200
    assert forward.json()["stage"] == "Interview"
    assert back.status_code == 200
    assert back.json()["stage"] == "Applied"


def test_stage_change_is_still_there_when_the_candidate_is_fetched_again(client, role_ids):
    candidate = create(client, role_ids["backend"])
    client.patch(f"/candidates/{candidate['id']}/stage", json={"stage": "Offer"})

    response = client.get(f"/candidates/{candidate['id']}")

    assert response.json()["stage"] == "Offer"


@pytest.mark.parametrize("stage", ["Hired", "interview"])
def test_unknown_or_lowercase_stage_returns_422(client, role_ids, stage):
    candidate = create(client, role_ids["backend"])

    response = client.patch(f"/candidates/{candidate['id']}/stage", json={"stage": stage})

    assert response.status_code == 422


# Unknown ids.

@pytest.mark.parametrize("action", ["stage", "archive", "restore"])
def test_unknown_id_returns_404(client, action):
    if action == "stage":
        response = client.patch("/candidates/999/stage", json={"stage": "Applied"})
    else:
        response = client.post(f"/candidates/999/{action}")

    assert response.status_code == 404


# Archive hides and restore shows.

def test_archived_candidate_is_hidden_from_the_list_and_the_counts(client, role_ids):
    candidate = create(client, role_ids["backend"])

    client.post(f"/candidates/{candidate['id']}/archive")

    assert client.get("/candidates").json() == []
    counts = client.get("/candidates/counts").json()
    assert counts["total"] == 0
    assert counts["by_stage"]["Applied"] == 0


def test_archived_flag_shows_active_or_archived_candidates_only(client, role_ids):
    active = create(client, role_ids["backend"], email="active@example.com", name="Active Ann")
    archived = create(client, role_ids["backend"], email="archived@example.com", name="Archived Ben")
    client.post(f"/candidates/{archived['id']}/archive")

    default_ids = [row["id"] for row in client.get("/candidates").json()]
    active_ids = [row["id"] for row in client.get("/candidates", params={"archived": False}).json()]
    archived_ids = [row["id"] for row in client.get("/candidates", params={"archived": True}).json()]

    assert default_ids == [active["id"]]
    assert active_ids == [active["id"]]
    assert archived_ids == [archived["id"]]


def test_restore_brings_the_candidate_back_to_the_list_and_the_counts(client, role_ids):
    candidate = create(client, role_ids["backend"])
    client.post(f"/candidates/{candidate['id']}/archive")

    response = client.post(f"/candidates/{candidate['id']}/restore")

    assert response.status_code == 200
    assert response.json()["archived_at"] is None
    assert [row["id"] for row in client.get("/candidates").json()] == [candidate["id"]]
    assert client.get("/candidates/counts").json()["total"] == 1


# What archive and restore must leave unchanged.

def test_archive_and_restore_keep_stage_creation_date_resume_and_notes(client, session, role_ids):
    candidate = create(client, role_ids["backend"], resume_text="Python developer, 2 years")
    candidate_id = candidate["id"]
    client.patch(f"/candidates/{candidate_id}/stage", json={"stage": "Interview"})
    session.add(Note(candidate_id=candidate_id, body="Strong systems thinking"))
    session.commit()
    before = client.get(f"/candidates/{candidate_id}").json()

    archived = client.post(f"/candidates/{candidate_id}/archive").json()
    restored = client.post(f"/candidates/{candidate_id}/restore").json()

    for body in (archived, restored):
        assert body["stage"] == "Interview"
        assert body["created_at"] == before["created_at"]
        assert body["resume_text"] == "Python developer, 2 years"
    assert archived["archived_at"] is not None
    assert restored["archived_at"] is None
    assert note_bodies(session, candidate_id) == ["Strong systems thinking"]


def test_archiving_twice_keeps_the_first_archive_time(client, role_ids):
    candidate = create(client, role_ids["backend"])

    first = client.post(f"/candidates/{candidate['id']}/archive").json()
    second = client.post(f"/candidates/{candidate['id']}/archive").json()

    assert second["archived_at"] == first["archived_at"]


def test_restoring_an_active_candidate_changes_nothing(client, role_ids):
    candidate = create(client, role_ids["backend"])

    response = client.post(f"/candidates/{candidate['id']}/restore")

    assert response.status_code == 200
    assert response.json()["archived_at"] is None
    assert response.json()["stage"] == "Applied"


def test_stage_cannot_change_while_archived_until_restored(client, role_ids):
    candidate = create(client, role_ids["backend"])
    client.post(f"/candidates/{candidate['id']}/archive")

    blocked = client.patch(f"/candidates/{candidate['id']}/stage", json={"stage": "Offer"})
    client.post(f"/candidates/{candidate['id']}/restore")
    allowed = client.patch(f"/candidates/{candidate['id']}/stage", json={"stage": "Offer"})

    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "Restore this candidate before changing their stage"
    assert allowed.status_code == 200
    assert allowed.json()["stage"] == "Offer"


# Job counts and re-applying.

def test_job_candidate_count_excludes_archived_candidates(client, role_ids):
    candidate = create(client, role_ids["backend"])
    assert client.get(f"/roles/{role_ids['backend']}").json()["candidate_count"] == 1

    client.post(f"/candidates/{candidate['id']}/archive")

    assert client.get(f"/roles/{role_ids['backend']}").json()["candidate_count"] == 0
    assert client.get("/roles").json()[0]["candidate_count"] == 0


def test_applying_again_after_archive_points_to_the_archive(client, role_ids):
    candidate = create(client, role_ids["backend"])
    client.post(f"/candidates/{candidate['id']}/archive")

    response = client.post("/candidates", data=candidate_form(role_ids["backend"]))

    assert response.status_code == 409
    assert "archive" in response.json()["detail"].lower()
    assert "restore" in response.json()["detail"].lower()
