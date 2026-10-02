"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.12.0
* Created    : 2026-07-11
* Modified   : 2026-08-17
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, RefreshTokenBlacklist, UserRole
from app.models.tenant import Company, Branch
from app.models.pos import CashRegister, Shift
from app.models.sales import SalesInvoice
from app.models.inventory import Warehouse
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token

from app.tests.conftest import clear_db

# ─────────────────────────── Fixtures ───────────────────────────

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    Wire the test DB session into the app and clean all tables
    in FK-safe order BEFORE each test (pre-condition) and AFTER each test.
    """
    await clear_db(db_session)   # pre-test: start clean

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield                  # ← test runs here
    finally:
        try:
            await clear_db(db_session)   # post-test: leave DB clean for next module
        except Exception:
            pass               # best-effort; session rollback handled by conftest
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-pos-{suffix}", name=f"POS Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-pos-{suffix}", company_id=comp.id,
                  name=f"POS Br {suffix}", code=f"BRPOS-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.flush()
    warehouse = Warehouse(
        id=f"wh-central-{suffix}", company_id=comp.id, branch_id=br.id,
        code=f"WH-POS-{suffix}", name="Central Warehouse", is_active=True,
        address="POS Test Warehouse", city="Mumbai", state="Maharashtra",
        pincode="400001",
    )
    db_session.add(warehouse)
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.CASHIER):
    user = User(
        id=f"usr-pos-{suffix}", username=f"usr_pos_{suffix}",
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


async def _make_register(db_session, suffix, comp_id, br_id):
    reg = CashRegister(
        id=f"reg-{suffix}", name=f"Counter {suffix}", code=f"REG-{suffix}",
        is_active=True, is_deleted=False, company_id=comp_id, branch_id=br_id,
    )
    db_session.add(reg)
    await db_session.commit()
    return reg


# ─────────────────────────── Register tests ───────────────────────────

async def test_create_register(db_session):
    """MANAGER can create a cash register."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id, UserRole.MANAGER)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/registers/",
                           json={"id": f"reg-{s}", "name": "Counter 1", "code": f"REG-{s}"},
                           headers=_bearer(mgr, comp.id, br.id))
    assert res.status_code == 201
    assert res.json()["code"] == f"REG-{s}"


async def test_cashier_cannot_create_register(db_session):
    """CASHIER gets 403 when trying to create a register."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id, UserRole.CASHIER)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/registers/",
                           json={"id": f"reg-{s}", "name": "X", "code": f"X{s}"},
                           headers=_bearer(cashier, comp.id, br.id))
    assert res.status_code == 403


async def test_list_registers(db_session):
    """Listed registers are scoped to tenant."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    await _make_register(db_session, s + "a", comp.id, br.id)
    await _make_register(db_session, s + "b", comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/v1/registers/", headers=_bearer(cashier, comp.id, br.id))
    assert res.status_code == 200
    assert len(res.json()) == 2


# ─────────────────────────── Shift open tests ───────────────────────────

async def test_open_shift(db_session):
    """Cashier can open a shift on an existing register."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/shifts/open",
                           json={"register_id": reg.id,
                                 "opening_balance": "500.00"},
                           headers=_bearer(cashier, comp.id, br.id))
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "OPEN"
    assert Decimal(data["opening_balance"]) == Decimal("500.00")
    assert data["cashier_id"] == cashier.id


async def test_cannot_open_two_shifts_same_register(db_session):
    """Opening a second shift on a register that already has an OPEN shift returns 400."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r1 = await c.post("/api/v1/pos/shifts/open",
                          json={"register_id": reg.id},
                          headers=_bearer(cashier, comp.id, br.id))
        assert r1.status_code == 201

        r2 = await c.post("/api/v1/pos/shifts/open",
                          json={"register_id": reg.id},
                          headers=_bearer(cashier, comp.id, br.id))
    assert r2.status_code == 400
    assert "already has an open shift" in r2.json()["detail"].lower()


