"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

stock_transfer.py — Pydantic DTO schemas for Inter-Branch Stock Transfers.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class StockTransferItemCreate(BaseModel):
    product_id: str
    requested_qty: Decimal


class StockTransferCreate(BaseModel):
    source_branch_id: str
    destination_branch_id: str
    items: List[StockTransferItemCreate]
    notes: Optional[str] = None


class StockTransferDispatchReq(BaseModel):
    carrier: Optional[str] = None
    tracking_no: Optional[str] = None


class LineReceiptEntry(BaseModel):
    product_id: str
    received_qty: Decimal


class StockTransferReceiveReq(BaseModel):
    line_receipts: Optional[List[LineReceiptEntry]] = None


class StockTransferItemResponse(BaseModel):
    id: str
    product_id: str
    requested_qty: Decimal
    shipped_qty: Decimal
    received_qty: Decimal
    unit_cost: Decimal
    line_total: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)


class StockTransferResponse(BaseModel):
    id: str
    transfer_no: str
    source_branch_id: str
    destination_branch_id: str
    transfer_date: datetime
    status: str
    carrier: Optional[str] = None
    tracking_no: Optional[str] = None
    total_transfer_qty: Decimal
    total_transfer_value: Decimal
    notes: Optional[str] = None
    items: List[StockTransferItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class StockTransferShipmentResponse(BaseModel):
    id: str
    shipment_no: str
    transfer_id: str
    dispatch_date: datetime
    receipt_date: Optional[datetime] = None
    carrier: Optional[str] = None
    tracking_no: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)
