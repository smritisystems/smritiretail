"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 9.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

replenishment.py — Pydantic DTO schemas for Automated Replenishment & Reorder Suggestions.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class ReorderSuggestionResponse(BaseModel):
    product_id: str
    product_code: str
    product_name: str
    current_stock: Decimal
    reserved_stock: Decimal
    reorder_level: Decimal
    target_stock: Decimal
    suggested_qty: Decimal
    preferred_vendor_id: Optional[str] = None
    unit_price: Decimal
    estimated_cost: Decimal


class ReplenishmentItemCreate(BaseModel):
    product_id: str
    suggested_qty: Decimal
    preferred_vendor_id: Optional[str] = None
    current_stock: Optional[Decimal] = Decimal("0.0000")
    reorder_level: Optional[Decimal] = Decimal("0.0000")
    unit_price: Decimal


class ReplenishmentPlanCreate(BaseModel):
    name: str
    items: List[ReplenishmentItemCreate]
    notes: Optional[str] = None


class ReplenishmentItemResponse(BaseModel):
    id: str
    product_id: str
    preferred_vendor_id: Optional[str] = None
    current_stock: Decimal
    reorder_level: Decimal
    suggested_qty: Decimal
    unit_price: Decimal
    line_total: Decimal
    purchase_order_id: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class ReplenishmentPlanResponse(BaseModel):
    id: str
    plan_no: str
    name: str
    plan_date: datetime
    status: str
    total_items: int
    total_estimated_cost: Decimal
    notes: Optional[str] = None
    items: List[ReplenishmentItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ConvertedPurchaseOrderSummary(BaseModel):
    id: str
    order_no: str
    supplier_id: str
    grand_total: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)
