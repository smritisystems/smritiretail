"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-09-27
Modified     : 2026-09-28 (Align test fixtures with Item Master Standard v2.2 and IM-001 two-tier validation)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Regression Test Suite — Item Master & Pricing Import Pipeline
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
from app.services.catalog_validation import CatalogConsistencyValidator
from app.models.item_master import Item, ItemVariant
from app.models.pricing import PriceBook, PriceBookEntry
from app.models.purchase import Supplier
from app.models.master_lookup import MasterType, MasterValue


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


@pytest.mark.asyncio
async def test_import_item_pricing_routes_to_authoritative_price_book_entry(session_factory):
    """
    PART 2 Regression Test:
    Import a sample row with MRP=1899, SellingPrice=1899.
    Assert a PriceBookEntry row exists with those exact values AND
    items.mrp also reflects it as fallback.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-pricing"}

    token = uuid.uuid4().hex[:8].upper()
    barcode = f"BC{token}123"
    sku = f"SKU-{token}"
    style_code = f"STY-{token}"

    sample_row = {
        "barcode": barcode,
        "sku": sku,
        "style_code": style_code,
        "item_name": f"Test Footwear {token}",
        "category": "Footwear",
        "department": "Footwear",
        "brand": "SMRITI",
        "color": "Black",
        "size": "9",
        "mrp": 1899,
        "sellingPrice": 1899,
        "costPrice": 950,
    }

    commit_req = ImportCommitRequest(
        target="ITEM_MASTER",
        rows=[sample_row],
        idempotency_key=f"idemp-{uuid.uuid4().hex}",
        price_mode="CREATE_LIVE_RETAIL",
    )

    async with session_factory() as session:
        # Execute the import commit
        res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user,
            tenant=tenant,
        )

        assert res["success"] is True
        assert len(res["results"]) == 1
        created_item_id = res["results"][0]["item_id"]

        # 1. Fetch Item from DB — verify legacy baseline fallback
        item_stmt = select(Item).where(Item.id == created_item_id)
        item = (await session.execute(item_stmt)).scalar_one_or_none()
        assert item is not None
        assert item.mrp == Decimal("1899.00")
        assert item.selling_price == Decimal("1899.00")

        # 2. Assert PriceBookEntry exists in authoritative Pricing Domain
        pbe_stmt = select(PriceBookEntry).where(
            PriceBookEntry.item_id == created_item_id,
            PriceBookEntry.is_deleted == False,
        )
        pbe_entries = (await session.execute(pbe_stmt)).scalars().all()
        assert len(pbe_entries) >= 1

        # Verify exact pricing values in PriceBookEntry
        matched_entry = next((e for e in pbe_entries if e.mrp == Decimal("1899.00")), None)
        assert matched_entry is not None, f"No PriceBookEntry with MRP=1899 found. Entries: {pbe_entries}"
        assert matched_entry.selling_price == Decimal("1899.00")
        assert matched_entry.mrp == Decimal("1899.00")
        assert matched_entry.cost_price == Decimal("950.00")


@pytest.mark.asyncio
async def test_import_item_vendor_code_linkage_success(session_factory):
    """
    PART 3 Regression Test:
    When a valid registered Supplier exists with a code (e.g. 'A' or 'VEND-01'),
    importing an Item with that vendor_code succeeds and populates Item.vendor_code
    directly from Supplier.code.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-vendor"}

    token = uuid.uuid4().hex[:6].upper()
    supplier_code = f"V{token}"
    barcode = f"BC{token}456"
    sku = f"SKU-{token}"
    style_code = f"STY-{token}"

    async with session_factory() as session:
        # 1. Create a Supplier with code
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=None,
            code=supplier_code,
            name=f"Alpha Supplier {token}",
            outstanding=Decimal("0.00"),
        )
        session.add(supplier)
        await session.commit()

        # 2. Import an Item referencing this vendor_code
        sample_row = {
            "barcode": barcode,
            "sku": sku,
            "style_code": style_code,
            "item_name": f"Test Vendor Item {token}",
            "vendor_code": supplier_code.lower(),  # test case-insensitive lookup
            "category": "Footwear",
            "department": "Footwear",
            "brand": "SMRITI",
            "mrp": 1200,
            "sellingPrice": 1200,
        }

        commit_req = ImportCommitRequest(
            target="ITEM_MASTER",
            rows=[sample_row],
            idempotency_key=f"idemp-{uuid.uuid4().hex}",
        )

        res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user,
            tenant=tenant,
        )
        assert res["success"] is True
        created_item_id = res["results"][0]["item_id"]

        # 3. Assert Item.vendor_code was populated from the real Supplier.code
        item = (await session.execute(select(Item).where(Item.id == created_item_id))).scalar_one_or_none()
        assert item is not None
        assert item.vendor_code == supplier_code.upper()


