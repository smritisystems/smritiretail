"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 9.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_replenishment.py — Integration test suite for Phase 14 (v9.0.0)
Automated Warehouse Replenishment & Reorder Suggestions Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.inventory import Product, ReplenishmentPlan, ProductVendor
from app.models.purchase import Supplier, VendorContract, PurchaseOrder
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.replenishment_engine import ReplenishmentEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Vendor Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_rep_tenant(db):
    """Set up an isolated tenant for Replenishment test suite."""
    company_id = f"co-rep-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-rep-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Replenishment Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Replenishment HQ", code=f"RHQ{uuid.uuid4().hex[:8].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_supplier(db, company_id, branch_id, name_suffix=""):
    sup_id = f"sup-rep-{uuid.uuid4().hex[:8]}"
    sup = Supplier(
        id=sup_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        code=f"SUP-REP-{uuid.uuid4().hex[:6].upper()}",
        name=f"Replenishment Vendor {name_suffix}",
        is_active=True
    )
    db.add(sup)
    await db.flush()
    return sup_id


async def _make_product(db, tenant_ctx, stock=10, reorder_lvl=20, target_stk=100, price=Decimal("100.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-rep-{uuid.uuid4().hex[:8]}",
        code=f"REPPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"Replenishment Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-REP-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price,
        attributes={"reorder_level": reorder_lvl, "target_stock": target_stk}
    )
    product = await inv_service.create_product(p_in)
    product.stock = stock
    product.attributes = {"reorder_level": reorder_lvl, "target_stock": target_stk}
    db.add(product)
    await db.flush()
    return product


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Generate Reorder Suggestions Detects Low Stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_reorder_suggestions_detects_low_stock(db_session):
    """
    Assertion 1: SKUs with available stock below reorder level are identified with correct suggested quantity.
    """
    company_id, branch_id, tenant = await _setup_rep_tenant(db_session)
    product = await _make_product(db_session, tenant, stock=10, reorder_lvl=20, target_stk=100, price=Decimal("100.00"), code_suffix="A")

    engine = ReplenishmentEngine(db_session, tenant)
    suggestions = await engine.generate_reorder_suggestions()

    assert len(suggestions) >= 1
    sug = next(s for s in suggestions if s["product_id"] == product.id)
    assert sug["current_stock"] == Decimal("10.00")
    assert sug["reorder_level"] == Decimal("20.00")
    assert sug["suggested_qty"] == Decimal("90.00")  # 100 - 10 = 90!

    print("\n[PASS] Assertion 1: Low-stock SKU correctly detected with suggested reorder qty = 90")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Reorder Suggestions Vendor Contract Resolution
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reorder_suggestions_vendor_contract_resolution(db_session):
    """
    Assertion 2: StrategicVendorResolver attaches contracted vendor ID and contract price to reorder suggestion.
    """
    company_id, branch_id, tenant = await _setup_rep_tenant(db_session)
    vendor_id = await _make_supplier(db_session, company_id, branch_id, name_suffix="Primary")
    product = await _make_product(db_session, tenant, stock=5, reorder_lvl=20, target_stk=50, price=Decimal("100.00"), code_suffix="B")

    # Setup ProductVendor & VendorContract
    pv = ProductVendor(
        id=f"pv-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        product_id=product.id,
        supplier_id=vendor_id,
        cost_price=Decimal("85.00"),
        is_preferred=True,
        is_active=True,
        workflow_status="APPROVED"
    )
    db_session.add(pv)
    await db_session.flush()

    engine = ReplenishmentEngine(db_session, tenant)
    suggestions = await engine.generate_reorder_suggestions()

    sug = next(s for s in suggestions if s["product_id"] == product.id)
    assert sug["preferred_vendor_id"] == vendor_id
    assert sug["unit_price"] == Decimal("85.00")

    print("\n[PASS] Assertion 2: Preferred vendor ID and contract price ($85.00) correctly resolved")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Create Replenishment Plan
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_replenishment_plan(db_session):
    """
    Assertion 3: Creating a draft ReplenishmentPlan with line item details succeeds.
    """
    company_id, branch_id, tenant = await _setup_rep_tenant(db_session)
    vendor_id = await _make_supplier(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=10, reorder_lvl=20, target_stk=100, price=Decimal("50.00"), code_suffix="C")

    engine = ReplenishmentEngine(db_session, tenant)
    plan = await engine.create_replenishment_plan(
        name="Weekly Store Replenishment Plan",
        items=[{
            "product_id": product.id,
            "suggested_qty": Decimal("90.00"),
            "preferred_vendor_id": vendor_id,
            "unit_price": Decimal("50.00"),
            "current_stock": Decimal("10.00"),
            "reorder_level": Decimal("20.00")
        }]
    )

    assert plan is not None
    assert plan.status == "Draft"
    assert plan.total_items == 1
    assert plan.total_estimated_cost == Decimal("4500.00")  # 90 * 50 = 4500

    print("\n[PASS] Assertion 3: Draft ReplenishmentPlan created with total estimated cost = $4500.00")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Convert Plan to Purchase Orders Groups by Vendor
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_convert_plan_to_purchase_orders_groups_by_vendor(db_session):
    """
    Assertion 4: Converting replenishment plan automatically generates vendor-grouped draft PurchaseOrders.
    """
    company_id, branch_id, tenant = await _setup_rep_tenant(db_session)
    v1 = await _make_supplier(db_session, company_id, branch_id, name_suffix="V1")
    v2 = await _make_supplier(db_session, company_id, branch_id, name_suffix="V2")

    p1 = await _make_product(db_session, tenant, stock=5, reorder_lvl=20, target_stk=50, price=Decimal("100.00"), code_suffix="D1")
    p2 = await _make_product(db_session, tenant, stock=10, reorder_lvl=30, target_stk=80, price=Decimal("200.00"), code_suffix="D2")

    engine = ReplenishmentEngine(db_session, tenant)
    plan = await engine.create_replenishment_plan(
        name="Multi-Vendor Plan",
        items=[
            {"product_id": p1.id, "suggested_qty": Decimal("45.00"), "preferred_vendor_id": v1, "unit_price": Decimal("100.00")},
            {"product_id": p2.id, "suggested_qty": Decimal("70.00"), "preferred_vendor_id": v2, "unit_price": Decimal("200.00")}
        ]
    )

    # Convert plan to POs
    pos = await engine.convert_plan_to_purchase_orders(plan.id)

    assert len(pos) == 2
    po_vendors = {po.supplier_id for po in pos}
    assert v1 in po_vendors
    assert v2 in po_vendors
    assert plan.status == "Converted"

    print("\n[PASS] Assertion 4: Replenishment plan converted to 2 vendor-grouped draft Purchase Orders")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Sufficient Stock SKUs Excluded from Reorder Suggestions
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sufficient_stock_skus_excluded_from_reorder(db_session):
    """
    Assertion 5: SKUs with available stock above reorder level are excluded from reorder suggestions.
    """
    company_id, branch_id, tenant = await _setup_rep_tenant(db_session)
    p_healthy = await _make_product(db_session, tenant, stock=50, reorder_lvl=20, target_stk=100, price=Decimal("100.00"), code_suffix="E")

    engine = ReplenishmentEngine(db_session, tenant)
    suggestions = await engine.generate_reorder_suggestions()

    healthy_ids = [s["product_id"] for s in suggestions if s["product_id"] == p_healthy.id]
    assert len(healthy_ids) == 0  # Excluded!

    print("\n[PASS] Assertion 5: Healthy stock SKU (stock 50 > reorder 20) correctly excluded from suggestions")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Replenishment
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_replenishment(db_session):
    """
    Assertion 6: Cross-tenant access to ReplenishmentPlans raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_rep_tenant(db_session)
    p1 = await _make_product(db_session, tenant_a, stock=5, code_suffix="F")

    engine_a = ReplenishmentEngine(db_session, tenant_a)
    plan_a = await engine_a.create_replenishment_plan(
        name="Tenant A Plan",
        items=[{"product_id": p1.id, "suggested_qty": Decimal("40.00"), "unit_price": Decimal("100.00")}]
    )

    # Tenant B attempts to convert Tenant A's plan
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = ReplenishmentEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_b.convert_plan_to_purchase_orders(plan_a.id)

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for ReplenishmentPlans")
