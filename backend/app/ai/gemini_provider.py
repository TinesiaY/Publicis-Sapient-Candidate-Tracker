"""The Gemini provider. This is the only module that talks to the Gemini API, through the google-genai SDK."""

import logging

from google import genai
from google.genai import errors, types

from app.ai.provider import ProviderError, SummaryProvider

logger = logging.getLogger(__name__)

# HttpOptions.timeout is in milliseconds.
REQUEST_TIMEOUT_MS = 60_000


def _is_timeout(error: Exception) -> bool:
    """True for an HTTP timeout from httpx, or from httpx2 (the fork the SDK uses by default).

    The SDK passes transport errors through unchanged. Match the class name in the MRO, so this
    module does not need to import either library.
    """
    return any(cls.__name__ == "TimeoutException" for cls in type(error).__mro__)


class GeminiProvider:
    def __init__(self, api_key: str, model_name: str) -> None:
        self.model_name = model_name
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=REQUEST_TIMEOUT_MS,
                # One attempt, stated explicitly. The job decides what happens after a failure.
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    def generate(self, system: str, prompt: str) -> str:
        try:
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                ),
            )
        except errors.APIError as error:
            # Log what Google said, so the server terminal shows the cause and not just the error code.
            logger.warning("Gemini call failed: code=%s status=%s message=%s", error.code, error.status, error.message)
            if error.code == 429:
                raise ProviderError("rate_limited") from error
            # 504 means Google stopped waiting for the model, which is a timeout.
            if error.code == 504:
                raise ProviderError("provider_timeout") from error
            raise ProviderError("provider_error") from error
        except Exception as error:
            if _is_timeout(error):
                logger.warning("Gemini call timed out after %s ms", REQUEST_TIMEOUT_MS)
                raise ProviderError("provider_timeout") from error
            logger.exception("Gemini call failed unexpectedly")
            raise ProviderError("provider_error") from error
        # A blocked reply has no text. An empty string fails validation as invalid_output.
        return response.text or ""


class NotConfiguredProvider:
    """Used when GEMINI_API_KEY is not set. Jobs fail with not_configured, and the rest of the app works."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    def generate(self, system: str, prompt: str) -> str:
        raise ProviderError("not_configured")


def make_provider(api_key: str | None, model_name: str) -> SummaryProvider:
    if not api_key:
        return NotConfiguredProvider(model_name)
    return GeminiProvider(api_key, model_name)
