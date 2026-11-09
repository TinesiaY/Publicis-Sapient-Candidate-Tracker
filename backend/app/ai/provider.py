"""The provider interface. The service depends on this, not on Gemini or the fake provider."""

from typing import Protocol

# The model every summary request is made with. It is part of a result's identity: a result made
# by another model is never reused.
SUMMARY_MODEL = "gemini-3.8-flash"


class ProviderError(Exception):
    """A provider call failed. `code` is a job error code, such as rate_limited."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class SummaryProvider(Protocol):
    model_name: str

    def generate(self, system: str, prompt: str) -> str:
        """Send the prompts and return the raw text of the reply."""
        ...
