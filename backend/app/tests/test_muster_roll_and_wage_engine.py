#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 3.17.0
#  Created      : 2026-10-14
#  Modified     : 2026-10-14
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Internal

"""
Unit and Integration Tests for Muster Roll Matrix, Daily Wage, Monthly Salary with LOP,
WEEKLY_OFF Status, CSV Export, and Payroll Finalization.
"""

import json
import uuid
from datetime import date, datetime, timezone, timedelta
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.hr import AttendanceRecord, WageStatement
from app.models.staff_profile import StaffProfile
from app.schemas.user import SalaryStructure
from app.services.wage_calculation_service import WageCalculationService, compute_employee_wages
from app.tests.conftest import clear_db


# ---------------------------------------------------------------------------
# Unit Tests (Deterministic Math & Schema Invariants)
# ---------------------------------------------------------------------------

def test_daily_casual_worker_wage_computation():
    """Validates daily-rate worker pay: days + half-days + overtime + allowances + commissions."""
    salary_data = {
        "wageType": "DAILY",
        "dailyRate": 700.0,
        "overtimeRatePerHour": 100.0,
        "otherAllowances": {"da": 50.0, "fuel": 50.0},
        "travelAllowance": {"value": 100.0},
    }
    attendance = {
        "present_days": 20.0,
        "half_days": 2.0,
        "absent_days": 4.0,
        "paid_leave_days": 0.0,
        "weekly_off_days": 4.0,
        "holiday_days": 1.0,
        "overtime_hours": 6.0,
    }
    # 20 present + 2 half days = 21 effective days * 700 = 14,700
    # Overtime: 6h * 100 = 600
    # Allowances: 50 + 50 + 100 = 200
    # Commission: 500
    # Total Gross & Net: 14700 + 600 + 200 + 500 = 16,000.0 (no LOP deduction)
    result = compute_employee_wages(salary_data, attendance, working_days=26.0, commission_earned=500.0)

    assert result["wage_type"] == "DAILY"
    assert result["base_rate"] == 700.0
    assert result["base_earnings"] == 14700.0
    assert result["overtime_earnings"] == 600.0
    assert result["allowances_amount"] == 200.0
    assert result["commission_amount"] == 500.0
    assert result["lop_deduction"] == 0.0
    assert result["gross_wages"] == 16000.0
    assert result["net_wages"] == 16000.0


def test_monthly_salaried_worker_with_lop_deduction():
    """Validates monthly employee salary with Loss of Pay (LOP) for unexcused absences."""
    salary_data = {
        "wageType": "MONTHLY",
        "fixedMonthly": 26000.0,
        "overtimeRatePerHour": 150.0,
        "otherAllowances": {},
        "travelAllowance": {},
    }
    attendance = {
        "present_days": 22.0,
        "half_days": 2.0,
        "absent_days": 2.0,
        "paid_leave_days": 1.0,
        "weekly_off_days": 4.0,
        "holiday_days": 1.0,
        "overtime_hours": 4.0,
    }
    # Working days = 26.
    # Effective present = 22 + (0.5 * 2) + 1 (leave) = 24.0.
    # LOP days = 26 - 24 = 2.0.
    # Per day rate = 26,000 / 26 = 1,000.0.
    # LOP deduction = 2 * 1000 = 2,000.0.
    # Overtime: 4h * 150 = 600.0.
    # Gross = 26,000 + 600 = 26,600.0.
    # Net = 26,600 - 2,000 = 24,600.0.
    result = compute_employee_wages(salary_data, attendance, working_days=26.0, commission_earned=0.0)

    assert result["wage_type"] == "MONTHLY"
    assert result["base_rate"] == 26000.0
    assert result["working_days"] == 26.0
    assert result["lop_days"] == 2.0
    assert result["lop_deduction"] == 2000.0
    assert result["overtime_earnings"] == 600.0
    assert result["gross_wages"] == 26600.0
    assert result["net_wages"] == 24600.0


def test_salary_structure_schema_validation():
    """Ensures SalaryStructure supports wageType, dailyRate, overtimeRatePerHour with sanitizers."""
    struct = SalaryStructure(
        wageType="daily",
        dailyRate="850.50",
        overtimeRatePerHour="120.00",
    )
    assert struct.wageType == "DAILY"
    assert struct.dailyRate == 850.50
    assert struct.overtimeRatePerHour == 120.00

    # Default fallback
    struct_default = SalaryStructure()
    assert struct_default.wageType == "MONTHLY"
    assert struct_default.dailyRate == 0.0
    assert struct_default.fixedMonthly == 25000.0


