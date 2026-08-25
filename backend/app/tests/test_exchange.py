"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.exchange import DataExchangeTask
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
    comp = Company(id=f"comp-exc-{s}", name=f"Exc Co {s}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-exc-{s}", company_id=comp.id,
                   name=f"Exc Br {s}", code=f"BREXC-{s}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    user = User(
        id=f"usr-exc-{s}", username=f"usr_exc_{s}",
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
async def test_execute_product_export_task(db_session):
    # Setup tenant, user, headers
    comp, br = await _make_tenant(db_session, "e1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Seed a product
    prod_id = f"prod-exc-{uuid.uuid4().hex[:8]}"
    product = Product(
        id=prod_id,
        code=f"PROD-EXC-{uuid.uuid4().hex[:4].upper()}",
        name="Exchange Test Product",
        price=150.0,
        cost_price=100.0,
        stock=50,
        category="Electronics",
        barcode=f"bc-{uuid.uuid4().hex[:8]}",
        company_id=comp.id,
        branch_id=br.id,
        is_favorite=False,
        is_deleted=False,
        is_active=True
    )
    db_session.add(product)

    # Seed an export task
    task_id = f"task-exc-{uuid.uuid4().hex[:8]}"
    task = DataExchangeTask(
        id=task_id,
        name="Export Products Task",
        direction="Export",
        entity_type="Products",
        file_type="CSV",
        status="Idle",
        company_id=comp.id,
        branch_id=br.id,
        is_active=True,
        is_deleted=False
    )
    db_session.add(task)
    await db_session.commit()

    # Trigger task execution endpoint
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            f"/api/v1/exchange/tasks/{task_id}/execute",
            json={"payload": []},
            headers=headers
        )

    # Assert response indicates success and contains exported product data
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "Success"
    assert any(item.get("name") == "Exchange Test Product" for item in data["exportedData"])
