"""The shape of a summary result. The prompt and the validator both read these limits."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StringConstraints

MAX_SUMMARY = 400
MAX_SKILLS = 10
MAX_SKILL = 40
MAX_HIGHLIGHTS = 5
MAX_SNIPPET = 200

Summary = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_SUMMARY)]
Skill = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_SKILL)]
Snippet = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_SNIPPET)]


class Highlight(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Snippet
    quote: Snippet


class SummaryResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: Summary
    skills: list[Skill] = Field(max_length=MAX_SKILLS)
    highlights: list[Highlight] = Field(max_length=MAX_HIGHLIGHTS)
    # StrictBool: the string "true" is not accepted, so a malformed reply cannot pass by accident.
    suspicious_input: StrictBool
