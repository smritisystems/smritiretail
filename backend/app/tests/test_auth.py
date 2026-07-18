"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.9.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from decimal import Decimal
from sqlalchemy.future import select
from sqlalchemy import delete

from app.main import app
from app.models.auth import User, RefreshTokenBlacklist, UserRole
from app.models.tenant import Company, Branch
from app.api.deps import get_db
from app.core.security import hash_password, create_access_token, create_refresh_token

from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def _make_tenant(db_session, suffix: str):
    company = Company(
        id=f"comp-auth-{suffix}",
        name=f"Auth Company {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-auth-{suffix}",
        company_id=company.id,
        name=f"Auth Branch {suffix}",
        code=f"BRAUTH-{suffix}",
        is_active=True,
    )
    db_session.add_all([company, branch])
    await db_session.commit()
    return company, branch


async def _make_user(db_session, suffix: str, role: UserRole,
                     company_id=None, branch_id=None) -> User:
    user = User(
        id=f"usr-{suffix}",
        username=f"user_{suffix}",
        email=f"user_{suffix}@smriti.test",
        hashed_password=hash_password("Password@123"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


# ---------------------------------------------------------------------------
# Bootstrap tests
# ---------------------------------------------------------------------------

async def test_bootstrap_creates_sysadmin(db_session):
    """POST /auth/bootstrap creates the first SYSADMIN when no users exist."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/bootstrap", json={
            "username": f"admin_{uuid.uuid4().hex[:6]}",
            "password": "Admin@123",
            "email": f"admin_{uuid.uuid4().hex[:4]}@smriti.test",
        })
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "SYSADMIN"
    assert data["is_active"] is True
    assert data["status"] == "PendingPasswordChange"
    assert data.get("password_reset_required") is True


async def test_login_returns_password_reset_required_for_bootstrap_user(db_session):
    suffix = uuid.uuid4().hex[:6]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/bootstrap", json={
            "username": f"super_{suffix}",
            "password": "TempPass@123",
            "email": f"admin_{suffix}@smriti.test",
        })
        assert res.status_code == 201

        login_res = await client.post("/api/v1/auth/login", json={
            "username": f"super_{suffix}",
            "password": "TempPass@123",
        })
        assert login_res.status_code == 200
        login_data = login_res.json()
        assert login_data.get("password_reset_required") is True


async def test_password_change_clears_pending_status(db_session):
    suffix = uuid.uuid4().hex[:6]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        bootstrap_res = await client.post("/api/v1/auth/bootstrap", json={
            "username": f"super_{suffix}",
            "password": "TempPass@123",
            "email": f"admin_{suffix}@smriti.test",
        })
        assert bootstrap_res.status_code == 201

        login_res = await client.post("/api/v1/auth/login", json={
            "username": f"super_{suffix}",
            "password": "TempPass@123",
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        reset_res = await client.patch(
            "/api/v1/users/me/password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "TempPass@123",
                "new_password": "Str0ngPass!",
            },
        )
        assert reset_res.status_code == 200

        # Ensure subsequent login does not require reset
        login_final_res = await client.post("/api/v1/auth/login", json={
            "username": f"super_{suffix}",
            "password": "Str0ngPass!",
        })
        assert login_final_res.status_code == 200
        assert login_final_res.json().get("password_reset_required") is False


async def test_pending_password_change_blocks_protected_routes(db_session):
    """A bootstrap user with pending password change cannot access protected endpoints."""
    suffix = uuid.uuid4().hex[:6]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        bootstrap_res = await client.post("/api/v1/auth/bootstrap", json={
            "username": f"pending_{suffix}",
            "password": "TempPass@123",
            "email": f"pending_{suffix}@smriti.test",
        })
        assert bootstrap_res.status_code == 201

        login_res = await client.post("/api/v1/auth/login", json={
            "username": f"pending_{suffix}",
            "password": "TempPass@123",
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        protected_res = await client.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert protected_res.status_code == 403
        assert "Password change is required" in protected_res.json()["detail"]


async def test_bootstrap_blocked_when_users_exist(db_session):
    """POST /auth/bootstrap must return 403 when at least one user already exists."""
    suffix = uuid.uuid4().hex[:6]
    await _make_user(db_session, suffix, UserRole.SYSADMIN)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/bootstrap", json={
            "username": f"admin2_{suffix}",
            "password": "Admin@123",
        })
    assert res.status_code == 403
    assert "Bootstrap" in res.json()["detail"] or "already" in res.json()["detail"]


async def test_auth_tenant_options_requires_authentication(db_session):
    suffix = uuid.uuid4().hex[:6]
    await _make_tenant(db_session, suffix)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/auth/tenants")

    assert res.status_code == 401


async def test_auth_tenant_options_returns_companies_and_branches_for_sysadmin(db_session):
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    await _make_user(db_session, suffix, UserRole.SYSADMIN)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "username": f"user_{suffix}",
            "password": "Password@123",
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        res = await client.get(
            "/api/v1/auth/tenants",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert res.status_code == 200
    data = res.json()
    assert any(company["id"] == comp.id for company in data["companies"])
    assert any(branch["id"] == br.id and branch["company"] == comp.id for branch in data["branches"])


async def test_auth_tenant_options_scopes_to_assigned_company(db_session):
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    other_comp, other_br = await _make_tenant(db_session, suffix + "x")
    await _make_user(db_session, suffix, UserRole.MANAGER, company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "username": f"user_{suffix}",
            "password": "Password@123",
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        res = await client.get(
            "/api/v1/auth/tenants",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert res.status_code == 200
    data = res.json()
    assert len(data["companies"]) == 1
    assert data["companies"][0]["id"] == comp.id
    assert len(data["branches"]) == 1
    assert data["branches"][0]["id"] == br.id


async def test_login_with_company_and_branch_selection(db_session):
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    await _make_user(db_session, suffix, UserRole.MANAGER, company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": f"user_{suffix}",
            "password": "Password@123",
            "company_id": comp.id,
            "branch_id": br.id,
        })

    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "MANAGER"
    assert data["company_id"] == comp.id
    assert data["branch_id"] == br.id


async def test_login_rejects_invalid_branch_selection(db_session):
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    other_comp, other_br = await _make_tenant(db_session, suffix + "x")
    await _make_user(db_session, suffix, UserRole.MANAGER, company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": f"user_{suffix}",
            "password": "Password@123",
            "company_id": other_comp.id,
            "branch_id": other_br.id,
        })

    assert res.status_code == 401


async def test_login_rejects_user_without_tenant_assignment(db_session):
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    await _make_user(db_session, suffix, UserRole.MANAGER)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": f"user_{suffix}",
            "password": "Password@123",
        })

    assert res.status_code == 403
    assert "company and branch" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------

async def test_login_valid_credentials(db_session):
    """POST /auth/login returns access_token + refresh_token for valid credentials."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    await _make_user(db_session, suffix, UserRole.MANAGER,
                     company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": f"user_{suffix}",
            "password": "Password@123",
        })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "MANAGER"