@pytest.mark.asyncio
async def test_import_item_vendor_code_linkage_unregistered_supplier_rejected(session_factory):
    """
    PART 3 Regression Test:
    When an Item row references a vendor_code that does NOT exist in Supplier,
    the service/import layer rejects it with a validation error (HTTP 422).
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-vendor-fail"}

    token = uuid.uuid4().hex[:6].upper()
    barcode = f"BC{token}789"
    sku = f"SKU-{token}"
    style_code = f"STY-{token}"

    sample_row = {
        "barcode": barcode,
        "sku": sku,
        "style_code": style_code,
        "item_name": f"Invalid Vendor Item {token}",
        "vendor_code": f"NONEXISTENT_{token}",
        "category": "Footwear",
        "department": "Footwear",
        "mrp": 1500,
        "sellingPrice": 1500,
    }

    commit_req = ImportCommitRequest(
        target="ITEM_MASTER",
        rows=[sample_row],
        idempotency_key=f"idemp-{uuid.uuid4().hex}",
    )

    async with session_factory() as session:
        with pytest.raises(HTTPException) as exc_info:
            await commit_universal_import(
                request=commit_req,
                db=session,
                current_user=user,
                tenant=tenant,
            )

        assert exc_info.value.status_code == 422
        assert "does not match any registered Supplier" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_import_footwear_attributes_routing_to_attributes_json(session_factory):
    """
    PART 4 Regression Test:
    Confirm the import mapping explicitly separates:
    - flat Item columns: item_code, style_code, color, size, vendor_code, hsn_code,
      tax_rate, department, category, brand
    - attributes_json nested fields: gender, heel_type, upper_material, outsole,
      design_attribute, collection_type
    Assert the JSON blob contains exactly the expected nested keys with correct values.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-attrs"}

    token = uuid.uuid4().hex[:6].upper()
    supplier_code = f"V{token}"
    barcode = f"BC{token}999"
    sku = f"SKU-{token}"
    style_code = f"STY-{token}"

    async with session_factory() as session:
        # Create registered supplier
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=None,
            code=supplier_code,
            name=f"Supplier {token}",
            outstanding=Decimal("0.00"),
        )
        session.add(supplier)
        await session.commit()

        sample_row = {
            "barcode": barcode,
            "sku": sku,
            "style_code": style_code,
            "item_name": f"Sneaker Master {token}",
            "brand": "SMRITI",
            "category": "Footwear",
            "department": "Footwear",
            "color": "Black",
            "size": "9",
            "vendor_code": supplier_code,
            "hsn_code": "64041990",
            "tax_rate": 18,
            "mrp": 2499,
            "sellingPrice": 2499,
            "costPrice": 1200,
            # Footwear-specific attributes for attributes_json:
            "gender": "Men",
            "heel_type": "Flat",
            "upper_material": "Mesh",
            "outsole": "Phylon",
            "design_attribute": "Lace-Up",
            "collection_type": "Running",
        }

        commit_req = ImportCommitRequest(
            target="ITEM_MASTER",
            rows=[sample_row],
            idempotency_key=f"idemp-{uuid.uuid4().hex}",
        )

        res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user,
            tenant=tenant,
        )
        assert res["success"] is True
        created_item_id = res["results"][0]["item_id"]

        # Fetch Item from DB
        item = (await session.execute(select(Item).where(Item.id == created_item_id))).scalar_one_or_none()
        assert item is not None

        # 1. Assert flat columns on Item
        assert item.item_code == style_code
        assert item.style_code == style_code
        assert item.color == "BLACK"
        assert item.size == "9"
        assert item.vendor_code == supplier_code.upper()
        assert item.hsn_code == "64041990"
        assert item.tax_rate == Decimal("18.00")
        assert item.category == "Footwear"
        assert item.department == "FOOTWEAR"
        assert item.brand == "SMRITI"

        # 2. Assert attributes_json nested fields on Item
        expected_nested = {
            "gender": "Men",
            "heel_type": "Flat",
            "upper_material": "Mesh",
            "outsole": "Phylon",
            "design_attribute": "Lace-Up",
            "collection_type": "Running",
        }
        for k, v in expected_nested.items():
            assert item.attributes_json.get(k) == v, f"Item.attributes_json[{k}] expected {v}, got {item.attributes_json.get(k)}"

        # 3. Assert ItemVariant attributes_json contains nested attributes
        variant = (await session.execute(select(ItemVariant).where(ItemVariant.item_id == item.id))).scalars().first()
        assert variant is not None
        for k, v in expected_nested.items():
            assert variant.attributes_json.get(k) == v
        assert variant.attributes_json.get("color") == "Black"
        assert variant.attributes_json.get("size") == "9"


