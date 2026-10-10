"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.119.0
Created      : 2026-10-04
Modified     : 2026-10-04
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ---------- Gift Card ----------

class GiftCardCreate(BaseModel):
    card_no:      Optional[str]     = None
    card_type:    str               = "PHYSICAL"
    face_value:   Decimal           = Decimal("0")
    currency:     str               = "INR"
    issued_to:    Optional[str]     = None
    valid_from:   Optional[datetime]= None
    valid_to:     Optional[datetime]= None
    notes:        Optional[str]     = None

class GiftCardRead(BaseModel):
    id:           str
    card_no:      str
    card_type:    str
    status:       str
    face_value:   Decimal
    balance:      Decimal
    currency:     str
    issued_to:    Optional[str]
    issued_at:    Optional[datetime]
    valid_from:   Optional[datetime]
    valid_to:     Optional[datetime]
    notes:        Optional[str]
    class Config: from_attributes = True

class GiftCardTopup(BaseModel):
    amount:      Decimal
    reference_no: Optional[str] = None
    notes:       Optional[str]  = None

class GiftCardRedeem(BaseModel):
    amount:      Decimal
    reference_no: Optional[str] = None
    pin:         Optional[str]  = None

class GiftCardTransactionRead(BaseModel):
    id:           str
    gift_card_id: str
    txn_type:     str
    amount:       Decimal
    balance_after: Optional[Decimal]
    reference_no: Optional[str]
    performed_by: Optional[str]
    notes:        Optional[str]
    created_at:   Optional[datetime]
    class Config: from_attributes = True


# ---------- Gift Voucher ----------

class GiftVoucherCreate(BaseModel):
    voucher_no:      Optional[str]    = None
    voucher_type:    str              = "FIXED"
    face_value:      Decimal          = Decimal("0")
    pct_discount:    Optional[Decimal]= None
    min_order_value: Optional[Decimal]= None
    max_discount:    Optional[Decimal]= None
    issued_to:       Optional[str]    = None
    valid_from:      Optional[datetime]= None
    valid_to:        Optional[datetime]= None
    notes:           Optional[str]    = None

class GiftVoucherRead(BaseModel):
    id:              str
    voucher_no:      str
    voucher_type:    str
    status:          str
    face_value:      Decimal
    pct_discount:    Optional[Decimal]
    min_order_value: Optional[Decimal]
    max_discount:    Optional[Decimal]
    issued_to:       Optional[str]
    issued_at:       Optional[datetime]
    valid_from:      Optional[datetime]
    valid_to:        Optional[datetime]
    used_at:         Optional[datetime]
    redeemed_invoice_no: Optional[str]
    notes:           Optional[str]
    class Config: from_attributes = True

class GiftVoucherRedeem(BaseModel):
    invoice_no: str
    order_value: Decimal
