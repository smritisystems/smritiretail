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
Classification: Promotional Coupon & Discount Engine
"""

from typing import Dict, Any


class PromotionEngine:
    """Promotional Coupon & Cart Discount Rules Evaluator."""

    PROMOTIONS = {
        "WELCOME10": {"type": "PERCENTAGE", "value": 10.0, "min_cart": 50.0},
        "SAVE50": {"type": "FLAT", "value": 50.0, "min_cart": 200.0},
        "FESTIVE20": {"type": "PERCENTAGE", "value": 20.0, "min_cart": 100.0}
    }

    @classmethod
    def apply_coupon(cls, coupon_code: str, cart_total: float) -> Dict[str, Any]:
        code = coupon_code.upper()
        if code not in cls.PROMOTIONS:
            return {"valid": False, "discount_amount": 0.0, "final_total": cart_total, "message": "Invalid coupon code"}

        promo = cls.PROMOTIONS[code]
        if cart_total < promo["min_cart"]:
            return {"valid": False, "discount_amount": 0.0, "final_total": cart_total, "message": f"Minimum cart value of ${promo['min_cart']} required"}

        if promo["type"] == "PERCENTAGE":
            discount = round((cart_total * promo["value"]) / 100.0, 2)
        else:
            discount = min(promo["value"], cart_total)

        final_total = round(max(0.0, cart_total - discount), 2)
        return {
            "valid": True,
            "coupon_code": code,
            "discount_amount": discount,
            "final_total": final_total,
            "message": "Coupon applied successfully"
        }
