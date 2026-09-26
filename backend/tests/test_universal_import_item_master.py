"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 2.1.0
Created      : 2026-09-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Test Suite
"""

import sys
import os
import uuid
from pathlib import Path
from decimal import Decimal

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import dotenv_values
env_file = backend_dir.parent / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

import pytest
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.models.item_master import Item, ItemVariant, ItemBarcode, ItemWarehouseLocation
from app.models.pricing import PriceBook, PriceBookEntry
from app.api.v1.universal_import import preview_universal_import, commit_universal_import, ImportPreviewRequest, ImportCommitRequest


TEST_STYLES = ["CH-TEST-STYLE-01", "CH-CASCADE-01"]
TEST_BARCODES = ["8909999000011", "8909999000028", "8909999000035"]


@pytest.fixture(autouse=True)
async def cleanup_test_data():
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await session.execute(delete(ItemBarcode).where(ItemBarcode.barcode.in_(TEST_BARCODES)))
        sub = select(Item.id).where(Item.item_code.in_(TEST_STYLES))
        await session.execute(delete(PriceBookEntry).where(PriceBookEntry.item_id.in_(sub)))
        await session.execute(delete(ItemWarehouseLocation).where(ItemWarehouseLocation.item_id.in_(sub)))
        await session.execute(delete(ItemBarcode).where(ItemBarcode.item_id.in_(sub)))
        await session.execute(delete(ItemVariant).where(ItemVariant.item_id.in_(sub)))
        await session.execute(delete(Item).where(Item.item_code.in_(TEST_STYLES)))
        await session.commit()
    yield
    async with session_factory() as session:
        await session.execute(delete(ItemBarcode).where(ItemBarcode.barcode.in_(TEST_BARCODES)))
        sub = select(Item.id).where(Item.item_code.in_(TEST_STYLES))
        await session.execute(delete(PriceBookEntry).where(PriceBookEntry.item_id.in_(sub)))
        await session.execute(delete(ItemWarehouseLocation).where(ItemWarehouseLocation.item_id.in_(sub)))
        await session.execute(delete(ItemBarcode).where(ItemBarcode.item_id.in_(sub)))
        await session.execute(delete(ItemVariant).where(ItemVariant.item_id.in_(sub)))
        await session.execute(delete(Item).where(Item.item_code.in_(TEST_STYLES)))
        await session.commit()


@pytest.mark.asyncio
async def test_item_master_dry_run_preview_valid():
    """Verify that preview dry-run correctly reconciles valid multi-variant style rows."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = ImportPreviewRequest(
            target="ITEM_MASTER",
            rows=[
                {
                    "rowNumber": 1,
                    "BARCODE_NO": TEST_BARCODES[0],
                    "ARTICLE_STYLE_CODE": TEST_STYLES[0],
                    "BRAND_NAME": "TATTLY THREADS",
                    "COLOR": "BLACK",
                    "SIZE": "36",
                    "MRP": 1899,
                    "SELLING_PRICE": 1899,
                    "BUYING_PRICE": 470,
                    "LANDED_COST_PRICE": 495,
                    "WAREHOUSE_CODE": "WH-MAIN",
                    "REORDER_LEVEL": 10,
                },
                {
                    "rowNumber": 2,
                    "BARCODE_NO": TEST_BARCODES[1],
                    "ARTICLE_STYLE_CODE": TEST_STYLES[0],
                    "BRAND_NAME": "TATTLY THREADS",
                    "COLOR": "BLACK",
                    "SIZE": "37",
                    "MRP": 1899,
                    "SELLING_PRICE": 1899,
                    "BUYING_PRICE": 470,
                    "LANDED_COST_PRICE": 495,
                    "WAREHOUSE_CODE": "WH-MAIN",
                    "REORDER_LEVEL": 10,
                },
            ]
        )
        res = await preview_universal_import(request=req, db=session, _current_user={"company_id": "COMP-001"})
        assert res["target"] == "ITEM_MASTER"
        assert res["counts"]["total"] == 2
        assert res["counts"]["valid"] == 2
        assert res["counts"]["distinct_styles"] == 1
        assert res["counts"]["duplicate_barcodes"] == 0
        assert res["summary"]["status"] == "READY_FOR_IMPORT"
        assert len(res["rows"]) == 2
        assert res["rows"][0]["status"] == "VALID"
        assert res["rows"][1]["action"] == "ATTACH_VARIANT_TO_STYLE"


