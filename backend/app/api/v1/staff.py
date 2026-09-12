"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah -- Founder & Chairperson
* Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.30.0
* Created    : 2026-08-24
* Modified   : 2026-08-24
* Copyright  : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software

Sprint 10 -- Staff Management parity.
Shoper9 MnuNo 612 (SR442900/SR443900).
Personnel Catalogue backed by commission_participants table.
Incentive Definition backed by commission_rules + commission_programs.
"""

import json
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from ...api.deps import get_db, get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.commission import CommissionParticipant, CommissionProgram, CommissionRule
from ...models.auth import User, UserRole
from ...models.hr import AttendanceRecord, LeaveBalance, LeaveRequest
from ...models.crm import CustomerDeliveryLocation
from ...models.tenant import Branch
from ...models.inventory import Store
from ...models.staff_placement import StaffPlacementAssignment
from ...models.staff_profile import StaffProfile
from ...models.staff_profile_history import StaffProfileHistory
from ...schemas.user import StaffUserUpdate
from ...services.user import to_staff_response

router = APIRouter(prefix="/staff")

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class PersonnelOut(BaseModel):
    id: str
    person_name: str
    user_id: Optional[str]
    participant_role: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True

class IncentiveOut(BaseModel):
    id: str
    program_id: str
    program_name: str
    participant_role: str
    calculation_type: str
    rate_percent: float
    fixed_amount: float
    min_order_amount: float
    is_active: bool

    class Config:
        from_attributes = True

class IncentiveCreate(BaseModel):
    program_id: str
    participant_role: str = "SALESPERSON"
    calculation_type: str = "PERCENTAGE"  # PERCENTAGE | FIXED_AMOUNT | SLAB_BASED
    rate_percent: float = 0.0
    fixed_amount: float = 0.0
    min_order_amount: float = 0.0
    max_commission_amount: Optional[float] = None


class AttendanceCreate(BaseModel):
    user_id: str
    attendance_date: date
    status: str = "PRESENT"
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    branch_source_id: Optional[str] = None
    register_source: Optional[str] = None
    device_source: Optional[str] = None
    correction_reason: Optional[str] = None


class LeaveRequestCreate(BaseModel):
    user_id: str
    leave_type: str
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveDecision(BaseModel):
    status: str
    decision_reason: Optional[str] = None


class StaffPlacementCreate(BaseModel):
    placement_type: str
    internal_branch_id: Optional[str] = None
    internal_store_id: Optional[str] = None
    host_customer_id: Optional[str] = None
    host_delivery_location_id: Optional[str] = None
    role_at_location: Optional[str] = None
    stock_model: str = "OUTRIGHT_SALE"
    commission_program_id: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None


class StaffPlacementDecision(BaseModel):
    status: str
    approval_reason: Optional[str] = None


class StaffPlacementReassign(StaffPlacementCreate):
    current_placement_id: str


def _placement_payload(row: StaffPlacementAssignment) -> dict:
    return {
        "id": row.id,
        "staff_user_id": row.staff_user_id,
        "company_id": row.company_id,
        "branch_id": row.branch_id,
        "placement_type": row.placement_type,
        "internal_branch_id": row.internal_branch_id,
        "internal_store_id": row.internal_store_id,
        "host_customer_id": row.host_customer_id,
        "host_delivery_location_id": row.host_delivery_location_id,
        "host_store_code": row.host_store_code_snapshot,
        "host_store_name": row.host_store_name_snapshot,
        "host_address_line1": row.host_address_line1_snapshot,
        "host_address_line2": row.host_address_line2_snapshot,
        "host_city": row.host_city_snapshot,
        "host_state": row.host_state_snapshot,
        "host_pincode": row.host_pincode_snapshot,
        "role_at_location": row.role_at_location,
        "stock_model": row.stock_model,
        "commission_program_id": row.commission_program_id,
        "effective_from": row.effective_from,
        "effective_to": row.effective_to,
        "status": row.status,
        "approval_reason": row.approval_reason,
        "approved_by": row.approved_by,
        "approved_at": row.approved_at,
    }


@router.get("/placement-options")
async def list_staff_placement_options(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Return company-owned branches and stores for internal staff assignments."""
    branches = (await db.execute(select(Branch).where(
        Branch.company_id == tenant.company_id,
        Branch.is_deleted == False,
        Branch.is_active == True,
    ).order_by(Branch.code.asc()))).scalars().all()
    stores = (await db.execute(select(Store).where(
        Store.company_id == tenant.company_id,
        Store.is_deleted == False,
        Store.is_active == True,
    ).order_by(Store.code.asc()))).scalars().all()
    return {
        "branches": [{"id": branch.id, "code": branch.code, "name": branch.name} for branch in branches],
        "stores": [{"id": store.id, "code": store.code, "name": store.name, "branch_id": store.branch_id} for store in stores],
    }


