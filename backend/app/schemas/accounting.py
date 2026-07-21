"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

accounting.py — Pydantic V2 schemas for Chart of Accounts, Journal Vouchers, Ledgers, and Financial Statements.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
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
