"""The Gemini key is read when the summary provider is chosen. An empty key counts as no key."""

from app.ai.gemini_provider import GeminiProvider, NotConfiguredProvider
from app.config import gemini_key, summary_provider


def test_no_key_gives_a_provider_that_reports_not_configured(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    assert gemini_key() is None
    assert isinstance(summary_provider(), NotConfiguredProvider)


def test_an_empty_key_counts_as_no_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")

    assert gemini_key() is None
    assert isinstance(summary_provider(), NotConfiguredProvider)


def test_a_key_gives_the_gemini_provider(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    assert gemini_key() == "test-key"
    assert isinstance(summary_provider(), GeminiProvider)
