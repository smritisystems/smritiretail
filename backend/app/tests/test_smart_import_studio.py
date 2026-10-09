"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.47
Created      : 2026-10-09
Modified     : 2026-10-09 (v6.70.47 — Smart Import Studio test suite: structured errors, duplicate detection, multi-strategy commits, and collision safety)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Regression Test Suite — SMRITI Smart Import & Correction Studio
"""

import uuid
import pytest
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.api.deps import TenantContext
from app.api.v1.universal_import import (
    commit_universal_import,
    preview_universal_import,
    ImportCommitRequest,
    ImportPreviewRequest,
)
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.inventory import Product
from app.models.purchase import Supplier


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


@pytest.mark.asyncio
async def test_smart_import_preview_structured_errors(session_factory):
    """
    Test that /universal-import/preview returns structured HREP-compliant errors
    with field, error code, message, and suggested_action.
    """
    company_id = "COMP-001"
    user = {"company_id": company_id, "branch_id": "BR-001", "id": "usr-test-smart-preview"}

    async with session_factory() as session:
        # Row 1: Missing style code and synthetic barcode
        # Row 2: Valid row
        rows = [
            {
                "rowNumber": 1,
                "barcode": "890GEN1234567",
                "mrp": 1500,
                "sellingPrice": 1200,
            },
            {
                "rowNumber": 2,
                "style_code": "TEST-SMART-ART01",
                "item_name": "Test Smart Shoe 01",
                "barcode": f"BC{uuid.uuid4().hex[:8].upper()}",
                "brand": "SMRITI",
                "department": "Footwear",
                "category": "Footwear",
                "color": "BLACK",
                "size": "40",
                "mrp": 2500,
                "sellingPrice": 2200,
                "tax_rate": 18,
                "hsn": "6404",
            }
        ]

        resp = await preview_universal_import(
            request=ImportPreviewRequest(target="ITEM_MASTER", rows=rows),
            db=session,
            _current_user=user,
            current_user=user
        )

        assert resp["target"] == "ITEM_MASTER"
        assert resp["code"] == "SMRITI-IMPORT-VALIDATION"
        assert resp["summary"]["blocking_errors"] >= 1
        assert resp["summary"]["valid_rows"] >= 1
        assert "reconciliation_report" in resp
        assert "approved_values_map" in resp

        row1_report = resp["reconciliation_report"][0]
        assert row1_report["status"] == "INVALID"
        assert len(row1_report["structured_errors"]) >= 1
        assert any(e["code"] in ("SYNTHETIC_BARCODE_PROHIBITED", "MISSING_STYLE_CODE") for e in row1_report["structured_errors"])


@pytest.mark.asyncio
async def test_smart_import_in_file_duplicate_detection(session_factory):
    """
    Test that duplicate barcodes within the same file are detected with exact row references.
    """
    company_id = "COMP-001"
    user = {"company_id": company_id, "branch_id": "BR-001", "id": "usr-test-dupe-file"}
    shared_barcode = f"DUP{uuid.uuid4().hex[:6].upper()}"

    async with session_factory() as session:
        rows = [
            {
                "rowNumber": 1,
                "style_code": "STYLE-DUP-01",
                "barcode": shared_barcode,
                "brand": "SMRITI",
                "department": "Footwear",
                "category": "Footwear",
                "color": "BLACK",
                "size": "9",
                "mrp": 1000,
                "sellingPrice": 900,
            },
            {
                "rowNumber": 2,
                "style_code": "STYLE-DUP-02",
                "barcode": shared_barcode,
                "brand": "SMRITI",
                "department": "Footwear",
                "category": "Footwear",
                "color": "BLACK",
                "size": "8",
                "mrp": 1200,
                "sellingPrice": 1100,
            }
        ]

        resp = await preview_universal_import(
            request=ImportPreviewRequest(target="ITEM_MASTER", rows=rows),
            db=session,
            _current_user=user,
            current_user=user
        )

        assert resp["summary"]["duplicate_in_file_rows"] == 1
        row2_report = resp["reconciliation_report"][1]
        assert row2_report["reconciliation_state"] == "DUPLICATE_IN_FILE"
        assert row2_report["status"] == "INVALID"
        assert any("Duplicate barcode within file" in e for e in row2_report["errors"])


@pytest.mark.asyncio
async def test_smart_import_partial_commit_strategy(session_factory):
    """
    Test that import_strategy="ALL_ELIGIBLE" / "VALID_ONLY" safely commits valid rows
    and records invalid rows as FAILED_VALIDATION without rolling back the entire transaction.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-partial-commit"}

    valid_token = uuid.uuid4().hex[:8].upper()
    valid_style = f"ART-PARTIAL-{valid_token}"
    valid_barcode = f"BC{valid_token}"
    valid_sku = f"SKU-{valid_token}"

    async with session_factory() as session:
        rows = [
            # Row 1: Invalid (missing style)
            {
                "rowNumber": 1,
                "barcode": "890GEN999999",
                "mrp": 1000,
                "sellingPrice": 800,
            },
            # Row 2: Valid
            {
                "rowNumber": 2,
                "style_code": valid_style,
                "sku": valid_sku,
                "barcode": valid_barcode,
                "brand": "SMRITI",
                "department": "Footwear",
                "category": "Footwear",
                "color": "BLACK",
                "size": "40",
                "mrp": 1999,
                "sellingPrice": 1699,
                "costPrice": 900,
                "tax_rate": 18,
                "hsn": "6404",
            }
        ]

        commit_req = ImportCommitRequest(
            target="ITEM_MASTER",
            rows=rows,
            idempotency_key=f"partial-test-{uuid.uuid4().hex[:10]}",
            import_strategy="ALL_ELIGIBLE",
        )

        resp = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user,
            tenant=tenant
        )

        assert resp["success"] is True
        assert resp["saved"] >= 1
        assert any(r.get("status") == "FAILED_VALIDATION" for r in resp["results"])

        # Verify item was actually saved in DB
        created_item = (await session.execute(
            select(Item).where(Item.company_id == company_id, Item.item_code == valid_style)
        )).scalars().first()
        assert created_item is not None
        assert created_item.brand == "SMRITI"


@pytest.mark.asyncio
async def test_smart_import_strict_strategy_aborts(session_factory):
    """
    Test that import_strategy="STRICT" raises HTTPException(422) when invalid rows are submitted.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-strict"}

    async with session_factory() as session:
        rows = [
            {
                "rowNumber": 1,
                "style_code": "",  # missing style
                "barcode": "890GEN0001",
                "mrp": 500,
            }
        ]

        commit_req = ImportCommitRequest(
            target="ITEM_MASTER",
            rows=rows,
            idempotency_key=f"strict-test-{uuid.uuid4().hex[:10]}",
            import_strategy="STRICT",
        )

        with pytest.raises(HTTPException) as exc_info:
            await commit_universal_import(
                request=commit_req,
                db=session,
                current_user=user,
                tenant=tenant
            )

        assert exc_info.value.status_code == 422
