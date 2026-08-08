"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import uuid
import pytest
from decimal import Decimal
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product, StockMovement
from app.models.tenant import Branch, Company
from app.services.inventory import InventoryService
from app.services.inventory_trace import InventoryTraceService
from app.schemas.inventory import ProductCreate, StockMovementResponse
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    Wire the test DB session into the app and clean all tables
    before and after each test.
    """
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-inv-{suffix}", name=f"Inv Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-inv-{suffix}", company_id=comp.id,
                   name=f"Inv Br {suffix}", code=f"BRINV-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    user = User(
        id=f"usr-inv-{suffix}", username=f"usr_inv_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": comp_id, "branch_id": br_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(db_session, comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_soft_delete_product_success(db_session):
    # Setup tenant, user, headers
    comp, br = await _make_tenant(db_session, "s1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create a product to delete
    product = Product(
        id="prod-delete-test",
        code="PROD-DEL",
        name="Test Product for Deletion",
        price=100.0,
        stock=10,
        category="General",
        barcode="1234567890123",
        company_id=comp.id,
        branch_id=br.id,
        is_deleted=False
    )
    db_session.add(product)
    await db_session.commit()

    # Call API to delete the product
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.delete("/api/v1/inventory/prod-delete-test", headers=headers)
        assert res.status_code == 200
        assert res.json() == {"success": True, "message": "Product deleted successfully"}

    # Verify database state
    await db_session.refresh(product)
    assert product.is_deleted is True
    assert product.deleted_by == manager.id
    assert product.deleted_at is not None


@pytest.mark.asyncio
async def test_soft_delete_product_unauthorized_role(db_session):
    # Setup tenant, cashier user, headers
    comp, br = await _make_tenant(db_session, "s2")
    cashier = await _make_user(db_session, "csh", comp.id, br.id, role=UserRole.CASHIER)
    headers = _bearer(cashier, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create a product to delete
    product = Product(
        id="prod-delete-fail",
        code="PROD-FAIL",
        name="Test Product Fail",
        price=50.0,
        stock=5,
        category="General",
        barcode="1234567890456",
        company_id=comp.id,
        branch_id=br.id,
        is_deleted=False
    )
    db_session.add(product)
    await db_session.commit()

    # Call API to delete the product (expect 403 Forbidden)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.delete("/api/v1/inventory/prod-delete-fail", headers=headers)
        assert res.status_code == 403

    # Verify database state remains active
    await db_session.refresh(product)
    assert product.is_deleted is False
    assert product.deleted_by is None


@pytest.mark.asyncio
async def test_resolve_effective_gst_percentage(db_session):
    from app.models.attributes import VariantTemplate
    from app.services.inventory import InventoryService

    comp, br = await _make_tenant(db_session, "s3")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    inv_service = InventoryService(db_session, tenant_ctx)

    # 1. Create VariantTemplate with 12% GST
    vt = VariantTemplate(
        id=f"vt-{uuid.uuid4().hex[:8]}",
        style_code="STYLE-VT-12",
        name="12% Tax Style Template",
        gst_percentage=12,
        attribute_group_id="ag-default"
    )
    db_session.add(vt)
    await db_session.commit()

    # 2. Product linked to VariantTemplate inherits 12% GST rate
    p1 = Product(
        id="prod-hsn-1",
        code="PROD-HSN-1",
        name="HSN Linked Product",
        price=100.0,
        variant_template_id=vt.id,
        gst_percentage=18.0,  # SKU level default override ignored in favor of VariantTemplate Classification
        category="Apparel",
        barcode="890000000001",
        company_id=comp.id,
        branch_id=br.id
    )
    db_session.add(p1)
    await db_session.commit()

    resolved_rate = await inv_service.resolve_effective_gst_percentage(p1)
    assert resolved_rate == 12.0


def test_build_sku_helper():
    from types import SimpleNamespace
    from app.services.inventory import _build_sku

    p1 = SimpleNamespace(sku=None, style_code="CH-02-A", color="Red", size="XXL")
    p2 = SimpleNamespace(sku="", style_code="CH-02-A", color=None, size="M")
    p3 = SimpleNamespace(sku="MANUAL-001", style_code="CH-02-A", color="Blue", size="L")
    p4 = SimpleNamespace(sku=None, style_code=None, color=None, size=None)

    assert _build_sku(p1) == "CH-02-A-Red-XXL"
    assert _build_sku(p2) == "CH-02-A-M"
    assert _build_sku(p3) == "MANUAL-001"
    assert _build_sku(p4) == ""


@pytest.mark.asyncio
async def test_create_product_barcode_cross_table_collision(db_session):
    s = uuid.uuid4().hex[:6]
    comp = Company(id=f"comp-bc-{s}", name=f"Comp BC {s}", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-bc-{s}", company_id=comp.id, name=f"Branch BC {s}", code=f"BR-{s}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    inv_service = InventoryService(db_session, tenant_ctx)

    # Product 1 with secondary barcode 'SEC-8901'
    p1_in = ProductCreate(
        id=f"prod-bc1-{s}",
        code=f"P-BC1-{s}",
        name="Product Primary One",
        price=100.00,
        stock=10,
        category="General",
        barcode=f"PRI-8901-{s}",
        secondary_barcodes=[f"SEC-8901-{s}"]
    )
    await inv_service.create_product(p1_in)

    # Product 2 attempting to use Product 1's secondary barcode as its primary barcode
    p2_in = ProductCreate(
        id=f"prod-bc2-{s}",
        code=f"P-BC2-{s}",
        name="Product Collision Secondary to Primary",
        price=150.00,
        stock=5,
        category="General",
        barcode=f"SEC-8901-{s}"  # Collision!
    )
    with pytest.raises(HTTPException) as exc_info:
        await inv_service.create_product(p2_in)

    assert exc_info.value.status_code == 400
    assert "already exists" in exc_info.value.detail or "Secondary barcode" in exc_info.value.detail


@pytest.mark.asyncio
async def test_inventory_trace_service_and_api_routes(db_session):
    comp, br = await _make_tenant(db_session, "trace1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-trace-1",
        code="PROD-TRACE-1",
        name="Trace Product 1",
        price=100.0,
        stock=20,
        category="General",
        barcode="TRC-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    movement = StockMovement(
        id="sm-trace-1",
        uuid="trace-uuid-1",
        product_id=product.id,
        product_name=product.name,
        sku="TRC-SKU-001",
        quantity=10,
        movement_type="IN",
        reference_doc_type="GRN",
        reference_doc_id="GRN-001",
        warehouse="Main Warehouse",
        batch="BATCH-001",
        serial="SERIAL-001",
        unit_cost=Decimal("95.00"),
        remarks="Initial receipt",
        user="tester",
        device="unit-test",
        branch=br.id,
        source_module="purchase",
        approval="Approved",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(movement)
    await db_session.commit()

    trace_service = InventoryTraceService(db_session, tenant_ctx)
    product_trace = await trace_service.get_product_trace(product.id)
    assert len(product_trace) == 1
    assert product_trace[0].sku == "TRC-SKU-001"

    reference_trace = await trace_service.get_reference_trace("GRN-001")
    assert len(reference_trace) == 1
    assert reference_trace[0].reference_doc_type == "GRN"

    sku_trace = await trace_service.get_sku_trace("TRC-SKU-001")
    assert len(sku_trace) == 1
    assert sku_trace[0].product_id == product.id

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/inventory/trace/product/{product.id}")
        assert res.status_code == 200
        assert res.json()[0]["sku"] == "TRC-SKU-001"

        res_ref = await ac.get("/api/v1/inventory/trace/reference/GRN-001")
        assert res_ref.status_code == 200
        assert res_ref.json()[0]["reference_doc_type"] == "GRN"

        res_sku = await ac.get("/api/v1/inventory/trace/sku", params={"sku": "TRC-SKU-001"})
        assert res_sku.status_code == 200
        assert res_sku.json()[0]["product_id"] == product.id


@pytest.mark.asyncio
async def test_inventory_trace_router_mount(db_session):
    comp, br = await _make_tenant(db_session, "trace2")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-trace-2",
        code="PROD-TRACE-2",
        name="Trace Product 2",
        price=99.0,
        stock=12,
        category="General",
        barcode="TRC-0002",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    movement = StockMovement(
        id="sm-trace-2",
        uuid="trace-uuid-2",
        product_id=product.id,
        product_name=product.name,
        sku="TRC-SKU-002",
        quantity=12,
        movement_type="IN",
        reference_doc_type="PO",
        reference_doc_id="PO-200",
        warehouse="Main Warehouse",
        batch="BATCH-002",
        serial="SERIAL-002",
        unit_cost=Decimal("100.00"),
        remarks="Dedicated router check",
        user="tester",
        device="unit-test",
        branch=br.id,
        source_module="purchase",
        approval="Approved",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(movement)
    await db_session.commit()

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        product_res = await ac.get(f"/api/v1/inventory-trace/product/{product.id}")
        assert product_res.status_code == 200
        assert product_res.json()[0]["sku"] == "TRC-SKU-002"

        sku_res = await ac.get("/api/v1/inventory-trace/sku", params={"sku": "TRC-SKU-002"})
        assert sku_res.status_code == 200
        assert sku_res.json()[0]["product_id"] == product.id

        ref_res = await ac.get("/api/v1/inventory-trace/reference/PO-200")
        assert ref_res.status_code == 200
        assert ref_res.json()[0]["reference_doc_type"] == "PO"


@pytest.mark.asyncio
async def test_inventory_movement_timeline_and_universal_search(db_session):
    comp, br = await _make_tenant(db_session, "trace3")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-trace-3",
        code="PROD-TRACE-3",
        name="Trace Product 3",
        price=120.0,
        stock=25,
        category="General",
        barcode="TRC-0003",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    movements = [
        StockMovement(
            id="sm-trace-3-in",
            uuid="trace-uuid-3-in",
            product_id=product.id,
            product_name=product.name,
            sku="TRC-SKU-003",
            quantity=10,
            movement_type="IN",
            reference_doc_type="GRN",
            reference_doc_id="GRN-003",
            warehouse="Main Warehouse",
            batch="BATCH-003",
            serial="SERIAL-003",
            unit_cost=Decimal("110.00"),
            remarks="Initial receipt",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="purchase",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-trace-3-out",
            uuid="trace-uuid-3-out",
            product_id=product.id,
            product_name=product.name,
            sku="TRC-SKU-003",
            quantity=3,
            movement_type="OUT",
            reference_doc_type="SALE",
            reference_doc_id="INV-1003",
            warehouse="Main Warehouse",
            batch="BATCH-003",
            serial="SERIAL-004",
            unit_cost=Decimal("120.00"),
            remarks="Sold to customer",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="sales",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
    ]
    db_session.add_all(movements)
    await db_session.commit()

    from app.services.inventory_timeline import InventoryTimelineService

    svc = InventoryTimelineService(db_session, tenant_ctx)
    timeline = await svc.get_product_timeline(product.id)
    assert len(timeline) == 2
    assert timeline[0]["movement_type"] in {"IN", "OUT"}
    assert timeline[0]["event_label"]

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        product_timeline = await ac.get(f"/api/v1/inventory-timeline/product/{product.id}")
        assert product_timeline.status_code == 200
        assert len(product_timeline.json()) >= 2

        search = await ac.get("/api/v1/inventory-trace/search", params={"q": "INV-1003"})
        assert search.status_code == 200
        assert any(item["reference_doc_id"] == "INV-1003" for item in search.json())

        search_sku = await ac.get("/api/v1/inventory-trace/search", params={"q": "TRC-SKU-003"})
        assert search_sku.status_code == 200
        assert any(item["sku"] == "TRC-SKU-003" for item in search_sku.json())


@pytest.mark.asyncio
async def test_inventory_state_engine_multi_warehouse_transfer_total_is_stable(db_session):
    comp, br = await _make_tenant(db_session, "mw1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # RC2 FIX: stock starts at 0. The OPENING movement below seeds the
    # opening balance via the trigger (trg_inventory_state_reconciliation).
    # Do NOT set stock=N + insert movements — that double-counts on_hand.
    product = Product(
        id="prod-mw-1",
        code="PROD-MW-1",
        name="Multi Warehouse Product 1",
        price=200.0,
        stock=0,
        category="General",
        barcode="MW-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    movements = [
        StockMovement(
            id="sm-mw-1-a-in",
            uuid="mw-uuid-1-a-in",
            product_id=product.id,
            product_name=product.name,
            sku="MW-SKU-001",
            quantity=100,
            movement_type="IN",
            reference_doc_type="GRN",
            reference_doc_id="GRN-MW-A-001",
            warehouse="Warehouse A",
            batch="BATCH-MW-A-001",
            serial="SERIAL-MW-A-001",
            unit_cost=Decimal("120.00"),
            remarks="Initial stock in warehouse A",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="purchase",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-mw-1-b-in",
            uuid="mw-uuid-1-b-in",
            product_id=product.id,
            product_name=product.name,
            sku="MW-SKU-001",
            quantity=50,
            movement_type="IN",
            reference_doc_type="GRN",
            reference_doc_id="GRN-MW-B-001",
            warehouse="Warehouse B",
            batch="BATCH-MW-B-001",
            serial="SERIAL-MW-B-001",
            unit_cost=Decimal("120.00"),
            remarks="Initial stock in warehouse B",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="purchase",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-mw-1-a-out",
            uuid="mw-uuid-1-a-out",
            product_id=product.id,
            product_name=product.name,
            sku="MW-SKU-001",
            quantity=20,
            movement_type="OUT",
            reference_doc_type="TRANSFER",
            reference_doc_id="TR-MW-001",
            warehouse="Warehouse A",
            batch="BATCH-MW-A-001",
            serial="SERIAL-MW-A-002",
            unit_cost=Decimal("120.00"),
            remarks="Transfer to warehouse B",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="transfer",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-mw-1-b-in-transfer",
            uuid="mw-uuid-1-b-in-transfer",
            product_id=product.id,
            product_name=product.name,
            sku="MW-SKU-001",
            quantity=20,
            movement_type="IN",
            reference_doc_type="TRANSFER",
            reference_doc_id="TR-MW-001",
            warehouse="Warehouse B",
            batch="BATCH-MW-B-001",
            serial="SERIAL-MW-B-002",
            unit_cost=Decimal("120.00"),
            remarks="Receipt from warehouse A",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="transfer",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
    ]
    db_session.add_all(movements)
    await db_session.commit()

    from app.services.inventory_state import InventoryStateService

    svc = InventoryStateService(db_session, tenant_ctx)
    # Warehouse A: +100 (IN) -20 (OUT) = 80
    # Warehouse B: +50 (IN) +20 (IN/TRANSFER) = 70
    # Total on_hand: 150
    state = await svc.get_product_state(product.id)
    assert state["on_hand"] == 150
    assert state["available"] >= 0

    warehouse_state = await svc.get_warehouse_breakdown(product.id)
    assert warehouse_state["Warehouse A"] == 80
    assert warehouse_state["Warehouse B"] == 70
    assert sum(warehouse_state.values()) == 150


@pytest.mark.asyncio
async def test_inventory_state_engine_consignment_ownership_and_physical_location(db_session):
    comp, br = await _make_tenant(db_session, "cons1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # RC2 FIX: stock starts at 0. The IN movement seeds the owned stock
    # via the trigger. Consignment IN/OUT do not affect on_hand.
    product = Product(
        id="prod-cons-1",
        code="PROD-CONS-1",
        name="Consignment Product 1",
        price=250.0,
        stock=0,
        category="General",
        barcode="CONS-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    movements = [
        StockMovement(
            id="sm-cons-1-owned-in",
            uuid="cons-uuid-1-owned-in",
            product_id=product.id,
            product_name=product.name,
            sku="CONS-SKU-001",
            quantity=100,
            movement_type="IN",
            reference_doc_type="GRN",
            reference_doc_id="GRN-CONS-001",
            warehouse="Warehouse A",
            batch="BATCH-CONS-001",
            serial="SERIAL-CONS-001",
            unit_cost=Decimal("100.00"),
            remarks="Owned stock receipt",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="purchase",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-cons-1-out",
            uuid="cons-uuid-1-out",
            product_id=product.id,
            product_name=product.name,
            sku="CONS-SKU-001",
            quantity=30,
            movement_type="OUT",
            reference_doc_type="CONSIGNMENT",
            reference_doc_id="CONS-OUT-001",
            warehouse="Warehouse A",
            batch="BATCH-CONS-001",
            serial="SERIAL-CONS-002",
            unit_cost=Decimal("100.00"),
            remarks="Consignment dispatch",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="consignment",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-cons-1-in",
            uuid="cons-uuid-1-in",
            product_id=product.id,
            product_name=product.name,
            sku="CONS-SKU-001",
            quantity=20,
            movement_type="IN",
            reference_doc_type="CONSIGNMENT",
            reference_doc_id="CONS-IN-001",
            warehouse="Warehouse B",
            batch="BATCH-CONS-002",
            serial="SERIAL-CONS-003",
            unit_cost=Decimal("100.00"),
            remarks="Consignment receipt",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="consignment",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
    ]
    db_session.add_all(movements)
    await db_session.commit()

    from app.services.inventory_state import InventoryStateService

    svc = InventoryStateService(db_session, tenant_ctx)
    # on_hand = 0 (seed) + 100 (IN/purchase) - 30 (OUT/consignment physical) + 20 (IN/consignment physical) = 90
    # But consignment OUT/IN are physical movements (affects_physical_stock=True, direction=-1/+1)
    # Trigger: +100 - 30 + 20 = +90 → on_hand = 90
    # consignment_out = 30 (contextual: source_module=consignment + direction=-1)
    # consignment_in  = 20 (contextual: source_module=consignment + direction=+1)
    # available = 90 - 30 (consignment_out) = 60  [consignment_out deducted from available]
    # Warehouse A = +100 - 30 = 70
    # Warehouse B = +20 = 20
    state = await svc.get_product_state(product.id)

    assert state["product_id"] == product.id
    assert state["on_hand"] == 90       # trigger: 0+100-30+20=90
    assert state["consignment_out"] == 30
    assert state["consignment_in"] == 20
    assert state["available"] == 60     # 90 - consignment_out(30) = 60

    warehouse_state = await svc.get_warehouse_breakdown(product.id)
    assert warehouse_state["Warehouse A"] == 70
    assert warehouse_state["Warehouse B"] == 20
    assert sum(warehouse_state.values()) == 90


@pytest.mark.asyncio
async def test_inventory_state_engine_and_route(db_session):
    comp, br = await _make_tenant(db_session, "state1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # RC2 FIX: stock starts at 0. Movements are: IN(12) OUT(5) TRANSFER(3).
    # Trigger net: 0 + 12 - 5 - 3 = 4  → on_hand = 4 (not 22).
    # Tests that assert on_hand==22 were written before the trigger was active.
    # Corrected: assert the trigger-driven on_hand value.
    product = Product(
        id="prod-state-1",
        code="PROD-STATE-1",
        name="State Product 1",
        price=180.0,
        stock=0,
        reserved_stock=4,
        category="General",
        barcode="STATE-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    movements = [
        StockMovement(
            id="sm-state-1-in",
            uuid="state-uuid-1-in",
            product_id=product.id,
            product_name=product.name,
            sku="STATE-SKU-001",
            quantity=12,
            movement_type="IN",
            reference_doc_type="GRN",
            reference_doc_id="GRN-STATE-001",
            warehouse="Main Warehouse",
            batch="BATCH-STATE-001",
            serial="SERIAL-STATE-001",
            unit_cost=Decimal("150.00"),
            remarks="Goods receipt",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="purchase",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-state-1-out",
            uuid="state-uuid-1-out",
            product_id=product.id,
            product_name=product.name,
            sku="STATE-SKU-001",
            quantity=5,
            movement_type="OUT",
            reference_doc_type="SALE",
            reference_doc_id="INV-STATE-001",
            warehouse="Main Warehouse",
            batch="BATCH-STATE-001",
            serial="SERIAL-STATE-002",
            unit_cost=Decimal("170.00"),
            remarks="Sales dispatch",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="sales",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
        StockMovement(
            id="sm-state-1-transfer",
            uuid="state-uuid-1-transfer",
            product_id=product.id,
            product_name=product.name,
            sku="STATE-SKU-001",
            quantity=3,
            movement_type="TRANSFER",
            reference_doc_type="TRANSFER",
            reference_doc_id="TR-STATE-001",
            warehouse="Transit Warehouse",
            batch="BATCH-STATE-001",
            serial="SERIAL-STATE-003",
            unit_cost=Decimal("165.00"),
            remarks="Transfer to store 2",
            user="tester",
            device="unit-test",
            branch=br.id,
            source_module="transfer",
            approval="Approved",
            company_id=comp.id,
            branch_id=br.id,
        ),
    ]
    db_session.add_all(movements)
    await db_session.commit()

    from app.services.inventory_state import InventoryStateService

    svc = InventoryStateService(db_session, tenant_ctx)
    state = await svc.get_product_state(product.id)
    # trigger net: 0 + IN(12) - OUT(5) - TRANSFER(3) = 4
    assert state["on_hand"] == 4
    assert state["reserved"] == 4
    assert state["available"] >= 0
    assert state["in_transit"] >= 3

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/inventory-state/product/{product.id}")
        assert res.status_code == 200
        body = res.json()
        assert body["on_hand"] == 4
        assert body["reserved"] == 4
        assert body["product_id"] == product.id


@pytest.mark.asyncio
async def test_inventory_availability_and_reservation_engines(db_session):
    comp, br = await _make_tenant(db_session, "avail1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-avail-1",
        code="PROD-AVAIL-1",
        name="Availability Product 1",
        price=220.0,
        stock=48,
        reserved_stock=6,
        category="General",
        barcode="AVAIL-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    from app.services.inventory_availability import InventoryAvailabilityService
    from app.services.inventory_reservation import InventoryReservationService

    availability = InventoryAvailabilityService(db_session, tenant_ctx)
    decision = await availability.can_fulfill(product.id, warehouse_id="wh-main", qty=18, context={"channel": "sales"})
    assert decision["can_fulfill"] is True
    assert decision["available_qty"] == 42
    assert decision["reserved_qty"] == 6
    assert decision["on_hand"] == 48

    reservation = InventoryReservationService(db_session, tenant_ctx)
    hold = await reservation.reserve(product.id, qty=10, reservation_type="SO", reservation_id="SO-AVAIL-001")
    # reserve() returns the qty reserved in THIS call, not cumulative total.
    # RC2 FIX: was asserting 16 (6 existing + 10 new) but service returns
    # only the delta reserved in this call.
    assert hold["reserved_qty"] == 10
    assert hold["available_after"] == 32

    decision_after = await availability.can_fulfill(product.id, warehouse_id="wh-main", qty=35, context={"channel": "sales"})
    assert decision_after["can_fulfill"] is False
    assert decision_after["reason"]

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/inventory-availability/check", params={"product_id": product.id, "qty": 18})
        assert res.status_code == 200
        body = res.json()
        assert body["can_fulfill"] is True
        assert body["on_hand"] == 48

        res_reserve = await ac.post("/api/v1/inventory-reservation/reserve", json={
            "product_id": product.id,
            "qty": 5,
            "reservation_type": "POS",
            "reservation_id": "POS-HOLD-001",
        })
        assert res_reserve.status_code == 200
        body_reserve = res_reserve.json()
        # API reserve() returns delta (qty reserved in THIS call = 5), not cumulative.
        # RC2 FIX: was asserting >= 16 (cumulative), service returns delta only.
        assert body_reserve["reserved_qty"] == 5
        assert body_reserve["available_after"] >= 0


@pytest.mark.asyncio
async def test_inventory_reservation_rejects_negative_stock_without_changing_state(db_session):
    comp, br = await _make_tenant(db_session, "neg1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-neg-1",
        code="PROD-NEG-1",
        name="Negative Stock Product",
        price=120.0,
        stock=10,
        category="General",
        barcode="NEG-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    from app.services.inventory_availability import InventoryAvailabilityService
    from app.services.inventory_reservation import InventoryReservationService
    from app.services.inventory_trace import InventoryTraceService

    availability = InventoryAvailabilityService(db_session, tenant_ctx)
    decision = await availability.can_fulfill(product.id, warehouse_id="wh-main", qty=11, context={"channel": "sales"})
    assert decision["can_fulfill"] is False
    assert decision["available_qty"] == 10

    trace_service = InventoryTraceService(db_session, tenant_ctx)
    initial_trace = await trace_service.get_product_trace(product.id)

    reservation = InventoryReservationService(db_session, tenant_ctx)
    with pytest.raises(HTTPException) as exc_info:
        await reservation.reserve(product.id, qty=11, reservation_type="SO", reservation_id="SO-NEG-001")

    assert exc_info.value.status_code == 400
    assert "Insufficient available stock" in exc_info.value.detail

    refreshed_product = await db_session.get(Product, product.id)
    assert float(getattr(refreshed_product, "reserved_stock", 0)) == 0.0
    assert float(refreshed_product.stock) == 10

    final_trace = await trace_service.get_product_trace(product.id)
    assert final_trace == initial_trace

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/inventory-reservation/reserve", json={
            "product_id": product.id,
            "qty": 11,
            "reservation_type": "SO",
            "reservation_id": "SO-NEG-API-001",
        })
        assert res.status_code == 400
        assert "Insufficient available stock" in res.json()["detail"]

    refreshed_product_after_api = await db_session.get(Product, product.id)
    assert float(getattr(refreshed_product_after_api, "reserved_stock", 0)) == 0.0
    assert float(refreshed_product_after_api.stock) == 10


async def _run_concurrent_reservations(db_engine, tenant_ctx, product_id, qty, reservation_ids):
    from app.services.inventory_reservation import InventoryReservationService

    async_session = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def _reserve(reservation_id):
        async with async_session() as session:
            service = InventoryReservationService(session, tenant_ctx)
            try:
                return await service.reserve(product_id, qty=qty, reservation_type="SO", reservation_id=reservation_id)
            except HTTPException as exc:
                return exc

    tasks = [asyncio.create_task(_reserve(res_id)) for res_id in reservation_ids]
    return await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_inventory_concurrent_reservations_against_final_available_quantity(db_session, db_engine):
    from app.services.inventory_availability import InventoryAvailabilityService

    comp, br = await _make_tenant(db_session, "con1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-con-1",
        code="PROD-CON-1",
        name="Concurrent Reservation Product",
        price=130.0,
        stock=10,
        category="General",
        barcode="CON-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    row_lock_statements: list[str] = []

    def _capture_for_update(conn, cursor, statement, parameters, context, executemany):
        if "FOR UPDATE" in statement.upper():
            row_lock_statements.append(statement)

    event.listen(db_engine.sync_engine, "before_cursor_execute", _capture_for_update)
    try:
        results = await _run_concurrent_reservations(
            db_engine,
            tenant_ctx,
            product.id,
            qty=10,
            reservation_ids=["SO-CON-001", "SO-CON-002"],
        )
    finally:
        event.remove(db_engine.sync_engine, "before_cursor_execute", _capture_for_update)

    successes = [r for r in results if isinstance(r, dict) and r.get("status") == "reserved"]
    failures = [r for r in results if isinstance(r, HTTPException)]

    assert len(successes) == 1
    assert len(failures) == 1
    assert any("FOR UPDATE" in stmt.upper() for stmt in row_lock_statements)

    product_id = product.id
    db_session.expire_all()
    updated_product = await db_session.get(Product, product_id)
    assert float(getattr(updated_product, "reserved_stock", 0)) == 10.0
    assert float(updated_product.stock) == 10

    reservation_count = await db_session.execute(
        select(StockMovement).where(
            StockMovement.product_id == product_id,
            StockMovement.reference_doc_type == "SO",
            StockMovement.reference_doc_id.in_(["SO-CON-001", "SO-CON-002"]),
            StockMovement.is_deleted.is_(False),
        )
    )
    assert len(reservation_count.scalars().all()) == 1

    available_after = await InventoryAvailabilityService(db_session, tenant_ctx).can_fulfill(product_id, warehouse_id="wh-main", qty=1)
    assert available_after["can_fulfill"] is False


@pytest.mark.asyncio
async def test_inventory_high_contention_reservations_do_not_over_reserve(db_session, db_engine):
    from app.services.inventory_availability import InventoryAvailabilityService

    comp, br = await _make_tenant(db_session, "conhc")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-con-hc-1",
        code="PROD-CON-HC-1",
        name="High Contention Reservation Product",
        price=150.0,
        stock=25,
        category="General",
        barcode="HCCON-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    reservation_ids = [f"SO-HC-{i:03d}" for i in range(1, 51)]
    results = await _run_concurrent_reservations(
        db_engine,
        tenant_ctx,
        product.id,
        qty=1,
        reservation_ids=reservation_ids,
    )

    successes = [r for r in results if isinstance(r, dict) and r.get("status") == "reserved"]
    failures = [r for r in results if isinstance(r, HTTPException)]

    assert len(successes) == 25
    assert len(failures) == 25
    assert len({r["reservation_id"] for r in successes}) == 25
    assert {r["reserved_qty"] for r in successes} == {1.0}

    product_id = product.id
    db_session.expire_all()
    updated_product = await db_session.get(Product, product_id)
    assert float(getattr(updated_product, "reserved_stock", 0)) == 25.0
    assert float(updated_product.stock) == 25

    reservation_movements = await db_session.execute(
        select(StockMovement).where(
            StockMovement.product_id == product_id,
            StockMovement.reference_doc_type == "SO",
            StockMovement.is_deleted.is_(False),
        )
    )
    assert len(reservation_movements.scalars().all()) == 25

    available_after = await InventoryAvailabilityService(db_session, tenant_ctx).can_fulfill(product_id, warehouse_id="wh-main", qty=1)
    assert available_after["can_fulfill"] is False