def _require_manager(current_user: User) -> None:
    if current_user.role not in (UserRole.MANAGER, UserRole.SYSADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager approval is required for this HR action.")


async def _tenant_user(db: AsyncSession, user_id: str, tenant: TenantContext) -> User:
    user = (await db.execute(select(User).where(
        User.id == user_id,
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member was not found in the active tenant.")
    return user


async def _resolve_company_local_user(control_user: User, db: AsyncSession, tenant: TenantContext) -> User:
    """Reconcile a control-plane staff identity into the company database."""
    local_user = (await db.execute(select(User).where(
        User.username == control_user.username,
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ))).scalar_one_or_none()
    if local_user:
        return local_user

    branch_id = control_user.branch_id or tenant.branch_id
    branch = (await db.execute(select(Branch).where(
        Branch.id == branch_id,
        Branch.company_id == tenant.company_id,
        Branch.is_deleted == False,
        Branch.is_active == True,
    ))).scalar_one_or_none()
    if not branch:
        branch_id = tenant.branch_id

    local_user = User(
        id=f"usr-local-{uuid.uuid4().hex[:12]}",
        username=control_user.username,
        email=control_user.email,
        mobile=control_user.mobile,
        hashed_password=control_user.hashed_password,
        role=control_user.role,
        is_active=control_user.is_active,
        is_deleted=False,
        company_id=tenant.company_id,
        branch_id=branch_id,
        status=control_user.status,
        full_name=control_user.full_name,
        display_name=control_user.display_name,
        employee_id=control_user.employee_id,
        employee_code=control_user.employee_code,
        department=control_user.department,
        designation=control_user.designation,
        branch=control_user.branch,
        date_of_joining=control_user.date_of_joining,
        employment_type=control_user.employment_type,
    )
    db.add(local_user)
    await db.flush()
    return local_user


def _merge_staff_profile(user: User, profile: Optional[StaffProfile]) -> dict:
    payload = to_staff_response(user).dict()
    profile_was_new = False
    if not profile:
        return payload
    profile_fields = {
        "employee_id": "employeeId",
        "employee_code": "employeeCode",
        "display_name": "displayName",
        "full_name": "fullName",
        "gender": "gender",
        "date_of_birth": "dateOfBirth",
        "alternate_mobile": "alternateMobile",
        "emergency_contact": "emergencyContact",
        "address": "address",
        "city": "city",
        "state": "state",
        "country": "country",
        "pin_code": "pinCode",
        "department": "department",
        "designation": "designation",
        "branch": "branch",
        "department_id": "departmentId",
        "designation_id": "designationId",
        "date_of_joining": "dateOfJoining",
        "reporting_manager": "reportingManager",
        "employment_type": "employmentType",
        "allowed_branches": "allowedBranches",
        "photo": "photo",
        "salary_json": "salary",
        "payment_json": "payment",
        "performance_json": "performance",
        "preferences_json": "preferences",
        "notification_settings_json": "notificationSettings",
        "status": "status",
    }
    for source, target in profile_fields.items():
        value = getattr(profile, source)
        if value is not None:
            payload[target] = value
    return payload


def _profile_state(profile: StaffProfile) -> dict:
    return {
        column.name: getattr(profile, column.name)
        for column in StaffProfile.__table__.columns
        if column.name not in {"id", "uuid", "created_at", "modified_at"}
    }


def _location_snapshot(location: Optional[CustomerDeliveryLocation]) -> dict:
    if not location:
        return {}
    return {
        "host_store_code_snapshot": location.store_code,
        "host_store_name_snapshot": location.location_name,
        "host_address_line1_snapshot": location.address_line1,
        "host_address_line2_snapshot": location.address_line2,
        "host_city_snapshot": location.city,
        "host_state_snapshot": location.state,
        "host_pincode_snapshot": location.pincode,
    }


async def _staff_directory_record(
    user_id: str,
    tenant: TenantContext,
    control_db: AsyncSession,
    company_db: AsyncSession,
) -> dict:
    user = (await control_db.execute(select(User).where(
        User.id == user_id,
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff identity was not found in the active company.")
    profile = (await company_db.execute(select(StaffProfile).where(
        StaffProfile.company_id == tenant.company_id,
        StaffProfile.is_deleted == False,
        StaffProfile.user_id == user_id,
    ))).scalar_one_or_none()
    if not profile:
        local_user = (await company_db.execute(select(User).where(User.username == user.username))).scalar_one_or_none()
        if local_user:
            profile = (await company_db.execute(select(StaffProfile).where(
                StaffProfile.company_id == tenant.company_id,
                StaffProfile.user_id == local_user.id,
                StaffProfile.is_deleted == False,
            ))).scalar_one_or_none()
    return _merge_staff_profile(user, profile)


@router.get("/directory")
async def list_staff_directory(
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Compose Staff 360 identity from smritisys and employment from the company DB."""
    users = (await control_db.execute(select(User).where(
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ).order_by(User.username.asc()))).scalars().all()
    profiles = (await company_db.execute(select(StaffProfile).where(
        StaffProfile.company_id == tenant.company_id,
        StaffProfile.is_deleted == False,
    ))).scalars().all()
    local_users = (await company_db.execute(select(User).where(
        User.id.in_([profile.user_id for profile in profiles]),
    ))).scalars().all() if profiles else []
    profiles_by_user = {profile.user_id: profile for profile in profiles}
    profiles_by_username = {
        local_user.username: profiles_by_user[local_user.id]
        for local_user in local_users
        if local_user.id in profiles_by_user
    }
    rows = [_merge_staff_profile(user, profiles_by_user.get(user.id) or profiles_by_username.get(user.username)) for user in users]
    return {"users": rows, "total": len(rows)}


@router.get("/directory/{user_id}")
async def get_staff_directory_record(
    user_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Return one composed Staff 360 record across the two authoritative stores."""
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER) and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view another user's profile.")
    return await _staff_directory_record(user_id, tenant, control_db, company_db)


@router.patch("/directory/{user_id}/profile")
async def update_staff_directory_profile(
    user_id: str,
    payload: StaffUserUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Update company-owned employment data without writing HR fields to smritisys.users."""
    _require_manager(current_user)
    user = (await control_db.execute(select(User).where(
        User.id == user_id,
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Staff identity was not found in the active company.")
    profile = (await company_db.execute(select(StaffProfile).where(
        StaffProfile.company_id == tenant.company_id,
        StaffProfile.user_id == user_id,
        StaffProfile.is_deleted == False,
    ))).scalar_one_or_none()
    local_user = None
    if not profile:
        local_user = (await company_db.execute(select(User).where(
            User.username == user.username,
            User.is_deleted == False,
        ))).scalar_one_or_none()
        if local_user:
            profile = (await company_db.execute(select(StaffProfile).where(
                StaffProfile.company_id == tenant.company_id,
                StaffProfile.user_id == local_user.id,
                StaffProfile.is_deleted == False,
            ))).scalar_one_or_none()
    if not profile:
        profile_user_id = local_user.id if local_user else user_id
        profile = StaffProfile(
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            user_id=profile_user_id,
            created_by=current_user.id,
        )
        company_db.add(profile)
        await company_db.flush()
        profile_was_new = True

    before_state = _profile_state(profile)

    field_map = {
        "fullName": "full_name", "employeeId": "employee_id", "employeeCode": "employee_code",
        "displayName": "display_name", "gender": "gender", "dateOfBirth": "date_of_birth",
        "alternateMobile": "alternate_mobile", "emergencyContact": "emergency_contact",
        "address": "address", "city": "city", "state": "state", "country": "country",
        "pinCode": "pin_code", "department": "department", "designation": "designation",
        "branch": "branch", "departmentId": "department_id", "designationId": "designation_id",
        "dateOfJoining": "date_of_joining", "reportingManager": "reporting_manager",
        "employmentType": "employment_type", "allowedBranches": "allowed_branches", "photo": "photo",
        "status": "status",
    }
    values = payload.model_dump(exclude_unset=True)
    if "role" in values:
        if current_user.role != UserRole.SYSADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a system administrator can change a staff access role.")
        user.role = values["role"]
    for source, target in field_map.items():
        if source in values:
            value = values[source]
            setattr(profile, target, json.dumps(value) if source == "allowedBranches" else value)
    for source, target in {
        "salary": "salary_json", "payment": "payment_json", "performance": "performance_json",
        "preferences": "preferences_json", "notificationSettings": "notification_settings_json",
    }.items():
        if source in values:
            value = getattr(payload, source)
            setattr(profile, target, value.model_dump_json() if value is not None else None)
    profile.modified_at = datetime.now(timezone.utc)
    after_state = _profile_state(profile)
    company_db.add(StaffProfileHistory(
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        created_by=current_user.id,
        staff_profile_id=profile.id,
        user_id=profile.user_id,
        change_type="CREATED" if profile_was_new else "UPDATED",
        before_state_json=json.dumps(before_state, default=str),
        after_state_json=json.dumps(after_state, default=str),
        changed_by=current_user.id,
        changed_at=datetime.now(timezone.utc),
    ))
    await company_db.commit()
    await company_db.refresh(profile)
    return _merge_staff_profile(user, profile)


# ---------------------------------------------------------------------------
# STAFF-001: Personnel Catalogue  (Shoper9: SR442900.EXE MnuNo 612/6121)
# GET /api/v1/staff/personnel
# ---------------------------------------------------------------------------

@router.get("/personnel", response_model=List[PersonnelOut])
async def list_personnel(
    role:        Optional[str] = Query(default=None, description="Filter by role e.g. SALESPERSON, DRIVER"),
    active_only: bool = Query(default=True),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-001 -- Personnel Catalogue (Shoper9: SR442900.EXE MnuNo 612/6121).
    Lists all registered participants (salespersons, drivers, agents, referrers).
    Backed by commission_participants table.
    """
    stmt = select(CommissionParticipant).where(CommissionParticipant.is_deleted == False)
    if active_only:
        stmt = stmt.where(CommissionParticipant.is_active == True)
    if role:
        stmt = stmt.where(CommissionParticipant.participant_role.ilike(f"%{role}%"))
    stmt = stmt.order_by(CommissionParticipant.person_name)
    participants = (await db.execute(stmt)).scalars().all()

    return [
        PersonnelOut(
            id=p.id,
            person_name=p.person_name,
            user_id=getattr(p, "user_id", None),
            participant_role=getattr(p, "participant_role", "SALESPERSON") or "SALESPERSON",
            is_active=getattr(p, "is_active", True),
            created_at=str(p.created_at)[:10] if p.created_at else "",
        )
        for p in participants
    ]


# ---------------------------------------------------------------------------
# STAFF-002: Incentive Definition  (Shoper9: SR443900.EXE MnuNo 612/6124)
# GET  /api/v1/staff/incentives
# POST /api/v1/staff/incentives
# ---------------------------------------------------------------------------

@router.get("/incentives")
async def list_incentives(
    program_id:  Optional[str] = Query(default=None),
    role:        Optional[str] = Query(default=None),
    active_only: bool = Query(default=True),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-002 -- Incentive Definition (Shoper9: SR443900.EXE MnuNo 612/6124).
    Lists commission rules (incentive slabs) per program and participant role.
    """
    # Load programs for name join
    progs = (await db.execute(
        select(CommissionProgram).where(CommissionProgram.is_deleted == False)
    )).scalars().all()
    prog_map = {p.id: p.name for p in progs}

    stmt = select(CommissionRule).where(CommissionRule.is_deleted == False)
    if active_only:
        stmt = stmt.where(CommissionRule.is_active == True)
    if program_id:
        stmt = stmt.where(CommissionRule.program_id == program_id)
    if role:
        stmt = stmt.where(CommissionRule.participant_role.ilike(f"%{role}%"))
    stmt = stmt.order_by(CommissionRule.participant_role)
    rules = (await db.execute(stmt)).scalars().all()

    lines = [
        {
            "id":                 r.id,
            "program_id":         r.program_id,
            "program_name":       prog_map.get(r.program_id, ""),
            "participant_role":   getattr(r, "participant_role", "") or "",
            "calculation_type":   getattr(r, "calculation_type", "PERCENTAGE") or "PERCENTAGE",
            "rate_percent":       float(getattr(r, "rate_percent", 0) or 0),
            "fixed_amount":       float(getattr(r, "fixed_amount", 0) or 0),
            "min_order_amount":   float(getattr(r, "min_order_amount", 0) or 0),
            "max_commission_amount": float(getattr(r, "max_commission_amount", 0) or 0)
                                     if getattr(r, "max_commission_amount", None) else None,
            "is_active":          bool(getattr(r, "is_active", True)),
        }
        for r in rules
    ]

    return {
        "report_id":    "STAFF-002",
        "sh9_exe":      "SR443900",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_rules":  len(lines),
        "programs_available": len(prog_map),
        "lines":        lines,
    }


@router.post("/incentives", status_code=status.HTTP_201_CREATED)
async def create_incentive(
    payload: IncentiveCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-002 (write) -- Create Incentive Rule (Shoper9: SR443900.EXE MnuNo 612/6124).
    Adds a new commission rule (incentive slab) to an existing program.
    Role guard: ADMIN or SYSADMIN.
    """
    role = getattr(current_user, "role", "").upper()
    if role not in ("ADMIN", "SYSADMIN", "SUPERADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code":    "SMRITI-PERM-001",
                "message": "You do not have permission to define incentive rules.",
                "action":  "Contact your system administrator to request access.",
            },
        )

    # Verify program exists
    prog = (await db.execute(
        select(CommissionProgram).where(
            CommissionProgram.id == payload.program_id,
            CommissionProgram.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not prog:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code":    "SMRITI-VAL-001",
                "message": f"Commission program '{payload.program_id}' was not found.",
                "action":  "Check the program ID or create a new program first.",
            },
        )

    new_rule = CommissionRule(
        program_id=payload.program_id,
        participant_role=payload.participant_role,
        calculation_type=payload.calculation_type,
        rate_percent=payload.rate_percent,
        fixed_amount=payload.fixed_amount,
        min_order_amount=payload.min_order_amount,
        max_commission_amount=payload.max_commission_amount,
        is_active=True,
        created_by=getattr(current_user, "id", None) or "system",
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)

    return {
        "id":               new_rule.id,
        "program_id":       new_rule.program_id,
        "program_name":     prog.name,
        "participant_role": new_rule.participant_role,
        "calculation_type": new_rule.calculation_type,
        "rate_percent":     float(new_rule.rate_percent or 0),
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# STAFF-003: Commission Programs List  (supporting endpoint for UI)
# GET /api/v1/staff/programs
# ---------------------------------------------------------------------------

@router.get("/programs")
async def list_programs(
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-003 -- Commission Programs (supporting endpoint).
    Lists all commission programs available for incentive definition.
    """
    progs = (await db.execute(
        select(CommissionProgram)
        .where(CommissionProgram.is_deleted == False)
        .order_by(CommissionProgram.name)
    )).scalars().all()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total":        len(progs),
        "programs": [
            {
                "id":          p.id,
                "name":        p.name,
                "description": getattr(p, "description", None) or "",
                "is_active":   bool(getattr(p, "is_active", True)),
            }
            for p in progs
        ],
    }


# ---------------------------------------------------------------------------
# STAFF-004: Attendance and leave foundations
# ---------------------------------------------------------------------------

@router.get("/attendance")
async def list_attendance(
    user_id: Optional[str] = Query(default=None),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        user_id = current_user.id
    stmt = select(AttendanceRecord).where(
        AttendanceRecord.company_id == tenant.company_id,
        AttendanceRecord.is_deleted == False,
    )
    if user_id:
        await _tenant_user(db, user_id, tenant)
        stmt = stmt.where(AttendanceRecord.user_id == user_id)
    if from_date:
        stmt = stmt.where(AttendanceRecord.attendance_date >= from_date)
    if to_date:
        stmt = stmt.where(AttendanceRecord.attendance_date <= to_date)
    rows = (await db.execute(stmt.order_by(AttendanceRecord.attendance_date.desc()))).scalars().all()
    return {"records": rows, "total": len(rows)}


@router.post("/attendance", status_code=status.HTTP_201_CREATED)
async def create_attendance(
    payload: AttendanceCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        if payload.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employees may only record attendance for themselves.")
    await _tenant_user(db, payload.user_id, tenant)
    allowed_statuses = {"PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE", "HOLIDAY"}
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=422, detail=f"Unsupported attendance status: {payload.status}")
    existing = (await db.execute(select(AttendanceRecord).where(
        AttendanceRecord.company_id == tenant.company_id,
        AttendanceRecord.user_id == payload.user_id,
        AttendanceRecord.attendance_date == payload.attendance_date,
        AttendanceRecord.is_deleted == False,
    ))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Attendance already exists for this staff member and date.")
    record = AttendanceRecord(
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        created_by=current_user.id,
        user_id=payload.user_id,
        attendance_date=payload.attendance_date,
        status=payload.status,
        check_in_at=payload.check_in_at,
        check_out_at=payload.check_out_at,
        branch_source_id=payload.branch_source_id or tenant.branch_id,
        register_source=payload.register_source,
        device_source=payload.device_source,
        correction_status="PENDING" if payload.correction_reason else "NONE",
        correction_reason=payload.correction_reason,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/leave/balances")
async def list_leave_balances(
    user_id: Optional[str] = Query(default=None),
    leave_year: int = Query(default_factory=lambda: date.today().year),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        user_id = current_user.id
    stmt = select(LeaveBalance).where(
        LeaveBalance.company_id == tenant.company_id,
        LeaveBalance.leave_year == leave_year,
        LeaveBalance.is_deleted == False,
    )
    if user_id:
        await _tenant_user(db, user_id, tenant)
        stmt = stmt.where(LeaveBalance.user_id == user_id)
    rows = (await db.execute(stmt.order_by(LeaveBalance.user_id, LeaveBalance.leave_type))).scalars().all()
    return {"balances": rows, "total": len(rows), "leave_year": leave_year}


@router.get("/leave/requests")
async def list_leave_requests(
    user_id: Optional[str] = Query(default=None),
    request_status: Optional[str] = Query(default=None, alias="status"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        user_id = current_user.id
    stmt = select(LeaveRequest).where(
        LeaveRequest.company_id == tenant.company_id,
        LeaveRequest.is_deleted == False,
    )
    if user_id:
        await _tenant_user(db, user_id, tenant)
        stmt = stmt.where(LeaveRequest.user_id == user_id)
    if request_status:
        stmt = stmt.where(LeaveRequest.status == request_status)
    rows = (await db.execute(stmt.order_by(LeaveRequest.start_date.desc()))).scalars().all()
    return {"requests": rows, "total": len(rows)}


@router.post("/leave/requests", status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    payload: LeaveRequestCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        if payload.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employees may only submit leave requests for themselves.")
    await _tenant_user(db, payload.user_id, tenant)
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="Leave end date cannot be before start date.")
    total_days = (payload.end_date - payload.start_date).days + 1
    request = LeaveRequest(
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        created_by=current_user.id,
        user_id=payload.user_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_days=total_days,
        reason=payload.reason,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


@router.patch("/leave/requests/{request_id}/decision")
async def decide_leave_request(
    request_id: str,
    payload: LeaveDecision,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    if payload.status not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=422, detail="Leave decision must be APPROVED or REJECTED.")
    request = (await db.execute(select(LeaveRequest).where(
        LeaveRequest.id == request_id,
        LeaveRequest.company_id == tenant.company_id,
        LeaveRequest.is_deleted == False,
    ))).scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Leave request was not found in the active tenant.")
    if request.status != "PENDING":
        raise HTTPException(status_code=409, detail="Only pending leave requests can be decided.")
    request.status = payload.status
    request.approver_id = current_user.id
    request.decision_reason = payload.decision_reason
    request.decided_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(request)
    return request


@router.get("/placements")
async def list_staff_placements(
    user_id: Optional[str] = Query(default=None),
    active_only: bool = Query(default=False),
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    placement_user_ids = [user_id] if user_id else []
    if user_id:
        control_user = (await control_db.execute(select(User).where(
            User.id == user_id,
            User.company_id == tenant.company_id,
            User.is_deleted == False,
        ))).scalar_one_or_none()
        if control_user:
            local_user = (await db.execute(select(User).where(
                User.username == control_user.username,
                User.is_deleted == False,
            ))).scalar_one_or_none()
            if local_user and local_user.id not in placement_user_ids:
                placement_user_ids.append(local_user.id)

    stmt = select(StaffPlacementAssignment).where(
        StaffPlacementAssignment.company_id == tenant.company_id,
        StaffPlacementAssignment.is_deleted == False,
    )
    if user_id:
        stmt = stmt.where(StaffPlacementAssignment.staff_user_id.in_(placement_user_ids))
    if active_only:
        today = date.today()
        stmt = stmt.where(
            StaffPlacementAssignment.status == "ACTIVE",
            StaffPlacementAssignment.effective_from <= today,
            (StaffPlacementAssignment.effective_to.is_(None) | (StaffPlacementAssignment.effective_to >= today)),
        )
    rows = (await db.execute(stmt.order_by(StaffPlacementAssignment.effective_from.desc()))).scalars().all()
    branch_ids = {row.internal_branch_id for row in rows if row.internal_branch_id}
    branches = (await db.execute(select(Branch).where(Branch.id.in_(branch_ids)))).scalars().all() if branch_ids else []
    branch_by_id = {branch.id: branch for branch in branches}
    store_ids = {row.internal_store_id for row in rows if row.internal_store_id}
    stores = (await db.execute(select(Store).where(Store.id.in_(store_ids)))).scalars().all() if store_ids else []
    store_by_id = {store.id: store for store in stores}
    placements = []
    for row in rows:
        payload = _placement_payload(row)
        branch = branch_by_id.get(row.internal_branch_id)
        if branch:
            payload["internal_branch_code"] = branch.code
            payload["internal_branch_name"] = branch.name
        store = store_by_id.get(row.internal_store_id)
        if store:
            payload["internal_store_code"] = store.code
            payload["internal_store_name"] = store.name
        placements.append(payload)
    return {"placements": placements, "total": len(rows)}


@router.post("/users/{user_id}/placements", status_code=status.HTTP_201_CREATED)
async def create_staff_placement(
    user_id: str,
    payload: StaffPlacementCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    control_user = (await control_db.execute(select(User).where(
        User.id == user_id,
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ))).scalar_one_or_none()
    if not control_user:
        raise HTTPException(status_code=404, detail="Staff identity was not found in the active company.")
    local_user = await _resolve_company_local_user(control_user, db, tenant)
    placement_user_id = local_user.id
    if payload.effective_to and payload.effective_to < payload.effective_from:
        raise HTTPException(status_code=422, detail="Placement end date cannot be before its start date.")
    if payload.placement_type not in {"INTERNAL_BRANCH", "CUSTOMER_STORE", "THIRD_PARTY_STORE"}:
        raise HTTPException(status_code=422, detail="Unsupported placement type.")
    if payload.stock_model not in {"OUTRIGHT_SALE", "CONSIGNMENT", "STOCK_ON_APPROVAL"}:
        raise HTTPException(status_code=422, detail="Unsupported stock model.")

    location = None
    if payload.placement_type == "INTERNAL_BRANCH":
        if not payload.internal_branch_id:
            raise HTTPException(status_code=422, detail="Internal placements require a branch.")
        branch = (await db.execute(select(Branch).where(
            Branch.id == payload.internal_branch_id,
            Branch.company_id == tenant.company_id,
            Branch.is_deleted == False,
            Branch.is_active == True,
        ))).scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=404, detail="Internal branch was not found in the active company.")
        if payload.internal_store_id:
            store = (await db.execute(select(Store).where(
                Store.id == payload.internal_store_id,
                Store.company_id == tenant.company_id,
                Store.branch_id == payload.internal_branch_id,
                Store.is_deleted == False,
                Store.is_active == True,
            ))).scalar_one_or_none()
            if not store:
                raise HTTPException(status_code=404, detail="Internal store was not found under the selected branch.")
    else:
        if not payload.host_customer_id or not payload.host_delivery_location_id:
            raise HTTPException(status_code=422, detail="Partner placements require a host customer and store code location.")
        location = (await db.execute(select(CustomerDeliveryLocation).where(
            CustomerDeliveryLocation.id == payload.host_delivery_location_id,
            CustomerDeliveryLocation.customer_id == payload.host_customer_id,
            CustomerDeliveryLocation.company_id == tenant.company_id,
            CustomerDeliveryLocation.status == "ACTIVE",
            CustomerDeliveryLocation.is_deleted == False,
        ))).scalar_one_or_none()
        if not location:
            raise HTTPException(status_code=404, detail="Active partner store code was not found for this customer.")

    existing_active = (await db.execute(select(StaffPlacementAssignment).where(
        StaffPlacementAssignment.company_id == tenant.company_id,
        StaffPlacementAssignment.staff_user_id == placement_user_id,
        StaffPlacementAssignment.status.in_(("PENDING", "ACTIVE")),
        StaffPlacementAssignment.is_deleted == False,
    ))).scalar_one_or_none()
    if existing_active:
        raise HTTPException(status_code=409, detail="This staff member already has a pending or active placement.")

    row = StaffPlacementAssignment(
        company_id=tenant.company_id,
        branch_id=payload.internal_branch_id if payload.placement_type == "INTERNAL_BRANCH" else tenant.branch_id,
        created_by=current_user.id,
        staff_user_id=placement_user_id,
        placement_type=payload.placement_type,
        internal_branch_id=payload.internal_branch_id,
        internal_store_id=payload.internal_store_id,
        host_customer_id=payload.host_customer_id,
        host_delivery_location_id=payload.host_delivery_location_id,
        role_at_location=payload.role_at_location,
        stock_model=payload.stock_model,
        commission_program_id=payload.commission_program_id,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        status="PENDING",
    )
    for field, value in _location_snapshot(location).items():
        setattr(row, field, value)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="This staff member already has a pending or active placement.")
    await db.refresh(row)
    return _placement_payload(row)


@router.patch("/placements/{placement_id}/decision")
async def decide_staff_placement(
    placement_id: str,
    payload: StaffPlacementDecision,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    if payload.status not in {"ACTIVE", "REJECTED", "CANCELLED"}:
        raise HTTPException(status_code=422, detail="Placement decision must be ACTIVE, REJECTED, or CANCELLED.")
    row = (await db.execute(select(StaffPlacementAssignment).where(
        StaffPlacementAssignment.id == placement_id,
        StaffPlacementAssignment.company_id == tenant.company_id,
        StaffPlacementAssignment.is_deleted == False,
    ))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Staff placement was not found in the active tenant.")
    if row.status != "PENDING":
        raise HTTPException(status_code=409, detail="Only pending staff placements can be decided.")
    row.status = payload.status
    row.approval_reason = payload.approval_reason
    row.approved_by = current_user.id
    row.approved_at = date.today()
    await db.commit()
    await db.refresh(row)
    return _placement_payload(row)


@router.post("/users/{user_id}/placements/reassign", status_code=status.HTTP_201_CREATED)
async def reassign_staff_placement(
    user_id: str,
    payload: StaffPlacementReassign,
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Close the current placement and create a new pending placement atomically."""
    _require_manager(current_user)
    control_user = (await control_db.execute(select(User).where(
        User.id == user_id,
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ))).scalar_one_or_none()
    if not control_user:
        raise HTTPException(status_code=404, detail="Staff identity was not found in the active company.")
    local_user = await _resolve_company_local_user(control_user, db, tenant)
    placement_user_ids = [user_id, local_user.id]

    old = (await db.execute(select(StaffPlacementAssignment).where(
        StaffPlacementAssignment.id == payload.current_placement_id,
        StaffPlacementAssignment.company_id == tenant.company_id,
        StaffPlacementAssignment.staff_user_id.in_(placement_user_ids),
        StaffPlacementAssignment.status == "ACTIVE",
        StaffPlacementAssignment.is_deleted == False,
    ))).scalar_one_or_none()
    if not old:
        raise HTTPException(status_code=404, detail="Active staff placement was not found in the active company.")
    if payload.effective_from <= old.effective_from:
        raise HTTPException(status_code=422, detail="The new placement must start after the current placement starts.")
    if payload.effective_to and payload.effective_to < payload.effective_from:
        raise HTTPException(status_code=422, detail="Placement end date cannot be before its start date.")
    if payload.placement_type not in {"INTERNAL_BRANCH", "CUSTOMER_STORE", "THIRD_PARTY_STORE"}:
        raise HTTPException(status_code=422, detail="Unsupported placement type.")
    if payload.stock_model not in {"OUTRIGHT_SALE", "CONSIGNMENT", "STOCK_ON_APPROVAL"}:
        raise HTTPException(status_code=422, detail="Unsupported stock model.")

    location = None
    if payload.placement_type == "INTERNAL_BRANCH":
        if not payload.internal_branch_id:
            raise HTTPException(status_code=422, detail="Internal placements require a branch.")
        branch = (await db.execute(select(Branch).where(
            Branch.id == payload.internal_branch_id,
            Branch.company_id == tenant.company_id,
            Branch.is_deleted == False,
            Branch.is_active == True,
        ))).scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=404, detail="Internal branch was not found in the active company.")
        if payload.internal_store_id:
            store = (await db.execute(select(Store).where(
                Store.id == payload.internal_store_id,
                Store.company_id == tenant.company_id,
                Store.branch_id == payload.internal_branch_id,
                Store.is_deleted == False,
                Store.is_active == True,
            ))).scalar_one_or_none()
            if not store:
                raise HTTPException(status_code=404, detail="Internal store was not found under the selected branch.")
    else:
        if not payload.host_customer_id or not payload.host_delivery_location_id:
            raise HTTPException(status_code=422, detail="Partner placements require a host customer and store code location.")
        location = (await db.execute(select(CustomerDeliveryLocation).where(
            CustomerDeliveryLocation.id == payload.host_delivery_location_id,
            CustomerDeliveryLocation.customer_id == payload.host_customer_id,
            CustomerDeliveryLocation.company_id == tenant.company_id,
            CustomerDeliveryLocation.status == "ACTIVE",
            CustomerDeliveryLocation.is_deleted == False,
        ))).scalar_one_or_none()
        if not location:
            raise HTTPException(status_code=404, detail="Active partner store code was not found for this customer.")

    old.effective_to = payload.effective_from - timedelta(days=1)
    old.status = "EXPIRED"
    old.updated_by = current_user.id
    new_row = StaffPlacementAssignment(
        company_id=tenant.company_id,
        branch_id=payload.internal_branch_id if payload.placement_type == "INTERNAL_BRANCH" else tenant.branch_id,
        created_by=current_user.id,
        staff_user_id=old.staff_user_id,
        placement_type=payload.placement_type,
        internal_branch_id=payload.internal_branch_id,
        internal_store_id=payload.internal_store_id,
        host_customer_id=payload.host_customer_id,
        host_delivery_location_id=payload.host_delivery_location_id,
        role_at_location=payload.role_at_location,
        stock_model=payload.stock_model,
        commission_program_id=payload.commission_program_id,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        status="PENDING",
    )
    for field, value in _location_snapshot(location).items():
        setattr(new_row, field, value)
    db.add(new_row)
    await db.commit()
    await db.refresh(new_row)
    return {"previous": _placement_payload(old), "replacement": _placement_payload(new_row)}
