"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class POSOfflineSyncQueue(BaseEntity):
    """
    Durable Tenant-Local Offline Synchronization Queue (Section 10).
    Ensures crash recovery, ordering, idempotent deduplication, and retry persistence.
    """
    __tablename__ = "pos_offline_sync_queue"

    batch_id = Column(String(100), nullable=False, index=True)
    client_tx_uuid = Column(String(100), nullable=False, index=True)
    terminal_id = Column(String(50), nullable=False, default="POS-01", index=True)
    txn_type = Column(String(50), nullable=False, default="SALES_INVOICE")
    payload_json = Column(Text, nullable=False)
    sync_status = Column(String(50), nullable=False, default="PENDING", index=True)  # PENDING, COMMITTED, ALREADY_PROCESSED, FAILED
    synced_transaction_id = Column(String(50), nullable=True)
    document_number = Column(String(100), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    synced_at = Column(DateTime(timezone=True), nullable=True)
