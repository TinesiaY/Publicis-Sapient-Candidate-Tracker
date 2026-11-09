"""Settings read at startup: the Gemini key, from backend/.env or the environment. The API and the seed script both use this."""

import os
from pathlib import Path

from dotenv import load_dotenv

from app.ai.gemini_provider import make_provider
from app.ai.provider import SUMMARY_MODEL, SummaryProvider

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

# Read backend/.env once, when this module is first imported. A variable already set in the environment takes precedence.
load_dotenv(ENV_FILE)


def gemini_key() -> str | None:
    """The key from the environment, read each time it is asked for. An empty value counts as not set."""
    return os.environ.get("GEMINI_API_KEY") or None


def summary_provider() -> SummaryProvider:
    """The provider for summaries: Gemini when a key is set, otherwise a provider that reports not_configured."""
    return make_provider(gemini_key(), SUMMARY_MODEL)
