"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 10.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

pos.py — Pydantic DTO schemas for POS Counter Sales, Cash Drawer Sessions, and Offline Sync.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class PosSessionOpenReq(BaseModel):
    cashier_id: str
    terminal_id: str
    opening_balance: Optional[Decimal] = Decimal("0.00")


class PosSessionResponse(BaseModel):
    id: str
    session_no: str
    cashier_id: str
    terminal_id: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    opening_balance: Decimal
    total_cash_sales: Decimal
    total_card_sales: Decimal
    total_upi_sales: Decimal
    total_sales: Decimal
    expected_cash: Decimal
    actual_cash_count: Optional[Decimal] = None
    cash_variance: Optional[Decimal] = Decimal("0.00")
    status: str
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PosCheckoutItemReq(BaseModel):
    product_id: str
    quantity: Decimal
    unit_price: Optional[Decimal] = None


class PosCheckoutReq(BaseModel):
    items: List[PosCheckoutItemReq]
    payment_method: Optional[str] = "CASH"
    tendered_amount: Optional[Decimal] = Decimal("0.00")
    customer_id: Optional[str] = None
    client_tx_uuid: Optional[str] = None
    discount_amount: Optional[Decimal] = Decimal("0.00")


class PosTransactionItemResponse(BaseModel):
    id: str
    product_id: str
    product_code: str
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class PosTransactionResponse(BaseModel):
    id: str
    session_id: str
    receipt_no: str
    client_tx_uuid: Optional[str] = None
    customer_id: Optional[str] = None
    subtotal: Decimal
    discount_amount: Decimal
    grand_total: Decimal
    payment_method: str
    tendered_amount: Decimal
    change_due: Decimal
    status: str
    transaction_time: datetime
    items: List[PosTransactionItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PosSessionCloseReq(BaseModel):
    actual_cash_count: Decimal
    notes: Optional[str] = None


class PosOfflineSyncItem(BaseModel):
    client_tx_uuid: str
    terminal_id: str
    cashier_id: Optional[str] = "OFFLINE_CASHIER"
    items: List[PosCheckoutItemReq]
    payment_method: Optional[str] = "CASH"
    tendered_amount: Optional[Decimal] = Decimal("0.00")
    customer_id: Optional[str] = None


class PosOfflineSyncBatchReq(BaseModel):
    items: List[PosOfflineSyncItem]


class PosOfflineSyncResultItem(BaseModel):
    client_tx_uuid: str
    status: str
    transaction_id: Optional[str] = None
    error: Optional[str] = None
