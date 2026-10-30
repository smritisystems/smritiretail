"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.52.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Statutory Compliance / Taxation DTOs
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class Challan281Create(BaseModel):
    """Payload to record government TDS remittance via Challan ITNS 281."""
    challan_no: str = Field(..., min_length=1, max_length=20, description="Challan serial number / CIN (e.g. 00142)")
    bsr_code: str = Field(..., min_length=7, max_length=7, description="7-digit BSR code of depositing bank branch")
    challan_date: date = Field(..., description="Date of tax deposit")
    tender_date: Optional[date] = Field(None, description="Date of payment submission")
    tax_amount: Decimal = Field(..., ge=0, description="Basic TDS amount discharged (debited from Account 2030)")
    surcharge: Decimal = Field(default=Decimal("0.00"), ge=0, description="Surcharge component")
    cess: Decimal = Field(default=Decimal("0.00"), ge=0, description="Health & Education Cess component")
    interest: Decimal = Field(default=Decimal("0.00"), ge=0, description="Interest under Section 201(1A) (debited to 5090)")
    fee: Decimal = Field(default=Decimal("0.00"), ge=0, description="Late filing fee under Section 234E (debited to 5090)")
    penalty: Decimal = Field(default=Decimal("0.00"), ge=0, description="Penalty under Section 271C (debited to 5090)")
    minor_head: str = Field(default="200", description="200 for TDS Payable by Taxpayer, 400 for Regular Assessment")
    financial_year: str = Field(default="2026-27", description="Financial Year (e.g. 2026-27)")
    quarter: str = Field(default="Q2", description="Quarter: Q1 | Q2 | Q3 | Q4")
    tds_section: str = Field(default="194Q", description="TDS Section code: 194Q | 194C | 194J | 194H | ALL")
    cheque_dd_no: Optional[str] = Field(None, description="Cheque / Draft / UTR reference number")
    bank_name: Optional[str] = Field(default="State Bank of India", description="Bank name where tax deposited")
    bank_account_code: str = Field(default="1020", description="COA Account Code to credit (1020 Bank or 1010 Cash)")
    narration: Optional[str] = Field(None, description="Voucher narration")
    linked_bill_ids: Optional[List[str]] = Field(default=None, description="List of purchase bills allocated to this Challan")

    @field_validator("bsr_code")
    @classmethod
    def validate_bsr_code(cls, v: str) -> str:
        clean = v.strip()
        if not clean.isdigit() or len(clean) != 7:
            raise ValueError("BSR code must be exactly 7 numeric digits.")
        return clean

    @field_validator("quarter")
    @classmethod
    def validate_quarter(cls, v: str) -> str:
        q = v.strip().upper()
        if q not in ("Q1", "Q2", "Q3", "Q4"):
            raise ValueError("Quarter must be one of: Q1, Q2, Q3, Q4.")
        return q


class Challan281Response(BaseModel):
    """Response representing a recorded Challan 281 voucher."""
    id: str
    voucher_id: str
    voucher_no: str
    challan_no: str
    bsr_code: str
    challan_date: str
    tender_date: Optional[str] = None
    tax_amount: float
    surcharge: float
    cess: float
    interest: float
    fee: float
    penalty: float
    total_amount: float
    minor_head: str
    financial_year: str
    quarter: str
    tds_section: str
    cheque_dd_no: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_code: str
    is_cancelled: bool = False
    created_at: str
    narration: Optional[str] = None
    linked_bill_ids: Optional[List[str]] = None
