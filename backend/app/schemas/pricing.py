"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# PRICE BOOK & ENTRY SCHEMAS
# ============================================================================

class PriceBookCreateRequest(BaseModel):
    name: str = Field(..., max_length=200, description="Price book title e.g. 'Wholesale Tier 1'")
    code: str = Field(..., max_length=50, description="Unique code e.g. 'PB-WHOLESALE-01'")
    currency: str = Field("INR", max_length=10)
    channel: str = Field("RETAIL", description="Sales channel: RETAIL, WHOLESALE, B2B, ECOMMERCE, POS")
    is_default: bool = False
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    status: str = Field("ACTIVE", description="ACTIVE, INACTIVE, ARCHIVED")
    description: Optional[str] = None


class PriceBookUpdateRequest(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    is_default: Optional[bool] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    status: Optional[str] = None
    description: Optional[str] = None


class PriceBookEntryCreateRequest(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    min_quantity: float = Field(1.0, ge=0.0001, description="Minimum order quantity threshold")
    selling_price: float = Field(..., ge=0.0, description="Designated price point for this tier")
    mrp: float = Field(..., ge=0.0, description="Maximum Retail Price baseline")
    cost_price: Optional[float] = Field(None, ge=0.0)


class PriceBookEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    price_book_id: str
    item_id: str
    variant_id: Optional[str] = None
    min_quantity: float
    selling_price: float
    mrp: float
    cost_price: Optional[float] = None


class PriceBookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    currency: str
    is_default: bool
    status: str
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    description: Optional[str] = None
    entries_count: Optional[int] = 0


# ============================================================================
# CUSTOMER PRICE TIER SCHEMAS
# ============================================================================

class CustomerPriceTierCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    price_book_id: Optional[str] = None
    discount_percentage: float = Field(0.0, ge=0.0, le=100.0)
    description: Optional[str] = None


class CustomerPriceTierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    price_book_id: Optional[str] = None
    discount_percentage: float
    description: Optional[str] = None


# ============================================================================
# PRICING RESOLUTION & CALCULATION SCHEMAS
# ============================================================================

class PricingResolutionRequest(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: float = Field(1.0, ge=0.0001)
    price_book_code: Optional[str] = None
    customer_tier_code: Optional[str] = None
    channel: Optional[str] = None
    as_of_date: Optional[datetime] = None


class PricingResolutionResponse(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: float
    base_mrp: float
    base_selling_price: float
    effective_unit_price: float
    line_subtotal: float
    applied_price_book: Optional[str] = None
    applied_tier: Optional[str] = None
    discount_percentage: float
    pricing_source: str = Field(..., description="PRICE_BOOK_VOLUME, CUSTOMER_TIER, VARIANT_MASTER, ITEM_MASTER, PRODUCT_MASTER")
    rule_version: int = 1


class BulkPricingLineItem(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: float = Field(1.0, ge=0.0001)
    custom_discount_percentage: Optional[float] = 0.0


class BulkPricingRequest(BaseModel):
    items: List[BulkPricingLineItem]
    price_book_code: Optional[str] = None
    customer_tier_code: Optional[str] = None
    channel: Optional[str] = None
    as_of_date: Optional[datetime] = None


class BulkPricingResponse(BaseModel):
    lines: List[PricingResolutionResponse]
    total_quantity: float
    total_mrp: float
    total_subtotal: float
    total_savings: float
    applied_price_book: Optional[str] = None
    applied_customer_tier: Optional[str] = None


class PricingSnapshot(BaseModel):
    pricing_engine_version: int = 1
    calculation_timestamp: str
    applied_price_book: Optional[str] = None
    applied_tier: Optional[str] = None
    lines: List[PricingResolutionResponse]
    total_subtotal: float
    total_savings: float