def test_period_dates_parsing():
    """Validates month day range parser."""
    s, e, total = WageCalculationService._parse_period_dates("2026-10")
    assert s == date(2026, 10, 1)
    assert e == date(2026, 10, 31)
    assert total == 31

    s_feb, e_feb, total_feb = WageCalculationService._parse_period_dates("2026-02")
    assert s_feb == date(2026, 2, 1)
    assert e_feb == date(2026, 2, 28)
    assert total_feb == 28


# ---------------------------------------------------------------------------
# Integration Tests with Async Database & FastAPI Endpoints
# ---------------------------------------------------------------------------

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


async def _setup_test_environment(db_session, suffix="test"):
    company = Company(
        id=f"comp-hr-{suffix}",
        name=f"HR Test Co {suffix}",
        gst_number="27AABCU9603R1ZM",
        is_active=True,
    )
    db_session.add(company)
    await db_session.commit()

    branch = Branch(
        id=f"br-hr-{suffix}",
        company_id=company.id,
        name=f"Main Store {suffix}",
        code=f"BR-{suffix.upper()}",
        is_active=True,
    )
    db_session.add(branch)
    await db_session.commit()

    # Manager user
    manager = User(
        id=f"usr-mgr-{suffix}",
        username=f"manager_{suffix}",
        email=f"mgr_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.MANAGER,
        company_id=company.id,
        is_active=True,
    )
    # Daily staff user
    staff_daily = User(
        id=f"usr-daily-{suffix}",
        username=f"casual_{suffix}",
        email=f"casual_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        company_id=company.id,
        is_active=True,
    )
    # Monthly staff user
    staff_monthly = User(
        id=f"usr-monthly-{suffix}",
        username=f"salaried_{suffix}",
        email=f"salaried_{suffix}@test.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        company_id=company.id,
        is_active=True,
    )
    db_session.add_all([manager, staff_daily, staff_monthly])
    await db_session.commit()

    # Staff profiles
    p_daily = StaffProfile(
        id=f"stp-daily-{suffix}",
        user_id=staff_daily.id,
        company_id=company.id,
        employee_code="EMP-D01",
        full_name="Casual Worker Dave",
        department="Logistics",
        designation="Daily Loader",
        salary_json=json.dumps({
            "wageType": "DAILY",
            "dailyRate": 600.0,
            "overtimeRatePerHour": 80.0,
        }),
        is_active=True,
    )
    p_monthly = StaffProfile(
        id=f"stp-monthly-{suffix}",
        user_id=staff_monthly.id,
        company_id=company.id,
        employee_code="EMP-M01",
        full_name="Salaried Employee Sarah",
        department="Retail",
        designation="Store Cashier",
        salary_json=json.dumps({
            "wageType": "MONTHLY",
            "fixedMonthly": 26000.0,
            "overtimeRatePerHour": 120.0,
        }),
        is_active=True,
    )
    db_session.add_all([p_daily, p_monthly])
    await db_session.commit()

    return company, branch, manager, staff_daily, staff_monthly


