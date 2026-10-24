# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Version      : 3.17.0
# Created      : 2026-10-15
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# Classification: Internal / Bulk Attendance Security & Integrity Test Suite

"""
Security, Authorization, Tenant Isolation, and Integrity Verification for Bulk Attendance:
1. Role-based access control (SYSADMIN, ADMIN, MANAGER, STORE_MANAGER, BRANCH_ADMIN, HR_EXECUTIVE vs CASHIER/VIEWER)
2. Cross-company tenant isolation
3. Cross-branch isolation for branch-scoped managers vs SYSADMIN global access
4. Payroll lock protection against finalized wage statements
5. Biometric and check-in/out record preservation
6. Mixed-status batch processing (7 canonical statuses)
7. Immutable compliance audit logging
"""

import json
import uuid
from datetime import date, datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.hr import AttendanceRecord, WageStatement
from app.models.staff_profile import StaffProfile
from app.models.audit import ComplianceImmutableAuditLog


async def _setup_bulk_fixture(db_session, suffix: str):
    cid = f"comp-bulk-{suffix}"
    bid1 = f"br-main-{suffix}"
    bid2 = f"br-north-{suffix}"

    company = Company(
        id=cid,
        name=f"Bulk Test Company {suffix}",
        is_active=True,
    )
    branch1 = Branch(
        id=bid1,
        company_id=cid,
        code=f"BM_{suffix[:4]}",
        name="Main Branch",
        is_active=True,
    )
    branch2 = Branch(
        id=bid2,
        company_id=cid,
        code=f"BN_{suffix[:4]}",
        name="North Branch",
        is_active=True,
    )
    db_session.add_all([company, branch1, branch2])
    await db_session.commit()

    # Operators
    mgr_b1 = User(
        id=f"usr-mgr1-{suffix}",
        username=f"mgr1_{suffix}",
        email=f"mgr1_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.MANAGER,
        company_id=cid,
        branch_id=bid1,
        is_active=True,
    )
    hr_exec = User(
        id=f"usr-hr-{suffix}",
        username=f"hr_{suffix}",
        email=f"hr_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.HR_EXECUTIVE,
        company_id=cid,
        branch_id=bid1,
        is_active=True,
    )
    sysadmin = User(
        id=f"usr-sys-{suffix}",
        username=f"sys_{suffix}",
        email=f"sys_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.SYSADMIN,
        company_id=cid,
        is_active=True,
    )
    cashier = User(
        id=f"usr-cash-{suffix}",
        username=f"cash_{suffix}",
        email=f"cash_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        company_id=cid,
        branch_id=bid1,
        is_active=True,
    )

    # Employees
    emp_b1 = User(
        id=f"usr-emp1-{suffix}",
        username=f"emp1_{suffix}",
        email=f"emp1_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        company_id=cid,
        branch_id=bid1,
        is_active=True,
    )
    emp_b2 = User(
        id=f"usr-emp2-{suffix}",
        username=f"emp2_{suffix}",
        email=f"emp2_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        company_id=cid,
        branch_id=bid2,
        is_active=True,
    )
    db_session.add_all([mgr_b1, hr_exec, sysadmin, cashier, emp_b1, emp_b2])
    await db_session.commit()

    # Foreign company user
    foreign_comp = Company(id=f"comp-foreign-{suffix}", name="Foreign Co", is_active=True)
    foreign_user = User(
        id=f"usr-foreign-{suffix}",
        username=f"foreign_{suffix}",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        company_id=foreign_comp.id,
        is_active=True,
    )
    db_session.add_all([foreign_comp, foreign_user])
    await db_session.commit()

    return company, branch1, branch2, mgr_b1, hr_exec, sysadmin, cashier, emp_b1, emp_b2, foreign_user


