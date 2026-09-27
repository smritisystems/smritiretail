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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.api.deps import TenantContext
from app.api.v1.universal_import import commit_universal_import, ImportCommitRequest
from app.models.item_master import Item, ItemVariant
from app.models.pricing import PriceBook, PriceBookEntry


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
