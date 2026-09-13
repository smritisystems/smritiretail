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

from sqlalchemy import delete
from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.db.session import async_session, get_company_sessionmaker
from app.models.inventory import Product
from app.services.catalog_validation import CatalogDimensionValidator


@pytest.mark.asyncio
async def test_catalog_dimension_validator_direct_lifecycle():
    """
    Validates CatalogDimensionValidator against control plane records:
    1. Case-insensitive canonical matching (e.g. 'smriti' -> 'SMRITI').
    2. None and blank string bypass.
    3. Rejection of unapproved brands with HTTP 422 and SMRITI-VAL-002.
    4. Non-strict mode fallback.
    5. Multi-dimension validation (category, color, size, style, vendor_code).
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

        # 5. Multi-dimension validation
        # Category
        cat = await CatalogDimensionValidator.validate_and_normalize_dimension(
            dimension_field="category",
            value="footwear",
            strict=True,
            control_db=session,
        )
        assert cat == "Footwear"

        # Color (from color_group scale unpacking)
        col = await CatalogDimensionValidator.validate_and_normalize_dimension(
            dimension_field="color",
            value="black",
            strict=True,
            control_db=session,
        )
        assert col == "BLACK"

        # Size (from size_group scale unpacking)
        sz = await CatalogDimensionValidator.validate_and_normalize_dimension(
            dimension_field="size",
            value="40",
            strict=True,
            control_db=session,
        )
        assert sz == "40"

        # Style / Article
        sty = await CatalogDimensionValidator.validate_and_normalize_dimension(
            dimension_field="style",
            value="ch-01-a",
            strict=True,
            control_db=session,
        )
        assert sty == "CH-01-A"

        # Vendor Code
        vc = await CatalogDimensionValidator.validate_and_normalize_dimension(
            dimension_field="vendor_code",
            value="jrm",
            strict=True,
            control_db=session,
        )
        assert vc == "JRM"

        # 6. Unapproved color rejection
        with pytest.raises(HTTPException) as exc_col:
            await CatalogDimensionValidator.validate_and_normalize_dimension(
                dimension_field="color",
                value="NEON_GLOW_999",
                strict=True,
                control_db=session,
            )
        assert exc_col.value.status_code == 422
        assert exc_col.value.detail.get("code") == "SMRITI-VAL-002"
        assert exc_col.value.detail.get("dimension") == "color"

        # 7. Unapproved size rejection
        with pytest.raises(HTTPException) as exc_sz:
            await CatalogDimensionValidator.validate_and_normalize_dimension(
                dimension_field="size",
                value="SIZE_OVERSIZED_999",
                strict=True,
                control_db=session,
            )
        assert exc_sz.value.status_code == 422
        assert exc_sz.value.detail.get("code") == "SMRITI-VAL-002"
        assert exc_sz.value.detail.get("dimension") == "size"


@pytest.mark.asyncio
async def test_product_create_and_update_brand_governance_rejection():
    """
    Verifies that product creation and update reject unapproved brands and dimensions with HTTP 422
    and clear HREP guidance message, and accept approved values with canonical casing.
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

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await session.execute(delete(Product).where(Product.code.like("PROD-TEST-%")))
        await session.commit()

    prod_id = None
    try:
        # 1. Attempt with unapproved brand
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

        # 2. Attempt with unapproved color
        payload["brand"] = "smriti"
        payload["color"] = "NEON_UNKNOWN_COLOR"
        res_col = client.post("/api/v1/products/", json=payload, headers=headers)
        assert res_col.status_code == 422
        assert "NEON_UNKNOWN_COLOR" in res_col.text

        # 3. Attempt with unapproved size
        payload["color"] = "black"
        payload["size"] = "SIZE_9999"
        res_sz = client.post("/api/v1/products/", json=payload, headers=headers)
        assert res_sz.status_code == 422
        assert "SIZE_9999" in res_sz.text

        # 4. Success creation with all valid canonical dimensions
        payload["code"] = f"PROD-TEST-APP-{uuid.uuid4().hex[:6]}"
        payload["barcode"] = f"BAR-{uuid.uuid4().hex[:8]}"
        payload["size"] = "40"
        payload["color"] = "black"
        payload["style_code"] = "ch-01-a"
        payload["vendor_code"] = "jrm"

        success_res = client.post("/api/v1/products/", json=payload, headers=headers)
        assert success_res.status_code == 201, f"Expected 201 but got {success_res.status_code}: {success_res.text}"
        prod_data = success_res.json()
        assert prod_data.get("brand") == "SMRITI"
        assert prod_data.get("color") == "BLACK"
        assert prod_data.get("size") == "40"
        assert prod_data.get("style_code") == "CH-01-A"
        assert prod_data.get("vendor_code") == "JRM"

        # 5. Test update_product rejection with unapproved color
        prod_id = prod_data["id"]
        update_res = client.put(f"/api/v1/products/{prod_id}", json={"color": "FAKE_COLOR_999"}, headers=headers)
        assert update_res.status_code == 422
        assert "not registered in the Master Lookup registry" in update_res.text

        # 6. Test update_product success with approved color "white"
        update_ok = client.put(f"/api/v1/products/{prod_id}", json={"color": "white"}, headers=headers)
        assert update_ok.status_code == 200
        assert update_ok.json().get("color") == "WHITE"
    finally:
        async with session_factory() as session:
            await session.execute(delete(Product).where(Product.code.like("PROD-TEST-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_universal_item_master_service_dimension_governance():
    """
    Verifies that UniversalItemMasterService.create_item normalizes governed dimensions
    (brand, category, style_code, color, size, vendor_code) and rejects unapproved values.
    """
    from decimal import Decimal
    from app.schemas.item_master import ItemCreateRequest
    from app.services.item_master_svc import UniversalItemMasterService
    from app.models.item_master import Item

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await session.execute(delete(Item).where(Item.item_code.like("ITEM-TEST-%")))
        await session.commit()

        req = ItemCreateRequest(
            item_code=f"ITEM-TEST-{uuid.uuid4().hex[:6]}",
            item_name="Governed Test Item",
            category="footwear",
            brand="smriti",
            style_code="ch-01-a",
            color="black",
            size="40",
            vendor_code="jrm",
            tax_rate=18.0,
            primary_uom="PCS",
        )
        try:
            created_item = await UniversalItemMasterService.create_item(session, req=req, company_id="COMP-001")
            assert created_item.category == "Footwear"
            assert created_item.brand == "SMRITI"
            assert created_item.style_code == "CH-01-A"
            assert created_item.color == "BLACK"
            assert created_item.size == "40"
            assert created_item.vendor_code == "JRM"

            # Verify unapproved color rejection
            unapproved_req = ItemCreateRequest(
                item_code=f"ITEM-TEST-FAIL-{uuid.uuid4().hex[:6]}",
                item_name="Unapproved Color Item",
                category="footwear",
                color="NEON_REJECT_ME",
                tax_rate=18.0,
                primary_uom="PCS",
            )
            with pytest.raises(HTTPException) as exc_info:
                await UniversalItemMasterService.create_item(session, req=unapproved_req, company_id="COMP-001")
            assert exc_info.value.status_code == 422
            assert exc_info.value.detail.get("code") == "SMRITI-VAL-002"
        finally:
            await session.execute(delete(Item).where(Item.item_code.like("ITEM-TEST-%")))
            await session.commit()

