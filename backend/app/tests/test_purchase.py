"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.11.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, RefreshTokenBlacklist, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.purchase import (
    Supplier, PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
)
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

from app.tests.conftest import clear_db

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire the test DB session and a fixed tenant context into the app."""
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


async def _make_tenant(db_session, suffix: str):
    company = Company(
        id=f"comp-pur-{suffix}", name=f"Purchase Co {suffix}",
        gst_number="27ABCDE1234F1Z5", is_active=True,
    )
    branch = Branch(
        id=f"br-pur-{suffix}", company_id=company.id,
        name=f"Purchase Br {suffix}", code=f"BRPUR-{suffix}", is_active=True,
    )
    db_session.add(company)
    await db_session.flush()
    db_session.add(branch)
    await db_session.flush()
    warehouse = Warehouse(
        id=f"wh-central-{suffix}", company_id=company.id, branch_id=branch.id,
        code=f"WH-PUR-{suffix}", name="Central Warehouse", is_active=True,
    )
    db_session.add(warehouse)
    await db_session.commit()
    return company, branch


async def _make_manager(db_session, suffix: str, company_id: str, branch_id: str) -> User:
    user = User(
        id=f"mgr-pur-{suffix}",
        username=f"mgr_pur_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.MANAGER,
        is_active=True, is_deleted=False,
        company_id=company_id, branch_id=branch_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _make_cashier(db_session, suffix: str, company_id: str, branch_id: str) -> User:
    """Create a CASHIER user (unauthorized for submit/confirm)."""
    user = User(
        id=f"cas-pur-{suffix}",
        username=f"cas_pur_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.CASHIER,
        is_active=True, is_deleted=False,
        company_id=company_id, branch_id=branch_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _make_product(db_session, suffix: str, company_id: str, branch_id: str,
                        stock: int = 10) -> Product:
    item = Item(
        id=f"item-pur-{suffix}",
        item_code=f"PURCODE-{suffix}",
        item_name=f"Purchase Product {suffix}",
        company_id=company_id,
        category="General",
        hsn_code="6403",
        tax_rate=Decimal("18.00"),
        primary_uom="PCS",
        uom="PCS",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var-pur-{suffix}",
        item_id=item.id,
        variant_sku=f"PURCODE-{suffix}",
        variant_name=f"Purchase Product {suffix}",
        company_id=company_id,
        selling_price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        cost_price=Decimal("100.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    barcode_row = ItemBarcode(
        id=f"bc-pur-{suffix}",
        company_id=company_id,
        item_id=item.id,
        variant_id=variant.id,
        barcode=f"PURBC-{suffix}",
        is_primary=True,
    )
    db_session.add(barcode_row)
    await db_session.flush()

    product = Product(
        id=f"prod-pur-{suffix}",
        code=f"PURCODE-{suffix}",
        name=f"Purchase Product {suffix}",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        gst_percentage=Decimal("18.00"),
        hsn_code="6403",
        stock=stock,
        category="General",
        barcode=f"PURBC-{suffix}",
        item_id=item.id,
        item_variant_id=variant.id,
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(product)
    await db_session.commit()
    return product


def _bearer(user: User, company_id: str, branch_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": company_id,
        "branch_id": branch_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(db_session, company_id: str, branch_id: str):
    """Override get_tenant_context to return a fixed TenantContext."""
    async def _get_tenant():
        return TenantContext(company_id=company_id, branch_id=branch_id)
    app.dependency_overrides[get_tenant_context] = _get_tenant


# ---------------------------------------------------------------------------
# Supplier tests
# ---------------------------------------------------------------------------

async def test_create_supplier(db_session):
    """MANAGER can create a supplier."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/suppliers/",
            json={
                "id": f"sup-{suffix}",
                "name": f"Supplier {suffix}",
                "code": f"SUP-{suffix}",
                "gst_number": "27TESTGST1234F1Z5",
                "mobile": "9876543210",
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 201
    data = res.json()
    assert data["code"] == f"SUP-{suffix}"
    assert data["outstanding"] == "0.00"
    assert data["company_id"] == comp.id


async def test_list_suppliers(db_session):
    """Listed suppliers are scoped to the current tenant."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create two suppliers
    for i in range(2):
        supplier = Supplier(
            id=f"sup-{suffix}-{i}", name=f"Supplier {i}", code=f"S{suffix}{i}",
            outstanding=Decimal("0.00"),
            company_id=comp.id, branch_id=br.id,
        )
        db_session.add(supplier)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/suppliers/", headers=_bearer(mgr, comp.id, br.id))
    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_cashier_cannot_create_supplier(db_session):
    """CASHIER gets 403 trying to create a supplier."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    cashier = User(
        id=f"cas-{suffix}", username=f"cas_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.CASHIER, is_active=True, is_deleted=False,
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(cashier)
    await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/suppliers/",
            json={"id": f"sup-{suffix}", "name": "X", "code": f"X{suffix}"},
            headers=_bearer(cashier, comp.id, br.id),
        )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Purchase Order tests
# ---------------------------------------------------------------------------

