"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Sales & POS Core Layer - Multi-Tier Promotional Pricing & Discount Matrix Engine
Conforms to Level 1 SMRITI Architecture Constitution (Rule GR-011 Canonical Ownership: Sales).

Calculates dynamic promotional discounts for POS & E-Commerce checkout:
1. Tiered Volume Slabs: e.g. 1-5 units @ ₹100, 6-10 units @ ₹90, >10 units @ ₹80
2. Buy-X-Get-Y Free: e.g. Buy 2 Get 1 Free (computes free item quantities)
3. Percentage / Flat Cart Discounts & Promo Code Application
"""

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional


class PromotionType(str, Enum):
    TIERED_QUANTITY = "TIERED_QUANTITY"
    BUY_X_GET_Y = "BUY_X_GET_Y"
    FLAT_PERCENT = "FLAT_PERCENT"
    PROMO_CODE = "PROMO_CODE"


@dataclass
class VolumeSlab:
    min_qty: float
    max_qty: float
    unit_price: float


@dataclass
class PromotionRule:
    promo_id: str
    promo_name: str
    promo_type: PromotionType
    sku: Optional[str] = None  # None applies to cart level
    slabs: List[VolumeSlab] = field(default_factory=list)
    buy_qty: int = 0
    get_free_qty: int = 0
    discount_percent: float = 0.0
    promo_code: Optional[str] = None


@dataclass
class CartItem:
    sku: str
    item_name: str
    quantity: float
    regular_unit_price: float


@dataclass
class PricedCartItem:
    sku: str
    item_name: str
    quantity: float
    regular_unit_price: float
    effective_unit_price: float
    free_quantity: float
    gross_total: float
    discount_amount: float
    net_total: float
    applied_promo_name: Optional[str] = None


@dataclass
class CartPricingSummary:
    items: List[PricedCartItem]
    subtotal: float
    total_discount: float
    promo_code_discount: float
    final_payable: float
    total_free_items_qty: float
    applied_promo_code: Optional[str] = None


class PromotionalPricingEngine:
    """
    Canonical Pricing Engine for Retail & POS Promotional Discounts.
    """

    @staticmethod
    def evaluate_cart(
        cart_items: List[CartItem],
        active_promotions: List[PromotionRule],
        promo_code: Optional[str] = None,
    ) -> CartPricingSummary:
        priced_items: List[PricedCartItem] = []
        subtotal = 0.0
        total_discount = 0.0
        total_free_qty = 0.0

        promo_map = {p.sku: p for p in active_promotions if p.sku and p.promo_type != PromotionType.PROMO_CODE}

        for item in cart_items:
            gross = round(item.quantity * item.regular_unit_price, 2)
            subtotal += gross
            effective_price = item.regular_unit_price
            free_qty = 0.0
            item_discount = 0.0
            applied_promo_name = None

            rule = promo_map.get(item.sku)
            if rule:
                if rule.promo_type == PromotionType.TIERED_QUANTITY and rule.slabs:
                    # Find matching slab
                    for slab in sorted(rule.slabs, key=lambda s: s.min_qty):
                        if slab.min_qty <= item.quantity <= slab.max_qty:
                            effective_price = slab.unit_price
                            applied_promo_name = rule.promo_name
                            break

                    item_discount = round(gross - (item.quantity * effective_price), 2)

                elif rule.promo_type == PromotionType.BUY_X_GET_Y and rule.buy_qty > 0:
                    # Buy X Get Y Free calculation
                    num_sets = int(item.quantity // rule.buy_qty)
                    free_qty = float(num_sets * rule.get_free_qty)
                    item_discount = round(free_qty * item.regular_unit_price, 2)
                    applied_promo_name = f"{rule.promo_name} ({free_qty} Free)"
                    total_free_qty += free_qty

                elif rule.promo_type == PromotionType.FLAT_PERCENT and rule.discount_percent > 0:
                    item_discount = round(gross * (rule.discount_percent / 100.0), 2)
                    effective_price = round(gross - item_discount, 2) / item.quantity
                    applied_promo_name = f"{rule.promo_name} ({rule.discount_percent}%)"

            net = round(gross - item_discount, 2)
            total_discount += item_discount

            priced_items.append(
                PricedCartItem(
                    sku=item.sku,
                    item_name=item.item_name,
                    quantity=item.quantity,
                    regular_unit_price=item.regular_unit_price,
                    effective_unit_price=round(effective_price, 2),
                    free_quantity=free_qty,
                    gross_total=gross,
                    discount_amount=item_discount,
                    net_total=net,
                    applied_promo_name=applied_promo_name,
                )
            )

        # Apply Promo Code Discount if valid
        promo_code_discount = 0.0
        applied_code = None
        if promo_code:
            code_rule = next(
                (p for p in active_promotions if p.promo_code and p.promo_code.upper() == promo_code.upper()),
                None,
            )
            if code_rule:
                current_net = subtotal - total_discount
                promo_code_discount = round(current_net * (code_rule.discount_percent / 100.0), 2)
                total_discount += promo_code_discount
                applied_code = code_rule.promo_code.upper()

        final_payable = round(subtotal - total_discount, 2)

        return CartPricingSummary(
            items=priced_items,
            subtotal=round(subtotal, 2),
            total_discount=round(total_discount, 2),
            promo_code_discount=round(promo_code_discount, 2),
            final_payable=max(0.0, final_payable),
            total_free_items_qty=total_free_qty,
            applied_promo_code=applied_code,
        )
