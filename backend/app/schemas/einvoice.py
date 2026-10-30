"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 3.120.0
Created      : 2026-10-04
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
"""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any, Dict
from pydantic import BaseModel


class EInvoiceRead(BaseModel):
    id:             str
    invoice_id:     str
    invoice_no:     str
    gstin_supplier: Optional[str]
    gstin_buyer:    Optional[str]
    invoice_date:   Optional[datetime]
    invoice_value:  Optional[Decimal]
    irn:            Optional[str]
    ack_no:         Optional[str]
    ack_date:       Optional[datetime]
    status:         str
    cancel_reason:  Optional[str]
    cancel_remark:  Optional[str]
    cancelled_at:   Optional[datetime]
    retry_count:    int
    error_detail:   Optional[str]
    created_at:     Optional[datetime]
    class Config: from_attributes = True


class EInvoiceGenerate(BaseModel):
    invoice_id:     str
    invoice_no:     str
    gstin_supplier: Optional[str] = None
    gstin_buyer:    Optional[str] = None
    invoice_date:   Optional[datetime] = None
    invoice_value:  Optional[Decimal]  = None
    payload:        Optional[Dict[str, Any]] = None   # raw IRP JSON payload


class EInvoiceCancel(BaseModel):
    irn:          str
    cancel_reason: str   # 1=Duplicate, 2=Data Entry Mistake, 3=Order Cancelled, 4=Others
    cancel_remark: Optional[str] = None


class EInvoiceBatchRead(BaseModel):
    id:             str
    batch_no:       str
    status:         str
    total_invoices: int
    success_count:  int
    failed_count:   int
    submitted_by:   Optional[str]
    completed_at:   Optional[datetime]
    notes:          Optional[str]
    created_at:     Optional[datetime]
    class Config: from_attributes = True


class EInvoiceBatchCreate(BaseModel):
    invoice_ids: List[str]
    notes:       Optional[str] = None