@pytest.mark.asyncio
async def test_item_master_dry_run_detects_conflicts():
    """Verify duplicate barcode and pricing violation detection in pre-flight dry-run."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = ImportPreviewRequest(
            target="ITEM_MASTER",
            rows=[
                {
                    "rowNumber": 1,
                    "BARCODE_NO": TEST_BARCODES[0],
                    "ARTICLE_STYLE_CODE": TEST_STYLES[0],
                    "COLOR": "BLACK",
                    "SIZE": "36",
                    "MRP": 1899,
                    "SELLING_PRICE": 1899,
                },
                {
                    "rowNumber": 2,
                    "BARCODE_NO": TEST_BARCODES[0],  # Duplicate barcode in batch!
                    "ARTICLE_STYLE_CODE": TEST_STYLES[0],
                    "COLOR": "BLACK",
                    "SIZE": "37",
                    "MRP": 1899,
                    "SELLING_PRICE": 2100,  # Selling price > MRP!
                },
            ]
        )
        res = await preview_universal_import(request=req, db=session, _current_user={"company_id": "COMP-001"})
        assert res["counts"]["duplicate_barcodes"] >= 1
        assert res["counts"]["pricing_conflicts"] >= 1
        assert res["summary"]["status"] == "VALIDATION_ISSUES_FOUND"
        assert res["rows"][1]["status"] == "INVALID"


@pytest.mark.asyncio
async def test_item_master_commit_3tier_cascade():
    """Verify full 3-tier cascade commit: Item -> ItemVariant -> ItemBarcode -> WarehouseLocation -> PriceBookEntry."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        user_ctx = {"id": "usr-test", "company_id": "COMP-001", "branch_id": "BR-001"}
        idempotency_key = f"idem-{uuid.uuid4().hex[:12]}"

        commit_req = ImportCommitRequest(
            target="ITEM_MASTER",
            idempotency_key=idempotency_key,
            price_mode="CREATE_AS_DRAFT",
            rows=[
                {
                    "rowNumber": 1,
                    "BARCODE_NO": TEST_BARCODES[0],
                    "SKU_PREVIEW": f"{TEST_STYLES[1]}-BLACK-36-O",
                    "ARTICLE_STYLE_CODE": TEST_STYLES[1],
                    "BRAND_NAME": "TATTLY THREADS",
                    "MERCHANDISE_DEPARTMENT": "FOOTWEAR",
                    "MERCHANDISE_CATEGORY": "LADIES FOOTWEAR",
                    "PRODUCT_TYPE": "CHAPPAL",
                    "COLOR": "BLACK",
                    "SIZE": "36",
                    "MRP": 1899,
                    "SELLING_PRICE": 1899,
                    "BUYING_PRICE": 470,
                    "LANDED_COST_PRICE": 495,
                    "GST_RATE_PERCENT": 5,
                    "HSN_CODE": "6402",
                    "GENDER": "LADIES",
                    "WAREHOUSE_CODE": "WH-MAIN",
                    "REORDER_LEVEL": 15,
                },
                {
                    "rowNumber": 2,
                    "BARCODE_NO": TEST_BARCODES[1],
                    "SKU_PREVIEW": f"{TEST_STYLES[1]}-BLACK-37-O",
                    "ARTICLE_STYLE_CODE": TEST_STYLES[1],
                    "BRAND_NAME": "TATTLY THREADS",
                    "MERCHANDISE_DEPARTMENT": "FOOTWEAR",
                    "MERCHANDISE_CATEGORY": "LADIES FOOTWEAR",
                    "PRODUCT_TYPE": "CHAPPAL",
                    "COLOR": "BLACK",
                    "SIZE": "37",
                    "MRP": 1899,
                    "SELLING_PRICE": 1899,
                    "BUYING_PRICE": 470,
                    "LANDED_COST_PRICE": 495,
                    "GST_RATE_PERCENT": 5,
                    "HSN_CODE": "6402",
                    "GENDER": "LADIES",
                    "WAREHOUSE_CODE": "WH-MAIN",
                    "REORDER_LEVEL": 15,
                },
            ]
        )

        class MockTenant:
            id = "smriti001"
            code = "smriti001"

        res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user_ctx,
            tenant=MockTenant(),
        )

        assert res["success"] is True
        assert res["idempotent_replay"] is False
        assert len(res["results"]) == 2

        # Verify DB entities
        # 1. Exactly 1 Parent Item
        items = (await session.execute(select(Item).where(Item.item_code == TEST_STYLES[1], Item.company_id == "COMP-001"))).scalars().all()
        assert len(items) == 1
        parent = items[0]
        assert parent.brand.upper() == "TATTLY THREADS"
        assert parent.style_code == TEST_STYLES[1]

        # 2. Exactly 2 Child Variants
        variants = (await session.execute(select(ItemVariant).where(ItemVariant.item_id == parent.id))).scalars().all()
        assert len(variants) == 2
        var_skus = {v.variant_sku for v in variants}
        assert f"{TEST_STYLES[1]}-BLACK-36-O" in var_skus
        assert f"{TEST_STYLES[1]}-BLACK-37-O" in var_skus
        assert variants[0].attributes_json.get("gender") == "LADIES"

        # 3. Barcodes: 2 variant-level barcodes matching the imported lines
        bcs = (await session.execute(select(ItemBarcode).where(ItemBarcode.item_id == parent.id))).scalars().all()
        variant_bcs = [b for b in bcs if b.variant_id is not None]
        assert len(variant_bcs) == 2
        assert {b.barcode for b in variant_bcs} == {TEST_BARCODES[0], TEST_BARCODES[1]}

        # 4. Warehouse location
        locs = (await session.execute(select(ItemWarehouseLocation).where(ItemWarehouseLocation.item_id == parent.id))).scalars().all()
        assert len(locs) == 1
        assert locs[0].warehouse_id == "WH-MAIN"
        assert float(locs[0].min_reorder_level) == 15.0

        # 5. Price Book Entry (Draft Mode)
        pbes = (await session.execute(select(PriceBookEntry).where(PriceBookEntry.item_id == parent.id))).scalars().all()
        assert len(pbes) == 2
        assert float(pbes[0].selling_price) == 1899.0
        assert float(pbes[0].mrp) == 1899.0

        # 6. Test Idempotency: Re-committing with identical idempotency key returns idempotent_replay
        replay_res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user_ctx,
            tenant=MockTenant(),
        )
        assert replay_res["success"] is True
        assert replay_res["idempotent_replay"] is True
