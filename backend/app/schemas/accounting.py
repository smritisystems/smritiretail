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

accounting.py — Pydantic V2 schemas for Chart of Accounts, Journal Vouchers, Ledgers,
Financial Statements, Bank Accounts, Cost Centers, TDS Entries, and Ageing Reports.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChartOfAccountsBase(BaseModel):
    account_code: str = Field(..., max_length=50, description="Account ledger code e.g. 4000-SALES")
    account_name: str = Field(..., max_length=255, description="Human-readable ledger name")
    account_type: str = Field(..., max_length=50, description="ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE")
    balance_type: str = Field("DEBIT", max_length=20, description="DEBIT or CREDIT")
    parent_id: Optional[str] = Field(None, max_length=50)
    currency: str = Field("INR", max_length=10)
    description: Optional[str] = None


class ChartOfAccountsCreate(ChartOfAccountsBase):
    pass


class ChartOfAccountsResponse(ChartOfAccountsBase):
    id: str
    uuid: str
    tenant_id: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    current_balance: Decimal = Decimal("0.00")
    is_system: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class JournalLedgerEntrySchema(BaseModel):
    account_code: str = Field(..., max_length=50)
    account_name: str = Field(..., max_length=255)
    debit: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    credit: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    narration: Optional[str] = None
    cost_center: Optional[str] = None
    project: Optional[str] = None

    @field_validator("credit")
    @classmethod
    def validate_debit_credit(cls, v: Decimal, values) -> Decimal:
        debit = values.data.get("debit", Decimal("0.00"))
        if debit > 0 and v > 0:
            raise ValueError("A journal entry line cannot contain both debit and credit.")
        if debit == 0 and v == 0:
            raise ValueError("A journal entry line must contain either a debit or a credit amount.")
        return v


class JournalVoucherCreate(BaseModel):
    ref_document_type: str = Field(..., max_length=60, description="Source document type e.g. SalesInvoice")
    ref_document_id: str = Field(..., max_length=50, description="Source document ID")
    ref_document_no: str = Field(..., max_length=80, description="Source document number")
    voucher_date: Optional[datetime] = Field(default_factory=datetime.utcnow)
    narration: Optional[str] = None
    entries: List[JournalLedgerEntrySchema] = Field(..., min_items=2)


class JournalLedgerEntryResponse(JournalLedgerEntrySchema):
    id: str
    voucher_id: str
    model_config = ConfigDict(from_attributes=True)


class JournalVoucherResponse(BaseModel):
    id: str
    uuid: str
    tenant_id: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    voucher_no: str
    voucher_date: datetime
    ref_document_type: str
    ref_document_id: str
    ref_document_no: str
    total_debit: Decimal
    total_credit: Decimal
    narration: Optional[str] = None
    status: str
    posted_at: datetime
    entries: List[JournalLedgerEntryResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TrialBalanceItem(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    debit_total: Decimal
    credit_total: Decimal
    net_balance: Decimal


class TrialBalanceResponse(BaseModel):
    as_of_date: str
    total_debit: Decimal
    total_credit: Decimal
    is_balanced: bool
    accounts: List[TrialBalanceItem]


class ProfitLossItem(BaseModel):
    account_code: str
    account_name: str
    amount: Decimal


class ProfitLossResponse(BaseModel):
    start_date: str
    end_date: str
    total_revenue: Decimal
    total_cogs: Decimal
    gross_profit: Decimal
    total_operating_expenses: Decimal
    net_profit: Decimal
    revenues: List[ProfitLossItem]
    expenses: List[ProfitLossItem]


class BalanceSheetResponse(BaseModel):
    as_of_date: str
    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal
    total_liabilities_and_equity: Decimal
    is_balanced: bool
    assets: List[TrialBalanceItem]
    liabilities: List[TrialBalanceItem]
    equity: List[TrialBalanceItem]


# ---------------------------------------------------------------------------
# Bank Account Schemas
# ---------------------------------------------------------------------------

class BankAccountCreate(BaseModel):
    account_name: str = Field(..., max_length=255)
    account_number: str = Field(..., max_length=100)
    bank_name: str = Field(..., max_length=255)
    branch_name: Optional[str] = Field(None, max_length=255)
    ifsc_code: str = Field(..., max_length=20)
    swift_code: Optional[str] = Field(None, max_length=20)
    account_type: str = Field("CURRENT", max_length=50)
    opening_balance: Decimal = Field(Decimal("0.00"))
    currency: str = Field("INR", max_length=10)
    is_default: bool = False
    gl_account_code: Optional[str] = Field(None, max_length=50)


class BankAccountResponse(BankAccountCreate):
    id: str
    company_id: Optional[str] = None
    current_balance: Decimal
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Cost Center Schemas
# ---------------------------------------------------------------------------

class CostCenterCreate(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    is_active: bool = True


class CostCenterResponse(CostCenterCreate):
    id: str
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# TDS Entry Schemas
# ---------------------------------------------------------------------------

class TdsEntryCreate(BaseModel):
    deduction_date: date
    section_code: str = Field(..., max_length=20)
    vendor_id: Optional[str] = Field(None, max_length=50)
    customer_id: Optional[str] = Field(None, max_length=50)
    invoice_ref_no: str = Field(..., max_length=100)
    gross_amount: Decimal = Field(..., ge=Decimal("0.01"))
    tds_rate: Decimal = Field(..., ge=Decimal("0.00"), le=Decimal("100.00"))
    tds_amount: Decimal = Field(..., ge=Decimal("0.00"))


class TdsEntryResponse(TdsEntryCreate):
    id: str
    status: str
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Ageing Report Schemas
# ---------------------------------------------------------------------------

class AgingInvoiceItem(BaseModel):
    invoice_id: str
    invoice_no: str
    customer_id: str
    customer_name: str
    invoice_date: str
    due_date: Optional[str] = None
    outstanding: Decimal
    age_days: int
    aging_bucket: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class ARAgeingBucketTotals(BaseModel):
    current: Decimal = Decimal("0.00")
    days_1_30: Decimal = Decimal("0.00")
    days_31_60: Decimal = Decimal("0.00")
    days_61_90: Decimal = Decimal("0.00")
    over_90_days: Decimal = Decimal("0.00")

    model_config = ConfigDict(from_attributes=True)


class AgeingReportResponse(BaseModel):
    report_type: str                            # AP_AGEING or AR_AGEING
    as_of_date: str
    total_outstanding: Decimal
    total_invoices: int
    bucket_totals: ARAgeingBucketTotals
    items: List[AgingInvoiceItem]

    model_config = ConfigDict(from_attributes=True)


ARAgeingReportResponse = AgeingReportResponse
