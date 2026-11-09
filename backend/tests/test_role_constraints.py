"""Database rules for jobs: names and descriptions must not be blank, and names are unique ignoring case."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Role


@pytest.mark.parametrize("name", ["", "   ", "\n\t"])
def test_blank_job_name_is_rejected_by_the_database(session, name):
    session.add(Role(name=name, jd_text="Analyse data."))
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize("jd_text", ["", "   ", "\n\t"])
def test_blank_job_description_is_rejected_by_the_database(session, jd_text):
    session.add(Role(name="Data Analyst", jd_text=jd_text))
    with pytest.raises(IntegrityError):
        session.commit()


def test_job_names_are_unique_ignoring_case_in_the_database(session):
    session.add(Role(name="Back", jd_text="Build APIs."))
    session.commit()

    session.add(Role(name="back", jd_text="Build APIs too."))
    with pytest.raises(IntegrityError):
        session.commit()


def test_candidate_count_is_zero_for_a_new_job(session):
    role = Role(name="Data Analyst", jd_text="Analyse data.")
    session.add(role)
    session.commit()

    assert role.candidate_count == 0
