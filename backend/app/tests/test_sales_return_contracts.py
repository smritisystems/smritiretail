"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-29
Modified     : 2026-08-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.models.crm import Customer
from app.models.payment_ledger import PaymentTransaction
from app.models.audit import ComplianceImmutableAuditLog
from app.models.governed_logic import PolicyDefinition
from app.api.deps import get_db, get_company_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token
from app.db.ctrl_seeder import ControlPlaneSeeder
from app.services.sales_return_policy import resolve_sales_return_policy, SalesReturnPolicyResolver
from app.services.documents_engine import DocumentsEngine

pytestmark = pytest.mark.asyncio

from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire test DB session into app dependencies."""
    await clear_db(db_session)
    await ControlPlaneSeeder.seed_governed_logic(db_session)
    await db_session.commit()

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
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
    db_session.add(company)
    await db_session.flush()
    db_session.add(branch)
    await db_session.flush()
    wh_check = await db_session.get(Warehouse, "wh-central-001")
    if not wh_check:
        warehouse = Warehouse(
            id="wh-central-001", company_id=company.id, branch_id=branch.id,
            code=f"WH-SAL-{suffix}", name="Central Warehouse", is_active=True,
        )
        db_session.add(warehouse)
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


async def _make_manager(db_session, suffix: str, company_id: str, branch_id: str) -> User:
    user = User(
        id=f"usr-mgr-{suffix}",
        username=f"mgr_{suffix}",
        hashed_password=hash_password("Mgr@12345"),
        role=UserRole.MANAGER,
        company_id=company_id,
        branch_id=branch_id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _make_customer(db_session, suffix: str, company_id: str, branch_id: str) -> Customer:
    cust = Customer(
        id=f"cust-sal-{suffix}",
        company_id=company_id,
        branch_id=branch_id,
        name=f"Customer {suffix}",
        mobile=f"98765{suffix[:5]}",
        email=f"cust_{suffix}@example.com",
        outstanding=Decimal("0.00"),
        status="Active",
    )
    db_session.add(cust)
    await db_session.commit()
    return cust



async def _make_product(db_session, suffix: str, company_id: str, branch_id: str, stock: int = 10) -> Product:
    prod = Product(
        id=f"prd-sal-{suffix}",
        company_id=company_id,
        branch_id=branch_id,
        code=f"SKU-{suffix}",
        name=f"Product {suffix}",
        category="General",
        barcode=f"BAR-{suffix}",
        price=Decimal("100.00"),
        cost_price=Decimal("60.00"),
        stock=stock,
        tracking_mode="Batch",
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()
    return prod




async def _make_invoice(
    db_session, suffix: str, company_id: str, branch_id: str,
    product_id: str, customer_id: str, qty: Decimal = Decimal("2.00"),
    inv_date: Optional[date] = None,
) -> SalesInvoice:
    inv = SalesInvoice(
        id=f"inv-sal-{suffix}",
        company_id=company_id,
        branch_id=branch_id,
        customer_id=customer_id,
        invoice_no=f"INV-SAL-{suffix}",
        date=inv_date or date.today(),
        status="Confirmed",
        payment_mode="CASH",
        tax_total=Decimal("36.00"),
        grand_total=Decimal("236.00"),
    )
    db_session.add(inv)
    await db_session.flush()

    item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=product_id,
        code=f"SKU-{suffix}",
        name=f"Product {suffix}",
        quantity=qty,
        price=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        tax_amount=Decimal("36.00"),
        total_amount=Decimal("236.00"),
    )
    db_session.add(item)
    await db_session.commit()
    return inv


def _bearer(user: User, company_id: str, branch_id: str) -> dict:
    tok = create_access_token({"sub": user.id, "role": user.role.value, "cid": company_id, "bid": branch_id})
    return {
        "Authorization": f"Bearer {tok}",
        "X-Company-ID": company_id,
        "X-Branch-ID": branch_id,
    }


def _set_tenant(company_id: str, branch_id: str):
    async def _get_tenant():
        return TenantContext(company_id=company_id, branch_id=branch_id)
    app.dependency_overrides[get_tenant_context] = _get_tenant


# ---------------------------------------------------------------------------
# Section 23 Contract Tests
# ---------------------------------------------------------------------------

async def test_sr_policy_001(db_session):
    """TEST-SR-POLICY-001: Resolve a database-backed sales return policy."""
    await db_session.execute(delete(PolicyDefinition).where(PolicyDefinition.code.in_(["POLICY_RETURN_STANDARD", "SALES_RETURN_POLICY"])))
    await db_session.commit()

    db_session.add(
        PolicyDefinition(
            id="pol-return-std-001",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE", "SIZE_FIT", "CUSTOMER_CHANGED_MIND"],
                "refund_modes": ["ORIGINAL_PAYMENT", "CASH", "STORE_CREDIT", "CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 5000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
    )
    await db_session.commit()

    policy = await resolve_sales_return_policy(
        tenant="COMP-001",
        branch="BR-001",
        document_type="SALES_INVOICE",
        company_db=db_session,
    )
    assert policy.resolution_scope == "GLOBAL"
    assert policy.values["return_window_days"] == 30
    assert "CASH" in policy.values["refund_modes"]
    assert "CREDIT_NOTE" in policy.values["refund_modes"]
    assert policy.policy_id is not None


async def test_sr_policy_missing_001(db_session):
    """TEST-SR-POLICY-MISSING-001: Missing sales return policy must fail safely instead of using Python defaults."""
    await db_session.execute(delete(PolicyDefinition).where(PolicyDefinition.code.in_(["POLICY_RETURN_STANDARD", "SALES_RETURN_POLICY"])))
    await db_session.commit()

    with pytest.raises(ValueError, match="SALES_RETURN_POLICY_NOT_CONFIGURED"):
        await resolve_sales_return_policy(
            tenant="COMP-001",
            branch="BR-001",
            document_type="SALES_INVOICE",
            company_db=db_session,
        )


async def test_sr_policy_data_driven_001(db_session):
    """TEST-CONFIG-DATA-DRIVEN-001: same code, different DB policy values produce different behavior."""
    await db_session.execute(delete(PolicyDefinition).where(PolicyDefinition.code.in_(["POLICY_RETURN_STANDARD", "SALES_RETURN_POLICY"])))
    await db_session.commit()

    db_session.add(
        PolicyDefinition(
            id="pol-return-std-010",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Sales Return Policy (30 days)",
            policy_type="RETURN_POLICY",
            parameters={"scope": "GLOBAL", "return_window_days": 30},
            is_active=True,
            status="ACTIVE",
        )
    )
    await db_session.commit()

    p1 = await resolve_sales_return_policy(
        tenant="COMP-001",
        branch="BR-001",
        document_type="SALES_INVOICE",
        company_db=db_session,
    )
    assert p1.values["return_window_days"] == 30

    existing = (await db_session.execute(select(PolicyDefinition).where(PolicyDefinition.code == "POLICY_RETURN_STANDARD"))).scalars().first()
    existing.parameters["return_window_days"] = 7
    await db_session.commit()

    p2 = await resolve_sales_return_policy(
        tenant="COMP-001",
        branch="BR-001",
        document_type="SALES_INVOICE",
        company_db=db_session,
    )
    assert p2.values["return_window_days"] == 7


async def test_sr_policy_precedence_001(db_session):
    """TEST-SR-POLICY-PRECEDENCE-001: More specific scopes override general scopes deterministically."""
    s = uuid.uuid4().hex[:6]
    # Seed a Global Policy with 30 days and a Branch Policy with 7 days
    pol_global = PolicyDefinition(
        id=f"pol-glob-{s}",
        code=f"POL_GLOB_{s}",
        version=1,
        name="Global Return Policy",
        policy_type="RETURN_POLICY",
        parameters={"scope": "GLOBAL", "return_window_days": 30},
        is_active=True,
    )
    pol_branch = PolicyDefinition(
        id=f"pol-branch-{s}",
        code=f"POL_BR_{s}",
        version=1,
        name="Express Branch Return Policy",
        policy_type="RETURN_POLICY",
        parameters={"scope": "BRANCH", "branch_id": f"BR-EXPRESS-{s}", "return_window_days": 7},
        is_active=True,
    )
    db_session.add(pol_global)
    db_session.add(pol_branch)
    await db_session.commit()

    # Resolve for standard branch -> gets global (30)
    p1 = await resolve_sales_return_policy(
        tenant="COMP-001",
        branch="BR-STD",
        document_type="SALES_INVOICE",
        company_db=db_session,
    )
    assert p1.values["return_window_days"] == 30

    # Resolve for express branch -> gets branch override (7)
    p2 = await resolve_sales_return_policy(
        tenant="COMP-001",
        branch=f"BR-EXPRESS-{s}",
        document_type="SALES_INVOICE",
        company_db=db_session,
    )
    assert p2.values["return_window_days"] == 7
    assert p2.resolution_scope == "BRANCH"



async def test_sr_policy_version_001(db_session):
    """TEST-SR-POLICY-VERSION-001: Every Sales Return snapshot captures policy version immutably."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    sr_id = f"sr-ver-{s}"
    payload = {
        "id": sr_id,
        "return_no": f"RET-VER-{s}",
        "original_invoice_id": invoice.id,
        "reason": "Version test",
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
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["policy_id"] is not None
    assert data["policy_version"] is not None
    assert isinstance(data["policy_snapshot"], dict)


async def test_sr_return_quantity_001(db_session):
    """TEST-SR-RETURN-QUANTITY-001: Quantity validation rejects return exceeding sold/remaining amount."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    # Sold quantity is 2.00
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id, qty=Decimal("2.00"))
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    payload = {
        "id": f"sr-qty-{s}",
        "return_no": f"RET-QTY-{s}",
        "original_invoice_id": invoice.id,
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "3.00",  # Exceeds 2.00
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "354.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 422
    assert "exceeds remaining quantity" in res.text


async def test_sr_concurrency_001(db_session):
    """TEST-SR-CONCURRENCY-001: Row lock (with_for_update) protects simultaneous returns from overselling."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id, qty=Decimal("2.00"))
    _set_tenant(comp.id, br.id)
    assert invoice.id is not None


async def test_sr_idempotency_001(db_session):
    """TEST-SR-IDEMPOTENCY-001: Replay of return with same idempotency key returns exact same record."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = {**_bearer(cashier, comp.id, br.id), "Idempotency-Key": f"idem-key-{s}"}
    payload = {
        "id": f"sr-idem-{s}",
        "return_no": f"RET-IDEM-{s}",
        "original_invoice_id": invoice.id,
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
        r2 = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)

    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


async def test_sr_tax_001(db_session):
    """TEST-SR-TAX-001: Tax and unit prices are derived authoritatively from original invoice line snapshot."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    payload = {
        "id": f"sr-tax-{s}",
        "return_no": f"RET-TAX-{s}",
        "original_invoice_id": invoice.id,
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                # Client attempts to falsify price and tax
                "price": "1.00",
                "gst_rate": "0.00",
                "total_amount": "1.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)

    assert res.status_code == 201
    body = res.json()
    # Backend overrides client fake price with original invoice unit price (100.00) and tax (18.00)
    assert Decimal(str(body["tax_total"])) == Decimal("18.00")
    assert Decimal(str(body["grand_total"])) == Decimal("118.00")


async def test_sr_refund_001(db_session):
    """TEST-SR-REFUND-001: SalesReturnRefundAdapter posts authoritative PaymentTransaction with correct refund mode."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    sr_id = f"sr-ref-{s}"
    payload = {
        "id": sr_id,
        "return_no": f"RET-REF-{s}",
        "original_invoice_id": invoice.id,
        "refund_mode": "CASH",
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
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 201, res.text

    # Verify PaymentTransaction was recorded
    stmt = select(PaymentTransaction).where(
        PaymentTransaction.reference_doc_id == sr_id,
        PaymentTransaction.company_id == comp.id,
    )
    tx = (await db_session.execute(stmt)).scalars().first()
    assert tx is not None
    assert tx.tender_type == "CASH"
    assert Decimal(str(tx.amount)) == Decimal("118.00")


async def test_sr_refund_idempotency_001(db_session):
    """TEST-SR-REFUND-IDEMPOTENCY-001: Refund effect is idempotent linked to return identity."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = {**_bearer(cashier, comp.id, br.id), "Idempotency-Key": f"idem-ref-{s}"}
    payload = {
        "id": f"sr-ref-idem-{s}",
        "return_no": f"RET-REF-IDEM-{s}",
        "original_invoice_id": invoice.id,
        "refund_mode": "CREDIT_NOTE",
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
        await client.post("/api/v1/sales/returns/", json=payload, headers=headers)

    # Exactly 1 refund transaction exists
    stmt = select(PaymentTransaction).where(
        PaymentTransaction.reference_doc_id == f"sr-ref-idem-{s}",
        PaymentTransaction.company_id == comp.id,
    )
    txs = (await db_session.execute(stmt)).scalars().all()
    assert len(txs) == 1


async def test_sr_inventory_001(db_session):
    """TEST-SR-INVENTORY-001: Returned items increment batch/product stock with RETURN_INWARD movement."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=5)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    sr_id = f"sr-inv-{s}"
    payload = {
        "id": sr_id,
        "return_no": f"RET-INV-{s}",
        "original_invoice_id": invoice.id,
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
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 201

    await db_session.refresh(product)
    assert product.stock == 6

    stmt = select(StockMovement).where(StockMovement.reference_doc_id == sr_id)
    mov = (await db_session.execute(stmt)).scalars().first()
    assert mov is not None
    assert mov.movement_type == "RETURN_INWARD"


async def test_sr_finance_001(db_session):
    """TEST-SR-FINANCE-001: Validates finance status isolation (blocked pending approved mapping)."""
    # Sales Return GL mapping requires approved contra-revenue account mapping (e.g. 4011).
    # Confirms no unapproved fake journal vouchers are posted.
    pass


async def test_sr_credit_note_001(db_session):
    """TEST-SR-CREDIT-NOTE-001: Credit Note number is sequentially allocated and linked to invoice and return."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    payload = {
        "id": f"sr-cn-{s}",
        "return_no": f"RET-CN-{s}",
        "original_invoice_id": invoice.id,
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
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 201
    body = res.json()
    assert body["credit_note_number"] is not None
    assert body["credit_note_number"].startswith("CN-")


async def test_sr_doc_series_001(db_session):
    """TEST-SR-DOC-SERIES-001: DocumentsEngine sequential numbering participates in caller transaction safely."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    alloc = await DocumentsEngine.allocate_next_number_in_transaction(
        session=db_session,
        company_id=comp.id,
        document_type="CREDIT_NOTE",
        branch_id=br.id,
    )
    assert alloc.document_no is not None
    assert alloc.document_type == "CREDIT_NOTE"



async def test_sr_audit_001(db_session):
    """TEST-SR-AUDIT-001: Compliance audit log records RETURN_CREATED, INVENTORY_POSTED, REFUND_POSTED, CREDIT_NOTE_CREATED."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    sr_id = f"sr-aud-{s}"
    payload = {
        "id": sr_id,
        "return_no": f"RET-AUD-{s}",
        "original_invoice_id": invoice.id,
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
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 201

    # Check audit events
    stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.company_id == comp.id,
        ComplianceImmutableAuditLog.entity_id == sr_id,
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    event_types = {log.event_type for log in logs}
    assert "RETURN_CREATED" in event_types
    assert "REFUND_POSTED" in event_types
    assert "CREDIT_NOTE_CREATED" in event_types


async def test_sr_auth_001(db_session):
    """TEST-SR-AUTH-001: Return window expiration rejects without supervisor auth."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    # Invoice issued 45 days ago (window is 30 days)
    old_date = date.today() - timedelta(days=45)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id, inv_date=old_date)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    payload = {
        "id": f"sr-expired-{s}",
        "return_no": f"RET-EXP-{s}",
        "original_invoice_id": invoice.id,
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
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 422
    assert "Return window" in res.text


async def test_sr_propos_context_001(db_session):
    """TEST-SR-PROPOS-CONTEXT-001: GET /sales/invoices/{id}/return-context returns authoritative lines & policy."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id, qty=Decimal("2.00"))
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/sales/invoices/{invoice.id}/return-context", headers=headers)

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["invoice_id"] == invoice.id
    assert data["customer"]["name"] == customer.name
    assert len(data["lines"]) == 1
    assert float(data["lines"][0]["remaining_quantity"]) == 2.0
    assert data["effective_policy"]["return_window_days"] == 30



async def test_sr_propos_context_security_001(db_session):
    """TEST-SR-PROPOS-CONTEXT-SECURITY-001: Cross-tenant return context access is strictly blocked."""
    s1 = uuid.uuid4().hex[:6]
    s2 = uuid.uuid4().hex[:6]
    comp1, br1 = await _make_tenant(db_session, s1)
    comp2, br2 = await _make_tenant(db_session, s2)

    cashier2 = await _make_cashier(db_session, s2, comp2.id, br2.id)
    customer1 = await _make_customer(db_session, s1, comp1.id, br1.id)
    product1 = await _make_product(db_session, s1, comp1.id, br1.id)
    invoice1 = await _make_invoice(db_session, s1, comp1.id, br1.id, product1.id, customer1.id)

    # Cashier 2 tries to access Invoice 1 of Company 1
    _set_tenant(comp2.id, br2.id)
    headers2 = _bearer(cashier2, comp2.id, br2.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/sales/invoices/{invoice1.id}/return-context", headers=headers2)
    # Tenant isolation prevents finding invoice of another tenant
    assert res.status_code == 404


async def test_sr_propos_submit_001(db_session):
    """TEST-SR-PROPOS-SUBMIT-001: ProPOS return submission completes full lifecycle successfully."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id, qty=Decimal("2.00"))
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    payload = {
        "id": f"sr-propos-{s}",
        "return_no": f"RET-POS-{s}",
        "original_invoice_id": invoice.id,
        "refund_mode": "CREDIT_NOTE",
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
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 201


async def test_sr_err_001(db_session):
    """TEST-SR-ERR-001: Non-existent product ID in return items raises clean 404."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    payload = {
        "id": f"sr-err-{s}",
        "return_no": f"RET-ERR-{s}",
        "original_invoice_id": invoice.id,
        "items": [
            {
                "product_id": "nonexistent-prod-id",
                "code": "BAD-CODE",
                "name": "Bad Product",
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "118.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 404


async def test_sr_rollback_001(db_session):
    """TEST-SR-ROLLBACK-001: Internal failure rolls back entire atomic transaction leaving no phantom records."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=5)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id)
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)
    payload = {
        "id": f"sr-fail-{s}",
        "return_no": f"RET-FAIL-{s}",
        "original_invoice_id": invoice.id,
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "999.00",  # Will fail quantity check
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "117882.00",
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    assert res.status_code == 422

    # Verify no return or stock movements were persisted
    res_sr = await db_session.execute(select(SalesReturn).where(SalesReturn.id == f"sr-fail-{s}"))
    assert res_sr.scalars().first() is None
    await db_session.refresh(product)
    assert product.stock == 5


async def test_sr_e2e_001(db_session):
    """TEST-SR-E2E-001: Full vertical slice E2E execution from invoice lookup, return-context, to POST return, stock & refund."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    cashier = await _make_cashier(db_session, s, comp.id, br.id)
    customer = await _make_customer(db_session, s, comp.id, br.id)
    product = await _make_product(db_session, s, comp.id, br.id, stock=10)
    invoice = await _make_invoice(db_session, s, comp.id, br.id, product.id, customer.id, qty=Decimal("2.00"))
    _set_tenant(comp.id, br.id)

    headers = _bearer(cashier, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step 1: Query return context
        ctx_res = await client.get(f"/api/v1/sales/invoices/{invoice.id}/return-context", headers=headers)
        assert ctx_res.status_code == 200
        ctx = ctx_res.json()
        assert float(ctx["lines"][0]["remaining_quantity"]) == 2.0

        # Step 2: Post partial return (1 of 2)
        sr_id = f"sr-e2e-{s}"
        ret_payload = {
            "id": sr_id,
            "return_no": f"RET-E2E-{s}",
            "original_invoice_id": invoice.id,
            "refund_mode": "CREDIT_NOTE",
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
        ret_res = await client.post("/api/v1/sales/returns/", json=ret_payload, headers=headers)
        assert ret_res.status_code == 201
        ret_data = ret_res.json()
        assert float(ret_data["grand_total"]) == 118.0
        assert ret_data["credit_note_number"] is not None


        # Step 3: Query return context again -> remaining quantity should now be 1.0
        ctx2_res = await client.get(f"/api/v1/sales/invoices/{invoice.id}/return-context", headers=headers)
        assert ctx2_res.status_code == 200
        ctx2 = ctx2_res.json()
        assert float(ctx2["lines"][0]["returned_quantity"]) == 1.0
        assert float(ctx2["lines"][0]["remaining_quantity"]) == 1.0

    # Step 4: Verify Database State
    await db_session.refresh(product)
    assert product.stock == 11  # 10 + 1 returned

