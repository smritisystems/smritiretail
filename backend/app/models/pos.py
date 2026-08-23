"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-07-11
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from sqlalchemy import Boolean, Column, String, Numeric, ForeignKey, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class CashRegister(BaseEntity):
    """
    A physical POS terminal / POS profile at a branch.
    Maps 1-to-1 with the frontend POSProfile concept:
      name     = display name (e.g. "Counter 1")
      code     = machine code  (e.g. "REG-001")
      cashier  = assigned cashier name / role
      warehouse = warehouse code served by this terminal
      is_locked = True when the terminal is access-locked
    """
    __tablename__ = "cash_registers"

    name      = Column(String(100), nullable=False)          # e.g. "Counter 1"
    code      = Column(String(50),  nullable=False)          # e.g. "REG-001"
    notes     = Column(Text, nullable=True)
    cashier   = Column(String(100), nullable=True)           # assigned cashier
    warehouse = Column(String(100), nullable=True)           # serving warehouse
    is_locked = Column(Boolean, default=False, nullable=False)  # terminal lock


class Shift(BaseEntity):
    """
    A cashier's work session on a specific register.

    Lifecycle:  OPEN → CLOSED

    Business rules:
    - Only one shift can be OPEN per register at a time.
    - Opening balance = cash counted in drawer at shift start.
    - Closing balance = cash counted at shift end.
    - expected_cash = opening_balance + cash_sales_total + cash_in_total - cash_drops_total - till_expenses_total
    - variance      = closing_balance − expected_cash
      (positive = overage, negative = shortage)
    """
    __tablename__ = "shifts"

    register_id      = Column(String(50), ForeignKey("cash_registers.id", ondelete="RESTRICT"), nullable=False)
    cashier_id       = Column(String(50), ForeignKey("users.id",          ondelete="RESTRICT"), nullable=False)
    status           = Column(String(20), nullable=False, default="OPEN")  # OPEN | CLOSED

    opened_at        = Column(DateTime(timezone=True), nullable=False)
    closed_at        = Column(DateTime(timezone=True), nullable=True)

    opening_balance  = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Populated when shift is closed
    cash_sales_total = Column(Numeric(15, 2), nullable=False, default=0.00)
    card_sales_total = Column(Numeric(15, 2), nullable=False, default=0.00)
    upi_sales_total  = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_sales      = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_invoices   = Column(String(10),     nullable=False, default="0")

    # Mid-shift cash movement totals
    cash_drops_total    = Column(Numeric(15, 2), nullable=False, default=0.00)
    till_expenses_total = Column(Numeric(15, 2), nullable=False, default=0.00)
    cash_in_total       = Column(Numeric(15, 2), nullable=False, default=0.00)

    closing_balance  = Column(Numeric(15, 2), nullable=True)
    expected_cash    = Column(Numeric(15, 2), nullable=True)
    variance         = Column(Numeric(15, 2), nullable=True)
    denominations    = Column(JSONB, nullable=True)
    closing_notes    = Column(Text, nullable=True)

    # Relationships
    cash_transactions = relationship("ShiftCashTransaction", back_populates="shift", cascade="all, delete-orphan")


class ShiftCashTransaction(BaseEntity):
    """
    Tracks cash movements during an active shift (CASH_DROP, TILL_EXPENSE, CASH_IN).
    Links directly to an automated General Ledger Journal Voucher.
    """
    __tablename__ = "shift_cash_transactions"

    shift_id         = Column(String(50), ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_type = Column(String(30), nullable=False)  # CASH_DROP | TILL_EXPENSE | CASH_IN
    amount           = Column(Numeric(15, 2), nullable=False)
    account_id       = Column(String(50), nullable=True)   # Target safe/bank or expense account
    reason           = Column(Text, nullable=False)
    performed_by     = Column(String(50), nullable=False)
    gl_voucher_id    = Column(String(50), nullable=True)
    gl_voucher_no    = Column(String(100), nullable=True)
    receipt_ref      = Column(String(100), nullable=True)

    # Relationships
    shift            = relationship("Shift", back_populates="cash_transactions")
