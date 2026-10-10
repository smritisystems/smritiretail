"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.1
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Domain Verification Test Suite — Phase 6 POS & GRN Tracking Wiring
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.pos import CashRegister, Shift
from app.models.inventory import Product, Warehouse, StockMovement, ProductBatchStock
from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, Supplier
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.item_master import Item, ItemBatch, ItemSerial, ItemWarehouseLocation
from app.api.deps import get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    await clear_db(db_session)
    yield
    try:
        await clear_db(db_session)
    except Exception:
        pass
    app.dependency_overrides.pop(get_tenant_context, None)


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": role_val,
        "company_id": comp_id,
        "branch_id": br_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(comp_id: str, br_id: str):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


async def _setup_tracking_context(db_session, s: str):
    comp = Company(
        id=f"comp-p6-{s}",
        name=f"Comp P6 {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-p6-{s}",
        company_id=comp.id,
        name=f"Branch P6 {s}",
        code=f"BRP6-{s}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh-p6-{s}",
        company_id=comp.id,
        branch_id=br.id,
        code=f"WH-P6-{s}",
        name="Central Godown",
        address="POS Test Warehouse",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        is_central_godown=True,
        is_active=True,
    )
    user = User(
        id=f"usr-p6-{s}",
        username=f"usr_p6_{s}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.MANAGER,
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    reg = CashRegister(
        id=f"reg-p6-{s}",
        name=f"Counter P6 {s}",
        code=f"REG-P6-{s}",
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add_all([warehouse, user, reg])
    await db_session.flush()

    # Canonical Item Master entity
    item = Item(
        id=f"itm_{s}",
        item_code=f"ITM-{s.upper()}",
        item_name=f"Item {s}",
        category="Apparel",
        primary_uom="PCS",
        uom="PCS",
        tracking_type="BATCH",
        tracking_mode="BATCH",
        is_batch_tracked=True,
        is_serial_tracked=False,
        company_id=comp.id,
        branch_id=br.id,
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    # Inventory Product entity
    prod = Product(
        id=f"prod-{s}",
        name=f"Product {s}",
        code=f"SKU-{s.upper()}",
        barcode=f"BC-{s.upper()}",
        category="Apparel",
        price=100.00,
        cost_price=50.00,
        stock=100,
        item_id=item.id,
        tracking_mode="Batch",
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(prod)
    await db_session.flush()

    # Tracking Primitives: Batch, Serial, Warehouse Location
    batch = ItemBatch(
        id=f"batch_{s}",
        company_id=comp.id,
        branch_id=br.id,
        item_id=item.id,
        batch_number=f"BATCH-{s.upper()}",
        mrp=Decimal("100.00"),
        cost_price=Decimal("50.00"),
        is_active=True,
    )
    serial = ItemSerial(
        id=f"ser_{s}",
        company_id=comp.id,
        branch_id=br.id,
        item_id=item.id,
        serial_number=f"SN-{s.upper()}-001",
        status="AVAILABLE",
        warehouse_id=warehouse.id,
        is_active=True,
    )
    loc = ItemWarehouseLocation(
        id=f"loc_{s}",
        company_id=comp.id,
        branch_id=br.id,
        item_id=item.id,
        warehouse_id=warehouse.id,
        location_bin="RACK-A1-BIN-04",
        is_active=True,
    )
    # WMS batch inventory record
    batch_stock = ProductBatchStock(
        id=f"pbs_{s}",
        company_id=comp.id,
        branch_id=br.id,
        product_id=prod.id,
        warehouse_id=warehouse.id,
        batch_no=batch.batch_number,
        quantity=Decimal("50.00"),
        mrp=Decimal("100.00"),
        purchase_rate=Decimal("50.00"),
    )
    shift = Shift(
        id=f"sh-{s}",
        register_id=reg.id,
        cashier_id=user.id,
        status="OPEN",
        opened_at=datetime.now(timezone.utc),
        opening_balance=Decimal("500.00"),
        cash_sales_total=Decimal("0"),
        card_sales_total=Decimal("0"),
        upi_sales_total=Decimal("0"),
        total_sales=Decimal("0"),
        total_invoices="0",
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add_all([batch, serial, loc, batch_stock, shift])
    await db_session.commit()

    _set_tenant(comp.id, br.id)

    return {
        "comp": comp,
        "br": br,
        "warehouse": warehouse,
        "user": user,
        "reg": reg,
        "item": item,
        "prod": prod,
        "batch": batch,
        "serial": serial,
        "loc": loc,
        "shift": shift,
    }


@pytest.mark.asyncio
async def test_pos_checkout_with_batch_serial_location_wiring(db_session):
    """
    POST /api/v1/pos/checkout with batch_id, serial_id, warehouse_location_id:
    Verifies that SalesInvoiceItem and StockMovement carry the tracking foreign keys.
    """
    s = uuid.uuid4().hex[:6]
    ctx = await _setup_tracking_context(db_session, s)

    payload = {
        "invoice_no": f"POS-TRK-{s}",
        "shift_id": ctx["shift"].id,
        "payment_mode": "CASH",
        "grand_total": "100.00",
        "items": [{
            "product_id": ctx["prod"].id,
            "code": ctx["prod"].code,
            "name": ctx["prod"].name,
            "quantity": "1",
            "price": "100.00",
            "gst_rate": "0.00",
            "batch_id": ctx["batch"].id,
            "serial_id": ctx["serial"].id,
            "warehouse_location_id": ctx["loc"].id,
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/v1/pos/checkout",
            json=payload,
            headers=_bearer(ctx["user"], ctx["comp"].id, ctx["br"].id),
        )

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["invoice_no"] == f"POS-TRK-{s}"

    # 1. Verify SalesInvoiceItem in DB has batch_id, serial_id, warehouse_location_id
    inv_item = (await db_session.execute(
        select(SalesInvoiceItem).where(
            SalesInvoiceItem.code == ctx["prod"].code,
            SalesInvoiceItem.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert inv_item is not None, "SalesInvoiceItem not found"
    assert inv_item.batch_id == ctx["batch"].id
    assert inv_item.serial_id == ctx["serial"].id
    assert inv_item.warehouse_location_id == ctx["loc"].id

    # 2. Verify StockMovement carries batch_id, serial_id, and location_id
    mov = (await db_session.execute(
        select(StockMovement).where(
            StockMovement.product_id == ctx["prod"].id,
            StockMovement.movement_type == "OUTWARD_SALE",
            StockMovement.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert mov is not None, "StockMovement OUTWARD_SALE not found"
    assert mov.batch_id == ctx["batch"].id
    assert mov.serial_id == ctx["serial"].id
    assert mov.location_id == ctx["loc"].id


@pytest.mark.asyncio
async def test_grn_purchase_receipt_with_explicit_batch_and_location(db_session):
    """
    POST /api/v1/purchase/receipts/ with batch_id and warehouse_location_id:
    Verifies that PurchaseReceiptItem and StockMovement carry tracking foreign keys.
    """
    s = uuid.uuid4().hex[:6]
    ctx = await _setup_tracking_context(db_session, s)

    supplier = Supplier(
        id=f"sup-{s}",
        name=f"Supplier {s}",
        code=f"SUP-{s}",
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        is_active=True,
    )
    db_session.add(supplier)
    await db_session.commit()

    grn_payload = {
        "supplier_id": supplier.id,
        "warehouse_id": ctx["warehouse"].id,
        "receipt_no": f"GRN-TRK-{s}",
        "items": [{
            "product_id": ctx["prod"].id,
            "code": ctx["prod"].code,
            "name": ctx["prod"].name,
            "batch_no": ctx["batch"].batch_number,
            "batch_id": ctx["batch"].id,
            "warehouse_location_id": ctx["loc"].id,
            "quantity_received": "5",
            "cost_price": "50.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/v1/purchase/receipts/",
            json=grn_payload,
            headers=_bearer(ctx["user"], ctx["comp"].id, ctx["br"].id),
        )

    assert res.status_code == 201, res.text
    grn_data = res.json()
    assert grn_data["receipt_no"] == f"GRN-TRK-{s}"

    # 1. Verify PurchaseReceiptItem carries batch_id and warehouse_location_id
    rcpt_item = (await db_session.execute(
        select(PurchaseReceiptItem).where(
            PurchaseReceiptItem.receipt_id == grn_data["id"],
            PurchaseReceiptItem.product_id == ctx["prod"].id,
        )
    )).scalars().first()
    assert rcpt_item is not None, "PurchaseReceiptItem not found"
    assert rcpt_item.batch_id == ctx["batch"].id
    assert rcpt_item.warehouse_location_id == ctx["loc"].id

    # 2. Verify StockMovement INWARD_GRN carries batch_id and location_id
    mov = (await db_session.execute(
        select(StockMovement).where(
            StockMovement.reference_doc_id == grn_data["id"],
            StockMovement.movement_type == "INWARD_GRN",
            StockMovement.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert mov is not None, "StockMovement INWARD_GRN not found"
    assert mov.batch_id == ctx["batch"].id
    assert mov.location_id == ctx["loc"].id


@pytest.mark.asyncio
async def test_grn_purchase_receipt_auto_resolves_batch_and_location(db_session):
    """
    POST /api/v1/purchase/receipts/ with batch_no but without batch_id:
    Verifies that ItemTrackingService auto-resolves or creates ItemBatch and
    ItemWarehouseLocation, propagating to both PurchaseReceiptItem and StockMovement.
    """
    s = uuid.uuid4().hex[:6]
    ctx = await _setup_tracking_context(db_session, s)

    supplier = Supplier(
        id=f"sup-{s}",
        name=f"Supplier {s}",
        code=f"SUP-{s}",
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        is_active=True,
    )
    db_session.add(supplier)
    await db_session.commit()

    auto_batch_no = f"AUTO-B-{s.upper()}"
    grn_payload = {
        "supplier_id": supplier.id,
        "warehouse_id": ctx["warehouse"].id,
        "receipt_no": f"GRN-AUTO-{s}",
        "items": [{
            "product_id": ctx["prod"].id,
            "code": ctx["prod"].code,
            "name": ctx["prod"].name,
            "batch_no": auto_batch_no,
            "quantity_received": "10",
            "cost_price": "45.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/v1/purchase/receipts/",
            json=grn_payload,
            headers=_bearer(ctx["user"], ctx["comp"].id, ctx["br"].id),
        )

    assert res.status_code == 201, res.text
    grn_data = res.json()

    rcpt_item = (await db_session.execute(
        select(PurchaseReceiptItem).where(
            PurchaseReceiptItem.receipt_id == grn_data["id"],
            PurchaseReceiptItem.product_id == ctx["prod"].id,
        )
    )).scalars().first()
    assert rcpt_item is not None
    assert rcpt_item.batch_id is not None, "batch_id should be auto-resolved"
    assert rcpt_item.warehouse_location_id is not None, "warehouse_location_id should be auto-resolved"

    mov = (await db_session.execute(
        select(StockMovement).where(
            StockMovement.reference_doc_id == grn_data["id"],
            StockMovement.movement_type == "INWARD_GRN",
            StockMovement.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert mov is not None
    assert mov.batch_id == rcpt_item.batch_id
    assert mov.location_id == rcpt_item.warehouse_location_id
