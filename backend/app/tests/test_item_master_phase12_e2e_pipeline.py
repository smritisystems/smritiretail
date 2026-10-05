"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.7
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Verification Test Suite:
Item Master Phase 12 — End-to-End Operational Pipeline Validation & Final Catalog Certification
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, Warehouse, StockMovement, ProductBatchStock
from app.models.item_master import Item, ItemVariant, ItemBarcode, ItemBatch, ItemSerial, ItemWarehouseLocation
from app.models.pos import CashRegister, Shift
from app.models.sales import SalesInvoiceItem
from app.core.security import hash_password, create_access_token
from app.api.deps import get_tenant_context, TenantContext


def _bearer(user: User, comp_id: str, br_id: str):
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


async def _setup_e2e_context(db_session, s: str):
    comp = Company(
        id=f"comp-p12-{s}",
        name=f"Comp P12 {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-p12-{s}",
        company_id=comp.id,
        name=f"Branch P12 {s}",
        code=f"BRP12-{s}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh-p12-{s}",
        company_id=comp.id,
        branch_id=br.id,
        code=f"WH-P12-{s}",
        name="Central Godown",
        address="POS Test Warehouse",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        is_central_godown=True,
        is_active=True,
    )
    user = User(
        id=f"usr-p12-{s}",
        username=f"usr_p12_{s}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.MANAGER,
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    reg = CashRegister(
        id=f"reg-p12-{s}",
        name=f"Counter P12 {s}",
        code=f"REG-P12-{s}",
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add_all([warehouse, user, reg])
    await db_session.flush()

    shift = Shift(
        id=f"sh-p12-{s}",
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
    db_session.add(shift)
    await db_session.commit()

    _set_tenant(comp.id, br.id)

    return {
        "comp": comp,
        "br": br,
        "warehouse": warehouse,
        "user": user,
        "reg": reg,
        "shift": shift,
    }


@pytest.mark.asyncio
async def test_e2e_pipeline_standard_item_checkout(db_session):
    """
    Verifies that a standard (non-tracked) item with canonical Item Master
    representation executes through POS checkout and records inventory stock movements.
    """
    s = uuid.uuid4().hex[:6]
    ctx = await _setup_e2e_context(db_session, s)

    item = Item(
        id=f"itm_std_{s}",
        item_code=f"ITM-STD-{s.upper()}",
        item_name=f"Standard Item {s}",
        category="Apparel",
        primary_uom="PCS",
        uom="PCS",
        tracking_type="NONE",
        tracking_mode="NONE",
        is_batch_tracked=False,
        is_serial_tracked=False,
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    prod = Product(
        id=f"prod_std_{s}",
        name=f"Product Standard {s}",
        code=f"SKU-STD-{s.upper()}",
        barcode=f"BC-STD-{s.upper()}",
        category="Apparel",
        price=250.00,
        cost_price=120.00,
        stock=100,
        item_id=item.id,
        tracking_mode="None",
        is_active=True,
        is_deleted=False,
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
    )
    db_session.add(prod)
    await db_session.commit()

    payload = {
        "invoice_no": f"POS-STD-{s}",
        "shift_id": ctx["shift"].id,
        "payment_mode": "CASH",
        "grand_total": "250.00",
        "items": [{
            "product_id": prod.id,
            "code": prod.code,
            "name": prod.name,
            "quantity": "1",
            "price": "250.00",
            "gst_rate": "0.00",
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

    # Verify SalesInvoiceItem in DB carries item_id
    inv_item = (await db_session.execute(
        select(SalesInvoiceItem).where(
            SalesInvoiceItem.code == prod.code,
            SalesInvoiceItem.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert inv_item is not None
    assert inv_item.item_id == item.id

    # Verify StockMovement OUTWARD_SALE
    mov = (await db_session.execute(
        select(StockMovement).where(
            StockMovement.product_id == prod.id,
            StockMovement.movement_type == "OUTWARD_SALE",
            StockMovement.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert mov is not None
    assert mov.item_id == item.id


@pytest.mark.asyncio
async def test_e2e_pipeline_batch_tracked_checkout(db_session):
    """
    Verifies that a batch-tracked item successfully registers batch lot allocation
    and generates tracked stock movements during checkout.
    """
    s = uuid.uuid4().hex[:6]
    ctx = await _setup_e2e_context(db_session, s)

    item = Item(
        id=f"itm_bat_{s}",
        item_code=f"ITM-BAT-{s.upper()}",
        item_name=f"Batch Item {s}",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="BATCH",
        tracking_mode="BATCH",
        is_batch_tracked=True,
        is_serial_tracked=False,
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    prod = Product(
        id=f"prod_bat_{s}",
        name=f"Product Batch {s}",
        code=f"SKU-BAT-{s.upper()}",
        barcode=f"BC-BAT-{s.upper()}",
        category="Footwear",
        price=1500.00,
        cost_price=800.00,
        stock=50,
        item_id=item.id,
        tracking_mode="Batch",
        is_active=True,
        is_deleted=False,
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
    )
    batch = ItemBatch(
        id=f"batch_p12_{s}",
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        item_id=item.id,
        batch_number=f"LOT-P12-{s.upper()}",
        mfg_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        exp_date=datetime(2028, 1, 1, tzinfo=timezone.utc),
        mrp=Decimal("1500.00"),
        cost_price=Decimal("800.00"),
        is_active=True,
        is_deleted=False,
    )
    batch_stock = ProductBatchStock(
        id=f"bs-p12-{s}",
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        product_id=prod.id,
        warehouse_id=ctx["warehouse"].id,
        batch_no=batch.batch_number,
        quantity=Decimal("50.00"),
        mrp=Decimal("1500.00"),
        purchase_rate=Decimal("800.00"),
    )
    db_session.add_all([prod, batch, batch_stock])
    await db_session.commit()

    payload = {
        "invoice_no": f"POS-BAT-{s}",
        "shift_id": ctx["shift"].id,
        "payment_mode": "CASH",
        "grand_total": "1500.00",
        "items": [{
            "product_id": prod.id,
            "code": prod.code,
            "name": prod.name,
            "quantity": "1",
            "price": "1500.00",
            "gst_rate": "0.00",
            "batch_id": batch.id,
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

    inv_item = (await db_session.execute(
        select(SalesInvoiceItem).where(
            SalesInvoiceItem.code == prod.code,
            SalesInvoiceItem.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert inv_item is not None
    assert inv_item.batch_id == batch.id

    mov = (await db_session.execute(
        select(StockMovement).where(
            StockMovement.product_id == prod.id,
            StockMovement.movement_type == "OUTWARD_SALE",
            StockMovement.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert mov is not None
    assert mov.batch_id == batch.id


@pytest.mark.asyncio
async def test_e2e_pipeline_serial_tracked_checkout(db_session):
    """
    Verifies that a serial-tracked item checkout assigns serial_id to the invoice line
    and stock movement.
    """
    s = uuid.uuid4().hex[:6]
    ctx = await _setup_e2e_context(db_session, s)

    item = Item(
        id=f"itm_ser_{s}",
        item_code=f"ITM-SER-{s.upper()}",
        item_name=f"Serial Item {s}",
        category="Electronics",
        primary_uom="PCS",
        uom="PCS",
        tracking_type="SERIAL",
        tracking_mode="SERIAL",
        is_batch_tracked=False,
        is_serial_tracked=True,
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    prod = Product(
        id=f"prod_ser_{s}",
        name=f"Product Serial {s}",
        code=f"SKU-SER-{s.upper()}",
        barcode=f"BC-SER-{s.upper()}",
        category="Electronics",
        price=5000.00,
        cost_price=3500.00,
        stock=10,
        item_id=item.id,
        tracking_mode="Serial",
        is_active=True,
        is_deleted=False,
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
    )
    serial = ItemSerial(
        id=f"ser_p12_{s}",
        company_id=ctx["comp"].id,
        branch_id=ctx["br"].id,
        item_id=item.id,
        serial_number=f"SN-P12-{s.upper()}",
        status="IN_STOCK",
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([prod, serial])
    await db_session.commit()

    payload = {
        "invoice_no": f"POS-SER-{s}",
        "shift_id": ctx["shift"].id,
        "payment_mode": "CASH",
        "grand_total": "5000.00",
        "items": [{
            "product_id": prod.id,
            "code": prod.code,
            "name": prod.name,
            "quantity": "1",
            "price": "5000.00",
            "gst_rate": "0.00",
            "serial_id": serial.id,
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

    inv_item = (await db_session.execute(
        select(SalesInvoiceItem).where(
            SalesInvoiceItem.code == prod.code,
            SalesInvoiceItem.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert inv_item is not None
    assert inv_item.serial_id == serial.id

    mov = (await db_session.execute(
        select(StockMovement).where(
            StockMovement.product_id == prod.id,
            StockMovement.movement_type == "OUTWARD_SALE",
            StockMovement.company_id == ctx["comp"].id,
        )
    )).scalars().first()
    assert mov is not None
    assert mov.serial_id == serial.id


@pytest.mark.asyncio
async def test_e2e_pipeline_catalog_certification_invariants(db_session):
    """
    Validates that database invariants for the entire Item Master domain
    hold strictly in the live test environment.
    """
    # 1. 0 NULL company_id on catalog child tables
    child_tables = [
        "item_variants",
        "item_barcodes",
        "item_batches",
        "item_serials",
        "item_warehouse_locations",
    ]
    for tbl in child_tables:
        null_cnt = (await db_session.execute(text(f"SELECT count(*) FROM {tbl} WHERE company_id IS NULL;"))).scalar()
        assert null_cnt == 0, f"{tbl} contains {null_cnt} NULL company_id records"

    # 2. 0 Dual-tracking violations on items
    dual_cnt = (await db_session.execute(text(
        "SELECT count(*) FROM items WHERE is_batch_tracked = TRUE AND is_serial_tracked = TRUE;"
    ))).scalar()
    assert dual_cnt == 0, f"Found {dual_cnt} dual-tracking items in database"

    # 3. 0 Unlinked active non-deleted products
    unlinked_cnt = (await db_session.execute(text(
        "SELECT count(*) FROM products WHERE item_id IS NULL AND is_active = TRUE AND is_deleted IS NOT TRUE;"
    ))).scalar()
    assert unlinked_cnt == 0, f"Found {unlinked_cnt} unlinked active legacy products"
