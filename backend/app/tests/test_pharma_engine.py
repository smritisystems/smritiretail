"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 24.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Domain Release Phase 30 Pharma Engine

test_pharma_engine.py — Integration test suite for Pharma & Healthcare Engine (v24.0.0).
"""

import pytest
from datetime import datetime, timedelta

from app.core.pharma.prescription_manager import PrescriptionManager
from app.core.pharma.generic_salt_search import GenericSaltSearchEngine
from app.core.pharma.batch_expiry_control import BatchExpiryControlEngine


@pytest.mark.asyncio
async def test_prescription_manager_validation():
    """Verify PrescriptionManager validates Schedule H/H1 doctor credentials."""
    res_valid = PrescriptionManager.validate_prescription("Amit Sharma", "Dr. K. L. Mehta", "MCI-55412", "SCHEDULE_H")
    assert res_valid["is_valid"] is True
    assert res_valid["compliance_status"] == "APPROVED"

    res_invalid = PrescriptionManager.validate_prescription("Amit Sharma", "Unregistered", "12", "SCHEDULE_H1")
    assert res_invalid["is_valid"] is False
    assert res_invalid["compliance_status"] == "REJECTED_INVALID_DOCTOR_REG"


@pytest.mark.asyncio
async def test_generic_salt_substitute_search():
    """Verify GenericSaltSearchEngine returns substitute generic medicines."""
    res = GenericSaltSearchEngine.search_substitutes("PARACETAMOL")
    assert res["active_salt_name"] == "PARACETAMOL"
    assert res["matches_found"] >= 3
    substitute_names = [s["trade_name"] for s in res["substitutes"]]
    assert "Calpol 500mg" in substitute_names
    assert "Dolo 650mg" in substitute_names


@pytest.mark.asyncio
async def test_batch_near_expiry_lock():
    """Verify BatchExpiryControlEngine blocks near-expiry (< 30 days) batches."""
    today = datetime.utcnow()

    # Batch expiring in 15 days -> Locked
    exp_15 = (today + timedelta(days=15)).strftime("%Y-%m-%d")
    res_15 = BatchExpiryControlEngine.evaluate_batch_sale_eligibility("BATCH-PHARMA-15", exp_15)
    assert res_15["is_eligible_for_sale"] is False
    assert "NEAR_EXPIRY_LOCK" in res_15["lock_reason"]

    # Batch expiring in 90 days -> Eligible
    exp_90 = (today + timedelta(days=90)).strftime("%Y-%m-%d")
    res_90 = BatchExpiryControlEngine.evaluate_batch_sale_eligibility("BATCH-PHARMA-90", exp_90)
    assert res_90["is_eligible_for_sale"] is True
    assert res_90["lock_reason"] == "APPROVED_FOR_SALE"
