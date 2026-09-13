"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.32.0
Created      : 2026-09-13
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.db.session import async_session
from app.services.catalog_validation import CatalogDimensionValidator


@pytest.mark.asyncio
async def test_catalog_dimension_validator_direct_lifecycle():
    """
    Validates CatalogDimensionValidator against control plane records:
    1. Case-insensitive canonical matching (e.g. 'smriti' -> 'SMRITI').
    2. None and blank string bypass.
    3. Rejection of unapproved brands with HTTP 422 and SMRITI-VAL-002.
    4. Non-strict mode fallback.
    """
    async with async_session() as session:
        # 1. Exact & case-insensitive matching
        canonical = await CatalogDimensionValidator.validate_and_normalize_brand(
            control_db=session,
            brand_val="smriti",
            strict=True,
        )
        assert canonical == "SMRITI", f"Expected 'SMRITI' but got {canonical}"

        canonical_title = await CatalogDimensionValidator.validate_and_normalize_brand(
            control_db=session,
            brand_val="Smriti",
            strict=True,
        )
        assert canonical_title == "SMRITI"

        # 2. None and empty bypass
        none_res = await CatalogDimensionValidator.validate_and_normalize_brand(
            control_db=session,
            brand_val=None,
            strict=True,
        )
        assert none_res is None

        empty_res = await CatalogDimensionValidator.validate_and_normalize_brand(
            control_db=session,
            brand_val="   ",
            strict=True,
        )
        assert empty_res is None

        # 3. Unapproved brand rejection
        with pytest.raises(HTTPException) as exc_info:
            await CatalogDimensionValidator.validate_and_normalize_brand(
                control_db=session,
                brand_val="UNAPPROVED_LUXURY_BRAND_9999",
                strict=True,
            )
        assert exc_info.value.status_code == 422
        assert isinstance(exc_info.value.detail, dict)
        assert exc_info.value.detail.get("code") == "SMRITI-VAL-002"
        assert "UNAPPROVED_LUXURY_BRAND_9999" in exc_info.value.detail.get("message", "")

        # 4. Non-strict mode returns cleaned string without raising
        non_strict = await CatalogDimensionValidator.validate_and_normalize_brand(
            control_db=session,
            brand_val="  Generic Unapproved Brand  ",
            strict=False,
        )
        assert non_strict == "Generic Unapproved Brand"

        # 5. get_approved_brands returns registered entries
        approved_list = await CatalogDimensionValidator.get_approved_brands(control_db=session)
        assert len(approved_list) > 0
        codes = [b["code"] for b in approved_list]
        assert "SMRITI" in codes


@pytest.mark.asyncio
async def test_product_create_and_update_brand_governance_rejection():
    """
    Verifies that product creation and update reject unapproved brands with HTTP 422
    and clear HREP guidance message.
    """
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": "SYSADMIN",
            "company_id": "COMP-001",
            "branch_id": "BR-MAIN-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    client = TestClient(app)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "BR-MAIN-001",
    }

    # Attempt to create a product with an unapproved brand
    payload = {
        "code": f"PROD-TEST-UNAPP-{uuid.uuid4().hex[:6]}",
        "name": "Unapproved Brand Test Product",
        "category": "Footwear",
        "brand": "UNAPPROVED_BRAND_REJECT_ME",
        "price": 999.0,
        "mrp": 1299.0,
        "gst_percentage": 18.0,
        "barcode": f"BAR-{uuid.uuid4().hex[:8]}",
        "hsn_code": "6403",
        "attributes": {"style_no": "STYLE-101", "article_no": "ART-101"},
    }

    res = client.post("/api/v1/products/", json=payload, headers=headers)
    assert res.status_code == 422, f"Expected 422 but got {res.status_code}: {res.text}"
    assert "UNAPPROVED_BRAND_REJECT_ME" in res.text
    assert "not registered in the Master Lookup registry" in res.text

    # Now attempt with an approved brand "SMRITI" (case-insensitive "smriti")
    payload["code"] = f"PROD-TEST-APP-{uuid.uuid4().hex[:6]}"
    payload["barcode"] = f"BAR-{uuid.uuid4().hex[:8]}"
    payload["brand"] = "smriti"

    success_res = client.post("/api/v1/products/", json=payload, headers=headers)
    assert success_res.status_code == 201, f"Expected 201 but got {success_res.status_code}: {success_res.text}"
    prod_data = success_res.json()
    assert prod_data.get("brand") == "SMRITI", f"Expected canonical 'SMRITI' but got {prod_data.get('brand')}"

    # 3. Test update_product rejection with unapproved brand
    prod_id = prod_data["id"]
    update_res = client.put(f"/api/v1/products/{prod_id}", json={"brand": "FAKE_LUXURY_999"}, headers=headers)
    assert update_res.status_code == 422
    assert "not registered in the Master Lookup registry" in update_res.text

    # 4. Test update_product success with approved brand "Beanstalk"
    update_ok = client.put(f"/api/v1/products/{prod_id}", json={"brand": "beanstalk"}, headers=headers)
    assert update_ok.status_code == 200
    assert update_ok.json().get("brand") == "BEANSTALK"
