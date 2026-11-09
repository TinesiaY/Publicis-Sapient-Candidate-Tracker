"""Writes the sample summaries to a Markdown file, straight from the database.

The seed script writes it with --report. The file records the outputs for the write-up.
"""

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.ai.provider import SUMMARY_MODEL
from app.ai.schema import SummaryResult
from app.db import make_session_factory
from app.models import Candidate, SummaryJob
from app.summaries import current_job

# Plain text for each failure code. The same wording is used on the candidate page.
FAILURE_TEXT = {
    "rate_limited": "The AI service is busy. Wait a few minutes, then try again.",
    "provider_timeout": "The AI service took too long to answer.",
    "provider_error": "The AI service returned an error.",
    "invalid_output": "The AI reply did not match the expected format.",
    "timeout": "The summary took longer than three minutes.",
    "interrupted": "The server stopped before the summary finished.",
    "not_configured": "AI summaries are off. Add GEMINI_API_KEY to backend/.env, then restart the backend.",
}


def write_report(engine: Engine, path: Path) -> None:
    """Write one section per candidate, using the summary for each candidate's current resume."""
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Sample summaries",
        "",
        f"Generated {generated} UTC with `{SUMMARY_MODEL}`.",
        "",
        "AI-generated. Verify before relying on it.",
        "",
    ]
    with make_session_factory(engine)() as session:
        for candidate in session.scalars(select(Candidate).order_by(Candidate.id)).all():
            lines.extend(_candidate_section(session, candidate))

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _candidate_section(session: Session, candidate: Candidate) -> list[str]:
    lines = [
        f"## {candidate.name}",
        "",
        f"- Role: {candidate.role_name}",
        f"- Stage: {candidate.stage}",
        f"- Archived: {'yes' if candidate.archived_at else 'no'}",
        "",
    ]
    job = current_job(session, candidate)
    if job is None:
        return lines + ["No summary has been requested for this resume.", ""]

    if job.status == "ready":
        result = SummaryResult.model_validate_json(job.result_json)
        lines += ["Status: ready", "", result.summary, ""]
        lines.append(f"Skills: {', '.join(result.skills) if result.skills else 'none listed'}")
        lines.append("")
        if result.highlights:
            lines.append("Highlights:")
            lines += [f'- {highlight.text} (quote: "{highlight.quote}")' for highlight in result.highlights]
        else:
            lines.append("Highlights: none listed")
        lines += ["", f"Suspicious input: {'yes' if result.suspicious_input else 'no'}", ""]
        return lines

    if job.status == "failed":
        explanation = FAILURE_TEXT.get(job.error_code or "", "The summary failed.")
        return lines + [f"Status: failed ({job.error_code}). {explanation}", ""]

    return lines + [f"Status: {job.status}", ""]
