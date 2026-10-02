"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.5
* Created    : 2026-07-11
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, field_validator


class SupplierBillAllocation(BaseModel):
    bill_id: str
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Allocation amount must be greater than zero.")
        return v


class SupplierPaymentCreate(BaseModel):
    id:                str
    supplier_id:       str
    amount:            Decimal
    payment_mode:      str = "CASH"     # CASH | BANK_TRANSFER | CHEQUE | UPI
    payment_date:      date
    reference_no:      Optional[str] = None
    notes:             Optional[str] = None
    bill_id:           Optional[str] = None
    allocations:       Optional[List[SupplierBillAllocation]] = None
    auto_allocate:     bool = True
    payment_type:      Optional[str] = "STANDARD"  # STANDARD | ADVANCE
    purchase_order_id: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Payment amount must be greater than zero.")
        return v

    @field_validator("payment_mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        allowed = {"CASH", "BANK_TRANSFER", "CHEQUE", "UPI"}
        if v.upper() not in allowed:
            raise ValueError(f"payment_mode must be one of: {', '.join(sorted(allowed))}")
        return v.upper()


class SupplierPaymentResponse(BaseModel):
    id:                  str
    supplier_id:         str
    amount:              Decimal
    payment_mode:        str
    payment_date:        date
    reference_no:        Optional[str] = None
    notes:               Optional[str] = None
    company_id:          Optional[str] = None
    branch_id:           Optional[str] = None
    is_active:           Optional[bool] = True
    allocated_bills:     Optional[List[Dict[str, Any]]] = None
    journal_voucher_id:  Optional[str] = None
    payment_type:        Optional[str] = "STANDARD"
    purchase_order_id:   Optional[str] = None
    unallocated_amount:  Optional[Decimal] = None

    model_config = {"from_attributes": True}


class SupplierAdvanceKnockoffRequest(BaseModel):
    supplier_id:        str
    advance_payment_id: str
    bill_id:            str
    amount:             Decimal
    notes:              Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Knock-off amount must be greater than zero.")
        return v


class SupplierAdvanceKnockoffResponse(BaseModel):
    voucher_id:                 Optional[str] = None
    journal_voucher_id:         Optional[str] = None
    advance_payment_id:         str
    bill_id:                    str
    amount:                     Decimal
    amount_knocked_off:         Optional[Decimal] = None
    bill_paid_amount:           Decimal
    bill_status:                str
    unallocated_advance:        Decimal
    remaining_advance_balance:  Optional[Decimal] = None
    created_at:                 Optional[datetime] = None

    model_config = {"from_attributes": True}
