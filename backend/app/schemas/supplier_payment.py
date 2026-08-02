"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
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
