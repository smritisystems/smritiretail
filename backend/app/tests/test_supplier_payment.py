"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.13.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import uuid
import pytest
import datetime
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete as sa_delete
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, RefreshTokenBlacklist, UserRole
from app.models.tenant import Company, Branch
from app.models.purchase import Supplier
from app.models.supplier_payment import SupplierPayment
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.asyncio


# ─────────────────────────── Fixtures ───────────────────────────

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    FK-safe cleanup order (pre and post each test):
      supplier_payments (supplier_id → suppliers)
      suppliers
      users
      refresh_token_blacklist
    """
    async def _cleanup():
        from app.models.purchase import (
            PurchaseReceiptItem, PurchaseReceipt,
            PurchaseOrderItem, PurchaseOrder,
        )
        # FK-safe order: payment → purchase receipts → purchase orders → suppliers → users
        await db_session.execute(sa_delete(SupplierPayment))
        await db_session.execute(sa_delete(PurchaseReceiptItem))
        await db_session.execute(sa_delete(PurchaseReceipt))
        await db_session.execute(sa_delete(PurchaseOrderItem))
        await db_session.execute(sa_delete(PurchaseOrder))
        await db_session.execute(sa_delete(Supplier))
        await db_session.execute(sa_delete(RefreshTokenBlacklist))
        await db_session.execute(sa_delete(User))
        await db_session.commit()

    await _cleanup()

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        try:
            await _cleanup()
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-sp-{suffix}", name=f"SP Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-sp-{suffix}", company_id=comp.id,
                  name=f"SP Br {suffix}", code=f"BRSP-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    user = User(
        id=f"usr-sp-{suffix}", username=f"usr_sp_{suffix}",
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


async def _make_supplier(db_session, suffix, comp_id, br_id, outstanding="0.00"):
    s = Supplier(
        id=f"sup-{suffix}", name=f"Supplier {suffix}", code=f"SUP-{suffix}",
        outstanding=Decimal(outstanding),
        is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(s)
    await db_session.commit()
    return s


# ─────────────────────────── Tests ───────────────────────────

async def test_record_payment_decrements_outstanding(db_session):
    """Recording a payment decrements supplier.outstanding atomically."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="1000.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt-{s}", "supplier_id": supplier.id,
            "amount": "400.00", "payment_mode": "CASH",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 201
    data = res.json()
    assert Decimal(data["amount"]) == Decimal("400.00")
    assert data["payment_mode"] == "CASH"

    # Verify outstanding decremented in DB
    await db_session.refresh(supplier)
    assert Decimal(str(supplier.outstanding)) == Decimal("600.00")


async def test_record_payment_with_reference(db_session):
    """Payment with CHEQUE mode and reference_no is stored correctly."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="5000.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt-{s}", "supplier_id": supplier.id,
            "amount": "5000.00", "payment_mode": "CHEQUE",
            "payment_date": str(datetime.date.today()),
            "reference_no": "CHQ-123456",
            "notes": "Final payment",
        }, headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 201
    data = res.json()
    assert data["reference_no"] == "CHQ-123456"
    assert data["payment_mode"] == "CHEQUE"

    await db_session.refresh(supplier)
    assert Decimal(str(supplier.outstanding)) == Decimal("0.00")


async def test_overpayment_is_rejected(db_session):
    """Payment exceeding outstanding balance returns 400."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="200.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt-{s}", "supplier_id": supplier.id,
            "amount": "500.00", "payment_mode": "BANK_TRANSFER",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 400
    assert "exceeds supplier outstanding" in res.json()["detail"].lower()


async def test_zero_amount_rejected_by_schema(db_session):
    """Amount of 0 is rejected at the schema level before hitting the DB."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="100.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt-{s}", "supplier_id": supplier.id,
            "amount": "0.00", "payment_mode": "CASH",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 422   # Pydantic validation error


async def test_invalid_payment_mode_rejected(db_session):
    """Unknown payment_mode returns 422."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="100.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt-{s}", "supplier_id": supplier.id,
            "amount": "50.00", "payment_mode": "BARTER",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 422


async def test_cashier_cannot_record_payment(db_session):
    """CASHIER role gets 403 when trying to record a payment."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_user(db_session, s, comp.id, br.id, UserRole.CASHIER)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="100.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt-{s}", "supplier_id": supplier.id,
            "amount": "50.00", "payment_mode": "CASH",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(cashier, comp.id, br.id))

    assert res.status_code == 403


async def test_payment_to_nonexistent_supplier_returns_404(db_session):
    """Payment to a non-existent supplier returns 404."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt-{s}", "supplier_id": "ghost-supplier",
            "amount": "100.00", "payment_mode": "CASH",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 404


async def test_list_payments_scoped_to_tenant(db_session):
    """Listed payments are scoped to the current tenant."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    sup1 = await _make_supplier(db_session, s + "a", comp.id, br.id, outstanding="1000.00")
    sup2 = await _make_supplier(db_session, s + "b", comp.id, br.id, outstanding="500.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt1-{s}", "supplier_id": sup1.id,
            "amount": "100.00", "payment_mode": "CASH",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))
        await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt2-{s}", "supplier_id": sup2.id,
            "amount": "200.00", "payment_mode": "UPI",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))

        res = await c.get("/api/v1/supplier-payments/",
                          headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_list_payments_filter_by_supplier(db_session):
    """?supplier_id= filter returns only that supplier's payments."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    sup1 = await _make_supplier(db_session, s + "a", comp.id, br.id, outstanding="1000.00")
    sup2 = await _make_supplier(db_session, s + "b", comp.id, br.id, outstanding="500.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt1-{s}", "supplier_id": sup1.id,
            "amount": "100.00", "payment_mode": "CASH",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))
        await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt2-{s}", "supplier_id": sup2.id,
            "amount": "200.00", "payment_mode": "UPI",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))

        res = await c.get(f"/api/v1/supplier-payments/?supplier_id={sup1.id}",
                          headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 200
    payments = res.json()
    assert len(payments) == 1
    assert payments[0]["supplier_id"] == sup1.id


async def test_multiple_payments_accumulate_correctly(db_session):
    """Two partial payments correctly reduce outstanding in two steps."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_user(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="1000.00")
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r1 = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt1-{s}", "supplier_id": supplier.id,
            "amount": "300.00", "payment_mode": "CASH",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))
        assert r1.status_code == 201

        await db_session.refresh(supplier)
        assert Decimal(str(supplier.outstanding)) == Decimal("700.00")

        r2 = await c.post("/api/v1/supplier-payments/", json={
            "id": f"pmt2-{s}", "supplier_id": supplier.id,
            "amount": "700.00", "payment_mode": "BANK_TRANSFER",
            "payment_date": str(datetime.date.today()),
        }, headers=_bearer(mgr, comp.id, br.id))
        assert r2.status_code == 201

    await db_session.refresh(supplier)
    assert Decimal(str(supplier.outstanding)) == Decimal("0.00")