async def test_open_shift_invalid_register_returns_404(db_session):
    """Opening a shift on a non-existent register returns 404."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/shifts/open",
                           json={"register_id": "nonexistent"},
                           headers=_bearer(cashier, comp.id, br.id))
    assert res.status_code == 404


# ─────────────────────────── Shift close / reconciliation tests ───────────────────────────

async def test_close_shift_no_sales(db_session):
    """Closing a shift with no invoices: total_sales=0, expected_cash=opening_balance."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        open_res = await c.post("/api/v1/pos/shifts/open",
                                json={"register_id": reg.id,
                                      "opening_balance": "1000.00"},
                                headers=_bearer(cashier, comp.id, br.id))
        assert open_res.status_code == 201
        shift_id = open_res.json()["id"]

        close_res = await c.post(f"/api/v1/pos/shifts/close/{shift_id}",
                                 json={"closing_balance": "1000.00"},
                                 headers=_bearer(cashier, comp.id, br.id))

    assert close_res.status_code == 200
    data = close_res.json()
    assert data["status"] == "CLOSED"
    assert Decimal(data["total_sales"]) == Decimal("0.00")
    assert data["total_invoices"] == "0"
    assert Decimal(data["expected_cash"]) == Decimal("1000.00")
    assert Decimal(data["variance"]) == Decimal("0.00")


async def test_close_shift_with_sales_variance(db_session):
    """
    Close a shift with a cash invoice linked to it.
    expected_cash = 200 (opening) + 500 (cash sale) = 700
    cashier declares 680 → variance = -20 (short)
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create shift directly in DB so we can link an invoice
    from datetime import datetime, timezone
    shift = Shift(
        id=f"sh-{s}", register_id=reg.id, cashier_id=cashier.id,
        status="OPEN", opened_at=datetime.now(timezone.utc),
        opening_balance=Decimal("200.00"),
        cash_sales_total=Decimal("0"), card_sales_total=Decimal("0"),
        upi_sales_total=Decimal("0"), total_sales=Decimal("0"),
        total_invoices="0",
        is_active=True, is_deleted=False,
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(shift)

    import datetime as _dt
    invoice = SalesInvoice(
        id=f"inv-{s}", invoice_no=f"INV-{s}",
        date=_dt.date.today(),
        shift_id=shift.id,
        payment_mode="CASH",
        grand_total=Decimal("500.00"),
        status="Draft",
        is_active=True, is_deleted=False,
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(invoice)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(f"/api/v1/pos/shifts/close/sh-{s}",
                           json={"closing_balance": "680.00",
                                 "closing_notes": "Short by 20"},
                           headers=_bearer(cashier, comp.id, br.id))

    assert res.status_code == 200
    data = res.json()
    assert Decimal(data["cash_sales_total"]) == Decimal("500.00")
    assert Decimal(data["total_sales"])      == Decimal("500.00")
    assert data["total_invoices"]            == "1"
    assert Decimal(data["expected_cash"])    == Decimal("700.00")   # 200 + 500
    assert Decimal(data["variance"])         == Decimal("-20.00")   # 680 − 700
    assert data["closing_notes"]             == "Short by 20"


async def test_close_already_closed_shift_returns_400(db_session):
    """Attempting to close a CLOSED shift returns 400."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        open_res = await c.post("/api/v1/pos/shifts/open",
                                json={"register_id": reg.id},
                                headers=_bearer(cashier, comp.id, br.id))
        assert open_res.status_code == 201
        shift_id = open_res.json()["id"]
        await c.post(f"/api/v1/pos/shifts/close/{shift_id}",
                     json={"closing_balance": "0.00"},
                     headers=_bearer(cashier, comp.id, br.id))
        second_close = await c.post(f"/api/v1/pos/shifts/close/{shift_id}",
                                    json={"closing_balance": "0.00"},
                                    headers=_bearer(cashier, comp.id, br.id))
    assert second_close.status_code == 400
    assert "already been closed" in second_close.json()["detail"].lower()


