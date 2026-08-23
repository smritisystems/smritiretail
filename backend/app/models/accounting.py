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
    currency = Column(String(10), nullable=False, default="INR")
    exchange_rate = Column(Numeric(18, 6), nullable=False, default=1.000000)
    total_foreign_debit = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_foreign_credit = Column(Numeric(15, 2), nullable=False, default=0.00)
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
    foreign_currency = Column(String(10), nullable=False, default="INR")
    exchange_rate = Column(Numeric(18, 6), nullable=False, default=1.000000)
    foreign_debit_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    foreign_credit_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
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


class FiscalYear(BaseEntity):
    """
    Authoritative Financial Year tracking statutory accounting bounds and closure status.
    """
    __tablename__ = "fiscal_years"
    __table_args__ = (
        UniqueConstraint("company_id", "financial_year_code", name="uq_fiscal_year_company_code"),
        Index("idx_fiscal_year_dates", "company_id", "start_date", "end_date"),
    )

    financial_year_code = Column(String(20), nullable=False, index=True)  # e.g., FY2026-27
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_closed = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(String(100), nullable=True)

    # Relationships
    periods = relationship("FiscalPeriod", back_populates="fiscal_year", cascade="all, delete-orphan")


class FiscalPeriod(BaseEntity):
    """
    Sub-divided accounting period (e.g. Monthly / Quarterly) enforcing hard backdating lockouts.
    """
    __tablename__ = "fiscal_periods"
    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_year_id", "period_number", name="uq_fiscal_period_comp_fy_num"),
        Index("idx_fiscal_period_dates", "company_id", "start_date", "end_date"),
    )

    fiscal_year_id = Column(String(50), ForeignKey("fiscal_years.id", ondelete="CASCADE"), nullable=False, index=True)
    period_name = Column(String(50), nullable=False)   # e.g. April 2026, M01-2026
    period_number = Column(Integer, nullable=False)     # 1 to 12
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(30), nullable=False, default="OPEN")  # OPEN, SOFT_CLOSED, HARD_LOCKED
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(String(100), nullable=True)

    # Relationships
    fiscal_year = relationship("FiscalYear", back_populates="periods")


class BankStatement(BaseEntity):
    """
    Bank Statement master record for Bank Reconciliation Statement (BRS) processes.
    """
    __tablename__ = "bank_statements"
    __table_args__ = (
        UniqueConstraint("company_id", "bank_account_id", "statement_no", name="uq_bank_statement_comp_acc_no"),
        Index("idx_bank_statement_dates", "company_id", "from_date", "to_date"),
    )

    bank_account_id = Column(String(50), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    statement_no = Column(String(100), nullable=False, index=True)
    statement_date = Column(Date, nullable=False, default=date.today)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    opening_balance = Column(Numeric(15, 2), nullable=False, default=0.00)
    closing_balance = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_reconciled = Column(Boolean, nullable=False, default=False)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    reconciled_by = Column(String(100), nullable=True)

    # Relationships
    bank_account = relationship("Account")
    lines = relationship("BankStatementLine", back_populates="statement", cascade="all, delete-orphan")


class BankStatementLine(BaseEntity):
    """
    Individual transaction line item from an ingested bank statement.
    """
    __tablename__ = "bank_statement_lines"
    __table_args__ = (
        Index("idx_bsl_statement_line", "company_id", "statement_id", "line_number"),
        Index("idx_bsl_reconciliation", "company_id", "reconciliation_status"),
    )

    statement_id = Column(String(50), ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False, default=1)
    transaction_date = Column(Date, nullable=False)
    value_date = Column(Date, nullable=False)
    reference_no = Column(String(100), nullable=True, index=True)
    description = Column(Text, nullable=True)
    deposit_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    withdrawal_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    balance_after_transaction = Column(Numeric(15, 2), nullable=True)
    reconciled_gl_entry_id = Column(String(50), ForeignKey("general_ledger_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    reconciliation_status = Column(String(30), nullable=False, default="UNMATCHED")  # UNMATCHED, AUTO_RECONCILED, MANUALLY_CLEARED, DISPUTED
    cleared_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    statement = relationship("BankStatement", back_populates="lines")
    reconciled_gl_entry = relationship("GeneralLedgerEntry")


class CurrencyExchangeRate(BaseEntity):
    """
    Authoritative currency exchange rates for foreign currency valuation and FX Gain/Loss.
    """
    __tablename__ = "currency_exchange_rates"
    __table_args__ = (
        UniqueConstraint("company_id", "from_currency", "to_currency", "effective_date", "rate_type", name="uq_exchange_rate_comp_pair_date_type"),
        Index("idx_exchange_rate_lookup", "company_id", "from_currency", "to_currency", "effective_date"),
    )

    from_currency = Column(String(10), nullable=False, index=True)   # e.g., USD, EUR, AED, GBP
    to_currency = Column(String(10), nullable=False, default="INR", index=True) # e.g., INR
    exchange_rate = Column(Numeric(18, 6), nullable=False)           # e.g., 83.500000
    effective_date = Column(Date, nullable=False, default=date.today)
    rate_type = Column(String(30), nullable=False, default="SPOT")    # SPOT, CLOSING, AVERAGE
    source = Column(String(100), nullable=False, default="MANUAL")    # MANUAL, RBI, ECB


