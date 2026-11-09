"""Request and response models for the candidate API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


class CandidateCreate(BaseModel):
    """Fields accepted by POST /candidates (sent as a form)."""

    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    role_id: int
    phone: str | None = Field(default=None, max_length=50)
    source: str | None = Field(default=None, max_length=100)
    resume_text: str

    @field_validator("name", "resume_text")
    @classmethod
    def must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("phone", "source")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        return _blank_to_none(value)


class CandidateSummary(BaseModel):
    """One row in GET /candidates."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None
    role_id: int
    source: str | None
    stage: str
    created_at: datetime
    archived_at: datetime | None


class CandidateDetail(CandidateSummary):
    """GET /candidates/{id} and the POST response. Adds the resume text."""

    resume_text: str