@pytest.mark.asyncio
async def test_unauthorized_roles_blocked_403(db_session):
    """CASHIER role must receive HTTP 403 Forbidden on bulk attendance."""
    company, branch1, _, _, _, _, cashier, emp_b1, _, _ = await _setup_bulk_fixture(db_session, "rb_blk")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=company.id, branch_id=branch1.id)
    app.dependency_overrides[get_current_user] = lambda: cashier

    token = create_access_token({"sub": cashier.id, "company_id": company.id, "role": cashier.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/staff/attendance/bulk",
            json=[{"user_id": emp_b1.id, "attendance_date": "2026-10-15", "status": "PRESENT"}],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert "Manager or HR authorization is required" in res.json()["detail"]


@pytest.mark.asyncio
async def test_cross_company_isolation(db_session):
    """Attempt to mark attendance for a user belonging to another company is rejected."""
    company, branch1, _, mgr_b1, _, _, _, _, _, foreign_user = await _setup_bulk_fixture(db_session, "co_iso")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=company.id, branch_id=branch1.id)
    app.dependency_overrides[get_current_user] = lambda: mgr_b1

    token = create_access_token({"sub": mgr_b1.id, "company_id": company.id, "role": mgr_b1.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/staff/attendance/bulk",
            json=[{"user_id": foreign_user.id, "attendance_date": "2026-10-15", "status": "PRESENT"}],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["created"] == 0
        assert data["errors"] == 1
        assert "Staff member not found in this company" in data["error_records"][0]["error"]


@pytest.mark.asyncio
async def test_cross_branch_isolation_for_branch_manager(db_session):
    """Branch manager of Main Branch cannot mark attendance for an employee of North Branch."""
    company, branch1, _, mgr_b1, _, _, _, _, emp_b2, _ = await _setup_bulk_fixture(db_session, "br_iso")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=company.id, branch_id=branch1.id)
    app.dependency_overrides[get_current_user] = lambda: mgr_b1

    token = create_access_token({"sub": mgr_b1.id, "company_id": company.id, "role": mgr_b1.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/staff/attendance/bulk",
            json=[{"user_id": emp_b2.id, "attendance_date": "2026-10-15", "status": "PRESENT"}],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["created"] == 0
        assert data["errors"] == 1
        assert "not authorized for your branch" in data["error_records"][0]["error"]


@pytest.mark.asyncio
async def test_sysadmin_can_mark_across_branches(db_session):
    """SYSADMIN can mark attendance for employees across different branches."""
    company, branch1, _, _, _, sysadmin, _, emp_b1, emp_b2, _ = await _setup_bulk_fixture(db_session, "sys_all")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=company.id, branch_id=branch1.id)
    app.dependency_overrides[get_current_user] = lambda: sysadmin

    token = create_access_token({"sub": sysadmin.id, "company_id": company.id, "role": sysadmin.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/staff/attendance/bulk",
            json=[
                {"user_id": emp_b1.id, "attendance_date": "2026-10-15", "status": "PRESENT"},
                {"user_id": emp_b2.id, "attendance_date": "2026-10-15", "status": "PRESENT"},
            ],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["created"] == 2
        assert data["errors"] == 0


@pytest.mark.asyncio
async def test_payroll_finalization_locks_attendance(db_session):
    """When a wage statement is finalized for a period, bulk attendance for that period is locked."""
    company, branch1, _, mgr_b1, _, _, _, emp_b1, _, _ = await _setup_bulk_fixture(db_session, "pay_lock")

    # Freeze 2026-09 wage statement
    stmt = WageStatement(
        id=f"wgs-{uuid.uuid4().hex[:10]}",
        company_id=company.id,
        user_id=emp_b1.id,
        period="2026-09",
        wage_type="MONTHLY",
        base_rate=25000.0,
        working_days=26.0,
        present_days=26.0,
        net_wages=25000.0,
        status="FINALIZED",
        finalized_by=mgr_b1.id,
        finalized_at=datetime.now(timezone.utc),
    )
    db_session.add(stmt)
    await db_session.commit()

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=company.id, branch_id=branch1.id)
    app.dependency_overrides[get_current_user] = lambda: mgr_b1

    token = create_access_token({"sub": mgr_b1.id, "company_id": company.id, "role": mgr_b1.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/staff/attendance/bulk",
            json=[{"user_id": emp_b1.id, "attendance_date": "2026-09-20", "status": "PRESENT"}],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["created"] == 0
        assert data["skipped"] == 1
        assert "Payroll for period 2026-09 is finalized" in data["skipped_records"][0]["reason"]


@pytest.mark.asyncio
async def test_biometric_punch_preservation(db_session):
    """Existing biometric / clock-in attendance records are preserved and not overwritten."""
    company, branch1, _, mgr_b1, _, _, _, emp_b1, _, _ = await _setup_bulk_fixture(db_session, "bio_pres")

    # Seed an existing clock-in record
    rec = AttendanceRecord(
        id=f"att-{uuid.uuid4().hex[:10]}",
        company_id=company.id,
        branch_id=branch1.id,
        user_id=emp_b1.id,
        attendance_date=date(2026, 10, 15),
        status="PRESENT",
        check_in_at=datetime(2026, 10, 15, 9, 5, tzinfo=timezone.utc),
        device_source="BIOMETRIC_PUNCH",
        register_source="BIOMETRIC_HW",
    )
    db_session.add(rec)
    await db_session.commit()

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=company.id, branch_id=branch1.id)
    app.dependency_overrides[get_current_user] = lambda: mgr_b1

    token = create_access_token({"sub": mgr_b1.id, "company_id": company.id, "role": mgr_b1.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/staff/attendance/bulk",
            json=[{"user_id": emp_b1.id, "attendance_date": "2026-10-15", "status": "ABSENT", "correction_reason": "Bulk absence test"}],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["created"] == 0
        assert data["skipped"] == 1
        assert "biometric/punch record preserved" in data["skipped_records"][0]["reason"].lower()

    # Re-verify DB state — record is untouched
    fresh = (await db_session.execute(select(AttendanceRecord).where(AttendanceRecord.id == rec.id))).scalar_one()
    assert fresh.status == "PRESENT"
    assert fresh.device_source == "BIOMETRIC_PUNCH"


@pytest.mark.asyncio
async def test_mixed_status_batch_and_compliance_audit(db_session):
    """Verifies mixed-status batch processing and immutable compliance audit logging."""
    company, branch1, _, mgr_b1, hr_exec, _, _, emp_b1, _, _ = await _setup_bulk_fixture(db_session, "audit_log")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=company.id, branch_id=branch1.id)
    app.dependency_overrides[get_current_user] = lambda: hr_exec

    token = create_access_token({"sub": hr_exec.id, "company_id": company.id, "role": hr_exec.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/staff/attendance/bulk",
            json=[
                {"user_id": emp_b1.id, "attendance_date": "2026-10-01", "status": "PRESENT"},
                {"user_id": emp_b1.id, "attendance_date": "2026-10-02", "status": "LATE"},
                {"user_id": emp_b1.id, "attendance_date": "2026-10-03", "status": "HALF_DAY"},
                {"user_id": emp_b1.id, "attendance_date": "2026-10-04", "status": "WEEKLY_OFF"},
                {"user_id": emp_b1.id, "attendance_date": "2026-10-05", "status": "LEAVE", "correction_reason": "Approved sick leave"},
                {"user_id": emp_b1.id, "attendance_date": "2026-10-06", "status": "HOLIDAY"},
                {"user_id": emp_b1.id, "attendance_date": "2026-10-07", "status": "ABSENT", "correction_reason": "Unplanned absence"},
            ],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["created"] == 7
        assert data["skipped"] == 0
        assert data["errors"] == 0

    # Verify compliance immutable audit log
    audit_entry = (await db_session.execute(
        select(ComplianceImmutableAuditLog).where(
            ComplianceImmutableAuditLog.company_id == company.id,
            ComplianceImmutableAuditLog.event_type == "BULK_ATTENDANCE_RECORDED",
        ).order_by(ComplianceImmutableAuditLog.timestamp.desc())
    )).scalars().first()

    assert audit_entry is not None
    assert audit_entry.actor_user_id == hr_exec.id
    assert audit_entry.actor_role == UserRole.HR_EXECUTIVE.value
    assert audit_entry.payload_hash is not None
    assert len(audit_entry.payload_hash) == 64  # Valid SHA-256
    after_state = json.loads(audit_entry.after_state_json)
    assert after_state["created_count"] == 7
