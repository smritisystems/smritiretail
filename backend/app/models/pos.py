"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-11
Modified     : 2026-07-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Boolean, Column, String, Numeric, ForeignKey, Text, DateTime
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
    - expected_cash = opening_balance + cash_sales_total
    - variance      = closing_balance − expected_cash
      (positive = over, negative = short)
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

    closing_balance  = Column(Numeric(15, 2), nullable=True)
    expected_cash    = Column(Numeric(15, 2), nullable=True)
    variance         = Column(Numeric(15, 2), nullable=True)
    closing_notes    = Column(Text, nullable=True)
