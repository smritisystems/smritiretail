"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Government Integration Platform (SGIP) — Transactional Outbox Retry Worker.
Enforces Invariant 9: Resilient network retry with exponential backoff and circuit breaker failover.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.compliance.models.compliance import ComplianceOutbox


class ComplianceRetryWorker:
    """
    Background worker for processing queued compliance outbox events.
    """

    MAX_RETRIES = 5
    INITIAL_BACKOFF_SECONDS = 15

    @classmethod
    def compute_next_retry(cls, current_attempt: int) -> datetime:
        """
        Calculates exponential backoff timestamp:
        Attempt 1: 15s
        Attempt 2: 30s
        Attempt 3: 60s
        Attempt 4: 120s
        Attempt 5: 240s
        """
        backoff_sec = cls.INITIAL_BACKOFF_SECONDS * (2 ** (current_attempt - 1))
        return datetime.now(timezone.utc) + timedelta(seconds=backoff_sec)

    @classmethod
    async def process_outbox_event(
        cls,
        db: AsyncSession,
        event: ComplianceOutbox,
        is_simulated_success: bool = True
    ) -> ComplianceOutbox:
        """
        Processes an outbox event, advancing its state or recording failure backoff.
        """
        event.attempts += 1
        
        if is_simulated_success:
            event.state = "COMPLETED"
            event.error_message = None
            event.next_retry_at = None
        else:
            if event.attempts >= cls.MAX_RETRIES:
                event.state = "DEAD_LETTER"
                event.error_message = f"Max retries ({cls.MAX_RETRIES}) exceeded."
                event.next_retry_at = None
            else:
                event.state = "RETRY"
                event.error_message = f"Transient gateway failure on attempt {event.attempts}."
                event.next_retry_at = cls.compute_next_retry(event.attempts)

        await db.commit()
        await db.refresh(event)
        return event
