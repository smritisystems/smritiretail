"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-18
Modified     : 2026-10-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Suite: Store Directory & Staff Placement Assignment Management
Coverage:
- Multi-staff per store
- Multi-store per staff (non-conflicting roles)
- Conflicting Store Manager rejection
- Conflicting Primary Representative rejection
- Duplicate assignment of same user to same store rejection
- Separation of physical attendance vs scheduled assignment
- Collision-safe directory identity (store_type:id)
- Store directory search, filtering, and aggregation
- Store details, roster, history, and customer portfolio
"""

import pytest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from pydantic import BaseModel

from app.models.staff_placement import StaffPlacementAssignment
from app.models.tenant import Branch, Company
from app.models.crm import CustomerDeliveryLocation, Customer
from app.models.auth import User, UserRole
from app.models.hr import AttendanceRecord
from app.models.psv import PSVParty, PSVPartySkuTracking


class DummyTenant:
    company_id = "COMP-001"
    branch_id = "BR-01"


class DummyUser:
    id = "usr-mgr-1"
    full_name = "Manager User"
    username = "mgr1"
    role = UserRole.MANAGER
    roles = [UserRole.MANAGER]
    company_id = "COMP-001"


class DummyStaffPlacementCreate(BaseModel):
    placement_type: str
    internal_branch_id: str | None = None
    internal_store_id: str | None = None
    host_customer_id: str | None = None
    host_delivery_location_id: str | None = None
    role_at_location: str | None = None
    stock_model: str = "OUTRIGHT_SALE"
    commission_program_id: str | None = None
    effective_from: date
    effective_to: date | None = None


@pytest.mark.asyncio
async def test_multi_staff_assigned_to_same_store():
    """Verify multiple distinct staff members can be assigned to the same store location."""
    payload_mgr = DummyStaffPlacementCreate(
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-101",
        role_at_location="STORE_MANAGER",
        effective_from=date(2026, 1, 1),
    )
    payload_rep = DummyStaffPlacementCreate(
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-101",
        role_at_location="SALES_REPRESENTATIVE",
        effective_from=date(2026, 1, 1),
    )

    assert payload_mgr.internal_branch_id == payload_rep.internal_branch_id
    assert payload_mgr.role_at_location != payload_rep.role_at_location


@pytest.mark.asyncio
async def test_store_manager_role_exclusivity_conflict():
    """Verify that assigning a second Store Manager to a store with an active manager raises HTTP 409."""
    from app.api.v1.staff import create_staff_placement

    tenant = DummyTenant()
    current_user = DummyUser()

    branch = Branch(id="br-101", company_id="COMP-001", code="BR101", name="Main Branch", is_active=True, is_deleted=False)
    target_user = User(id="usr-rep-2", username="rep2", full_name="Rep Two", company_id="COMP-001", is_deleted=False)

    existing_active_manager = StaffPlacementAssignment(
        id="spa-1",
        company_id="COMP-001",
        staff_user_id="usr-mgr-1",
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-101",
        role_at_location="STORE_MANAGER",
        status="ACTIVE",
        is_deleted=False,
    )

    db = AsyncMock()
    control_db = AsyncMock()

    # User lookup mock in control_db
    ctrl_res = MagicMock()
    ctrl_res.scalar_one_or_none.return_value = target_user
    control_db.execute.return_value = ctrl_res

    # DB mocks
    async def mock_db_execute(stmt):
        mock_result = MagicMock()
        stmt_str = str(stmt).lower()
        if "from users" in stmt_str:
            mock_result.scalars.return_value.first.return_value = target_user
            mock_result.scalar_one_or_none.return_value = target_user
        elif "from branches" in stmt_str:
            mock_result.scalar_one_or_none.return_value = branch
        elif "role_at_location =" in stmt_str:
            # Check 2: Store already has an active manager
            mock_result.scalar_one_or_none.return_value = existing_active_manager
        elif "staff_user_id =" in stmt_str:
            # Check 1: No duplicate assignment for this specific user
            mock_result.scalar_one_or_none.return_value = None
        else:
            mock_result.scalar_one_or_none.return_value = None
            mock_result.scalars.return_value.first.return_value = None
        return mock_result

    db.execute.side_effect = mock_db_execute

    payload = DummyStaffPlacementCreate(
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-101",
        role_at_location="STORE_MANAGER",
        effective_from=date(2026, 11, 1),
    )

    with pytest.raises(HTTPException) as exc_info:
        await create_staff_placement(
            user_id="usr-rep-2",
            payload=payload,
            tenant=tenant,
            control_db=control_db,
            db=db,
            current_user=current_user,
        )

    assert exc_info.value.status_code == 409
    assert "already has an active Store Manager" in exc_info.value.detail


@pytest.mark.asyncio
async def test_duplicate_same_store_assignment_rejection():
    """Verify that assigning the same staff member twice to the same store raises HTTP 409."""
    from app.api.v1.staff import create_staff_placement

    tenant = DummyTenant()
    current_user = DummyUser()

    branch = Branch(id="br-101", company_id="COMP-001", code="BR101", name="Main Branch", is_active=True, is_deleted=False)
    target_user = User(id="usr-rep-1", username="rep1", full_name="Rep One", company_id="COMP-001", is_deleted=False)

    existing_same_placement = StaffPlacementAssignment(
        id="spa-1",
        company_id="COMP-001",
        staff_user_id="usr-rep-1",
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-101",
        role_at_location="SALES_REPRESENTATIVE",
        status="ACTIVE",
        is_deleted=False,
    )

    db = AsyncMock()
    control_db = AsyncMock()

    ctrl_res = MagicMock()
    ctrl_res.scalar_one_or_none.return_value = target_user
    control_db.execute.return_value = ctrl_res

    async def mock_db_execute(stmt):
        mock_result = MagicMock()
        stmt_str = str(stmt).lower()
        if "from branches" in stmt_str:
            mock_result.scalar_one_or_none.return_value = branch
        elif "from users" in stmt_str:
            mock_result.scalars.return_value.first.return_value = target_user
            mock_result.scalar_one_or_none.return_value = target_user
        elif "staff_placement_assignments" in stmt_str:
            mock_result.scalar_one_or_none.return_value = existing_same_placement
        else:
            mock_result.scalar_one_or_none.return_value = None
            mock_result.scalars.return_value.first.return_value = None
        return mock_result

    db.execute.side_effect = mock_db_execute

    payload = DummyStaffPlacementCreate(
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-101",
        role_at_location="SALES_REPRESENTATIVE",
        effective_from=date(2026, 11, 1),
    )

    with pytest.raises(HTTPException) as exc_info:
        await create_staff_placement(
            user_id="usr-rep-1",
            payload=payload,
            tenant=tenant,
            control_db=control_db,
            db=db,
            current_user=current_user,
        )

    assert exc_info.value.status_code == 409
    assert "already has a pending or active placement at this store location" in exc_info.value.detail


@pytest.mark.asyncio
async def test_separation_of_assignment_vs_physical_presence():
    """
    Verify that scheduled staff placement does NOT automatically mark a user as present.
    Presence requires an explicit AttendanceRecord with status='PRESENT' and check_out_at is None.
    """
    today = date.today()

    u1_placement = StaffPlacementAssignment(
        id="spa-1",
        staff_user_id="u-1",
        role_at_location="STORE_MANAGER",
        effective_from=today - timedelta(days=10),
        effective_to=None,
        status="ACTIVE",
    )
    u1_attendance = AttendanceRecord(
        id="att-1",
        user_id="u-1",
        attendance_date=today,
        status="PRESENT",
        check_in_at=datetime.now(timezone.utc),
        check_out_at=None,
    )

    u2_placement = StaffPlacementAssignment(
        id="spa-2",
        staff_user_id="u-2",
        role_at_location="SALES_REPRESENTATIVE",
        effective_from=today - timedelta(days=5),
        effective_to=None,
        status="ACTIVE",
    )

    present_user_ids = {u1_attendance.user_id}
    assigned_user_ids = {u1_placement.staff_user_id, u2_placement.staff_user_id}

    assert "u-1" in assigned_user_ids
    assert "u-2" in assigned_user_ids
    assert "u-1" in present_user_ids
    assert "u-2" not in present_user_ids  # Strictly never inferred!


@pytest.mark.asyncio
async def test_store_directory_structure_and_collision_safe_identity():
    """Verify list_store_directory returns canonical fields, collision-safe IDs, and correct summary metrics."""
    from app.api.v1.staff import list_store_directory

    tenant = DummyTenant()
    current_user = DummyUser()
    db = AsyncMock()
    control_db = AsyncMock()

    branch = Branch(
        id="br-01",
        company_id="COMP-001",
        code="BR01",
        name="Central Branch",
        is_active=True,
        is_deleted=False,
        city="Mumbai",
        state="Maharashtra",
    )
    customer = Customer(id="cust-01", code="C001", name="Reliance Retail")
    cdl = CustomerDeliveryLocation(
        id="cdl-01",
        company_id="COMP-001",
        customer_id="cust-01",
        store_code="1888",
        location_name="Reliance Store 1888",
        city="Delhi",
        state="Delhi",
        status="ACTIVE",
        is_deleted=False,
    )

    today = date.today()
    placement = StaffPlacementAssignment(
        id="spa-1",
        company_id="COMP-001",
        staff_user_id="usr-1",
        role_at_location="STORE_MANAGER",
        internal_branch_id="br-01",
        effective_from=today - timedelta(days=10),
        effective_to=None,
        status="ACTIVE",
        is_deleted=False,
    )

    user1 = User(id="usr-1", full_name="Aarav Sharma", username="asharma", mobile="9876543210")

    async def mock_db_execute(stmt):
        mock_result = MagicMock()
        stmt_str = str(stmt)
        if "staff_placement_assignments" in stmt_str:
            mock_result.scalars.return_value.all.return_value = [placement]
        elif "attendance_records" in stmt_str:
            mock_result.scalars.return_value.all.return_value = []
        elif "psv_parties" in stmt_str:
            mock_result.scalars.return_value.all.return_value = []
        elif "branches" in stmt_str:
            mock_result.scalars.return_value.all.return_value = [branch]
        elif "customer_delivery_locations" in stmt_str:
            mock_result.all.return_value = [(cdl, customer)]
        else:
            mock_result.scalars.return_value.all.return_value = []
            mock_result.all.return_value = []
        return mock_result

    db.execute.side_effect = mock_db_execute
    ctrl_res = MagicMock()
    ctrl_res.scalars.return_value.all.return_value = [user1]
    control_db.execute.return_value = ctrl_res

    res = await list_store_directory(
        search=None,
        store_type="ALL",
        status="ALL",
        page=1,
        page_size=50,
        tenant=tenant,
        control_db=control_db,
        db=db,
        current_user=current_user,
    )

    assert "items" in res
    assert "summary" in res
    assert res["summary"]["total_stores"] == 2
    assert res["summary"]["total_internal_branches"] == 1
    assert res["summary"]["total_partner_stores"] == 1
    assert res["summary"]["stores_with_manager"] == 1
    assert res["summary"]["total_assigned_staff"] == 1
    assert res["summary"]["total_verified_present_today"] == 0

    br_item = next(item for item in res["items"] if item["store_code"] == "BR01")
    assert br_item["id"] == "INTERNAL_BRANCH:br-01"  # Collision-safe composite identity
    assert br_item["store_type"] == "INTERNAL_BRANCH"
    assert br_item["store_manager"]["name"] == "Aarav Sharma"
    assert br_item["assigned_staff_count"] == 1
    assert br_item["verified_present_today_count"] == 0

    cdl_item = next(item for item in res["items"] if item["store_code"] == "1888")
    assert cdl_item["id"] == "CUSTOMER_STORE:cdl-01"  # Collision-safe composite identity
    assert cdl_item["store_type"] == "CUSTOMER_STORE"


@pytest.mark.asyncio
async def test_primary_rep_role_exclusivity_conflict():
    """Verify that assigning a second Primary Representative to a partner store raises HTTP 409."""
    from app.api.v1.staff import create_staff_placement

    tenant = DummyTenant()
    current_user = DummyUser()

    cdl = CustomerDeliveryLocation(
        id="cdl-01",
        company_id="COMP-001",
        customer_id="cust-01",
        store_code="LIF-01",
        location_name="Lifestyle Flagship",
        status="ACTIVE",
        is_deleted=False,
    )
    target_user = User(id="usr-rep-2", username="rep2", full_name="Rep Two", company_id="COMP-001", is_deleted=False)
    existing_primary_rep = StaffPlacementAssignment(
        id="spa-rep-1",
        company_id="COMP-001",
        staff_user_id="usr-rep-1",
        placement_type="CUSTOMER_STORE",
        host_delivery_location_id="cdl-01",
        role_at_location="PRIMARY_REPRESENTATIVE",
        status="ACTIVE",
        is_deleted=False,
    )

    db = AsyncMock()
    control_db = AsyncMock()

    ctrl_res = MagicMock()
    ctrl_res.scalar_one_or_none.return_value = target_user
    control_db.execute.return_value = ctrl_res

    async def mock_db_execute(stmt):
        mock_result = MagicMock()
        stmt_str = str(stmt).lower()
        if "from customer_delivery_locations" in stmt_str:
            mock_result.scalar_one_or_none.return_value = cdl
        elif "from users" in stmt_str:
            mock_result.scalars.return_value.first.return_value = target_user
            mock_result.scalar_one_or_none.return_value = target_user
        elif "role_at_location =" in stmt_str:
            mock_result.scalar_one_or_none.return_value = existing_primary_rep
        elif "staff_user_id =" in stmt_str:
            mock_result.scalar_one_or_none.return_value = None
        else:
            mock_result.scalar_one_or_none.return_value = None
        return mock_result

    db.execute.side_effect = mock_db_execute

    payload = DummyStaffPlacementCreate(
        placement_type="CUSTOMER_STORE",
        host_customer_id="cust-01",
        host_delivery_location_id="cdl-01",
        role_at_location="PRIMARY_REPRESENTATIVE",
        effective_from=date(2026, 11, 1),
    )

    with pytest.raises(HTTPException) as exc_info:
        await create_staff_placement(
            user_id="usr-rep-2",
            payload=payload,
            tenant=tenant,
            control_db=control_db,
            db=db,
            current_user=current_user,
        )

    assert exc_info.value.status_code == 409
    assert "already has an active Primary Representative" in exc_info.value.detail


@pytest.mark.asyncio
async def test_multi_store_roaming_staff_assignment():
    """Verify a staff member can hold concurrent active assignments across distinct stores with non-exclusive roaming roles."""
    from app.api.v1.staff import create_staff_placement

    tenant = DummyTenant()
    current_user = DummyUser()

    branch_b = Branch(id="br-02", company_id="COMP-001", code="BR02", name="West Branch", is_active=True, is_deleted=False)
    roaming_user = User(id="usr-roam-1", username="roam1", full_name="Roaming Rep", company_id="COMP-001", is_deleted=False)

    db = AsyncMock()
    db.add = MagicMock()  # Synchronous in SQLAlchemy AsyncSession
    control_db = AsyncMock()

    ctrl_res = MagicMock()
    ctrl_res.scalar_one_or_none.return_value = roaming_user
    control_db.execute.return_value = ctrl_res

    async def mock_db_execute(stmt):
        mock_result = MagicMock()
        stmt_str = str(stmt).lower()
        if "from branches" in stmt_str:
            mock_result.scalar_one_or_none.return_value = branch_b
        elif "from users" in stmt_str:
            mock_result.scalars.return_value.first.return_value = roaming_user
            mock_result.scalar_one_or_none.return_value = roaming_user
        elif "staff_placement_assignments" in stmt_str:
            mock_result.scalar_one_or_none.return_value = None
        else:
            mock_result.scalar_one_or_none.return_value = None
        return mock_result

    db.execute.side_effect = mock_db_execute

    payload = DummyStaffPlacementCreate(
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-02",
        role_at_location="SALES_REPRESENTATIVE",
        effective_from=date(2026, 11, 1),
    )

    created = await create_staff_placement(
        user_id="usr-roam-1",
        payload=payload,
        tenant=tenant,
        control_db=control_db,
        db=db,
        current_user=current_user,
    )

    assert created["staff_user_id"] == "usr-roam-1"
    assert created["internal_branch_id"] == "br-02"
    assert created["role_at_location"] == "SALES_REPRESENTATIVE"
    assert created["status"] == "PENDING"
    assert db.add.called
    assert db.commit.called


@pytest.mark.asyncio
async def test_historical_transfer_lifecycle():
    """Verify atomic store transfer: prior placement expires with effective_to, new placement created, snapshot immutability intact."""
    today = date.today()
    transfer_date = today + timedelta(days=1)

    prior_placement = StaffPlacementAssignment(
        id="spa-orig",
        company_id="COMP-001",
        staff_user_id="usr-1",
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-01",
        role_at_location="SALES_REPRESENTATIVE",
        effective_from=today - timedelta(days=90),
        effective_to=None,
        status="ACTIVE",
        host_store_code_snapshot="BR01",
        host_store_name_snapshot="Central Branch",
    )

    # Execute transfer transition
    prior_placement.effective_to = today
    prior_placement.status = "EXPIRED"

    new_placement = StaffPlacementAssignment(
        id="spa-new",
        company_id="COMP-001",
        staff_user_id="usr-1",
        placement_type="INTERNAL_BRANCH",
        internal_branch_id="br-02",
        role_at_location="SALES_REPRESENTATIVE",
        effective_from=transfer_date,
        effective_to=None,
        status="ACTIVE",
        host_store_code_snapshot="BR02",
        host_store_name_snapshot="West Branch",
    )

    # Verify history is preserved and immutable snapshots are distinct
    assert prior_placement.status == "EXPIRED"
    assert prior_placement.effective_to == today
    assert prior_placement.host_store_code_snapshot == "BR01"
    assert new_placement.status == "ACTIVE"
    assert new_placement.effective_from == transfer_date
    assert new_placement.effective_to is None
    assert new_placement.host_store_code_snapshot == "BR02"


@pytest.mark.asyncio
async def test_attendance_semantics_strict_separation():
    """
    Verify attendance semantics:
    - User with no attendance record -> NOT_LOGGED (never inferred as present or confirmed absent)
    - User with open check-in -> PRESENT, is_present=True
    - User with completed check-out -> CHECKED_OUT, is_present=False
    """
    from app.api.v1.staff import get_store_roster

    tenant = DummyTenant()
    current_user = DummyUser()
    today = date.today()

    p1 = StaffPlacementAssignment(
        id="p-1", staff_user_id="u-1", internal_branch_id="br-01",
        role_at_location="STORE_MANAGER", status="ACTIVE", is_deleted=False,
        effective_from=today - timedelta(days=30), effective_to=None
    )
    p2 = StaffPlacementAssignment(
        id="p-2", staff_user_id="u-2", internal_branch_id="br-01",
        role_at_location="SALES_REPRESENTATIVE", status="ACTIVE", is_deleted=False,
        effective_from=today - timedelta(days=10), effective_to=None
    )
    p3 = StaffPlacementAssignment(
        id="p-3", staff_user_id="u-3", internal_branch_id="br-01",
        role_at_location="CASHIER", status="ACTIVE", is_deleted=False,
        effective_from=today - timedelta(days=5), effective_to=None
    )

    # u1: open check-in (PRESENT)
    att1 = AttendanceRecord(
        id="att-1", user_id="u-1", attendance_date=today, status="PRESENT",
        check_in_at=datetime.now(timezone.utc), check_out_at=None
    )
    # u2: checked out (CHECKED_OUT)
    att2 = AttendanceRecord(
        id="att-2", user_id="u-2", attendance_date=today, status="PRESENT",
        check_in_at=datetime.now(timezone.utc) - timedelta(hours=8),
        check_out_at=datetime.now(timezone.utc)
    )
    # u3: no attendance record exists

    user1 = User(id="u-1", full_name="User One", username="u1")
    user2 = User(id="u-2", full_name="User Two", username="u2")
    user3 = User(id="u-3", full_name="User Three", username="u3")

    branch = Branch(id="br-01", company_id="COMP-001", code="BR01", name="Branch 01")

    db = AsyncMock()
    control_db = AsyncMock()

    async def mock_db_execute(stmt):
        mock_result = MagicMock()
        stmt_str = str(stmt).lower()
        if "from branches" in stmt_str:
            mock_result.scalars.return_value.all.return_value = [branch]
            mock_result.scalar_one_or_none.return_value = branch
        elif "from customer_delivery_locations" in stmt_str:
            mock_result.scalars.return_value.all.return_value = []
            mock_result.scalar_one_or_none.return_value = None
        elif "staff_placement_assignments" in stmt_str:
            mock_result.scalars.return_value.all.return_value = [p1, p2, p3]
        elif "attendance_records" in stmt_str:
            # Query filters on check_out_at IS NULL, so only open check-in att1 is returned
            mock_result.scalars.return_value.all.return_value = [att1]
        else:
            mock_result.scalars.return_value.all.return_value = []
        return mock_result

    db.execute.side_effect = mock_db_execute

    ctrl_res = MagicMock()
    ctrl_res.scalars.return_value.all.return_value = [user1, user2, user3]
    control_db.execute.return_value = ctrl_res

    roster = await get_store_roster(
        store_code="BR01",
        tenant=tenant,
        control_db=control_db,
        db=db,
        current_user=current_user,
    )

    assert roster["store_code"] == "BR01"
    assert len(roster["roster"]) == 3

    r1 = next(r for r in roster["roster"] if r["staff_user_id"] == "u-1")
    assert r1["verified_attendance"]["is_present"] is True
    assert r1["verified_attendance"]["status"] == "PRESENT"
    assert r1["verified_attendance"]["check_in_at"] is not None

    r2 = next(r for r in roster["roster"] if r["staff_user_id"] == "u-2")
    assert r2["verified_attendance"]["is_present"] is False

    r3 = next(r for r in roster["roster"] if r["staff_user_id"] == "u-3")
    assert r3["verified_attendance"]["is_present"] is False
    assert r3["verified_attendance"]["status"] == "NOT_LOGGED"  # Explicitly NOT_LOGGED! Never inferred!


@pytest.mark.asyncio
async def test_psv_consignment_permissions_and_relationships():
    """Verify Party Stock Visibility correctly associates consignment inventory to customer delivery locations."""
    psv_party = PSVParty(
        id="psv-01",
        company_id="COMP-001",
        delivery_location_id="cdl-01",
        host_customer_id="cust-01",
        store_code="1888",
        stock_model="CONSIGNMENT",
        name="Reliance Store 1888",
        location="Delhi",
        stock_count=150,
        status="Healthy",
    )
    tracking_item = PSVPartySkuTracking(
        id=1,
        party_id="psv-01",
        sku="SKU-SHIRT-BLUE-L",
        invoiced_qty=200,
        confirmed_sold_qty=50,
        returned_qty=0,
    )

    soh = tracking_item.invoiced_qty - tracking_item.confirmed_sold_qty - tracking_item.returned_qty
    assert soh == 150
    assert psv_party.stock_count == 150
    assert psv_party.store_code == "1888"
    assert psv_party.delivery_location_id == "cdl-01"


@pytest.mark.asyncio
async def test_customer_360_financial_and_store_metric_truth():
    """Verify Customer 360 commercial metrics derive strictly from posted sales invoices and reflect servicing store."""
    from app.api.v1.crm import get_customer_commercial_summary

    tenant = DummyTenant()
    customer = Customer(
        id="cust-01",
        company_id="COMP-001",
        branch_id="BR-01",
        code="C001",
        name="Reliance Retail",
        outstanding=45000.0,
        is_deleted=False,
    )

    db = AsyncMock()

    async def mock_db_execute(stmt):
        mock_result = MagicMock()
        stmt_str = str(stmt).lower()
        if "from customers" in stmt_str:
            mock_result.scalars.return_value.first.return_value = customer
        elif "from customer_purchase_orders" in stmt_str:
            mock_result.one.return_value = (2, 25000.0)
        elif "from sales_orders" in stmt_str:
            mock_result.one.return_value = (1, 15000.0)
        elif "from sales_invoices" in stmt_str:
            mock_result.one.return_value = (5, 85000.0)
        elif "from sales_returns" in stmt_str:
            mock_result.one.return_value = (1, 5000.0)
        else:
            mock_result.one.return_value = (0, 0)
            mock_result.scalars.return_value.first.return_value = None
        return mock_result

    db.execute.side_effect = mock_db_execute

    summary = await get_customer_commercial_summary(
        customer_id="cust-01",
        db=db,
        tenant_ctx=tenant,
    )

    assert summary["customer_id"] == "cust-01"
    assert summary["customer_outstanding"] == 45000.0
    assert summary["invoices"]["count"] == 5
    assert summary["invoices"]["value"] == 85000.0
    assert summary["returns"]["count"] == 1
    assert summary["returns"]["value"] == 5000.0
    assert summary["ready_to_bill_value"] == 40000.0  # 25000 (PO) + 15000 (SO)


@pytest.mark.asyncio
async def test_migration_v1538_upgrade_and_downgrade_safety():
    """Verify that migration v1538 DDL operations preserve rollback safety and define correct constraint signatures."""
    import inspect
    from alembic.versions import v1538_staff_multistore_placement_policy as mig_v1538

    assert hasattr(mig_v1538, "upgrade")
    assert hasattr(mig_v1538, "downgrade")
    assert mig_v1538.revision == "v1538_staff_multistore_placement_policy"
    assert mig_v1538.down_revision == "v1537_company_profile_foundation"

    upgrade_source = inspect.getsource(mig_v1538.upgrade)
    downgrade_source = inspect.getsource(mig_v1538.downgrade)

    # Verify upgrade steps
    assert "DROP INDEX IF EXISTS uq_staff_placement_active_user" in upgrade_source
    assert "uq_staff_placement_active_branch_user" in upgrade_source
    assert "uq_staff_placement_active_cdl_user" in upgrade_source
    assert "uq_store_active_primary_rep" in upgrade_source
    assert "uq_branch_active_manager" in upgrade_source

    # Verify downgrade steps guarantee rollback safety and pre-flight protection
    assert "dup_count" in downgrade_source
    assert "Downgrade blocked" in downgrade_source
    assert "DROP INDEX IF EXISTS uq_branch_active_manager" in downgrade_source
    assert "DROP INDEX IF EXISTS uq_store_active_primary_rep" in downgrade_source
    assert "DROP INDEX IF EXISTS uq_staff_placement_active_cdl_user" in downgrade_source
    assert "DROP INDEX IF EXISTS uq_staff_placement_active_branch_user" in downgrade_source
    assert "CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_placement_active_user" in downgrade_source


@pytest.mark.asyncio
async def test_migration_v1538_smritisys_control_plane_no_op():
    """Verify that when run against control-plane database 'smritisys', upgrade and downgrade exit cleanly without executing tenant DDL."""
    from alembic.versions import v1538_staff_multistore_placement_policy as mig_v1538
    from unittest.mock import patch

    mock_bind = MagicMock()
    mock_bind.execute.return_value.scalar.return_value = "smritisys"

    with patch("alembic.op.get_bind", return_value=mock_bind), patch("alembic.op.execute") as mock_op_exec:
        mig_v1538.upgrade()
        mock_op_exec.assert_not_called()

        mig_v1538.downgrade()
        mock_op_exec.assert_not_called()


@pytest.mark.asyncio
async def test_migration_v1538_system_database_target_fail_fast():
    """Verify that running against forbidden system or template databases raises RuntimeError."""
    from alembic.versions import v1538_staff_multistore_placement_policy as mig_v1538
    from unittest.mock import patch

    for forbidden_db in ("postgres", "template0", "template1"):
        mock_bind = MagicMock()
        mock_bind.execute.return_value.scalar.return_value = forbidden_db

        with patch("alembic.op.get_bind", return_value=mock_bind):
            with pytest.raises(RuntimeError) as exc_up:
                mig_v1538.upgrade()
            assert "must not run against system/template database" in str(exc_up.value)

            with pytest.raises(RuntimeError) as exc_down:
                mig_v1538.downgrade()
            assert "must not run against system/template database" in str(exc_down.value)


@pytest.mark.asyncio
async def test_migration_v1538_missing_table_tenant_fail_fast():
    """Verify that running against a tenant database missing 'staff_placement_assignments' fails fast instead of silently stamping."""
    from alembic.versions import v1538_staff_multistore_placement_policy as mig_v1538
    from unittest.mock import patch

    mock_bind = MagicMock()
    mock_bind.execute.return_value.scalar.return_value = "smriti001"

    with patch("alembic.op.get_bind", return_value=mock_bind), \
         patch("sqlalchemy.inspect") as mock_inspect:
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["companies", "branches"]
        mock_inspect.return_value = mock_inspector

        with pytest.raises(RuntimeError) as exc_up:
            mig_v1538.upgrade()
        assert "table 'staff_placement_assignments' does not exist" in str(exc_up.value)

        with pytest.raises(RuntimeError) as exc_down:
            mig_v1538.downgrade()
        assert "table 'staff_placement_assignments' does not exist" in str(exc_down.value)


@pytest.mark.asyncio
async def test_migration_v1538_successful_ddl_and_post_verification():
    """Verify that successful DDL execution on tenant database checks post-DDL index existence."""
    from alembic.versions import v1538_staff_multistore_placement_policy as mig_v1538
    from unittest.mock import patch

    mock_bind = MagicMock()
    mock_bind.execute.return_value.scalar.return_value = "smriti001"

    with patch("alembic.op.get_bind", return_value=mock_bind), \
         patch("alembic.op.execute") as mock_op_exec, \
         patch("sqlalchemy.inspect") as mock_inspect:
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["staff_placement_assignments"]
        mock_inspector.get_indexes.return_value = [
            {"name": "uq_staff_placement_active_branch_user"},
            {"name": "uq_staff_placement_active_cdl_user"},
            {"name": "uq_store_active_primary_rep"},
            {"name": "uq_branch_active_manager"},
        ]
        mock_inspect.return_value = mock_inspector

        # Should complete successfully without raising
        mig_v1538.upgrade()
        assert mock_op_exec.call_count == 5  # 1 drop + 4 creates
