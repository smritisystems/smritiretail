"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.27.1
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Contract — Stage 5.1 Hardened
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, List, Optional, Tuple, Dict
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from .envelope import EventEnvelope
from .outbox import IEventOutbox
from .serializer import EventSerializer
from ...models.outbox import IntegrationOutboxEvent

logger = logging.getLogger("smriti.platform.outbox")


class PostgresEventOutbox(IEventOutbox):
    """
    Production-grade PostgreSQL implementation of IEventOutbox.
    Provides transactional staging inside existing domain database sessions,
    non-blocking batch claiming using SELECT FOR UPDATE SKIP LOCKED,
    zombie lease recovery, and DLQ operational lifecycle (replay/abandon).
    All methods strictly require explicit database session ownership.
    """

    def __init__(self, serializer: Optional[EventSerializer] = None):
        self.serializer = serializer or EventSerializer()

    async def stage(self, envelope: EventEnvelope[Any], db_session: AsyncSession) -> str:
        """
        Stage an event envelope atomically into integration_outbox_events table
        using the caller's active database transaction/session.
        Does NOT commit the session so the outbox write shares the caller's atomic commit/rollback.
        """
        outbox_id = f"obx_{uuid.uuid4().hex[:16]}"
        serialized_envelope = self.serializer.to_dict(envelope)

        target_channel = envelope.metadata.get("target_channel", "PLATFORM_EVENTS")
        # Semantic mapping: tenantId is isolation boundary, company_id/branch_id are business dimensions
        company_id = envelope.metadata.get("company_id") or envelope.tenantId
        branch_id = envelope.metadata.get("branch_id")

        # Ensure backward compatibility for legacy callers/tests expecting payload keys at root level
        if isinstance(envelope.payload, dict):
            stored_payload = {**envelope.payload, **serialized_envelope}
        else:
            stored_payload = serialized_envelope

        canonical_event_type = envelope.metadata.get("event_type") or envelope.eventType.strip().upper()

        outbox_record = IntegrationOutboxEvent(
            outbox_id=outbox_id,
            source_event_id=envelope.id,
            correlation_id=envelope.correlationId,
            causation_id=envelope.causationId,
            event_type=canonical_event_type,
            aggregate_type=envelope.source,
            aggregate_id=envelope.metadata.get("aggregate_id") or envelope.id,
            company_id=company_id,
            branch_id=branch_id,
            event_schema_version=envelope.schemaVersion,
            target_channel=target_channel,
            payload_json=stored_payload,
            status="PENDING",
            retry_count=0,
            created_at=datetime.now(timezone.utc),
        )

        db_session.add(outbox_record)
        return outbox_id

    async def claim(
        self,
        db_session: AsyncSession,
        limit: int = 50,
        claim_timeout_seconds: int = 60,
        target_channel: Optional[str] = "PLATFORM_EVENTS",
    ) -> List[Tuple[str, EventEnvelope[Any]]]:
        """
        Atomically queries eligible outbox events with SELECT FOR UPDATE SKIP LOCKED,
        transitions them to 'PROCESSING' with a lease timeout, and commits the claim.
        Returns a list of (outbox_id, EventEnvelope) tuples.
        """
        now_utc = datetime.now(timezone.utc)
        claim_expires_at = now_utc + timedelta(seconds=claim_timeout_seconds)

        # Eligibility criteria:
        # 1. status == 'PENDING'
        # 2. status == 'FAILED' AND (next_attempt_at IS NULL OR next_attempt_at <= now)
        # 3. status == 'PROCESSING' AND claim_expires_at <= now (zombie lease recovery)
        eligibility_clause = or_(
            IntegrationOutboxEvent.status == "PENDING",
            and_(
                IntegrationOutboxEvent.status == "FAILED",
                or_(
                    IntegrationOutboxEvent.next_attempt_at == None,
                    IntegrationOutboxEvent.next_attempt_at <= now_utc,
                ),
            ),
            and_(
                IntegrationOutboxEvent.status == "PROCESSING",
                IntegrationOutboxEvent.claim_expires_at != None,
                IntegrationOutboxEvent.claim_expires_at <= now_utc,
            ),
        )

        filters = [eligibility_clause]
        if target_channel:
            filters.append(IntegrationOutboxEvent.target_channel == target_channel)

        stmt = (
            select(IntegrationOutboxEvent)
            .where(*filters)
            .order_by(IntegrationOutboxEvent.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )

        records = list((await db_session.execute(stmt)).scalars().all())
        if not records:
            return []

        claimed: List[Tuple[str, EventEnvelope[Any]]] = []
        for rec in records:
            rec.status = "PROCESSING"
            rec.last_attempt_at = now_utc
            rec.claim_expires_at = claim_expires_at

            # Reconstitute EventEnvelope
            try:
                if isinstance(rec.payload_json, dict) and "eventType" in rec.payload_json:
                    env = self.serializer.from_dict(rec.payload_json)
                else:
                    env = EventEnvelope(
                        id=rec.source_event_id,
                        eventType=rec.event_type,
                        schemaVersion=rec.event_schema_version or "1.0",
                        source=rec.aggregate_type or "platform.outbox",
                        tenantId=rec.company_id or "default",
                        correlationId=rec.correlation_id,
                        causationId=rec.causation_id,
                        payload=rec.payload_json,
                    )
                claimed.append((rec.outbox_id, env))
            except Exception as exc:
                logger.error(f"Failed to deserialize outbox record {rec.outbox_id}: {exc}")
                rec.status = "FAILED"
                rec.error_message = f"Deserialization error: {exc}"

        await db_session.commit()
        return claimed

    async def mark_dispatched(self, db_session: AsyncSession, outbox_id: str) -> None:
        """Mark outbox record as dispatched using active database session."""
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await db_session.execute(stmt)).scalar_one_or_none()
        if rec:
            rec.status = "DISPATCHED"
            rec.dispatched_at = datetime.now(timezone.utc)
            rec.claim_expires_at = None
            await db_session.commit()

    async def mark_failed(
        self,
        db_session: AsyncSession,
        outbox_id: str,
        error_message: str,
        max_retries: int = 5,
        base_backoff_seconds: int = 2,
    ) -> None:
        """Mark outbox record as failed with exponential backoff, or dead-letter if exceeded."""
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await db_session.execute(stmt)).scalar_one_or_none()
        if rec:
            rec.retry_count += 1
            rec.error_message = error_message
            rec.claim_expires_at = None

            if rec.retry_count >= max_retries:
                rec.status = "DEAD_LETTER"
                rec.next_attempt_at = None
                logger.warning(
                    f"Outbox event {outbox_id} exceeded max retries ({max_retries}); transitioned to DEAD_LETTER"
                )
            else:
                rec.status = "FAILED"
                delay = min(base_backoff_seconds ** rec.retry_count, 3600)
                rec.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
                logger.info(
                    f"Outbox event {outbox_id} failed attempt {rec.retry_count}/{max_retries}. Next retry in {delay}s"
                )

            await db_session.commit()

    async def replay_dead_letter(self, db_session: AsyncSession, outbox_id: str) -> bool:
        """
        Reset a DEAD_LETTER record back to PENDING for re-processing.
        Preserves original source_event_id and audit trail, but resets attempt counts.
        """
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await db_session.execute(stmt)).scalar_one_or_none()
        if not rec or rec.status != "DEAD_LETTER":
            return False

        rec.status = "PENDING"
        rec.retry_count = 0
        rec.next_attempt_at = None
        rec.claim_expires_at = None
        rec.last_attempt_at = None
        rec.error_message = f"[REPLAYED AT {datetime.now(timezone.utc).isoformat()}] Prior error: {rec.error_message}"
        await db_session.commit()
        return True

    async def abandon_dead_letter(self, db_session: AsyncSession, outbox_id: str, reason: str) -> bool:
        """
        Mark a DEAD_LETTER record as ABANDONED with operator/system rationale.
        Takes event permanently out of polling rotation.
        """
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await db_session.execute(stmt)).scalar_one_or_none()
        if not rec or rec.status != "DEAD_LETTER":
            return False

        rec.status = "ABANDONED"
        rec.claim_expires_at = None
        rec.next_attempt_at = None
        rec.error_message = f"[ABANDONED: {reason}] {rec.error_message}"
        await db_session.commit()
        return True
