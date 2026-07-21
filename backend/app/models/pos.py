"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 10.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

pos.py — Unified ORM Models for POS Cash Drawer Sessions, Counter Checkout Transactions,
Line Items, and Offline Synchronization Queue.
"""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, DateTime, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.base import BaseEntity, RowSecuredMixin


class PosSession(RowSecuredMixin, BaseEntity):
    """
    PosSession — Terminal Cash Drawer Session tracking opening float, cumulative sales, and closing cash count reconciliation.
    """
    __tablename__ = "pos_sessions"

    session_no        = Column(String(100), nullable=False, unique=True)
    cashier_id        = Column(String(50), nullable=False)
    terminal_id       = Column(String(50), nullable=False)
    opened_at         = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    closed_at         = Column(DateTime(timezone=True), nullable=True)
    opening_balance   = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_cash_sales  = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_card_sales  = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_upi_sales   = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_sales       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    expected_cash     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    actual_cash_count = Column(Numeric(15, 2), nullable=True)
    cash_variance     = Column(Numeric(15, 2), nullable=True, default=Decimal("0.00"))
    status            = Column(String(30), nullable=False, default="OPEN")  # OPEN, CLOSED, RECONCILED
    notes             = Column(Text, nullable=True)

    transactions      = relationship("PosTransaction", back_populates="session", lazy="selectin")


class PosTransaction(RowSecuredMixin, BaseEntity):
    """
    PosTransaction — High-speed point of sale transaction receipt.
    """
    __tablename__ = "pos_transactions"

    session_id        = Column(String(50), ForeignKey("pos_sessions.id", ondelete="RESTRICT"), nullable=False)
    receipt_no        = Column(String(100), nullable=False, unique=True)
    client_tx_uuid    = Column(String(100), nullable=True, unique=True)
    customer_id       = Column(String(50), nullable=True)
    subtotal          = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    tax_total         = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    discount_amount   = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    grand_total       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    payment_method    = Column(String(30), nullable=False, default="CASH")  # CASH, CARD, UPI, MIXED
    tendered_amount   = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    change_due        = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    status            = Column(String(30), nullable=False, default="COMPLETED")  # COMPLETED, VOIDED, REFUNDED
    transaction_time  = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    is_offline_synced = Column(Boolean, nullable=False, default=False)

    session           = relationship("PosSession", back_populates="transactions")
    items             = relationship("PosTransactionItem", back_populates="transaction", cascade="all, delete-orphan", lazy="selectin")


class PosTransactionItem(BaseEntity):
    """
    PosTransactionItem — Individual product line item in a POS sale transaction.
    """
    __tablename__ = "pos_transaction_items"

    transaction_id = Column(String(50), ForeignKey("pos_transactions.id", ondelete="CASCADE"), nullable=False)
    product_id     = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_code   = Column(String(100), nullable=False)
    product_name   = Column(String(255), nullable=False)
    quantity       = Column(Numeric(12, 4), nullable=False)
    unit_price     = Column(Numeric(15, 2), nullable=False)
    tax_amount     = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    line_total     = Column(Numeric(15, 2), nullable=False)

    transaction    = relationship("PosTransaction", back_populates="items")
    product        = relationship("Product")


class PosOfflineSyncQueue(RowSecuredMixin, BaseEntity):
    """
    PosOfflineSyncQueue — Offline POS transaction queue for store-to-cloud batch synchronization.
    """
    __tablename__ = "pos_offline_sync_queue"

    client_tx_uuid         = Column(String(100), nullable=False, unique=True)
    terminal_id            = Column(String(50), nullable=False)
    payload_json           = Column(Text, nullable=False)
    sync_status            = Column(String(30), nullable=False, default="PENDING")  # PENDING, SYNCED, FAILED, DUPLICATE
    synced_transaction_id  = Column(String(50), nullable=True)
    error_message          = Column(Text, nullable=True)
    submitted_at           = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    synced_at              = Column(DateTime(timezone=True), nullable=True)
