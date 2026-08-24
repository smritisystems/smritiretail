"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db


from contextvars import ContextVar

_current_test_tenant: ContextVar[TenantContext | None] = ContextVar("_current_test_tenant", default=None)


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    async def _get_tenant():
        ctx = _current_test_tenant.get()
        if ctx:
            return ctx
        return TenantContext(company_id="comp-def", branch_id="br-def")

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_tenant_context] = _get_tenant
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        _current_test_tenant.set(None)
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _setup_tenant_and_user(db_session, suffix="pag"):
    comp = Company(id=f"comp-{suffix}", name=f"Company {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-{suffix}", company_id=comp.id, name=f"Branch {suffix}", code=f"BR-{suffix}", is_active=True)
    user = User(
        id=f"usr-{suffix}",
        username=f"usr_{suffix}",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.MANAGER,
        company_id=comp.id,
        branch_id=br.id,
        is_active=True,
        is_deleted=False
    )
    db_session.add_all([comp, br, user])
    await db_session.commit()

    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": comp.id,
        "branch_id": br.id,
        "jti": str(uuid.uuid4()),
        "type": "access"
    })

    _current_test_tenant.set(TenantContext(company_id=comp.id, branch_id=br.id))

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": comp.id,
        "X-Branch-ID": br.id
    }

    return comp, br, user, headers


async def _seed_products(db_session, comp_id, br_id, count=30, suffix="pag"):
    products = []
    for i in range(1, count + 1):
        cat = "Apparel" if i % 2 == 0 else "Footwear"
        p = Product(
            id=f"prod-{suffix}-{i:03d}",
            code=f"SKU-{suffix}-{i:03d}",
            name=f"Product {i:03d} {'Sneaker' if i % 3 == 0 else 'T-Shirt'}",
            category=cat,
            price=Decimal(f"{i * 10}.00"),
            stock=i * 5,
            barcode=f"BC-{suffix}-{i:04d}",
            brand="SmritiBrand",
            company_id=comp_id,
            branch_id=br_id,
            is_deleted=False
        )
        products.append(p)
    db_session.add_all(products)
    await db_session.commit()
    return products


@pytest.mark.asyncio
async def test_default_pagination(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "def")
    await _seed_products(db_session, comp.id, br.id, count=30)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["page"] == 1
        assert data["page_size"] == 25
        assert data["total"] == 30
        assert data["total_pages"] == 2
        assert data["has_next"] is True
        assert data["has_prev"] is False
        assert len(data["items"]) == 25


@pytest.mark.asyncio
async def test_custom_page_and_page_size(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "cust")
    await _seed_products(db_session, comp.id, br.id, count=30)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/?page=2&page_size=10", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["page"] == 2
        assert data["page_size"] == 10
        assert data["total"] == 30
        assert data["total_pages"] == 3
        assert data["has_next"] is True
        assert data["has_prev"] is True
        assert len(data["items"]) == 10


@pytest.mark.asyncio
async def test_last_page_has_next_false(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "last")
    await _seed_products(db_session, comp.id, br.id, count=30)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/?page=3&page_size=10", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["page"] == 3
        assert data["has_next"] is False
        assert data["has_prev"] is True
        assert len(data["items"]) == 10


@pytest.mark.asyncio
async def test_search_and_pagination(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "srch")
    await _seed_products(db_session, comp.id, br.id, count=30)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/?q=Sneaker&page=1&page_size=5", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # 30 items, every 3rd item is Sneaker -> 10 total
        assert data["total"] == 10
        assert data["total_pages"] == 2
        assert len(data["items"]) == 5
        assert all("Sneaker" in item["name"] for item in data["items"])


@pytest.mark.asyncio
async def test_category_filter_and_pagination(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "cat")
    await _seed_products(db_session, comp.id, br.id, count=30)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/?category=Apparel&page=1&page_size=10", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # 15 Apparel items
        assert data["total"] == 15
        assert data["total_pages"] == 2
        assert len(data["items"]) == 10
        assert all(item["category"] == "Apparel" for item in data["items"])


@pytest.mark.asyncio
async def test_sort_ascending_and_descending(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "sort")
    await _seed_products(db_session, comp.id, br.id, count=10)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Ascending
        res_asc = await client.get("/api/v1/products/?sort=price&order=asc&page=1&page_size=10", headers=headers)
        assert res_asc.status_code == 200
        items_asc = res_asc.json()["items"]
        prices_asc = [float(p["price"]) for p in items_asc]
        assert prices_asc == sorted(prices_asc)

        # Descending
        res_desc = await client.get("/api/v1/products/?sort=price&order=desc&page=1&page_size=10", headers=headers)
        assert res_desc.status_code == 200
        items_desc = res_desc.json()["items"]
        prices_desc = [float(p["price"]) for p in items_desc]
        assert prices_desc == sorted(prices_desc, reverse=True)


@pytest.mark.asyncio
async def test_invalid_page_and_page_size_validation(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "val")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # page < 1
        res1 = await client.get("/api/v1/products/?page=0", headers=headers)
        assert res1.status_code == 422

        # page_size > 100
        res2 = await client.get("/api/v1/products/?page_size=101", headers=headers)
        assert res2.status_code == 422


@pytest.mark.asyncio
async def test_unknown_sort_field_fallback(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "sortfb")
    await _seed_products(db_session, comp.id, br.id, count=5)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/?sort=non_existent_column&order=asc", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 5


@pytest.mark.asyncio
async def test_empty_result_set(db_session):
    comp, br, user, headers = await _setup_tenant_and_user(db_session, "empty")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/?q=NonExistentQuery", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["total"] == 0
        assert data["total_pages"] == 0
        assert data["has_next"] is False
        assert data["has_prev"] is False
        assert data["items"] == []


@pytest.mark.asyncio
async def test_tenant_isolation_in_pagination(db_session):
    comp_a, br_a, user_a, headers_a = await _setup_tenant_and_user(db_session, "tnt_a")
    comp_b, br_b, user_b, headers_b = await _setup_tenant_and_user(db_session, "tnt_b")

    await _seed_products(db_session, comp_a.id, br_a.id, count=10, suffix="tnt_a")
    await _seed_products(db_session, comp_b.id, br_b.id, count=5, suffix="tnt_b")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Tenant A sees only 10 items
        _current_test_tenant.set(TenantContext(company_id=comp_a.id, branch_id=br_a.id))
        res_a = await client.get("/api/v1/products/", headers=headers_a)
        assert res_a.status_code == 200
        assert res_a.json()["total"] == 10

        # Tenant B sees only 5 items
        _current_test_tenant.set(TenantContext(company_id=comp_b.id, branch_id=br_b.id))
        res_b = await client.get("/api/v1/products/", headers=headers_b)
        assert res_b.status_code == 200
        assert res_b.json()["total"] == 5
