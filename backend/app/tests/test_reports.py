"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.14.0
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

from app.main import app
from app.models.auth import User, RefreshTokenBlacklist, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.purchase import (
    Supplier, PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
)
from app.models.supplier_payment import SupplierPayment
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.asyncio


# ─────────────────────────── Fixtures ───────────────────────────

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """FK-safe cleanup covering all report-sourced tables."""

    async def _cleanup():
        await db_session.execute(sa_delete(SupplierPayment))
        await db_session.execute(sa_delete(SalesInvoiceItem))
        await db_session.execute(sa_delete(SalesInvoice))
        await db_session.execute(sa_delete(PurchaseReceiptItem))
        await db_session.execute(sa_delete(PurchaseReceipt))
        await db_session.execute(sa_delete(PurchaseOrderItem))
        await db_session.execute(sa_delete(PurchaseOrder))
        await db_session.execute(sa_delete(Supplier))
        await db_session.execute(sa_delete(StockMovement))
        await db_session.execute(sa_delete(Product))
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
    comp = Company(id=f"comp-rpt-{suffix}", name=f"Rpt Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-rpt-{suffix}", company_id=comp.id,
                  name=f"Rpt Br {suffix}", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_manager(db_session, suffix, comp_id, br_id):
    user = User(
        id=f"usr-rpt-{suffix}", username=f"usr_rpt_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.MANAGER, is_active=True, is_deleted=False,
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


async def _make_product(db_session, suffix, comp_id, br_id, stock, cost_price):
    p = Product(
        id=f"prod-{suffix}", code=f"P-{suffix}", name=f"Product {suffix}",
        barcode=f"BC-{suffix}",
        category="General",
        stock=Decimal(stock), cost_price=Decimal(cost_price),
        is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(p)
    await db_session.commit()
    return p


async def _make_invoice(db_session, suffix, comp_id, br_id, mode, amount, inv_date=None):
    inv_date = inv_date or datetime.date.today()
    inv = SalesInvoice(
        id=f"inv-{suffix}", invoice_no=f"INV-{suffix}",
        date=inv_date, payment_mode=mode,
        grand_total=Decimal(amount),
        status="Draft",
        is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(inv)
    await db_session.commit()
    return inv


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


async def _make_grn(db_session, suffix, supplier_id, comp_id, br_id, amount, grn_date=None):
    # PurchaseReceipt has no receipt_date column; created_at is used for chronology
    grn = PurchaseReceipt(
        id=f"grn-{suffix}", receipt_no=f"GRN-{suffix}",
        supplier_id=supplier_id,
        grand_total=Decimal(amount),
        status="Draft",
        is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(grn)
    await db_session.commit()
    return grn


async def _make_payment(db_session, suffix, supplier_id, comp_id, br_id, amount, pmt_date=None):
    pmt_date = pmt_date or datetime.date.today()
    p = SupplierPayment(
        id=f"pmt-{suffix}", supplier_id=supplier_id,
        amount=Decimal(amount), payment_mode="CASH",
        payment_date=pmt_date,
        is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(p)
    await db_session.commit()
    return p


# ─────────────────────────── Tests ───────────────────────────

async def test_stock_valuation_report(db_session):
    """Stock valuation = sum of (stock × cost_price) for all products."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    await _make_product(db_session, s + "a", comp.id, br.id, stock="10", cost_price="50.00")
    await _make_product(db_session, s + "b", comp.id, br.id, stock="5",  cost_price="100.00")
    _set_tenant(db_session, comp.id, br.id)

    # 10×50 + 5×100 = 500 + 500 = 1000
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/v1/reports/stock-valuation",
                          headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 200
    data = res.json()
    assert data["total_items"] == 2
    assert Decimal(data["total_value"]) == Decimal("1000.00")
    values = {l["code"]: Decimal(l["stock_value"]) for l in data["lines"]}
    assert values[f"P-{s}a"] == Decimal("500.00")
    assert values[f"P-{s}b"] == Decimal("500.00")


async def test_stock_valuation_empty_tenant(db_session):
    """Stock valuation for a tenant with no products returns 0 total."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/v1/reports/stock-valuation",
                          headers=_bearer(mgr, comp.id, br.id))
    assert res.status_code == 200
    assert res.json()["total_items"] == 0
    assert Decimal(res.json()["total_value"]) == Decimal("0.00")


async def test_daily_sales_report_by_mode(db_session):
    """Daily sales correctly aggregates CASH, CARD, UPI totals."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    today = datetime.date.today()
    await _make_invoice(db_session, s + "1", comp.id, br.id, "CASH", "300.00", today)
    await _make_invoice(db_session, s + "2", comp.id, br.id, "CARD", "150.00", today)
    await _make_invoice(db_session, s + "3", comp.id, br.id, "UPI",  "200.00", today)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get(f"/api/v1/reports/daily-sales?report_date={today}",
                          headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 200
    data = res.json()
    assert data["total_invoices"] == 3
    assert Decimal(data["total_sales"]) == Decimal("650.00")
    assert Decimal(data["cash_sales"]) == Decimal("300.00")
    assert Decimal(data["card_sales"]) == Decimal("150.00")
    assert Decimal(data["upi_sales"])  == Decimal("200.00")


async def test_daily_sales_report_different_date_excluded(db_session):
    """Invoices from a different date do not appear in today's report."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    await _make_invoice(db_session, s + "1", comp.id, br.id, "CASH", "500.00", yesterday)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get(f"/api/v1/reports/daily-sales?report_date={today}",
                          headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 200
    assert res.json()["total_invoices"] == 0
    assert Decimal(res.json()["total_sales"]) == Decimal("0.00")


async def test_supplier_ledger_purchase_and_payment(db_session):
    """
    Supplier ledger shows GRN as PURCHASE (+) and payment as PAYMENT (-).
    closing_balance = total_purchased - total_paid.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    supplier = await _make_supplier(db_session, s, comp.id, br.id, outstanding="600.00")

    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    # GRN yesterday: 1000
    await _make_grn(db_session, s + "g1", supplier.id, comp.id, br.id, "1000.00", yesterday)
    # Payment today: 400
    await _make_payment(db_session, s + "p1", supplier.id, comp.id, br.id, "400.00", today)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get(f"/api/v1/reports/supplier-ledger/{supplier.id}",
                          headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 200
    data = res.json()
    assert data["supplier_id"]    == supplier.id
    assert Decimal(data["total_purchased"]) == Decimal("1000.00")
    assert Decimal(data["total_paid"])      == Decimal("400.00")
    assert Decimal(data["closing_balance"]) == Decimal("600.00")
    assert len(data["entries"]) == 2
    # Verify both entry types are present (order depends on created_at vs payment_date sort)
    entry_types = {e["entry_type"] for e in data["entries"]}
    assert entry_types == {"PURCHASE", "PAYMENT"}
    # Verify amounts
    amounts = {e["entry_type"]: Decimal(e["amount"]) for e in data["entries"]}
    assert amounts["PURCHASE"] == Decimal("1000.00")
    assert amounts["PAYMENT"]  == Decimal("400.00")


async def test_supplier_ledger_not_found(db_session):
    """Ledger for a non-existent supplier returns 404."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/v1/reports/supplier-ledger/ghost",
                          headers=_bearer(mgr, comp.id, br.id))
    assert res.status_code == 404


async def test_purchase_summary(db_session):
    """Purchase summary returns per-supplier PO and GRN counts and totals."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    sup = await _make_supplier(db_session, s, comp.id, br.id, outstanding="300.00")

    # Create a PO — PurchaseOrder has no order_date column, uses created_at
    po = PurchaseOrder(
        id=f"po-{s}", order_no=f"PO-{s}", supplier_id=sup.id,
        grand_total=Decimal("500.00"),
        status="Draft", is_active=True, is_deleted=False,
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(po)
    await db_session.commit()
    today = datetime.date.today()
    await _make_grn(db_session, s + "g1", sup.id, comp.id, br.id, "300.00", today)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/v1/reports/purchase-summary",
                          headers=_bearer(mgr, comp.id, br.id))

    assert res.status_code == 200
    lines = res.json()
    assert len(lines) == 1
    line = lines[0]
    assert line["supplier_id"]  == sup.id
    assert line["po_count"]     == 1
    assert line["grn_count"]    == 1
    assert Decimal(line["total_ordered"])  == Decimal("500.00")
    assert Decimal(line["total_received"]) == Decimal("300.00")
    assert Decimal(line["outstanding"])    == Decimal("300.00")
