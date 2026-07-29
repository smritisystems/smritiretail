"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

franchise_royalty.py — Franchise & Multi-Store Royalty Settlement Engine
Conforms to Level 1 SMRITI Architecture Constitution (ADR-003 & Rule GR-001).
"""

from typing import Dict, Any
from decimal import Decimal

class FranchiseRoyaltyService:
    """Service calculating franchise store royalty and settlement ledger notes."""

    @staticmethod
    def calculate_store_royalty(
        gross_sales: Decimal,
        royalty_percentage: Decimal = Decimal("5.00"),
        marketing_fund_percentage: Decimal = Decimal("1.50")
    ) -> Dict[str, Any]:
        """
        Computes store royalty fee, marketing levy, and net payout.
        """
        sales_val = Decimal(str(gross_sales))
        royalty_fee = (sales_val * (royalty_percentage / Decimal("100"))).quantize(Decimal("0.01"))
        marketing_levy = (sales_val * (marketing_fund_percentage / Decimal("100"))).quantize(Decimal("0.01"))
        total_deductions = royalty_fee + marketing_levy
        net_payable_to_franchise = sales_val - total_deductions

        return {
            "gross_sales": sales_val,
            "royalty_percentage": royalty_percentage,
            "royalty_fee": royalty_fee,
            "marketing_fund_percentage": marketing_fund_percentage,
            "marketing_levy": marketing_levy,
            "total_deductions": total_deductions,
            "net_payable_to_franchise": net_payable_to_franchise
        }
