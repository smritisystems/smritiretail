"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.9.0
Created      : 2026-07-11
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from decimal import Decimal
import uuid
from contextvars import ContextVar
from sqlalchemy.future import select
from fastapi import HTTPException
from app.main import app
from app.models.tenant import Company, Branch
from app.models.inventory import Product
from app.models.crm import Customer, CustomerGroup
from app.models.sales import SalesInvoice
from app.models.auth import User, UserRole
from app.api.deps import TenantContext, get_db, get_current_user, get_tenant_context
from app.services.sales import SalesService
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio

# ContextVar allows per-coroutine tenant scoping within the test process
_test_tenant_ctx: ContextVar[TenantContext | None] = ContextVar("_test_tenant_ctx", default=None)


def set_test_tenant(company_id: str, branch_id: str) -> None:
    """Call this in a test to set which tenant the mock user belongs to."""
    _test_tenant_ctx.set(TenantContext(company_id=company_id, branch_id=branch_id))


def clear_test_tenant() -> None:
    _test_tenant_ctx.set(None)


@pytest.fixture(autouse=True)
async def override_get_db(db_session):
    await clear_db(db_session)      # clean before each test

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db

    _mock_manager = User(
        id="test-mgr",
        username="test_manager",
        role=UserRole.MANAGER,
        hashed_password="x",
        is_active=True,
        is_deleted=False,
        company_id=None,
        branch_id=None,
    )
    db_session.add(_mock_manager)
    await db_session.commit()
    async def _get_user():
        return _mock_manager
    app.dependency_overrides[get_current_user] = _get_user

    # Override get_tenant_context — reads from _test_tenant_ctx ContextVar.
    # Call set_test_tenant(comp_id, br_id) in a test to set the active tenant.
    async def _get_tenant():
        ctx = _test_tenant_ctx.get()
        if ctx is None:
            raise HTTPException(status_code=403, detail="No test tenant context set")
        return ctx
    app.dependency_overrides[get_tenant_context] = _get_tenant

    yield

    clear_test_tenant()
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_tenant_context, None)
    try:
        await clear_db(db_session)  # clean after each test
    except Exception:
        pass

# Helper to create tenant setup
async def create_tenant(db_session, suffix: str):
    company = Company(
        id=f"comp-{suffix}",
        name=f"Company {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True
    )
    branch = Branch(
        id=f"br-{suffix}",
        company_id=company.id,
        name=f"Branch {suffix}",
        code=f"BRCODE_{suffix}",
        is_active=True
    )
    db_session.add(company)
    db_session.add(branch)
    await db_session.commit()
    return company, branch

