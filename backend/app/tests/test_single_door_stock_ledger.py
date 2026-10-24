"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Single-Door Stock Ledger Comprehensive Verification Test Suite
"""

import asyncio
import uuid
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import select, update, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Company, Branch
from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
from app.services.stock_ledger import StockLedger, MovementRequest, InternalCost
from app.services.stock_synchronizer import StockSynchronizer

pytestmark = pytest.mark.asyncio


async def _setup_single_door_env(db_session, suffix: str):
    comp = Company(
        id=f"comp-sd-{suffix}",
        name=f"SingleDoor Co {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-sd-{suffix}",
        company_id=comp.id,
        name=f"Branch {suffix}",
        code=f"BR-{suffix}",
        is_active=True,
    )
    db_session.add_all([comp, branch])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh-sd-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"WH-{suffix}",
        name=f"Warehouse {suffix}",
        is_active=True,
    )
    db_session.add(warehouse)
    await db_session.flush()

    # Product 1
    p1 = Product(
        id=f"prod-sd-1-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"SKU-1-{suffix}",
        sku=f"SKU-1-{suffix}",
        barcode=f"BAR-1-{suffix}",
        name=f"Product 1 {suffix}",
        category="General",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        cost_price=Decimal("50.00"),
        stock=0,
        tracking_mode="Normal",
        is_active=True,
    )
    # Product 2
    p2 = Product(
        id=f"prod-sd-2-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"SKU-2-{suffix}",
        sku=f"SKU-2-{suffix}",
        barcode=f"BAR-2-{suffix}",
        name=f"Product 2 {suffix}",
        category="General",
        price=Decimal("150.00"),
        mrp=Decimal("150.00"),
        cost_price=Decimal("75.00"),
        stock=0,
        tracking_mode="Normal",
        is_active=True,
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    return comp, branch, warehouse, p1, p2


async def test_single_door_idempotency_same_payload_replays_cleanly(db_session):
    """
    Section B.2 & B.5: Posting the exact same movement twice returns the existing
    movement with replayed=True and creates only 1 row.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)

    req1 = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="INWARD_GRN",
        quantity=Decimal("10.00"),
        reference_doc_type="PURCHASE_RECEIPT",
        reference_doc_id=f"GRN-{s}",
        warehouse_id=wh.id,
        line_ref="LINE-1",
    )

    res1 = await StockLedger.post(db_session, req1)
    await db_session.commit()

    assert res1.replayed is False
    assert res1.product_balance_after == Decimal("10.00")

    # Post identical second time
    res2 = await StockLedger.post(db_session, req1)
    await db_session.commit()

    assert res2.replayed is True
    assert res2.movement.id == res1.movement.id
    assert res2.product_balance_after == Decimal("10.00")

    # Verify only 1 movement in database
    moves = (
        await db_session.execute(
            select(StockMovement).where(StockMovement.product_id == p1.id)
        )
    ).scalars().all()
    assert len(moves) == 1


