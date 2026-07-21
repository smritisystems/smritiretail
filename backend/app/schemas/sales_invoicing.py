"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

sales_invoicing.py — Pydantic DTO schemas for Outbound Customer Invoicing & Payment Settlement.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class SalesInvoiceItemResponse(BaseModel):
    id: str
    product_id: str
    quantity: Decimal
    unit_price: Decimal
    gst_percentage: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class SalesInvoiceResponse(BaseModel):
    id: str
    invoice_no: str
    order_id: Optional[str] = None
    customer_id: str
    invoice_date: datetime
    due_date: Optional[datetime] = None
    subtotal: Decimal
    tax_total: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    grand_total: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    status: str
    items: List[SalesInvoiceItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SalesPaymentCreate(BaseModel):
    invoice_id: str
    amount: Decimal
    payment_mode: str  # CASH, CARD, UPI, CREDIT
    reference_no: Optional[str] = None
    notes: Optional[str] = None


class SalesPaymentResponse(BaseModel):
    id: str
    payment_no: str
    invoice_id: str
    customer_id: str
    payment_date: datetime
    payment_mode: str
    amount: Decimal
    reference_no: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerStatementResponse(BaseModel):
    customer_id: str
    customer_name: str
    customer_code: str
    total_invoices: int
    total_billed: float
    total_paid: float
    total_due: float
    current_outstanding: float

    model_config = ConfigDict(from_attributes=True)
