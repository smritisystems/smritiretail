"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-13
Modified     : 2026-08-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
async def override_db(db_session):
    """Clean database and wire test DB session into app."""
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def _create_tenant_and_user(db_session, suffix: str, role: UserRole = UserRole.CASHIER):
    company = Company(
        id=f"comp-mc-{suffix}",
        name=f"MultiComp {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-mc-{suffix}",
        company_id=company.id,
        name=f"MultiBranch {suffix}",
        code=f"BRMC-{suffix}",
        is_active=True,
    )
    db_session.add_all([company, branch])
    await db_session.commit()

    user = User(
        id=f"usr-mc-{suffix}",
        username=f"user_{suffix}",
        hashed_password=hash_password("Pass123!"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
        status="Active",
    )
    db_session.add(user)
    await db_session.commit()

    # Create active assignment records
    comp_assign = UserCompanyAssignment(
        user_id=user.id,
        company_id=company.id,
        is_default=True,
        is_active=True,
        is_deleted=False,
    )
    branch_assign = UserBranchAssignment(
        user_id=user.id,
        company_id=company.id,
        branch_id=branch.id,
        is_default=True,
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([comp_assign, branch_assign])
    await db_session.commit()

    return company, branch, user


async def test_default_tenant_resolution_on_login(db_session):
    """Verify that login resolves default company/branch assignments when user fields are empty."""
    suffix = uuid.uuid4().hex[:6]
    company = Company(id=f"comp-def-{suffix}", name=f"Default Comp {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    branch = Branch(id=f"br-def-{suffix}", company_id=company.id, name=f"Default Branch {suffix}", code=f"BRDEF-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    # User with empty company_id and branch_id
    uname = f"unassigned_{suffix}"
    user = User(
        id=f"usr-no-tenant-{suffix}",
        username=uname,
        hashed_password=hash_password("Pass123!"),
        role=UserRole.CASHIER,
        is_active=True,
        is_deleted=False,
        company_id=None,
        branch_id=None,
        status="Active",
    )
    db_session.add(user)
    await db_session.commit()

    # Assign default company and branch
    comp_assign = UserCompanyAssignment(user_id=user.id, company_id=company.id, is_default=True, is_active=True, is_deleted=False)
    br_assign = UserBranchAssignment(user_id=user.id, company_id=company.id, branch_id=branch.id, is_default=True, is_active=True, is_deleted=False)
    db_session.add_all([comp_assign, br_assign])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={"username": uname, "password": "Pass123!"})
        assert res.status_code == 200
        data = res.json()
        assert data["company_id"] == company.id
        assert data["branch_id"] == branch.id


async def test_context_switch_to_assigned_company(db_session):
    """Verify context switching to an assigned target company and branch."""
    comp_a, br_a, user = await _create_tenant_and_user(db_session, "a")

    # Create second company and branch, and assign to user
    comp_b = Company(id="comp-mc-b", name="MultiComp B", gst_number="27ABCDE1234F2Z6", is_active=True)
    br_b = Branch(id="br-mc-b", company_id=comp_b.id, name="MultiBranch B", code="BRMC-B", is_active=True)
    db_session.add_all([comp_b, br_b])
    await db_session.commit()

    comp_assign_b = UserCompanyAssignment(user_id=user.id, company_id=comp_b.id, is_default=False, is_active=True, is_deleted=False)
    br_assign_b = UserBranchAssignment(user_id=user.id, company_id=comp_b.id, branch_id=br_b.id, is_default=False, is_active=True, is_deleted=False)
    db_session.add_all([comp_assign_b, br_assign_b])
    await db_session.commit()

    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role.value, "company_id": comp_a.id, "branch_id": br_a.id})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/auth/switch-context",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_company_id": comp_b.id, "target_branch_id": br_b.id},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["company_id"] == comp_b.id
        assert data["branch_id"] == br_b.id


async def test_context_switch_denied_for_unassigned_company(db_session):
    """Verify context switching returns 403 when user is not assigned to target company."""
    comp_a, br_a, user = await _create_tenant_and_user(db_session, "c")

    # Company C is unassigned
    comp_unassigned = Company(id="comp-unassigned", name="Unassigned Comp", gst_number="27ABCDE1234F3Z7", is_active=True)
    br_unassigned = Branch(id="br-unassigned", company_id=comp_unassigned.id, name="Unassigned Branch", code="BRUN", is_active=True)
    db_session.add_all([comp_unassigned, br_unassigned])
    await db_session.commit()

    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role.value, "company_id": comp_a.id, "branch_id": br_a.id})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/auth/switch-context",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_company_id": comp_unassigned.id, "target_branch_id": br_unassigned.id},
        )
        assert res.status_code == 403
        assert "not assigned" in res.json()["detail"]


async def test_tenant_context_dependency_validates_assignment(db_session):
    """Verify get_tenant_context raises 403 when user company assignment is revoked."""
    comp, br, user = await _create_tenant_and_user(db_session, "d", role=UserRole.MANAGER)

    # Soft-delete the company assignment to simulate revocation
    res = await db_session.execute(select(UserCompanyAssignment).where(UserCompanyAssignment.user_id == user.id))
    assignment = res.scalars().first()
    assignment.is_deleted = True
    await db_session.commit()

    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role.value, "company_id": comp.id, "branch_id": br.id})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Request a tenant-scoped endpoint that depends on get_tenant_context
        res = await ac.get(
            "/api/v1/inventory/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert "not assigned" in res.json()["detail"]
