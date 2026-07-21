"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_stock_audit.py — Integration test suite for Phase 12 (v8.0.0)
Inventory Physical Stock Audit & Cycle Counting Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.inventory import Product, StockCount, StockAdjustment
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.stock_audit_engine import StockAuditEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_audit_tenant(db):
    """Set up an isolated tenant for Stock Audit test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-aud-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-aud-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Stock Audit Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Audit HQ", code=f"AHQ{uuid.uuid4().hex[:8].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_product(db, tenant_ctx, stock=50, price=Decimal("100.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-aud-{uuid.uuid4().hex[:8]}",
        code=f"AUDPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"Audit Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="L",
        barcode=f"BC-AUD-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    product.stock = stock
    db.add(product)
    await db.flush()
    return product


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Create Stock Count Session
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_stock_count_session(db_session):
    """
    Assertion 1: Creating a draft stock count session snapshots current system stock per product.
    """
    company_id, branch_id, tenant = await _setup_audit_tenant(db_session)
    p1 = await _make_product(db_session, tenant, stock=50, price=Decimal("100.00"), code_suffix="A1")
    p2 = await _make_product(db_session, tenant, stock=30, price=Decimal("200.00"), code_suffix="A2")

    engine = StockAuditEngine(db_session, tenant)
    count_session = await engine.create_stock_count(name="Annual Warehouse Audit 2026", count_type="Full")

    assert count_session is not None
    assert count_session.status == "Draft"
    assert count_session.total_items == 2

    items = count_session.items
    p_map = {i.product_id: i for i in items}
    assert p_map[p1.id].system_stock == Decimal("50.0000")
    assert p_map[p2.id].system_stock == Decimal("30.0000")

    print("\n[PASS] Assertion 1: Draft stock count session created and system stock snapshotted")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Record Physical Counts and Calculate Variances
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_record_physical_counts_calculates_variance(db_session):
    """
    Assertion 2: Recording physical counts calculates quantity and financial value variances.
    """
    company_id, branch_id, tenant = await _setup_audit_tenant(db_session)
    p1 = await _make_product(db_session, tenant, stock=50, price=Decimal("100.00"), code_suffix="B1")  # cost=100
    p2 = await _make_product(db_session, tenant, stock=30, price=Decimal("200.00"), code_suffix="B2")  # cost=200

    engine = StockAuditEngine(db_session, tenant)
    count_session = await engine.create_stock_count(name="Cycle Count Q3", count_type="Selective")

    # Record physical counts: P1 physical = 48 (-2 var, -200 val), P2 physical = 35 (+5 var, +1000 val)
    updated_session = await engine.record_physical_counts(
        count_id=count_session.id,
        line_counts=[
            {"product_id": p1.id, "physical_count": Decimal("48.00")},
            {"product_id": p2.id, "physical_count": Decimal("35.00")}
        ]
    )

    assert updated_session.status == "Counting"
    assert updated_session.total_variance_qty == Decimal("3.0000")  # -2 + 5 = 3
    assert updated_session.total_variance_value == Decimal("800.00")  # -200 + 1000 = 800

    print("\n[PASS] Assertion 2: Physical counts recorded and variances calculated correctly")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Reconcile Stock Count Updates Product.stock Directly
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reconcile_stock_count_updates_product_stock(db_session):
    """
    Assertion 3: Reconciling stock audit updates Product.stock directly to equal verified physical count.
    """
    company_id, branch_id, tenant = await _setup_audit_tenant(db_session)
    p1 = await _make_product(db_session, tenant, stock=50, price=Decimal("100.00"), code_suffix="C1")
    p2 = await _make_product(db_session, tenant, stock=30, price=Decimal("200.00"), code_suffix="C2")

    engine = StockAuditEngine(db_session, tenant)
    count_session = await engine.create_stock_count(name="Mid-Year Audit", count_type="Full")

    await engine.record_physical_counts(
        count_id=count_session.id,
        line_counts=[
            {"product_id": p1.id, "physical_count": Decimal("45.00")},
            {"product_id": p2.id, "physical_count": Decimal("35.00")}
        ]
    )

    res = await engine.reconcile_and_adjust_stock(count_id=count_session.id)
    assert res["stock_count"].status == "Completed"

    # Verify Product.stock updated directly
    up1 = (await db_session.execute(select(Product).where(Product.id == p1.id))).scalars().first()
    up2 = (await db_session.execute(select(Product).where(Product.id == p2.id))).scalars().first()

    assert up1.stock == 45  # Updated from 50 to 45
    assert up2.stock == 35  # Updated from 30 to 35

    print("\n[PASS] Assertion 3: Stock reconciliation updated Product.stock levels to 45 and 35")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Stock Adjustment Voucher Generation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stock_adjustment_voucher_generation(db_session):
    """
    Assertion 4: Stock reconciliation generates a Posted StockAdjustment voucher.
    """
    company_id, branch_id, tenant = await _setup_audit_tenant(db_session)
    p1 = await _make_product(db_session, tenant, stock=100, price=Decimal("50.00"), code_suffix="D1")

    engine = StockAuditEngine(db_session, tenant)
    count_session = await engine.create_stock_count(name="Spot Audit", count_type="Selective")

    await engine.record_physical_counts(
        count_id=count_session.id,
        line_counts=[{"product_id": p1.id, "physical_count": Decimal("95.00")}]
    )

    res = await engine.reconcile_and_adjust_stock(count_id=count_session.id, reason="Damaged items written off")
    adj = res["stock_adjustment"]

    assert adj is not None
    assert adj.status == "Posted"
    assert adj.reason == "Damaged items written off"
    assert adj.total_adjustment_qty == Decimal("-5.0000")
    assert adj.total_adjustment_value == Decimal("-250.00")

    print("\n[PASS] Assertion 4: Posted StockAdjustment voucher generated with variance total")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Cannot Reconcile Already Completed Count
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cannot_reconcile_already_completed_count(db_session):
    """
    Assertion 5: Attempting to reconcile an already completed stock audit is rejected with HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_audit_tenant(db_session)
    p1 = await _make_product(db_session, tenant, stock=10, price=Decimal("50.00"), code_suffix="E1")

    engine = StockAuditEngine(db_session, tenant)
    count_session = await engine.create_stock_count(name="Audit Session E", count_type="Full")

    await engine.record_physical_counts(
        count_id=count_session.id,
        line_counts=[{"product_id": p1.id, "physical_count": Decimal("10.00")}]
    )

    await engine.reconcile_and_adjust_stock(count_id=count_session.id)

    # Attempt second reconciliation
    with pytest.raises(HTTPException) as exc_info:
        await engine.reconcile_and_adjust_stock(count_id=count_session.id)

    assert exc_info.value.status_code == 400
    assert "already completed" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 5: Duplicate reconciliation attempt rejected with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Stock Audit
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_stock_audit(db_session):
    """
    Assertion 6: Cross-tenant access to StockCount sessions raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_audit_tenant(db_session)
    p1 = await _make_product(db_session, tenant_a, stock=10, code_suffix="F1")

    engine_a = StockAuditEngine(db_session, tenant_a)
    count_a = await engine_a.create_stock_count(name="Tenant A Audit")

    # Tenant B attempts to record counts on Tenant A's session
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = StockAuditEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_b.record_physical_counts(
            count_id=count_a.id,
            line_counts=[{"product_id": p1.id, "physical_count": Decimal("8.00")}]
        )

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for Stock Audit sessions")
