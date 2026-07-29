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
"""

from decimal import Decimal
from app.services.franchise_royalty import FranchiseRoyaltyService

def test_franchise_royalty_calculation():
    settlement = FranchiseRoyaltyService.calculate_store_royalty(
        Decimal("100000.00"), Decimal("5.00"), Decimal("1.50")
    )

    assert settlement["gross_sales"] == Decimal("100000.00")
    assert settlement["royalty_fee"] == Decimal("5000.00")  # 5% of 100k
    assert settlement["marketing_levy"] == Decimal("1500.00")  # 1.5% of 100k
    assert settlement["total_deductions"] == Decimal("6500.00")
    assert settlement["net_payable_to_franchise"] == Decimal("93500.00")
