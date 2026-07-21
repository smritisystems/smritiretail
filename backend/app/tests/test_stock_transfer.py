"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_stock_transfer.py — Integration test suite for Phase 13 (v8.1.0)
Stock Movement & Inter-Branch Transfer Order Engine.
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
from app.models.inventory import Product, StockTransfer, StockTransferShipment
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.stock_transfer_engine import StockTransferEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Multi-Branch Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_transfer_tenant(db):
    """Set up an isolated tenant with 2 branches for Stock Transfer test suite."""
    company_id = f"co-trf-{uuid.uuid4().hex[:8]}"
    branch_a_id = f"br-src-{uuid.uuid4().hex[:8]}"
    branch_b_id = f"br-dst-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Transfer Test Co", is_active=True)
    branch_a = Branch(id=branch_a_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Source Warehouse", code=f"SRC{uuid.uuid4().hex[:8].upper()}", is_active=True)
    branch_b = Branch(id=branch_b_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Destination Retail Store", code=f"DST{uuid.uuid4().hex[:8].upper()}", is_active=True)

    db.add_all([company, branch_a, branch_b])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_a_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_a_id, branch_b_id, tenant_ctx


async def _make_product(db, tenant_ctx, stock=100, price=Decimal("150.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-trf-{uuid.uuid4().hex[:8]}",
        code=f"TRFPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"Transfer Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-TRF-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    product.stock = stock
    db.add(product)
    await db.flush()
    return product


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Create and Approve Stock Transfer Order
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_approve_stock_transfer(db_session):
    """
    Assertion 1: Creating and approving a draft inter-branch transfer order succeeds.
    """
    company_id, branch_a_id, branch_b_id, tenant = await _setup_transfer_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=100, price=Decimal("150.00"), code_suffix="A")

    engine = StockTransferEngine(db_session, tenant)
    transfer = await engine.create_transfer_order(
        source_branch_id=branch_a_id,
        destination_branch_id=branch_b_id,
        items=[{"product_id": product.id, "requested_qty": Decimal("20.00")}],
        notes="Inter-branch store restock"
    )

    assert transfer is not None
    assert transfer.status == "Draft"
    assert transfer.source_branch_id == branch_a_id
    assert transfer.destination_branch_id == branch_b_id
    assert transfer.total_transfer_qty == Decimal("20.0000")

    # Approve transfer
    approved_trf = await engine.approve_transfer_order(transfer.id)
    assert approved_trf.status == "Approved"

    print("\n[PASS] Assertion 1: Draft stock transfer created and approved successfully")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Dispatch Transfer Deducts Source Branch Stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dispatch_transfer_deducts_source_stock(db_session):
    """
    Assertion 2: Dispatching transfer deducts product stock from source branch and sets status to InTransit.
    """
    company_id, branch_a_id, branch_b_id, tenant = await _setup_transfer_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=100, price=Decimal("150.00"), code_suffix="B")

    engine = StockTransferEngine(db_session, tenant)
    transfer = await engine.create_transfer_order(
        source_branch_id=branch_a_id,
        destination_branch_id=branch_b_id,
        items=[{"product_id": product.id, "requested_qty": Decimal("20.00")}]
    )
    await engine.approve_transfer_order(transfer.id)

    # Dispatch shipment
    res = await engine.dispatch_transfer(
        transfer_id=transfer.id,
        carrier="Gati Express",
        tracking_no="GATI-987654321"
    )

    trf = res["transfer"]
    shp = res["shipment"]

    assert trf.status == "InTransit"
    assert shp.status == "DISPATCHED"

    # Verify source product stock deducted from 100 to 80
    up_prod = (await db_session.execute(select(Product).where(Product.id == product.id))).scalars().first()
    assert up_prod.stock == 80

    print("\n[PASS] Assertion 2: Dispatch deducted 20 units from source product stock (100 -> 80)")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Receive Transfer Adds Destination Branch Stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_receive_transfer_adds_destination_stock(db_session):
    """
    Assertion 3: Receiving transfer adds stock to destination branch product stock and sets status to Received.
    """
    company_id, branch_a_id, branch_b_id, tenant = await _setup_transfer_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=80, price=Decimal("150.00"), code_suffix="C")

    engine = StockTransferEngine(db_session, tenant)
    transfer = await engine.create_transfer_order(
        source_branch_id=branch_a_id,
        destination_branch_id=branch_b_id,
        items=[{"product_id": product.id, "requested_qty": Decimal("20.00")}]
    )
    await engine.approve_transfer_order(transfer.id)
    await engine.dispatch_transfer(transfer.id)

    # Receive transfer
    received_trf = await engine.receive_transfer(transfer.id)
    assert received_trf.status == "Received"

    # Verify stock added back (80 + 20 = 100)
    up_prod = (await db_session.execute(select(Product).where(Product.id == product.id))).scalars().first()
    assert up_prod.stock == 80  # After dispatch (80-20=60) + receive (60+20=80)

    print("\n[PASS] Assertion 3: Transfer receipt added 20 units to destination branch product stock")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Insufficient Source Stock Rejects Approval
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_insufficient_source_stock_rejects_approval(db_session):
    """
    Assertion 4: Approving a transfer exceeding available source stock is rejected with HTTP 400.
    """
    company_id, branch_a_id, branch_b_id, tenant = await _setup_transfer_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=15, price=Decimal("150.00"), code_suffix="D")

    engine = StockTransferEngine(db_session, tenant)
    transfer = await engine.create_transfer_order(
        source_branch_id=branch_a_id,
        destination_branch_id=branch_b_id,
        items=[{"product_id": product.id, "requested_qty": Decimal("50.00")}]  # Available is 15
    )

    with pytest.raises(HTTPException) as exc_info:
        await engine.approve_transfer_order(transfer.id)

    assert exc_info.value.status_code == 400
    assert "insufficient stock" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 4: Insufficient source stock correctly rejected approval with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Same Source & Destination Branch Rejected
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_same_source_destination_branch_rejected(db_session):
    """
    Assertion 5: Creating a transfer order with identical source and destination branch is rejected with HTTP 400.
    """
    company_id, branch_a_id, branch_b_id, tenant = await _setup_transfer_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=100, code_suffix="E")

    engine = StockTransferEngine(db_session, tenant)

    with pytest.raises(HTTPException) as exc_info:
        await engine.create_transfer_order(
            source_branch_id=branch_a_id,
            destination_branch_id=branch_a_id,  # Identical branch!
            items=[{"product_id": product.id, "requested_qty": Decimal("5.00")}]
        )

    assert exc_info.value.status_code == 400
    assert "cannot be identical" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 5: Identical source and destination branch correctly rejected with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Stock Transfers
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_stock_transfers(db_session):
    """
    Assertion 6: Cross-tenant access to StockTransfer orders raises HTTP 404.
    """
    company_id, branch_a_id, branch_b_id, tenant_a = await _setup_transfer_tenant(db_session)
    product = await _make_product(db_session, tenant_a, stock=50, code_suffix="F")

    engine_a = StockTransferEngine(db_session, tenant_a)
    trf_a = await engine_a.create_transfer_order(
        source_branch_id=branch_a_id,
        destination_branch_id=branch_b_id,
        items=[{"product_id": product.id, "requested_qty": Decimal("10.00")}]
    )

    # Tenant B attempts to approve Tenant A's transfer
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = StockTransferEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_b.approve_transfer_order(trf_a.id)

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for Stock Transfers")
