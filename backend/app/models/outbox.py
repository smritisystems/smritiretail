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

import uuid as uuid_pkg
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, Index
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import Base

class IntegrationOutboxEvent(Base):
    """
    IntegrationOutboxEvent — Transactional Outbox inside Smritibus_<CompanyCode>.
    Written atomically within the exact same database transaction as business operations.
    """
    __tablename__ = "integration_outbox_events"

    outbox_id = Column(String(50), primary_key=True)
    source_event_id = Column(String(100), nullable=False, unique=True, index=True) # ULID/UUID
    correlation_id = Column(String(100), nullable=False, index=True) # End-to-end trace ID
    causation_id = Column(String(100), nullable=True) # Parent event/doc ID
    event_schema_version = Column(String(20), nullable=False, default="1.0")
    target_channel = Column(String(50), nullable=False, index=True) # PSV_QUEUE, ECOM_QUEUE, AUDIT_QUEUE
    payload_json = Column(JSONB, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", index=True) # PENDING, DISPATCHED, FAILED
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    dispatched_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_outbox_channel_status", "target_channel", "status"),
    )
