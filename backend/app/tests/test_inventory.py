"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    Wire the test DB session into the app and clean all tables
    before and after each test.
    """
    await clear_db(db_session)

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


async def _make_tenant(db_session, suffix):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    comp = Company(id=f"comp-inv-{s}", name=f"Inv Co {s}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-inv-{s}", company_id=comp.id,
                   name=f"Inv Br {s}", code=f"BRINV-{s}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    user = User(
        id=f"usr-inv-{s}", username=f"usr_inv_{s}",
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


@pytest.mark.asyncio
async def test_soft_delete_product_success(db_session):
    # Setup tenant, user, headers
    comp, br = await _make_tenant(db_session, "s1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create a product to delete
    prod_id = f"prod-del-{uuid.uuid4().hex[:6]}"
    product = Product(
        id=prod_id,
        code=f"P-DEL-{uuid.uuid4().hex[:4]}",
        name="Test Product for Deletion",
        price=100.0,
        stock=10,
        category="General",
        barcode=f"BC-{uuid.uuid4().hex[:8]}",
        company_id=comp.id,
        branch_id=br.id,
        is_deleted=False
    )
    db_session.add(product)
    await db_session.commit()

    # Call API to delete the product
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.delete(f"/api/v1/products/{prod_id}", headers=headers)
        assert res.status_code == 200
        assert res.json() == {"success": True, "message": "Product deleted successfully"}

    # Verify database state
    await db_session.refresh(product)
    assert product.is_deleted is True
    assert product.deleted_by == manager.id
    assert product.deleted_at is not None


@pytest.mark.asyncio
async def test_soft_delete_product_unauthorized_role(db_session):
    # Setup tenant, cashier user, headers
    comp, br = await _make_tenant(db_session, "s2")
    cashier = await _make_user(db_session, "csh", comp.id, br.id, role=UserRole.CASHIER)
    headers = _bearer(cashier, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create a product to delete
    prod_id = f"prod-fail-{uuid.uuid4().hex[:6]}"
    product = Product(
        id=prod_id,
        code=f"P-FAIL-{uuid.uuid4().hex[:4]}",
        name="Test Product Fail",
        price=50.0,
        stock=5,
        category="General",
        barcode=f"BC-{uuid.uuid4().hex[:8]}",
        company_id=comp.id,
        branch_id=br.id,
        is_deleted=False
    )
    db_session.add(product)
    await db_session.commit()

    # Call API to delete the product (expect 403 Forbidden)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.delete(f"/api/v1/products/{prod_id}", headers=headers)
        assert res.status_code == 403

    # Verify database state remains active
    await db_session.refresh(product)
    assert product.is_deleted is False
    assert product.deleted_by is None
