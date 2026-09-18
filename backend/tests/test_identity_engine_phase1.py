"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.42.0
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture

Automated Pytest Suite for SMRITI Unified Identity Phase 1 Architecture Verification.
"""

import sys
import re
import asyncio
import pytest
from pathlib import Path
from decimal import Decimal
from sqlalchemy import select, text, delete
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Ensure backend and workspace are on path
workspace_root = Path(__file__).resolve().parents[1]
backend_dir = workspace_root / "backend"
for p in [str(workspace_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.core.config import settings
from app.db.session import async_session
from app.services.identity.uuid7 import is_valid_uuidv7, uuid7
from app.services.identity.engine import IdentityEngine
from app.services.item_master_svc import UniversalItemMasterService
from app.schemas.item_master import ItemCreateRequest
from app.models.item_master import Item
from app.models.identity_registry import (
    SmritiIdentityRegistry,
    SmritiNumberingRegistry,
    SmritiIdentityAllocationLog,
)


@pytest.mark.asyncio
async def test_uuidv7_generated_for_new_item():
    """
    Test 1: Verify that creating a new item via ItemCreateRequest allocates
    a valid RFC 9562 UUIDv7 technical ID and governed identity_code.
    """
    async with async_session() as session:
        suffix = uuid7()[:8]
        sku = f"ITM-TEST-{suffix.upper()}"
        barcode = f"BC{suffix.upper()}"
        req = ItemCreateRequest(
            item_code=sku,
            item_name=f"Test Unified Identity Item {suffix}",
            category="Footwear",
            department="Men",
            tax_rate=18.0,
            mrp=1999.00,
            selling_price=1499.00,
            cost_price=800.00,
            primary_barcode=barcode,
            barcodes=[],
            variants=[],
        )

        item = await UniversalItemMasterService.create_item(
            session=session,
            req=req,
            company_id="COMP-001",
            commit=True,
        )

        assert item is not None
        assert item.id is not None
        assert is_valid_uuidv7(item.id), f"item.id '{item.id}' must be a valid RFC 9562 UUIDv7"
        assert item.identity_code is not None, "item.identity_code must be populated"
        assert item.identity_code.startswith("MST-ITM-"), f"item.identity_code '{item.identity_code}' must start with 'MST-ITM-'"
        assert re.match(r"^MST-ITM-\d{8}$", item.identity_code), f"item.identity_code '{item.identity_code}' must match MST-ITM-00000000 format"


@pytest.mark.asyncio
async def test_identity_code_mst_itm_format():
    """
    Test 2: Verify that direct parameter item creation allocates a sequential
    identity code strictly conforming to the MST-ITM-{seq:08d} format.
    """
    async with async_session() as session:
        suffix = uuid7()[:8]
        clean_code = f"SKU-DIRECT-{suffix.upper()}"

        item = await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code=clean_code,
            item_name=f"Direct Parameter Item {suffix}",
            category="Footwear",
            tax_rate=18.00,
            mrp=2499.00,
            selling_price=1899.00,
            cost_price=1000.00,
            commit=True,
        )

        assert item is not None
        assert is_valid_uuidv7(item.id), f"Direct created item.id '{item.id}' must be valid UUIDv7"
        assert item.identity_code is not None
        assert re.match(r"^MST-ITM-\d{8}$", item.identity_code), f"Expected MST-ITM-00000000 format, got '{item.identity_code}'"


@pytest.mark.asyncio
async def test_existing_items_backfilled_with_identity_code():
    """
    Test 3: Verify that existing items in the database have been backfilled
    with valid MST-ITM sequential identity codes (Migration v1465 parity).
    """
    async with async_session() as session:
        # Check count of backfilled items
        res = await session.execute(
            text("SELECT count(*) FROM items WHERE identity_code IS NOT NULL")
        )
        count_with_code = res.scalar()
        assert count_with_code > 0, "Expected existing items with backfilled identity_code"

        # Check sample of backfilled items
        sample_res = await session.execute(
            text("SELECT id, item_code, identity_code FROM items WHERE identity_code IS NOT NULL LIMIT 20")
        )
        rows = sample_res.fetchall()
        for row in rows:
            _, item_code, id_code = row
            assert id_code.startswith("MST-ITM-"), f"Item {item_code} has invalid code '{id_code}'"
            assert re.match(r"^MST-ITM-\d{8}$", id_code), f"Item {item_code} format invalid: '{id_code}'"


@pytest.mark.asyncio
async def test_numbering_registry_atomic_no_collision():
    """
    Test 4: High-concurrency atomic counter test.
    Executes 100 concurrent async allocations against the PostgreSQL numbering
    registry using SELECT ... FOR UPDATE.
    Guarantees:
    - 100/100 allocations succeed
    - Exactly 100 unique UUIDv7 technical IDs
    - Exactly 100 unique identity codes
    - Exactly sequential 1 to 100 with zero gaps, duplicates, or race collisions.
    """
    test_engine = create_async_engine(settings.DATABASE_URL, pool_size=15, max_overflow=10)
    session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)

    test_tenant = f"tnt_phase1_concurrency_{uuid7()[:8]}"
    entity_type = "ITEM"
    sem = asyncio.Semaphore(15)

    async def allocate_worker(worker_id: int):
        async with sem:
            async with session_factory() as session:
                async with session.begin():
                    tech_id, code = await IdentityEngine.generate_identity(
                        session=session,
                        entity_type=entity_type,
                        tenant_id=test_tenant,
                        purpose="CONCURRENCY_TEST_PHASE1",
                        correlation_id=f"worker_{worker_id}",
                    )
                return worker_id, tech_id, code

    try:
        tasks = [allocate_worker(i) for i in range(1, 101)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 100, f"Expected 100 results, got {len(results)}"

        tech_ids = [r[1] for r in results]
        codes = [r[2] for r in results]

        # 1. 100 unique technical IDs (UUIDv7)
        assert len(set(tech_ids)) == 100, "All 100 technical IDs must be unique"
        for tid in tech_ids:
            assert is_valid_uuidv7(tid), f"'{tid}' must be valid UUIDv7"

        # 2. 100 unique identity codes
        assert len(set(codes)) == 100, "All 100 identity codes must be unique"

        # 3. Consecutive 1..100 without gaps
        sequences = sorted([int(c.split("-")[-1]) for c in codes])
        assert sequences == list(range(1, 101)), f"Sequences must be 1..100 consecutive. Got min {sequences[0]}, max {sequences[-1]}"

    finally:
        async with session_factory() as cleanup_session:
            async with cleanup_session.begin():
                await cleanup_session.execute(
                    delete(SmritiIdentityAllocationLog).where(SmritiIdentityAllocationLog.tenant_id == test_tenant)
                )
                await cleanup_session.execute(
                    delete(SmritiNumberingRegistry).where(SmritiNumberingRegistry.tenant_id == test_tenant)
                )
        await test_engine.dispose()


@pytest.mark.asyncio
async def test_identity_registry_seed_complete():
    """
    Test 5: Verify that the canonical SMRITI entity registry contains all
    governed entity types in ACTIVE status.
    """
    async with async_session() as session:
        stmt = select(SmritiIdentityRegistry.entity_type, SmritiIdentityRegistry.identity_code_prefix).where(
            SmritiIdentityRegistry.status == "ACTIVE"
        )
        res = await session.execute(stmt)
        active_registry = dict(res.fetchall())

        # Canonical required entities
        required_entities = [
            "COMPANY",
            "BRANCH",
            "ITEM",
            "CUSTOMER",
            "SUPPLIER",
            "SALES_INVOICE",
            "PURCHASE_ORDER",
            "PURCHASE_RECEIPT",
            "WAREHOUSE",
            "STOCK_MOVEMENT",
            "POS_SESSION",
        ]

        for entity in required_entities:
            assert entity in active_registry, f"Required entity '{entity}' must be registered and active"

        assert active_registry["ITEM"] == "MST-ITM", f"ITEM prefix must be MST-ITM, got {active_registry['ITEM']}"
        assert active_registry["CUSTOMER"] == "CRM-CUS", f"CUSTOMER prefix must be CRM-CUS, got {active_registry['CUSTOMER']}"
        assert active_registry["SALES_INVOICE"] == "SAL-INV", f"SALES_INVOICE prefix must be SAL-INV, got {active_registry['SALES_INVOICE']}"
        assert len(active_registry) >= 20, f"Expected at least 20 active entity types, got {len(active_registry)}"
