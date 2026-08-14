"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire test DB session and clean up tables."""
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-staff-{suffix}", name=f"Staff Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-staff-{suffix}", company_id=comp.id,
                name=f"Staff Br {suffix}", code=f"BRSTF-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER, **kwargs):
    user = User(
        id=f"usr-staff-{suffix}", username=f"usr_staff_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
        **kwargs
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": comp_id, "branch_id": br_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(db_session, comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_staff_user_response_schema_verification(db_session):
    """
    Integration test asserting that all 35+ fields on StaffUserResponse
    (including salary, payment, performance, and HR json objects)
    populate correctly and are preserved across JSON serialization.
    """
    comp, br = await _make_tenant(db_session, "s1")
    _set_tenant(db_session, comp.id, br.id)

    # Define complex JSON payloads matching Pydantic schemas
    salary_payload = {
        "fixedMonthly": 25000.0,
        "commission": {"type": "Percentage", "value": 2.5},
        "travelAllowance": {"type": "Fixed", "value": 1500.0},
        "otherAllowances": {"da": 1000.0, "mobile": 500.0, "internet": 500.0, "fuel": 0.0}
    }
    payment_payload = {
        "frequency": "Monthly",
        "bankDetails": "HDFC Bank, Acct: 501002930293, IFSC: HDFC0000123",
        "upi": "staff@upi",
        "salaryEffectiveFrom": "2025-01-10",
        "commissionEffectiveFrom": "2025-01-10",
        "aadhaarNumber": "1234-5678-9012",
        "panNumber": "ABCDE1234F",
        "providentFundUan": "100293029301",
        "esicNumber": "31293029302930192",
        "fatherSpouseName": "Father Name",
        "bloodGroup": "O+",
        "maritalStatus": "Single",
        "permanentAddress": "Permanent address details"
    }
    performance_payload = {
        "attendancePercentage": 96.5,
        "monthlySales": 525000.0,
        "targetsAssigned": 500000.0,
        "targetsAchieved": 525000.0,
        "commissionEarned": 13125.0,
        "travelClaimStatus": "Approved"
    }
    preferences_payload = {
        "theme": "dark",
        "language": "English",
        "timeZone": "Asia/Kolkata"
    }
    notifications_payload = {
        "salaryCredit": True,
        "commissionEarned": True,
        "targetAchievement": True,
        "travelClaimApproval": True,
        "leaveApproval": True,
        "attendanceAlerts": True,
        "holidayWeeklyOff": True,
        "birthdayAnniversary": True,
        "policyAnnouncements": True
    }

    # Seed the staff user with all extended fields populated
    staff = await _make_user(
        db_session,
        "staff1",
        comp.id,
        br.id,
        role=UserRole.CASHIER,
        status="Active",
        employee_id="EMP-001",
        employee_code="E001",
        display_name="John Staff",
        full_name="Johnathan Staff Member",
        gender="Male",
        date_of_birth="1995-05-15",
        alternate_mobile="9876543211",
        emergency_contact="Jane Spouse - 9876543212",
        address="Flat 401, SMRITI Apartments, Andheri West",
        city="Mumbai",
        state="Maharashtra",
        country="India",
        pin_code="400053",
        department="POS Sales",
        designation="Senior Cashier",
        branch="Main Andheri Branch",
        date_of_joining="2025-01-10",
        reporting_manager="Jane Manager",
        employment_type="Permanent",
        allowed_branches=json.dumps([br.id]),
        photo="data:image/png;base64,abcdef",
        salary_json=json.dumps(salary_payload),
        payment_json=json.dumps(payment_payload),
        performance_json=json.dumps(performance_payload),
        preferences_json=json.dumps(preferences_payload),
        notification_settings_json=json.dumps(notifications_payload)
    )

    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/users/{staff.id}", headers=headers)

    assert res.status_code == 200
    data = res.json()

    # Verify all fields on StaffUserResponse serialize correctly without data loss
    assert data["id"] == staff.id
    assert data["userId"] == staff.id
    assert data["username"] == staff.username
    assert data["email"] == (staff.email or "")
    assert data["mobile"] == (staff.mobile or "0000000000")
    assert data["role"] == UserRole.CASHIER.value
    assert data["status"] == "Active"
    assert data["fullName"] == "Johnathan Staff Member"
    assert data["displayName"] == "John Staff"
    assert data["employeeId"] == "EMP-001"
    assert data["employeeCode"] == "E001"
    assert data["gender"] == "Male"
    assert data["dateOfBirth"] == "1995-05-15"
    assert data["alternateMobile"] == "9876543211"
    assert data["emergencyContact"] == "Jane Spouse - 9876543212"
    assert data["address"] == "Flat 401, SMRITI Apartments, Andheri West"
    assert data["city"] == "Mumbai"
    assert data["state"] == "Maharashtra"
    assert data["country"] == "India"
    assert data["pinCode"] == "400053"
    assert data["department"] == "POS Sales"
    assert data["designation"] == "Senior Cashier"
    assert data["branch"] == "Main Andheri Branch"
    assert data["departmentId"] is None
    assert data["designationId"] is None
    assert data["branchId"] == br.id
    assert data["dateOfJoining"] == "2025-01-10"
    assert data["reportingManager"] == "Jane Manager"
    assert data["employmentType"] == "Permanent"
    assert data["allowedBranches"] == [br.id]
    assert data["photo"] == "data:image/png;base64,abcdef"

    # Verify structured sub-objects are fully parsed
    assert data["salary"]["fixedMonthly"] == 25000.0
    assert data["payment"]["bankDetails"] == "HDFC Bank, Acct: 501002930293, IFSC: HDFC0000123"
    assert data["payment"]["aadhaarNumber"] == "1234-5678-9012"
    assert data["payment"]["panNumber"] == "ABCDE1234F"
    assert data["payment"]["providentFundUan"] == "100293029301"
    assert data["payment"]["esicNumber"] == "31293029302930192"
    assert data["payment"]["fatherSpouseName"] == "Father Name"
    assert data["payment"]["bloodGroup"] == "O+"
    assert data["payment"]["maritalStatus"] == "Single"
    assert data["payment"]["permanentAddress"] == "Permanent address details"
    assert data["performance"]["attendancePercentage"] == 96.5
    assert data["preferences"]["theme"] == "dark"
    assert data["notificationSettings"]["salaryCredit"] is True
