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
Classification: Customer Loyalty & Promotions REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body

from app.core.loyalty.loyalty_manager import LoyaltyManager
from app.core.loyalty.promotion_engine import PromotionEngine
from app.core.loyalty.giftcard_ledger import GiftCardLedger

router = APIRouter(prefix="/loyalty", tags=["Domain Release: Customer Loyalty & Promotions Engine (v22.0.0)"])


@router.post("/accounts")
async def get_or_create_loyalty_account(customer_id: str = Body(...), customer_name: str = Body(...)):
    """Gets or registers a customer loyalty account."""
    acc = LoyaltyManager.get_or_create_account(customer_id, customer_name)
    return acc.to_dict()


@router.post("/promotions/apply")
async def apply_promotion_coupon(coupon_code: str = Body(...), cart_total: float = Body(...)):
    """Validates and applies a coupon code promotion."""
    return PromotionEngine.apply_coupon(coupon_code, cart_total)


@router.post("/giftcards/issue")
async def issue_gift_card(card_number: str = Body(...), initial_balance: float = Body(...)):
    """Issues a new digital gift card."""
    card = GiftCardLedger.issue_card(card_number, initial_balance)
    return {"card_number": card.card_number, "balance": card.balance_amount, "status": card.status}


@router.post("/giftcards/redeem")
async def redeem_gift_card(card_number: str = Body(...), amount: float = Body(...)):
    """Redeems funds from a digital gift card."""
    return GiftCardLedger.redeem_card(card_number, amount)
