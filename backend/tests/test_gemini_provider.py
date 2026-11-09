"""The Gemini provider: SDK errors and timeouts map to job error codes. No network is used: the SDK call is replaced."""

from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors

from app.ai.gemini_provider import GeminiProvider, NotConfiguredProvider, make_provider
from app.ai.provider import SUMMARY_MODEL, ProviderError


def provider_whose_call_raises(error: Exception) -> GeminiProvider:
    provider = GeminiProvider("test-key", SUMMARY_MODEL)

    def raise_error(**kwargs):
        raise error

    provider._client.models.generate_content = raise_error
    return provider


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (errors.ClientError(429, {"error": {"code": 429, "message": "Quota exceeded", "status": "RESOURCE_EXHAUSTED"}}), "rate_limited"),
        (errors.ClientError(400, {"error": {"code": 400, "message": "Bad request", "status": "INVALID_ARGUMENT"}}), "provider_error"),
        (errors.ServerError(503, {"error": {"code": 503, "message": "Unavailable", "status": "UNAVAILABLE"}}), "provider_error"),
        (httpx.ReadTimeout("the reply took too long"), "provider_timeout"),
        (RuntimeError("something unexpected"), "provider_error"),
    ],
)
def test_errors_map_to_job_error_codes(error, code):
    with pytest.raises(ProviderError) as raised:
        provider_whose_call_raises(error).generate("system", "prompt")

    assert raised.value.code == code


def test_the_request_names_the_model_and_asks_for_json_with_the_system_prompt(monkeypatch):
    provider = GeminiProvider("test-key", SUMMARY_MODEL)
    seen = {}

    def fake_generate(**kwargs):
        seen.update(kwargs)
        return SimpleNamespace(text='{"summary": "ok"}')

    provider._client.models.generate_content = fake_generate

    assert provider.generate("SYSTEM RULES", "RESUME PROMPT") == '{"summary": "ok"}'
    assert seen["model"] == SUMMARY_MODEL
    assert seen["contents"] == "RESUME PROMPT"
    assert seen["config"].response_mime_type == "application/json"
    assert seen["config"].system_instruction == "SYSTEM RULES"


def test_a_blocked_reply_with_no_text_is_passed_on_as_empty(monkeypatch):
    provider = GeminiProvider("test-key", SUMMARY_MODEL)
    provider._client.models.generate_content = lambda **kwargs: SimpleNamespace(text=None)

    assert provider.generate("system", "prompt") == ""


def test_without_a_key_the_provider_is_not_configured():
    provider = make_provider(None, SUMMARY_MODEL)

    assert isinstance(provider, NotConfiguredProvider)
    with pytest.raises(ProviderError) as raised:
        provider.generate("system", "prompt")
    assert raised.value.code == "not_configured"


def test_with_a_key_the_provider_is_gemini():
    assert isinstance(make_provider("test-key", SUMMARY_MODEL), GeminiProvider)
