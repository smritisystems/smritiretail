"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.36.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Transaction Integrity Engine (STIE)
Capability   : @SmritiCapability("TRANSACTION_INTEGRITY", "STIE_MODEL")
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import Base


class TransactionIdempotencyRecord(Base):
    """
    Universal transaction idempotency and concurrency ledger record.
    Governed by SMRITI Transaction Integrity Engine (STIE).
    Guarantees:
      1. Single posting execution per business event.
      2. In-flight execution concurrency collision lock.
      3. Payload fingerprint verification (SHA-256).
      4. Safe response replay for committed transactions.
    """
    __tablename__ = "transaction_idempotency_records"
    __table_args__ = (
        UniqueConstraint("company_id", "entity_type", "idempotency_key", name="uq_tx_idemp_tenant_key"),
        Index("ix_tx_idemp_lookup", "company_id", "entity_type", "idempotency_key"),
        Index("ix_tx_idemp_status", "company_id", "status"),
    )

    id = Column(String(100), primary_key=True)
    company_id = Column(String(50), nullable=False, index=True)
    branch_id = Column(String(50), nullable=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # SALES_ORDER, SALES_INVOICE, SALES_RETURN, DISPATCH, POS_CHECKOUT, STOCK_TRANSFER, etc.
    idempotency_key = Column(String(150), nullable=False, index=True)
    request_hash = Column(String(64), nullable=False)  # SHA-256 hex digest of canonicalized payload
    status = Column(String(20), nullable=False, default="IN_FLIGHT", server_default=text("'IN_FLIGHT'"))  # IN_FLIGHT | COMMITTED | FAILED
    
    document_id = Column(String(100), nullable=True, index=True)
    document_no = Column(String(100), nullable=True, index=True)
    response_payload = Column(JSONB, nullable=True)
    error_detail = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=text("CURRENT_TIMESTAMP"))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(100), nullable=True)
