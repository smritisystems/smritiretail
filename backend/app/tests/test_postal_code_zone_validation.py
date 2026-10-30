"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Created      : 2026-10-25
Modified     : 2026-10-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Test Suite   : Postal Code Reference, Commercial Zone Resolution & Cross-Location Validation
"""

import sys
import os
import asyncio
from pathlib import Path

# Add backend directory to path if run standalone
backend_dir = str(Path(__file__).resolve().parents[2])
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    import pytest
    asyncio_mark = pytest.mark.asyncio
except ImportError:
    def asyncio_mark(func):
        return func

from app.db.session import async_session
from app.services.localization_svc import INDIAN_STATE_CODE_TO_ZONE, GlobalReferenceService


@asyncio_mark
async def test_indian_state_code_to_zone_definitions():
    """Verify zone mapping coverage for standard Indian state codes."""
    assert INDIAN_STATE_CODE_TO_ZONE["MH"] == "West"
    assert INDIAN_STATE_CODE_TO_ZONE["GJ"] == "West"
    assert INDIAN_STATE_CODE_TO_ZONE["DL"] == "North"
    assert INDIAN_STATE_CODE_TO_ZONE["UP"] == "North"
    assert INDIAN_STATE_CODE_TO_ZONE["KA"] == "South"
    assert INDIAN_STATE_CODE_TO_ZONE["TN"] == "South"
    assert INDIAN_STATE_CODE_TO_ZONE["WB"] == "East"
    assert INDIAN_STATE_CODE_TO_ZONE["MP"] == "Central"
    assert INDIAN_STATE_CODE_TO_ZONE["AS"] == "North East"


@asyncio_mark
async def test_postal_code_direct_resolution_with_zone():
    """Verify that get_postal_code directly populates state_name, gst_state_code and zone."""
    async with async_session() as db:
        svc = GlobalReferenceService(db)
        record = await svc.get_postal_code("400067", country_code="IN")
        assert record is not None
        assert record.postal_code == "400067"
        assert record.state_code == "MH"
        assert record.state_name == "Maharashtra"
        assert record.gst_state_code == "27"
        assert record.zone == "West"


@asyncio_mark
async def test_postal_code_validation_service():
    """Verify validate_postal_location handles valid match, state/zone mismatch, and not found."""
    async with async_session() as db:
        svc = GlobalReferenceService(db)

        # 1. Valid match (400067 in MH, West zone)
        res_valid = await svc.validate_postal_location("400067", state_code="MH", zone="West")
        assert res_valid["valid"] is True
        assert res_valid["status"] == "VALID"
        assert res_valid["expected_state"] == "Maharashtra"
        assert res_valid["expected_zone"] == "West"
        assert res_valid["state_matches"] is True
        assert res_valid["zone_matches"] is True

        # 2. Mismatch (400067 passed with UP and North zone)
        res_mismatch = await svc.validate_postal_location("400067", state_code="UP", zone="North")
        assert res_mismatch["valid"] is False
        assert res_mismatch["status"] == "MISMATCH"
        assert res_mismatch["expected_state"] == "Maharashtra"
        assert res_mismatch["expected_zone"] == "West"
        assert res_mismatch["state_matches"] is False
        assert res_mismatch["zone_matches"] is False

        # 3. Not found (400000 does not exist in India Post registry)
        res_not_found = await svc.validate_postal_location("400000")
        assert res_not_found["valid"] is False
        assert res_not_found["status"] == "NOT_FOUND"


async def main():
    print("Executing test_indian_state_code_to_zone_definitions...")
    await test_indian_state_code_to_zone_definitions()
    print("Executing test_postal_code_direct_resolution_with_zone...")
    await test_postal_code_direct_resolution_with_zone()
    print("Executing test_postal_code_validation_service...")
    await test_postal_code_validation_service()
    print("SUCCESS: All 3 Postal Code & Zone validation backend tests passed cleanly!")


if __name__ == "__main__":
    asyncio.run(main())