async def test_get_active_shift(db_session):
    """get_active_shift returns the open shift; 404 when none."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # No shift yet → 404
        r1 = await c.get(f"/api/v1/shifts/active/{reg.id}",
                         headers=_bearer(cashier, comp.id, br.id))
        assert r1.status_code == 404

        # Open a shift → 200
        open_res = await c.post("/api/v1/pos/shifts/open",
                                json={"register_id": reg.id},
                                headers=_bearer(cashier, comp.id, br.id))
        assert open_res.status_code == 201
        shift_id = open_res.json()["id"]
        r2 = await c.get(f"/api/v1/shifts/active/{reg.id}",
                         headers=_bearer(cashier, comp.id, br.id))
        assert r2.status_code == 200
        assert r2.json()["id"] == shift_id


# ─────────────────────────── POS Checkout tests (Phase 1) ───────────────────────────

async def _make_product(db_session, suffix, comp_id, br_id, stock: int = 50):
    """Helper: create a minimal tracked product with given stock."""
    from app.models.inventory import Product
    p = Product(
        id=f"prod-{suffix}", name=f"Product {suffix}",
        code=f"SKU-{suffix}", barcode=f"BC-{suffix}",
        category="General", price=100.00, cost_price=60.00,
        stock=stock, tracking_mode="Batch",
        is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(p)
    await db_session.commit()
    return p



async def _make_open_shift(db_session, suffix, comp_id, br_id, cashier_id, reg_id,
                           opening: str = "500.00"):
    """Helper: open a shift via the API and return its ID."""
    from datetime import datetime, timezone
    shift = Shift(
        id=f"sh-{suffix}", register_id=reg_id, cashier_id=cashier_id,
        status="OPEN", opened_at=datetime.now(timezone.utc),
        opening_balance=Decimal(opening),
        cash_sales_total=Decimal("0"), card_sales_total=Decimal("0"),
        upi_sales_total=Decimal("0"), total_sales=Decimal("0"),
        total_invoices="0",
        is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(shift)
    await db_session.commit()
    return shift


async def test_pos_checkout_happy_path(db_session):
    """
    POST /api/v1/pos/checkout with a tracked product creates a SalesInvoice,
    deducts stock, and returns success=True, cached=False.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    shift = await _make_open_shift(db_session, s, comp.id, br.id, cashier.id, reg.id)
    _set_tenant(db_session, comp.id, br.id)

    payload = {
        "invoice_no": f"POS-{s}",
        "shift_id": shift.id,
        "payment_mode": "CASH",
        "grand_total": "100.00",
        "billing_address": "1 Corporate Park, Mumbai, Maharashtra - 400001",
        "shipping_address": "12 MG Road, Bengaluru, Karnataka - 560001",
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "1",
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/checkout",
                           json=payload,
                           headers=_bearer(cashier, comp.id, br.id))

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["cached"] is False
    assert data["invoice_no"] == f"POS-{s}"
    assert data["payment_mode"] == "CASH"
    assert Decimal(data["grand_total"]) == Decimal("100.00")

    invoice = (await db_session.execute(
        select(SalesInvoice).where(SalesInvoice.invoice_no == f"POS-{s}")
    )).scalars().first()
    assert invoice is not None
    assert invoice.billing_address == "1 Corporate Park, Mumbai, Maharashtra - 400001"
    assert invoice.shipping_address == "12 MG Road, Bengaluru, Karnataka - 560001"

    # Verify stock was deducted in DB
    await db_session.refresh(product)
    from sqlalchemy.future import select as _select
    from app.models.inventory import Product as _Product
    res_db = await db_session.execute(
        _select(_Product).where(_Product.id == product.id)
    )
    updated = res_db.scalars().first()
    assert updated.stock == 9   # 10 - 1


