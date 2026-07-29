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
Classification: Pytest Suite for Domain Release Phase 27 Franchise Engine

test_franchise_engine.py — Integration test suite for Multi-Store Franchise Engine (v21.0.0).
"""

import pytest

from app.core.franchise.franchise_manager import FranchiseManager
from app.core.franchise.royalty_calculator import RoyaltyCalculator
from app.core.franchise.settlement_engine import SettlementEngine


@pytest.mark.asyncio
async def test_franchise_store_registration():
    """Verify FranchiseManager registers COCO and FOFO store profiles."""
    st1 = FranchiseManager.register_store("STR-DELHI-FOFO-01", "Delhi West Franchise", "FOFO", royalty_pct=6.0, tech_fee=300.0)
    assert st1.store_type == "FOFO"
    assert st1.royalty_percentage == 6.0

    st2 = FranchiseManager.register_store("STR-MUMBAI-COCO-01", "Mumbai Flagship Store", "COCO", royalty_pct=0.0, tech_fee=0.0)
    assert st2.store_type == "COCO"

    stores = FranchiseManager.list_stores()
    assert len(stores) >= 2


@pytest.mark.asyncio
async def test_royalty_calculator_percentage_and_fees():
    """Verify RoyaltyCalculator calculates 5% royalty fee + tech fee."""
    # Gross sales = 500,000, 5% royalty = 25,000, Tech fee = 250 -> Total due = 25,250
    res = RoyaltyCalculator.calculate_royalty("STR-DELHI-FOFO-01", gross_sales=500000.0, royalty_pct=5.0, tech_fee=250.0)
    assert res["royalty_amount"] == 25000.0
    assert res["tech_fee"] == 250.0
    assert res["total_due_to_headquarters"] == 25250.0


@pytest.mark.asyncio
async def test_settlement_engine_debit_note_generation():
    """Verify SettlementEngine generates inter-store debit note."""
    note = SettlementEngine.generate_intercompany_note("STR-DELHI-FOFO-01", "STR-MUMBAI-COCO-01", amount=15000.0, description="Inter-branch stock transfer clearing")
    assert note["from_store"] == "STR-DELHI-FOFO-01"
    assert note["to_store"] == "STR-MUMBAI-COCO-01"
    assert note["amount"] == 15000.0
    assert note["status"] == "CLEARING_PENDING"
