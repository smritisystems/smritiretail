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
# CAMPAIGN & RULE SCHEMAS
# ============================================================================

class PromotionCampaignCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    promo_code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    min_order_amount: float = Field(0.0, ge=0.0)
    max_discount_amount: Optional[float] = Field(None, ge=0.0)
    usage_limit: Optional[int] = Field(None, ge=1)
    per_customer_limit: int = Field(1, ge=1)
    applicable_stores: List[str] = Field(default_factory=list)
    applicable_channels: List[str] = Field(default_factory=list)  # POS, ECOMMERCE, MOBILE_APP, B2B
    customer_eligibility: Dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(10, ge=1, description="Lower number = higher priority")
    is_exclusive: bool = False
    allow_stacking: bool = False
    max_stacked_discount_percent: float = Field(50.0, ge=0.0, le=100.0)
    allow_combine_with_loyalty: bool = True
    allow_combine_with_referral: bool = True
    is_active: bool = True


class PromotionCampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    promo_code: Optional[str] = None
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    min_order_amount: float
    max_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    per_customer_limit: int
    priority: int
    is_exclusive: bool
    allow_stacking: bool
    max_stacked_discount_percent: float
    allow_combine_with_loyalty: bool
    is_active: bool


class PromotionRuleCreateRequest(BaseModel):
    rule_type: str = Field(..., description="PERCENTAGE, FIXED_DISCOUNT, BUY_X_GET_Y, BUY_X_AT_PRICE, BUNDLE")
    discount_percent: float = Field(0.0, ge=0.0, le=100.0)
    discount_fixed_amount: float = Field(0.0, ge=0.0)
    special_price: float = Field(0.0, ge=0.0)
    buy_quantity: int = Field(1, ge=1)
    get_quantity: int = Field(0, ge=0)
    bundle_offer_details: Dict[str, Any] = Field(default_factory=dict)
    product_eligibility: Dict[str, Any] = Field(default_factory=dict)  # {"product_ids": [], "category_ids": []}
    is_active: bool = True


class PromotionRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    campaign_id: str
    rule_type: str
    discount_percent: float
    discount_fixed_amount: float
    special_price: float
    buy_quantity: int
    get_quantity: int
    bundle_offer_details: Dict[str, Any] = Field(default_factory=dict)
    product_eligibility: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool


# ============================================================================
# COUPON SCHEMAS
# ============================================================================

class CouponCreateRequest(BaseModel):
    campaign_id: str
    code: str = Field(..., max_length=50)
    usage_limit: int = Field(100, ge=1)


class CouponResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    campaign_id: str
    code: str
    usage_limit: int
    usage_count: int
    is_active: bool


# ============================================================================
# EVALUATION & REDEMPTION SCHEMAS
# ============================================================================

class PromotionCartItem(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    product_name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    unit_price: float = Field(..., ge=0.0)
    quantity: float = Field(1.0, ge=0.0001)


class PromotionEvaluationRequest(BaseModel):
    items: List[PromotionCartItem]
    campaign_id: Optional[str] = None
    campaign_ids: Optional[List[str]] = None
    campaign_code: Optional[str] = None
    coupon_code: Optional[str] = None
    customer_id: Optional[str] = None
    customer_tier: Optional[str] = None
    store_id: Optional[str] = None
    channel: str = Field("POS", description="POS, ECOMMERCE, MOBILE_APP, B2B")
    as_of_date: Optional[datetime] = None


class AppliedPromotionDetail(BaseModel):
    campaign_id: str
    campaign_name: str
    rule_type: str
    coupon_id: Optional[str] = None
    coupon_code: Optional[str] = None
    discount_amount: float
    is_exclusive: bool
    free_items_granted: List[Dict[str, Any]] = Field(default_factory=list)
    narration: str


class PromotionEvaluationResponse(BaseModel):
    gross_cart_total: float
    total_promotional_discount: float
    net_cart_total: float
    applied_promotions: List[AppliedPromotionDetail]
    rejected_promotions_count: int
    conflict_resolution_strategy: str = Field("BEST_BENEFIT", description="EXCLUSIVE_OVERRIDE, BEST_BENEFIT, HIGHEST_PRIORITY")
    allow_combine_with_loyalty: bool = True


class PromotionRedemptionRequest(BaseModel):
    campaign_id: str
    coupon_id: Optional[str] = None
    customer_id: Optional[str] = None
    reference_invoice_id: str
    discount_applied: float = Field(..., ge=0.0)
    conflict_resolution_strategy: str = "BEST_BENEFIT"


class PromotionRedemptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    campaign_id: str
    coupon_id: Optional[str] = None
    customer_id: Optional[str] = None
    reference_invoice_id: str
    discount_applied: float
    conflict_resolution_strategy: str
    status: str = "RECORDED"