async def test_pos_checkout_idempotency(db_session):
    """
    Submitting the same invoice_no twice returns cached=True and does NOT
    deduct stock a second time.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    shift = await _make_open_shift(db_session, s, comp.id, br.id, cashier.id, reg.id)
    _set_tenant(db_session, comp.id, br.id)

    payload = {
        "invoice_no": f"POS-IDEM-{s}",
        "shift_id": shift.id,
        "payment_mode": "UPI",
        "grand_total": "100.00",
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "1",
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r1 = await c.post("/api/v1/pos/checkout",
                          json=payload,
                          headers=_bearer(cashier, comp.id, br.id))
        r2 = await c.post("/api/v1/pos/checkout",
                          json=payload,
                          headers=_bearer(cashier, comp.id, br.id))

    assert r1.status_code == 200
    assert r1.json()["cached"] is False

    assert r2.status_code == 200
    assert r2.json()["cached"] is True   # second call: idempotent

    # Stock deducted only once
    await db_session.refresh(product)
    from sqlalchemy.future import select as _select
    from app.models.inventory import Product as _Product
    res_db = await db_session.execute(
        _select(_Product).where(_Product.id == product.id)
    )
    updated = res_db.scalars().first()
    assert updated.stock == 9   # 10 - 1, NOT 8


async def test_pos_checkout_closed_shift_returns_400(db_session):
    """
    Checkout against a CLOSED shift returns HTTP 400.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    _set_tenant(db_session, comp.id, br.id)

    # Create a CLOSED shift directly in DB
    from datetime import datetime, timezone
    shift = Shift(
        id=f"sh-closed-{s}", register_id=reg.id, cashier_id=cashier.id,
        status="CLOSED", opened_at=datetime.now(timezone.utc),
        opening_balance=Decimal("0"), cash_sales_total=Decimal("0"),
        card_sales_total=Decimal("0"), upi_sales_total=Decimal("0"),
        total_sales=Decimal("0"), total_invoices="0",
        is_active=True, is_deleted=False,
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(shift)
    await db_session.commit()

    payload = {
        "invoice_no": f"POS-CLOSED-{s}",
        "shift_id": shift.id,
        "payment_mode": "CASH",
        "grand_total": "100.00",
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "1",
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/checkout",
                           json=payload,
                           headers=_bearer(cashier, comp.id, br.id))

    assert res.status_code == 400
    assert "shift is not open" in res.json()["detail"].lower()


async def test_pos_checkout_insufficient_stock_returns_400(db_session):
    """
    Attempting to sell more units than available stock returns HTTP 400.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id)
    reg = await _make_register(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=2)
    shift = await _make_open_shift(db_session, s, comp.id, br.id, cashier.id, reg.id)
    _set_tenant(db_session, comp.id, br.id)

    payload = {
        "invoice_no": f"POS-OOS-{s}",
        "shift_id": shift.id,
        "payment_mode": "CASH",
        "grand_total": "500.00",
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "5",          # 5 requested, only 2 in stock
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/checkout",
                           json=payload,
                           headers=_bearer(cashier, comp.id, br.id))

    assert res.status_code == 400
    assert "insufficient stock" in res.json()["detail"].lower()


# ─────────────────────────── Phase 4A Contract URL Tests ───────────────────────────

async def test_open_shift_contract_url(db_session):
    """Contract URL POST /api/v1/pos/shifts/open must open a shift (status=OPEN)."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"4a{s}")
    cashier = await _make_user(db_session, f"4a{s}", comp.id, br.id)
    reg = await _make_register(db_session, f"4a{s}", comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/v1/pos/shifts/open",
            json={"register_id": reg.id, "opening_balance": "500.00"},
            headers=_bearer(cashier, comp.id, br.id),
        )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "OPEN"
    assert data["register_id"] == reg.id


async def test_close_shift_contract_url(db_session):
    """Contract URL POST /api/v1/pos/shifts/close/{id} must close a shift."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"4b{s}")
    cashier = await _make_user(db_session, f"4b{s}", comp.id, br.id)
    reg = await _make_register(db_session, f"4b{s}", comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)
    hdrs = _bearer(cashier, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        open_r = await c.post(
            "/api/v1/pos/shifts/open",
            json={"register_id": reg.id, "opening_balance": "100.00"},
            headers=hdrs,
        )
        assert open_r.status_code == 201, open_r.text
        shift_id = open_r.json()["id"]
        close_r = await c.post(
            f"/api/v1/pos/shifts/close/{shift_id}",
            json={"closing_balance": "150.00"},
            headers=hdrs,
        )
    assert close_r.status_code == 200, close_r.text
    assert close_r.json()["id"] == shift_id


async def test_pos_checkout_rejects_rate_exceeding_mrp(db_session):
    """
    Statutory Price Validation: Selling price cannot exceed MRP.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"mrp{s}")
    cashier = await _make_user(db_session, f"mrp{s}", comp.id, br.id)
    reg = await _make_register(db_session, f"mrp{s}", comp.id, br.id)
    product = await _make_product(db_session, f"mrp{s}", comp.id, br.id, stock=10)
    shift = await _make_open_shift(db_session, f"mrp{s}", comp.id, br.id, cashier.id, reg.id)
    _set_tenant(db_session, comp.id, br.id)

    payload = {
        "invoice_no": f"INV-MRP-{s}",
        "shift_id": shift.id,
        "payment_mode": "CASH",
        "grand_total": "1200.00",
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "1",
            "price": "1200.00",
            "mrp": "1000.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/v1/pos/checkout",
            json=payload,
            headers=_bearer(cashier, comp.id, br.id),
        )

    assert r.status_code == 400
    assert "Selling price" in r.text
    assert "cannot exceed MRP" in r.text


# ─────────────────────────── Phase P2.6: Multi-Tender, Wallet, & Offline Sync Tests ───────────────────────────

async def _make_customer(db_session, suffix, comp_id, br_id):
    """Helper: create a customer record."""
    from app.models.crm import Customer
    cust = Customer(
        id=f"cust-{suffix}",
        name=f"Customer {suffix}",
        mobile=f"98765{suffix[:5]}",
        email=f"cust_{suffix}@example.com",
        company_id=comp_id,
        branch_id=br_id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(cust)
    await db_session.commit()
    return cust


async def test_pos_checkout_split_tender_cash_and_upi(db_session):
    """
    Phase P2.6: Split Tender Checkout (CASH + UPI).
    Verifies multi-tender processing, accurate drawer cash tracking on shift close,
    PaymentTransaction persistence, and GL voucher generation.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"sp{s}")
    cashier = await _make_user(db_session, f"sp{s}", comp.id, br.id)
    reg = await _make_register(db_session, f"sp{s}", comp.id, br.id)
    product = await _make_product(db_session, f"sp{s}", comp.id, br.id, stock=10)
    shift = await _make_open_shift(db_session, f"sp{s}", comp.id, br.id, cashier.id, reg.id, opening="500.00")
    _set_tenant(db_session, comp.id, br.id)

    payload = {
        "invoice_no": f"POS-SPLIT-{s}",
        "shift_id": shift.id,
        "payment_mode": "SPLIT",
        "grand_total": "500.00",
        "tenders": [
            {"tender_type": "CASH", "amount": "200.00"},
            {"tender_type": "UPI", "amount": "300.00", "reference_no": f"UPI-{s}-REF"}
        ],
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "5",
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/v1/pos/checkout",
            json=payload,
            headers=_bearer(cashier, comp.id, br.id)
        )

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["payment_mode"] == "SPLIT"
    assert Decimal(str(data["grand_total"])) == Decimal("500.00")
    assert Decimal(str(data["paid_amount"])) == Decimal("500.00")
    assert Decimal(str(data["balance_amount"])) == Decimal("0.00")

    # Close shift with physical cash 700.00 (opening 500.00 + 200.00 cash sales)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        close_res = await c.post(
            f"/api/v1/pos/shifts/close/{shift.id}",
            json={"closing_balance": "700.00"},
            headers=_bearer(cashier, comp.id, br.id)
        )

    assert close_res.status_code == 200, close_res.text
    shift_data = close_res.json()
    assert Decimal(str(shift_data["cash_sales_total"])) == Decimal("200.00")
    assert Decimal(str(shift_data["upi_sales_total"])) == Decimal("300.00")
    assert Decimal(str(shift_data["card_sales_total"])) == Decimal("0.00")
    assert Decimal(str(shift_data["total_sales"])) == Decimal("500.00")
    assert Decimal(str(shift_data["expected_cash"])) == Decimal("700.00")
    assert Decimal(str(shift_data["variance"])) == Decimal("0.00")

    # Verify PaymentTransactions and GL links in DB
    from app.models.payment_ledger import PaymentTransaction
    from app.models.accounting import JournalVoucher
    tx_res = await db_session.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.reference_doc_id == data["invoice_id"],
            PaymentTransaction.company_id == comp.id,
        )
    )
    txs = tx_res.scalars().all()
    assert len(txs) == 2
    types = {tx.tender_type: Decimal(str(tx.amount)) for tx in txs}
    assert types["CASH"] == Decimal("200.00")
    assert types["UPI"] == Decimal("300.00")

    for tx in txs:
        jv_res = await db_session.execute(
            select(JournalVoucher).where(
                JournalVoucher.reference_doc_id == tx.id,
                JournalVoucher.company_id == comp.id,
            )
        )
        jv = jv_res.scalars().first()
        assert jv is not None
        assert jv.voucher_type == "PAYMENT_RECEIPT"


async def test_pos_checkout_store_credit_wallet_redemption(db_session):
    """
    Phase P2.6: POS Cashier Store Credit / Wallet Redemption.
    Verifies wallet lookup, multi-tender split checkout with store credit,
    ledger deduction with compound reference identity, and shift cash exclusion.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"wal{s}")
    cashier = await _make_user(db_session, f"wal{s}", comp.id, br.id)
    reg = await _make_register(db_session, f"wal{s}", comp.id, br.id)
    customer = await _make_customer(db_session, f"wal{s}", comp.id, br.id)
    product = await _make_product(db_session, f"wal{s}", comp.id, br.id, stock=10)
    shift = await _make_open_shift(db_session, f"wal{s}", comp.id, br.id, cashier.id, reg.id, opening="500.00")
    _set_tenant(db_session, comp.id, br.id)

    # Provision customer with ₹300 store credit
    from app.models.crm import CustomerCreditLedgerEntry
    from datetime import datetime, timezone
    credit_entry = CustomerCreditLedgerEntry(
        id=f"ccle-prov-{s}",
        customer_id=customer.id,
        entry_date=datetime.now(timezone.utc),
        entry_type="CREDIT",
        amount=Decimal("300.00"),
        balance_after=Decimal("300.00"),
        reference_type="SALES_RETURN",
        reference_id=f"SR-PROV-{s}",
        notes="Return credit note store wallet refund",
        company_id=comp.id,
        branch_id=br.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(credit_entry)
    await db_session.commit()

    hdrs = _bearer(cashier, comp.id, br.id)

    # 1. Query wallet balance via POS endpoint
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        bal_res = await c.get(f"/api/v1/pos/customer-wallet/{customer.id}", headers=hdrs)
    assert bal_res.status_code == 200, bal_res.text
    bal_data = bal_res.json()
    assert Decimal(str(bal_data["available_wallet_balance"])) == Decimal("300.00")
    assert Decimal(str(bal_data["total_credit_issued"])) == Decimal("300.00")
    assert Decimal(str(bal_data["total_wallet_redeemed"])) == Decimal("0.00")

    # 2. POS Checkout: ₹300 WALLET + ₹200 CASH for ₹500 invoice
    payload = {
        "invoice_no": f"POS-WAL-{s}",
        "shift_id": shift.id,
        "payment_mode": "SPLIT",
        "customer_id": customer.id,
        "grand_total": "500.00",
        "tenders": [
            {"tender_type": "WALLET", "amount": "300.00"},
            {"tender_type": "CASH", "amount": "200.00"}
        ],
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "5",
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/checkout", json=payload, headers=hdrs)

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert Decimal(str(data["paid_amount"])) == Decimal("500.00")
    assert Decimal(str(data["balance_amount"])) == Decimal("0.00")

    # 3. Check wallet balance after redemption (should be 0.00)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        bal_after = await c.get(f"/api/v1/pos/customer-wallet/{customer.id}", headers=hdrs)
    assert bal_after.status_code == 200
    bal_after_data = bal_after.json()
    assert Decimal(str(bal_after_data["available_wallet_balance"])) == Decimal("0.00")
    assert Decimal(str(bal_after_data["total_wallet_redeemed"])) == Decimal("300.00")

    # 4. Verify debit entry has compound reference identity (invoice_id:tx_id)
    debit_res = await db_session.execute(
        select(CustomerCreditLedgerEntry).where(
            CustomerCreditLedgerEntry.customer_id == customer.id,
            CustomerCreditLedgerEntry.entry_type == "DEBIT",
            CustomerCreditLedgerEntry.company_id == comp.id,
        )
    )
    debit_entry = debit_res.scalars().first()
    assert debit_entry is not None
    assert debit_entry.amount == Decimal("300.00")
    assert ":" in debit_entry.reference_id

    # 5. Close shift — drawer cash must only expect the cash portion (200.00), not wallet (300.00)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        close_res = await c.post(
            f"/api/v1/pos/shifts/close/{shift.id}",
            json={"closing_balance": "700.00"},
            headers=hdrs
        )
    assert close_res.status_code == 200, close_res.text
    shift_res_data = close_res.json()
    assert Decimal(str(shift_res_data["cash_sales_total"])) == Decimal("200.00")
    assert Decimal(str(shift_res_data["total_sales"])) == Decimal("500.00")
    assert Decimal(str(shift_res_data["expected_cash"])) == Decimal("700.00")
    assert Decimal(str(shift_res_data["variance"])) == Decimal("0.00")


async def test_pos_checkout_wallet_exceeds_available_balance_returns_400(db_session):
    """
    Phase P2.6: Tendering wallet amount greater than available credit fails with HTTP 400.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"wexc{s}")
    cashier = await _make_user(db_session, f"wexc{s}", comp.id, br.id)
    reg = await _make_register(db_session, f"wexc{s}", comp.id, br.id)
    customer = await _make_customer(db_session, f"wexc{s}", comp.id, br.id)
    product = await _make_product(db_session, f"wexc{s}", comp.id, br.id, stock=10)
    shift = await _make_open_shift(db_session, f"wexc{s}", comp.id, br.id, cashier.id, reg.id)
    _set_tenant(db_session, comp.id, br.id)

    # Customer only has ₹100
    from app.models.crm import CustomerCreditLedgerEntry
    from datetime import datetime, timezone
    db_session.add(
        CustomerCreditLedgerEntry(
            id=f"ccle-exc-{s}",
            customer_id=customer.id,
            entry_date=datetime.now(timezone.utc),
            entry_type="CREDIT",
            amount=Decimal("100.00"),
            balance_after=Decimal("100.00"),
            reference_type="SALES_RETURN",
            reference_id=f"SR-EXC-{s}",
            notes="Small store credit",
            company_id=comp.id,
            branch_id=br.id,
            is_active=True,
            is_deleted=False,
        )
    )
    await db_session.commit()

    # Attempt to tender ₹200 WALLET
    payload = {
        "invoice_no": f"POS-EXC-{s}",
        "shift_id": shift.id,
        "payment_mode": "SPLIT",
        "customer_id": customer.id,
        "grand_total": "200.00",
        "tenders": [
            {"tender_type": "WALLET", "amount": "200.00"},
        ],
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "2",
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/checkout", json=payload, headers=_bearer(cashier, comp.id, br.id))

    assert res.status_code == 400
    assert "exceeds available" in res.text


async def test_pos_checkout_wallet_without_customer_returns_400(db_session):
    """
    Phase P2.6: Tendering wallet without specifying customer_id fails with HTTP 400.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"wnoc{s}")
    cashier = await _make_user(db_session, f"wnoc{s}", comp.id, br.id)
    reg = await _make_register(db_session, f"wnoc{s}", comp.id, br.id)
    product = await _make_product(db_session, f"wnoc{s}", comp.id, br.id, stock=10)
    shift = await _make_open_shift(db_session, f"wnoc{s}", comp.id, br.id, cashier.id, reg.id)
    _set_tenant(db_session, comp.id, br.id)

    payload = {
        "invoice_no": f"POS-NOCUST-{s}",
        "shift_id": shift.id,
        "payment_mode": "WALLET",
        "customer_id": None,
        "grand_total": "100.00",
        "tenders": [
            {"tender_type": "WALLET", "amount": "100.00"},
        ],
        "items": [{
            "product_id": product.id,
            "code": product.code,
            "name": product.name,
            "quantity": "1",
            "price": "100.00",
            "gst_rate": "0.00",
        }],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/pos/checkout", json=payload, headers=_bearer(cashier, comp.id, br.id))

    assert res.status_code == 400
    assert "customer identification" in res.text.lower()


async def test_pos_offline_sync_push_and_idempotent_deduplication(db_session):
    """
    Phase P2.6 (BD-04): POS Offline Synchronization Invariants.
    Verifies offline batch ingestion via /api/v1/sync/push, 5-tier conflict resolution,
    and 100% idempotent deduplication on repeated batch push.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"sync{s}")
    cashier = await _make_user(db_session, f"sync{s}", comp.id, br.id)
    product = await _make_product(db_session, f"sync{s}", comp.id, br.id, stock=10)
    _set_tenant(db_session, comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    prod_id = str(product.id)
    prod_code = str(product.code)
    prod_name = str(product.name)

    batch_payload = {
        "batch_id": f"BATCH-{s}",
        "terminal_id": f"TERM-{s}",
        "allow_negative_stock": True,
        "transactions": [
            {
                "client_id": f"TX-CLI-{s}",
                "type": "SALES_INVOICE",
                "invoice_no": f"OFFLINE-INV-{s}",
                "payment_mode": "CASH",
                "items": [{
                    "product_id": prod_id,
                    "code": prod_code,
                    "name": prod_name,
                    "quantity": 2.0,
                    "price": 100.0,
                    "gst_rate": 0.0,
                }]
            }
        ]
    }

    # 1. First push: batch accepted and committed
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        push1 = await c.post("/api/v1/sync/push", json=batch_payload, headers=headers)

    assert push1.status_code == 200, push1.text
    res1 = push1.json()
    assert res1["accepted_count"] == 1
    assert res1["deduplicated_count"] == 0
    assert res1["results"][0]["status"] == "ACCEPTED"

    # Verify stock deducted in DB (10 - 2 = 8)
    from app.models.inventory import Product as _Product
    p_row = (await db_session.execute(select(_Product).where(_Product.id == prod_id))).scalars().first()
    assert p_row.stock == 8

    # 2. Second push: re-submitting the same batch must be deduplicated
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        push2 = await c.post("/api/v1/sync/push", json=batch_payload, headers=headers)

    assert push2.status_code == 200, push2.text
    res2 = push2.json()
    assert res2["accepted_count"] == 0
    assert res2["deduplicated_count"] == 1
    assert res2["results"][0]["status"] == "DEDUPLICATED"

    # Verify stock was NOT double-deducted (still exactly 8)
    p_row2 = (await db_session.execute(select(_Product).where(_Product.id == prod_id))).scalars().first()
    assert p_row2.stock == 8
