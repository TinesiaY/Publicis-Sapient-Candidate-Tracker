"""Model constraint tests: each test checks a rule the database itself must enforce."""

from datetime import timezone

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.models import Candidate, Note, Role


def make_candidate(
    role_id,
    name="Ann Tan",
    email="ann@example.com",
    stage="Applied",
    resume_text="Python developer, 2 years",
):
    return Candidate(
        name=name,
        email=email,
        role_id=role_id,
        stage=stage,
        resume_text=resume_text,
    )


def add_note(session, role_ids):
    candidate = make_candidate(role_ids["backend"])
    session.add(candidate)
    session.commit()
    session.add(Note(candidate_id=candidate.id, body="Called, positive"))
    session.commit()


def test_foreign_keys_pragma_is_on(session):
    assert session.scalar(text("PRAGMA foreign_keys")) == 1


def test_bad_role_id_is_rejected(session, role_ids):
    session.add(make_candidate(role_id=999))
    with pytest.raises(IntegrityError):
        session.commit()


def test_same_email_and_role_is_rejected(session, role_ids):
    session.add(make_candidate(role_ids["backend"]))
    session.commit()

    session.add(make_candidate(role_ids["backend"]))
    with pytest.raises(IntegrityError):
        session.commit()


def test_same_email_with_another_role_is_allowed(session, role_ids):
    session.add(make_candidate(role_ids["backend"]))
    session.add(make_candidate(role_ids["frontend"]))
    session.commit()

    assert session.scalar(select(func.count()).select_from(Candidate)) == 2


def test_note_update_is_blocked(session, role_ids):
    add_note(session, role_ids)
    with pytest.raises(DBAPIError):
        session.execute(text("UPDATE notes SET body = 'changed'"))


def test_note_delete_is_blocked(session, role_ids):
    add_note(session, role_ids)
    with pytest.raises(DBAPIError):
        session.execute(text("DELETE FROM notes"))


@pytest.mark.parametrize("body", ["", "   ", "\n\t", "\r\n"])
def test_blank_note_body_is_rejected(session, role_ids, body):
    candidate = make_candidate(role_ids["backend"])
    session.add(candidate)
    session.commit()

    session.add(Note(candidate_id=candidate.id, body=body))
    with pytest.raises(IntegrityError):
        session.commit()


def test_invalid_stage_is_rejected(session, role_ids):
    session.add(make_candidate(role_ids["backend"], stage="Hired"))
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize("resume_text", ["", "   ", "\n\t", "\r\n  "])
def test_blank_resume_is_rejected(session, role_ids, resume_text):
    session.add(make_candidate(role_ids["backend"], resume_text=resume_text))
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize("name", ["   ", "\n\t"])
def test_blank_name_is_rejected(session, role_ids, name):
    session.add(make_candidate(role_ids["backend"], name=name))
    with pytest.raises(IntegrityError):
        session.commit()


def test_email_must_be_lowercase(session, role_ids):
    session.add(make_candidate(role_ids["backend"], email="Ann@Example.com"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_timestamps_come_back_as_utc(session, role_ids):
    candidate = make_candidate(role_ids["backend"])
    session.add(candidate)
    session.commit()
    session.expire_all()

    reloaded = session.get(Candidate, candidate.id)

    assert reloaded.created_at.tzinfo == timezone.utc
