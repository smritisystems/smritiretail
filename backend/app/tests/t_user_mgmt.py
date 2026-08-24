"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.api.deps import get_db
from app.core.security import hash_password, create_access_token
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Fixtures & Helpers
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def override_db(db_session):
    """Clean auth rows and wire the test DB session into the app."""
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def _make_tenant(db_session, suffix: str):
    company = Company(
        id=f"comp-um-{suffix}",
        name=f"UM Company {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-um-{suffix}",
        company_id=company.id,
        name=f"UM Branch {suffix}",
        code=f"BRUM-{suffix}",
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
        employment_type="Permanent",
        status="Active"
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User) -> dict:
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


# ---------------------------------------------------------------------------
# POST /users/ — create user
# ---------------------------------------------------------------------------

async def test_sysadmin_can_create_manager(db_session):
    """SYSADMIN can create a MANAGER user assigned to a branch."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/users/",
            json={
                "username": f"mgr_{suffix}",
                "password": "Manager@123",
                "fullName": f"Manager Name {suffix}",
                "role": "MANAGER",
                "branchId": br.id,
                "email": f"mgr_{suffix}@smriti.test"
            },
            headers=_bearer(sysadmin),
        )
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "MANAGER"
    assert data["branchId"] == br.id


async def test_cashier_cannot_create_user(db_session):
    """Cashier must receive 403 when attempting to create a user."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"c-{suffix}", UserRole.CASHIER,
                               company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/users/",
            json={
                "username": f"cashier_{suffix}",
                "password": "Cashier@123",
                "fullName": f"Cashier Name {suffix}",
                "role": "CASHIER",
                "branchId": br.id,
            },
            headers=_bearer(cashier),
        )
    assert res.status_code == 403


async def test_create_duplicate_username_returns_400(db_session):
    """Creating two users with the same username returns 400 with business message."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)

    payload = {
        "username": f"same_{suffix}",
        "password": "Test@1234",
        "fullName": f"Same Name {suffix}",
        "role": "CASHIER",
        "branchId": br.id,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.post("/api/v1/users/", json=payload, headers=_bearer(sysadmin))
        assert r1.status_code == 201
        r2 = await client.post("/api/v1/users/", json=payload, headers=_bearer(sysadmin))
        assert r2.status_code == 400
        assert "already exists" in r2.json()["detail"].lower() or "already taken" in r2.json()["detail"].lower()


# ---------------------------------------------------------------------------
# GET /users/ — list users
# ---------------------------------------------------------------------------

async def test_sysadmin_can_list_users(db_session):
    """SYSADMIN can list all users and receives total count."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)
    await _make_user(db_session, f"m-{suffix}", UserRole.MANAGER,
                     company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/users/", headers=_bearer(sysadmin))
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert data["total"] >= 2
    assert isinstance(data["users"], list)


async def test_cashier_cannot_list_users(db_session):
    """Cashier must receive 403 when attempting to list all users."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"c-{suffix}", UserRole.CASHIER,
                               company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/users/", headers=_bearer(cashier))
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# GET /users/{user_id}
# ---------------------------------------------------------------------------

async def test_sysadmin_can_get_any_user(db_session):
    """SYSADMIN can retrieve any user by ID."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)
    cashier = await _make_user(db_session, f"c-{suffix}", UserRole.CASHIER,
                               company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/users/{cashier.id}", headers=_bearer(sysadmin))
    assert res.status_code == 200
    assert res.json()["id"] == cashier.id


async def test_user_can_get_own_profile(db_session):
    """Any user can retrieve their own profile."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"m-{suffix}", UserRole.MANAGER,
                               company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/users/{manager.id}", headers=_bearer(manager))
    assert res.status_code == 200
    assert res.json()["username"] == manager.username


async def test_cashier_cannot_get_other_user(db_session):
    """A Cashier cannot retrieve another user's profile — returns 403."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    cashier1 = await _make_user(db_session, f"c1-{suffix}", UserRole.CASHIER,
                                company_id=comp.id, branch_id=br.id)
    cashier2 = await _make_user(db_session, f"c2-{suffix}", UserRole.CASHIER,
                                company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/users/{cashier2.id}", headers=_bearer(cashier1))
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /users/{user_id} — update
# ---------------------------------------------------------------------------

async def test_sysadmin_can_update_user_role(db_session):
    """SYSADMIN can update a CASHIER's role."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)
    cashier = await _make_user(db_session, f"c-{suffix}", UserRole.CASHIER,
                               company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.patch(
            f"/api/v1/users/{cashier.id}",
            json={"role": "MANAGER"},
            headers=_bearer(sysadmin),
        )
    assert res.status_code == 200
    assert res.json()["role"] == "MANAGER"


async def test_get_nonexistent_user_returns_404(db_session):
    """Getting a user ID that does not exist returns 404."""
    suffix = uuid.uuid4().hex[:6]
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/users/nonexistent-id", headers=_bearer(sysadmin))
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /users/{user_id} — soft delete
# ---------------------------------------------------------------------------

async def test_sysadmin_can_deactivate_user(db_session):
    """SYSADMIN can deactivate another user — user is soft-deleted."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)
    cashier = await _make_user(db_session, f"c-{suffix}", UserRole.CASHIER,
                               company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.delete(f"/api/v1/users/{cashier.id}", headers=_bearer(sysadmin))
    assert res.status_code == 200

    # Verify in DB: user is soft-deleted
    res_db = await db_session.execute(select(User).where(User.id == cashier.id))
    u = res_db.scalars().first()
    assert u.is_deleted is True
    assert u.is_active is False


async def test_sysadmin_cannot_deactivate_self(db_session):
    """A SYSADMIN cannot deactivate their own account — returns 400."""
    suffix = uuid.uuid4().hex[:6]
    sysadmin = await _make_user(db_session, f"sa-{suffix}", UserRole.SYSADMIN)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.delete(f"/api/v1/users/{sysadmin.id}", headers=_bearer(sysadmin))
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# PATCH /users/me/password
# ---------------------------------------------------------------------------

async def test_change_own_password_valid(db_session):
    """User can change their own password with the correct current password."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"m-{suffix}", UserRole.MANAGER,
                               company_id=comp.id, branch_id=br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.patch(
            "/api/v1/users/me/password",
            json={"current_password": "Password@123", "new_password": "NewPass@456"},
            headers=_bearer(manager),
        )
    assert res.status_code == 200
    assert "updated" in res.json()["message"].lower()
