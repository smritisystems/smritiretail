"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-07-14
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
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
from app.models.sales import (
    SalesInvoice, SalesInvoiceItem,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem,
    SalesReturn, SalesReturnItem,
)
from app.models.crm import Customer, CustomerGroup
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire the test DB session into the app dependency."""
    await db_session.execute(delete(RefreshTokenBlacklist))
    await db_session.execute(delete(User))
    await db_session.commit()

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_tenant_context, None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_tenant(db_session, suffix: str):
    company = Company(
        id=f"comp-sal-{suffix}", name=f"Sales Co {suffix}",
        gst_number="27ABCDE1234F1Z5", is_active=True,
    )
    branch = Branch(
        id=f"br-sal-{suffix}", company_id=company.id,
        name=f"Sales Br {suffix}", code=f"BRSAL-{suffix}", is_active=True,
    )
    db_session.add_all([company, branch])
    await db_session.commit()
    return company, branch


async def _make_cashier(db_session, suffix: str, company_id: str, branch_id: str) -> User:
    user = User(
        id=f"usr-csh-{suffix}",
        username=f"csh_{suffix}",
        hashed_password=hash_password("Csh@12345"),
        role=UserRole.CASHIER,
        company_id=company_id,
        branch_id=branch_id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, company_id: str, branch_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": company_id,
        "branch_id": branch_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(company_id: str, branch_id: str):
    """Override get_tenant_context to return a fixed TenantContext."""
    async def _get_tenant():
        return TenantContext(company_id=company_id, branch_id=branch_id)
    app.dependency_overrides[get_tenant_context] = _get_tenant


async def _make_product(db_session, suffix: str, company_id: str, branch_id: str, stock: int = 20) -> Product:
    product = Product(
        id=f"prod-sal-{suffix}",
        code=f"PSAL-{suffix}",
        name=f"Sales Product {suffix}",
        price=Decimal("100.00"),
        category="General",
        barcode=f"BCSAL{suffix}",
        stock=stock,
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(product)
    await db_session.commit()
    return product


async def _make_customer(db_session, suffix: str, company_id: str, branch_id: str) -> Customer:
    group = CustomerGroup(
        id=f"cg-sal-{suffix}",
        name=f"Sal Group {suffix}",
        credit_limit=Decimal("50000.00"),
        auto_block_sales=False,
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(group)
    await db_session.flush()

    customer = Customer(
        id=f"cust-sal-{suffix}",
        customer_group_id=group.id,
        name=f"Sales Customer {suffix}",
        outstanding=Decimal("0.00"),
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(customer)
    await db_session.commit()
    return customer


async def _make_invoice(db_session, suffix: str, company_id: str, branch_id: str,
                         product_id: str, customer_id: str) -> SalesInvoice:
    """Insert a minimal SalesInvoice directly to DB (used as source for returns tests)."""
    item = SalesInvoiceItem(
        product_id=product_id,
        code=f"PSAL-{suffix}",
        name=f"Sales Product {suffix}",
        quantity=Decimal("1.00"),
        price=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        tax_amount=Decimal("18.00"),
        total_amount=Decimal("118.00"),
    )
    invoice = SalesInvoice(
        id=f"inv-sal-{suffix}",
        invoice_no=f"INV-SAL-{suffix}",
        customer_id=customer_id,
        tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        status="paid",
        items=[item],
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(invoice)
    await db_session.commit()
    return invoice


# ---------------------------------------------------------------------------
# Sales Quotation Tests
# ---------------------------------------------------------------------------

async def test_create_sales_quotation_as_cashier(db_session):
    """A CASHIER can create a sales quotation."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"q-{suffix}",
        "quotation_no": f"QUOT-{suffix}",
        "customer_name": "Walk-in Customer",
        "status": "draft",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "2.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "236.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sales/quotations/", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["quotation_no"] == f"QUOT-{suffix}"
    assert Decimal(body["tax_total"]) == Decimal("36.00")
    assert Decimal(body["grand_total"]) == Decimal("236.00")


