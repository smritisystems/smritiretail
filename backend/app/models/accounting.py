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

from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, ForeignKey,
    DateTime, Date, Text, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class Account(BaseEntity):
    """
    Hierarchical Chart of Accounts (COA) entity for the double-entry accounting ledger.
    """
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("company_id", "account_code", name="uq_accounts_company_code"),
        Index("idx_accounts_company_type", "company_id", "account_type"),
        Index("idx_accounts_parent", "company_id", "parent_account_id"),
    )

    account_code = Column(String(50), nullable=False, index=True)
    account_name = Column(String(200), nullable=False)
    account_type = Column(String(30), nullable=False)  # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    root_type = Column(String(30), nullable=False)     # ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
    parent_account_id = Column(String(50), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    is_group = Column(Boolean, nullable=False, default=False)
    currency = Column(String(10), nullable=False, default="INR")
    is_active = Column(Boolean, nullable=False, default=True)
    is_system = Column(Boolean, nullable=False, default=False)
    tax_rate = Column(Numeric(5, 2), nullable=True)
    party_type = Column(String(30), nullable=True)     # CUSTOMER, SUPPLIER, EMPLOYEE, BANK

    # Relationships
    parent = relationship("Account", remote_side="Account.id", backref="children")
    gl_entries = relationship("GeneralLedgerEntry", back_populates="account")


class JournalVoucher(BaseEntity):
    """
    Authoritative double-entry Journal Voucher header.
    Enforces total_debit == total_credit balance invariant across child GL entries.
    """
    __tablename__ = "journal_vouchers"
    __table_args__ = (
        UniqueConstraint("company_id", "voucher_no", name="uq_journal_vouchers_company_no"),
        Index("idx_jv_company_type_date", "company_id", "voucher_type", "voucher_date"),
        Index("idx_jv_reference_doc", "company_id", "reference_doc_type", "reference_doc_id"),
    )

    voucher_no = Column(String(100), nullable=False, index=True)
    voucher_type = Column(String(50), nullable=False)  # SALES_INVOICE, PURCHASE_BILL, PAYMENT_RECEIPT, SUPPLIER_PAYMENT, JOURNAL, STOCK_ADJUSTMENT, CREDIT_NOTE, DEBIT_NOTE
    voucher_date = Column(Date, nullable=False, default=date.today)
    posting_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    reference_doc_type = Column(String(50), nullable=True)
    reference_doc_id = Column(String(50), nullable=True, index=True)
    reference_doc_no = Column(String(100), nullable=True)
    narration = Column(Text, nullable=True)
    total_debit = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_credit = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_posted = Column(Boolean, nullable=False, default=True)
    is_cancelled = Column(Boolean, nullable=False, default=False)
    posted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = Column(String(100), nullable=True)

    # Relationships
    entries = relationship("GeneralLedgerEntry", back_populates="voucher", cascade="all, delete-orphan")


class GeneralLedgerEntry(BaseEntity):
    """
    Immutable double-entry General Ledger entry line.
    Every financial event records balancing debit and credit entries.
    """
    __tablename__ = "general_ledger_entries"
    __table_args__ = (
        Index("idx_gl_company_account_date", "company_id", "account_id", "posting_date"),
        Index("idx_gl_company_party", "company_id", "party_id"),
        Index("idx_gl_voucher_id", "voucher_id"),
    )

    voucher_id = Column(String(50), ForeignKey("journal_vouchers.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(String(50), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    party_id = Column(String(50), nullable=True, index=True)
    entry_date = Column(Date, nullable=False, default=date.today)
    posting_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    debit_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    credit_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    currency = Column(String(10), nullable=False, default="INR")
    against_account_id = Column(String(50), nullable=True)
    against_account_name = Column(String(200), nullable=True)
    reference_doc_type = Column(String(50), nullable=True)
    reference_doc_id = Column(String(50), nullable=True)
    remarks = Column(Text, nullable=True)

    # Relationships
    voucher = relationship("JournalVoucher", back_populates="entries")
    account = relationship("Account", back_populates="gl_entries")


class AccountBalanceSnapshot(BaseEntity):
    """
    Periodic running balance snapshot for rapid Trial Balance, P&L, and Balance Sheet generation.
    """
    __tablename__ = "account_balance_snapshots"
    __table_args__ = (
        UniqueConstraint("company_id", "account_id", "period_date", name="uq_account_balance_period"),
        Index("idx_snapshot_company_date", "company_id", "period_date"),
    )

    account_id = Column(String(50), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    period_date = Column(Date, nullable=False)
    opening_debit = Column(Numeric(15, 2), nullable=False, default=0.00)
    opening_credit = Column(Numeric(15, 2), nullable=False, default=0.00)
    closing_debit = Column(Numeric(15, 2), nullable=False, default=0.00)
    closing_credit = Column(Numeric(15, 2), nullable=False, default=0.00)
    net_balance = Column(Numeric(15, 2), nullable=False, default=0.00)
