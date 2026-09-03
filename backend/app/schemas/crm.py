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

from typing import Any, List, Optional
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import inspect
from sqlalchemy.orm.base import NO_VALUE

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
    credit_limit: Optional[Decimal] = Field(None, alias="creditLimit")
    credit_days: Optional[int] = Field(None, alias="creditDays")
    unlimited_credit: Optional[bool] = Field(None, alias="unlimitedCredit")
    credit_hold: Optional[bool] = Field(None, alias="creditHold")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def map_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "name" not in data and "customer_name" in data:
                data["name"] = data["customer_name"]
            elif "name" not in data and "customerName" in data:
                data["name"] = data["customerName"]
            if "gst_number" not in data and "gstin" in data:
                data["gst_number"] = data["gstin"]
            elif "gst_number" not in data and "gstNumber" in data:
                data["gst_number"] = data["gstNumber"]
        return data

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

def get_loaded_customer_group(customer: Any) -> Optional[Any]:
    """
    Safely retrieve CustomerGroup only if already loaded in-memory.
    Never calls hasattr(customer, 'group') or getattr(customer, 'group')
    as a mechanism for discovering/loading the relationship, preventing MissingGreenlet.
    """
    if isinstance(customer, dict):
        return customer.get("group")

    # Check SQLAlchemy instance state without triggering attribute loaders
    insp = inspect(customer, raiseerr=False)
    if insp is not None and hasattr(insp, "attrs") and "group" in insp.attrs:
        loaded = insp.attrs.group.loaded_value
        if loaded is not NO_VALUE and loaded is not None:
            return loaded
        return None

    # Check instance __dict__ directly to avoid instrumented descriptor triggers
    if hasattr(customer, "__dict__"):
        val = customer.__dict__.get("group")
        if val is not NO_VALUE and val is not None:
            return val

    return None


def map_customer_to_response_dict(customer: Any) -> dict:
    """
    Safely build a dictionary DTO for CustomerResponse validation without
    triggering async lazy loading.
    Authoritative credit policy fields are copied from the eagerly-loaded
    CustomerGroup without attempting dynamic lazy loading.
    """
    if isinstance(customer, dict):
        return customer

    grp = get_loaded_customer_group(customer)

    return {
        "id": customer.id,
        "uuid": str(customer.uuid) if getattr(customer, "uuid", None) else None,
        "customer_group_id": customer.customer_group_id,
        "code": customer.code,
        "name": customer.name,
        "mobile": customer.mobile,
        "email": customer.email,
        "gst_number": customer.gst_number,
        "outstanding": customer.outstanding if customer.outstanding is not None else Decimal("0.00"),
        "status": customer.status if customer.status is not None else "Active",
        "created_date": customer.created_date,
        "tags": list(customer.tags or []),
        "company_id": customer.company_id,
        "branch_id": customer.branch_id,
        "created_at": customer.created_at,
        "modified_at": customer.modified_at,
        "is_active": customer.is_active if customer.is_active is not None else True,
        "is_deleted": customer.is_deleted if customer.is_deleted is not None else False,
        "version": customer.version if customer.version is not None else 1,
        # Sourced authoritatively from eagerly-loaded CustomerGroup
        "credit_limit": grp.credit_limit if grp else None,
        "credit_days": grp.credit_days if grp else None,
        "unlimited_credit": grp.unlimited_credit if grp else None,
        "credit_hold": grp.credit_hold if grp else None,
    }


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

    @classmethod
    def from_orm_customer(cls, customer: Any) -> "Optional[CustomerResponse]":
        """Explicit DTO constructor from Customer ORM model or mapping."""
        if customer is None:
            return None
        return cls.model_validate(map_customer_to_response_dict(customer))

    @model_validator(mode="before")
    @classmethod
    def resolve_customer_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return map_customer_to_response_dict(data)
