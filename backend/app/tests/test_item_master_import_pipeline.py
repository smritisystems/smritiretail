"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-09-27
Modified     : 2026-09-27 (Part 2: Route item pricing to authoritative Pricing Domain PriceBookEntry)
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
from app.api.v1.universal_import import commit_universal_import, ImportCommitRequest
from app.models.item_master import Item, ItemVariant
from app.models.pricing import PriceBook, PriceBookEntry
from app.models.purchase import Supplier


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
        assert item.department == "Footwear"
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