@pytest.mark.asyncio
async def test_style_code_consistency_validation_flags_snd_row_bug(session_factory):
    """
    PART 5 Regression Test:
    Simulates the exact SND-row bug pattern found in raw retail CSVs:
    - 14 rows, each size given an inconsistent style_code, but all sharing the exact same product image.
    Asserts the service-layer validation warns (does not block) and explicitly flags the SND pattern.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-snd"}

    token = uuid.uuid4().hex[:6].upper()
    supplier_code = f"V{token}"
    shared_image_url = f"https://cdn.smriti.internal/catalog/snd_sneaker_{token}.jpg"

    # Simulate exact SND-row bug: 14 rows, 14 sizes, each with an inconsistent style_code per size, same image
    valid_sizes = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "UK-6", "UK-7", "UK-8"]
    snd_rows = []
    for i in range(1, 15):
        snd_rows.append({
            "barcode": f"BC-SND-{token}-{i}",
            "sku": f"SKU-SND-{token}-{i}",
            "style_code": f"SND-{token}-SZ{i}",  # Inconsistent style_code per size!
            "size": valid_sizes[i - 1],
            "color": "BLACK",
            "IMAGE_LINK": shared_image_url,      # Identical image across all 14 rows
            "brand": "SND",
            "category": "Footwear",
            "department": "FOOTWEAR",
            "mrp": 1999,
            "sellingPrice": 1999,
            "vendor_code": supplier_code,
        })

    # 1. Direct service-layer validator assertion
    consistency_result = CatalogConsistencyValidator.validate_batch_style_consistency(snd_rows)
    all_warnings = consistency_result["all_warnings"]
    assert len(all_warnings) >= 1
    snd_warning = next((w for w in all_warnings if "SND pattern detected" in w), None)
    assert snd_warning is not None, f"Expected SND pattern warning not found in: {all_warnings}"
    assert "14 inconsistent style codes" in snd_warning or "inconsistent style codes" in snd_warning
    assert shared_image_url in snd_warning

    async with session_factory() as session:
        # Register brand SND in Master Lookup if not already present
        brand_type = (await session.execute(select(MasterType).where(MasterType.code == "brand"))).scalar_one_or_none()
        if brand_type:
            snd_brand = (await session.execute(
                select(MasterValue).where(MasterValue.master_type_id == brand_type.id, MasterValue.code == "SND")
            )).scalar_one_or_none()
            if not snd_brand:
                session.add(MasterValue(
                    id=uuid.uuid4(),
                    master_type_id=brand_type.id,
                    code="SND",
                    name="SND",
                    data={},
                    active=True,
                    is_deleted=False,
                ))
                await session.commit()

        # Create registered supplier so foreign key lookup succeeds
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=None,
            code=supplier_code,
            name=f"SND Supplier {token}",
            outstanding=Decimal("0.00"),
        )
        session.add(supplier)
        await session.commit()

        # 2. Preview endpoint assertion: warns (not blocks)
        preview_req = ImportPreviewRequest(target="ITEM_MASTER", rows=snd_rows)
        preview_res = await preview_universal_import(
            request=preview_req,
            db=session,
            current_user=user,
            tenant=tenant,
        )
        assert preview_res["summary"]["warning_rows"] == 14
        assert any("SND pattern detected" in w for w in preview_res["summary"]["warnings"])
        # Crucial invariant: import is NOT blocked
        assert preview_res["summary"]["status"] == "READY_FOR_IMPORT"

        # 3. Commit endpoint assertion: warns, imports successfully, reports warnings
        commit_req = ImportCommitRequest(
            target="ITEM_MASTER",
            rows=snd_rows,
            idempotency_key=f"idemp-{uuid.uuid4().hex}",
        )
        commit_res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user,
            tenant=tenant,
        )
        assert commit_res["success"] is True
        assert len(commit_res["results"]) == 14
        assert any("SND pattern detected" in w for w in commit_res.get("warnings", []))
        # Each individual result row carries the warning
        for res_row in commit_res["results"]:
            assert any("SND pattern detected" in w for w in res_row.get("warnings", []))


@pytest.mark.asyncio
async def test_hsn_material_mismatch_flags_requires_review(session_factory):
    """
    PART 6 Regression Test (Rule 1):
    If upper_material indicates synthetic/rubber/plastic AND hsn_code starts with '6403'
    (leather-upper chapter), raise a REQUIRES_REVIEW flag on the Item rather than blocking import.
    Asserts:
    - Import succeeds (not blocked).
    - Item.status == 'REQUIRES_REVIEW'.
    - Item.hsn_code is NOT auto-corrected (kept as 64039990 for human/CA sign-off).
    - Result contains the mismatch warning advisory.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-hsn-flag"}

    token = uuid.uuid4().hex[:6].upper()
    supplier_code = f"V{token}"
    barcode = f"BC-SYN-{token}"
    sku = f"SKU-SYN-{token}"
    style_code = f"STY-SYN-{token}"

    sample_row = {
        "barcode": barcode,
        "sku": sku,
        "style_code": style_code,
        "item_name": f"Synthetic Leather Sneaker {token}",
        "brand": "SMRITI",
        "category": "Footwear",
        "department": "Footwear",
        "color": "BLACK",
        "size": "9",
        "vendor_code": supplier_code,
        "hsn_code": "64039990",  # Chapter 6403 (leather uppers)
        "tax_rate": 18,
        "mrp": 2199,
        "sellingPrice": 2199,
        "upper_material": "Synthetic PU Leather",  # Synthetic material!
        "outsole": "Rubber",
    }

    commit_req = ImportCommitRequest(
        target="ITEM_MASTER",
        rows=[sample_row],
        idempotency_key=f"idemp-{uuid.uuid4().hex}",
    )

    async with session_factory() as session:
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=None,
            code=supplier_code,
            name=f"Supplier {token}",
            outstanding=Decimal("0.00"),
        )
        session.add(supplier)
        await session.commit()

        res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user,
            tenant=tenant,
        )

        assert res["success"] is True
        created_item_id = res["results"][0]["item_id"]

        # Fetch Item from DB
        item = (await session.execute(select(Item).where(Item.id == created_item_id))).scalar_one_or_none()
        assert item is not None

        # 1. Assert REQUIRES_REVIEW flag was raised
        assert item.status == "REQUIRES_REVIEW"
        assert res["results"][0]["item_status"] == "REQUIRES_REVIEW"

        # 2. Assert HSN code was NOT auto-corrected (must remain 64039990 for CA review)
        assert item.hsn_code == "64039990"

        # 3. Assert human-readable advisory warning is attached
        row_warnings = res["results"][0].get("warnings", [])
        assert any("HSN/Material Mismatch Flag" in w for w in row_warnings)


