# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 4.7.0
# Modified     : 2026-07-20
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

from typing import List, Optional
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict


# --- StockDispatchLine Schemas ---

class StockDispatchLineBase(BaseModel):
    product_id: str = Field(..., max_length=50)
    sku: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    qty_sent: Decimal
    rate: Decimal
    gst_rate: Decimal = Decimal("18.00")


class StockDispatchLineCreate(StockDispatchLineBase):
    pass


class StockDispatchLineResponse(StockDispatchLineBase):
    id: str
    dispatch_id: str
    qty_invoiced: Decimal
    qty_returned: Decimal
    qty_on_hand: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    tenant_id: str

    model_config = ConfigDict(from_attributes=True)


# --- StockDispatch Schemas ---

class StockDispatchBase(BaseModel):
    dispatch_type: str = Field(..., max_length=30) # CONSIGNMENT | APPROVAL | BRANCH | NORMAL
    partner_id: Optional[str] = Field(None, max_length=50)
    dispatch_date: date = Field(default_factory=date.today)
    notes: Optional[str] = None


class StockDispatchCreate(StockDispatchBase):
    items: List[StockDispatchLineCreate]


class StockDispatchResponse(StockDispatchBase):
    id: str
    dispatch_no: str
    status: str
    invoice_id: Optional[str] = None
    tax_total: Decimal
    grand_total: Decimal
    tenant_id: str
    items: List[StockDispatchLineResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- DispatchApprovalEvent Schemas ---

class DispatchApprovalEventBase(BaseModel):
    dispatch_id: str = Field(..., max_length=50)
    action: str = Field(..., max_length=50)
    qty: Decimal
    reason: Optional[str] = None


class DispatchApprovalEventResponse(DispatchApprovalEventBase):
    id: str
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    tenant_id: str

    model_config = ConfigDict(from_attributes=True)
