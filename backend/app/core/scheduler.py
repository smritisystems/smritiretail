"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""
SMRITI Report Scheduler Daemon
================================
Pure asyncio background task that polls the database every 60 seconds for
ReportSchedule entries whose next_run_at has elapsed, and dispatches them via
ReportDistributionEngine.execute_schedule().

Design decisions:
  - Zero new Python dependencies (no APScheduler, Celery, or Redis required).
  - Controlled by the REPORT_SCHEDULER_ENABLED feature flag in settings.
  - Graceful cancellation via asyncio.CancelledError on FastAPI shutdown.
  - Per-schedule exception isolation: one failing schedule never crashes the loop.
  - Uses a dedicated async DB session per tick to prevent long-lived connection
    contention with the request plane.
"""

import asyncio
from datetime import datetime, timezone

from app.core.logging import logger


class ReportSchedulerDaemon:
    """
    Background daemon that executes due report schedules.

    Lifecycle:
        daemon = ReportSchedulerDaemon(poll_interval_seconds=60)
        task = asyncio.create_task(daemon.run())
        ...
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    """

    def __init__(self, poll_interval_seconds: int = 60) -> None:
        self.poll_interval = poll_interval_seconds
        self._running = False

    async def run(self) -> None:
        """Main scheduler loop. Runs until cancelled."""
        self._running = True
        logger.info(
            f"[SMRITI Scheduler] Report Scheduler Daemon started "
            f"(poll_interval={self.poll_interval}s)."
        )
        try:
            while self._running:
                await asyncio.sleep(self.poll_interval)
                await self._tick()
        except asyncio.CancelledError:
            logger.info("[SMRITI Scheduler] Report Scheduler Daemon received shutdown signal. Stopping.")
            self._running = False
        except Exception as exc:
            logger.error(f"[SMRITI Scheduler] Daemon loop crashed unexpectedly: {exc}", exc_info=True)
            self._running = False

    async def _tick(self) -> None:
        """
        Single scheduler tick: open a scoped DB session, query for due schedules,
        and dispatch each one. Exceptions from individual schedules are isolated.

        Uses the control-plane async_session factory (smritisys). For multi-tenant
        deployments, the ReportSchedule row carries the company_id, and the engine
        selects the correct tenant DB internally during execute_schedule().
        """
        try:
            from app.db.session import async_session
            from app.models.report_schedule import ReportSchedule
            from sqlalchemy import select

            async with async_session() as db:
                now_utc = datetime.now(timezone.utc)

                result = await db.execute(
                    select(ReportSchedule).where(
                        ReportSchedule.is_active == True,          # noqa: E712
                        ReportSchedule.next_run_at <= now_utc,
                    )
                )
                due_schedules = result.scalars().all()

                if not due_schedules:
                    return

                logger.info(
                    f"[SMRITI Scheduler] Tick at {now_utc.isoformat()}: "
                    f"{len(due_schedules)} due schedule(s) found."
                )

            # Dispatch each schedule with its own session to avoid long-held transactions.
            for schedule in due_schedules:
                async with async_session() as dispatch_db:
                    await self._dispatch_schedule(dispatch_db, schedule.id)

        except Exception as tick_exc:
            logger.error(
                f"[SMRITI Scheduler] Tick failed: {tick_exc}", exc_info=True
            )

    async def _dispatch_schedule(self, db, schedule_id: str) -> None:
        """
        Dispatch a single schedule. Wrapped in try/except so one bad schedule
        cannot abort the rest of the tick.
        """
        try:
            from app.services.reporting_distribution_svc import ReportDistributionEngine

            # Tenant context is not required for scheduled dispatch — the schedule
            # carries its own company_id / branch_id in the payload metadata.
            engine = ReportDistributionEngine(db=db, tenant_ctx=None)
            result = await engine.execute_schedule(schedule_id=schedule_id, force=False)
            logger.info(
                f"[SMRITI Scheduler] Schedule '{schedule_id}' dispatched: "
                f"status={result.status}, channels={result.channels_attempted}."
            )
        except Exception as dispatch_exc:
            logger.error(
                f"[SMRITI Scheduler] Failed to dispatch schedule '{schedule_id}': "
                f"{dispatch_exc}",
                exc_info=True,
            )


# Module-level singleton — started during FastAPI lifespan, cancelled on shutdown.
_daemon: ReportSchedulerDaemon | None = None
_daemon_task: asyncio.Task | None = None


def start_scheduler(poll_interval_seconds: int = 60) -> None:
    """
    Create and launch the ReportSchedulerDaemon as a background asyncio Task.
    Safe to call only once. Must be called from within a running asyncio event loop
    (i.e., inside the FastAPI lifespan context).
    """
    global _daemon, _daemon_task
    if _daemon_task is not None and not _daemon_task.done():
        logger.warning("[SMRITI Scheduler] start_scheduler() called but daemon is already running.")
        return

    _daemon = ReportSchedulerDaemon(poll_interval_seconds=poll_interval_seconds)
    _daemon_task = asyncio.create_task(_daemon.run(), name="smriti_report_scheduler")
    logger.info("[SMRITI Scheduler] Background task created.")


async def stop_scheduler() -> None:
    """
    Cancel the scheduler daemon task and wait for it to finish.
    Called from FastAPI lifespan shutdown hook.
    """
    global _daemon_task
    if _daemon_task is None or _daemon_task.done():
        return
    _daemon_task.cancel()
    await asyncio.gather(_daemon_task, return_exceptions=True)
    logger.info("[SMRITI Scheduler] Background task stopped cleanly.")
    _daemon_task = None
