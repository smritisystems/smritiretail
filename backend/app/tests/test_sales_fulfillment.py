"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_sales_fulfillment.py — Integration test suite for Phase 9 (v7.0.0)
Outbound Sales Order & Wave Pick-Pack-Ship Fulfillment Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.sales import (
    SalesOrder, SalesOrderItem, FulfillmentWave, PickList, PickListItem, ShipmentPackage
)
from app.models.crm import Customer
from app.models.inventory import Product
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.sales.engine.fulfillment_engine import FulfillmentEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_so_tenant(db):
    """Set up an isolated tenant for Sales Fulfillment test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-so-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-so-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="SO Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="SO HQ", code=f"SHQ{uuid.uuid4().hex[:4].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_customer(db, company_id, branch_id):
    cust_id = f"cust-so-{uuid.uuid4().hex[:8]}"
    cust = Customer(
        id=cust_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        code=f"CUST-{uuid.uuid4().hex[:6].upper()}",
        name=f"SO Customer {uuid.uuid4().hex[:4]}",
        mobile=f"98765{uuid.uuid4().hex[:5]}",
    )
    db.add(cust)
    await db.flush()
    return cust_id


async def _make_product(db, tenant_ctx, stock=100, price=Decimal("250.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-so-{uuid.uuid4().hex[:8]}",
        code=f"SOPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"SO Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-SO-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    product.stock = stock
    db.add(product)
    await db.flush()
    return product


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Create and Confirm Sales Order reserves product stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_confirm_sales_order_reserves_stock(db_session):
    """
    Assertion 1: Confirming a Draft SalesOrder reserves product stock and updates order status to Confirmed.
    """
    company_id, branch_id, tenant = await _setup_so_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=50, price=Decimal("300.00"), code_suffix="A")

    order_id = f"so-{uuid.uuid4().hex[:12]}"
    order = SalesOrder(
        id=order_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        order_no=f"SO-{uuid.uuid4().hex[:6].upper()}",
        customer_id=cust_id,
        subtotal=Decimal("3000.00"),
        grand_total=Decimal("3540.00"),
        status="Draft"
    )
    db_session.add(order)

    soi = SalesOrderItem(
        company_id=company_id,
        order_id=order_id,
        product_id=product.id,
        ordered_quantity=Decimal("10.00"),
        reserved_quantity=Decimal("0.00"),
        unit_price=Decimal("300.00"),
        line_total=Decimal("3000.00")
    )
    db_session.add(soi)
    await db_session.flush()

    engine = FulfillmentEngine(db_session, tenant)
    confirmed_so = await engine.confirm_sales_order(order_id)

    assert confirmed_so.status == "Confirmed"
    assert confirmed_so.fulfillment_status == "Allocated"

    # Check updated product reservation
    p_stmt = select(Product).where(Product.id == product.id)
    updated_prod = (await db_session.execute(p_stmt)).scalars().first()
    assert Decimal(str(getattr(updated_prod, "reserved_stock", 0))) == Decimal("10.00")

    print("\n[PASS] Assertion 1: Sales order confirmed and stock reserved successfully")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Insufficient stock rejects confirmation with HTTP 400
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_insufficient_stock_rejects_confirmation(db_session):
    """
    Assertion 2: Confirming an order requiring more stock than available raises HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_so_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=5, price=Decimal("100.00"), code_suffix="B")

    order_id = f"so-{uuid.uuid4().hex[:12]}"
    order = SalesOrder(
        id=order_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        order_no=f"SO-OVERSOLD-{uuid.uuid4().hex[:4].upper()}",
        customer_id=cust_id,
        status="Draft"
    )
    db_session.add(order)

    soi = SalesOrderItem(
        company_id=company_id,
        order_id=order_id,
        product_id=product.id,
        ordered_quantity=Decimal("50.00"),  # Stock is only 5!
        reserved_quantity=Decimal("0.00"),
        unit_price=Decimal("100.00"),
        line_total=Decimal("5000.00")
    )
    db_session.add(soi)
    await db_session.flush()

    engine = FulfillmentEngine(db_session, tenant)
    with pytest.raises(HTTPException) as exc_info:
        await engine.confirm_sales_order(order_id)

    assert exc_info.value.status_code == 400
    assert "insufficient available stock" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 2: Insufficient stock correctly rejected confirmation with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Wave picking groups confirmed sales orders into pick list
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fulfillment_wave_groups_orders_into_pick_list(db_session):
    """
    Assertion 3: FulfillmentWave consolidates multiple Confirmed SalesOrders into a single wave and PickList.
    """
    company_id, branch_id, tenant = await _setup_so_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=100, code_suffix="C")

    engine = FulfillmentEngine(db_session, tenant)

    # Create & Confirm Order 1
    o1_id = f"so-w1-{uuid.uuid4().hex[:8]}"
    o1 = SalesOrder(id=o1_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-W1-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(o1)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=o1_id, product_id=product.id, ordered_quantity=Decimal("5.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("250.00"), line_total=Decimal("1250.00")))
    await db_session.flush()
    await engine.confirm_sales_order(o1_id)

    # Create & Confirm Order 2
    o2_id = f"so-w2-{uuid.uuid4().hex[:8]}"
    o2 = SalesOrder(id=o2_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-W2-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(o2)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=o2_id, product_id=product.id, ordered_quantity=Decimal("10.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("250.00"), line_total=Decimal("2500.00")))
    await db_session.flush()
    await engine.confirm_sales_order(o2_id)

    # Generate Wave
    wave = await engine.generate_fulfillment_wave([o1_id, o2_id])

    assert wave is not None
    assert wave.total_orders == 2
    assert wave.total_items == 2
    assert wave.status == "Created"

    print("\n[PASS] Assertion 3: FulfillmentWave created consolidating 2 SalesOrders into pick list")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Pack shipment package
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pack_shipment_package(db_session):
    """
    Assertion 4: Packing shipment creates ShipmentPackage in PACKED status and updates SO fulfillment_status="Packed".
    """
    company_id, branch_id, tenant = await _setup_so_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=20, code_suffix="D")

    engine = FulfillmentEngine(db_session, tenant)
    o_id = f"so-p1-{uuid.uuid4().hex[:8]}"
    o = SalesOrder(id=o_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-P1-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(o)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=o_id, product_id=product.id, ordered_quantity=Decimal("2.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("250.00"), line_total=Decimal("500.00")))
    await db_session.flush()
    await engine.confirm_sales_order(o_id)

    package = await engine.pack_shipment(order_id=o_id, carrier="BlueDart", tracking_no="BD123456789IN")

    assert package is not None
    assert package.status == "PACKED"
    assert package.carrier == "BlueDart"

    so_stmt = select(SalesOrder).where(SalesOrder.id == o_id)
    updated_so = (await db_session.execute(so_stmt)).scalars().first()
    assert updated_so.fulfillment_status == "Packed"

    print("\n[PASS] Assertion 4: Shipment package packed successfully with tracking number")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Dispatch shipment deducts inventory stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dispatch_shipment_deducts_inventory_stock(db_session):
    """
    Assertion 5: Dispatching shipment deducts product stock and reserved_stock, and updates status to SHIPPED.
    """
    company_id, branch_id, tenant = await _setup_so_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=50, price=Decimal("200.00"), code_suffix="E")

    engine = FulfillmentEngine(db_session, tenant)
    o_id = f"so-d1-{uuid.uuid4().hex[:8]}"
    o = SalesOrder(id=o_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-D1-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(o)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=o_id, product_id=product.id, ordered_quantity=Decimal("10.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("200.00"), line_total=Decimal("2000.00")))
    await db_session.flush()

    await engine.confirm_sales_order(o_id)
    package = await engine.pack_shipment(order_id=o_id)

    # Dispatch package
    dispatched = await engine.dispatch_shipment(package.id)

    assert dispatched.status == "SHIPPED"
    assert dispatched.dispatch_date is not None

    # Verify inventory deduction: stock should be 50 - 10 = 40
    p_stmt = select(Product).where(Product.id == product.id)
    updated_prod = (await db_session.execute(p_stmt)).scalars().first()
    assert updated_prod.stock == 40
    assert Decimal(str(getattr(updated_prod, "reserved_stock", 0))) == Decimal("0.00")

    print("\n[PASS] Assertion 5: Dispatching shipment deducted inventory stock from 50 to 40")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Sales Fulfillment
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_sales_fulfillment(db_session):
    """
    Assertion 6: Cross-tenant access to SalesOrder or Fulfillment packages is prevented with HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_so_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant_a, stock=10, code_suffix="F")

    engine_a = FulfillmentEngine(db_session, tenant_a)
    o_id = f"so-iso-{uuid.uuid4().hex[:8]}"
    o = SalesOrder(id=o_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-ISO-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(o)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=o_id, product_id=product.id, ordered_quantity=Decimal("1.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("100.00"), line_total=Decimal("100.00")))
    await db_session.flush()

    # Tenant B tries to confirm Tenant A's order
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = FulfillmentEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_b.confirm_sales_order(o_id)

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for Sales Orders")
