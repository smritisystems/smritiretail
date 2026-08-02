from __future__ import annotations

"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

"""
test_inventory_modular_scenarios.py
Inventory Kernel RC2 — Modular Certification Scenarios A–F

Validates the complete lifecycle of inventory operations across six business scenarios:
  - Scenario A: Opening → Sale (Basic issue lifecycle)
  - Scenario B: Sale → Return (Reverse movement & return reconciliation)
  - Scenario C: Purchase → Sale (Receipt to issue flow)
  - Scenario D: Reserve → Release (Business commitments & ATP bounds)
  - Scenario E: Transfer → Dispatch (Multi-warehouse stock allocation)
  - Scenario F: REST API Black-Box Sync (HTTP interface & DTO serialization)
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.inventory.facades import InventoryCommandFacade, InventoryQueryFacade
from app.services.inventory_reservation import InventoryReservationService
from app.models.inventory import StockMovement, Product


# ---------------------------------------------------------------------------
# Fixture & Helper Functions
# ---------------------------------------------------------------------------

async def _setup_scenario_tenant(db):
    """Isolated tenant for Scenario testing."""
    company_id = f"co-scen-{uuid.uuid4().hex[:8]}"
    branch_id  = f"br-scen-{uuid.uuid4().hex[:8]}"
    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Scenario Co", is_active=True)
    branch  = Branch(
        id=branch_id, uuid=str(uuid.uuid4()),
        company_id=company_id, name="Scenario Main Store",
        code=f"SCN{uuid.uuid4().hex[:6].upper()}", is_active=True,
    )
    db.add_all([company, branch])
    await db.flush()
    tenant_ctx = TenantContext(tenant_id="scen-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _create_product(db, tenant_ctx, initial_stock=0, price=Decimal("100.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-scen-{uuid.uuid4().hex[:8]}",
        code=f"SCNPROD{uuid.uuid4().hex[:4].upper()}",
        name="Scenario Test Product",
        category="General",
        brand="Generic",
        color="Standard",
        size="M",
        barcode=f"BC-SCN-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price,
    )
    product = await inv_service.create_product(p_in)
    if initial_stock > 0:
        ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
        mv = StockMovement(
            id=f"SM-OPENING-{uuid.uuid4().hex[:8]}-{ts}",
            uuid=str(uuid.uuid4()),
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or product.code,
            quantity=Decimal(str(initial_stock)),
            movement_type="OPENING",
            reference_doc_type="OPENING_BALANCE",
            reference_doc_id=f"OPEN-{uuid.uuid4().hex[:8]}",
            warehouse="WH-MAIN",
            unit_cost=price,
            remarks="Initial Opening Stock",
            source_module="ScenarioSetup",
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
        )
        db.add(mv)
        await db.commit()
        await db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Scenario A: Opening → Sale (Basic Issue)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_scenario_a_opening_to_sale(db_session):
    """Scenario A: Opening Balance (100) -> Issue Sale (20) -> Verify Stock = 80."""
    _, _, tenant_ctx = await _setup_scenario_tenant(db_session)
    product = await _create_product(db_session, tenant_ctx, initial_stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # Issue Sale of 20 units
    invoice_id = f"inv-{uuid.uuid4().hex[:8]}"
    invoice_no = f"INV-A-{uuid.uuid4().hex[:4].upper()}"
    await cmd_facade.issue_sale(
        invoice_id=invoice_id,
        invoice_no=invoice_no,
        items=[{"product_id": product.id, "quantity": 20}],
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    assert state["on_hand"] == 80.0
    assert state["available"] == 80.0
    assert float(product.stock) == 80.0


# ---------------------------------------------------------------------------
# Scenario B: Sale → Return (Reverse Movement)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_scenario_b_sale_to_return(db_session):
    """Scenario B: Issue Sale (20) -> Sales Return (5) -> Verify Stock = 85."""
    _, _, tenant_ctx = await _setup_scenario_tenant(db_session)
    product = await _create_product(db_session, tenant_ctx, initial_stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. Issue Sale of 20
    await cmd_facade.issue_sale(
        invoice_id=f"inv-{uuid.uuid4().hex[:8]}",
        invoice_no=f"INV-B-{uuid.uuid4().hex[:4].upper()}",
        items=[{"product_id": product.id, "quantity": 20}],
    )
    await db_session.commit()

    # 2. Return 5 units
    await cmd_facade.return_sale(
        return_id=f"ret-{uuid.uuid4().hex[:8]}",
        return_no=f"RET-B-{uuid.uuid4().hex[:4].upper()}",
        items=[{"product_id": product.id, "quantity": 5}],
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    assert state["on_hand"] == 85.0
    assert state["available"] == 85.0
    assert float(product.stock) == 85.0


# ---------------------------------------------------------------------------
# Scenario C: Purchase → Sale (Receipt + Issue)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_scenario_c_purchase_to_sale(db_session):
    """Scenario C: Stock 0 -> Purchase Receipt (50) -> Issue Sale (30) -> Stock = 20."""
    _, _, tenant_ctx = await _setup_scenario_tenant(db_session)
    product = await _create_product(db_session, tenant_ctx, initial_stock=0)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. Purchase Receipt (+50)
    ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
    mv_pur = StockMovement(
        id=f"SM-PURCHASE-{uuid.uuid4().hex[:8]}-{ts}",
        uuid=str(uuid.uuid4()),
        product_id=product.id,
        product_name=product.name,
        sku=product.sku or product.code,
        quantity=Decimal("50"),
        movement_type="PURCHASE",
        reference_doc_type="Purchase Order",
        reference_doc_id=f"PO-{uuid.uuid4().hex[:8]}",
        warehouse="WH-MAIN",
        unit_cost=product.cost_price,
        remarks="Goods Receipt Note",
        source_module="Purchase",
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
    )
    db_session.add(mv_pur)
    await db_session.commit()

    # 2. Issue Sale of 30
    await cmd_facade.issue_sale(
        invoice_id=f"inv-{uuid.uuid4().hex[:8]}",
        invoice_no=f"INV-C-{uuid.uuid4().hex[:4].upper()}",
        items=[{"product_id": product.id, "quantity": 30}],
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    assert state["on_hand"] == 20.0
    assert state["available"] == 20.0
    assert float(product.stock) == 20.0


# ---------------------------------------------------------------------------
# Scenario D: Reserve → Release (Business Commitments)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_scenario_d_reserve_to_release(db_session):
    """Scenario D: Reserve 15 (Stock 50) -> Available 35 -> Release 5 -> Available 40."""
    _, _, tenant_ctx = await _setup_scenario_tenant(db_session)
    product = await _create_product(db_session, tenant_ctx, initial_stock=50)

    res_service = InventoryReservationService(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. Reserve 15 units
    res_id = f"SO-D-{uuid.uuid4().hex[:6]}"
    await res_service.reserve(
        product_id=product.id,
        qty=15,
        reservation_type="Sales Order",
        reservation_id=res_id,
    )
    await db_session.refresh(product)

    state1 = await query_facade.get_canonical_state(product.id)
    assert state1["on_hand"] == 50.0
    assert state1["reserved"] == 15.0
    assert state1["available"] == 35.0

    # 2. Release 5 units via UNRESERVE movement and reserved_stock adjustment
    product.reserved_stock = Decimal("10")
    db_session.add(product)
    ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
    mv_rel = StockMovement(
        id=f"SM-UNRESERVE-{uuid.uuid4().hex[:8]}-{ts}",
        uuid=str(uuid.uuid4()),
        product_id=product.id,
        product_name=product.name,
        sku=product.sku or product.code,
        quantity=Decimal("-5"),
        movement_type="UNRESERVE",
        reference_doc_type="Sales Order",
        reference_doc_id=res_id,
        warehouse="WH-MAIN",
        unit_cost=product.cost_price,
        remarks="Partial Release of Reservation",
        source_module="Reservation",
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
    )
    db_session.add(mv_rel)
    await db_session.commit()
    await db_session.refresh(product)

    state2 = await query_facade.get_canonical_state(product.id)
    assert state2["on_hand"] == 50.0
    assert state2["reserved"] == 10.0
    assert state2["available"] == 40.0


# ---------------------------------------------------------------------------
# Scenario E: Transfer → Dispatch (Multi-Warehouse Allocation)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_scenario_e_transfer_to_dispatch(db_session):
    """Scenario E: Stock 100 WH-MAIN -> Transfer 30 to WH-SECONDARY -> Issue 10 WH-SECONDARY."""
    _, _, tenant_ctx = await _setup_scenario_tenant(db_session)
    product = await _create_product(db_session, tenant_ctx, initial_stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
    # 1. Inter-warehouse Transfer (30 units from WH-MAIN to WH-SECONDARY)
    mv_out = StockMovement(
        id=f"SM-TR-OUT-{uuid.uuid4().hex[:8]}-{ts}",
        uuid=str(uuid.uuid4()),
        product_id=product.id,
        product_name=product.name,
        sku=product.sku or product.code,
        quantity=Decimal("-30"),
        movement_type="TRANSFER_OUT",
        reference_doc_type="Transfer Order",
        reference_doc_id=f"TO-{uuid.uuid4().hex[:6]}",
        warehouse="WH-MAIN",
        unit_cost=product.cost_price,
        remarks="Transfer Out to Secondary WH",
        source_module="Transfer",
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
    )
    mv_in = StockMovement(
        id=f"SM-TR-IN-{uuid.uuid4().hex[:8]}-{ts+1}",
        uuid=str(uuid.uuid4()),
        product_id=product.id,
        product_name=product.name,
        sku=product.sku or product.code,
        quantity=Decimal("30"),
        movement_type="TRANSFER_IN",
        reference_doc_type="Transfer Order",
        reference_doc_id=f"TO-{uuid.uuid4().hex[:6]}",
        warehouse="WH-SECONDARY",
        unit_cost=product.cost_price,
        remarks="Transfer In to Secondary WH",
        source_module="Transfer",
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
    )
    db_session.add_all([mv_out, mv_in])
    await db_session.commit()

    # 2. Dispatch/Issue 10 units from WH-SECONDARY
    await cmd_facade.issue_sale(
        invoice_id=f"inv-{uuid.uuid4().hex[:8]}",
        invoice_no=f"INV-E-{uuid.uuid4().hex[:4].upper()}",
        items=[{"product_id": product.id, "quantity": 10}],
        warehouse="WH-SECONDARY",
    )
    await db_session.commit()
    await db_session.refresh(product)

    # 3. Assert Warehouse Breakdown
    wh_breakdown = await query_facade.state_service.get_warehouse_breakdown(product.id)

    # WH-MAIN: 100 - 30 = 70
    # WH-SECONDARY: +30 - 10 = 20
    assert wh_breakdown.get("WH-MAIN") == 70.0
    assert wh_breakdown.get("WH-SECONDARY") == 20.0
    assert float(product.stock) == 90.0


# ---------------------------------------------------------------------------
# Scenario F: REST API Black-Box Sync (HTTP Interface Integration)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_scenario_f_rest_api_black_box_sync(db_session, auth_headers):
    """Scenario F: Execute REST API endpoints over HTTP transport & verify contract synchronization."""
    tenant_ctx = TenantContext(company_id="comp-default", branch_id="br-default", tenant_id="default")
    active_tenant_ctx.set(tenant_ctx)
    product = await _create_product(db_session, tenant_ctx, initial_stock=75)

    # Create test AsyncClient pointing to FastAPI app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. GET /api/v1/inventory-state/product/{product_id}
        res_state = await client.get(
            f"/api/v1/inventory-state/product/{product.id}",
            headers=auth_headers,
        )
        assert res_state.status_code == 200, f"Expected 200, got {res_state.status_code}: {res_state.text}"
        state_data = res_state.json()
        assert state_data["product_id"] == product.id
        assert state_data["on_hand"] == 75.0
        assert state_data["available"] == 75.0

        # 2. GET /api/v1/inventory-availability/check?product_id={product_id}&qty=25
        res_avail = await client.get(
            "/api/v1/inventory-availability/check",
            params={"product_id": product.id, "qty": 25},
            headers=auth_headers,
        )
        assert res_avail.status_code == 200, f"Expected 200, got {res_avail.status_code}: {res_avail.text}"
        avail_data = res_avail.json()
        assert avail_data["can_fulfill"] is True
        assert avail_data["available_qty"] == 75.0

        # 3. POST /api/v1/inventory-reservation/reserve
        res_reserve = await client.post(
            "/api/v1/inventory-reservation/reserve",
            json={
                "product_id": product.id,
                "qty": 15,
                "reservation_type": "Sales Order",
                "reservation_id": f"SO-F-{uuid.uuid4().hex[:6]}",
            },
            headers=auth_headers,
        )
        assert res_reserve.status_code == 200, f"Expected 200, got {res_reserve.status_code}: {res_reserve.text}"
        res_data = res_reserve.json()
        assert res_data["status"] == "reserved"
        assert res_data["reserved_qty"] == 15.0
        assert res_data["available_after"] == 60.0
