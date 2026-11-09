"""Note API tests: notes have their own endpoint, and once saved they cannot be edited or deleted."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.models import Note

BASE_TIME = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)


def create_candidate(client, role_id, email="ann@example.com", name="Ann Tan"):
    response = client.post(
        "/api/candidates",
        data={
            "name": name,
            "email": email,
            "role_id": str(role_id),
            "phone": "",
            "source": "Referral",
            "resume_text": "Python developer, 2 years",
        },
    )
    assert response.status_code == 201
    return response.json()


def notes_url(candidate_id):
    return f"/api/candidates/{candidate_id}/notes"


# Adding notes.

def test_post_note_returns_201_with_a_server_set_utc_timestamp(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])
    before = datetime.now(timezone.utc)

    response = client.post(notes_url(candidate["id"]), json={"body": "Called, positive"})

    after = datetime.now(timezone.utc)
    assert response.status_code == 201
    body = response.json()
    assert body["body"] == "Called, positive"
    assert body["candidate_id"] == candidate["id"]
    created_at = datetime.fromisoformat(body["created_at"])
    assert created_at.utcoffset() == timedelta(0)
    assert before - timedelta(seconds=1) <= created_at <= after + timedelta(seconds=1)


def test_client_cannot_set_the_timestamp(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])

    response = client.post(
        notes_url(candidate["id"]),
        json={"body": "Called", "created_at": "2001-01-01T00:00:00Z"},
    )

    created_at = datetime.fromisoformat(response.json()["created_at"])
    assert created_at.year >= 2026


def test_note_body_is_trimmed(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])

    response = client.post(notes_url(candidate["id"]), json={"body": "  Called  \n"})

    assert response.json()["body"] == "Called"


@pytest.mark.parametrize("body", ["", "   ", "\n\t", "\r\n"])
def test_blank_note_returns_422(client, role_ids, body):
    candidate = create_candidate(client, role_ids["backend"])

    response = client.post(notes_url(candidate["id"]), json={"body": body})

    assert response.status_code == 422


def test_note_of_exactly_2000_characters_is_accepted(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])

    response = client.post(notes_url(candidate["id"]), json={"body": "a" * 2000})

    assert response.status_code == 201


def test_note_over_2000_characters_returns_422(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])

    response = client.post(notes_url(candidate["id"]), json={"body": "a" * 2001})

    assert response.status_code == 422


def test_null_character_in_note_returns_422(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])

    response = client.post(notes_url(candidate["id"]), json={"body": "Called\x00"})

    assert response.status_code == 422


def test_missing_body_returns_422(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])

    response = client.post(notes_url(candidate["id"]), json={})

    assert response.status_code == 422


def test_unknown_candidate_returns_404_for_list_and_add(client):
    assert client.get(notes_url(999)).status_code == 404
    assert client.post(notes_url(999), json={"body": "Hello"}).status_code == 404


# Listing notes.

def test_notes_are_listed_newest_first(client, session, role_ids):
    candidate = create_candidate(client, role_ids["backend"])
    for days, body in [(0, "First"), (2, "Third"), (1, "Second")]:
        session.add(Note(candidate_id=candidate["id"], body=body, created_at=BASE_TIME + timedelta(days=days)))
    session.commit()

    response = client.get(notes_url(candidate["id"]))

    assert [row["body"] for row in response.json()] == ["Third", "Second", "First"]


def test_each_candidate_only_sees_their_own_notes(client, role_ids):
    ann = create_candidate(client, role_ids["backend"], email="ann@example.com", name="Ann Tan")
    ben = create_candidate(client, role_ids["frontend"], email="ben@example.com", name="Ben Lee")
    client.post(notes_url(ann["id"]), json={"body": "Ann's note"})
    client.post(notes_url(ben["id"]), json={"body": "Ben's note"})

    response = client.get(notes_url(ann["id"]))

    assert [row["body"] for row in response.json()] == ["Ann's note"]


# Notes cannot be edited or deleted.

@pytest.mark.parametrize("method", ["PUT", "DELETE"])
def test_notes_cannot_be_edited_or_deleted_through_the_api(client, role_ids, method):
    candidate = create_candidate(client, role_ids["backend"])
    client.post(notes_url(candidate["id"]), json={"body": "Original"})

    response = client.request(method, notes_url(candidate["id"]), json={"body": "Changed"})

    assert response.status_code == 405


def test_the_database_blocks_changes_to_a_saved_note(client, session, role_ids):
    candidate = create_candidate(client, role_ids["backend"])
    client.post(notes_url(candidate["id"]), json={"body": "Original"})

    with pytest.raises(DBAPIError):
        session.execute(text("UPDATE notes SET body = 'changed'"))
    session.rollback()

    with pytest.raises(DBAPIError):
        session.execute(text("DELETE FROM notes"))
    session.rollback()

    assert [row["body"] for row in client.get(notes_url(candidate["id"])).json()] == ["Original"]


# Archiving and notes.

def test_archived_candidate_can_still_get_notes(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])
    client.post(f"/api/candidates/{candidate['id']}/archive")

    response = client.post(notes_url(candidate["id"]), json={"body": "Left a voicemail"})

    assert response.status_code == 201


def test_notes_survive_archive_and_restore_unchanged(client, role_ids):
    candidate = create_candidate(client, role_ids["backend"])
    client.post(notes_url(candidate["id"]), json={"body": "Strong systems thinking"})
    before = client.get(notes_url(candidate["id"])).json()

    client.post(f"/api/candidates/{candidate['id']}/archive")
    client.post(notes_url(candidate["id"]), json={"body": "Added while archived"})
    client.post(f"/api/candidates/{candidate['id']}/restore")

    after = client.get(notes_url(candidate["id"])).json()
    assert [row["body"] for row in after] == ["Added while archived", "Strong systems thinking"]
    assert after[1] == before[0]
