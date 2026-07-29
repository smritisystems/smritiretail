"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 22.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for Loyalty & Promotions Engine
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict


class CustomerLoyaltyCreate(BaseModel):
    customer_id: str
    customer_name: str


class LoyaltyAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: str
    customer_name: str
    tier: str
    points_balance: int
    total_lifetime_spend: float


class PromotionApplyRequest(BaseModel):
    coupon_code: str
    cart_total: float


class GiftCardRedeemRequest(BaseModel):
    card_number: str
    redeem_amount: float
