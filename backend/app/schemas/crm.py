"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# CustomerGroup schemas
# ---------------------------------------------------------------------------

class CustomerGroupBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    credit_limit: Decimal = Decimal("0.00")
    unlimited_credit: bool = False
    credit_days: int = 0
    grace_days: int = 0
    credit_hold: bool = False
    auto_block_sales: bool = True
    warning_threshold_percent: Decimal = Decimal("80.00")
    allow_override: bool = False
    tax_inclusive: bool = True
    max_discount_percent: Decimal = Decimal("0.00")
    min_margin_percent: Decimal = Decimal("0.00")
    rounding_rule: str = "Nearest1"
    allowed_payment_methods: List[str] = []
    preferred_payment_method: Optional[str] = None
    allow_back_orders: bool = False
    allow_negative_stock_sales: bool = False
    require_po_number: bool = False
    invoice_language: str = "en"
    can_view_price: bool = True
    can_view_margin: bool = False
    can_purchase_on_credit: bool = False
    can_receive_discount: bool = True


class CustomerGroupCreate(CustomerGroupBase):
    id: str = Field(..., max_length=50)


class CustomerGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
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
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# PricingGroup schemas
# ---------------------------------------------------------------------------

class PricingGroupBase(BaseModel):
    """
    Pricing Group controls commercial pricing strategy:
    which price list, discount %, price adjustments, and scheme eligibility.
    """
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    # "mrp" | "cost_price" | "price" | "custom"
    base_price_field: str = Field("price", max_length=30)
    discount_percent: Decimal = Decimal("0.00")
    price_adjustment: Decimal = Decimal("0.00")
    rounding_rule: str = Field("Nearest1", max_length=30)
    max_additional_discount_percent: Decimal = Decimal("0.00")
    tax_inclusive: bool = True
    scheme_eligible: bool = True
    quantity_break_eligible: bool = False
    min_order_value: Decimal = Decimal("0.00")


class PricingGroupCreate(PricingGroupBase):
    id: str = Field(..., max_length=50)


class PricingGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price_field: Optional[str] = None
    discount_percent: Optional[Decimal] = None
    price_adjustment: Optional[Decimal] = None
    rounding_rule: Optional[str] = None
    max_additional_discount_percent: Optional[Decimal] = None
    tax_inclusive: Optional[bool] = None
    scheme_eligible: Optional[bool] = None
    quantity_break_eligible: Optional[bool] = None
    min_order_value: Optional[Decimal] = None


class PricingGroupResponse(PricingGroupBase):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Customer schemas
# ---------------------------------------------------------------------------

class CustomerBase(BaseModel):
    customer_group_id: str = Field(..., max_length=50)
    # Optional: a customer may or may not have a pricing group override
    pricing_group_id: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., max_length=255)
    mobile: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    gst_number: Optional[str] = Field(None, max_length=15)
    outstanding: Decimal = Decimal("0.00")
    status: str = "Active"
    created_date: date = Field(default_factory=date.today)
    tags: List[str] = []

    # Address Details
    billing_address_line1: Optional[str] = Field(None, max_length=255)
    billing_address_line2: Optional[str] = Field(None, max_length=255)
    billing_city: Optional[str] = Field(None, max_length=100)
    billing_state: Optional[str] = Field(None, max_length=100)
    billing_country: Optional[str] = Field("India", max_length=100)
    billing_pincode: Optional[str] = Field(None, max_length=10)

    shipping_same_as_billing: Optional[bool] = True

    shipping_address_line1: Optional[str] = Field(None, max_length=255)
    shipping_address_line2: Optional[str] = Field(None, max_length=255)
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=100)
    shipping_country: Optional[str] = Field(None, max_length=100)
    shipping_pincode: Optional[str] = Field(None, max_length=10)

    additional_addresses: List[dict] = []


class CustomerCreate(CustomerBase):
    id: str = Field(..., max_length=50)


class CustomerUpdate(BaseModel):
    customer_group_id: Optional[str] = None
    pricing_group_id: Optional[str] = None
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    outstanding: Optional[Decimal] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None

    # Address Details
    billing_address_line1: Optional[str] = None
    billing_address_line2: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_country: Optional[str] = None
    billing_pincode: Optional[str] = None
    shipping_same_as_billing: Optional[bool] = None
    shipping_address_line1: Optional[str] = None
    shipping_address_line2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_country: Optional[str] = None
    shipping_pincode: Optional[str] = None
    additional_addresses: Optional[List[dict]] = None


class CustomerResponse(CustomerBase):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)