async def test_login_invalid_password(db_session):
    """POST /auth/login returns 401 for wrong password — no traceback in detail."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    await _make_user(db_session, suffix, UserRole.CASHIER,
                     company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": f"user_{suffix}",
            "password": "WrongPassword",
        })
    assert res.status_code == 401
    detail = res.json()["detail"]
    assert "Incorrect" in detail
    assert "Traceback" not in detail
    assert "sqlalchemy" not in detail.lower()


async def test_login_inactive_user(db_session):
    """POST /auth/login returns 401 for inactive user."""
    suffix = uuid.uuid4().hex[:6]
    user = User(
        id=f"usr-{suffix}",
        username=f"inactive_{suffix}",
        hashed_password=hash_password("Password@123"),
        role=UserRole.CASHIER,
        is_active=False,
        is_deleted=False,
    )
    db_session.add(user)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": f"inactive_{suffix}",
            "password": "Password@123",
        })
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# /me tests
# ---------------------------------------------------------------------------

async def test_get_me_authenticated(db_session):
    """GET /auth/me returns the current user's profile when authenticated."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    user = await _make_user(db_session, suffix, UserRole.MANAGER,
                            company_id=comp.id, branch_id=br.id)

    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/auth/me",
                               headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == f"user_{suffix}"
    assert data["role"] == "MANAGER"


