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
Classification: Tiered Loyalty Program Manager
"""

import uuid
from typing import Dict, Any


class CustomerLoyaltyRecord:
    def __init__(self, record_id: str, customer_id: str, customer_name: str):
        self.id = record_id
        self.customer_id = customer_id
        self.customer_name = customer_name
        self.tier = "BRONZE"
        self.points_balance = 0
        self.total_lifetime_spend = 0.0

    def add_spend(self, spend_amount: float) -> int:
        self.total_lifetime_spend += spend_amount
        # Earn 1 point per $10 spend
        earned_points = int(spend_amount // 10)
        self.points_balance += earned_points

        # Evaluate tier upgrades
        if self.total_lifetime_spend >= 10000.0:
            self.tier = "PLATINUM"
        elif self.total_lifetime_spend >= 5000.0:
            self.tier = "GOLD"
        elif self.total_lifetime_spend >= 1000.0:
            self.tier = "SILVER"

        return earned_points

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name,
            "tier": self.tier,
            "points_balance": self.points_balance,
            "total_lifetime_spend": self.total_lifetime_spend
        }


class LoyaltyManager:
    """Tiered Loyalty Program Manager (Bronze, Silver, Gold, Platinum)."""

    _accounts: Dict[str, CustomerLoyaltyRecord] = {}

    @classmethod
    def get_or_create_account(cls, customer_id: str, customer_name: str) -> CustomerLoyaltyRecord:
        if customer_id not in cls._accounts:
            rec_id = str(uuid.uuid4())
            cls._accounts[customer_id] = CustomerLoyaltyRecord(rec_id, customer_id, customer_name)
        return cls._accounts[customer_id]