@pytest.mark.asyncio
async def test_weekly_off_attendance_and_summary(db_session):
    """Verifies that WEEKLY_OFF status can be recorded and is properly aggregated in summary."""
    company, branch, manager, staff_daily, _ = await _setup_test_environment(db_session, "wo")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(
        company_id=company.id,
        branch_id=branch.id,
    )
    app.dependency_overrides[get_current_user] = lambda: manager

    token = create_access_token({"sub": manager.id, "company_id": company.id, "role": manager.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Post WEEKLY_OFF attendance
        att_res = await ac.post(
            "/api/v1/staff/attendance",
            json={
                "user_id": staff_daily.id,
                "attendance_date": "2026-10-04",
                "status": "WEEKLY_OFF",
            },
            headers=headers,
        )
        assert att_res.status_code == 201, att_res.text
        assert att_res.json()["status"] == "WEEKLY_OFF"

        # 2. Check summary aggregates weekly_off_days
        sum_res = await ac.get(
            f"/api/v1/staff/attendance/summary?user_id={staff_daily.id}&period=2026-10",
            headers=headers,
        )
        assert sum_res.status_code == 200, sum_res.text
        data = sum_res.json()
        assert data["weekly_off_days"] == 1


@pytest.mark.asyncio
async def test_muster_roll_matrix_and_csv_export(db_session):
    """Verifies Form II Muster Roll 1..31 day matrix generation and CSV export."""
    company, branch, manager, staff_daily, staff_monthly = await _setup_test_environment(db_session, "mr")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(
        company_id=company.id,
        branch_id=branch.id,
    )
    app.dependency_overrides[get_current_user] = lambda: manager

    # Seed attendance punches across days
    d1 = AttendanceRecord(
        id=f"att-{uuid.uuid4().hex[:10]}",
        company_id=company.id,
        user_id=staff_daily.id,
        attendance_date=date(2026, 10, 1),
        status="PRESENT",
        check_in_at=datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc),
        check_out_at=datetime(2026, 10, 1, 18, 0, tzinfo=timezone.utc),  # 9 hrs -> 1h OT
    )
    d2 = AttendanceRecord(
        id=f"att-{uuid.uuid4().hex[:10]}",
        company_id=company.id,
        user_id=staff_daily.id,
        attendance_date=date(2026, 10, 2),
        status="HALF_DAY",
    )
    db_session.add_all([d1, d2])
    await db_session.commit()

    token = create_access_token({"sub": manager.id, "company_id": company.id, "role": manager.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Fetch Muster Roll Matrix
        matrix_res = await ac.get(
            "/api/v1/staff/attendance/muster-roll?period=2026-10",
            headers=headers,
        )
        assert matrix_res.status_code == 200, matrix_res.text
        matrix = matrix_res.json()
        assert matrix["period"] == "2026-10"
        assert matrix["days_in_month"] == 31
        assert matrix["total_employees"] == 2

        # Check day 1 is "P" and day 2 is "HD" for Dave
        dave_row = next(r for r in matrix["rows"] if r["user_id"] == staff_daily.id)
        assert dave_row["days"]["1"]["code"] == "P"
        assert dave_row["days"]["2"]["code"] == "HD"
        assert dave_row["days"]["3"]["code"] == "-"  # unrecorded
        assert dave_row["summary"]["present_days"] == 1.0
        assert dave_row["summary"]["half_days"] == 1.0
        assert dave_row["summary"]["total_overtime_hours"] == 1.0

        # 2. Export Muster Roll CSV
        csv_res = await ac.get(
            "/api/v1/staff/attendance/muster-roll/export-csv?period=2026-10",
            headers=headers,
        )
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers.get("content-type", "")
        csv_text = csv_res.text
        assert "FORM II - MUSTER ROLL" in csv_text
        assert "EMP-D01" in csv_text
        assert "Casual Worker Dave" in csv_text


@pytest.mark.asyncio
async def test_wage_calculation_and_finalization_lifecycle(db_session):
    """Verifies wage calculation, draft preview, and immutable statement finalization."""
    company, branch, manager, staff_daily, _ = await _setup_test_environment(db_session, "wage")

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(
        company_id=company.id,
        branch_id=branch.id,
    )
    app.dependency_overrides[get_current_user] = lambda: manager

    # Seed 10 present days for staff_daily at 600/day
    for d in range(1, 11):
        db_session.add(
            AttendanceRecord(
                id=f"att-w-{d}-{uuid.uuid4().hex[:6]}",
                company_id=company.id,
                user_id=staff_daily.id,
                attendance_date=date(2026, 10, d),
                status="PRESENT",
            )
        )
    await db_session.commit()

    token = create_access_token({"sub": manager.id, "company_id": company.id, "role": manager.role.value})
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Calculate Wages
        calc_res = await ac.post(
            "/api/v1/staff/wages/calculate",
            json={"period": "2026-10", "user_id": staff_daily.id},
            headers=headers,
        )
        assert calc_res.status_code == 200, calc_res.text
        wages = calc_res.json()["wages"]
        assert len(wages) == 1
        w = wages[0]
        assert w["user_id"] == staff_daily.id
        assert w["wage_type"] == "DAILY"
        assert w["base_rate"] == 600.0
        assert w["present_days"] == 10.0
        assert w["net_wages"] == 6000.0
        assert w["is_finalized"] is False

        # 2. Finalize Wages (Freeze)
        fin_res = await ac.post(
            "/api/v1/staff/wages/finalize",
            json={
                "period": "2026-10",
                "user_id": staff_daily.id,
                "notes": "Approved for early festival payout",
            },
            headers=headers,
        )
        assert fin_res.status_code == 200, fin_res.text
        fin_data = fin_res.json()
        assert fin_data["status"] == "FINALIZED"
        assert fin_data["net_wages"] == 6000.0

        # 3. Subsequent calculations must return the frozen statement
        calc_after = await ac.post(
            "/api/v1/staff/wages/calculate",
            json={"period": "2026-10", "user_id": staff_daily.id},
            headers=headers,
        )
        assert calc_after.json()["wages"][0]["is_finalized"] is True
        assert calc_after.json()["wages"][0]["status"] == "FINALIZED"
