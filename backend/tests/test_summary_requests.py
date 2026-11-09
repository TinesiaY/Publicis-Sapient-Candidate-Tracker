"""Summary requests: saving or replacing a resume records a summary request for the current text."""

from sqlalchemy import select

from app.models import SummaryJob
from app.resume import resume_hash


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


def jobs_for(session, candidate_id):
    return list(
        session.scalars(
            select(SummaryJob).where(SummaryJob.candidate_id == candidate_id).order_by(SummaryJob.id)
        )
    )


def test_saving_a_candidate_records_one_pending_summary_request(client, session, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    jobs = jobs_for(session, candidate["id"])

    assert len(jobs) == 1
    assert jobs[0].status == "pending"
    assert jobs[0].input_hash == resume_hash("Python developer, 2 years")
    assert jobs[0].prompt_version == "v1"


def test_replacing_the_resume_supersedes_the_old_request_and_adds_a_new_one(client, session, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    client.put(f"/api/candidates/{candidate['id']}/resume", data={"resume_text": "Senior developer"})

    jobs = jobs_for(session, candidate["id"])
    assert [job.status for job in jobs] == ["superseded", "pending"]
    assert jobs[1].input_hash == resume_hash("Senior developer")


def test_replacing_with_the_same_text_adds_no_request(client, session, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()

    client.put(f"/api/candidates/{candidate['id']}/resume", data={"resume_text": "Python developer, 2 years"})

    assert len(jobs_for(session, candidate["id"])) == 1


def test_a_refused_replace_records_nothing(client, session, role_ids):
    candidate = client.post("/api/candidates", data=form(role_ids["backend"])).json()
    client.post(f"/api/candidates/{candidate['id']}/archive")

    client.put(f"/api/candidates/{candidate['id']}/resume", data={"resume_text": "Senior developer"})

    jobs = jobs_for(session, candidate["id"])
    assert len(jobs) == 1
    assert jobs[0].status == "pending"


def test_a_candidate_with_a_pasted_and_an_uploaded_resume_share_the_same_request_text(client, session, role_ids):
    pasted = client.post("/api/candidates", data=form(role_ids["backend"], email="pasted@example.com")).json()
    uploaded = client.post(
        "/api/candidates",
        data=form(role_ids["frontend"], email="uploaded@example.com", resume_text=""),
        files={"resume_file": ("resume.txt", b"Python developer, 2 years", "text/plain")},
    ).json()

    assert jobs_for(session, pasted["id"])[0].input_hash == jobs_for(session, uploaded["id"])[0].input_hash
