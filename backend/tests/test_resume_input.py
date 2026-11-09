"""Resume input: one of pasted text or one .txt or .md file, at most 500 KB, on create and on replace."""

from sqlalchemy import select

from app.models import Note, SummaryJob
from app.resume import resume_hash

LIMIT = 500 * 1024


def form(role_id, **overrides):
    data = {
        "name": "Ann Tan",
        "email": "ann@example.com",
        "role_id": str(role_id),
        "phone": "",
        "source": "Referral",
        "resume_text": "Python developer, 2 years",
    }
    data.update(overrides)
    return data


def create_with_file(client, role_id, filename, content, email="ann@example.com"):
    # The browser sends an empty text field when a file is chosen, so do the same here.
    return client.post(
        "/api/candidates",
        data=form(role_id, email=email, resume_text=""),
        files={"resume_file": (filename, content, "text/plain")},
    )


def notes_url(candidate_id):
    return f"/api/candidates/{candidate_id}/notes"


# Creating with pasted text or a file.

def test_pasted_text_is_stored(client, role_ids):
    response = client.post("/api/candidates", data=form(role_ids["backend"]))

    assert response.status_code == 201
    assert response.json()["resume_text"] == "Python developer, 2 years"


def test_uploaded_txt_file_is_stored(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.txt", b"Python developer, 2 years")

    assert response.status_code == 201
    assert response.json()["resume_text"] == "Python developer, 2 years"


def test_uploaded_md_file_is_stored(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.md", b"# Ann Tan\n\nPython developer")

    assert response.status_code == 201
    assert response.json()["resume_text"] == "# Ann Tan\n\nPython developer"


def test_pdf_file_is_rejected(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.pdf", b"%PDF-1.4")

    assert response.status_code == 422


def test_pasted_text_and_a_file_together_are_rejected(client, role_ids):
    response = client.post(
        "/api/candidates",
        data=form(role_ids["backend"]),
        files={"resume_file": ("resume.txt", b"Also here", "text/plain")},
    )

    assert response.status_code == 422


def test_neither_pasted_text_nor_a_file_is_rejected(client, role_ids):
    response = client.post("/api/candidates", data=form(role_ids["backend"], resume_text=""))

    assert response.status_code == 422


def test_file_of_exactly_the_limit_is_accepted(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.txt", b"a" * LIMIT)

    assert response.status_code == 201


def test_file_one_byte_over_the_limit_returns_413(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.txt", b"a" * (LIMIT + 1))

    assert response.status_code == 413


def test_pasted_text_over_the_limit_returns_413(client, role_ids):
    response = client.post("/api/candidates", data=form(role_ids["backend"], resume_text="a" * (LIMIT + 1)))

    assert response.status_code == 413


def test_non_utf8_file_returns_422(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.txt", b"\xff\xfe\xfd")

    assert response.status_code == 422


def test_file_with_a_null_character_returns_422(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.txt", b"Python\x00developer")

    assert response.status_code == 422


def test_blank_file_returns_422(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.txt", b"   \n\t")

    assert response.status_code == 422


def test_byte_order_mark_is_removed_from_the_stored_text(client, role_ids):
    response = create_with_file(client, role_ids["backend"], "resume.txt", b"\xef\xbb\xbfPython developer")

    assert response.json()["resume_text"] == "Python developer"


def test_pasted_and_uploaded_versions_of_the_same_text_have_the_same_hash(client, session, role_ids):
    pasted = client.post("/api/candidates", data=form(role_ids["backend"], email="pasted@example.com")).json()
    uploaded = create_with_file(
        client, role_ids["frontend"], "resume.txt", b"Python developer, 2 years", email="uploaded@example.com"
    ).json()

    assert resume_hash(pasted["resume_text"]) == resume_hash(uploaded["resume_text"])


# Replacing the resume.

def test_replace_with_pasted_text(client, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    response = client.put(f"/api/candidates/{candidate['id']}/resume", data={"resume_text": "Senior developer"})

    assert response.status_code == 200
    assert response.json()["resume_text"] == "Senior developer"


def test_replace_with_an_uploaded_file(client, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    response = client.put(
        f"/api/candidates/{candidate['id']}/resume",
        files={"resume_file": ("cv.md", b"# CV", "text/markdown")},
    )

    assert response.status_code == 200
    assert response.json()["resume_text"] == "# CV"


def test_replace_rejects_pasted_text_and_a_file_together(client, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    response = client.put(
        f"/api/candidates/{candidate['id']}/resume",
        data={"resume_text": "Text"},
        files={"resume_file": ("cv.txt", b"File", "text/plain")},
    )

    assert response.status_code == 422


def test_replace_rejects_a_request_with_no_resume(client, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    response = client.put(f"/api/candidates/{candidate['id']}/resume")

    assert response.status_code == 422


def test_replace_rejects_blank_text(client, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    response = client.put(f"/api/candidates/{candidate['id']}/resume", data={"resume_text": "  \n\t"})

    assert response.status_code == 422


def test_replace_keeps_stage_notes_and_creation_date(client, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()
    client.patch(f"/api/candidates/{candidate['id']}/stage", json={"stage": "Interview"})
    client.post(notes_url(candidate["id"]), json={"body": "Strong systems thinking"})
    before = client.get(f"/api/candidates/{candidate['id']}").json()

    client.put(f"/api/candidates/{candidate['id']}/resume", data={"resume_text": "Senior developer"})

    after = client.get(f"/api/candidates/{candidate['id']}").json()
    assert after["resume_text"] == "Senior developer"
    assert after["stage"] == "Interview"
    assert after["created_at"] == before["created_at"]
    assert [row["body"] for row in client.get(notes_url(candidate["id"])).json()] == [
        "Strong systems thinking"
    ]


def test_replace_is_refused_for_an_archived_candidate(client, session, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()
    client.post(f"/api/candidates/{candidate['id']}/archive")

    response = client.put(f"/api/candidates/{candidate['id']}/resume", data={"resume_text": "New text"})

    assert response.status_code == 409
    assert response.json()["detail"] == "Restore this candidate before replacing their resume"
    assert client.get(f"/api/candidates/{candidate['id']}").json()["resume_text"] == "Python developer, 2 years"


def test_replace_on_an_unknown_candidate_returns_404(client):
    response = client.put("/api/candidates/999/resume", data={"resume_text": "Text"})

    assert response.status_code == 404


def test_resume_cannot_be_deleted(client, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    response = client.delete(f"/api/candidates/{candidate['id']}/resume")

    assert response.status_code == 405
