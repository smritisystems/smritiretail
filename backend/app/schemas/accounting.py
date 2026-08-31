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

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import date, datetime


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_code: str
    account_name: str
    account_type: str
    root_type: str
    parent_account_id: Optional[str] = None
    is_group: bool
    currency: str
    is_active: bool
    is_system: bool
    party_type: Optional[str] = None


class JournalVoucherLineCreate(BaseModel):
    account_id: Optional[str] = None
    account_code: Optional[str] = None
    party_id: Optional[str] = None
    debit_amount: Decimal = Decimal("0.00")
    credit_amount: Decimal = Decimal("0.00")
    foreign_currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    foreign_debit_amount: Decimal = Decimal("0.00")
    foreign_credit_amount: Decimal = Decimal("0.00")
    against_account_id: Optional[str] = None
    against_account_name: Optional[str] = None
    remarks: Optional[str] = None


class JournalVoucherCreate(BaseModel):
    voucher_type: str = "JOURNAL"
    voucher_date: date = Field(default_factory=date.today)
    currency: str = "INR"
    exchange_rate: Optional[Decimal] = None
    lines: List[JournalVoucherLineCreate]
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    reference_doc_no: Optional[str] = None
    narration: Optional[str] = None


class JournalVoucherResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    voucher_no: str
    voucher_type: str
    voucher_date: date
    posting_date: datetime
    currency: str
    exchange_rate: Decimal
    total_foreign_debit: Decimal
    total_foreign_credit: Decimal
    total_debit: Decimal
    total_credit: Decimal
    is_posted: bool
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    reference_doc_no: Optional[str] = None
    narration: Optional[str] = None


class TrialBalanceItem(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    root_type: str
    total_debit: float
    total_credit: float
    net_balance: float


class TrialBalanceResponse(BaseModel):
    company_id: str
    as_of_date: str
    grand_total_debit: float
    grand_total_credit: float
    is_balanced: bool
    accounts: List[TrialBalanceItem]


class ProfitAndLossItem(BaseModel):
    account_code: str
    account_name: str
    amount: float


class ProfitAndLossResponse(BaseModel):
    company_id: str
    from_date: Optional[str] = None
    to_date: str
    total_revenue: float
    total_expense: float
    net_profit: float
    revenue_items: List[ProfitAndLossItem]
    expense_items: List[ProfitAndLossItem]


class BankStatementLineCreate(BaseModel):
    transaction_date: date
    value_date: Optional[date] = None
    reference_no: Optional[str] = None
    description: Optional[str] = None
    deposit_amount: Decimal = Decimal("0.00")
    withdrawal_amount: Decimal = Decimal("0.00")
    balance_after_transaction: Optional[Decimal] = None


class BankStatementImportRequest(BaseModel):
    bank_account_id: str
    statement_no: str
    from_date: date
    to_date: date
    opening_balance: Decimal = Decimal("0.00")
    closing_balance: Decimal = Decimal("0.00")
    statement_date: Optional[date] = None
    lines: List[BankStatementLineCreate]


class BankStatementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bank_account_id: str
    statement_no: str
    statement_date: date
    from_date: date
    to_date: date
    opening_balance: Decimal
    closing_balance: Decimal
    is_reconciled: bool


class BankReconciliationStatementResponse(BaseModel):
    company_id: str
    bank_account_id: str
    as_of_date: str
    book_balance: float
    bank_statement_balance: float
    uncredited_deposits: float
    unpresented_cheques: float
    reconciled_balance: float
    difference: float
    is_balanced: bool


class FiscalYearCreate(BaseModel):
    start_date: date
    end_date: date
    code: Optional[str] = None


class FiscalPeriodLockRequest(BaseModel):
    lock_status: str = "HARD_LOCKED"
    closed_by: Optional[str] = "admin"


class BalanceSnapshotRequest(BaseModel):
    period_date: date = Field(default_factory=date.today)


class CurrencyExchangeRateCreate(BaseModel):
    from_currency: str
    to_currency: str = "INR"
    exchange_rate: Decimal
    effective_date: Optional[date] = None
    rate_type: str = "SPOT"
    source: str = "MANUAL"


class CurrencyExchangeRateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    from_currency: str
    to_currency: str
    exchange_rate: Decimal
    effective_date: date
    rate_type: str
    source: str


class UnrealizedRevaluationRequest(BaseModel):
    as_of_date: date = Field(default_factory=date.today)
    closing_rates: Dict[str, Decimal]


class UnrealizedRevaluationResponse(BaseModel):
    company_id: str
    as_of_date: str
    total_unrealized_gain: float
    total_unrealized_loss: float
    revaluation_voucher_id: Optional[str] = None
    revaluation_voucher_no: Optional[str] = None
