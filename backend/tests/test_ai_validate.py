"""Reply validation: parsing, the schema and its caps, and the grounding check on quotes."""

import json

import pytest

from app.ai.schema import MAX_HIGHLIGHTS, MAX_SKILLS
from app.ai.validate import InvalidOutput, validate_output

RESUME = "Ann Tan. Built REST   APIs with FastAPI.\nPython developer, 2 years, BSc CS."


def reply(**overrides) -> str:
    data = {
        "summary": "Python developer with 2 years of experience.",
        "skills": ["Python", "FastAPI"],
        "highlights": [],
        "suspicious_input": False,
    }
    data.update(overrides)
    return json.dumps(data)


def highlight(quote: str) -> dict:
    return {"text": f"Mentions {quote}", "quote": quote}


def test_plain_json_is_accepted():
    result, dropped = validate_output(reply(), RESUME)

    assert result.skills == ["Python", "FastAPI"]
    assert dropped == 0


def test_a_fenced_multi_line_reply_is_accepted():
    # The JSON spans several lines, so the fence pattern must match across newlines (re.DOTALL).
    fenced = "```json\n" + json.dumps(json.loads(reply()), indent=2) + "\n```"

    result, _ = validate_output(fenced, RESUME)

    assert result.summary.startswith("Python developer")


@pytest.mark.parametrize("raw", ["Here is the summary: a developer.", "[1, 2, 3]", '{"summary": "unfinished'])
def test_text_that_is_not_a_json_object_is_invalid(raw):
    with pytest.raises(InvalidOutput):
        validate_output(raw, RESUME)


def test_an_extra_field_is_invalid():
    with pytest.raises(InvalidOutput):
        validate_output(reply(score=9), RESUME)


@pytest.mark.parametrize(
    "overrides",
    [
        {"summary": "x" * 401},
        {"skills": ["y" * 41]},
        {"suspicious_input": "true"},
        {"skills": "Python"},
    ],
)
def test_values_over_their_limits_or_of_the_wrong_type_are_invalid(overrides):
    with pytest.raises(InvalidOutput):
        validate_output(reply(**overrides), RESUME)


def test_skills_over_the_cap_are_cut_not_rejected():
    result, _ = validate_output(reply(skills=[f"Skill {i}" for i in range(MAX_SKILLS + 2)]), RESUME)

    assert len(result.skills) == MAX_SKILLS


def test_highlights_over_the_cap_are_cut():
    resume = " ".join(f"item {i}." for i in range(MAX_HIGHLIGHTS + 2))
    highlights = [highlight(f"item {i}.") for i in range(MAX_HIGHLIGHTS + 2)]

    result, dropped = validate_output(reply(highlights=highlights), resume)

    assert len(result.highlights) == MAX_HIGHLIGHTS
    assert dropped == 0


def test_a_quote_matches_ignoring_case_and_extra_spacing():
    result, dropped = validate_output(reply(highlights=[highlight("built rest apis with fastapi")]), RESUME)

    assert len(result.highlights) == 1
    assert dropped == 0


def test_a_fabricated_quote_is_dropped_and_a_valid_one_is_kept():
    highlights = [highlight("Led a team of ten"), highlight("Python developer, 2 years")]

    result, dropped = validate_output(reply(highlights=highlights), RESUME)

    assert [item.quote for item in result.highlights] == ["Python developer, 2 years"]
    assert dropped == 1


def test_an_empty_result_is_valid():
    result, dropped = validate_output(
        reply(summary="The resume states no relevant skills or experience.", skills=[], highlights=[]),
        RESUME,
    )

    assert result.skills == []
    assert result.highlights == []
    assert dropped == 0
