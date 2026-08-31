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

import uuid
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.outbox import IntegrationOutboxEvent


def generate_ulid_source_event_id() -> str:
    """
    Generates a lexicographically sortable unique source_event_id (ULID / high-precision timestamped UUID).
    Example: 'evt_00061e8c97df4321_debf6ba61d44497d'
    """
    ts_us_hex = f"{int(time.time() * 1000000):016x}"
    random_hex = uuid.uuid4().hex[:16]
    return f"evt_{ts_us_hex}_{random_hex}"


class OutboxService:
    """
    Durable Transactional Outbox Service inside Smritibus_<CompanyCode>.
    Writes integration outbox events atomically within the exact same database transaction
    as business transactions (sales invoices, stock movements).
    """

    @classmethod
    async def record_event(
        cls,
        session: AsyncSession,
        target_channel: str,
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
        event_schema_version: str = "1.0",
        event_type: Optional[str] = None,
        aggregate_type: Optional[str] = None,
        aggregate_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None
    ) -> IntegrationOutboxEvent:
        """
        Records an outbox event in the originating business database transaction.
        DOES NOT COMMIT THE SESSION — the calling business service commits session atomically.
        """
        source_event_id = generate_ulid_source_event_id()
        if not correlation_id:
            correlation_id = f"corr_{uuid.uuid4().hex[:16]}"

        outbox_event = IntegrationOutboxEvent(
            outbox_id=f"obx_{uuid.uuid4().hex[:16]}",
            source_event_id=source_event_id,
            correlation_id=correlation_id,
            causation_id=causation_id,
            event_type=event_type or target_channel,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            company_id=company_id,
            branch_id=branch_id,
            event_schema_version=event_schema_version,
            target_channel=target_channel,
            payload_json=payload,
            status="PENDING",
            retry_count=0,
            created_at=datetime.now(timezone.utc)
        )
        session.add(outbox_event)
        return outbox_event

