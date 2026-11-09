"""A summary request is matched on resume hash, prompt version and model. A result from another model or prompt is not reused."""

import pytest
from sqlalchemy import select

from app.models import Candidate, SummaryJob
from app.summaries import request_summary


def make_candidate(session, role_ids, resume_text):
    candidate = Candidate(
        name="Ann Tan",
        email="ann@example.com",
        role_id=role_ids["backend"],
        resume_text=resume_text,
    )
    session.add(candidate)
    session.flush()
    request_summary(session, candidate)
    session.commit()
    return candidate


@pytest.mark.parametrize(
    ("setting", "new_value"),
    [("SUMMARY_MODEL", "other-model"), ("PROMPT_VERSION", "v2")],
)
def test_a_ready_result_made_with_another_model_or_prompt_is_not_reused(
    session, role_ids, monkeypatch, setting, new_value
):
    candidate = make_candidate(session, role_ids, "Python developer, 2 years")
    original = session.scalars(select(SummaryJob).where(SummaryJob.candidate_id == candidate.id)).one()
    original.status = "ready"
    original.result_json = "{}"
    session.commit()

    # Run the same resume again, but now under another model or prompt version.
    monkeypatch.setattr(f"app.summaries.{setting}", new_value)
    candidate.resume_text = "Senior developer"
    request_summary(session, candidate)
    candidate.resume_text = "Python developer, 2 years"
    request_summary(session, candidate)
    session.commit()

    newest = session.scalars(
        select(SummaryJob).where(SummaryJob.candidate_id == candidate.id).order_by(SummaryJob.id.desc())
    ).first()
    assert newest.id != original.id
    assert newest.status == "pending"
    assert original.status == "ready"
