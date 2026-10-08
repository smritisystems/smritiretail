"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.42
Created      : 2026-08-14
Modified     : 2026-10-09
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
from .system_parameter import SystemParameterService
from ..db.session import get_company_sessionmaker

logger = logging.getLogger("smriti.outbox_worker")


class OutboxQueueWorker:
    """
    Asynchronous Multi-Tenant Outbox Queue Worker & Webhook Daemon.
    Executes resilient two-phase batch claims, non-blocking publishing callbacks,
    exponential retry backoff, and Dead-Letter Queue (DLQ) transitions.
    Operational limits are resolved dynamically via SystemParameterService (FND-024 to FND-027).
    """

    MAX_RETRIES = 5
    DEFAULT_BATCH_SIZE = 50
    DEFAULT_BACKOFF_SECONDS = 2
    DEFAULT_CLAIM_TIMEOUT_SECONDS = 60
    DEFAULT_POLL_INTERVAL_SECONDS = 5.0

    @classmethod
    async def resolve_operational_parameters(
        cls,
        session: Optional[AsyncSession] = None,
        company_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dynamically resolves outbox operational configuration parameters from SystemParameterService
        with robust fallbacks to class-level invariants.
        """
        params = {
            "batch_size": cls.DEFAULT_BATCH_SIZE,
            "max_retries": cls.MAX_RETRIES,
            "backoff_seconds": cls.DEFAULT_BACKOFF_SECONDS,
            "claim_timeout_seconds": cls.DEFAULT_CLAIM_TIMEOUT_SECONDS,
            "poll_interval_seconds": cls.DEFAULT_POLL_INTERVAL_SECONDS,
        }
        if session is None:
            return params

        try:
            # 1. Batch Size (FND-025)
            p_batch = await SystemParameterService.resolve_parameter(
                session, "SMRITI.OUTBOX.BATCH_SIZE", company_id=company_id
            )
            if p_batch and p_batch.effective_value is not None:
                params["batch_size"] = int(p_batch.effective_value)

            # 2. Max Retries (FND-024)
            p_retries = await SystemParameterService.resolve_parameter(
                session, "SMRITI.OUTBOX.MAX_RETRIES", company_id=company_id
            )
            if p_retries and p_retries.effective_value is not None:
                params["max_retries"] = int(p_retries.effective_value)

            # 3. Backoff Seconds (FND-026)
            p_backoff = await SystemParameterService.resolve_parameter(
                session, "SMRITI.OUTBOX.BACKOFF_SECONDS", company_id=company_id
            )
            if p_backoff and p_backoff.effective_value is not None:
                params["backoff_seconds"] = int(p_backoff.effective_value)

            # 4. Claim Timeout Seconds (FND-027)
            p_timeout = await SystemParameterService.resolve_parameter(
                session, "SMRITI.OUTBOX.CLAIM_TIMEOUT_SECONDS", company_id=company_id
            )
            if p_timeout and p_timeout.effective_value is not None:
                params["claim_timeout_seconds"] = int(p_timeout.effective_value)

            # 5. Poll Interval Seconds
            p_poll = await SystemParameterService.resolve_parameter(
                session, "SMRITI.OUTBOX.POLL_INTERVAL_SECONDS", company_id=company_id
            )
            if p_poll and p_poll.effective_value is not None:
                params["poll_interval_seconds"] = float(p_poll.effective_value)
        except Exception as exc:
            logger.warning(
                "Failed to resolve outbox operational parameters from SystemParameterService, defaulting: %s",
                exc,
            )

        return params

    @classmethod
    async def process_company_outbox_batch(
        cls,
        session: AsyncSession,
        dispatcher_callback: Callable,
        limit: Optional[int] = None,
        max_retries: Optional[int] = None,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None,
        base_backoff_seconds: Optional[int] = None,
        claim_timeout_seconds: Optional[int] = None,
        company_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Processes a batch of outbox events for a single company database session
        using the authoritative two-phase non-blocking dispatch algorithm.
        Operational limits are dynamically resolved from SystemParameterService unless explicitly overridden.
        """
        ops = await cls.resolve_operational_parameters(session=session, company_id=company_id)
        effective_limit = limit if limit is not None else ops["batch_size"]
        effective_max_retries = max_retries if max_retries is not None else ops["max_retries"]
        effective_backoff = base_backoff_seconds if base_backoff_seconds is not None else ops["backoff_seconds"]
        effective_claim_timeout = claim_timeout_seconds if claim_timeout_seconds is not None else ops["claim_timeout_seconds"]

        return await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
            session=session,
            limit=effective_limit,
            dispatcher_callback=dispatcher_callback,
            max_retries=effective_max_retries,
            target_channel=target_channel,
            event_type=event_type,
            base_backoff_seconds=effective_backoff,
            claim_timeout_seconds=effective_claim_timeout
        )

    @classmethod
    async def process_tenant_database(
        cls,
        database_name: str,
        dispatcher_callback: Callable,
        limit: Optional[int] = None,
        max_retries: Optional[int] = None,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None,
        base_backoff_seconds: Optional[int] = None,
        claim_timeout_seconds: Optional[int] = None,
        company_id: Optional[str] = None,
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
                event_type=event_type,
                base_backoff_seconds=base_backoff_seconds,
                claim_timeout_seconds=claim_timeout_seconds,
                company_id=company_id,
            )

    @classmethod
    async def run_worker_cycle(
        cls,
        company_databases: List[str],
        dispatcher_callback: Callable,
        limit: Optional[int] = None,
        max_retries: Optional[int] = None,
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
                    max_retries=max_retries,
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
        poll_interval_seconds: Optional[float] = None,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None,
        stop_event: Optional[asyncio.Event] = None
    ) -> None:
        """
        Runs continuous background daemon polling until stop_event is set.
        Poll interval defaults to DEFAULT_POLL_INTERVAL_SECONDS if not specified.
        """
        effective_poll = poll_interval_seconds if poll_interval_seconds is not None else cls.DEFAULT_POLL_INTERVAL_SECONDS
        logger.info(f"Starting Outbox Queue Daemon for databases: {company_databases} (interval: {effective_poll}s)")
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
                    await asyncio.wait_for(stop_event.wait(), timeout=effective_poll)
                else:
                    await asyncio.sleep(effective_poll)
            except asyncio.TimeoutError:
                pass