async def test_create_sales_quotation_duplicate_rejected(db_session):
    """Creating a duplicate quotation number returns HTTP 400."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"q-{suffix}",
        "quotation_no": f"QUOT-DUP-{suffix}",
        "customer_name": "Walk-in Customer",
        "status": "draft",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "118.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.post("/api/v1/sales/quotations/", json=payload, headers=headers)
        assert r1.status_code == 201, r1.text

        payload["id"] = f"q-dup-{suffix}"
        r2 = await client.post("/api/v1/sales/quotations/", json=payload, headers=headers)
    assert r2.status_code == 400


async def test_list_sales_quotations(db_session):
    """Listing quotations returns existing records for the tenant."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"q-list-{suffix}",
        "quotation_no": f"QUOT-LIST-{suffix}",
        "customer_name": "List Customer",
        "status": "draft",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "5.00",
                "total_amount": "105.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/sales/quotations/", json=payload, headers=headers)
        resp = await client.get("/api/v1/sales/quotations/", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert any(q["quotation_no"] == f"QUOT-LIST-{suffix}" for q in body)


async def test_get_sales_quotation_by_id(db_session):
    """Fetch a specific quotation by ID returns correct data."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    qid = f"q-get-{suffix}"
    payload = {
        "id": qid,
        "quotation_no": f"QUOT-GET-{suffix}",
        "customer_name": "Get Customer",
        "status": "draft",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "3.00",
                "price": "50.00",
                "gst_rate": "12.00",
                "total_amount": "168.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/sales/quotations/", json=payload, headers=headers)
        resp = await client.get(f"/api/v1/sales/quotations/{qid}", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == qid
    assert body["quotation_no"] == f"QUOT-GET-{suffix}"


async def test_get_nonexistent_quotation_returns_404(db_session):
    """Fetching a non-existent quotation returns 404."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/sales/quotations/nonexistent-id-xyz", headers=headers)

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Sales Order Tests
# ---------------------------------------------------------------------------

async def test_create_sales_order_as_cashier(db_session):
    """A CASHIER can create a sales order."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"so-{suffix}",
        "order_no": f"ORD-{suffix}",
        "customer_name": "Order Customer",
        "status": "confirmed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "5.00",
                "price": "200.00",
                "gst_rate": "18.00",
                "total_amount": "1180.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sales/orders/", json=payload, headers=headers)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["order_no"] == f"ORD-{suffix}"
    assert Decimal(body["tax_total"]) == Decimal("180.00")
    assert Decimal(body["grand_total"]) == Decimal("1180.00")


async def test_create_sales_order_duplicate_rejected(db_session):
    """Duplicate order number returns HTTP 400."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"so-dup1-{suffix}",
        "order_no": f"ORD-DUP-{suffix}",
        "customer_name": "Dup Customer",
        "status": "confirmed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "5.00",
                "total_amount": "105.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.post("/api/v1/sales/orders/", json=payload, headers=headers)
        assert r1.status_code == 201, r1.text

        payload["id"] = f"so-dup2-{suffix}"
        r2 = await client.post("/api/v1/sales/orders/", json=payload, headers=headers)

    assert r2.status_code == 400


async def test_list_sales_orders(db_session):
    """Listing orders returns existing records for the tenant."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"so-list-{suffix}",
        "order_no": f"ORD-LIST-{suffix}",
        "customer_name": "List Customer",
        "status": "pending",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "12.00",
                "total_amount": "112.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/sales/orders/", json=payload, headers=headers)
        resp = await client.get("/api/v1/sales/orders/", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert any(o["order_no"] == f"ORD-LIST-{suffix}" for o in body)


async def test_get_sales_order_by_id(db_session):
    """Fetch a specific sales order by ID returns correct data."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    soid = f"so-get-{suffix}"
    payload = {
        "id": soid,
        "order_no": f"ORD-GET-{suffix}",
        "customer_name": "Get Customer",
        "status": "confirmed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "2.00",
                "price": "150.00",
                "gst_rate": "18.00",
                "total_amount": "354.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/sales/orders/", json=payload, headers=headers)
        resp = await client.get(f"/api/v1/sales/orders/{soid}", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == soid
    assert body["order_no"] == f"ORD-GET-{suffix}"


async def test_get_nonexistent_order_returns_404(db_session):
    """Fetching a non-existent order returns 404."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/sales/orders/nonexistent-order-xyz", headers=headers)

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Sales Return Tests
# ---------------------------------------------------------------------------

async def test_create_sales_return_as_cashier(db_session):
    """A CASHIER can create a sales return against an existing invoice."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    customer = await _make_customer(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id, stock=10)
    invoice = await _make_invoice(
        db_session, suffix, company.id, branch.id, product.id, customer.id
    )
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"ret-{suffix}",
        "return_no": f"RET-{suffix}",
        "original_invoice_id": invoice.id,
        "credit_note_number": f"CN-{suffix}",
        "reason": "Damaged product",
        "status": "processed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "118.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["return_no"] == f"RET-{suffix}"
    assert Decimal(body["tax_total"]) == Decimal("18.00")
    assert Decimal(body["grand_total"]) == Decimal("118.00")


async def test_create_sales_return_missing_invoice_returns_404(db_session):
    """Creating a return against a non-existent invoice returns 404."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"ret-noinv-{suffix}",
        "return_no": f"RET-NOINV-{suffix}",
        "original_invoice_id": "nonexistent-invoice-id",
        "reason": "Test",
        "status": "processed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "118.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)

    assert resp.status_code == 404


async def test_create_sales_return_duplicate_rejected(db_session):
    """Duplicate return number returns HTTP 400."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    customer = await _make_customer(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id, stock=10)
    invoice = await _make_invoice(
        db_session, suffix, company.id, branch.id, product.id, customer.id
    )
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"ret-d1-{suffix}",
        "return_no": f"RET-DUP-{suffix}",
        "original_invoice_id": invoice.id,
        "reason": "Test duplicate",
        "status": "processed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "118.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
        assert r1.status_code == 201, r1.text

        payload["id"] = f"ret-d2-{suffix}"
        r2 = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)

    assert r2.status_code == 400