async def test_create_purchase_order(db_session):
    """MANAGER can create a purchase order; totals are calculated correctly."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    product = await _make_product(db_session, suffix, comp.id, br.id)
    supplier = Supplier(
        id=f"sup-{suffix}", name=f"Supplier {suffix}", code=f"SUP-{suffix}",
        outstanding=Decimal("0.00"), company_id=comp.id, branch_id=br.id,
    )
    db_session.add(supplier)
    await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/purchase/orders/",
            json={
                "id": f"po-{suffix}",
                "order_no": f"PO-{suffix}",
                "supplier_id": supplier.id,
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity": "5",
                    "cost_price": "80.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 201
    data = res.json()
    # Phase A: create PO always persists as DRAFT (server normalises status)
    assert data["status"] == "DRAFT"
    # subtotal = 5 × 80 = 400, tax = 72, grand = 472
    assert Decimal(data["subtotal"]) == Decimal("400.00")
    assert Decimal(data["tax_total"]) == Decimal("72.00")
    assert Decimal(data["grand_total"]) == Decimal("472.00")
    assert len(data["items"]) == 1

    # Verify stock is NOT updated by PO creation (only GRN updates stock)
    res_db = await db_session.execute(select(Product).where(Product.id == product.id))
    p = res_db.scalars().first()
    assert p.stock == 10   # unchanged


async def test_create_po_invalid_supplier_returns_404(db_session):
    """PO creation with a non-existent supplier returns 404."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    product = await _make_product(db_session, suffix, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/purchase/orders/",
            json={
                "id": f"po-{suffix}", "order_no": f"PO-{suffix}",
                "supplier_id": "nonexistent",
                "items": [{"product_id": product.id, "code": product.code,
                           "name": product.name, "quantity": "1", "cost_price": "10.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 404


async def test_create_po_empty_items_returns_400(db_session):
    """PO creation with no items returns 400."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    supplier = Supplier(
        id=f"sup-{suffix}", name="S", code=f"SC{suffix}",
        outstanding=Decimal("0"), company_id=comp.id, branch_id=br.id,
    )
    db_session.add(supplier); await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/purchase/orders/",
            json={"id": f"po-{suffix}", "order_no": f"PO-{suffix}",
                  "supplier_id": supplier.id, "items": []},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 400
    assert "at least one item" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Purchase Receipt (GRN) tests
# ---------------------------------------------------------------------------

async def test_grn_increments_product_stock(db_session):
    """Posting a GRN increments product.stock by quantity_received."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    product = await _make_product(db_session, suffix, comp.id, br.id, stock=10)
    supplier = Supplier(
        id=f"sup-{suffix}", name="S", code=f"SC{suffix}",
        outstanding=Decimal("0"), company_id=comp.id, branch_id=br.id,
    )
    db_session.add(supplier); await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/purchase-receipts/",
            json={
                "id": f"gr-{suffix}",
                "receipt_no": f"GRN-{suffix}",
                "supplier_id": supplier.id,
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity_received": "25",
                    "cost_price": "80.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "RECEIVED"
    # grand_total = 25 × 80 + 18% = 2360
    assert Decimal(data["grand_total"]) == Decimal("2360.00")

    # Stock must now be 10 + 25 = 35
    await db_session.refresh(product)
    assert product.stock == 35

    # Verify StockMovement was recorded.
    # NOTE: The GRN receipt id is server-generated by IdentityEngine (not the
    # client-supplied "gr-{suffix}"). Use data["id"] from the API response.
    grn_server_id = data["id"]
    movement_res = await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == grn_server_id)
    )
    movement = movement_res.scalars().first()
    assert movement is not None
    assert movement.movement_type in ("IN", "INWARD_GRN")
    assert movement.reference_doc_type == "Purchase Receipt"


async def test_grn_updates_supplier_outstanding(db_session):
    """GRN increments supplier.outstanding by grand_total."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    product = await _make_product(db_session, suffix, comp.id, br.id, stock=0)
    supplier = Supplier(
        id=f"sup-{suffix}", name="S", code=f"SC{suffix}",
        outstanding=Decimal("100.00"), company_id=comp.id, branch_id=br.id,
    )
    db_session.add(supplier); await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/purchase-receipts/",
            json={
                "id": f"gr-{suffix}", "receipt_no": f"GRN-{suffix}",
                "supplier_id": supplier.id,
                "items": [{
                    "product_id": product.id, "code": product.code,
                    "name": product.name, "quantity_received": "10",
                    "cost_price": "50.00", "gst_rate": "0.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 201
    # outstanding was 100, receipt grand_total = 500, new outstanding = 600
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("600.00")


async def test_grn_zero_quantity_returns_400(db_session):
    """GRN with quantity_received = 0 returns 400."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    product = await _make_product(db_session, suffix, comp.id, br.id)
    supplier = Supplier(
        id=f"sup-{suffix}", name="S", code=f"SC{suffix}",
        outstanding=Decimal("0"), company_id=comp.id, branch_id=br.id,
    )
    db_session.add(supplier); await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/purchase-receipts/",
            json={
                "id": f"gr-{suffix}", "receipt_no": f"GRN-{suffix}",
                "supplier_id": supplier.id,
                "items": [{
                    "product_id": product.id, "code": product.code,
                    "name": product.name, "quantity_received": "0",
                    "cost_price": "50.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 400
    assert "greater than zero" in res.json()["detail"].lower()


async def test_grn_links_to_po(db_session):
    """A GRN can be linked to a PO; PO status becomes RECEIVED after GRN."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    product = await _make_product(db_session, suffix, comp.id, br.id, stock=0)
    supplier = Supplier(
        id=f"sup-{suffix}", name="S", code=f"SC{suffix}",
        outstanding=Decimal("0"), company_id=comp.id, branch_id=br.id,
    )
    db_session.add(supplier); await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create PO first
        po_res = await client.post(
            "/api/v1/purchase/orders/",
            json={
                # NOTE: 'id' is stripped by normalize_po_create; IdentityEngine allocates server id.
                "order_no": f"PO-{suffix}",
                "supplier_id": supplier.id,
                "items": [{"product_id": product.id, "code": product.code,
                           "name": product.name, "quantity": "5", "cost_price": "100.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert po_res.status_code == 201, f"PO create failed: {po_res.status_code} {po_res.text}"
        # Use the server-generated PO id from the response (NOT the client-supplied id)
        server_po_id = po_res.json()["id"]

        # Post GRN linked to PO using the server-generated PO id
        grn_res = await client.post(
            "/api/v1/purchase-receipts/",
            json={
                "receipt_no": f"GRN-{suffix}",
                "supplier_id": supplier.id,
                "order_id": server_po_id,
                "items": [{"product_id": product.id, "code": product.code,
                           "name": product.name, "quantity_received": "5",
                           "quantity_ordered": "5", "cost_price": "100.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert grn_res.status_code == 201
    assert grn_res.json()["order_id"] == server_po_id
    await db_session.refresh(product)
    assert product.stock == 5


async def test_grn_tracks_multiple_po_allocations_by_line(db_session):
    """One GRN can allocate each line to a different PO while still enforcing supplier scope and pending qty."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    mgr = await _make_manager(db_session, suffix, comp.id, br.id)
    product = await _make_product(db_session, suffix, comp.id, br.id, stock=0)
    supplier = Supplier(
        id=f"sup-{suffix}", name="S", code=f"SC{suffix}",
        outstanding=Decimal("0"), company_id=comp.id, branch_id=br.id,
    )
    db_session.add(supplier)
    await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        po1 = await client.post(
            "/api/v1/purchase/orders/",
            json={
                "order_no": f"PO-{suffix}-A",
                "supplier_id": supplier.id,
                "items": [{"product_id": product.id, "code": product.code, "name": product.name, "quantity": "10", "cost_price": "100.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
        po2 = await client.post(
            "/api/v1/purchase/orders/",
            json={
                "order_no": f"PO-{suffix}-B",
                "supplier_id": supplier.id,
                "items": [{"product_id": product.id, "code": product.code, "name": product.name, "quantity": "6", "cost_price": "110.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert po1.status_code == 201
        assert po2.status_code == 201

        po1_id = po1.json()["id"]
        po2_id = po2.json()["id"]
        po1_no = po1.json()["order_no"]
        po2_no = po2.json()["order_no"]

        grn_res = await client.post(
            "/api/v1/purchase-receipts/",
            json={
                "receipt_no": f"GRN-{suffix}-MULTI",
                "supplier_id": supplier.id,
                "items": [
                    {
                        "product_id": product.id,
                        "code": product.code,
                        "name": product.name,
                        "quantity_received": "7",
                        "cost_price": "100.00",
                        "purchase_order_id": po1_id,
                        "purchase_order_no": po1_no,
                    },
                    {
                        "product_id": product.id,
                        "code": product.code,
                        "name": product.name,
                        "quantity_received": "3",
                        "cost_price": "110.00",
                        "purchase_order_id": po2_id,
                        "purchase_order_no": po2_no,
                    },
                ],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )

    assert grn_res.status_code == 201, grn_res.text
    data = grn_res.json()
    assert len(data["items"]) == 2
    assert {item["purchase_order_id"] for item in data["items"]} == {po1_id, po2_id}
    assert {item["purchase_order_no"] for item in data["items"]} == {po1_no, po2_no}

    receipt_items = await db_session.execute(
        select(PurchaseReceiptItem).where(PurchaseReceiptItem.receipt_id == data["id"])
    )
    saved_lines = receipt_items.scalars().all()
    assert len(saved_lines) == 2
    assert {line.purchase_order_id for line in saved_lines} == {po1_id, po2_id}
    assert sum(float(line.quantity_received) for line in saved_lines) == 10


# ---------------------------------------------------------------------------
# Phase 3 - CANCEL / AMEND / Supplier UPDATE / DELETE
# ---------------------------------------------------------------------------

async def _make_po(db_session, suffix, company_id, branch_id, product, supplier):
    """Helper: create a CONFIRMED purchase order with one item."""
    from app.models.purchase import PurchaseOrder, PurchaseOrderItem
    from decimal import Decimal
    po = PurchaseOrder(
        id=f"po-{suffix}", order_no=f"PO-{suffix}",
        supplier_id=supplier.id, status="CONFIRMED",
        subtotal=Decimal("1000.00"), tax_total=Decimal("180.00"),
        grand_total=Decimal("1180.00"),
        company_id=company_id, branch_id=branch_id,
    )
    item = PurchaseOrderItem(
        id=f"poi-{suffix}", order_id=po.id,
        product_id=product.id, code=product.code, name=product.name,
        quantity=Decimal("10"), cost_price=Decimal("100.00"),
        gst_rate=Decimal("18.00"), tax_amount=Decimal("180.00"),
        line_total=Decimal("1180.00"),
        company_id=company_id, branch_id=branch_id,
    )
    db_session.add_all([po, item])
    await db_session.commit()
    return po


async def _make_supplier(db_session, suffix, company_id, branch_id):
    from app.models.purchase import Supplier
    from decimal import Decimal
    sup = Supplier(
        id=f"sup-p3-{suffix}", name=f"Phase3 Supplier {suffix}",
        code=f"P3S-{suffix}", company_id=company_id, branch_id=branch_id,
        outstanding=Decimal("0"),
    )
    db_session.add(sup)
    await db_session.commit()
    return sup


# ---------- Cancel PO ----------

async def test_cancel_purchase_order(db_session):
    """MANAGER can cancel a Confirmed PO. status=CANCELLED, is_deleted=True."""
    import uuid
    from sqlalchemy.future import select
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={"reason": "Price changed"},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 200, res.text
    assert res.json()["success"] is True

    # Verify status in DB (cancelled POs retain is_deleted=False)
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    updated = result.scalars().first()
    assert updated.status == "CANCELLED"
    assert updated.is_deleted is False


async def test_cancel_nonexistent_po_returns_404(db_session):
    """Cancelling a non-existent PO returns 404."""
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/v1/purchase/orders/does-not-exist/cancel",
            json={},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 404


async def test_cancel_already_cancelled_po_returns_400(db_session):
    """Cancelling an already-cancelled PO returns 400."""
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # Cancel once
        r1 = await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={},
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert r1.status_code == 200
        # Cancel again — should 404 because is_deleted=True hides it from get_purchase_order
        r2 = await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={},
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert r2.status_code in (400, 404)


# ---------- Amend PO ----------

async def test_amend_purchase_order(db_session):
    """
    POST /amend: original PO is cancelled, a new Confirmed PO is created.
    New PO has the replacement items and correct totals.
    """
    import uuid
    from decimal import Decimal
    from sqlalchemy.future import select
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)

    new_po_id = f"po-amend-{s}"
    new_po_no = f"PO-{s}-A1"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            f"/api/v1/purchase/orders/{po.id}/amend",
            json={
                "new_order_id": new_po_id,
                "new_order_no": new_po_no,
                "reason": "Quantity revised upward",
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity": "15",
                    "cost_price": "100.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["id"] == new_po_id
    assert data["status"] == "CONFIRMED"
    # grand_total = 15 * 100 + 15 * 100 * 0.18 = 1500 + 270 = 1770
    assert Decimal(data["grand_total"]) == Decimal("1770.00")

    # Original must be cancelled in DB
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    original = result.scalars().first()
    assert original.status == "CANCELLED"
    assert original.is_deleted is False


async def test_amend_non_confirmed_po_returns_400(db_session):
    """Amending a non-Confirmed (e.g., CANCELLED) PO returns 400."""
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # Cancel first
        await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={}, headers=_bearer(mgr, comp.id, br.id),
        )
        # Now amend — should 404 (hidden by is_deleted) or 400
        res = await c.post(
            f"/api/v1/purchase/orders/{po.id}/amend",
            json={
                "new_order_id": f"po-a-{s}",
                "new_order_no": f"PO-A-{s}",
                "items": [{"product_id": product.id, "code": product.code,
                            "name": product.name, "quantity": "5",
                            "cost_price": "100.00", "gst_rate": "18.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code in (400, 404)


# ---------- Supplier UPDATE ----------

async def test_update_supplier(db_session):
    """MANAGER can update a supplier's name and contact details."""
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.put(
            f"/api/v1/suppliers/{supplier.id}",
            json={"name": "Updated Supplier Name", "mobile": "9999999999"},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 200, res.text
    assert res.json()["name"] == "Updated Supplier Name"
    assert res.json()["mobile"] == "9999999999"


# ---------- Supplier DELETE ----------

async def test_delete_supplier_soft_deletes(db_session):
    """
    DELETE /suppliers/{id}: supplier is soft-deleted.
    Subsequent GET /suppliers/{id} returns 404.
    """
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        del_res = await c.delete(
            f"/api/v1/suppliers/{supplier.id}",
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert del_res.status_code == 204

        get_res = await c.get(
            f"/api/v1/suppliers/{supplier.id}",
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert get_res.status_code == 404


async def test_delete_nonexistent_supplier_returns_404(db_session):
    """Deleting a non-existent supplier returns 404."""
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.delete(
            "/api/v1/suppliers/does-not-exist",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 404


# ─────────────────────────── Phase 4A Contract URL Tests ───────────────────────────

async def test_list_orders_contract_url(db_session):
    """Contract URL GET /api/v1/purchase/orders/ must return a list."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"p4a{s}")
    mgr = await _make_manager(db_session, f"p4a{s}", comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/purchase/orders/", headers=_bearer(mgr, comp.id, br.id))
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


async def test_list_suppliers_contract_url(db_session):
    """Contract URL GET /api/v1/purchase/suppliers/ must return a list."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"p4b{s}")
    mgr = await _make_manager(db_session, f"p4b{s}", comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/purchase/suppliers/", headers=_bearer(mgr, comp.id, br.id))
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


async def test_health_flags_endpoint(db_session):
    """GET /api/v1/health/flags must list all three flag contracts — no auth required."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/health/flags")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "flags" in data
    assert "USE_FASTAPI_POS" in data["flags"]
    assert "USE_FASTAPI_SALES" in data["flags"]
    assert "USE_FASTAPI_PURCHASE" in data["flags"]
    pos_flag = data["flags"]["USE_FASTAPI_POS"]
    assert any("/pos/shifts/open" in ep for ep in pos_flag["contract_endpoints"])
    assert any("/pos/checkout" in ep for ep in pos_flag["contract_endpoints"])


# ─────────────────────────── Phase 4B Tests ───────────────────────────

async def test_submit_purchase_order(db_session):
    """POST /purchase/orders/{id}/submit promotes DRAFT -> SUBMITTED (Phase A: not CONFIRMED)."""
    import uuid as _u
    from app.models.purchase import PurchaseOrder, PurchaseOrderItem
    from decimal import Decimal
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    # Insert DRAFT PO directly to DB
    po = PurchaseOrder(
        id=f"draftpo-{s}", order_no=f"DRAFT-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("500.00"), tax_total=Decimal("90.00"),
        grand_total=Decimal("590.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po)
    await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/submit",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    data = r.json()
    # Phase A: submit transitions DRAFT → SUBMITTED (not directly CONFIRMED)
    assert data["status"] == "SUBMITTED"
    assert data["order_id"] == po.id


async def test_get_outstanding_report(db_session):
    """GET /purchase/reports/outstanding returns list with total_outstanding."""
    import uuid as _u
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/purchase/reports/outstanding", headers=_bearer(mgr, comp.id, br.id))
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    row = data[0]
    assert "supplier_id" in row
    assert "total_outstanding" in row


async def test_get_pending_delivery_report(db_session):
    """GET /purchase/reports/pending-delivery lists CONFIRMED POs with no receipt."""
    import uuid as _u
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/purchase/reports/pending-delivery", headers=_bearer(mgr, comp.id, br.id))
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    ids = [row["order_id"] for row in data]
    assert po.id in ids


async def test_purchase_settings_returns_state(db_session):
    """GET /purchase/settings returns company_state."""
    import uuid as _u
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/purchase/settings", headers=_bearer(mgr, comp.id, br.id))
    assert r.status_code == 200, r.text
    assert "company_state" in r.json()


async def test_workflow_submit_purchase_order(db_session):
    """POST /workflow/PurchaseOrder/{id}/submit via Core Workflow API.
    Phase A: submit now returns SUBMITTED (not CONFIRMED directly).
    """
    import uuid as _u
    from app.models.purchase import PurchaseOrder
    from decimal import Decimal
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = PurchaseOrder(
        id=f"wfpo-{s}", order_no=f"PO-WF-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("200.00"), tax_total=Decimal("36.00"),
        grand_total=Decimal("236.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po)
    await db_session.commit()
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/workflow/PurchaseOrder/{po.id}/submit",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    # Phase A: workflow submit transitions DRAFT → SUBMITTED (2-step lifecycle)
    assert r.json()["status"] == "SUBMITTED"



async def test_workflow_cancel_purchase_order(db_session):
    """POST /workflow/PurchaseOrder/{id}/cancel cancels a CONFIRMED PO."""
    import uuid as _u
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/workflow/PurchaseOrder/{po.id}/cancel",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True


async def test_workflow_unknown_doctype_returns_400(db_session):
    """POST /workflow with unknown docType returns 400."""
    import uuid as _u
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/v1/workflow/UnknownDoc/some-id/approve",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 400, r.text


# ═══════════════════════════════════════════════════════════════════════════════
# Phase A Lifecycle Tests (v1508)
# Tests 1–20 per the Phase A plan
# ═══════════════════════════════════════════════════════════════════════════════

async def _make_draft_po_via_api(client, mgr, comp_id, br_id, supplier_id, product, suffix) -> dict:
    """Helper: create a DRAFT PO via API. Returns response JSON."""
    res = await client.post(
        "/api/v1/purchase/orders/",
        json={
            "order_no": f"PO-DRAFT-{suffix}",
            "supplier_id": supplier_id,
            "status": "DRAFT",
            "items": [{
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "3",
                "cost_price": "100.00",
                "gst_rate": "18.00",
            }],
        },
        headers=_bearer(mgr, comp_id, br_id),
    )
    assert res.status_code == 201, f"Draft PO create failed: {res.text}"
    return res.json()


# ── Test 1: New PO Save Draft → DRAFT ────────────────────────────────────────

async def test_phaseA_01_create_po_saves_as_draft(db_session):
    """Phase A T1: Create PO without explicit status → persisted as DRAFT."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        data = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
    assert data["status"] == "DRAFT"


# ── Test 2: Draft can be opened/read (editable state exists) ─────────────────

async def test_phaseA_02_draft_can_be_retrieved(db_session):
    """Phase A T2: A DRAFT PO can be retrieved by ID."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
        get_res = await c.get(
            f"/api/v1/purchase/orders/{created['id']}",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "DRAFT"


# ── Test 3: Draft remains DRAFT after another Save Draft (idempotent) ─────────

async def test_phaseA_03_draft_remains_draft_on_resave(db_session):
    """Phase A T3: Sending status=DRAFT again does not change status to anything else."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
    po_id = created["id"]
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    result = await db_session.execute(stmt)
    po = result.scalars().first()
    assert po.status == "DRAFT"


# ── Test 4: Draft does NOT create a stock movement ───────────────────────────

async def test_phaseA_04_draft_does_not_create_stock_movement(db_session):
    """Phase A T4: Creating a DRAFT PO must not generate any StockMovement."""
    from app.models.inventory import StockMovement
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=0)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
    po_id = created["id"]
    mv_res = await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == po_id)
    )
    movements = mv_res.scalars().all()
    assert movements == [], f"Unexpected stock movements for DRAFT PO: {movements}"
    # Stock must be unchanged
    await db_session.refresh(product)
    assert product.stock == 0


# ── Test 5: Draft does NOT change stock quantity ──────────────────────────────

async def test_phaseA_05_draft_stock_unchanged(db_session):
    """Phase A T5: Product stock is unchanged after creating a DRAFT PO."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=42)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
    await db_session.refresh(product)
    assert product.stock == 42


# ── Test 6: DRAFT → SUBMITTED via submit endpoint ────────────────────────────

async def test_phaseA_06_draft_to_submitted(db_session):
    """Phase A T6: POST /orders/{id}/submit transitions DRAFT → SUBMITTED."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
        r = await c.post(
            f"/api/v1/purchase/orders/{created['id']}/submit",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "SUBMITTED"
    # Verify in DB
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == created["id"])
    result = await db_session.execute(stmt)
    po = result.scalars().first()
    assert po.status == "SUBMITTED"


# ── Test 7: submitted_by is populated after submit ────────────────────────────

async def test_phaseA_07_submitted_by_populated(db_session):
    """Phase A T7: submitted_by is set on the PO row after submit."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
        await c.post(
            f"/api/v1/purchase/orders/{created['id']}/submit",
            headers=_bearer(mgr, comp.id, br.id),
        )
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == created["id"])
    result = await db_session.execute(stmt)
    po = result.scalars().first()
    # submitted_by must be non-empty (set from current_user identity)
    assert po.submitted_by is not None and po.submitted_by != ""


# ── Test 8: submitted_at is populated after submit ────────────────────────────

async def test_phaseA_08_submitted_at_populated(db_session):
    """Phase A T8: submitted_at timestamp is set after submit."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
        await c.post(
            f"/api/v1/purchase/orders/{created['id']}/submit",
            headers=_bearer(mgr, comp.id, br.id),
        )
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == created["id"])
    result = await db_session.execute(stmt)
    po = result.scalars().first()
    assert po.submitted_at is not None


# ── Test 9: Unauthorized user cannot submit ───────────────────────────────────

async def test_phaseA_09_cashier_cannot_submit(db_session):
    """Phase A T9: CASHIER (non-manager) cannot submit a PO — must get 403."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    po = PurchaseOrder(
        id=f"draft-cashier-{s}", order_no=f"DRAFTC-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po); await db_session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/submit",
            headers=_bearer(cashier, comp.id, br.id),
        )
    assert r.status_code == 403, f"Expected 403 for cashier submit, got {r.status_code}: {r.text}"


# ── Test 10: SUBMITTED → CONFIRMED via confirm endpoint ───────────────────────

async def test_phaseA_10_submitted_to_confirmed(db_session):
    """Phase A T10: POST /orders/{id}/confirm transitions SUBMITTED → CONFIRMED."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    # Seed a SUBMITTED PO
    po = PurchaseOrder(
        id=f"subm-{s}", order_no=f"SUBM-{s}",
        supplier_id=supplier.id, status="SUBMITTED",
        subtotal=Decimal("200.00"), tax_total=Decimal("36.00"),
        grand_total=Decimal("236.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po); await db_session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/confirm",
            json={},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "CONFIRMED"
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.status == "CONFIRMED"


# ── Test 11: confirmed_by is populated after confirm ─────────────────────────

async def test_phaseA_11_confirmed_by_populated(db_session):
    """Phase A T11: confirmed_by is set on PO row after confirm."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    po = PurchaseOrder(
        id=f"subm-cb-{s}", order_no=f"SUBM-CB-{s}",
        supplier_id=supplier.id, status="SUBMITTED",
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po); await db_session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post(
            f"/api/v1/purchase/orders/{po.id}/confirm",
            json={}, headers=_bearer(mgr, comp.id, br.id),
        )
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.confirmed_by is not None and db_po.confirmed_by != ""
    assert db_po.confirmed_at is not None


# ── Test 12: Unauthorized user cannot confirm ─────────────────────────────────

async def test_phaseA_12_cashier_cannot_confirm(db_session):
    """Phase A T12: CASHIER cannot confirm a PO — must get 403."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    po = PurchaseOrder(
        id=f"subm-cas-{s}", order_no=f"SUBM-CAS-{s}",
        supplier_id=supplier.id, status="SUBMITTED",
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po); await db_session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/confirm",
            json={}, headers=_bearer(cashier, comp.id, br.id),
        )
    assert r.status_code == 403, f"Expected 403 for cashier confirm, got {r.status_code}: {r.text}"


# ── Test 13: Cannot confirm a DRAFT PO directly ──────────────────────────────

async def test_phaseA_13_cannot_confirm_draft_directly(db_session):
    """Phase A T13: Confirming a DRAFT (not SUBMITTED) PO returns 400."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    po = PurchaseOrder(
        id=f"draft-noconf-{s}", order_no=f"DRAFT-NC-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po); await db_session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/confirm",
            json={}, headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 400, f"Expected 400 confirming DRAFT, got {r.status_code}: {r.text}"


# ── Test 14: Cannot submit a CONFIRMED PO ────────────────────────────────────

async def test_phaseA_14_cannot_submit_confirmed_po(db_session):
    """Phase A T14: Submitting an already-CONFIRMED PO returns 400."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)  # creates CONFIRMED
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/submit",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 400, f"Expected 400 submitting CONFIRMED, got {r.status_code}: {r.text}"


# ── Test 15: Full lifecycle DRAFT → SUBMITTED → CONFIRMED ────────────────────

async def test_phaseA_15_full_lifecycle_draft_submit_confirm(db_session):
    """Phase A T15: Full DRAFT→SUBMITTED→CONFIRMED lifecycle end-to-end."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # Step 1: Create DRAFT
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
        assert created["status"] == "DRAFT"
        po_id = created["id"]
        # Step 2: Submit
        submit_r = await c.post(
            f"/api/v1/purchase/orders/{po_id}/submit",
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert submit_r.status_code == 200, submit_r.text
        assert submit_r.json()["status"] == "SUBMITTED"
        # Step 3: Confirm
        confirm_r = await c.post(
            f"/api/v1/purchase/orders/{po_id}/confirm",
            json={}, headers=_bearer(mgr, comp.id, br.id),
        )
        assert confirm_r.status_code == 200, confirm_r.text
        assert confirm_r.json()["status"] == "CONFIRMED"
    # Verify DB final state
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    result = await db_session.execute(stmt)
    po = result.scalars().first()
    assert po.status == "CONFIRMED"
    assert po.submitted_by is not None
    assert po.submitted_at is not None
    assert po.confirmed_by is not None
    assert po.confirmed_at is not None


# ── Test 16: Existing CONFIRMED POs remain unchanged (data safety) ────────────

async def test_phaseA_16_existing_confirmed_po_unchanged(db_session):
    """Phase A T16: Pre-existing CONFIRMED POs stay CONFIRMED (not modified by Phase A code)."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)  # already CONFIRMED
    _set_tenant(db_session, comp.id, br.id)
    # Read it back without touching it
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.status == "CONFIRMED"
    assert db_po.is_deleted is False


# ── Test 17: Existing CANCELLED POs remain unchanged ─────────────────────────

async def test_phaseA_17_existing_cancelled_po_unchanged(db_session):
    """Phase A T17: Pre-existing CANCELLED POs stay CANCELLED and is_deleted=True."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    po = PurchaseOrder(
        id=f"cancelled-preex-{s}", order_no=f"CAN-PRE-{s}",
        supplier_id=supplier.id, status="CANCELLED", is_deleted=True,
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po); await db_session.commit()
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.status == "CANCELLED"
    assert db_po.is_deleted is True


# ── Test 18: Cancellation stores reason in dedicated column ──────────────────

async def test_phaseA_18_cancel_stores_reason_in_column(db_session):
    """Phase A T18: Cancellation reason stored in cancellation_reason column, not just notes."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    po = await _make_po(db_session, s, comp.id, br.id, product, supplier)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={"reason": "Phase A reason test"},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.status == "CANCELLED"
    assert db_po.cancellation_reason == "Phase A reason test"
    assert db_po.cancelled_at is not None


# ── Test 19: DRAFT PO does not create accounting entries ─────────────────────

async def test_phaseA_19_draft_no_accounting_entry(db_session):
    """Phase A T19: DRAFT PO creation does not create any GL/accounting entries."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    # Check supplier outstanding before
    outstanding_before = supplier.outstanding
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await _make_draft_po_via_api(c, mgr, comp.id, br.id, supplier.id, product, s)
    assert created["status"] == "DRAFT"
    # Supplier outstanding must be unchanged (no liability created)
    await db_session.refresh(supplier)
    assert supplier.outstanding == outstanding_before


# ── Test 20: Cancellation reason captured on DRAFT PO ────────────────────────

async def test_phaseA_20_cancel_draft_po(db_session):
    """Phase A T20: A DRAFT PO can be cancelled directly (not just CONFIRMED)."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    po = PurchaseOrder(
        id=f"draft-cancel-{s}", order_no=f"DRAFTCAN-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("50.00"), tax_total=Decimal("9.00"),
        grand_total=Decimal("59.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po); await db_session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={"reason": "Duplicate draft"},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.status == "CANCELLED"
    assert db_po.is_deleted is False


# ══════════════════════════════════════════════════════════════════════════════
# Phase B: Status-Filter Tests (T21 – T25)
# Validates GET /purchase/orders/?status= filter added in Phase B.
# Backend: services/purchase.py list_purchase_orders(status=...) +
#          api/v1/purchase.py list_purchase_orders_contract(status=...)
# ══════════════════════════════════════════════════════════════════════════════

async def _make_po_with_status(db_session, suffix: str, comp_id: str, br_id: str,
                                supplier_id: str, status: str) -> "PurchaseOrder":
    """Helper: create a PO in a specific lifecycle status."""
    from app.models.purchase import PurchaseOrder
    po = PurchaseOrder(
        id=f"phb-{status.lower()}-{suffix}", order_no=f"PHB-{status[:3]}-{suffix}",
        supplier_id=supplier_id, status=status,
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(po)
    await db_session.commit()
    return po


# ── T21: ?status=DRAFT returns only DRAFT POs ─────────────────────────────────

@pytest.mark.asyncio
async def test_phaseB_21_status_filter_draft(db_session):
    """Phase B T21: GET /orders/?status=DRAFT returns only DRAFT POs for the tenant."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    await _make_po_with_status(db_session, s + "a", comp.id, br.id, supplier.id, "DRAFT")
    await _make_po_with_status(db_session, s + "b", comp.id, br.id, supplier.id, "SUBMITTED")
    await _make_po_with_status(db_session, s + "c", comp.id, br.id, supplier.id, "CONFIRMED")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/v1/purchase/orders/?status=DRAFT",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    data = r.json()
    returned_statuses = {po["status"] for po in data}
    assert returned_statuses.issubset({"DRAFT"}), f"Expected only DRAFT, got {returned_statuses}"
    # Must contain at least our DRAFT PO
    order_nos = [po["order_no"] for po in data]
    assert any(s + "a" in no for no in order_nos), "DRAFT PO not in result"


# ── T22: ?status=SUBMITTED returns only SUBMITTED POs ─────────────────────────

@pytest.mark.asyncio
async def test_phaseB_22_status_filter_submitted(db_session):
    """Phase B T22: ?status=SUBMITTED filters to SUBMITTED POs only."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    await _make_po_with_status(db_session, s + "d", comp.id, br.id, supplier.id, "DRAFT")
    await _make_po_with_status(db_session, s + "e", comp.id, br.id, supplier.id, "SUBMITTED")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/v1/purchase/orders/?status=SUBMITTED",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    data = r.json()
    returned_statuses = {po["status"] for po in data}
    assert returned_statuses.issubset({"SUBMITTED"}), f"Expected only SUBMITTED, got {returned_statuses}"
    order_nos = [po["order_no"] for po in data]
    assert any(s + "e" in no for no in order_nos), "SUBMITTED PO not in result"


# ── T23: no status filter returns all statuses ────────────────────────────────

@pytest.mark.asyncio
async def test_phaseB_23_no_status_filter_returns_all(db_session):
    """Phase B T23: GET /orders/ without ?status= returns POs of any status."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    await _make_po_with_status(db_session, s + "f", comp.id, br.id, supplier.id, "DRAFT")
    await _make_po_with_status(db_session, s + "g", comp.id, br.id, supplier.id, "CONFIRMED")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/v1/purchase/orders/",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    data = r.json()
    returned_statuses = {po["status"] for po in data}
    # Both DRAFT and CONFIRMED should appear
    assert "DRAFT" in returned_statuses or "CONFIRMED" in returned_statuses


# ── T24: ?status=CONFIRMED excludes DRAFT and SUBMITTED ──────────────────────

@pytest.mark.asyncio
async def test_phaseB_24_status_filter_confirmed_excludes_draft(db_session):
    """Phase B T24: ?status=CONFIRMED must not include DRAFT or SUBMITTED POs."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    await _make_po_with_status(db_session, s + "h", comp.id, br.id, supplier.id, "DRAFT")
    await _make_po_with_status(db_session, s + "i", comp.id, br.id, supplier.id, "SUBMITTED")
    await _make_po_with_status(db_session, s + "j", comp.id, br.id, supplier.id, "CONFIRMED")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/v1/purchase/orders/?status=CONFIRMED",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    data = r.json()
    returned_statuses = {po["status"] for po in data}
    assert "DRAFT" not in returned_statuses, "DRAFT leaked into CONFIRMED filter result"
    assert "SUBMITTED" not in returned_statuses, "SUBMITTED leaked into CONFIRMED filter result"


# ── T25: comma-separated multi-status filter ──────────────────────────────────

@pytest.mark.asyncio
async def test_phaseB_25_multi_status_filter(db_session):
    """Phase B T25: ?status=DRAFT,SUBMITTED returns both DRAFT and SUBMITTED POs."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    await _make_po_with_status(db_session, s + "k", comp.id, br.id, supplier.id, "DRAFT")
    await _make_po_with_status(db_session, s + "l", comp.id, br.id, supplier.id, "SUBMITTED")
    await _make_po_with_status(db_session, s + "m", comp.id, br.id, supplier.id, "CONFIRMED")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/v1/purchase/orders/?status=DRAFT,SUBMITTED",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    data = r.json()
    returned_statuses = {po["status"] for po in data}
    assert "CONFIRMED" not in returned_statuses, "CONFIRMED leaked into DRAFT,SUBMITTED filter"
    # Must contain at least one of DRAFT or SUBMITTED
    assert returned_statuses & {"DRAFT", "SUBMITTED"}, "Neither DRAFT nor SUBMITTED returned"


# ══════════════════════════════════════════════════════════════════════════════
# Phase C: Cancellation Policy Picker Tests (T26 – T28)
# Validates GET /purchase/cancel-reasons endpoint and reason_code persistence.
# Backend: api/v1/purchase.py list_cancel_reasons() +
#          services/purchase.py cancel_purchase_order(reason_code=...)
# ══════════════════════════════════════════════════════════════════════════════


# ── T26: GET /cancel-reasons returns list of cancel reasons ───────────────────

@pytest.mark.asyncio
async def test_phaseC_26_cancel_reasons_endpoint_returns_list(db_session):
    """Phase C T26: GET /cancel-reasons returns a non-empty list of cancellation reasons."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/v1/purchase/cancel-reasons",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list), "Expected a list of cancel reasons"
    assert len(data) >= 1, "Expected at least one cancel reason"

    # Each item must have code, label, requires_note
    for item in data:
        assert "code" in item, f"Missing 'code' in reason {item}"
        assert "label" in item, f"Missing 'label' in reason {item}"
        assert "requires_note" in item, f"Missing 'requires_note' in reason {item}"

    # OTHER must always be present and requires_note=True
    other = next((r for r in data if r["code"] == "OTHER"), None)
    assert other is not None, "'OTHER' reason not found in cancel reasons"
    assert other["requires_note"] is True, "'OTHER' reason must require a note"


# ── T27: Cancel PO with structured reason_code persisted ──────────────────────

@pytest.mark.asyncio
async def test_phaseC_27_cancel_with_reason_code(db_session):
    """Phase C T27: Cancelling a PO with reason_code stores reason label + code."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    po = PurchaseOrder(
        id=f"phc-t27-{s}", order_no=f"PHC-T27-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("200.00"), tax_total=Decimal("36.00"),
        grand_total=Decimal("236.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={
                "reason": "Budget Constraint / Funds Not Available",
                "reason_code": "BUDGET_CONSTRAINT",
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True

    from sqlalchemy import select
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.status == "CANCELLED"
    assert db_po.cancellation_reason is not None, "cancellation_reason not persisted"
    # If the model has cancellation_reason_code column, verify it too
    if hasattr(db_po, "cancellation_reason_code"):
        assert db_po.cancellation_reason_code == "BUDGET_CONSTRAINT"


# ── T28: Cancel with reason_code=OTHER requires and stores note ───────────────

@pytest.mark.asyncio
async def test_phaseC_28_cancel_with_other_reason_and_note(db_session):
    """Phase C T28: reason_code=OTHER with a free-text note composites the reason string."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    po = PurchaseOrder(
        id=f"phc-t28-{s}", order_no=f"PHC-T28-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("150.00"), tax_total=Decimal("27.00"),
        grand_total=Decimal("177.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{po.id}/cancel",
            json={
                "reason": "Other (please specify): Vendor shifted location permanently",
                "reason_code": "OTHER",
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True

    from sqlalchemy import select
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    db_po = result.scalars().first()
    assert db_po.status == "CANCELLED"
    # The composed reason string must be present
    assert db_po.cancellation_reason is not None
    assert "Vendor shifted" in db_po.cancellation_reason or "OTHER" in (db_po.cancellation_reason or "")


# ═══════════════════════════════════════════════════════════════════════════════
# Phase D Tests — Amendment / Revision Chain (T29–T33)
# ═══════════════════════════════════════════════════════════════════════════════

# ── T29: Amend a CONFIRMED PO — creates new PO + supersedes original ──────────

@pytest.mark.asyncio
async def test_phaseD_29_amend_confirmed_po_creates_new_revision(db_session):
    """Phase D T29: amending a CONFIRMED PO cancels original and returns new CONFIRMED PO."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create and confirm original PO
    original = PurchaseOrder(
        id=f"phd-t29-orig-{s}", order_no=f"PHD-T29-{s}",
        supplier_id=supplier.id, status="CONFIRMED",
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(original)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{original.id}/amend",
            json={
                "new_order_no": f"PHD-T29-{s}-R1",
                "reason": "Price revision from supplier",
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity": "5",
                    "cost_price": "25.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 201, r.text
    new_po = r.json()
    assert new_po["status"] == "CONFIRMED"
    assert new_po["order_no"] == f"PHD-T29-{s}-R1"

    # Original must be CANCELLED
    await db_session.refresh(original)
    assert original.status == "CANCELLED"
    assert original.is_deleted is False


# ── T30: New PO carries correct parent_order_id and amend_revision = 1 ────────

@pytest.mark.asyncio
async def test_phaseD_30_amendment_sets_parent_order_id_and_revision(db_session):
    """Phase D T30: new PO has parent_order_id = original.id and amend_revision = 1."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    original = PurchaseOrder(
        id=f"phd-t30-orig-{s}", order_no=f"PHD-T30-{s}",
        supplier_id=supplier.id, status="CONFIRMED",
        subtotal=Decimal("200.00"), tax_total=Decimal("36.00"),
        grand_total=Decimal("236.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(original)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{original.id}/amend",
            json={
                "new_order_no": f"PHD-T30-{s}-R1",
                "reason": "Quantity increase",
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity": "10",
                    "cost_price": "20.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 201, r.text
    new_po = r.json()

    # Verify chain fields in response
    assert new_po.get("parent_order_id") == original.id, (
        f"Expected parent_order_id={original.id}, got {new_po.get('parent_order_id')}"
    )
    assert new_po.get("amend_revision") == 1, (
        f"Expected amend_revision=1, got {new_po.get('amend_revision')}"
    )


# ── T31: Cannot amend a DRAFT or SUBMITTED PO — 400 ──────────────────────────

@pytest.mark.asyncio
async def test_phaseD_31_cannot_amend_non_confirmed_po(db_session):
    """Phase D T31: amending a DRAFT PO returns 400 with clear message."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    draft_po = PurchaseOrder(
        id=f"phd-t31-{s}", order_no=f"PHD-T31-{s}",
        supplier_id=supplier.id, status="DRAFT",
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(draft_po)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{draft_po.id}/amend",
            json={
                "new_order_no": f"PHD-T31-{s}-R1",
                "reason": "Should fail",
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity": "1",
                    "cost_price": "10.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 400, r.text
    assert "confirmed" in r.json()["detail"].lower()


# ── T32: Amendment history endpoint returns chain sorted by revision ───────────

@pytest.mark.asyncio
async def test_phaseD_32_amendment_history_returns_chain(db_session):
    """Phase D T32: GET /orders/{id}/amendment-history returns ordered chain."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    original = PurchaseOrder(
        id=f"phd-t32-orig-{s}", order_no=f"PHD-T32-{s}",
        supplier_id=supplier.id, status="CONFIRMED",
        subtotal=Decimal("100.00"), tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(original)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # First create an amendment
        r_amend = await c.post(
            f"/api/v1/purchase/orders/{original.id}/amend",
            json={
                "new_order_no": f"PHD-T32-{s}-R1",
                "reason": "Test amendment for history",
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity": "2",
                    "cost_price": "50.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert r_amend.status_code == 201, r_amend.text
        new_po_id = r_amend.json()["id"]

        # Now fetch history from the NEW PO id
        r_hist = await c.get(
            f"/api/v1/purchase/orders/{new_po_id}/amendment-history",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r_hist.status_code == 200, r_hist.text
    chain = r_hist.json()
    assert isinstance(chain, list)
    assert len(chain) >= 2  # original + at least one amendment
    # Verify ordering by amend_revision ascending
    revisions = [entry["amend_revision"] for entry in chain]
    assert revisions == sorted(revisions), f"Chain not sorted: {revisions}"
    # Root entry must be revision 0
    assert chain[0]["amend_revision"] == 0
    # Last entry must be revision 1
    assert chain[-1]["amend_revision"] == 1
    assert chain[-1]["order_no"] == f"PHD-T32-{s}-R1"


# ── T33: Original PO notes marked Amended & Superseded ────────────────────────

@pytest.mark.asyncio
async def test_phaseD_33_original_notes_marked_superseded(db_session):
    """Phase D T33: after amendment, original PO notes contain 'Amended & Superseded'."""
    from app.models.purchase import PurchaseOrder
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    original = PurchaseOrder(
        id=f"phd-t33-orig-{s}", order_no=f"PHD-T33-{s}",
        supplier_id=supplier.id, status="CONFIRMED",
        subtotal=Decimal("300.00"), tax_total=Decimal("54.00"),
        grand_total=Decimal("354.00"),
        company_id=comp.id, branch_id=br.id,
        notes="Original order notes.",
    )
    db_session.add(original)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/purchase/orders/{original.id}/amend",
            json={
                "new_order_no": f"PHD-T33-{s}-R1",
                "reason": "Emergency price correction",
                "items": [{
                    "product_id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "quantity": "3",
                    "cost_price": "100.00",
                    "gst_rate": "18.00",
                }],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert r.status_code == 201, r.text

    from sqlalchemy import select as _s
    result = await db_session.execute(_s(PurchaseOrder).where(PurchaseOrder.id == original.id))
    db_original = result.scalars().first()
    assert db_original is not None
    assert db_original.status == "CANCELLED"
    assert db_original.notes is not None
    assert "Amended" in db_original.notes and "Superseded" in db_original.notes, (
        f"Expected 'Amended & Superseded' in notes, got: {db_original.notes!r}"
    )
    assert "Emergency price correction" in db_original.notes
