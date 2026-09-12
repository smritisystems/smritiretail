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

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.crm import Customer, CustomerDeliveryLocation
from app.models.inventory import Store
from app.models.staff_placement import StaffPlacementAssignment
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
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
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
        "bankDetails": "HDFC Bank, Acct: 501002930293, IFSC: TEST0000000",
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
        f"staff_{s}",
        comp.id,
        br.id,
        role=UserRole.CASHIER,
        status="Active",
        employee_id=f"EMP-{s}",
        employee_code=f"E{s}",
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

    manager = await _make_user(db_session, f"mgr_{s}", comp.id, br.id, role=UserRole.MANAGER)
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
    assert data["employeeId"] == f"EMP-{s}"
    assert data["employeeCode"] == f"E{s}"
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
    assert data["payment"]["bankDetails"] == "HDFC Bank, Acct: 501002930293, IFSC: TEST0000000"
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


@pytest.mark.asyncio
async def test_staff_access_is_scoped_to_active_company_and_branch(db_session):
    suffix = uuid.uuid4().hex[:6]
    company_a, branch_a = await _make_tenant(db_session, f"a-{suffix}")
    company_b, branch_b = await _make_tenant(db_session, f"b-{suffix}")
    manager = await _make_user(db_session, f"manager-{suffix}", company_a.id, branch_a.id, UserRole.MANAGER)
    foreign_staff = await _make_user(db_session, f"foreign-{suffix}", company_b.id, branch_b.id, UserRole.CASHIER)
    _set_tenant(db_session, company_a.id, branch_a.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/users/{foreign_staff.id}", headers=_bearer(manager, company_a.id, branch_a.id))

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_staff_creation_requires_explicit_password(db_session):
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"manager-{suffix}", company.id, branch.id, UserRole.MANAGER)
    _set_tenant(db_session, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/users/",
            json={
                "username": f"new_staff_{suffix}",
                "fullName": "New Staff",
                "role": "CASHIER",
                "branchId": branch.id,
            },
            headers=_bearer(manager, company.id, branch.id),
        )

    assert response.status_code == 400
    assert "temporary password is required" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_attendance_is_tenant_scoped_and_duplicate_dates_are_rejected(db_session):
    suffix = uuid.uuid4().hex[:6]
    company_a, branch_a = await _make_tenant(db_session, f"a-{suffix}")
    company_b, branch_b = await _make_tenant(db_session, f"b-{suffix}")
    manager = await _make_user(db_session, f"manager-{suffix}", company_a.id, branch_a.id, UserRole.MANAGER)
    staff_a = await _make_user(db_session, f"staff-a-{suffix}", company_a.id, branch_a.id, UserRole.CASHIER)
    staff_b = await _make_user(db_session, f"staff-b-{suffix}", company_b.id, branch_b.id, UserRole.CASHIER)
    _set_tenant(db_session, company_a.id, branch_a.id)
    headers = _bearer(manager, company_a.id, branch_a.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post(
            "/api/v1/staff/attendance",
            json={"user_id": staff_a.id, "attendance_date": "2026-09-11", "status": "PRESENT"},
            headers=headers,
        )
        duplicate = await client.post(
            "/api/v1/staff/attendance",
            json={"user_id": staff_a.id, "attendance_date": "2026-09-11", "status": "LATE"},
            headers=headers,
        )
        foreign = await client.post(
            "/api/v1/staff/attendance",
            json={"user_id": staff_b.id, "attendance_date": "2026-09-11", "status": "PRESENT"},
            headers=headers,
        )

        # 2nd date record for date filtering verification
        created_day2 = await client.post(
            "/api/v1/staff/attendance",
            json={"user_id": staff_a.id, "attendance_date": "2026-09-12", "status": "PRESENT"},
            headers=headers,
        )

        # Date-range queries
        filter_single = await client.get(
            f"/api/v1/staff/attendance?user_id={staff_a.id}&from_date=2026-09-12",
            headers=headers,
        )
        filter_range = await client.get(
            f"/api/v1/staff/attendance?user_id={staff_a.id}&from_date=2026-09-11&to_date=2026-09-12",
            headers=headers,
        )

        # Non-manager authorization checks
        staff_headers = _bearer(staff_a, company_a.id, branch_a.id)
        forbidden_other = await client.post(
            "/api/v1/staff/attendance",
            json={"user_id": manager.id, "attendance_date": "2026-09-11", "status": "PRESENT"},
            headers=staff_headers,
        )
        self_attendance = await client.post(
            "/api/v1/staff/attendance",
            json={"user_id": staff_a.id, "attendance_date": "2026-09-13", "status": "PRESENT"},
            headers=staff_headers,
        )

    assert created.status_code == 201
    assert duplicate.status_code == 409
    assert foreign.status_code == 404
    assert created_day2.status_code == 201
    assert filter_single.status_code == 200
    assert len(filter_single.json()["records"]) == 1
    assert filter_single.json()["records"][0]["attendance_date"] == "2026-09-12"
    assert filter_range.status_code == 200
    assert len(filter_range.json()["records"]) == 2
    assert forbidden_other.status_code == 403
    assert self_attendance.status_code == 201


@pytest.mark.asyncio
async def test_leave_requires_valid_dates_and_manager_decision(db_session):
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"manager-{suffix}", company.id, branch.id, UserRole.MANAGER)
    cashier = await _make_user(db_session, f"cashier-{suffix}", company.id, branch.id, UserRole.CASHIER)
    _set_tenant(db_session, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        invalid = await client.post(
            "/api/v1/staff/leave/requests",
            json={"user_id": cashier.id, "leave_type": "CASUAL", "start_date": "2026-09-12", "end_date": "2026-09-11"},
            headers=_bearer(cashier, company.id, branch.id),
        )
        created = await client.post(
            "/api/v1/staff/leave/requests",
            json={"user_id": cashier.id, "leave_type": "CASUAL", "start_date": "2026-09-12", "end_date": "2026-09-13"},
            headers=_bearer(cashier, company.id, branch.id),
        )
        denied = await client.patch(
            f"/api/v1/staff/leave/requests/{created.json()['id']}/decision",
            json={"status": "APPROVED"},
            headers=_bearer(cashier, company.id, branch.id),
        )
        approved = await client.patch(
            f"/api/v1/staff/leave/requests/{created.json()['id']}/decision",
            json={"status": "APPROVED", "decision_reason": "Coverage confirmed"},
            headers=_bearer(manager, company.id, branch.id),
        )

    assert invalid.status_code == 422
    assert created.status_code == 201
    assert created.json()["total_days"] == 2
    assert denied.status_code == 403
    assert approved.status_code == 200
    assert approved.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_partner_staff_placement_validates_store_code_and_approval(db_session):
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"manager-{suffix}", company.id, branch.id, UserRole.MANAGER)
    staff = await _make_user(db_session, f"staff-{suffix}", company.id, branch.id, UserRole.CASHIER)
    customer = Customer(id=f"cust-place-{suffix}", company_id=company.id, code=f"REL-{suffix}", name="Reliance Retail", status="Active")
    location = CustomerDeliveryLocation(
        id=f"loc-place-{suffix}", company_id=company.id, customer_id=customer.id,
        store_code=f"REL-{suffix}", location_name="Reliance Partner Store", status="ACTIVE",
    )
    db_session.add_all([customer, location])
    await db_session.commit()
    _set_tenant(db_session, company.id, branch.id)
    headers = _bearer(manager, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        invalid = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements",
            json={"placement_type": "CUSTOMER_STORE", "host_customer_id": customer.id, "host_delivery_location_id": "missing", "effective_from": "2026-09-11"},
            headers=headers,
        )
        created = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements",
            json={"placement_type": "CUSTOMER_STORE", "host_customer_id": customer.id, "host_delivery_location_id": location.id, "role_at_location": "Brand Promoter", "stock_model": "OUTRIGHT_SALE", "effective_from": "2026-09-11"},
            headers=headers,
        )
        duplicate = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements",
            json={"placement_type": "CUSTOMER_STORE", "host_customer_id": customer.id, "host_delivery_location_id": location.id, "role_at_location": "Cashier", "stock_model": "OUTRIGHT_SALE", "effective_from": "2026-09-12"},
            headers=headers,
        )
        approved = await client.patch(
            f"/api/v1/staff/placements/{created.json()['id']}/decision",
            json={"status": "ACTIVE", "approval_reason": "Partner deployment approved"},
            headers=headers,
        )
        listed = await client.get(
            f"/api/v1/staff/placements?user_id={staff.id}",
            headers=headers,
        )

    assert invalid.status_code == 404
    assert created.status_code == 201
    assert duplicate.status_code == 409
    assert created.json()["host_store_code"] == location.store_code
    assert created.json()["status"] == "PENDING"
    assert approved.status_code == 200
    assert approved.json()["status"] == "ACTIVE"
    assert listed.status_code == 200
    assert listed.json()["placements"][0]["host_store_name"] == location.location_name