async def test_list_sales_returns(db_session):
    """Listing returns returns existing records for the tenant."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    customer = await _make_customer(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id, stock=10)
    invoice = await _make_invoice(
        db_session, suffix, company.id, branch.id, product.id, customer.id
    )
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"ret-list-{suffix}",
        "return_no": f"RET-LIST-{suffix}",
        "original_invoice_id": invoice.id,
        "reason": "Listing test",
        "status": "processed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "118.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
        resp = await client.get("/api/v1/sales/returns/", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert any(r["return_no"] == f"RET-LIST-{suffix}" for r in body)


async def test_get_sales_return_by_id(db_session):
    """Fetch a specific sales return by ID returns correct data."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    customer = await _make_customer(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id, stock=10)
    invoice = await _make_invoice(
        db_session, suffix, company.id, branch.id, product.id, customer.id
    )
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    retid = f"ret-get-{suffix}"
    payload = {
        "id": retid,
        "return_no": f"RET-GET-{suffix}",
        "original_invoice_id": invoice.id,
        "reason": "Get test",
        "status": "processed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "5.00",
                "total_amount": "105.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
        resp = await client.get(f"/api/v1/sales/returns/{retid}", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == retid
    assert body["return_no"] == f"RET-GET-{suffix}"


async def test_get_nonexistent_return_returns_404(db_session):
    """Fetching a non-existent return returns 404."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/sales/returns/nonexistent-return-xyz", headers=headers)

    assert resp.status_code == 404


async def test_sales_return_increments_stock(db_session):
    """Creating a sales return increments the product's stock level."""
    suffix = uuid.uuid4().hex[:8]
    company, branch = await _make_tenant(db_session, suffix)
    user = await _make_cashier(db_session, suffix, company.id, branch.id)
    customer = await _make_customer(db_session, suffix, company.id, branch.id)
    product = await _make_product(db_session, suffix, company.id, branch.id, stock=5)
    invoice = await _make_invoice(
        db_session, suffix, company.id, branch.id, product.id, customer.id
    )
    _set_tenant(company.id, branch.id)
    headers = _bearer(user, company.id, branch.id)

    payload = {
        "id": f"ret-stk-{suffix}",
        "return_no": f"RET-STK-{suffix}",
        "original_invoice_id": invoice.id,
        "reason": "Stock increment test",
        "status": "processed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "2.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "236.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text

    # Refresh and verify stock increased by 2 (5 + 2 = 7)
    await db_session.refresh(product)
    assert product.stock == 7

    # Verify StockMovement was recorded
    movement_stmt = select(StockMovement).where(StockMovement.reference_doc_id == f"ret-stk-{suffix}")
    movement_res = await db_session.execute(movement_stmt)
    movement = movement_res.scalars().first()
    assert movement is not None
    assert Decimal(movement.quantity) == Decimal("2.00")
    assert movement.movement_type == "IN"
    assert movement.reference_doc_type == "Sales Return"
    assert movement.source_module == "Sales"


# ---------------------------------------------------------------------------
# Phase 2 --- UPDATE / DELETE / CANCEL tests
# ---------------------------------------------------------------------------

async def _make_manager(db_session, suffix, company_id, branch_id):
    from app.models.auth import User, UserRole
    from app.core.security import hash_password
    user = User(
        id=f"usr-mgr-{suffix}", username=f"mgr_{suffix}",
        hashed_password=hash_password("Mgr@12345"),
        role=UserRole.MANAGER,
        company_id=company_id, branch_id=branch_id,
        is_active=True, is_deleted=False,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def test_update_sales_invoice_status(db_session):
    import uuid
    from decimal import Decimal
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    product = await _make_product(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.put(
            f"/api/v1/sales/{invoice.id}",
            json={"status": "Submitted"},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "Submitted"


async def test_update_sales_invoice_replaces_items(db_session):
    import uuid
    from decimal import Decimal
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    product = await _make_product(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)
    new_items = [{"product_id": product.id, "code": product.code, "name": product.name,
                  "quantity": "3", "price": "200.00", "gst_rate": "0.00",
                  "tax_amount": "0.00", "total_amount": "600.00"}]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.put(
            f"/api/v1/sales/{invoice.id}",
            json={"items": new_items},
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["items"]) == 1
    assert Decimal(data["grand_total"]) == Decimal("600.00")


async def test_cancel_sales_invoice(db_session):
    import uuid
    from sqlalchemy.future import select
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.models.sales import SalesInvoice
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    product = await _make_product(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.delete(
            f"/api/v1/sales/{invoice.id}",
            headers=_bearer(mgr, comp.id, br.id),
        )
    assert res.status_code == 200, res.text
    assert res.json()["success"] is True
    result = await db_session.execute(select(SalesInvoice).where(SalesInvoice.id == invoice.id))
    updated = result.scalars().first()
    assert updated.is_deleted is True
    assert updated.status == "Cancelled"


async def test_cancel_nonexistent_invoice_returns_404(db_session):
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.delete("/api/v1/sales/does-not-exist", headers=_bearer(mgr, comp.id, br.id))
    assert res.status_code == 404


async def test_update_and_delete_quotation(db_session):
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    _set_tenant(comp.id, br.id)
    q_id = f"qt-{s}"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/sales/quotations/",
            json={"id": q_id, "quotation_no": f"QT-{s}", "customer_name": "TC", "status": "Draft",
                  "items": [{"product_id": product.id, "code": product.code, "name": product.name,
                              "quantity": "1", "price": "100.00", "gst_rate": "0.00",
                              "tax_amount": "0.00", "total_amount": "100.00"}]},
            headers=_bearer(cashier, comp.id, br.id))
        assert r.status_code == 201
        put_res = await c.put(f"/api/v1/sales/quotations/{q_id}",
            json={"status": "Approved"}, headers=_bearer(mgr, comp.id, br.id))
        assert put_res.status_code == 200
        assert put_res.json()["status"] == "Approved"
        assert (await c.delete(f"/api/v1/sales/quotations/{q_id}",
            headers=_bearer(mgr, comp.id, br.id))).status_code == 204
        assert (await c.get(f"/api/v1/sales/quotations/{q_id}",
            headers=_bearer(mgr, comp.id, br.id))).status_code == 404


async def test_update_and_delete_sales_order(db_session):
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    _set_tenant(comp.id, br.id)
    so_id = f"so-{s}"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/sales/orders/",
            json={"id": so_id, "order_no": f"SO-{s}", "customer_name": "OC", "status": "Draft",
                  "items": [{"product_id": product.id, "code": product.code, "name": product.name,
                              "quantity": "2", "price": "50.00", "gst_rate": "0.00",
                              "tax_amount": "0.00", "total_amount": "100.00"}]},
            headers=_bearer(cashier, comp.id, br.id))
        assert r.status_code == 201
        put_res = await c.put(f"/api/v1/sales/orders/{so_id}",
            json={"status": "Confirmed"}, headers=_bearer(mgr, comp.id, br.id))
        assert put_res.status_code == 200
        assert put_res.json()["status"] == "Confirmed"
        assert (await c.delete(f"/api/v1/sales/orders/{so_id}",
            headers=_bearer(mgr, comp.id, br.id))).status_code == 204
        assert (await c.get(f"/api/v1/sales/orders/{so_id}",
            headers=_bearer(mgr, comp.id, br.id))).status_code == 404


async def test_update_and_delete_sales_return(db_session):
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    mgr = await _make_manager(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)
    sr_id = f"sr-{s}"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/sales/returns/",
            json={"id": sr_id, "return_no": f"SR-{s}",
                  "original_invoice_id": invoice.id, "status": "Draft",
                  "items": [{"product_id": product.id, "code": product.code, "name": product.name,
                              "quantity": "1", "price": "100.00", "gst_rate": "0.00",
                              "tax_amount": "0.00", "total_amount": "100.00"}]},
            headers=_bearer(cashier, comp.id, br.id))
        assert r.status_code == 201
        put_res = await c.put(f"/api/v1/sales/returns/{sr_id}",
            json={"status": "Processed"}, headers=_bearer(mgr, comp.id, br.id))
        assert put_res.status_code == 200
        assert put_res.json()["status"] == "Processed"
        assert (await c.delete(f"/api/v1/sales/returns/{sr_id}",
            headers=_bearer(mgr, comp.id, br.id))).status_code == 204
        assert (await c.get(f"/api/v1/sales/returns/{sr_id}",
            headers=_bearer(mgr, comp.id, br.id))).status_code == 404


async def test_cashier_cannot_delete_invoice(db_session):
    import uuid
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.delete(
            f"/api/v1/sales/{invoice.id}",
            headers=_bearer(cashier, comp.id, br.id),
        )
    assert res.status_code == 403


# ─────────────────────────── Phase 4A Contract URL Tests ───────────────────────────

async def test_list_invoices_contract_url(db_session):
    """Contract URL GET /api/v1/sales/invoices must return a list."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"s4a{s}")
    cashier = await _make_cashier(db_session, f"s4a{s}", comp.id, br.id)
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/sales/invoices", headers=_bearer(cashier, comp.id, br.id))
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


async def test_list_quotations_contract_url(db_session):
    """Contract URL GET /api/v1/sales/quotations/ must return a list."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"s4b{s}")
    cashier = await _make_cashier(db_session, f"s4b{s}", comp.id, br.id)
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/sales/quotations/", headers=_bearer(cashier, comp.id, br.id))
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


async def test_list_returns_contract_url(db_session):
    """Contract URL GET /api/v1/sales/returns/ must return a list."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"s4c{s}")
    cashier = await _make_cashier(db_session, f"s4c{s}", comp.id, br.id)
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/sales/returns/", headers=_bearer(cashier, comp.id, br.id))
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


# ─────────────────────────── Phase 4B Tests ───────────────────────────

async def test_workflow_approve_sales_invoice(db_session):
    """POST /workflow/SalesInvoice/{id}/approve promotes Draft -> Confirmed."""
    import uuid as _u
    from app.models.sales import SalesInvoice
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"wf{s}")
    manager = await _make_manager(db_session, f"wfm{s}", comp.id, br.id)
    invoice = SalesInvoice(
        id=f"inv-wf-{s}", invoice_no=f"INV-WF-{s}",
        payment_mode="Cash", status="Draft",
        tax_total="0", grand_total="100",
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(invoice)
    await db_session.commit()
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/workflow/SalesInvoice/{invoice.id}/approve",
            headers=_bearer(manager, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Confirmed"
    assert r.json()["invoice_id"] == invoice.id


async def test_workflow_cancel_sales_invoice(db_session):
    """POST /workflow/SalesInvoice/{id}/cancel cancels a Draft invoice."""
    import uuid as _u
    from app.models.sales import SalesInvoice
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"wfc{s}")
    manager = await _make_manager(db_session, f"wfcm{s}", comp.id, br.id)
    invoice = SalesInvoice(
        id=f"inv-wfc-{s}", invoice_no=f"INV-WFC-{s}",
        payment_mode="Cash", status="Draft",
        tax_total="0", grand_total="50",
        company_id=comp.id, branch_id=br.id,
    )
    db_session.add(invoice)
    await db_session.commit()
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/workflow/SalesInvoice/{invoice.id}/cancel",
            headers=_bearer(manager, comp.id, br.id),
        )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Cancelled"


async def test_convert_quotation_to_invoice(db_session):
    """POST /sales/quotations/convert/{id} creates a Draft invoice from a quotation."""
    import uuid as _u
    from app.models.sales import SalesQuotation, SalesQuotationItem
    from decimal import Decimal
    s = _u.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, f"cq{s}")
    cashier = await _make_cashier(db_session, f"cq{s}", comp.id, br.id)
    product = await _make_product(db_session, f"cq{s}", comp.id, br.id)
    # SalesQuotation: no customer_id column; use customer_name only
    q = SalesQuotation(
        id=f"quot-cq-{s}", quotation_no=f"QUOT-CQ-{s}",
        customer_name="Walk-in Customer",
        status="Draft", grand_total=Decimal("100.00"),
        company_id=comp.id, branch_id=br.id,
    )
    q_item = SalesQuotationItem(
        quotation_id=q.id,
        product_id=product.id, code=product.code, name=product.name,
        quantity=Decimal("2"), price=Decimal("50.00"),
        gst_rate=Decimal("0.00"), tax_amount=Decimal("0.00"),
        total_amount=Decimal("100.00"),
    )
    db_session.add(q)
    db_session.add(q_item)
    await db_session.commit()
    _set_tenant(comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/v1/sales/quotations/convert/{q.id}",
            headers=_bearer(cashier, comp.id, br.id),
        )
    assert r.status_code == 201, r.text
    data = r.json()
    assert "id" in data
    assert data["status"] == "Draft"