@pytest.mark.asyncio
async def test_gst_rate_slab_mismatch_flags_requires_review(session_factory):
    """
    PART 6 Regression Test (Rule 2):
    - If selling_price > Rs. 2,500 and tax_rate is 5%, flag REQUIRES_REVIEW.
    - If selling_price < Rs. 2,500 and tax_rate is 18%, flag REQUIRES_REVIEW.
    Asserts:
    - Import succeeds (not blocked).
    - Item.status == 'REQUIRES_REVIEW'.
    - Tax rate is NOT auto-corrected (agent does not decide compliance).
    - Result contains the GST slab advisory warning.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    user = {"company_id": company_id, "branch_id": branch_id, "id": "usr-test-gst-flag"}

    token = uuid.uuid4().hex[:6].upper()
    supplier_code = f"V{token}"

    # Row 1: High value (> 2500) with low tax rate (5%)
    row_high_price_low_gst = {
        "barcode": f"BC-GST1-{token}",
        "sku": f"SKU-GST1-{token}",
        "style_code": f"STY-GST1-{token}",
        "item_name": f"Luxury Boot {token}",
        "brand": "SMRITI",
        "category": "Footwear",
        "department": "Footwear",
        "color": "BLACK",
        "size": "9",
        "vendor_code": supplier_code,
        "hsn_code": "64041990",
        "tax_rate": 5,      # 5% for Rs. 3500 footwear -> Slab violation
        "mrp": 3500,
        "sellingPrice": 3500,
    }

    # Row 2: Low value (< 2500) with high tax rate (18%)
    row_low_price_high_gst = {
        "barcode": f"BC-GST2-{token}",
        "sku": f"SKU-GST2-{token}",
        "style_code": f"STY-GST2-{token}",
        "item_name": f"Budget Sandal {token}",
        "brand": "SMRITI",
        "category": "Footwear",
        "department": "Footwear",
        "color": "BLACK",
        "size": "8",
        "vendor_code": supplier_code,
        "hsn_code": "64041990",
        "tax_rate": 18,     # 18% for Rs. 999 footwear -> Slab violation
        "mrp": 999,
        "sellingPrice": 999,
    }

    commit_req = ImportCommitRequest(
        target="ITEM_MASTER",
        rows=[row_high_price_low_gst, row_low_price_high_gst],
        idempotency_key=f"idemp-{uuid.uuid4().hex}",
    )

    async with session_factory() as session:
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=None,
            code=supplier_code,
            name=f"Supplier {token}",
            outstanding=Decimal("0.00"),
        )
        session.add(supplier)
        await session.commit()

        res = await commit_universal_import(
            request=commit_req,
            db=session,
            current_user=user,
            tenant=tenant,
        )

        assert res["success"] is True
        assert len(res["results"]) == 2

        # 1. Assert Row 1 (>2500, 5%)
        r1_item_id = res["results"][0]["item_id"]
        item1 = (await session.execute(select(Item).where(Item.id == r1_item_id))).scalar_one_or_none()
        assert item1.status == "REQUIRES_REVIEW"
        assert item1.tax_rate == Decimal("5.00")  # Not auto-corrected
        assert any("GST Slab Flag" in w for w in res["results"][0].get("warnings", []))

        # 2. Assert Row 2 (<2500, 18%)
        r2_item_id = res["results"][1]["item_id"]
        item2 = (await session.execute(select(Item).where(Item.id == r2_item_id))).scalar_one_or_none()
        assert item2.status == "REQUIRES_REVIEW"
        assert item2.tax_rate == Decimal("18.00")  # Not auto-corrected
        assert any("GST Slab Flag" in w for w in res["results"][1].get("warnings", []))