@pytest.mark.asyncio
async def test_internal_staff_placement_uses_target_branch_and_store_scope(db_session):
    suffix = uuid.uuid4().hex[:6]
    company, home_branch = await _make_tenant(db_session, suffix)
    target_branch = Branch(
        id=f"br-target-{suffix}", company_id=company.id,
        name="Target Branch", code=f"BR-TARGET-{suffix}", is_active=True,
    )
    store = Store(
        id=f"store-target-{suffix}", company_id=company.id,
        branch_id=target_branch.id, code=f"ST-{suffix}", name="Target Store",
        is_active=True,
    )
    manager = await _make_user(db_session, f"manager-{suffix}", company.id, home_branch.id, UserRole.MANAGER)
    staff = await _make_user(db_session, f"staff-{suffix}", company.id, home_branch.id, UserRole.CASHIER)
    db_session.add(target_branch)
    await db_session.flush()
    db_session.add(store)
    await db_session.commit()
    _set_tenant(db_session, company.id, home_branch.id)
    headers = _bearer(manager, company.id, home_branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        options = await client.get("/api/v1/staff/placement-options", headers=headers)
        created = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements",
            json={
                "placement_type": "INTERNAL_BRANCH",
                "internal_branch_id": target_branch.id,
                "internal_store_id": store.id,
                "role_at_location": "Sales Executive",
                "effective_from": "2026-09-12",
            },
            headers=headers,
        )
        listed = await client.get(f"/api/v1/staff/placements?user_id={staff.id}", headers=headers)

    assert options.status_code == 200
    assert any(item["code"] == target_branch.code for item in options.json()["branches"])
    assert any(item["code"] == store.code and item["branch_id"] == target_branch.id for item in options.json()["stores"])
    assert created.status_code == 201
    assert created.json()["branch_id"] == target_branch.id
    assert listed.status_code == 200
    assert listed.json()["placements"][0]["internal_store_code"] == store.code
    assert listed.json()["placements"][0]["internal_store_name"] == store.name


