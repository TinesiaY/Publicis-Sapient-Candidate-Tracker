"""The FastAPI application.

create_app builds the app from its parts. Tests pass their own database, provider and executor, so
they never touch backend/data/app.db.
"""

import logging
from collections.abc import AsyncIterator
from concurrent.futures import Executor, ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app.ai.gemini_provider import NotConfiguredProvider
from app.ai.jobs import sweep_interrupted
from app.ai.provider import SummaryProvider
from app.config import summary_provider
from app.deps import SessionLocal
from app.models import utc_now
from app.routers import candidates, notes, roles, summaries
from app.worker import SummaryWorker

logger = logging.getLogger(__name__)


def create_app(
    session_factory: sessionmaker | None = None,
    provider: SummaryProvider | None = None,
    executor: Executor | None = None,
) -> FastAPI:
    """Build the app. By default it uses the real database, the Gemini provider if GEMINI_API_KEY is set, and one background thread."""
    factory = session_factory or SessionLocal
    if provider is None:
        provider = summary_provider()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Jobs still pending from an earlier run were lost when that run stopped.
        with factory() as session:
            swept = sweep_interrupted(session, utc_now())
        if swept:
            logger.warning("Marked %d summary job(s) left pending by an earlier run as interrupted", swept)
        if isinstance(provider, NotConfiguredProvider):
            logger.warning("GEMINI_API_KEY is not set. Summaries will fail with the error code not_configured.")

        worker_executor = executor or ThreadPoolExecutor(max_workers=1, thread_name_prefix="summary")
        app.state.worker = SummaryWorker(factory, provider, worker_executor)
        yield
        app.state.worker.shutdown()

    app = FastAPI(title="Candidate Tracker API", lifespan=lifespan)
    app.state.session_factory = factory
    # The UI uses this to decide whether a summary that failed without a key can be retried now.
    app.state.provider_configured = not isinstance(provider, NotConfiguredProvider)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(candidates.router)
    app.include_router(roles.router)
    app.include_router(notes.router)
    app.include_router(summaries.router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
