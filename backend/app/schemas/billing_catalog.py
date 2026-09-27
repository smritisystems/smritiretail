"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-27
Modified     : 2026-09-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Billing Catalog & Customer Exposure Schemas (Phase 3 & 4)
"""

from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class CategoryFacet(BaseModel):
    name: str
    count: int


class BillingProductItem(BaseModel):
    id: str
    code: str
    name: str
    category: str
    brand: Optional[str] = None
    mrp: Decimal = Decimal("0.00")
    price: Decimal = Decimal("0.00")
    stock: int = 0
    unit: str = "Pair"
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    gst_rate: Decimal = Decimal("0.00")
    hsn_code: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class BillingCatalogResponse(BaseModel):
    items: List[BillingProductItem]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    categories: List[CategoryFacet]
    brands: List[str]


class BillingCustomerItem(BaseModel):
    id: str
    code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    credit_limit: Decimal = Decimal("0.00")
    balance: Decimal = Decimal("0.00")
    available_credit: Decimal = Decimal("0.00")
    status: str = "Active"
    address: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class BillingCustomerListResponse(BaseModel):
    items: List[BillingCustomerItem]
    total_count: int
