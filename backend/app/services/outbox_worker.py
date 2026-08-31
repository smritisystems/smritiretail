"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-14
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.outbox import IntegrationOutboxEvent
from .outbox_analytics import UnifiedOutboxAnalyticsService
from ..db.session import get_company_sessionmaker

logger = logging.getLogger("smriti.outbox_worker")


class OutboxQueueWorker:
    """
    Asynchronous Multi-Tenant Outbox Queue Worker & Webhook Daemon.
    Executes resilient two-phase batch claims, non-blocking publishing callbacks,
    exponential retry backoff, and Dead-Letter Queue (DLQ) transitions.
    """

    MAX_RETRIES = 5
    DEFAULT_BATCH_SIZE = 50
    DEFAULT_BACKOFF_SECONDS = 2
    DEFAULT_CLAIM_TIMEOUT_SECONDS = 60

    @classmethod
    async def process_company_outbox_batch(
        cls,
        session: AsyncSession,
        dispatcher_callback: Callable,
        limit: int = DEFAULT_BATCH_SIZE,
        max_retries: int = MAX_RETRIES,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None,
        base_backoff_seconds: int = DEFAULT_BACKOFF_SECONDS,
        claim_timeout_seconds: int = DEFAULT_CLAIM_TIMEOUT_SECONDS
    ) -> Dict[str, Any]:
        """
        Processes a batch of outbox events for a single company database session
        using the authoritative two-phase non-blocking dispatch algorithm.
        """
        return await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
            session=session,
            limit=limit,
            dispatcher_callback=dispatcher_callback,
            max_retries=max_retries,
            target_channel=target_channel,
            event_type=event_type,
            base_backoff_seconds=base_backoff_seconds,
            claim_timeout_seconds=claim_timeout_seconds
        )

    @classmethod
    async def process_tenant_database(
        cls,
        database_name: str,
        dispatcher_callback: Callable,
        limit: int = DEFAULT_BATCH_SIZE,
        max_retries: int = MAX_RETRIES,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Opens a session for a specific company database and processes pending outbox events.
        """
        session_factory = get_company_sessionmaker(database_name)
        async with session_factory() as session:
            return await cls.process_company_outbox_batch(
                session=session,
                dispatcher_callback=dispatcher_callback,
                limit=limit,
                max_retries=max_retries,
                target_channel=target_channel,
                event_type=event_type
            )

    @classmethod
    async def run_worker_cycle(
        cls,
        company_databases: List[str],
        dispatcher_callback: Callable,
        limit: int = DEFAULT_BATCH_SIZE,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Executes a single polling cycle across all target tenant databases.
        """
        results = {}
        for db in company_databases:
            try:
                res = await cls.process_tenant_database(
                    database_name=db,
                    dispatcher_callback=dispatcher_callback,
                    limit=limit,
                    target_channel=target_channel,
                    event_type=event_type
                )
                results[db] = res
            except Exception as exc:
                logger.error(f"Failed to process outbox for tenant database '{db}': {exc}")
                results[db] = {"error": str(exc), "dispatched_count": 0, "failed_count": 0}
        return results

    @classmethod
    async def run_daemon_loop(
        cls,
        company_databases: List[str],
        dispatcher_callback: Callable,
        poll_interval_seconds: float = 5.0,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None,
        stop_event: Optional[asyncio.Event] = None
    ) -> None:
        """
        Runs continuous background daemon polling until stop_event is set.
        """
        logger.info(f"Starting Outbox Queue Daemon for databases: {company_databases}")
        while not (stop_event and stop_event.is_set()):
            try:
                await cls.run_worker_cycle(
                    company_databases=company_databases,
                    dispatcher_callback=dispatcher_callback,
                    target_channel=target_channel,
                    event_type=event_type
                )
            except Exception as exc:
                logger.error(f"Unexpected error in outbox daemon cycle: {exc}")

            try:
                if stop_event:
                    await asyncio.wait_for(stop_event.wait(), timeout=poll_interval_seconds)
                else:
                    await asyncio.sleep(poll_interval_seconds)
            except asyncio.TimeoutError:
                pass
