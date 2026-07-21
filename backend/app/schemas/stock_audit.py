"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

stock_audit.py — Pydantic DTO schemas for Physical Stock Audits & Cycle Counting.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class StockCountCreate(BaseModel):
    name: str
    count_type: Optional[str] = "Full"  # Full, Selective, ABC
    product_ids: Optional[List[str]] = None
    notes: Optional[str] = None


class PhysicalCountEntry(BaseModel):
    product_id: str
    physical_count: Decimal


class PhysicalCountsRequest(BaseModel):
    line_counts: List[PhysicalCountEntry]


class StockCountItemResponse(BaseModel):
    id: str
    product_id: str
    system_stock: Decimal
    physical_count: Optional[Decimal] = None
    variance_qty: Decimal
    unit_cost: Decimal
    variance_value: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)


class StockCountResponse(BaseModel):
    id: str
    count_no: str
    name: str
    count_type: str
    status: str
    scheduled_date: datetime
    completed_date: Optional[datetime] = None
    total_items: int
    total_variance_qty: Decimal
    total_variance_value: Decimal
    notes: Optional[str] = None
    items: List[StockCountItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class StockCountReconcileRequest(BaseModel):
    reason: Optional[str] = "Cycle Count Variance Reconciliation"


class StockAdjustmentResponse(BaseModel):
    id: str
    adjustment_no: str
    count_id: str
    adjustment_date: datetime
    reason: str
    total_adjustment_qty: Decimal
    total_adjustment_value: Decimal
    status: str
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
