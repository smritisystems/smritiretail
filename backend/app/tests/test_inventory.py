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

import uuid
import pytest
from decimal import Decimal
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

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
async def test_inventory_state_engine_and_route(db_session):
    comp, br = await _make_tenant(db_session, "state1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-state-1",
        code="PROD-STATE-1",
        name="State Product 1",
        price=180.0,
        stock=22,
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
    assert state["on_hand"] == 22
    assert state["reserved"] == 4
    assert state["available"] >= 0
    assert state["in_transit"] >= 3

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/inventory-state/product/{product.id}")
        assert res.status_code == 200
        body = res.json()
        assert body["on_hand"] == 22
        assert body["reserved"] == 4
        assert body["product_id"] == product.id


@pytest.mark.asyncio
async def test_inventory_360_workspace_service_and_route(db_session):
    comp, br = await _make_tenant(db_session, "workspace1")
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    product = Product(
        id="prod-workspace-1",
        code="PROD-WORKSPACE-1",
        name="Workspace Product 1",
        price=200.0,
        stock=30,
        reserved_stock=6,
        category="General",
        barcode="WS-0001",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(product)
    await db_session.commit()

    movements = [
        StockMovement(
            id="sm-workspace-1-in",
            uuid="workspace-uuid-1-in",
            product_id=product.id,
            product_name=product.name,
            sku="WS-SKU-001",
            quantity=15,
            movement_type="IN",
            reference_doc_type="GRN",
            reference_doc_id="GRN-WS-001",
            warehouse="Main Warehouse",
            batch="BATCH-WS-001",
            serial="SERIAL-WS-001",
            unit_cost=Decimal("180.00"),
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
            id="sm-workspace-1-out",
            uuid="workspace-uuid-1-out",
            product_id=product.id,
            product_name=product.name,
            sku="WS-SKU-001",
            quantity=5,
            movement_type="OUT",
            reference_doc_type="SALE",
            reference_doc_id="INV-WS-001",
            warehouse="Main Warehouse",
            batch="BATCH-WS-001",
            serial="SERIAL-WS-002",
            unit_cost=Decimal("190.00"),
            remarks="Sales dispatch",
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

    from app.services.inventory_360 import Inventory360Service

    svc = Inventory360Service(db_session, tenant_ctx)
    workspace = await svc.get_product_workspace(product.id)
    assert workspace["product_id"] == product.id
    assert workspace["state"]["on_hand"] == 30
    assert workspace["timeline"][0]["product_id"] == product.id

    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/inventory-360/product/{product.id}")
        assert res.status_code == 200
        body = res.json()
        assert body["product_id"] == product.id
        assert body["state"]["on_hand"] == 30
        assert len(body["timeline"]) >= 2