@pytest.mark.asyncio
async def test_internal_staff_placement_rejects_store_under_wrong_branch(db_session):
    suffix = uuid.uuid4().hex[:6]
    company, home_branch = await _make_tenant(db_session, suffix)
    target_branch = Branch(id=f"br-target-{suffix}", company_id=company.id, name="Target", code=f"TARGET-{suffix}", is_active=True)
    wrong_store = Store(id=f"store-wrong-{suffix}", company_id=company.id, branch_id=home_branch.id, code=f"WRONG-{suffix}", name="Wrong Branch Store", is_active=True)
    manager = await _make_user(db_session, f"manager-{suffix}", company.id, home_branch.id, UserRole.MANAGER)
    staff = await _make_user(db_session, f"staff-{suffix}", company.id, home_branch.id, UserRole.CASHIER)
    db_session.add_all([target_branch, wrong_store])
    await db_session.commit()
    _set_tenant(db_session, company.id, home_branch.id)

    async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements",
            json={"placement_type": "INTERNAL_BRANCH", "internal_branch_id": target_branch.id, "internal_store_id": wrong_store.id, "effective_from": "2026-09-12"},
            headers=_bearer(manager, company.id, home_branch.id),
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_staff_placement_reassign_flow(db_session):
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    customer = Customer(id=f"cust-{suffix}", company_id=company.id, name=f"Customer {suffix}", is_deleted=False)
    loc1 = CustomerDeliveryLocation(
        id=f"loc1-{suffix}", customer_id=customer.id, company_id=company.id,
        store_code=f"STR-{suffix}-1", location_name=f"Store One {suffix}", status="ACTIVE", is_deleted=False,
    )
    loc2 = CustomerDeliveryLocation(
        id=f"loc2-{suffix}", customer_id=customer.id, company_id=company.id,
        store_code=f"STR-{suffix}-2", location_name=f"Store Two {suffix}", status="ACTIVE", is_deleted=False,
    )
    manager = await _make_user(db_session, f"manager-{suffix}", company.id, branch.id, UserRole.MANAGER)
    staff = await _make_user(db_session, f"staff-{suffix}", company.id, branch.id, UserRole.CASHIER)
    db_session.add_all([customer, loc1, loc2])
    await db_session.commit()
    _set_tenant(db_session, company.id, branch.id)
    headers = _bearer(manager, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create initial placement
        created = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements",
            json={
                "placement_type": "CUSTOMER_STORE",
                "host_customer_id": customer.id,
                "host_delivery_location_id": loc1.id,
                "role_at_location": "Sales Executive",
                "stock_model": "OUTRIGHT_SALE",
                "effective_from": "2026-09-12",
            },
            headers=headers,
        )
        assert created.status_code == 201
        placement_id = created.json()["id"]

        # 2. Approve initial placement so it is ACTIVE
        approved = await client.patch(
            f"/api/v1/staff/placements/{placement_id}/decision",
            json={"status": "ACTIVE", "approval_reason": "Approved initial placement"},
            headers=headers,
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "ACTIVE"

        # 3. Attempt reassignment with effective_from <= current effective_from (rejected 422)
        invalid_reassign = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements/reassign",
            json={
                "current_placement_id": placement_id,
                "placement_type": "CUSTOMER_STORE",
                "host_customer_id": customer.id,
                "host_delivery_location_id": loc2.id,
                "role_at_location": "Store Manager",
                "stock_model": "OUTRIGHT_SALE",
                "effective_from": "2026-09-12",
            },
            headers=headers,
        )
        assert invalid_reassign.status_code == 422
        assert "must start after the current placement starts" in invalid_reassign.json()["detail"]

        # 4. Valid reassignment with effective_from > current effective_from
        valid_reassign = await client.post(
            f"/api/v1/staff/users/{staff.id}/placements/reassign",
            json={
                "current_placement_id": placement_id,
                "placement_type": "CUSTOMER_STORE",
                "host_customer_id": customer.id,
                "host_delivery_location_id": loc2.id,
                "role_at_location": "Store Manager",
                "stock_model": "OUTRIGHT_SALE",
                "effective_from": "2026-09-13",
            },
            headers=headers,
        )
        assert valid_reassign.status_code == 201
        body = valid_reassign.json()
        assert body["previous"]["status"] == "EXPIRED"
        assert body["previous"]["effective_to"] == "2026-09-12"
        assert body["replacement"]["status"] == "PENDING"
        assert body["replacement"]["host_store_code"] == loc2.store_code
        assert body["replacement"]["effective_from"] == "2026-09-13"

        replacement_id = body["replacement"]["id"]

        # 5. Approve replacement placement
        decision = await client.patch(
            f"/api/v1/staff/placements/{replacement_id}/decision",
            json={"status": "ACTIVE", "approval_reason": "Store transfer approved"},
            headers=headers,
        )
        assert decision.status_code == 200
        assert decision.json()["status"] == "ACTIVE"

        # 6. Verify list shows both placements (one EXPIRED, one ACTIVE)
        listed = await client.get(f"/api/v1/staff/placements?user_id={staff.id}", headers=headers)
        assert listed.status_code == 200
        placements = listed.json()["placements"]
        assert len(placements) == 2
        statuses = {p["status"] for p in placements}
        assert statuses == {"EXPIRED", "ACTIVE"}
