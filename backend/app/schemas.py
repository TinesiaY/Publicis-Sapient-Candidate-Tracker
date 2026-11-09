"""Request and response models for the candidate API.

These are separate from the ORM models in app/models.py. The database shape
and the API shape are allowed to differ.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.text_rules import BLANK_CHARACTERS, has_nul, is_blank


def _reject_nul(value: str) -> str:
    if has_nul(value):
        raise ValueError("must not contain null characters")
    return value


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
        _reject_nul(value)
        if is_blank(value):
            raise ValueError("must not be blank")
        return value.strip(BLANK_CHARACTERS)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return value.strip(BLANK_CHARACTERS).lower()

    @field_validator("phone", "source")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        _reject_nul(value)
        return value.strip(BLANK_CHARACTERS) or None


class RoleCreate(BaseModel):
    """Fields accepted by POST /roles (sent as JSON)."""

    name: str = Field(min_length=1, max_length=200)
    jd_text: str

    @field_validator("name", "jd_text")
    @classmethod
    def must_not_be_blank(cls, value: str) -> str:
        _reject_nul(value)
        if is_blank(value):
            raise ValueError("must not be blank")
        return value.strip(BLANK_CHARACTERS)


class RoleSummary(BaseModel):
    """One row in GET /roles."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    candidate_count: int


class RoleDetail(RoleSummary):
    """GET /roles/{id} and the POST response. Adds the job description."""

    jd_text: str


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
    role_name: str
    created_at: datetime
    archived_at: datetime | None


class CandidateDetail(CandidateSummary):
    """GET /candidates/{id} and the POST response. Adds the resume text."""

    resume_text: str


class CandidateCounts(BaseModel):
    """GET /candidates/counts. Every stage appears, even when its count is 0."""

    total: int
    by_stage: dict[str, int]
