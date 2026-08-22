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
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class PaymentTransaction(BaseEntity):
    """
    Multi-tender payment transaction ledger recording individual tender settlements with idempotency guarantees.
    """
    __tablename__ = "payment_transactions"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_payment_idempotency_key"),
    )

    transaction_no = Column(String(100), nullable=False, unique=True, index=True)
    reference_doc_type = Column(String(50), nullable=False)  # SALES_INVOICE, POS_BILL, PURCHASE_RECEIPT
    reference_doc_id = Column(String(50), nullable=False, index=True)
    party_id = Column(String(50), nullable=True, index=True)
    tender_type = Column(String(30), nullable=False)  # CASH, CARD, UPI, CREDIT_MEMO, CHEQUE, LOYALTY_POINTS
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    idempotency_key = Column(String(100), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="SUCCESS")  # SUCCESS, REVERSED, FAILED, PENDING
    gateway_reference = Column(String(100), nullable=True)
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocation(BaseEntity):
    """
    Settlement link distributing a payment transaction across one or more invoice balances.
    """
    __tablename__ = "payment_allocations"

    payment_id = Column(String(50), ForeignKey("payment_transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(String(50), nullable=False, index=True)
    allocated_amount = Column(Numeric(15, 2), nullable=False)
    discount_allowed = Column(Numeric(15, 2), nullable=False, default=0.00)
    settled_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    payment = relationship("PaymentTransaction", back_populates="allocations")
