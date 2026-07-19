"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smriti.com
Version      : 3.21.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Store
from app.models.system import SystemConfig
from app.api.deps import get_db
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)
        try:
            await clear_db(db_session)
        except Exception:
            pass


def _auth_headers(user: User):
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_system_doctor_requires_sysadmin(db_session):
    user = User(
        id="usr-user-1",
        username="regular_user",
        email="regular@smriti.test",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.MANAGER,
        is_active=True,
        is_deleted=False,
        company_id=None,
        branch_id=None,
        status="Active",
    )
    db_session.add(user)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/system/doctor", headers=_auth_headers(user))
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_system_doctor_reports_status_for_sysadmin(db_session):
    admin = User(
        id="usr-admin-1",
        username="sysadmin",
        email="sysadmin@smriti.test",
        hashed_password=hash_password("SysAdmin@123"),
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
        company_id=None,
        branch_id=None,
        status="Active",
    )
    company = Company(
        id="comp-test-1",
        name="Test Company",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id="br-test-1",
        company_id=company.id,
        name="Test Branch",
        code="BR-TEST-1",
        is_active=True,
    )
    db_session.add_all([admin, company, branch])
    await db_session.commit()

    store = Store(
        id="stor-test-1",
        company_id=company.id,
        branch_id=branch.id,
        code="BR-TEST-1",
        name="Test Store",
        store_type="Company Owned",
        is_active=True,
        is_deleted=False,
    )
    config = SystemConfig(
        id="sys-test-1",
        key="setup_completed",
        value="true",
        category="Setup",
        created_by=admin.username,
        updated_by=admin.username,
    )
    db_session.add_all([store, config])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/system/doctor", headers=_auth_headers(admin))
        assert res.status_code == 200

        body = res.json()
        assert body["status"] == "PASS"
        assert body["database_status"] == "PASS"
        assert body["bootstrap_admin_exists"] is True
        assert body["total_users"] == 1
        assert body["setup_completed"] is True
        assert body["companies_count"] >= 1
        assert body["branches_count"] >= 1
        assert body["stores_count"] == 1
        assert body["recommendations"] == []
