"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.27.0
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Contract — Stage 5
"""

import asyncio
import logging
from typing import Optional, Callable, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession

from .postgres_outbox import PostgresEventOutbox
from .service import PlatformEventService

logger = logging.getLogger("smriti.platform.outbox_worker")


class PlatformOutboxWorker:
    """
    Asynchronous Transactional Outbox Background Worker.
    Polls staged outbox events via PostgresEventOutbox using non-blocking two-phase claims
    (SELECT ... FOR UPDATE SKIP LOCKED) and dispatches them through PlatformEventService.
    """

    def __init__(
        self,
        session_factory: Callable[..., Any],
        outbox: PostgresEventOutbox,
        event_service: PlatformEventService,
        target_channel: Optional[str] = "PLATFORM_EVENTS",
        poll_interval_seconds: float = 1.0,
        batch_size: int = 50,
        max_retries: int = 5,
        base_backoff_seconds: int = 2,
        claim_timeout_seconds: int = 60,
    ):
        self.session_factory = session_factory
        self.outbox = outbox
        self.event_service = event_service
        self.target_channel = target_channel
        self.poll_interval_seconds = poll_interval_seconds
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.base_backoff_seconds = base_backoff_seconds
        self.claim_timeout_seconds = claim_timeout_seconds

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._wake_event = asyncio.Event()

    async def run_cycle(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Executes a single transactional outbox claim-publish-settle cycle.
        Returns a dictionary with processing metrics.
        """
        batch_limit = limit or self.batch_size
        stats = {
            "claimed_count": 0,
            "dispatched_count": 0,
            "failed_count": 0,
            "dispatched_ids": [],
            "failed_ids": [],
        }

        async with self.session_factory() as session:
            # Phase 1: Claim Batch with SKIP LOCKED (commits lease inside claim)
            claimed = await self.outbox.claim(
                db_session=session,
                limit=batch_limit,
                claim_timeout_seconds=self.claim_timeout_seconds,
                target_channel=self.target_channel,
            )

            if not claimed:
                return stats

            stats["claimed_count"] = len(claimed)

            # Phase 2: Publish Envelopes Outside Row Locks
            for outbox_id, envelope in claimed:
                try:
                    await self.event_service.publish(envelope)
                    await self.outbox.mark_dispatched(session, outbox_id)
                    stats["dispatched_count"] += 1
                    stats["dispatched_ids"].append(outbox_id)
                except Exception as exc:
                    logger.exception(f"Error publishing outbox event {outbox_id}: {exc}")
                    await self.outbox.mark_failed(
                        db_session=session,
                        outbox_id=outbox_id,
                        error_message=str(exc),
                        max_retries=self.max_retries,
                        base_backoff_seconds=self.base_backoff_seconds,
                    )
                    stats["failed_count"] += 1
                    stats["failed_ids"].append(outbox_id)


        return stats

    # Alias for batch processing
    process_batch = run_cycle

    async def _worker_loop(self) -> None:
        """Background continuous polling loop."""
        logger.info("PlatformOutboxWorker started.")
        while self._running:
            try:
                stats = await self.run_cycle()
                if stats["claimed_count"] == 0:
                    # Sleep or wait for wake event
                    try:
                        await asyncio.wait_for(self._wake_event.wait(), timeout=self.poll_interval_seconds)
                        self._wake_event.clear()
                    except asyncio.TimeoutError:
                        pass
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Unexpected error in outbox worker loop: {exc}")
                await asyncio.sleep(self.poll_interval_seconds)
        logger.info("PlatformOutboxWorker stopped.")

    def wake(self) -> None:
        """Immediately wake up worker without waiting for poll interval."""
        self._wake_event.set()

    async def start(self) -> None:
        """Starts the background worker daemon task."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        """Stops the background worker daemon cleanly."""
        if not self._running:
            return
        self._running = False
        self.wake()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
