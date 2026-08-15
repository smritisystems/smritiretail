"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.outbox import IntegrationOutboxEvent

logger = logging.getLogger("smriti.outbox_worker")


class OutboxQueueWorker:
    """
    Asynchronous Outbox Event Worker & Dispatcher.
    Polls pending integration outbox events, processes dispatches,
    and handles retries & Dead-Letter Queue (DLQ) transitions.
    """

    MAX_RETRIES = 5

    @classmethod
    async def fetch_pending_events(
        cls,
        session: AsyncSession,
        batch_size: int = 50
    ) -> List[IntegrationOutboxEvent]:
        """
        Fetches pending outbox events for processing.
        """
        stmt = (
            select(IntegrationOutboxEvent)
            .where(IntegrationOutboxEvent.status == "PENDING")
            .order_by(IntegrationOutboxEvent.created_at.asc())
            .limit(batch_size)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def process_outbox_batch(
        cls,
        session: AsyncSession,
        dispatcher_callback=None
    ) -> Dict[str, int]:
        """
        Processes a batch of outbox events safely.
        """
        events = await cls.fetch_pending_events(session)
        stats = {"processed": 0, "succeeded": 0, "failed": 0, "dead_lettered": 0}

        for evt in events:
            stats["processed"] += 1
            evt.status = "PROCESSING"
            await session.commit()

            try:
                if dispatcher_callback:
                    await dispatcher_callback(evt)

                evt.status = "DISPATCHED"
                evt.dispatched_at = datetime.now(timezone.utc)
                stats["succeeded"] += 1
            except Exception as e:
                logger.error(f"Error dispatching outbox event {evt.source_event_id}: {e}")
                evt.retry_count += 1
                if evt.retry_count >= cls.MAX_RETRIES:
                    evt.status = "DEAD_LETTER"
                    stats["dead_lettered"] += 1
                else:
                    evt.status = "PENDING"
                    stats["failed"] += 1

            await session.commit()

        return stats
