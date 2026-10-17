"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.7
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

R-01 Tracking Concurrency Verification Suite
============================================
Proves Requirement 1:
- Exactly 1 row created under concurrent execution with 3+ workers.
- All workers resolve the exact same entity ID.
- No IntegrityError escapes the tracking resolver.
- Caller transaction remains usable after savepoint rollback.
- Multi-tenant isolation remains strictly intact.
"""

from __future__ import annotations

import asyncio
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.db.session import get_company_sessionmaker
from app.models.item_master import Item, ItemBatch, ItemSerial, ItemWarehouseLocation
from app.services.identity.engine import IdentityEngine
from app.services.item.item_tracking_svc import ItemTrackingService


@pytest.mark.asyncio
async def test_concurrent_batch_resolution_3_workers():
    """
    Verify 4 concurrent workers attempting to create the same ItemBatch:
    1. Exactly one row created.
    2. All workers resolve the same batch ID.
    3. No IntegrityError escapes.
    4. Caller transaction remains usable after race condition.
    5. Tenant isolation remains intact.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    comp_a = "COMP-001"
    comp_b = "COMP-002"
    batch_num = f"BAT-CONCUR-{suffix}"

    # 1. Setup base Item in COMP-001
    async with sessionmaker() as setup_session:
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=comp_a,
            branch_id="BR-MAIN-001",
            item_code=f"ITM-BCON-{suffix}",
            item_name=f"Batch Concurrency Item {suffix}",
            category="APPAREL",
            brand="SMRITI",
            primary_uom="PCS",
            uom="PCS",
            selling_price=Decimal("100.00"),
            cost_price=Decimal("50.00"),
            mrp=Decimal("100.00"),
            tax_rate=Decimal("12.00"),
            is_active=True,
            is_deleted=False,
        )
        setup_session.add(item)
        await setup_session.commit()
        item_id = item.id

    # 2. Define worker task running in independent sessions
    async def _worker(worker_idx: int):
        async with sessionmaker() as session:
            # Caller starts transaction
            batch = await ItemTrackingService.resolve_or_create_batch(
                session=session,
                item_id=item_id,
                batch_number=batch_num,
                company_id=comp_a,
                branch_id="BR-MAIN-001",
                mrp=Decimal("100.00"),
                cost_price=Decimal("50.00"),
                auto_commit=True,
            )
            # Verify caller transaction remains usable: perform query
            verify_res = (await session.execute(
                select(ItemBatch).where(ItemBatch.id == batch.id)
            )).scalar_one_or_none()
            assert verify_res is not None, f"Worker {worker_idx} caller transaction corrupted"
            return worker_idx, batch.id

    # 3. Launch 4 concurrent workers simultaneously
    results = await asyncio.gather(
        _worker(0),
        _worker(1),
        _worker(2),
        _worker(3),
        return_exceptions=False,
    )

    # 4. Prove: all workers resolved without IntegrityError
    assert len(results) == 4
    resolved_ids = [r[1] for r in results]

    # 5. Prove: all workers resolve the EXACT same batch ID
    assert len(set(resolved_ids)) == 1, f"Workers resolved differing IDs: {resolved_ids}"
    canonical_batch_id = resolved_ids[0]

    # 6. Prove: exactly one row exists in the database
    async with sessionmaker() as verify_session:
        count_stmt = select(ItemBatch).where(
            ItemBatch.item_id == item_id,
            ItemBatch.batch_number == batch_num,
            ItemBatch.is_deleted == False,
        )
        rows = (await verify_session.execute(count_stmt)).scalars().all()
        assert len(rows) == 1, f"Expected 1 row, found {len(rows)}"
        assert rows[0].id == canonical_batch_id

        # 7. Prove: Tenant isolation remains intact
        tenant_stmt = select(ItemBatch).where(
            ItemBatch.batch_number == batch_num,
            ItemBatch.company_id == comp_b,
            ItemBatch.is_deleted == False,
        )
        tenant_rows = (await verify_session.execute(tenant_stmt)).scalars().all()
        assert len(tenant_rows) == 0, f"Tenant leakage: found rows in {comp_b}"


