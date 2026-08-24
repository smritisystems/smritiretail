"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.company_database_registry import CompanyDatabaseRegistry
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from app.api.deps import get_db
from app.core.security import hash_password
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


async def test_full_login_company_selector_to_dashboard_flow(db_session):
    """
    E2E Test for Login -> Company Selector -> Dashboard flow:
    1. Seed 2 companies: one READY, one PROVISIONING (not ready).
    2. Seed user assigned to both companies.
    3. User logs in -> gets initial token.
    4. User queries /api/v1/auth/tenants -> only READY company returned.
    5. User switches context via /api/v1/auth/switch-context -> receives scoped JWT.
    6. Verify /auth/me returns updated company context.
    """
    suffix = uuid.uuid4().hex[:6]

    # 1. Company A: READY in company_database_registries with non-MAIN branch
    comp_a = Company(
        id=f"comp-ready-{suffix}",
        name=f"Ready Company {suffix}",
        gst_number="27READY1234F1Z1",
        is_active=True,
    )
    branch_a = Branch(
        id=f"br-custom-{suffix}",
        company_id=comp_a.id,
        name=f"Custom North Branch {suffix}",
        code=f"BRNRTH-{suffix}",
        is_active=True,
    )
    db_reg_a = CompanyDatabaseRegistry(
        company_id=comp_a.id,
        database_id=f"db-ready-{suffix}",
        database_name=f"smriti_rdy_{suffix}",
        status="READY",
    )

    # 2. Company B: NOT READY (PROVISIONING)
    comp_b = Company(
        id=f"comp-pending-{suffix}",
        name=f"Pending Company {suffix}",
        gst_number="27PEND1234F1Z2",
        is_active=True,
    )
    branch_b = Branch(
        id=f"br-pending-{suffix}",
        company_id=comp_b.id,
        name=f"Pending Branch {suffix}",
        code=f"BRPND-{suffix}",
        is_active=True,
    )
    db_reg_b = CompanyDatabaseRegistry(
        company_id=comp_b.id,
        database_id=f"db-pending-{suffix}",
        database_name=f"smriti_pnd_{suffix}",
        status="PROVISIONING",
    )

    # 3. User assigned to both Company A and Company B
    user = User(
        id=f"usr-{suffix}",
        username=f"operator_{suffix}",
        email=f"operator_{suffix}@smriti.test",
        hashed_password=hash_password("Operator@123"),
        role=UserRole.MANAGER,
        is_active=True,
        is_deleted=False,
    )
    uca_a = UserCompanyAssignment(
        id=f"uca-a-{suffix}",
        user_id=user.id,
        company_id=comp_a.id,
        is_default=True,
        is_active=True,
        is_deleted=False,
    )
    uba_a = UserBranchAssignment(
        id=f"uba-a-{suffix}",
        user_id=user.id,
        company_id=comp_a.id,
        branch_id=branch_a.id,
        is_default=True,
        is_active=True,
        is_deleted=False,
    )
    uca_b = UserCompanyAssignment(
        id=f"uca-b-{suffix}",
        user_id=user.id,
        company_id=comp_b.id,
        is_default=False,
        is_active=True,
        is_deleted=False,
    )

    db_session.add_all([comp_a, branch_a, db_reg_a, comp_b, branch_b, db_reg_b, user, uca_a, uba_a, uca_b])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step 1: Login
        login_res = await client.post("/api/v1/auth/login", json={
            "username": f"operator_{suffix}",
            "password": "Operator@123",
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        initial_token = login_res.json()["access_token"]
        assert initial_token is not None

        # Step 2: Query /auth/tenants for Company Selector Screen
        tenants_res = await client.get(
            "/api/v1/auth/tenants",
            headers={"Authorization": f"Bearer {initial_token}"},
        )
        assert tenants_res.status_code == 200
        tenants_data = tenants_res.json()

        # Verify only the READY company is returned (PROVISIONING company is excluded)
        assert len(tenants_data["companies"]) == 1
        assert tenants_data["companies"][0]["id"] == comp_a.id
        assert tenants_data["companies"][0]["name"] == f"Ready Company {suffix}"
        assert len(tenants_data["branches"]) == 1
        assert tenants_data["branches"][0]["id"] == branch_a.id

        # Step 3: Switch Context to Selected Company using the actual branch (NOT hardcoded MAIN)
        switch_res = await client.post(
            "/api/v1/auth/switch-context",
            headers={"Authorization": f"Bearer {initial_token}"},
            json={
                "target_company_id": comp_a.id,
                "target_branch_id": branch_a.id,
            }
        )
        assert switch_res.status_code == 200
        scoped_token = switch_res.json()["access_token"]
        assert scoped_token is not None
        assert switch_res.json()["company_id"] == comp_a.id
        assert switch_res.json()["branch_id"] == branch_a.id

        # Step 4: Verify Me endpoint with scoped token
        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {scoped_token}"},
        )
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["company_id"] == comp_a.id
        assert me_data["branch_id"] == branch_a.id


async def test_switch_context_rejects_unassigned_company_and_preserves_security(db_session):
    """
    Security Test:
    Verify that switch-context to an unauthorized company returns 403 Forbidden
    and the user cannot forge tenant headers.
    """
    suffix = uuid.uuid4().hex[:6]

    comp_auth = Company(id=f"comp-auth-{suffix}", name=f"Auth Comp {suffix}", is_active=True)
    br_auth = Branch(id=f"br-auth-{suffix}", company_id=comp_auth.id, name="Auth Br", code=f"BRA-{suffix}", is_active=True)
    db_reg_auth = CompanyDatabaseRegistry(company_id=comp_auth.id, database_id=f"db-a-{suffix}", database_name=f"smriti_a_{suffix}", status="READY")

    comp_unauth = Company(id=f"comp-unauth-{suffix}", name=f"Unauth Comp {suffix}", is_active=True)
    br_unauth = Branch(id=f"br-unauth-{suffix}", company_id=comp_unauth.id, name="Unauth Br", code=f"BRU-{suffix}", is_active=True)
    db_reg_unauth = CompanyDatabaseRegistry(company_id=comp_unauth.id, database_id=f"db-u-{suffix}", database_name=f"smriti_u_{suffix}", status="READY")

    user = User(
        id=f"usr-lmt-{suffix}",
        username=f"limited_{suffix}",
        email=f"limited_{suffix}@smriti.test",
        hashed_password=hash_password("Limited@123"),
        role=UserRole.CASHIER,
        is_active=True,
        is_deleted=False,
    )
    uca = UserCompanyAssignment(
        id=f"uca-lmt-{suffix}",
        user_id=user.id,
        company_id=comp_auth.id,
        is_default=True,
        is_active=True,
        is_deleted=False,
    )
    uba = UserBranchAssignment(
        id=f"uba-lmt-{suffix}",
        user_id=user.id,
        company_id=comp_auth.id,
        branch_id=br_auth.id,
        is_default=True,
        is_active=True,
        is_deleted=False,
    )

    db_session.add_all([comp_auth, br_auth, db_reg_auth, comp_unauth, br_unauth, db_reg_unauth, user, uca, uba])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "username": f"limited_{suffix}",
            "password": "Limited@123",
        })
        token = login_res.json()["access_token"]

        # Attempt to switch to unauthorized company
        bad_switch = await client.post(
            "/api/v1/auth/switch-context",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "target_company_id": comp_unauth.id,
                "target_branch_id": br_unauth.id,
            }
        )
        assert bad_switch.status_code == 403
        assert "Access denied" in bad_switch.json()["detail"]

        # Original token remains valid on its assigned company
        me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["company_id"] == comp_auth.id
