"""Model constraint tests: each test checks a rule the database itself must enforce."""

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.models import Candidate, Note, Role


@pytest.fixture
def role_ids(session):
    backend = Role(name="Backend Engineer", jd_text="Build APIs")
    frontend = Role(name="Frontend Engineer", jd_text="Build UIs")
    session.add_all([backend, frontend])
    session.commit()
    return {"backend": backend.id, "frontend": frontend.id}


def make_candidate(
    role_id,
    email="ann@example.com",
    stage="Applied",
    resume_text="Python developer, 2 years",
):
    return Candidate(
        name="Ann Tan",
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


def test_invalid_stage_is_rejected(session, role_ids):
    session.add(make_candidate(role_ids["backend"], stage="Hired"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_empty_resume_is_rejected(session, role_ids):
    session.add(make_candidate(role_ids["backend"], resume_text="   "))
    with pytest.raises(IntegrityError):
        session.commit()


def test_email_must_be_lowercase(session, role_ids):
    session.add(make_candidate(role_ids["backend"], email="Ann@Example.com"))
    with pytest.raises(IntegrityError):
        session.commit()