@pytest.mark.asyncio
async def test_concurrent_serial_resolution_3_workers():
    """
    Verify 4 concurrent workers attempting to create the same ItemSerial:
    1. Exactly one row created.
    2. All workers resolve the same serial ID.
    3. No IntegrityError escapes.
    4. Caller transaction remains usable.
    5. Tenant isolation intact.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    comp_a = "COMP-001"
    comp_b = "COMP-002"
    serial_num = f"SER-CONCUR-{suffix}"

    async with sessionmaker() as setup_session:
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=comp_a,
            branch_id="BR-MAIN-001",
            item_code=f"ITM-SCON-{suffix}",
            item_name=f"Serial Concurrency Item {suffix}",
            category="ELECTRONICS",
            brand="SMRITI",
            primary_uom="PCS",
            uom="PCS",
            selling_price=Decimal("5000.00"),
            cost_price=Decimal("3500.00"),
            mrp=Decimal("5000.00"),
            tax_rate=Decimal("18.00"),
            is_active=True,
            is_deleted=False,
        )
        setup_session.add(item)
        await setup_session.commit()
        item_id = item.id

    async def _worker(worker_idx: int):
        async with sessionmaker() as session:
            ser = await ItemTrackingService.resolve_or_create_serial(
                session=session,
                item_id=item_id,
                serial_number=serial_num,
                company_id=comp_a,
                branch_id="BR-MAIN-001",
                auto_commit=True,
            )
            # Verify caller transaction remains usable
            verify_res = (await session.execute(
                select(ItemSerial).where(ItemSerial.id == ser.id)
            )).scalar_one_or_none()
            assert verify_res is not None, f"Worker {worker_idx} caller transaction corrupted"
            return worker_idx, ser.id

    results = await asyncio.gather(
        _worker(0),
        _worker(1),
        _worker(2),
        _worker(3),
        return_exceptions=False,
    )

    assert len(results) == 4
    resolved_ids = [r[1] for r in results]
    assert len(set(resolved_ids)) == 1, f"Workers resolved differing IDs: {resolved_ids}"
    canonical_serial_id = resolved_ids[0]

    async with sessionmaker() as verify_session:
        count_stmt = select(ItemSerial).where(
            ItemSerial.item_id == item_id,
            ItemSerial.serial_number == serial_num,
            ItemSerial.is_deleted == False,
        )
        rows = (await verify_session.execute(count_stmt)).scalars().all()
        assert len(rows) == 1, f"Expected 1 row, found {len(rows)}"
        assert rows[0].id == canonical_serial_id

        # Tenant isolation
        tenant_stmt = select(ItemSerial).where(
            ItemSerial.serial_number == serial_num,
            ItemSerial.company_id == comp_b,
            ItemSerial.is_deleted == False,
        )
        tenant_rows = (await verify_session.execute(tenant_stmt)).scalars().all()
        assert len(tenant_rows) == 0, f"Tenant leakage: found rows in {comp_b}"


@pytest.mark.asyncio
async def test_concurrent_warehouse_location_resolution_3_workers():
    """
    Verify 4 concurrent workers attempting to create the same ItemWarehouseLocation:
    1. Exactly one row created.
    2. All workers resolve the same location ID.
    3. No IntegrityError escapes.
    4. Caller transaction remains usable.
    5. Tenant isolation intact.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    comp_a = "COMP-001"
    comp_b = "COMP-002"
    wh_id = f"wh-concur-{suffix}"

    async with sessionmaker() as setup_session:
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=comp_a,
            branch_id="BR-MAIN-001",
            item_code=f"ITM-LCON-{suffix}",
            item_name=f"Location Concurrency Item {suffix}",
            category="GENERAL",
            brand="SMRITI",
            primary_uom="PCS",
            uom="PCS",
            selling_price=Decimal("150.00"),
            cost_price=Decimal("75.00"),
            mrp=Decimal("150.00"),
            tax_rate=Decimal("12.00"),
            is_active=True,
            is_deleted=False,
        )
        setup_session.add(item)
        await setup_session.commit()
        item_id = item.id

    async def _worker(worker_idx: int):
        async with sessionmaker() as session:
            loc = await ItemTrackingService.resolve_or_create_warehouse_location(
                session=session,
                item_id=item_id,
                warehouse_id=wh_id,
                company_id=comp_a,
                branch_id="BR-MAIN-001",
                location_bin="BIN-A1",
                auto_commit=True,
            )
            # Verify caller transaction remains usable
            verify_res = (await session.execute(
                select(ItemWarehouseLocation).where(ItemWarehouseLocation.id == loc.id)
            )).scalar_one_or_none()
            assert verify_res is not None, f"Worker {worker_idx} caller transaction corrupted"
            return worker_idx, loc.id

    results = await asyncio.gather(
        _worker(0),
        _worker(1),
        _worker(2),
        _worker(3),
        return_exceptions=False,
    )

    assert len(results) == 4
    resolved_ids = [r[1] for r in results]
    assert len(set(resolved_ids)) == 1, f"Workers resolved differing IDs: {resolved_ids}"
    canonical_loc_id = resolved_ids[0]

    async with sessionmaker() as verify_session:
        count_stmt = select(ItemWarehouseLocation).where(
            ItemWarehouseLocation.item_id == item_id,
            ItemWarehouseLocation.warehouse_id == wh_id,
            ItemWarehouseLocation.is_deleted == False,
        )
        rows = (await verify_session.execute(count_stmt)).scalars().all()
        assert len(rows) == 1, f"Expected 1 row, found {len(rows)}"
        assert rows[0].id == canonical_loc_id

        # Tenant isolation
        tenant_stmt = select(ItemWarehouseLocation).where(
            ItemWarehouseLocation.warehouse_id == wh_id,
            ItemWarehouseLocation.company_id == comp_b,
            ItemWarehouseLocation.is_deleted == False,
        )
        tenant_rows = (await verify_session.execute(tenant_stmt)).scalars().all()
        assert len(tenant_rows) == 0, f"Tenant leakage: found rows in {comp_b}"
