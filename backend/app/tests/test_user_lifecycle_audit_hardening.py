"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-07
Modified     : 2026-10-07
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from fastapi import HTTPException
from sqlalchemy.future import select

from app.api.deps import TenantContext
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from app.models.security import SmritiAuditLog
from app.schemas.user import StaffUserCreate, StaffUserUpdate, UserCreate, UserUpdate
from app.services.user import UserService


@pytest.fixture
async def setup_test_context(db_session):
    """Seed test company, branch, SYSADMIN actor, and MANAGER actor."""
    suffix = uuid.uuid4().hex[:6]
    company = Company(
        id=f"comp-{suffix}",
        name=f"Test Enterprise {suffix}",
        company_code=f"C{suffix[:4].upper()}",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(company)
    await db_session.flush()

    branch = Branch(
        id=f"br-{suffix}",
        company_id=company.id,
        name=f"Main Branch {suffix}",
        code=f"B{suffix[:4].upper()}",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(branch)
    await db_session.flush()

    sysadmin = User(
        id=f"adm-{suffix}",
        username=f"admin_{suffix}",
        hashed_password="hashed_pw_test",
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
        status="Active",
    )
    db_session.add(sysadmin)

    manager = User(
        id=f"mgr-{suffix}",
        username=f"mgr_{suffix}",
        hashed_password="hashed_pw_test",
        role=UserRole.MANAGER,
        company_id=company.id,
        branch_id=branch.id,
        is_active=True,
        is_deleted=False,
        status="Active",
    )
    db_session.add(manager)
    await db_session.flush()

    tenant = TenantContext(company_id=company.id, branch_id=branch.id)
    return {
        "company": company,
        "branch": branch,
        "sysadmin": sysadmin,
        "manager": manager,
        "tenant": tenant,
    }


class TestUserLifecycleSecurityHardening:
    """Tests AUD-USR-01: Privilege Escalation Prevention."""

    async def test_prevent_non_sysadmin_creating_sysadmin(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])
        req = StaffUserCreate(
            username=f"escalate_{uuid.uuid4().hex[:5]}",
            fullName="Hacker User",
            role=UserRole.SYSADMIN,
            password="StrongPassword123!",
            branchId=ctx["branch"].id,
        )

        # Manager actor attempting to create SYSADMIN
        with pytest.raises(HTTPException) as exc_info:
            await service.create_staff_user(req, requesting_user=ctx["manager"])
        assert exc_info.value.status_code == 403
        assert "Only a SYSADMIN can create another SYSADMIN user" in exc_info.value.detail

    async def test_sysadmin_can_create_sysadmin(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])
        req = StaffUserCreate(
            username=f"legit_adm_{uuid.uuid4().hex[:5]}",
            fullName="Legit Admin",
            role=UserRole.SYSADMIN,
            password="StrongPassword123!",
            branchId=ctx["branch"].id,
        )

        res = await service.create_staff_user(req, requesting_user=ctx["sysadmin"])
        assert res.role == UserRole.SYSADMIN
        assert res.fullName == "Legit Admin"

    async def test_prevent_non_sysadmin_modifying_roles(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])

        # Create normal cashier
        create_req = StaffUserCreate(
            username=f"cashier_{uuid.uuid4().hex[:5]}",
            fullName="Retail Cashier",
            role=UserRole.CASHIER,
            password="StrongPassword123!",
            branchId=ctx["branch"].id,
        )
        cashier = await service.create_staff_user(create_req, requesting_user=ctx["sysadmin"])

        # Manager attempts to elevate cashier to SYSADMIN
        update_req = StaffUserUpdate(role=UserRole.SYSADMIN)
        with pytest.raises(HTTPException) as exc_info:
            await service.update_staff_user(cashier.id, update_req, requesting_user=ctx["manager"])
        assert exc_info.value.status_code == 403
        assert "Only a SYSADMIN can assign or modify user roles" in exc_info.value.detail


class TestAdministrativeLockoutProtection:
    """Tests AUD-USR-02: Last Active SYSADMIN Lockout Prevention."""

    async def test_prevent_demoting_or_inactivating_last_sysadmin(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])

        # Ensure ctx["sysadmin"] is the only active SYSADMIN in this test DB
        q_other = select(User).where(
            User.role == UserRole.SYSADMIN,
            User.id != ctx["sysadmin"].id,
            User.is_deleted == False,
            User.is_active == True,
        )
        other_admins = (await db_session.execute(q_other)).scalars().all()
        for a in other_admins:
            a.is_active = False
            a.is_deleted = True
        await db_session.flush()

        # Demote sole SYSADMIN -> Must fail
        update_req = StaffUserUpdate(role=UserRole.VIEWER)
        with pytest.raises(HTTPException) as exc_info:
            await service.update_staff_user(ctx["sysadmin"].id, update_req, requesting_user=ctx["sysadmin"])
        assert exc_info.value.status_code == 400
        assert "Cannot demote the last active SYSADMIN" in exc_info.value.detail

        # Inactivate sole SYSADMIN -> Must fail
        deact_req = StaffUserUpdate(status="Inactive")
        with pytest.raises(HTTPException) as exc_info2:
            await service.update_staff_user(ctx["sysadmin"].id, deact_req, requesting_user=ctx["sysadmin"])
        assert exc_info2.value.status_code == 400
        assert "deactivate" in exc_info2.value.detail.lower()

    async def test_prevent_self_deactivation(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])

        with pytest.raises(HTTPException) as exc_info:
            await service.deactivate_staff(ctx["manager"].id, ctx["manager"].id)
        assert exc_info.value.status_code == 400
        assert "cannot delete your own active operator profile" in exc_info.value.detail.lower()


