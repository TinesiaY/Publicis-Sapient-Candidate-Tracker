"""Helpers shared by the summary tests: form data, fake replies and small API calls."""

import json

from sqlalchemy import select

from app.models import SummaryJob

ANN = "Python developer, 2 years, BSc CS"
SENIOR = "Senior developer, 8 years"


def valid_reply(summary: str = "Python developer with 2 years of experience.") -> str:
    return json.dumps({"summary": summary, "skills": ["Python"], "highlights": [], "suspicious_input": False})


def form(role_id: int, resume: str = ANN, email: str = "ann@example.com") -> dict[str, str]:
    return {
        "name": "Ann Tan",
        "email": email,
        "role_id": str(role_id),
        "phone": "",
        "source": "Referral",
        "resume_text": resume,
    }


def create(client, role_id: int, resume: str = ANN, email: str = "ann@example.com") -> int:
    response = client.post("/candidates", data=form(role_id, resume, email))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def replace(client, candidate_id: int, resume: str) -> None:
    response = client.put(f"/candidates/{candidate_id}/resume", data={"resume_text": resume})
    assert response.status_code == 200, response.text


def summary(client, candidate_id: int):
    return client.get(f"/candidates/{candidate_id}/summary")


def retry(client, candidate_id: int):
    return client.post(f"/candidates/{candidate_id}/summary/retry")


def regenerate(client, candidate_id: int):
    return client.post(f"/candidates/{candidate_id}/summary/regenerate")


def job_rows(client, candidate_id: int) -> list[dict]:
    """The candidate's jobs, oldest first, read straight from the database."""
    with client.app.state.session_factory() as session:
        jobs = session.scalars(
            select(SummaryJob).where(SummaryJob.candidate_id == candidate_id).order_by(SummaryJob.id)
        ).all()
        return [
            {"id": job.id, "status": job.status, "input_hash": job.input_hash, "error_code": job.error_code}
            for job in jobs
        ]
