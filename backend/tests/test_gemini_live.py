"""Calls the real Gemini API with one seed resume. Skipped unless GEMINI_API_KEY is set.

Run it with: uv run pytest -m live
It uses the free daily quota, so run it sparingly.
"""

import os

import pytest

from app.ai.gemini_provider import GeminiProvider
from app.ai.prompts import build_prompt
from app.ai.provider import SUMMARY_MODEL
from app.ai.validate import validate_output
from app.seed import CANDIDATES

pytestmark = pytest.mark.live


@pytest.mark.skipif(not os.environ.get("GEMINI_API_KEY"), reason="GEMINI_API_KEY is not set")
def test_a_real_summary_of_a_seed_resume_is_valid():
    resume = next(candidate["resume_text"] for candidate in CANDIDATES if candidate["name"] == "Ann Tan")
    provider = GeminiProvider(os.environ["GEMINI_API_KEY"], SUMMARY_MODEL)
    system, prompt = build_prompt(resume)

    reply = provider.generate(system, prompt)
    result, _ = validate_output(reply, resume)

    assert result.summary