class TestUserReactivationAndGhostUsers:
    """Tests AUD-USR-03: Reactivation and Inactive User Querying."""

    async def test_deactivate_and_reactivate_lifecycle(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])

        # Create staff operator
        create_req = StaffUserCreate(
            username=f"op_{uuid.uuid4().hex[:5]}",
            fullName="Floor Operator",
            role=UserRole.CASHIER,
            password="StrongPassword123!",
            branchId=ctx["branch"].id,
        )
        created = await service.create_staff_user(create_req, requesting_user=ctx["manager"])

        # Deactivate staff operator
        await service.deactivate_staff(created.id, ctx["manager"].id)

        # Standard list_staff must not show deleted operator
        _, active_list = await service.list_staff(status_filter="Active", tenant=ctx["tenant"])
        assert not any(u.id == created.id for u in active_list)

        # Inactive filter (used by LockedUsersView) MUST find operator
        total_inactive, inactive_list = await service.list_staff(status_filter="Inactive", tenant=ctx["tenant"])
        assert any(u.id == created.id for u in inactive_list)

        # Reactivate operator via update_staff_user (Unlock button action)
        unlock_req = StaffUserUpdate(status="Active")
        restored = await service.update_staff_user(created.id, unlock_req, requesting_user=ctx["manager"])
        assert restored.status == "Active"

        # Verify database entity status
        db_user = await service.get_user(created.id)
        assert db_user.is_active is True
        assert db_user.is_deleted is False
        assert db_user.status == "Active"


class TestRelationalAssignmentAndAuditJournal:
    """Tests AUD-USR-04 & AUD-USR-07: Relational Sync & Audit Logging."""

    async def test_auto_enroll_assignments(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])

        req = StaffUserCreate(
            username=f"assigned_{uuid.uuid4().hex[:5]}",
            fullName="Assigned User",
            role=UserRole.CASHIER,
            password="StrongPassword123!",
            branchId=ctx["branch"].id,
        )
        created = await service.create_staff_user(req, requesting_user=ctx["manager"])

        # Check UserCompanyAssignment
        q_uca = select(UserCompanyAssignment).where(
            UserCompanyAssignment.user_id == created.id,
            UserCompanyAssignment.company_id == ctx["company"].id,
        )
        uca = (await db_session.execute(q_uca)).scalars().first()
        assert uca is not None
        assert uca.is_default is True

        # Check UserBranchAssignment
        q_uba = select(UserBranchAssignment).where(
            UserBranchAssignment.user_id == created.id,
            UserBranchAssignment.branch_id == ctx["branch"].id,
        )
        uba = (await db_session.execute(q_uba)).scalars().first()
        assert uba is not None
        assert uba.is_default is True

    async def test_audit_logs_recorded_for_lifecycle_events(self, db_session, setup_test_context):
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])

        # Create
        req = StaffUserCreate(
            username=f"audited_{uuid.uuid4().hex[:5]}",
            fullName="Audited User",
            role=UserRole.CASHIER,
            password="StrongPassword123!",
            branchId=ctx["branch"].id,
        )
        created = await service.create_staff_user(req, requesting_user=ctx["manager"])

        # Update
        update_req = StaffUserUpdate(displayName="Audited Nickname")
        await service.update_staff_user(created.id, update_req, requesting_user=ctx["manager"])

        # Deactivate
        await service.deactivate_staff(created.id, ctx["manager"].id)

        # Reactivate
        reactivate_req = StaffUserUpdate(status="Active")
        await service.update_staff_user(created.id, reactivate_req, requesting_user=ctx["manager"])

        # Query audit logs
        q_audit = select(SmritiAuditLog).where(
            SmritiAuditLog.changed_record_id == created.id,
        ).order_by(SmritiAuditLog.changed_at.asc())
        logs = (await db_session.execute(q_audit)).scalars().all()

        change_types = [l.change_type for l in logs]
        assert "USER_CREATED" in change_types
        assert "USER_UPDATED" in change_types
        assert "USER_DEACTIVATED" in change_types
        assert "USER_REACTIVATED" in change_types

    async def test_active_pos_shift_blocks_deactivation(self, db_session, setup_test_context, monkeypatch):
        from unittest.mock import AsyncMock, MagicMock
        ctx = setup_test_context
        service = UserService(db_session, tenant=ctx["tenant"])

        create_req = StaffUserCreate(
            username=f"cashier_shift_{uuid.uuid4().hex[:5]}",
            fullName="Shift Cashier",
            role=UserRole.CASHIER,
            password="StrongPassword123!",
            branchId=ctx["branch"].id,
        )
        created = await service.create_staff_user(create_req, requesting_user=ctx["manager"])

        mock_shift_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = "shift-open-999"
        mock_shift_session.execute.return_value = mock_result

        class MockSessionContext:
            async def __aenter__(self):
                return mock_shift_session
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass

        mock_sessionmaker = MagicMock(return_value=MockSessionContext())

        monkeypatch.setattr("app.db.session.resolve_company_database_name", AsyncMock(return_value="smriti001"))
        monkeypatch.setattr("app.db.session.get_company_sessionmaker", MagicMock(return_value=mock_sessionmaker))

        with pytest.raises(HTTPException) as exc_info:
            await service.deactivate_staff(created.id, ctx["manager"].id)
        assert exc_info.value.status_code == 400
        assert "active OPEN POS shift (shift-open-999)" in exc_info.value.detail