async def test_single_door_idempotency_different_payload_raises_409(db_session):
    """
    Section B.2 & B.5: Same key + different payload_hash (e.g. quantity changed)
    must raise 409 IDEMPOTENCY_CONFLICT.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)

    req1 = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="INWARD_GRN",
        quantity=Decimal("10.00"),
        reference_doc_type="PURCHASE_RECEIPT",
        reference_doc_id=f"GRN-{s}",
        warehouse_id=wh.id,
        line_ref="LINE-1",
    )
    await StockLedger.post(db_session, req1)
    await db_session.commit()

    # Conflicting post: same doc, same product, same line, DIFFERENT quantity (15.00)
    req2 = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="INWARD_GRN",
        quantity=Decimal("15.00"),  # Changed!
        reference_doc_type="PURCHASE_RECEIPT",
        reference_doc_id=f"GRN-{s}",
        warehouse_id=wh.id,
        line_ref="LINE-1",
    )

    with pytest.raises(HTTPException) as exc_info:
        await StockLedger.post(db_session, req2)

    assert exc_info.value.status_code == 409
    assert "IDEMPOTENCY_CONFLICT" in exc_info.value.detail


async def test_single_door_legacy_null_key_replay(db_session):
    """
    Section B.3 & B.5: Pre-existing movement with NULL idempotency_key must be recognized
    as a replay and not double-posted.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)

    # Insert legacy movement directly with NULL idempotency_key
    legacy_mov = StockMovement(
        id=f"sm_legacy_{s}",
        company_id=comp.id,
        branch_id=branch.id,
        product_id=p1.id,
        product_name=p1.name,
        sku=p1.sku,
        movement_type="OUTWARD_SALE",
        quantity=Decimal("5.00"),
        reference_doc_type="Sales Invoice",  # Legacy mixed-case spelling
        reference_doc_id=f"INV-{s}",
        idempotency_key=None,  # Legacy row has NULL key
        payload_hash=None,
    )
    db_session.add(legacy_mov)
    await db_session.commit()

    # Post via single door using canonical reference doc type
    req = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="OUTWARD_SALE",
        quantity=Decimal("5.00"),
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=f"INV-{s}",
    )
    result = await StockLedger.post(db_session, req)
    await db_session.commit()

    assert result.replayed is True
    assert result.movement.id == legacy_mov.id

    # Total rows in DB remains 1
    count = (
        await db_session.execute(
            select(func.count(StockMovement.id)).where(StockMovement.product_id == p1.id)
        )
    ).scalar()
    assert count == 1


async def test_single_door_post_many_cumulative_negative_stock(db_session):
    """
    Section C.2 & C.7: post_many validates cumulative negative stock across the batch.
    Product starting with 10 on-hand; requesting 6 then 5 in the same call must be rejected.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)

    # Inward 10
    in_req = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="INWARD_GRN",
        quantity=Decimal("10.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-{s}",
    )
    await StockLedger.post(db_session, in_req)
    await db_session.commit()

    # Outward 6 then Outward 5 (total 11 > 10)
    out1 = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="OUTWARD_SALE",
        quantity=Decimal("6.00"),
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=f"INV1-{s}",
    )
    out2 = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="OUTWARD_SALE",
        quantity=Decimal("5.00"),
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=f"INV2-{s}",
    )

    with pytest.raises(HTTPException) as exc_info:
        await StockLedger.post_many(db_session, [out1, out2])

    assert exc_info.value.status_code == 400
    assert "INSUFFICIENT_STOCK" in exc_info.value.detail


async def test_single_door_same_product_twice_in_one_call(db_session):
    """
    Section C.2 & C.7: The same product appearing multiple times in one post_many call
    succeeds and produces correct balances.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)

    # Inward 10 + Inward 5 in same call
    m1 = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="INWARD_GRN",
        quantity=Decimal("10.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-{s}",
        line_ref="LINE-1",
    )
    m2 = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="INWARD_GRN",
        quantity=Decimal("5.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-{s}",
        line_ref="LINE-2",
    )

    results = await StockLedger.post_many(db_session, [m1, m2])
    await db_session.commit()

    assert len(results) == 2
    assert results[0].product_balance_after == Decimal("10.00")
    assert results[1].product_balance_after == Decimal("15.00")

    # Cached product stock matches 15
    fresh_p1 = (
        await db_session.execute(select(Product).where(Product.id == p1.id))
    ).scalar_one()
    assert fresh_p1.stock == 15


