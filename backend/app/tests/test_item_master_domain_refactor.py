"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.46.1
Created      : 2026-09-28
Modified     : 2026-09-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Domain Verification Test Suite
"""

import pytest
import uuid
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, and_

from app.main import app
from app.db.session import get_company_sessionmaker, async_session
from app.models.item_master import Item, ItemStyle, ItemVariant, ItemBarcode
from app.models.pricing import PriceBook, PriceBookEntry
from app.models.master_lookup import MasterType, MasterValue
from app.services.item_domain_svc import ItemDomainService
from app.schemas.item_master import (
    ItemStyleCreateRequest,
    ItemVariantCreateRequest,
    ItemBarcodeCreateRequest,
)


@pytest.mark.asyncio
async def test_item_master_domain_migration_and_model_aliases():
    """Gate 2: Validate migration columns, indexes, and ItemStyle model aliases."""
    assert ItemStyle == Item
    assert hasattr(ItemVariant, "color")
    assert hasattr(ItemVariant, "size")
    assert hasattr(ItemVariant, "style_id")
    assert hasattr(ItemBarcode, "price_book_entry_id")


@pytest.mark.asyncio
async def test_item_style_create_and_tenant_isolation():
    """Gate 3 & Gate 5: Style creation, query, and tenant isolation."""
    company_a = f"COMP-A-{uuid.uuid4().hex[:6]}"
    company_b = f"COMP-B-{uuid.uuid4().hex[:6]}"
    style_code = f"ST-{uuid.uuid4().hex[:8].upper()}"

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create in Company A
        req_a = ItemStyleCreateRequest(
            style_code=style_code,
            style_name="Bridal Heel Collection 2026",
            brand="TATTLY THREADS",
            category="SANDAL",
            gender="WOMEN",
            product_type="HEEL",
            hsn_code="64041990",
            tax_rate=18.0,
            primary_uom="PRS",
        )
        style_a = await ItemDomainService.create_style(
            session=session,
            req=req_a,
            company_id=company_a,
        )
        assert style_a.id is not None
        assert style_a.item_code == style_code

        # Verify Company B cannot see Company A style
        styles_b = await ItemDomainService.list_styles(
            session=session,
            query=style_code,
            company_id=company_b,
        )
        assert len(styles_b) == 0

        # Verify Company A can see it
        styles_a = await ItemDomainService.list_styles(
            session=session,
            query=style_code,
            company_id=company_a,
        )
        assert len(styles_a) == 1
        assert styles_a[0]["style_code"] == style_code


@pytest.mark.asyncio
async def test_physical_variant_identity_decoupled_from_mrp():
    """
    Gate 8 & Gate 9: Pricing Separation & Style 2006 CREAM Invariant.
    Physical variant identity is strictly (Style + Color + Size).
    Multiple MRPs (e.g. Rs. 1,299 vs Rs. 1,499) must NOT duplicate the physical variant!
    """
    company_id = f"COMP-{uuid.uuid4().hex[:6]}"
    style_code = f"2006-{uuid.uuid4().hex[:6].upper()}"

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Create Style
        style = await ItemDomainService.create_style(
            session=session,
            req=ItemStyleCreateRequest(
                style_code=style_code,
                style_name="Comfort Daily Heel 2006",
                brand="KORA",
                category="SANDAL",
                gender="WOMEN",
                product_type="SLIPPER",
            ),
            company_id=company_id,
        )

        # 2. Ingest Batch 1: CREAM / Size 36 / MRP 1299
        b1_barcode = f"7007{uuid.uuid4().hex[:9]}"
        var1, pbe1, bc1 = await ItemDomainService.create_variant(
            session=session,
            req=ItemVariantCreateRequest(
                style_id=style.id,
                color="CREAM",
                size="36",
                mrp=1299.0,
                selling_price=1299.0,
                primary_barcode=b1_barcode,
            ),
            company_id=company_id,
        )
        assert var1.color == "CREAM"
        assert var1.size == "36"
        assert pbe1.mrp == Decimal("1299.00")
        assert bc1.barcode == b1_barcode
        assert bc1.price_book_entry_id == pbe1.id

        # 3. Ingest Batch 2: SAME Physical Variant (CREAM / Size 36) but NEW MRP 1499 and NEW Barcode
        b2_barcode = f"7007{uuid.uuid4().hex[:9]}"
        var2, pbe2, bc2 = await ItemDomainService.create_variant(
            session=session,
            req=ItemVariantCreateRequest(
                style_id=style.id,
                color="CREAM",
                size="36",
                mrp=1499.0,
                selling_price=1499.0,
                primary_barcode=b2_barcode,
            ),
            company_id=company_id,
        )

        # CRITICAL ARCHITECTURAL ASSERTION:
        # Physical variant was REUSED! Exactly 1 physical variant exists for Style 2006 CREAM 36!
        assert var2.id == var1.id
        assert var2.variant_sku == var1.variant_sku
        # But a NEW price point was recorded in the Pricing Domain!
        assert pbe2.id != pbe1.id
        assert pbe2.mrp == Decimal("1499.00")
        assert bc2.price_book_entry_id == pbe2.id

        # Verify variant list returns exactly 1 variant with 2 distinct barcodes
        v_list = await ItemDomainService.list_variants(
            session=session,
            style_id=style.id,
            company_id=company_id,
        )
        assert len(v_list) == 1
        assert len(v_list[0]["barcodes"]) == 2
        barcode_vals = [b.barcode for b in v_list[0]["barcodes"]]
        assert b1_barcode in barcode_vals
        assert b2_barcode in barcode_vals


@pytest.mark.asyncio
async def test_barcode_uniqueness_enforcement():
    """Gate 7: Barcode uniqueness constraint within company."""
    company_id = f"COMP-{uuid.uuid4().hex[:6]}"
    shared_barcode = f"BC-{uuid.uuid4().hex[:10]}"

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        style = await ItemDomainService.create_style(
            session=session,
            req=ItemStyleCreateRequest(style_code=f"S-{uuid.uuid4().hex[:6]}", style_name="Shoe A"),
            company_id=company_id,
        )
        var1, _, _ = await ItemDomainService.create_variant(
            session=session,
            req=ItemVariantCreateRequest(style_id=style.id, color="BLACK", size="38"),
            company_id=company_id,
        )
        var2, _, _ = await ItemDomainService.create_variant(
            session=session,
            req=ItemVariantCreateRequest(style_id=style.id, color="WHITE", size="39"),
            company_id=company_id,
        )

        # Register barcode on Variant 1
        await ItemDomainService.create_barcode(
            session=session,
            req=ItemBarcodeCreateRequest(variant_id=var1.id, barcode=shared_barcode),
            company_id=company_id,
        )

        # Attempt duplicate barcode on Variant 2 should raise collision error
        from app.services.item_domain_svc import BusinessLogicError
        with pytest.raises(BusinessLogicError) as exc_info:
            await ItemDomainService.create_barcode(
                session=session,
                req=ItemBarcodeCreateRequest(variant_id=var2.id, barcode=shared_barcode),
                company_id=company_id,
            )
        assert "already registered" in str(exc_info.value.message)


@pytest.mark.asyncio
async def test_governed_master_lookup_catalog():
    """Gate 4: Governed Master Lookup API returns active catalog dimensions."""
    async with async_session() as control_db:
        lookups = await ItemDomainService.get_governed_lookups(control_db=control_db)
        assert isinstance(lookups, dict)
        # Verify core catalog dimensions are present
        assert "gender" in lookups or "color" in lookups or "size" in lookups or "brand" in lookups


@pytest.mark.asyncio
async def test_rest_api_item_domain_endpoints():
    """Gate 3: REST API contract testing via HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Mock auth header for tests
        headers = {"X-Tenant-Company": "COMP-001"}

        # 1. GET /api/v1/item-styles
        res_styles = await client.get("/api/v1/item-styles?limit=5", headers=headers)
        assert res_styles.status_code == 200
        assert isinstance(res_styles.json(), list)

        # 2. GET /api/v1/item-variants
        res_vars = await client.get("/api/v1/item-variants?limit=5", headers=headers)
        assert res_vars.status_code == 200
        assert isinstance(res_vars.json(), list)

        # 3. GET /api/v1/item-barcodes
        res_bc = await client.get("/api/v1/item-barcodes?limit=5", headers=headers)
        assert res_bc.status_code == 200
        assert isinstance(res_bc.json(), list)

        # 4. GET /api/v1/item-domain/lookups
        res_lookups = await client.get("/api/v1/item-domain/lookups", headers=headers)
        assert res_lookups.status_code == 200
        assert "dimensions" in res_lookups.json()
