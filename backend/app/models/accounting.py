"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.1.0
Created      : 2026-07-21
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

accounting.py — SQLAlchemy ORM models for General Ledger, Double-Entry Journal Vouchers, Ledgers,
Fiscal Periods, Bank Accounts, Cost Centers, TDS Deduction Tracking & GST Return Locks.
"""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, DateTime, Text
from sqlalchemy.orm import relationship
from ..db.base import Base, BaseEntity, RowSecuredMixin


class ChartOfAccounts(RowSecuredMixin, BaseEntity):
    """
    ChartOfAccounts — Standard financial ledgers (ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE).
    """
    __tablename__ = "chart_of_accounts"

    account_code    = Column(String(50), nullable=False, unique=True)
    account_name    = Column(String(255), nullable=False)
    account_type    = Column(String(50), nullable=False)  # ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE
    balance_type    = Column(String(20), nullable=False, default="DEBIT")  # DEBIT, CREDIT
    parent_id       = Column(String(50), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    current_balance = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    is_system       = Column(Boolean, nullable=False, default=False)
    currency        = Column(String(10), nullable=False, default="INR")
    description     = Column(Text, nullable=True)

    parent   = relationship("ChartOfAccounts", remote_side="ChartOfAccounts.id", backref="sub_accounts")


class JournalVoucherModel(RowSecuredMixin, BaseEntity):
    """
    JournalVoucherModel — Header document for balanced debit/credit accounting entries.
    """
    __tablename__ = "journal_vouchers"

    voucher_no        = Column(String(100), nullable=False, unique=True)
    voucher_date      = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    ref_document_type = Column(String(60), nullable=False)
    ref_document_id   = Column(String(50), nullable=False)
    ref_document_no   = Column(String(80), nullable=False)
    total_debit       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    total_credit      = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    narration         = Column(Text, nullable=True)
    status            = Column(String(30), nullable=False, default="POSTED")  # DRAFT, POSTED, REVERSED
    posted_at         = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    posted_by         = Column(String(50), nullable=True)

    entries = relationship("JournalLedgerEntryModel", back_populates="voucher", cascade="all, delete-orphan", lazy="selectin")


class JournalLedgerEntryModel(BaseEntity):
    """
    JournalLedgerEntryModel — Line items for debits and credits posted to specific account codes.
    """
    __tablename__ = "journal_ledger_entries"

    voucher_id   = Column(String(50), ForeignKey("journal_vouchers.id", ondelete="CASCADE"), nullable=False)
    account_code = Column(String(50), nullable=False)
    account_name = Column(String(255), nullable=False)
    debit        = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    credit       = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    narration    = Column(Text, nullable=True)
    cost_center  = Column(String(100), nullable=True)
    project      = Column(String(100), nullable=True)

    voucher = relationship("JournalVoucherModel", back_populates="entries")


class FiscalPeriod(RowSecuredMixin, BaseEntity):
    """
    FiscalPeriod — Financial accounting period boundaries and closing state.
    """
    __tablename__ = "fiscal_periods"

    fiscal_year = Column(String(20), nullable=False)
    period_name = Column(String(50), nullable=False)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=False)
    is_closed   = Column(Boolean, nullable=False, default=False)


class FinancialYear(RowSecuredMixin, BaseEntity):
    """
    FinancialYear — Formal financial year entity with period locking for GST filing,
    ledger close, and Alembic-tracked schema changes.

    DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.10 — Accounting
    CDM Reference : SMRITI_CANONICAL_DATA_MODEL_v1.0.md — FinancialYear
    ADR Reference : ADR-012 (Database Blueprint Governance — Phase 1 Gap)
    """
    __tablename__ = "financial_year"

    name              = Column(String(50), nullable=False)           # e.g. "2025-26"
    label             = Column(String(100), nullable=True)           # e.g. "FY 2025-2026"
    start_date        = Column(Date, nullable=False)                 # April 1
    end_date          = Column(Date, nullable=False)                 # March 31
    is_current        = Column(Boolean, nullable=False, default=False)  # Currently active year
    is_locked         = Column(Boolean, nullable=False, default=False)  # Locked for new posting
    locked_at         = Column(DateTime(timezone=True), nullable=True)
    locked_by         = Column(String(100), nullable=True)
    gst_period_code   = Column(String(20), nullable=True)           # e.g. "2025-2026"
    status            = Column(String(30), nullable=False, default="OPEN")  # OPEN, CLOSED, ARCHIVED

    fiscal_periods = relationship("FiscalPeriod", primaryjoin="foreign(FiscalPeriod.fiscal_year) == FinancialYear.name", lazy="selectin", viewonly=True)


class BankAccount(RowSecuredMixin, BaseEntity):
    """
    BankAccount — Commercial & retail banking accounts owned by tenant company.
    Supports bank reconciliation, payment gateway settlement, and cheque management.
    """
    __tablename__ = "bank_accounts"

    account_name    = Column(String(255), nullable=False)
    account_number  = Column(String(100), nullable=False)
    bank_name       = Column(String(255), nullable=False)
    branch_name     = Column(String(255), nullable=True)
    ifsc_code       = Column(String(20),  nullable=False)
    swift_code      = Column(String(20),  nullable=True)
    account_type    = Column(String(50),  nullable=False, default="CURRENT")  # CURRENT, SAVINGS, OVERDRAFT
    opening_balance = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    current_balance = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    currency        = Column(String(10),  nullable=False, default="INR")
    is_default      = Column(Boolean,     nullable=False, default=False)
    gl_account_code = Column(String(50),  nullable=True)


class CostCenter(RowSecuredMixin, BaseEntity):
    """
    CostCenter — Organizational responsibility centers for cost/profit allocation.
    """
    __tablename__ = "cost_centers"

    code        = Column(String(50),  nullable=False, unique=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text,        nullable=True)
    is_active   = Column(Boolean,     nullable=False, default=True)


class TdsEntry(RowSecuredMixin, BaseEntity):
    """
    TdsEntry — Tax Deducted at Source (TDS) entries under Indian Income Tax Act.
    Sections: 194C (Contractor), 194J (Professional), 194Q (Goods purchase), etc.
    """
    __tablename__ = "tds_entries"

    deduction_date = Column(Date,          nullable=False)
    section_code   = Column(String(20),   nullable=False)  # 194C, 194J, 194Q, 194I, etc.
    vendor_id      = Column(String(50),   nullable=True)
    customer_id    = Column(String(50),   nullable=True)
    invoice_ref_no = Column(String(100),  nullable=False)
    gross_amount   = Column(Numeric(15, 2), nullable=False)
    tds_rate       = Column(Numeric(5, 2),  nullable=False)
    tds_amount     = Column(Numeric(15, 2), nullable=False)
    status         = Column(String(30),   nullable=False, default="DEDUCTED")  # DEDUCTED, REMITTED, CERTIFIED


class GstReturnLock(RowSecuredMixin, BaseEntity):
    """
    GstReturnLock — Locks accounting postings for periods where GST returns (GSTR-1, GSTR-3B) are filed.
    """
    __tablename__ = "gst_return_locks"

    return_type   = Column(String(20),  nullable=False)  # GSTR1, GSTR3B, GSTR9
    return_period = Column(String(20),  nullable=False)  # MM-YYYY e.g. "04-2026"
    filed_at      = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    filed_by      = Column(String(100), nullable=True)
    arn_number    = Column(String(100), nullable=True)
    is_locked     = Column(Boolean,     nullable=False, default=True)