async def test_single_door_admin_opening_stock_and_pure_synchronizer(db_session):
    """
    Section D.2:
    1. sync_product_stock_cache does NOT synthesize OPENING_STOCK when drifted by hand.
    2. post_admin_opening_stock requires reason and creates formal ledger row.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)

    # Hand drift: update product stock to 50
    await db_session.execute(
        update(Product).where(Product.id == p1.id).values(stock=50)
    )
    await db_session.commit()

    # Synchronizer runs: pure recompute sets cache back to 0 (no ledger rows exist)
    computed = await StockSynchronizer.sync_product_stock_cache(db_session, p1.id, comp.id)
    await db_session.commit()

    assert computed == Decimal("0.00")
    fresh_p1 = (
        await db_session.execute(select(Product).where(Product.id == p1.id))
    ).scalar_one()
    assert fresh_p1.stock == 0  # Drift cleared; NO ledger row synthesized!

    moves = (
        await db_session.execute(
            select(StockMovement).where(StockMovement.product_id == p1.id)
        )
    ).scalars().all()
    assert len(moves) == 0

    # Formalize via explicit admin opening balance operation
    # Empty reason must fail
    with pytest.raises(HTTPException):
        await StockLedger.post_admin_opening_stock(
            session=db_session,
            company_id=comp.id,
            product_id=p1.id,
            quantity=Decimal("50.00"),
            reason="",
        )

    # Valid admin operation
    res = await StockLedger.post_admin_opening_stock(
        session=db_session,
        company_id=comp.id,
        product_id=p1.id,
        quantity=Decimal("50.00"),
        reason="Initial physical store count 2026-10",
        warehouse_id=wh.id,
        user_id="U-AUDITOR",
    )
    await db_session.commit()

    assert res.movement.movement_type == "OPENING_STOCK"
    assert res.movement.quantity == Decimal("50.00")
    assert res.product_balance_after == Decimal("50.00")

    fresh_p1_after = (
        await db_session.execute(select(Product).where(Product.id == p1.id))
    ).scalar_one()
    assert fresh_p1_after.stock == 50


async def test_single_door_internal_cost_and_cost_source(db_session):
    """
    Section E.1 & E.2: Typed InternalCost sets unit_cost and cost_source on movement.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)

    req = MovementRequest(
        company_id=comp.id,
        product_id=p1.id,
        movement_type="INWARD_GRN",
        quantity=Decimal("20.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-{s}",
        internal_cost=InternalCost(
            unit_cost=Decimal("42.50"),
            cost_source="COST_SNAPSHOT",
        ),
    )
    res = await StockLedger.post(db_session, req)
    await db_session.commit()

    assert res.movement.unit_cost == Decimal("42.50")
    assert res.movement.cost_source == "COST_SNAPSHOT"


async def test_single_door_rollback_then_retry_succeeds(db_session):
    """
    Section B: If a transaction attempting StockLedger.post rolls back, retrying with the same
    idempotency key must succeed without false 409 and create 1 movement row.
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, _ = await _setup_single_door_env(db_session, s)
    p1_id = p1.id
    comp_id = comp.id
    wh_id = wh.id

    req = MovementRequest(
        company_id=comp_id,
        product_id=p1_id,
        movement_type="INWARD_GRN",
        quantity=Decimal("15.00"),
        reference_doc_type="PURCHASE_RECEIPT",
        reference_doc_id=f"GRN-ABORT-{s}",
        warehouse_id=wh_id,
        line_ref="LINE-1",
    )
    res_first = await StockLedger.post(db_session, req)
    assert res_first.replayed is False
    # Simulate transaction abort before commit
    await db_session.rollback()

    # Verify no movement was saved
    moves_after_rollback = (
        await db_session.execute(
            select(StockMovement).where(StockMovement.product_id == p1_id)
        )
    ).scalars().all()
    assert len(moves_after_rollback) == 0

    # Retry the exact same request
    res_retry = await StockLedger.post(db_session, req)
    await db_session.commit()

    assert res_retry.replayed is False
    assert res_retry.product_balance_after == Decimal("15.00")

    moves_final = (
        await db_session.execute(
            select(StockMovement).where(StockMovement.product_id == p1_id)
        )
    ).scalars().all()
    assert len(moves_final) == 1
    assert moves_final[0].quantity == Decimal("15.00")


async def test_single_door_pydantic_rejects_client_unit_cost():
    """
    Section E: StockMovementCreate must reject client-supplied unit_cost with 422.
    """
    from pydantic import ValidationError
    from app.schemas.inventory import StockMovementCreate

    with pytest.raises(ValidationError) as exc_info:
        StockMovementCreate(
            product_id="prod-123",
            product_name="Sample Item",
            sku="SKU-123",
            movement_type="INWARD_GRN",
            quantity=Decimal("10.00"),
            unit_cost=Decimal("50.00"),
        )
    errors = exc_info.value.errors()
    assert any("unit_cost cannot be set by client payload" in str(e["msg"]) for e in errors)


async def test_single_door_concurrent_post_many_deadlock_free(db_engine, db_session):
    """
    Section D: Deterministic sorting of product IDs in StockLedger.post_many
    prevents deadlocks when concurrent transactions lock overlapping products
    in reverse order ([P1, P2] vs [P2, P1]).
    """
    s = uuid.uuid4().hex[:6]
    comp, branch, wh, p1, p2 = await _setup_single_door_env(db_session, s)
    comp_id = comp.id
    wh_id = wh.id
    p1_id = p1.id
    p2_id = p2.id

    # Initial stock so outflows don't violate negative balance checks
    init_items = [
        MovementRequest(
            company_id=comp_id,
            product_id=p1_id,
            movement_type="INWARD_GRN",
            quantity=Decimal("100.00"),
            reference_doc_type="SETUP",
            reference_doc_id=f"INIT-{s}-1",
            warehouse_id=wh_id,
        ),
        MovementRequest(
            company_id=comp_id,
            product_id=p2_id,
            movement_type="INWARD_GRN",
            quantity=Decimal("100.00"),
            reference_doc_type="SETUP",
            reference_doc_id=f"INIT-{s}-2",
            warehouse_id=wh_id,
        ),
    ]
    await StockLedger.post_many(db_session, init_items)
    await db_session.commit()

    async_session_maker = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )

    # TX1 requests [P1, P2]
    # TX2 requests [P2, P1]
    async def run_tx1():
        async with async_session_maker() as s1:
            reqs = [
                MovementRequest(
                    company_id=comp_id,
                    product_id=p1_id,
                    movement_type="OUTWARD_SALE",
                    quantity=Decimal("5.00"),
                    reference_doc_type="SALE",
                    reference_doc_id=f"TX1-{s}",
                    warehouse_id=wh_id,
                    line_ref="L1",
                ),
                MovementRequest(
                    company_id=comp_id,
                    product_id=p2_id,
                    movement_type="OUTWARD_SALE",
                    quantity=Decimal("5.00"),
                    reference_doc_type="SALE",
                    reference_doc_id=f"TX1-{s}",
                    warehouse_id=wh_id,
                    line_ref="L2",
                ),
            ]
            res = await StockLedger.post_many(s1, reqs)
            await s1.commit()
            return res

    async def run_tx2():
        async with async_session_maker() as s2:
            # Reversed product order
            reqs = [
                MovementRequest(
                    company_id=comp_id,
                    product_id=p2_id,
                    movement_type="OUTWARD_SALE",
                    quantity=Decimal("10.00"),
                    reference_doc_type="SALE",
                    reference_doc_id=f"TX2-{s}",
                    warehouse_id=wh_id,
                    line_ref="L2",
                ),
                MovementRequest(
                    company_id=comp_id,
                    product_id=p1_id,
                    movement_type="OUTWARD_SALE",
                    quantity=Decimal("10.00"),
                    reference_doc_type="SALE",
                    reference_doc_id=f"TX2-{s}",
                    warehouse_id=wh_id,
                    line_ref="L1",
                ),
            ]
            res = await StockLedger.post_many(s2, reqs)
            await s2.commit()
            return res

    # Run both concurrently; must complete without deadlock
    res1, res2 = await asyncio.gather(run_tx1(), run_tx2())
    assert len(res1) == 2
    assert len(res2) == 2

    # Reset db_session transaction snapshot to read externally committed changes
    await db_session.rollback()
    db_session.expunge_all()

    fresh_p1 = (
        await db_session.execute(select(Product).where(Product.id == p1_id))
    ).scalar_one()
    fresh_p2 = (
        await db_session.execute(select(Product).where(Product.id == p2_id))
    ).scalar_one()

    # P1: 100 - 5 - 10 = 85
    # P2: 100 - 5 - 10 = 85
    assert fresh_p1.stock == 85
    assert fresh_p2.stock == 85

