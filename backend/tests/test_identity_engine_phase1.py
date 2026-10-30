"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.42.1
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture

Automated Pytest Suite for SMRITI Unified Identity Phase 1 Architecture Verification.

Fix v6.42.1:
- Tests 1 & 2 use an ephemeral test-scoped company_id so they never collide with
  live COMP-001 sequences. Created test items are cleaned up on teardown.
- Test 5 corrects POS_SESSION → POS_SHIFT (actual live registry entity type).
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


# ---------------------------------------------------------------------------
# Test 1 — UUIDv7 technical ID and MST-ITM-* identity_code via allocate_internal
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_uuidv7_generated_for_new_item():
    """
    Test 1: Verify that IdentityEngine.allocate_internal for entity_type ITEM
    returns a valid RFC 9562 UUIDv7 technical ID and a governed identity_code
    conforming to the MST-ITM-{seq:08d} pattern.

    Uses an ephemeral test tenant to avoid collisions with live sequences.
    Validates service-layer wiring without inserting into the live items table
    (which carries a global uq_items_identity_code unique constraint).
    """
    test_tenant = f"tnt_test1_{uuid7()[:8]}"
    try:
        async with async_session() as session:
            async with session.begin():
                tech_id, identity_code = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="ITEM",
                    tenant_id=test_tenant,
                    company_id=test_tenant,
                )

            assert tech_id is not None
            assert is_valid_uuidv7(tech_id), f"tech_id '{tech_id}' must be a valid RFC 9562 UUIDv7"
            assert identity_code is not None, "identity_code must be populated"
            assert identity_code.startswith("MST-ITM-"), f"identity_code '{identity_code}' must start with 'MST-ITM-'"
            assert re.match(r"^MST-ITM-\d{8}$", identity_code), f"identity_code '{identity_code}' must match MST-ITM-00000000 format"
    finally:
        async with async_session() as cleanup:
            async with cleanup.begin():
                await cleanup.execute(
                    delete(SmritiIdentityAllocationLog).where(SmritiIdentityAllocationLog.tenant_id == test_tenant)
                )
                await cleanup.execute(
                    delete(SmritiNumberingRegistry).where(SmritiNumberingRegistry.tenant_id == test_tenant)
                )


# ---------------------------------------------------------------------------
# Test 2 — MST-ITM-{seq:08d} format and sequential guarantee
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_identity_code_mst_itm_format():
    """
    Test 2: Verify that two sequential allocations for entity_type ITEM within
    the same tenant produce strictly consecutive MST-ITM-{seq:08d} codes.
    Confirms both UUIDv7 IDs and identity code format without inserting into items.
    """
    test_tenant = f"tnt_test2_{uuid7()[:8]}"
    try:
        async with async_session() as session:
            async with session.begin():
                tech_id_1, code_1 = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="ITEM",
                    tenant_id=test_tenant,
                    company_id=test_tenant,
                )
                tech_id_2, code_2 = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="ITEM",
                    tenant_id=test_tenant,
                    company_id=test_tenant,
                )

            assert is_valid_uuidv7(tech_id_1), f"tech_id_1 '{tech_id_1}' must be valid UUIDv7"
            assert is_valid_uuidv7(tech_id_2), f"tech_id_2 '{tech_id_2}' must be valid UUIDv7"
            assert tech_id_1 != tech_id_2, "Both technical IDs must be unique"
            assert re.match(r"^MST-ITM-\d{8}$", code_1), f"Expected MST-ITM-00000000 format, got '{code_1}'"
            assert re.match(r"^MST-ITM-\d{8}$", code_2), f"Expected MST-ITM-00000000 format, got '{code_2}'"
            seq_1 = int(code_1.split("-")[-1])
            seq_2 = int(code_2.split("-")[-1])
            assert seq_2 == seq_1 + 1, f"Expected consecutive codes: {code_1} -> {code_2}"
    finally:
        async with async_session() as cleanup:
            async with cleanup.begin():
                await cleanup.execute(
                    delete(SmritiIdentityAllocationLog).where(SmritiIdentityAllocationLog.tenant_id == test_tenant)
                )
                await cleanup.execute(
                    delete(SmritiNumberingRegistry).where(SmritiNumberingRegistry.tenant_id == test_tenant)
                )



# ---------------------------------------------------------------------------
# Test 3 — Existing items backfilled with MST-ITM identity codes
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Test 4 — Atomic high-concurrency allocation with zero collision guarantee
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Test 5 — Registry seed completeness verification (21 canonical entity types)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_identity_registry_seed_complete():
    """
    Test 5: Verify that the canonical SMRITI entity registry contains all
    governed entity types in ACTIVE status.
    Live registry (smriti001) has 21 active entities as of Migration v1464/v1465.
    POS_SHIFT (POS-SFT) is the canonical POS session entity — not POS_SESSION.
    """
    async with async_session() as session:
        stmt = select(SmritiIdentityRegistry.entity_type, SmritiIdentityRegistry.identity_code_prefix).where(
            SmritiIdentityRegistry.status == "ACTIVE"
        )
        res = await session.execute(stmt)
        active_registry = dict(res.fetchall())

        # Canonical required entities — verified against live smriti001 registry
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
            "POS_SHIFT",          # Canonical POS entity (was incorrectly listed as POS_SESSION)
        ]

        for entity in required_entities:
            assert entity in active_registry, f"Required entity '{entity}' must be registered and active. Active registry: {list(active_registry.keys())}"

        assert active_registry["ITEM"] == "MST-ITM", f"ITEM prefix must be MST-ITM, got {active_registry['ITEM']}"
        assert active_registry["CUSTOMER"] == "CRM-CUS", f"CUSTOMER prefix must be CRM-CUS, got {active_registry['CUSTOMER']}"
        assert active_registry["SALES_INVOICE"] == "SAL-INV", f"SALES_INVOICE prefix must be SAL-INV, got {active_registry['SALES_INVOICE']}"
        assert active_registry["POS_SHIFT"] == "POS-SFT", f"POS_SHIFT prefix must be POS-SFT, got {active_registry.get('POS_SHIFT')}"
        assert len(active_registry) >= 20, f"Expected at least 20 active entity types, got {len(active_registry)}"
