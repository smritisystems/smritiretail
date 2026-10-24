"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.54
Created      : 2026-10-12
Modified     : 2026-10-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Regression Tests for Staff Directory Profile Robustness.
Verifies that PATCH /api/v1/staff/directory/{user_id}/profile handles:
1. Null and empty payment/KYC fields without Pydantic 422/400 failures.
2. Unmapped / foreign branch codes without FK violation (staff_profiles_branch_id_fkey).
3. First-time staff profile creation with append-only history.
4. Reactivation of soft-deleted profiles without uq_staff_profiles_company_user collision.
5. Automatic string length clamping to prevent database truncation errors.
6. Central users with company_id=None mapped safely across tenant sessions.
"""

import uuid
from datetime import datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.future import select

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.staff_profile import StaffProfile
from app.models.staff_profile_history import StaffProfileHistory
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire test DB session and clean up tables."""
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


async def _setup_test_context(db_session, company_id="COMP-001", branch_id="BR-MAIN-001"):
    suffix = uuid.uuid4().hex[:6]
    comp = Company(
        id=company_id,
        name=f"Test Enterprise {suffix}",
        company_code=company_id.replace("COMP-", ""),
        is_active=True,
        is_deleted=False,
    )
    db_session.add(comp)
    await db_session.flush()

    branch = Branch(
        id=branch_id,
        company_id=comp.id,
        code="MAIN",
        name="Main Store Branch",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(branch)

    admin_user = User(
        id=f"usr-admin-{suffix}",
        username=f"admin_{suffix}",
        hashed_password="hash",
        role=UserRole.SYSADMIN,
        company_id=comp.id,
        branch_id=branch.id,
        full_name="System Administrator",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(admin_user)
    await db_session.commit()
    await db_session.refresh(comp)
    await db_session.refresh(branch)
    await db_session.refresh(admin_user)
    return comp, branch, admin_user


def _make_auth_headers(user, comp, branch_id=None):
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "company_id": comp.id,
        "branch_id": branch_id or user.branch_id or "BR-MAIN-001",
        "type": "access",
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": comp.company_code or "001",
        "X-Branch-Code": branch_id or user.branch_id or "MAIN",
    }


@pytest.mark.asyncio
async def test_patch_profile_with_null_and_empty_payment_fields(db_session):
    """Verify that null/empty payment fields do not trigger validation or database 400 errors."""
    comp, branch, admin_user = await _setup_test_context(db_session)
    target_user = User(
        id="usr-test-target-01",
        username="target_cashier_01",
        hashed_password="hash",
        role=UserRole.CASHIER,
        company_id=comp.id,
        branch_id=branch.id,
        full_name="Target Cashier One",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(target_user)
    await db_session.commit()

    headers = _make_auth_headers(admin_user, comp)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "fullName": "Target Cashier One Updated",
            "branch": "Main Store Branch",
            "payment": {
                "bankName": None,
                "accountNumber": None,
                "ifscCode": None,
                "branchName": None,
                "accountType": None,
                "nameAsPerBank": None,
                "bankDetails": None,
                "upi": None,
                "salaryEffectiveFrom": None,
                "commissionEffectiveFrom": None,
                "panNumber": None,
                "aadhaarNumber": None,
                "providentFundUan": None,
                "esicNumber": None,
                "bloodGroup": None,
                "fatherSpouseName": None,
                "maritalStatus": None,
                "emergencyContactRelation": None,
                "permanentAddress": None,
            }
        }
        res = await client.patch(f"/api/v1/staff/directory/{target_user.id}/profile", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        body = res.json()
        assert body["fullName"] == "Target Cashier One Updated"
        assert body["payment"]["frequency"] == "Monthly"
        assert body["payment"]["paymentMode"] == "Bank Transfer"
        assert body["payment"]["bankDetails"] == ""
        assert body["payment"]["upi"] == ""


@pytest.mark.asyncio
async def test_patch_profile_with_unmapped_branch_id(db_session):
    """Verify that an arbitrary unmapped branch code does not crash on FK violation."""
    comp, branch, admin_user = await _setup_test_context(db_session)
    target_user = User(
        id="usr-test-target-02",
        username="target_cashier_02",
        hashed_password="hash",
        role=UserRole.CASHIER,
        company_id=comp.id,
        branch_id=branch.id,
        full_name="Target Cashier Two",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(target_user)
    await db_session.commit()

    headers = _make_auth_headers(admin_user, comp, branch_id="NON_EXISTENT_BRANCH_CODE")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "fullName": "Target Cashier Two",
            "branch": "Andheri West, Mumbai",
            "designation": "Cashier",
        }
        res = await client.patch(f"/api/v1/staff/directory/{target_user.id}/profile", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        body = res.json()
        assert body["fullName"] == "Target Cashier Two"


@pytest.mark.asyncio
async def test_patch_profile_new_staff_member_creates_profile_and_history(db_session):
    """Verify that a user without an existing StaffProfile gets one created with history."""
    comp, branch, admin_user = await _setup_test_context(db_session)
    target_user = User(
        id="usr-test-orphan-03",
        username="target_cashier_03",
        hashed_password="hash",
        role=UserRole.CASHIER,
        company_id=comp.id,
        branch_id=branch.id,
        full_name="Orphan Cashier Three",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(target_user)
    await db_session.commit()

    headers = _make_auth_headers(admin_user, comp)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "fullName": "Orphan Cashier Three Initialized",
            "employeeId": "EMP-9001",
            "designation": "Sales Executive",
        }
        res = await client.patch(f"/api/v1/staff/directory/{target_user.id}/profile", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

    # Verify database state
    p_row = (await db_session.execute(select(StaffProfile).where(
        StaffProfile.user_id == target_user.id,
        StaffProfile.company_id == comp.id,
    ))).scalar_one_or_none()
    assert p_row is not None
    assert p_row.full_name == "Orphan Cashier Three Initialized"

    h_row = (await db_session.execute(select(StaffProfileHistory).where(
        StaffProfileHistory.user_id == target_user.id,
        StaffProfileHistory.company_id == comp.id,
    ))).scalars().all()
    assert len(h_row) >= 1
    assert h_row[0].change_type == "CREATED"


@pytest.mark.asyncio
async def test_patch_profile_reactivates_soft_deleted_profile(db_session):
    """Verify that a soft-deleted profile is reactivated without unique constraint violation."""
    comp, branch, admin_user = await _setup_test_context(db_session)
    target_user = User(
        id="usr-test-softdel-04",
        username="target_cashier_04",
        hashed_password="hash",
        role=UserRole.CASHIER,
        company_id=comp.id,
        branch_id=branch.id,
        full_name="Soft Deleted Cashier Four",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(target_user)
    await db_session.flush()

    # Pre-existing soft-deleted profile
    deleted_profile = StaffProfile(
        id="stp-test-del-04",
        user_id=target_user.id,
        company_id=comp.id,
        branch_id=branch.id,
        full_name="Original Cashier",
        is_deleted=True,
        deleted_at=datetime.now(timezone.utc),
    )
    db_session.add(deleted_profile)
    await db_session.commit()

    headers = _make_auth_headers(admin_user, comp)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "fullName": "Reactivated Cashier Four",
            "status": "Active",
        }
        res = await client.patch(f"/api/v1/staff/directory/{target_user.id}/profile", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

    # Verify profile was reactivated
    await db_session.refresh(deleted_profile)
    assert deleted_profile.is_deleted is False
    assert deleted_profile.deleted_at is None
    assert deleted_profile.full_name == "Reactivated Cashier Four"


@pytest.mark.asyncio
async def test_patch_profile_string_limits_clamped(db_session):
    """Verify that string inputs exceeding column limits are clamped without DB error."""
    comp, branch, admin_user = await _setup_test_context(db_session)
    target_user = User(
        id="usr-test-oversize-05",
        username="target_cashier_05",
        hashed_password="hash",
        role=UserRole.CASHIER,
        company_id=comp.id,
        branch_id=branch.id,
        full_name="Oversized Input Staff",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(target_user)
    await db_session.commit()

    headers = _make_auth_headers(admin_user, comp)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "fullName": "A" * 250,  # Limit is 200
            "gender": "Non-binary and other categories",  # Limit is 10
            "pinCode": "400053-1234567890",  # Limit is 10
            "dateOfBirth": "1990-01-01T00:00:00.000Z",  # Limit is 20
            "alternateMobile": "91-9876543210-extension-99",  # Limit is 20
        }
        res = await client.patch(f"/api/v1/staff/directory/{target_user.id}/profile", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

    # Verify in DB that strings were clamped
    p_row = (await db_session.execute(select(StaffProfile).where(
        StaffProfile.user_id == target_user.id,
        StaffProfile.company_id == comp.id,
    ))).scalar_one_or_none()
    assert p_row is not None
    assert len(p_row.full_name) <= 200
    assert len(p_row.gender) <= 10
    assert len(p_row.pin_code) <= 10
    assert len(p_row.date_of_birth) <= 20


@pytest.mark.asyncio
async def test_patch_profile_central_user_with_null_company_id(db_session):
    """Verify that a central user (company_id=None) can be edited from active company."""
    comp, branch, admin_user = await _setup_test_context(db_session)
    central_user = User(
        id="usr-central-admin-06",
        username="central_admin_06",
        hashed_password="hash",
        role=UserRole.MANAGER,
        company_id=None,  # Central control-plane identity
        branch_id=None,
        full_name="Central Executive Six",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(central_user)
    await db_session.commit()

    headers = _make_auth_headers(admin_user, comp)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "fullName": "Central Executive Six Updated",
            "department": "Retail HQ",
        }
        res = await client.patch(f"/api/v1/staff/directory/{central_user.id}/profile", json=payload, headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        body = res.json()
        assert body["fullName"] == "Central Executive Six Updated"
