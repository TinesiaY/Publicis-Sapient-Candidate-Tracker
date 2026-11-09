"""A scripted provider for tests. It makes no network calls and needs no key."""

from collections.abc import Callable

from app.ai.provider import SUMMARY_MODEL


class FakeProvider:
    """Returns the scripted replies in order. An Exception in the script is raised instead.

    `on_call` runs during each call, before the reply is returned. Tests use it to change the
    resume while a job is running.
    """

    def __init__(
        self,
        replies: list[str | Exception],
        *,
        model_name: str = SUMMARY_MODEL,
        on_call: Callable[[], None] | None = None,
    ) -> None:
        self.model_name = model_name
        self._replies = list(replies)
        self._on_call = on_call
        self.calls: list[tuple[str, str]] = []

    def generate(self, system: str, prompt: str) -> str:
        self.calls.append((system, prompt))
        if self._on_call is not None:
            self._on_call()
        if not self._replies:
            raise AssertionError("FakeProvider has no scripted reply left")
        reply = self._replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply
