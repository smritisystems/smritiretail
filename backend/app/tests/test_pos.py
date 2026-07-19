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
* Modified   : 2026-07-11
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
    mgr = await _make_user(db_session, s, comp.id, br.id, UserRole.SYSADMIN)
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
                           json={"id": f"sh-{s}", "register_id": reg.id,
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
                          json={"id": f"sh1-{s}", "register_id": reg.id},
                          headers=_bearer(cashier, comp.id, br.id))
        assert r1.status_code == 201

        r2 = await c.post("/api/v1/pos/shifts/open",
                          json={"id": f"sh2-{s}", "register_id": reg.id},
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
                           json={"id": f"sh-{s}", "register_id": "nonexistent"},
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
                                json={"id": f"sh-{s}", "register_id": reg.id,
                                      "opening_balance": "1000.00"},
                                headers=_bearer(cashier, comp.id, br.id))
        assert open_res.status_code == 201

        close_res = await c.post(f"/api/v1/pos/shifts/close/sh-{s}",
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
        await c.post("/api/v1/pos/shifts/open",
                     json={"id": f"sh-{s}", "register_id": reg.id},
                     headers=_bearer(cashier, comp.id, br.id))
        await c.post(f"/api/v1/pos/shifts/close/sh-{s}",
                     json={"closing_balance": "0.00"},
                     headers=_bearer(cashier, comp.id, br.id))
        second_close = await c.post(f"/api/v1/pos/shifts/close/sh-{s}",
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
        await c.post("/api/v1/pos/shifts/open",
                     json={"id": f"sh-{s}", "register_id": reg.id},
                     headers=_bearer(cashier, comp.id, br.id))
        r2 = await c.get(f"/api/v1/shifts/active/{reg.id}",
                         headers=_bearer(cashier, comp.id, br.id))
        assert r2.status_code == 200
        assert r2.json()["id"] == f"sh-{s}"


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

    # Verify stock was deducted in DB
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
            json={"id": f"sh4a-{s}", "register_id": reg.id, "opening_balance": "500.00"},
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
            json={"id": f"sh4b-{s}", "register_id": reg.id, "opening_balance": "100.00"},
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