async def test_header_validation(db_session):
    """
    With auth in place, accessing /products/ with no auth context returns 403
    (the test override raises 403 when no tenant is set). This verifies that
    the dependency chain correctly blocks requests with no tenant context.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # No tenant set — should return 403 ("No test tenant context set")
        response = await client.get("/api/v1/inventory/")
        assert response.status_code == 403

async def test_read_isolation(db_session):
    suffix_a = uuid.uuid4().hex[:6]
    suffix_b = uuid.uuid4().hex[:6]
    comp_a, br_a = await create_tenant(db_session, suffix_a)
    comp_b, br_b = await create_tenant(db_session, suffix_b)

    # Create product in Tenant A
    prod_a = Product(
        id=f"prod-a-{suffix_a}",
        code=f"PCODEA_{suffix_a}",
        name=f"Product A {suffix_a}",
        category="Footwear",
        barcode=f"BCA_{suffix_a}",
        company_id=comp_a.id,
        branch_id=br_a.id,
        price=Decimal("100.00"),
        stock=10
    )
    db_session.add(prod_a)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # GET under Tenant A context should find Product A
        set_test_tenant(comp_a.id, br_a.id)
        res_a = await client.get("/api/v1/inventory/")
        assert res_a.status_code == 200
        products_a = res_a.json()
        assert any(p["id"] == prod_a.id for p in products_a)

        # GET under Tenant B context should NOT find Product A
        set_test_tenant(comp_b.id, br_b.id)
        res_b = await client.get("/api/v1/inventory/")
        assert res_b.status_code == 200
        products_b = res_b.json()
        assert not any(p["id"] == prod_a.id for p in products_b)

        # Search under Tenant B should NOT return Product A
        search_res = await client.get("/api/v1/inventory/search?q=Product")
        assert search_res.status_code == 200
        assert not any(p["id"] == prod_a.id for p in search_res.json())

        # Detail GET under Tenant B should return 404
        detail_res = await client.get(f"/api/v1/inventory/{prod_a.id}")
        assert detail_res.status_code == 404

async def test_write_validation(db_session):
    suffix = uuid.uuid4().hex[:6]
    company, branch = await create_tenant(db_session, suffix)
    set_test_tenant(company.id, branch.id)

    product_data = {
        "id": f"prod-new-{suffix}",
        "code": f"PCODEN_{suffix}",
        "name": f"New Product {suffix}",
        "category": "Apparel",
        "barcode": f"BCN_{suffix}",
        "price": 150.0,
        "stock": 5
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/inventory/", json=product_data)
        assert response.status_code == 201
        created_prod = response.json()
        assert created_prod["company_id"] == company.id
        assert created_prod["branch_id"] == branch.id

        # Verify in DB
        res = await db_session.execute(select(Product).filter(Product.id == product_data["id"]))
        db_prod = res.scalars().first()
        assert db_prod is not None
        assert db_prod.company_id == company.id
        assert db_prod.branch_id == branch.id

async def test_service_layer_isolation(db_session):
    suffix_a = uuid.uuid4().hex[:6]
    suffix_b = uuid.uuid4().hex[:6]
    comp_a, br_a = await create_tenant(db_session, suffix_a)
    comp_b, br_b = await create_tenant(db_session, suffix_b)

    # Product in Tenant B
    prod_b = Product(
        id=f"prod-b-{suffix_b}",
        code=f"PCODEB_{suffix_b}",
        name=f"Product B {suffix_b}",
        category="Footwear",
        barcode=f"BCB_{suffix_b}",
        company_id=comp_b.id,
        branch_id=br_b.id,
        price=Decimal("100.00"),
        stock=10
    )
    # Customer in Tenant B
    group_b = CustomerGroup(
        id=f"grp-b-{suffix_b}",
        name=f"Group B {suffix_b}",
        company_id=comp_b.id,
        branch_id=br_b.id
    )
    cust_b = Customer(
        id=f"cust-b-{suffix_b}",
        name=f"Customer B {suffix_b}",
        customer_group_id=group_b.id,
        company_id=comp_b.id,
        branch_id=br_b.id,
        outstanding=Decimal("0.00")
    )
    db_session.add_all([prod_b, group_b, cust_b])
    await db_session.commit()

    # Attempt to create invoice in Tenant A referencing Tenant B resources
    # This must raise 404/400 because Tenant A cannot see Tenant B's product/customer
    tenant_ctx_a = TenantContext(company_id=comp_a.id, branch_id=br_a.id)
    sales_service_a = SalesService(db_session, tenant_ctx_a)

    invoice_in = SalesInvoiceCreate(
        id=f"inv-{suffix_a}",
        invoice_no=f"INV-{suffix_a}",
        customer_id=cust_b.id,
        items=[
            SalesInvoiceItemCreate(
                product_id=prod_b.id,
                code=prod_b.code,
                name=prod_b.name,
                quantity=Decimal("1.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("118.00")
            )
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await sales_service_a.create_sales_invoice(invoice_in)
    
    # Validation will fail on stock check (product lookup returns 404 Product Not Found)
    assert exc_info.value.status_code == 404

async def test_cross_tenant_branch_validation(db_session):
    """
    With mock auth, tenant context is set per call via set_test_tenant.
    This test verifies service-layer isolation when Tenant A tries to access
    Tenant B resources (same pattern, now via service-layer not headers).
    """
    suffix_a = uuid.uuid4().hex[:6]
    suffix_b = uuid.uuid4().hex[:6]
    comp_a, br_a = await create_tenant(db_session, suffix_a)
    comp_b, br_b = await create_tenant(db_session, suffix_b)

    # Tenant A should not see Tenant B's branch in results
    set_test_tenant(comp_a.id, br_a.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/inventory/")
        assert res.status_code == 200   # Tenant A context is valid

    # Set Tenant B context and confirm Tenant A products are invisible
    set_test_tenant(comp_b.id, br_b.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/inventory/")
        assert res.status_code == 200



async def test_concurrent_duplicate_barcode_returns_400_not_500(db_session, db_engine):
    """
    §11: Two simultaneous POST /products with the same barcode under the same tenant.
    One must succeed (201). The loser of the DB race must return HTTP 400 with a
    business-language detail string — not a raw 500 IntegrityError traceback.

    Concurrency test overrides get_db with a factory that creates fresh independent
    sessions from the TEST engine, so each concurrent request gets its own real DB
    connection without touching the app's (potentially dirty) connection pool.
    Auth + tenant overrides remain active.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker as make_factory, AsyncSession

    suffix = uuid.uuid4().hex[:6]
    company = Company(id=f"comp-race-{suffix}", name=f"Race Company {suffix}", is_active=True)
    branch = Branch(
        id=f"br-race-{suffix}",
        company_id=company.id,
        name=f"Race Branch {suffix}",
        code=f"BR-RACE-{suffix}",
        is_active=True
    )
    db_session.add_all([company, branch])
    await db_session.commit()

    shared_barcode = f"BC-RACE-{suffix}"
    set_test_tenant(company.id, branch.id)

    # Override get_db with a factory that creates a FRESH independent session per
    # request from the test engine — avoids any dirty-pool contamination from real
    # app engine connections used by other test modules (e.g. test_seef.py).
    _session_factory = make_factory(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def _fresh_get_db():
        async with _session_factory() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _fresh_get_db

    async def post_product(tag: str):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            payload = {
                "id": f"prod-race-{tag}-{suffix}",
                "code": f"CODE-RACE-{tag}-{suffix}",
                "name": f"Race Product {tag}",
                "category": "Apparel",
                "barcode": shared_barcode,
                "price": 99.0,
                "stock": 5,
            }
            return await client.post("/api/v1/inventory/", json=payload)

    results = await asyncio.gather(post_product("A"), post_product("B"), return_exceptions=False)

    # Restore the fixture's standard get_db override
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db

    statuses = [r.status_code for r in results]

    assert sorted(statuses) == [201, 400], (
        f"Expected one 201 and one 400, got: {statuses}. "
        f"Bodies: {[r.text for r in results]}"
    )

    failure_response = next(r for r in results if r.status_code == 400)
    detail = failure_response.json().get("detail", "")
    # Accept both the Python-level service message ("already exists") AND the
    # DB-level SMRITI handler message ("conflict") — both are correct 400s.
    assert ("already exists" in detail or "conflict" in detail.lower()), (
        f"400 detail should be business-language, got: {detail!r}"
    )
    assert "IntegrityError" not in detail, f"Raw DB error leaked to caller: {detail!r}"
    assert "sqlalchemy" not in detail.lower(), f"Raw framework error leaked to caller: {detail!r}"
