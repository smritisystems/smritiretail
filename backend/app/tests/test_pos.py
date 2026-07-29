"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 10.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_pos.py — Integration test suite for Phase 15 (v10.0.0)
Unified POS Checkout, Cash Drawer Session & Offline Sync Queue Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.inventory import Product
from app.models.pos import PosSession, PosTransaction
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.pos_engine import PosEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Product Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_pos_tenant(db):
    """Set up an isolated tenant for POS test suite."""
    company_id = f"co-pos-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-pos-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="POS Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Store Terminal 1", code=f"POS{uuid.uuid4().hex[:8].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_product(db, tenant_ctx, stock=50, price=Decimal("150.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-pos-{uuid.uuid4().hex[:8]}",
        code=f"POSPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"POS Item {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-POS-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    product.stock = stock
    db.add(product)
    await db.flush()
    return product


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Open and Close POS Session with Cash Reconciliation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_open_and_close_pos_session_with_cash_reconciliation(db_session):
    """
    Assertion 1: Opening cash drawer session, completing CASH sale, and closing session calculates expected cash and variance correctly.
    """
    company_id, branch_id, tenant = await _setup_pos_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=50, price=Decimal("150.00"), code_suffix="A")

    engine = PosEngine(db_session, tenant)
    session = await engine.open_session(cashier_id="CASHIER-01", terminal_id="TERM-01", opening_balance=Decimal("500.00"))

    assert session is not None
    assert session.status == "OPEN"
    assert session.opening_balance == Decimal("500.00")
    assert session.expected_cash == Decimal("500.00")

    # Perform cash transaction ($300.00)
    tx = await engine.process_checkout(
        session_id=session.id,
        items=[{"product_id": product.id, "quantity": Decimal("2.00"), "unit_price": Decimal("150.00")}],
        payment_method="CASH",
        tendered_amount=Decimal("300.00")
    )
    assert tx.grand_total == Decimal("300.00")

    # Refresh session
    updated_sess = (await db_session.execute(select(PosSession).where(PosSession.id == session.id))).scalars().first()
    assert updated_sess.expected_cash == Decimal("800.00")  # 500 + 300 = 800

    # Close session with actual cash count $790.00 ($10 shortage variance)
    closed_sess = await engine.close_session(session_id=session.id, actual_cash_count=Decimal("790.00"), notes="Shortage $10")
    assert closed_sess.status == "CLOSED"
    assert closed_sess.cash_variance == Decimal("-10.00")

    print("\n[PASS] Assertion 1: POS cash session open, cash checkout, and closing reconciliation verified (-$10 variance)")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: POS Checkout Deducts Inventory & Calculates Change Due
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pos_checkout_deducts_inventory_and_calculates_change(db_session):
    """
    Assertion 2: Counter sale checkout deducts stock and calculates change due correctly.
    """
    company_id, branch_id, tenant = await _setup_pos_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=50, price=Decimal("150.00"), code_suffix="B")

    engine = PosEngine(db_session, tenant)
    session = await engine.open_session(cashier_id="CASHIER-02", terminal_id="TERM-02", opening_balance=Decimal("200.00"))

    # Checkout 2 units (grand total = 300.00, tendered = 500.00)
    tx = await engine.process_checkout(
        session_id=session.id,
        items=[{"product_id": product.id, "quantity": Decimal("2.00"), "unit_price": Decimal("150.00")}],
        payment_method="CASH",
        tendered_amount=Decimal("500.00")
    )

    assert tx.grand_total == Decimal("300.00")
    assert tx.change_due == Decimal("200.00")  # 500 - 300 = 200

    # Verify inventory stock deducted from 50 to 48
    up_prod = (await db_session.execute(select(Product).where(Product.id == product.id))).scalars().first()
    assert up_prod.stock == 48

    print("\n[PASS] Assertion 2: Checkout deducted 2 units from inventory (50 -> 48) and calculated $200 change due")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Checkout Fails on Closed Session
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_checkout_fails_on_closed_session(db_session):
    """
    Assertion 3: Attempting checkout on a closed POS session is rejected with HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_pos_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=50, code_suffix="C")

    engine = PosEngine(db_session, tenant)
    session = await engine.open_session(cashier_id="CASHIER-03", terminal_id="TERM-03")
    await engine.close_session(session_id=session.id, actual_cash_count=Decimal("0.00"))

    with pytest.raises(HTTPException) as exc_info:
        await engine.process_checkout(
            session_id=session.id,
            items=[{"product_id": product.id, "quantity": Decimal("1.00"), "unit_price": Decimal("150.00")}]
        )

    assert exc_info.value.status_code == 400
    assert "closed pos session" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 3: Checkout on closed POS session correctly rejected with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Offline Sync Batch Ingestion & Deduplication
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_offline_sync_batch_ingestion_and_deduplication(db_session):
    """
    Assertion 4: Offline batch ingestion processes offline sales and deduplicates repeated client_tx_uuid submissions.
    """
    company_id, branch_id, tenant = await _setup_pos_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=100, price=Decimal("50.00"), code_suffix="D")

    tx_uuid = f"offline-tx-{uuid.uuid4().hex[:12]}"
    batch = [{
        "client_tx_uuid": tx_uuid,
        "terminal_id": "OFFLINE-TERM-01",
        "cashier_id": "CASHIER-OFFLINE",
        "payment_method": "CASH",
        "tendered_amount": 100.0,
        "items": [{"product_id": product.id, "quantity": 2, "unit_price": 50.0}]
    }]

    engine = PosEngine(db_session, tenant)

    # First sync submission
    res1 = await engine.process_offline_sync_batch(batch)
    assert len(res1) == 1
    assert res1[0]["status"] == "SYNCED"

    # Second submission with identical client_tx_uuid
    res2 = await engine.process_offline_sync_batch(batch)
    assert len(res2) == 1
    assert res2[0]["status"] == "DUPLICATE"

    print("\n[PASS] Assertion 4: Offline batch sync ingested transaction and correctly deduplicated repeat submission")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Insufficient Stock Rejects POS Checkout
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_insufficient_stock_rejects_pos_checkout(db_session):
    """
    Assertion 5: Attempting counter sale checkout exceeding available stock is rejected with HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_pos_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=2, price=Decimal("100.00"), code_suffix="E")

    engine = PosEngine(db_session, tenant)
    session = await engine.open_session(cashier_id="CASHIER-05", terminal_id="TERM-05")

    with pytest.raises(HTTPException) as exc_info:
        await engine.process_checkout(
            session_id=session.id,
            items=[{"product_id": product.id, "quantity": Decimal("10.00"), "unit_price": Decimal("100.00")}]
        )

    assert exc_info.value.status_code == 400
    assert "insufficient stock" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 5: Insufficient stock correctly rejected POS checkout with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for POS Sessions
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_pos_sessions(db_session):
    """
    Assertion 6: Cross-tenant access to PosSessions raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_pos_tenant(db_session)
    engine_a = PosEngine(db_session, tenant_a)
    session_a = await engine_a.open_session(cashier_id="CASHIER-A", terminal_id="TERM-A")

    # Tenant B attempts to close Tenant A's session
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = PosEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_b.close_session(session_id=session_a.id, actual_cash_count=Decimal("100.00"))

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for POS Sessions")
