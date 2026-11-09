"""Checks the provider's reply: parse the JSON, check the schema and caps, then check each quote is in the resume.

Plan section 5, validation steps 1 to 4. An empty result is valid.
"""

import json
import logging
import re

from pydantic import ValidationError

from app.ai.schema import MAX_HIGHLIGHTS, MAX_SKILLS, SummaryResult
from app.resume import normalise_resume

logger = logging.getLogger(__name__)


class InvalidOutput(Exception):
    """The reply cannot be used. The job fails with the error code invalid_output."""


# A reply may be wrapped in a Markdown code fence. The JSON spans several lines, so the pattern
# must match across newlines: re.DOTALL lets "." match a newline.
FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def parse_json(raw: str) -> dict:
    """Step 1: remove a code fence, then parse the JSON object."""
    text = raw.strip()
    fenced = FENCE.fullmatch(text)
    if fenced:
        text = fenced.group(1)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise InvalidOutput("reply is not valid JSON") from error
    if not isinstance(data, dict):
        raise InvalidOutput("reply is not a JSON object")
    return data


def cut_lists(data: dict) -> dict:
    """Step 2a: lists over their cap are cut down, not rejected. Other values are left for the schema."""
    if isinstance(data.get("skills"), list):
        data["skills"] = data["skills"][:MAX_SKILLS]
    if isinstance(data.get("highlights"), list):
        data["highlights"] = data["highlights"][:MAX_HIGHLIGHTS]
    return data


def check_schema(data: dict) -> SummaryResult:
    """Step 2b: unknown fields, wrong types and over-long strings are all rejected."""
    try:
        return SummaryResult.model_validate(data)
    except ValidationError as error:
        raise InvalidOutput("reply does not match the schema") from error


def _comparable(text: str) -> str:
    """Quote matching ignores case and extra whitespace."""
    return normalise_resume(text).casefold()


def keep_grounded(result: SummaryResult, resume_text: str) -> tuple[SummaryResult, int]:
    """Step 3: keep only highlights whose quote appears in the resume. Returns the result and the number dropped.

    This checks that the quote exists in the resume. It does not check that the claim is true.
    """
    resume = _comparable(resume_text)
    kept = [highlight for highlight in result.highlights if _comparable(highlight.quote) in resume]
    dropped = len(result.highlights) - len(kept)
    return result.model_copy(update={"highlights": kept}), dropped


def validate_output(raw: str, resume_text: str) -> tuple[SummaryResult, int]:
    """Run all the checks. Raises InvalidOutput, or returns the grounded result and the number of highlights dropped."""
    result = check_schema(cut_lists(parse_json(raw)))
    grounded, dropped = keep_grounded(result, resume_text)
    if dropped:
        logger.info("Dropped %d highlight(s) whose quote is not in the resume", dropped)
    return grounded, dropped
