"""The summary worker. It runs submitted jobs, each in its own database session.

The executor decides how many jobs run at once. The app uses one thread, so Gemini calls never run in parallel.
"""

import logging
from concurrent.futures import Executor

from sqlalchemy.orm import sessionmaker

from app.ai.jobs import finish_job
from app.ai.provider import SummaryProvider
from app.ai.service import run_summary_job
from app.models import SummaryJob, utc_now

logger = logging.getLogger(__name__)


class SummaryWorker:
    def __init__(self, session_factory: sessionmaker, provider: SummaryProvider, executor: Executor) -> None:
        self._session_factory = session_factory
        self._provider = provider
        self._executor = executor

    def submit(self, job_id: int) -> None:
        """Queue a job to run. Call this only after the commit that created the job."""
        self._executor.submit(self._run, job_id)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True)

    def _run(self, job_id: int) -> None:
        with self._session_factory() as session:
            try:
                run_summary_job(session, job_id, self._provider)
            except Exception:
                # Something unexpected went wrong. Log it, and fail the job so it does not stay pending.
                logger.exception("Summary job %s failed unexpectedly", job_id)
                session.rollback()
                job = session.get(SummaryJob, job_id)
                if job is not None:
                    finish_job(session, job, "failed", error_code="provider_error", completed_at=utc_now())
