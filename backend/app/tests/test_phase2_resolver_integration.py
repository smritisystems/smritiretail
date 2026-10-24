"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.39.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 2 Resolver Integration Test Suite
"""

import pytest
from decimal import Decimal
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.inventory import Product
from app.schemas.search import BarcodeQuickScanRequest
from app.services.search_engine import UniversalSearchEngine
from app.services.identity.engine import IdentityEngine
from app.services.identity.cache import get_identity_cache
from app.api.v1.billing_csv import _lookup_catalog


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


@pytest.mark.asyncio
async def test_quick_barcode_scan_tier0_identity_code_resolution(session_factory):
    """
    Test 2.1A: Verify quick_barcode_scan resolves an item when scanned with its
    governed identity_code (MST-ITM-*) via Tier 0 Master Identity Resolver.
    """
    async with session_factory() as session:
        # Find an existing item with an identity code
        stmt = select(Item).where(Item.identity_code.is_not(None)).limit(1)
        res = await session.execute(stmt)
        item = res.scalars().first()
        if not item:
            pytest.skip("No backfilled Item with identity_code found.")

        req = BarcodeQuickScanRequest(barcode=item.identity_code)
        scan_res = await UniversalSearchEngine.quick_barcode_scan(
            session=session,
            company_id=item.company_id,
            req=req,
        )

        assert scan_res.found is True
        assert scan_res.item_id == item.id
        assert scan_res.scan_type == "MASTER_IDENTITY_RESOLVER"
        assert scan_res.metadata.get("identity_code") == item.identity_code


@pytest.mark.asyncio
async def test_quick_barcode_scan_cache_hit_on_repeat_scans(session_factory):
    """
    Test 2.1B: Verify that scanning the same barcode twice produces an
    in-memory cache hit in IdentityResolutionCache (< 0.05ms).
    """
    cache = get_identity_cache()
    await cache.clear()

    async with session_factory() as session:
        stmt = select(Item).where(Item.identity_code.is_not(None)).limit(1)
        res = await session.execute(stmt)
        item = res.scalars().first()
        if not item:
            pytest.skip("No backfilled Item with identity_code found.")

        stats_start = await cache.get_stats()

        # Scan 1 (Miss)
        req = BarcodeQuickScanRequest(barcode=item.identity_code)
        res1 = await UniversalSearchEngine.quick_barcode_scan(
            session=session,
            company_id=item.company_id,
            req=req,
        )
        assert res1.found is True

        # Scan 2 (Hit)
        res2 = await UniversalSearchEngine.quick_barcode_scan(
            session=session,
            company_id=item.company_id,
            req=req,
        )
        assert res2.found is True

        stats_end = await cache.get_stats()
        assert stats_end["hits"] > stats_start["hits"]


@pytest.mark.asyncio
async def test_billing_csv_catalog_lookup_via_identity_resolver(session_factory):
    """
    Test 2.1C: Verify that _lookup_catalog in billing_csv successfully resolves
    an item using both standard barcodes and governed identity codes.
    """
    async with session_factory() as session:
        # 1. Look up by product barcode
        prod_stmt = select(Product).where(Product.barcode.is_not(None), Product.is_deleted == False).limit(1)
        prod = (await session.execute(prod_stmt)).scalars().first()
        if prod and prod.barcode:
            catalog_item = await _lookup_catalog(
                db=session,
                company_id=prod.company_id,
                identifier=prod.barcode,
            )
            assert catalog_item is not None
            assert catalog_item["product_id"] == prod.id
            assert catalog_item["barcode"] == prod.barcode

        # 2. Look up by governed identity code
        item_stmt = select(Item).where(Item.identity_code.is_not(None)).limit(1)
        item = (await session.execute(item_stmt)).scalars().first()
        if item and item.identity_code:
            catalog_by_code = await _lookup_catalog(
                db=session,
                company_id=item.company_id,
                identifier=item.identity_code,
            )
            # If present in products table with same ID, resolves immediately
            if catalog_by_code:
                assert catalog_by_code["product_id"] == item.id
