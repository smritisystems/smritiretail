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
from sqlalchemy import Column, String, Integer, DateTime, Text, text, Index
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import Base, BaseEntity


class IntegrationOutboxEvent(Base):
    """
    IntegrationOutboxEvent — Legacy/Channel Outbox inside Smritibus_<CompanyCode>.
    Written atomically within the exact same database transaction as business operations.
    """
    __tablename__ = "integration_outbox_events"

    outbox_id = Column(String(50), primary_key=True)
    source_event_id = Column(String(100), nullable=False, unique=True, index=True)
    correlation_id = Column(String(100), nullable=False, index=True)
    causation_id = Column(String(100), nullable=True)
    event_schema_version = Column(String(20), nullable=False, default="1.0")
    target_channel = Column(String(50), nullable=False, index=True)
    payload_json = Column(JSONB, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    dispatched_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_outbox_channel_status", "target_channel", "status"),
    )


class OutboxEvent(BaseEntity):
    """
    Canonical Transactional Outbox event record stored in tenant data plane (smritiXXX)
    to guarantee reliable asynchronous event publishing without dual-write hazards.
    """
    __tablename__ = "outbox_events"

    event_type = Column(String(100), nullable=False, index=True)
    aggregate_type = Column(String(50), nullable=False, index=True)
    aggregate_id = Column(String(50), nullable=False, index=True)
    payload = Column(JSONB, server_default=text("'{}'"), default=dict, nullable=False)
    status = Column(String(30), nullable=False, default="PENDING", index=True)  # PENDING, DISPATCHED, FAILED
    retry_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