async def test_get_me_no_token(db_session):
    """GET /auth/me returns 401 when no Bearer token is supplied."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401


async def test_get_me_tampered_token(db_session):
    """GET /auth/me returns 401 for a tampered/invalid token."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/auth/me",
                               headers={"Authorization": "Bearer this.is.garbage"})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Refresh tests
# ---------------------------------------------------------------------------

async def test_refresh_valid(db_session):
    """POST /auth/refresh returns a new access_token for a valid refresh token."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    user = await _make_user(db_session, suffix, UserRole.MANAGER,
                            company_id=comp.id, branch_id=br.id)

    refresh = create_refresh_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/refresh",
                                json={"refresh_token": refresh})
    assert res.status_code == 200
    assert "access_token" in res.json()


async def test_refresh_with_access_token_rejected(db_session):
    """POST /auth/refresh must reject an access token (wrong type)."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    user = await _make_user(db_session, suffix, UserRole.CASHIER,
                            company_id=comp.id, branch_id=br.id)

    access = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/refresh",
                                json={"refresh_token": access})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Logout + blacklist tests
# ---------------------------------------------------------------------------

async def test_logout_blacklists_refresh_token(db_session):
    """After logout, the refresh token must be rejected on re-use."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    user = await _make_user(db_session, suffix, UserRole.MANAGER,
                            company_id=comp.id, branch_id=br.id)

    jti = str(uuid.uuid4())
    access = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": user.company_id,
        "branch_id": user.branch_id, "jti": jti, "type": "access",
    })
    refresh = create_refresh_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": user.company_id,
        "branch_id": user.branch_id, "jti": jti, "type": "refresh",
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        logout_res = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh},
            headers={"Authorization": f"Bearer {access}"},
        )
        assert logout_res.status_code == 200

        # Retry refresh — must now be 401
        retry_res = await client.post("/api/v1/auth/refresh",
                                      json={"refresh_token": refresh})
        assert retry_res.status_code == 401


# ---------------------------------------------------------------------------
# RBAC guard tests
# ---------------------------------------------------------------------------

async def test_role_guard_cashier_cannot_create_product(db_session):
    """
    POST /products/ with a CASHIER token returns 403.
    CASHIER is not in the allowed roles for product creation.
    """
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    user = await _make_user(db_session, suffix, UserRole.CASHIER,
                            company_id=comp.id, branch_id=br.id)

    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": user.company_id,
        "branch_id": user.branch_id, "jti": str(uuid.uuid4()), "type": "access",
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/products/",
            json={
                "id": f"prod-rbac-{suffix}",
                "code": f"RBAC{suffix}",
                "name": "RBAC Test Product",
                "category": "General",
                "barcode": f"BCRBAC{suffix}",
                "price": 50.0,
                "stock": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 403
    assert "CASHIER" in res.json()["detail"]


async def test_role_guard_manager_can_create_product(db_session):
    """
    POST /products/ with a MANAGER token returns 201.
    """
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    user = await _make_user(db_session, suffix, UserRole.MANAGER,
                            company_id=comp.id, branch_id=br.id)

    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": user.company_id,
        "branch_id": user.branch_id, "jti": str(uuid.uuid4()), "type": "access",
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/products/",
            json={
                "id": f"prod-mgr-{suffix}",
                "code": f"MGR{suffix}",
                "name": "Manager Created Product",
                "category": "General",
                "barcode": f"BCMGR{suffix}",
                "price": 75.0,
                "stock": 3,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 201
    data = res.json()
    assert data["company_id"] == comp.id
    assert data["branch_id"] == br.id


async def test_protected_route_no_token(db_session):
    """GET /products/ returns 401 when no Bearer token is provided."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/products/")
    assert res.status_code == 401
