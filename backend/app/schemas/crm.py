"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-11
Modified     : 2026-08-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

# Base schema for CustomerGroup
class CustomerGroupBase(BaseModel):
    name: str = Field(..., max_length=100)
    credit_limit: Optional[Decimal] = Decimal("0.00")
    unlimited_credit: Optional[bool] = False
    credit_days: Optional[int] = 0
    grace_days: Optional[int] = 0
    credit_hold: Optional[bool] = False
    auto_block_sales: Optional[bool] = True
    warning_threshold_percent: Optional[Decimal] = Decimal("80.00")
    allow_override: Optional[bool] = False
    tax_inclusive: Optional[bool] = True
    max_discount_percent: Optional[Decimal] = Decimal("0.00")
    min_margin_percent: Optional[Decimal] = Decimal("0.00")
    rounding_rule: Optional[str] = "Nearest1"
    allowed_payment_methods: Optional[List[str]] = []
    preferred_payment_method: Optional[str] = None
    allow_back_orders: Optional[bool] = False
    allow_negative_stock_sales: Optional[bool] = False
    require_po_number: Optional[bool] = False
    invoice_language: Optional[str] = "en"
    can_view_price: Optional[bool] = True
    can_view_margin: Optional[bool] = False
    can_purchase_on_credit: Optional[bool] = False
    can_receive_discount: Optional[bool] = True

class CustomerGroupCreate(CustomerGroupBase):
    id: Optional[str] = Field(None, max_length=50)

class CustomerGroupUpdate(BaseModel):
    name: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    unlimited_credit: Optional[bool] = None
    credit_days: Optional[int] = None
    grace_days: Optional[int] = None
    credit_hold: Optional[bool] = None
    auto_block_sales: Optional[bool] = None
    warning_threshold_percent: Optional[Decimal] = None
    allow_override: Optional[bool] = None
    tax_inclusive: Optional[bool] = None
    max_discount_percent: Optional[Decimal] = None
    min_margin_percent: Optional[Decimal] = None
    rounding_rule: Optional[str] = None
    allowed_payment_methods: Optional[List[str]] = None
    preferred_payment_method: Optional[str] = None
    allow_back_orders: Optional[bool] = None
    allow_negative_stock_sales: Optional[bool] = None
    require_po_number: Optional[bool] = None
    invoice_language: Optional[str] = None
    can_view_price: Optional[bool] = None
    can_view_margin: Optional[bool] = None
    can_purchase_on_credit: Optional[bool] = None
    can_receive_discount: Optional[bool] = None

class CustomerGroupResponse(CustomerGroupBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1

    model_config = ConfigDict(from_attributes=True)

# Base schema for Customer
class CustomerBase(BaseModel):
    customer_group_id: Optional[str] = Field(None, max_length=50, alias="customerGroupId")
    code: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., max_length=255)
    mobile: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    gst_number: Optional[str] = Field(None, max_length=30, alias="gstNumber")
    outstanding: Optional[Decimal] = Decimal("0.00")
    status: Optional[str] = "Active"
    created_date: Optional[date] = Field(default_factory=date.today, alias="createdDate")
    tags: List[str] = []

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class CustomerCreate(CustomerBase):
    id: Optional[str] = Field(None, max_length=50)

class CustomerUpdate(BaseModel):
    customer_group_id: Optional[str] = Field(None, alias="customerGroupId")
    code: Optional[str] = None
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = Field(None, alias="gstNumber")
    outstanding: Optional[Decimal] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class CustomerResponse(CustomerBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
