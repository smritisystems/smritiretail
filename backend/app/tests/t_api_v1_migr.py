"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smriti.com
Version      : 3.21.0
Created      : 2026-07-16
Modified     : 2026-07-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from jose import jwt
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.future import select

from app.main import app
from app.core.config import settings
from app.models.auth import User, UserRole
from app.models.numbering import DocumentSeries
from app.models.system import SystemConfig
from app.models.tenant import Company, Branch
from app.core.security import create_access_token, hash_password
from app.api.deps import get_db, get_company_db
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
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


async def _create_user(db_session, role=UserRole.MANAGER):
    s = uuid.uuid4().hex[:6]
    company = Company(
        id=f"comp-test-{s}",
        name=f"Test Company {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-test-{s}",
        company_id=company.id,
        name=f"Test Branch {s}",
        code=f"BR-TEST-{s}",
        is_active=True,
    )
    user = User(
        id=f"usr-test-{s}",
        username=f"test_user_{s}",
        email=f"test_{s}@smriti.test",
        hashed_password=hash_password("Test@1234"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add_all([company, branch, user])
    await db_session.commit()
    return user, company, branch


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
async def test_api_v1_migration_endpoints(db_session):
    user, _, _ = await _create_user(db_session, role=UserRole.SYSADMIN)
    headers = _auth_headers(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_ai = await client.post(
            "/api/v1/ai/chat",
            json={"message": "What is Weeks of Cover?", "context": {"stock": []}},
            headers=headers,
        )
        assert res_ai.status_code == 200
        assert "reply" in res_ai.json()

        res_layout = await client.get("/api/v1/layout/preferences", headers=headers)
        assert res_layout.status_code == 200
        layout_data = res_layout.json()
        assert layout_data["position"] == "left"

        res_save_layout = await client.post(
            "/api/v1/layout/preferences",
            json={"position": "right", "collapsed": True, "favorites": ["sales"]},
            headers=headers,
        )
        assert res_save_layout.status_code == 200
        assert res_save_layout.json()["success"] is True

        await db_session.execute(delete(SystemConfig).where(SystemConfig.key == "setup_completed"))
        await db_session.commit()

        br_code = f"BR-{uuid.uuid4().hex[:6].upper()}"
        res_setup = await client.post(
            "/api/v1/company/setup",
            json={"businessInfo": {"name": "Demo Co"}, "orgStructure": {"stores": [{"name": "Flagship", "code": br_code}]}}
            , headers=headers,
        )
        assert res_setup.status_code == 200
        setup_payload = res_setup.json()
        assert setup_payload["success"] is True
        assert setup_payload["company"]["name"] == "Demo Co"
        assert setup_payload["company"]["branches"][0]["name"] == "Flagship"
        assert setup_payload["company"]["branches"][0]["code"] == br_code
        assert setup_payload["company"]["stores"][0]["name"] == "Flagship"
        assert setup_payload["company"]["stores"][0]["code"] == br_code
        assert setup_payload["company"]["users"] == []

        res_setup_status = await client.get("/api/v1/system/setup-status", headers=headers)
        assert res_setup_status.status_code == 200
        assert res_setup_status.json()["setupCompleted"] is True

        series_result = await db_session.execute(
            select(DocumentSeries).where(
                DocumentSeries.is_deleted == False,
                DocumentSeries.company_code == setup_payload["company"]["id"],
            )
        )
        series_rows = series_result.scalars().all()
        assert len(series_rows) == 2
        assert {series.document_type for series in series_rows} == {"Sales Invoice", "Purchase Order"}

        license_result = await db_session.execute(
            select(SystemConfig).where(SystemConfig.key == "license_status")
        )
        license_config = license_result.scalars().first()
        assert license_config is not None
        assert license_config.value == "Trial"

        fy_result = await db_session.execute(
            select(SystemConfig).where(SystemConfig.key == "current_financial_year")
        )
        fy_config = fy_result.scalars().first()
        assert fy_config is not None
        assert fy_config.value == "2026-2027"

        res_setup_again = await client.post(
            "/api/v1/company/setup",
            json={"businessInfo": {"name": "Second Co"}},
            headers=headers,
        )
        assert res_setup_again.status_code in (400, 403)
        assert any(w in str(res_setup_again.json()).lower() for w in ["completed", "sysadmin", "already", "initialization"])

        res_partners = await client.get("/api/v1/exchange/partners", headers=headers)
        assert res_partners.status_code == 200
        assert isinstance(res_partners.json(), list)

        res_logs = await client.get("/api/v1/exchange/logs", headers=headers)
        assert res_logs.status_code == 200
        assert isinstance(res_logs.json(), list)

        res_validate = await client.post(
            "/api/v1/exchange/validate",
            json={"partnerId": "PRT-01", "rows": [{"sku": "SKU-001", "quantity": 5}]},
            headers=headers,
        )
        assert res_validate.status_code == 200
        assert res_validate.json()["rowCount"] == 1

        res_commit = await client.post(
            "/api/v1/exchange/commit",
            json={"partnerId": "PRT-01", "rows": [{"sku": "SKU-001", "quantity": 5}]},
            headers=headers,
        )
        assert res_commit.status_code == 200
        assert res_commit.json()["success"] is True

        res_approve = await client.post(
            "/api/v1/exchange/approve-log/EXLOG-001",
            headers=headers,
        )
        assert res_approve.status_code == 200
        assert res_approve.json()["success"] is True


@pytest.mark.asyncio
async def test_setup_creates_tenant_assigned_user_and_resolves_tenant_context(db_session):
    s = uuid.uuid4().hex[:6]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Bootstrap a SYSADMIN user for setup
        admin = User(
            id=f"usr-admin-{s}",
            username=f"sysadmin_{s}",
            email=f"sysadmin_{s}@smriti.test",
            hashed_password=hash_password("SysAdmin@123"),
            role=UserRole.SYSADMIN,
            is_active=True,
            is_deleted=False,
            company_id=None,
            branch_id=None,
            status="Active",
        )
        db_session.add(admin)
        await db_session.commit()

        await db_session.execute(delete(SystemConfig).where(SystemConfig.key == "setup_completed"))
        await db_session.commit()

        headers = {"Authorization": f"Bearer {create_access_token({
            "sub": admin.id,
            "username": admin.username,
            "role": admin.role.value,
            "company_id": admin.company_id,
            "branch_id": admin.branch_id,
            "jti": str(uuid.uuid4()),
            "type": "access",
        })}"
        }

        res_setup = await client.post(
            "/api/v1/company/setup",
            json={
                "businessInfo": {"name": f"Tenant Co {s}"},
                "orgStructure": {"stores": [{"name": f"Main Branch {s}", "code": f"BR-{s}"}]},
                "users": {
                    "staff": [
                        {
                            "name": "Bob Cashier",
                            "username": f"bob_cashier_{s}",
                            "role": "Cashier",
                            "email": f"bob_{s}@tenant.test",
                            "mobile": "8888888888",
                        }
                    ]
                }
            },
            headers=headers,
        )
        assert res_setup.status_code == 200

        setup_payload = res_setup.json()
        created_user = setup_payload["company"]["users"][0]
        assert created_user["company_id"] == setup_payload["company"]["id"]
        assert created_user["branch_id"] == setup_payload["company"]["branches"][0]["id"]

        login_res = await client.post(
            "/api/v1/auth/login",
            json={
                "username": created_user["username"],
                "password": created_user["temp_password"],
            },
        )
        assert login_res.status_code == 200
        login_payload = login_res.json()
        assert login_payload["company_id"] == created_user["company_id"]
        assert login_payload["branch_id"] == created_user["branch_id"]

        token = jwt.decode(
            login_payload["access_token"],
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        assert token["company_id"] == created_user["company_id"]
        assert token["branch_id"] == created_user["branch_id"]
        assert token["sub"] == created_user["id"]
        assert token["username"] == created_user["username"]

        tenant_access = await client.get(
            "/api/v1/inventory/",
            headers={"Authorization": f"Bearer {login_payload['access_token']}"},
        )
        assert tenant_access.status_code == 200

        unassigned_user = User(
            id=f"usr-no-tenant-{s}",
            username=f"no_tenant_{s}",
            email=f"no_tenant_{s}@tenant.test",
            hashed_password=hash_password("Test@1234"),
            role=UserRole.MANAGER,
            is_active=True,
            is_deleted=False,
            company_id=None,
            branch_id=None,
            status="Active",
        )
        db_session.add(unassigned_user)
        await db_session.commit()

        unassigned_login = await client.post(
            "/api/v1/auth/login",
            json={"username": f"no_tenant_{s}", "password": "Test@1234"},
        )
        assert unassigned_login.status_code == 403
