"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.13.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from decimal import Decimal
from datetime import date
from typing import Optional
from pydantic import BaseModel, field_validator


class SupplierPaymentCreate(BaseModel):
    id:            str
    supplier_id:   str
    amount:        Decimal
    payment_mode:  str = "CASH"     # CASH | BANK_TRANSFER | CHEQUE | UPI
    payment_date:  date
    reference_no:  Optional[str] = None
    notes:         Optional[str] = None

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
    id:            str
    supplier_id:   str
    amount:        Decimal
    payment_mode:  str
    payment_date:  date
    reference_no:  Optional[str] = None
    notes:         Optional[str] = None
    company_id:    Optional[str] = None
    branch_id:     Optional[str] = None
    model_config = {"from_attributes": True}
