"""ORM models and database constraints for the candidate tracker."""

from datetime import datetime, timezone

from sqlalchemy import DDL, CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime
from app.text_rules import not_blank_sql

STAGES = ("Applied", "Screening", "Interview", "Offer", "Rejected")
JOB_STATUSES = ("pending", "ready", "failed", "superseded")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    jd_text: Mapped[str] = mapped_column(Text)

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="role")


class Candidate(Base):
    __tablename__ = "candidates"
    __table_args__ = (
        # An applicant can apply for many roles, so the unique key is (email, role_id).
        UniqueConstraint("email", "role_id", name="uq_candidates_email_role"),
        CheckConstraint("email = lower(email)", name="ck_candidates_email_lower"),
        CheckConstraint(_in_list("stage", STAGES), name="ck_candidates_stage"),
        CheckConstraint(not_blank_sql("name"), name="ck_candidates_name_not_blank"),
        CheckConstraint(not_blank_sql("resume_text"), name="ck_candidates_resume_not_blank"),
        Index("ix_candidates_role_stage", "role_id", "stage"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(50))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    source: Mapped[str | None] = mapped_column(String(100))
    stage: Mapped[str] = mapped_column(String(20), default="Applied")
    resume_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    archived_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    role: Mapped[Role] = relationship(back_populates="candidates")
    notes: Mapped[list["Note"]] = relationship(back_populates="candidate", order_by="Note.created_at")
    summary_jobs: Mapped[list["SummaryJob"]] = relationship(back_populates="candidate")

    @property
    def role_name(self) -> str:
        """The role's name, so API responses can show it without a separate lookup."""
        return self.role.name


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint(not_blank_sql("body"), name="ck_notes_body_not_blank"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)

    candidate: Mapped[Candidate] = relationship(back_populates="notes")


# Notes are append-only, enforced by the database and not only by the API.
# SQLite runs one statement per call, so each trigger gets its own DDL.
event.listen(
    Note.__table__,
    "after_create",
    DDL(
        "CREATE TRIGGER notes_block_update BEFORE UPDATE ON notes "
        "BEGIN SELECT RAISE(ABORT, 'notes are append-only'); END"
    ),
)
event.listen(
    Note.__table__,
    "after_create",
    DDL(
        "CREATE TRIGGER notes_block_delete BEFORE DELETE ON notes "
        "BEGIN SELECT RAISE(ABORT, 'notes are append-only'); END"
    ),
)


class SummaryJob(Base):
    """One summary generation attempt for one resume."""

    __tablename__ = "summary_jobs"
    __table_args__ = (
        CheckConstraint(_in_list("status", JOB_STATUSES), name="ck_summary_jobs_status"),
        Index("ix_summary_jobs_candidate_hash_created", "candidate_id", "input_hash", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    input_hash: Mapped[str] = mapped_column(String(64))
    prompt_version: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(100))
    result_json: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    candidate: Mapped[Candidate] = relationship(back_populates="summary_jobs")
