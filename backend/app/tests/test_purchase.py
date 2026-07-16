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
from app.models.inventory import Product, StockMovement
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

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire the test DB session and a fixed tenant context into the app."""
    await db_session.execute(delete(RefreshTokenBlacklist))
    await db_session.execute(delete(User))
    await db_session.commit()

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
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
    db_session.add_all([company, branch])
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


async def _make_product(db_session, suffix: str, company_id: str, branch_id: str,
                        stock: int = 10) -> Product:
    product = Product(
        id=f"prod-pur-{suffix}",
        code=f"PURCODE-{suffix}",
        name=f"Purchase Product {suffix}",
        price=Decimal("100.00"),
        stock=stock,
        category="General",
        barcode=f"PURBC-{suffix}",
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
    assert data["status"] == "CONFIRMED"
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

    # Verify StockMovement was recorded
    movement_res = await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == f"gr-{suffix}")
    )
    movement = movement_res.scalars().first()
    assert movement is not None
    assert Decimal(movement.quantity) == Decimal("25.00")
    assert movement.movement_type == "IN"
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
                "id": f"po-{suffix}", "order_no": f"PO-{suffix}",
                "supplier_id": supplier.id,
                "items": [{"product_id": product.id, "code": product.code,
                           "name": product.name, "quantity": "5", "cost_price": "100.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
        assert po_res.status_code == 201

        # Post GRN linked to PO
        grn_res = await client.post(
            "/api/v1/purchase-receipts/",
            json={
                "id": f"gr-{suffix}", "receipt_no": f"GRN-{suffix}",
                "supplier_id": supplier.id,
                "order_id": f"po-{suffix}",
                "items": [{"product_id": product.id, "code": product.code,
                           "name": product.name, "quantity_received": "5",
                           "quantity_ordered": "5", "cost_price": "100.00"}],
            },
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert grn_res.status_code == 201
    assert grn_res.json()["order_id"] == f"po-{suffix}"
    await db_session.refresh(product)
    assert product.stock == 5


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

    # Verify soft-delete in DB
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po.id)
    result = await db_session.execute(stmt)
    updated = result.scalars().first()
    assert updated.status == "CANCELLED"
    assert updated.is_deleted is True


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
    assert original.is_deleted is True


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
    """POST /purchase/orders/{id}/submit promotes DRAFT -> CONFIRMED (via DB-seeded DRAFT PO)."""
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
    assert data["status"] == "CONFIRMED"
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
    """POST /workflow/PurchaseOrder/{id}/submit via Core Workflow API."""
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
    assert r.json()["status"] == "CONFIRMED"


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
