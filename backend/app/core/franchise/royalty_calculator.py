"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 21.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Royalty & Revenue Share Calculator
"""

from typing import Dict, Any


class RoyaltyCalculator:
    """Automated Royalty & Platform Fee Calculator."""

    @staticmethod
    def calculate_royalty(store_code: str, gross_sales: float, royalty_pct: float = 5.0, tech_fee: float = 250.0) -> Dict[str, Any]:
        royalty_amt = round((gross_sales * royalty_pct) / 100.0, 2)
        total_due = round(royalty_amt + tech_fee, 2)

        return {
            "store_code": store_code,
            "gross_sales": gross_sales,
            "royalty_percentage": royalty_pct,
            "royalty_amount": royalty_amt,
            "tech_fee": tech_fee,
            "total_due_to_headquarters": total_due
        }
