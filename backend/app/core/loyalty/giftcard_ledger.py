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
Classification: Digital Gift Card & Store Credit Ledger
"""

import uuid
from typing import Dict, Any


class GiftCardRecord:
    def __init__(self, card_id: str, card_number: str, initial_balance: float):
        self.id = card_id
        self.card_number = card_number
        self.balance_amount = initial_balance
        self.status = "ACTIVE"

    def redeem(self, amount: float) -> bool:
        if self.status == "ACTIVE" and self.balance_amount >= amount:
            self.balance_amount -= amount
            if self.balance_amount == 0.0:
                self.status = "EXHAUSTED"
            return True
        return False


class GiftCardLedger:
    """Digital Gift Card & Store Credit Ledger Engine."""

    _cards: Dict[str, GiftCardRecord] = {}

    @classmethod
    def issue_card(cls, card_number: str, initial_balance: float) -> GiftCardRecord:
        card_id = str(uuid.uuid4())
        rec = GiftCardRecord(card_id, card_number, initial_balance)
        cls._cards[card_number] = rec
        return rec

    @classmethod
    def redeem_card(cls, card_number: str, amount: float) -> Dict[str, Any]:
        if card_number not in cls._cards:
            return {"success": False, "message": "Gift card not found"}

        card = cls._cards[card_number]
        ok = card.redeem(amount)
        return {
            "success": ok,
            "card_number": card_number,
            "redeemed_amount": amount if ok else 0.0,
            "remaining_balance": card.balance_amount,
            "status": card.status
        }
