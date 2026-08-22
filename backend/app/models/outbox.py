"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy import Column, String, Integer, DateTime, Text, text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import synonym
from ..db.base import Base


class IntegrationOutboxEvent(Base):
    """
    Canonical Transactional Outbox Event inside tenant databases (smritiXXX).
    Written atomically within the exact same database transaction as domain business operations
    (sales invoices, stock movements, payment settlements, approval requests).
    Guarantees reliable asynchronous event publishing without dual-write hazards.
    """
    __tablename__ = "integration_outbox_events"

    outbox_id = Column(String(50), primary_key=True)
    source_event_id = Column(String(100), nullable=False, unique=True, index=True)
    correlation_id = Column(String(100), nullable=False, index=True)
    causation_id = Column(String(100), nullable=True)
    event_type = Column(String(100), nullable=True, index=True)
    aggregate_type = Column(String(50), nullable=True, index=True)
    aggregate_id = Column(String(50), nullable=True, index=True)
    company_id = Column(String(50), nullable=True, index=True)
    branch_id = Column(String(50), nullable=True)
    event_schema_version = Column(String(20), nullable=False, default="1.0")
    target_channel = Column(String(50), nullable=False, default="GENERAL_OUTBOX", index=True)
    payload_json = Column(JSONB, nullable=False)
    status = Column(String(30), nullable=False, default="PENDING", index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    next_attempt_at = Column(DateTime(timezone=True), nullable=True, index=True)
    claim_expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)

    # Column synonyms for backward-compatibility across legacy and unified services
    id = synonym("outbox_id")
    payload = synonym("payload_json")

    __table_args__ = (
        Index("idx_outbox_channel_status", "target_channel", "status"),
        Index("idx_outbox_aggregate", "aggregate_type", "aggregate_id"),
        Index("idx_outbox_retry_schedule", "status", "next_attempt_at"),
    )


# Canonical Alias to preserve backward compatibility across all modules
OutboxEvent = IntegrationOutboxEvent

