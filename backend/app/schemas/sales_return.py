"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

sales_return.py — Pydantic DTO schemas for Outbound Customer Sales Returns & Credit Notes.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class SalesReturnItemCreate(BaseModel):
    product_id: str
    quantity: Decimal
    condition: Optional[str] = "Restockable"  # Restockable, Damaged


class SalesReturnCreate(BaseModel):
    invoice_id: str
    reason: Optional[str] = None
    items: List[SalesReturnItemCreate]


class SalesReturnItemResponse(BaseModel):
    id: str
    product_id: str
    quantity: Decimal
    unit_price: Decimal
    condition: str
    gst_percentage: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class SalesReturnResponse(BaseModel):
    id: str
    return_no: str
    invoice_id: str
    customer_id: str
    return_date: datetime
    reason: Optional[str] = None
    status: str
    refund_amount: Decimal
    credit_note_id: Optional[str] = None
    items: List[SalesReturnItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class LineConditionItem(BaseModel):
    product_id: str
    condition: str  # Restockable, Damaged


class ReturnEvaluationRequest(BaseModel):
    line_conditions: Optional[List[LineConditionItem]] = None


class CreditNoteResponse(BaseModel):
    id: str
    credit_note_no: str
    return_id: str
    invoice_id: str
    customer_id: str
    issue_date: datetime
    subtotal: Decimal
    tax_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    grand_total: Decimal
    status: str
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
