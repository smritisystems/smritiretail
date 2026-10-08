"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah -- Founder & Chairperson
* Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.70.35
* Created    : 2026-08-24
* Modified   : 2026-10-08
* Copyright  : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software

Sprint 10 -- Staff Management parity.
Shoper9 MnuNo 612 (SR442900/SR443900).
Personnel Catalogue backed by commission_participants table.
Incentive Definition backed by commission_rules + commission_programs.
"""

import json
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy import or_, and_, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from ...api.deps import get_db, get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.commission import CommissionParticipant, CommissionProgram, CommissionRule, CommissionLedger
from ...models.auth import User, UserRole
from ...models.hr import AttendanceRecord, LeaveBalance, LeaveRequest
from ...models.crm import CustomerDeliveryLocation
from ...models.tenant import Branch
from ...models.staff_placement import StaffPlacementAssignment
from ...models.staff_profile import StaffProfile
from ...models.staff_profile_history import StaffProfileHistory
from ...schemas.user import StaffUserUpdate
from ...services.user import UserService, to_staff_response
from ...services.spif import SpifService

router = APIRouter(prefix="/staff")

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class StaffPhotoPayload(BaseModel):
    photo_data: str

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


class AttendancePunchPayload(BaseModel):
    user_id: Optional[str] = None
    punch_type: Optional[str] = "AUTO"  # AUTO | IN | OUT
    device_source: Optional[str] = "WEB_PORTAL"
    register_source: Optional[str] = None
    notes: Optional[str] = None


class BiometricPunchItem(BaseModel):
    employee_code: Optional[str] = None
    user_id: Optional[str] = None
    timestamp: datetime
    punch_state: Optional[str] = "AUTO"  # AUTO | CHECK_IN | CHECK_OUT | 0 | 1
    verify_type: Optional[str] = "BIOMETRIC"  # FINGERPRINT | FACE | CARD | PASSWORD


class BiometricDevicePushPayload(BaseModel):
    device_id: str
    device_key: Optional[str] = None
    branch_id: Optional[str] = None
    punches: List[BiometricPunchItem] = []


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
    # Phase C (v1454): Store entity retired; canonical replacements are Branch and Warehouse
    return {
        "branches": [{"id": branch.id, "code": branch.code, "name": branch.name} for branch in branches],
        "stores": [],
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
    json_fields = {
        "salary_json": "salary",
        "payment_json": "payment",
        "performance_json": "performance",
        "preferences_json": "preferences",
        "notification_settings_json": "notificationSettings",
        "allowed_branches": "allowedBranches",
    }
    for source, target in profile_fields.items():
        value = getattr(profile, source)
        if value is not None:
            if source in json_fields and isinstance(value, str):
                try:
                    payload[target] = json.loads(value)
                except Exception:
                    payload[target] = value
            else:
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


@router.get("", response_model=None)
@router.get("/", response_model=None)
async def list_staff_f2_lookup(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """
    F2 Universal Lookup endpoint for sales staff and personnel.
    Returns staff items matching LOOKUP_REGISTRY contract (code, name, role, counter).
    """
    cid = tenant.company_id or "COMP-001"
    stmt = select(User).where(
        or_(User.company_id == cid, User.company_id.is_(None)),
        User.is_deleted == False,
    )
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.username.ilike(term),
                User.full_name.ilike(term),
                User.display_name.ilike(term),
                User.employee_code.ilike(term),
            )
        )
    users = (await control_db.execute(stmt.order_by(User.username.asc()))).scalars().all()

    profiles = (await company_db.execute(select(StaffProfile).where(
        StaffProfile.company_id == cid,
        StaffProfile.is_deleted == False,
    ))).scalars().all()
    profiles_by_user = {profile.user_id: profile for profile in profiles}

    items = []
    for u in users:
        prof = profiles_by_user.get(u.id)
        code = getattr(u, "employee_code", None) or u.username
        name = getattr(u, "full_name", None) or getattr(u, "display_name", None) or u.username
        role = getattr(u, "role", None) or "Salesperson"
        counter = getattr(prof, "counter", None) or "Main Counter"
        items.append({
            "id": u.id,
            "code": code,
            "name": name,
            "role": str(role).replace("UserRole.", ""),
            "counter": counter,
            "mobile": getattr(u, "mobile", ""),
            "email": getattr(u, "email", ""),
            "status": "Active" if getattr(u, "is_active", True) else "Inactive",
        })

    paged = items[offset:offset + limit]
    return {
        "items": paged,
        "total": len(items),
        "limit": limit,
        "offset": offset,
    }


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
    profile_was_new = False
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
    user_service = UserService(control_db, tenant)
    control_user_updated = False
    old_role = user.role
    old_status = user.status

    if "role" in values and values["role"] != user.role:
        if current_user.role != UserRole.SYSADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a system administrator can change a staff access role.")
        if user.role == UserRole.SYSADMIN and values["role"] != UserRole.SYSADMIN:
            await user_service._assert_not_last_active_sysadmin(user.id, "demote")
        user.role = values["role"]
        control_user_updated = True

    if "fullName" in values and values["fullName"] != user.full_name:
        user.full_name = values["fullName"]
        control_user_updated = True

    if "status" in values and values["status"] != user.status:
        if values["status"] == "Inactive":
            if current_user.id == user.id:
                raise HTTPException(status_code=400, detail="You cannot deactivate your own operator account.")
            if user.role == UserRole.SYSADMIN:
                await user_service._assert_not_last_active_sysadmin(user.id, "deactivate")
            await user_service._check_active_pos_shifts(user.id, user.company_id)
            user.is_active = False
            user.status = "Inactive"
        elif values["status"] == "Active":
            user.is_active = True
            user.is_deleted = False
            user.status = "Active"
        control_user_updated = True

    if control_user_updated:
        user.modified_at = datetime.now(timezone.utc)
        if old_status == "Inactive" and user.status == "Active":
            await user_service._record_audit("USER_REACTIVATED", user.id, actor=current_user, reason="Staff directory account reactivated")
        elif old_status == "Active" and user.status == "Inactive":
            await user_service._record_audit("USER_DEACTIVATED", user.id, actor=current_user, reason="Staff directory account deactivated")
        elif "role" in values and old_role != user.role:
            await user_service._record_audit("USER_ROLE_CHANGED", user.id, actor=current_user, old_val=str(old_role), new_val=str(user.role), reason="Staff directory role updated")
        else:
            await user_service._record_audit("USER_UPDATED", user.id, actor=current_user, reason="Staff directory identity fields updated")
        await control_db.commit()
        await control_db.refresh(user)
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


@router.post("/directory/{user_id}/photo")
async def upload_staff_photo(
    user_id: str,
    payload: StaffPhotoPayload,
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Upload, optimize to WebP via SPIF, and attach staff headshot photo."""
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

    # Delete previous local photo if present
    if profile.photo and "/photos/" in profile.photo:
        old_filename = profile.photo.split("/photos/")[-1]
        SpifService.delete_image_file(old_filename)

    try:
        filename = SpifService.process_and_save_base64_image(payload.photo_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process staff photo: {str(e)}")

    relative_url = f"/api/v1/staff/photos/{filename}"
    profile.photo = relative_url
    profile.modified_at = datetime.now(timezone.utc)
    user.photo = relative_url

    await company_db.commit()
    await control_db.commit()
    return {"success": True, "photoUrl": relative_url, "filename": filename}


@router.delete("/directory/{user_id}/photo")
async def delete_staff_photo(
    user_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    control_db: AsyncSession = Depends(get_db),
    company_db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """Delete staff photo."""
    _require_manager(current_user)
    profile = (await company_db.execute(select(StaffProfile).where(
        StaffProfile.company_id == tenant.company_id,
        StaffProfile.user_id == user_id,
        StaffProfile.is_deleted == False,
    ))).scalar_one_or_none()
    if profile and profile.photo:
        if "/photos/" in profile.photo:
            old_filename = profile.photo.split("/photos/")[-1]
            SpifService.delete_image_file(old_filename)
        profile.photo = None
        profile.modified_at = datetime.now(timezone.utc)
        await company_db.commit()

    user = (await control_db.execute(select(User).where(
        User.id == user_id,
        User.company_id == tenant.company_id,
        User.is_deleted == False,
    ))).scalar_one_or_none()
    if user:
        user.photo = None
        await control_db.commit()

    return {"success": True, "message": "Photo removed"}


DEFAULT_STAFF_AVATAR_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">'
    '<rect width="128" height="128" rx="64" fill="#1e293b"/>'
    '<circle cx="64" cy="50" r="22" fill="#64748b"/>'
    '<path d="M28 110c0-19.882 16.118-36 36-36s36 16.118 36 36z" fill="#64748b"/>'
    '</svg>'
)


@router.get("/photos/{filename}", include_in_schema=False)
async def get_staff_photo(filename: str):
    """Serve staff photo from the local static uploads folder, falling back to a clean default avatar."""
    clean_filename = os.path.basename(filename)
    filepath = SpifService.get_image_path(clean_filename)
    if not os.path.exists(filepath):
        return Response(content=DEFAULT_STAFF_AVATAR_SVG, media_type="image/svg+xml")
    return FileResponse(filepath, media_type="image/webp")


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
# STAFF-003B: Real-Time Sales Commission & Incentive Summary
# GET /api/v1/staff/commissions/summary
# ---------------------------------------------------------------------------

@router.get("/commissions/summary")
async def get_commissions_summary(
    user_id: Optional[str] = Query(default=None),
    participant_id: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default=None, description="Month format YYYY-MM"),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    control_db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Authoritative Real-Time Sales Commission & Incentive Summary.
    Aggregates PostgreSQL commission_ledgers transactions (EARNED, REVERSED)
    for a staff member or all participants within the tenant.
    """
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        user_id = current_user.id

    target_participant_ids = []
    if participant_id:
        target_participant_ids.append(participant_id)
    elif user_id:
        parts = (await db.execute(
            select(CommissionParticipant.id).where(
                CommissionParticipant.company_id == tenant.company_id,
                or_(CommissionParticipant.user_id == user_id, CommissionParticipant.id == user_id),
                CommissionParticipant.is_deleted == False
            )
        )).scalars().all()
        target_participant_ids.extend(parts)
        if not target_participant_ids:
            target_participant_ids.append(f"cp-missing-{user_id}")

    conditions = [
        CommissionLedger.company_id == tenant.company_id,
        CommissionLedger.is_deleted == False,
    ]
    if target_participant_ids:
        conditions.append(CommissionLedger.participant_id.in_(target_participant_ids))

    if period:
        try:
            yr, mo = [int(x) for x in period.split("-")]
            start_dt = datetime(yr, mo, 1, 0, 0, 0, tzinfo=timezone.utc)
            if mo == 12:
                end_dt = datetime(yr + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
            else:
                end_dt = datetime(yr, mo + 1, 1, 0, 0, 0, tzinfo=timezone.utc)
            conditions.append(CommissionLedger.timestamp >= start_dt)
            conditions.append(CommissionLedger.timestamp < end_dt)
        except Exception:
            pass
    else:
        if from_date:
            conditions.append(CommissionLedger.timestamp >= datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc))
        if to_date:
            conditions.append(CommissionLedger.timestamp <= datetime.combine(to_date, datetime.max.time(), tzinfo=timezone.utc))

    agg_stmt = select(
        func.count(CommissionLedger.id).label("tx_count"),
        func.coalesce(func.sum(case((CommissionLedger.gross_sales_amount > 0, CommissionLedger.gross_sales_amount), else_=0)), 0).label("gross_sales"),
        func.coalesce(func.sum(case((CommissionLedger.gross_sales_amount < 0, CommissionLedger.gross_sales_amount), else_=0)), 0).label("returned_sales"),
        func.coalesce(func.sum(case((CommissionLedger.transaction_type == 'EARNED', CommissionLedger.commission_amount), else_=0)), 0).label("earned_comm"),
        func.coalesce(func.sum(case((CommissionLedger.transaction_type == 'REVERSED', CommissionLedger.commission_amount), else_=0)), 0).label("reversed_comm"),
    ).where(and_(*conditions))

    agg_res = (await db.execute(agg_stmt)).fetchone()
    tx_count = agg_res.tx_count if agg_res else 0
    gross_sales = float(agg_res.gross_sales or 0) if agg_res else 0.0
    returned_sales = float(agg_res.returned_sales or 0) if agg_res else 0.0
    earned_comm = float(agg_res.earned_comm or 0) if agg_res else 0.0
    reversed_comm = float(agg_res.reversed_comm or 0) if agg_res else 0.0
    net_sales = round(gross_sales + returned_sales, 2)
    net_comm = round(earned_comm + reversed_comm, 2)

    ledger_stmt = select(CommissionLedger).where(and_(*conditions)).order_by(CommissionLedger.timestamp.desc()).limit(50)
    ledgers = (await db.execute(ledger_stmt)).scalars().all()

    entries = [
        {
            "id": l.id,
            "participant_id": l.participant_id,
            "participant_role": l.participant_role,
            "transaction_type": l.transaction_type,
            "gross_sales_amount": float(l.gross_sales_amount or 0),
            "commission_amount": float(l.commission_amount or 0),
            "reference_invoice_id": l.reference_invoice_id,
            "reference_return_id": l.reference_return_id,
            "narration": l.narration,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        }
        for l in ledgers
    ]

    return {
        "success": True,
        "company_id": tenant.company_id,
        "user_id": user_id,
        "participant_id": target_participant_ids[0] if len(target_participant_ids) == 1 else None,
        "period": period or (from_date.isoformat() if from_date else "ALL"),
        "transaction_count": tx_count,
        "gross_sales": gross_sales,
        "returned_sales": abs(returned_sales),
        "net_sales": net_sales,
        "earned_commission": earned_comm,
        "reversed_commission": abs(reversed_comm),
        "net_commission": net_comm,
        "entries": entries,
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


@router.get("/attendance/summary")
async def get_attendance_summary(
    user_id: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default=None, description="Month format YYYY-MM"),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """
    Authoritative Period Attendance KPI Summary.
    Aggregates PostgreSQL attendance_records to provide exact counts of present,
    absent, leave, late, total hours worked, and average daily shift hours.
    """
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        user_id = current_user.id

    conditions = [
        AttendanceRecord.company_id == tenant.company_id,
        AttendanceRecord.is_deleted == False,
    ]
    if user_id:
        conditions.append(AttendanceRecord.user_id == user_id)

    if period:
        try:
            yr, mo = [int(x) for x in period.split("-")]
            start_date = date(yr, mo, 1)
            if mo == 12:
                end_date = date(yr + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(yr, mo + 1, 1) - timedelta(days=1)
            conditions.append(AttendanceRecord.attendance_date >= start_date)
            conditions.append(AttendanceRecord.attendance_date <= end_date)
        except Exception:
            pass
    else:
        if from_date:
            conditions.append(AttendanceRecord.attendance_date >= from_date)
        if to_date:
            conditions.append(AttendanceRecord.attendance_date <= to_date)

    records = (await db.execute(
        select(AttendanceRecord).where(and_(*conditions)).order_by(AttendanceRecord.attendance_date.desc())
    )).scalars().all()

    present_days = 0
    late_days = 0
    half_days = 0
    absent_days = 0
    leave_days = 0
    holiday_days = 0
    total_hours_worked = 0.0

    for r in records:
        st = (r.status or "").upper()
        if st == "PRESENT":
            present_days += 1
        elif st == "LATE":
            late_days += 1
            present_days += 1
        elif st == "HALF_DAY":
            half_days += 1
        elif st == "ABSENT":
            absent_days += 1
        elif st == "LEAVE":
            leave_days += 1
        elif st == "HOLIDAY":
            holiday_days += 1

        if r.check_in_at and r.check_out_at:
            delta = (r.check_out_at - r.check_in_at).total_seconds() / 3600.0
            if delta > 0:
                total_hours_worked += delta

    total_days = len(records)
    effective_days = present_days + (half_days * 0.5)
    avg_daily_hours = round(total_hours_worked / effective_days, 2) if effective_days > 0 else 0.0

    return {
        "success": True,
        "company_id": tenant.company_id,
        "user_id": user_id,
        "period": period or (from_date.isoformat() if from_date else "ALL"),
        "total_days": total_days,
        "present_days": present_days,
        "late_days": late_days,
        "half_days": half_days,
        "absent_days": absent_days,
        "leave_days": leave_days,
        "holiday_days": holiday_days,
        "total_hours_worked": round(total_hours_worked, 2),
        "avg_daily_hours": avg_daily_hours,
    }


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


@router.post("/attendance/punch")
async def record_attendance_punch(
    payload: AttendancePunchPayload,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """
    Interactive Punch Clocking Endpoint.
    Records clock-in or clock-out for a staff member.
    Idempotent and auto-determines IN vs OUT transition if punch_type='AUTO'.
    """
    target_user_id = payload.user_id or current_user.id
    if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
        if target_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees may only punch attendance for themselves."
            )
    await _tenant_user(db, target_user_id, tenant)

    now_utc = datetime.now(timezone.utc)
    today = now_utc.date()

    existing = (await db.execute(select(AttendanceRecord).where(
        AttendanceRecord.company_id == tenant.company_id,
        AttendanceRecord.user_id == target_user_id,
        AttendanceRecord.attendance_date == today,
        AttendanceRecord.is_deleted == False,
    ))).scalar_one_or_none()

    punch_mode = (payload.punch_type or "AUTO").upper()

    if not existing:
        # First punch of today -> Clock IN
        record = AttendanceRecord(
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            created_by=current_user.id,
            user_id=target_user_id,
            attendance_date=today,
            status="PRESENT",
            check_in_at=now_utc,
            check_out_at=None,
            branch_source_id=tenant.branch_id,
            register_source=payload.register_source,
            device_source=payload.device_source or "WEB_PORTAL",
            correction_status="NONE",
            correction_reason=payload.notes,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return {
            "success": True,
            "action": "CHECKED_IN",
            "message": f"Successfully clocked in at {now_utc.strftime('%H:%M')}",
            "record": {
                "id": record.id,
                "user_id": record.user_id,
                "attendance_date": record.attendance_date.isoformat(),
                "status": record.status,
                "check_in_at": record.check_in_at.isoformat() if record.check_in_at else None,
                "check_out_at": record.check_out_at.isoformat() if record.check_out_at else None,
                "device_source": record.device_source,
            }
        }
    else:
        # Record exists
        if punch_mode == "IN" and not existing.check_in_at:
            existing.check_in_at = now_utc
            action_done = "CHECKED_IN"
            msg = f"Clock-in updated at {now_utc.strftime('%H:%M')}"
        elif punch_mode == "IN" and existing.check_in_at:
            return {
                "success": True,
                "action": "ALREADY_CHECKED_IN",
                "message": f"Already clocked in at {existing.check_in_at.strftime('%H:%M')}",
                "record": {
                    "id": existing.id,
                    "user_id": existing.user_id,
                    "attendance_date": existing.attendance_date.isoformat(),
                    "status": existing.status,
                    "check_in_at": existing.check_in_at.isoformat() if existing.check_in_at else None,
                    "check_out_at": existing.check_out_at.isoformat() if existing.check_out_at else None,
                    "device_source": existing.device_source,
                }
            }
        else:
            # AUTO or OUT -> Clock OUT
            existing.check_out_at = now_utc
            if payload.device_source:
                existing.device_source = f"{existing.device_source or ''}, {payload.device_source}".strip(", ")
            action_done = "CHECKED_OUT"
            msg = f"Successfully clocked out at {now_utc.strftime('%H:%M')}"

        existing.modified_at = now_utc
        existing.updated_by = current_user.id
        await db.commit()
        await db.refresh(existing)
        return {
            "success": True,
            "action": action_done,
            "message": msg,
            "record": {
                "id": existing.id,
                "user_id": existing.user_id,
                "attendance_date": existing.attendance_date.isoformat(),
                "status": existing.status,
                "check_in_at": existing.check_in_at.isoformat() if existing.check_in_at else None,
                "check_out_at": existing.check_out_at.isoformat() if existing.check_out_at else None,
                "device_source": existing.device_source,
            }
        }


@router.post("/attendance/device-push")
async def receive_biometric_device_push(
    payload: BiometricDevicePushPayload,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    control_db: AsyncSession = Depends(get_db),
):
    """
    IoT Biometric Device Push Webhook.
    Receives raw punch streams from hardware terminals (ZKTeco, eSSL, Matrix).
    Resolves employee codes to tenant users and upserts attendance records.
    """
    if not payload.punches:
        return {"processed": 0, "success": True, "message": "No punches to process"}

    profiles = (await db.execute(
        select(StaffProfile).where(
            StaffProfile.company_id == tenant.company_id,
            StaffProfile.is_deleted == False,
        )
    )).scalars().all()

    code_to_uid = {}
    for p in profiles:
        if p.employee_code:
            code_to_uid[p.employee_code.strip().upper()] = p.user_id
        if p.employee_id:
            code_to_uid[p.employee_id.strip().upper()] = p.user_id

    users = (await control_db.execute(
        select(User).where(
            or_(User.company_id == tenant.company_id, User.company_id.is_(None)),
            User.is_deleted == False,
        )
    )).scalars().all()
    for u in users:
        if u.employee_code:
            code_to_uid.setdefault(u.employee_code.strip().upper(), u.id)
        if u.employee_id:
            code_to_uid.setdefault(u.employee_id.strip().upper(), u.id)
        code_to_uid.setdefault(u.username.strip().upper(), u.id)
        code_to_uid.setdefault(u.id.upper(), u.id)

    processed_count = 0
    errors = []

    for item in payload.punches:
        raw_code = (item.employee_code or item.user_id or "").strip().upper()
        resolved_uid = code_to_uid.get(raw_code)
        if not resolved_uid:
            errors.append(f"Unrecognized employee code '{raw_code}'")
            continue

        punch_time = item.timestamp
        if punch_time.tzinfo is None:
            punch_time = punch_time.replace(tzinfo=timezone.utc)
        punch_date = punch_time.date()

        existing = (await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.company_id == tenant.company_id,
                AttendanceRecord.user_id == resolved_uid,
                AttendanceRecord.attendance_date == punch_date,
                AttendanceRecord.is_deleted == False,
            )
        )).scalar_one_or_none()

        device_tag = f"IoT-{payload.device_id}:{item.verify_type or 'BIO'}"
        state = str(item.punch_state or "AUTO").upper()

        if not existing:
            new_rec = AttendanceRecord(
                company_id=tenant.company_id,
                branch_id=payload.branch_id or tenant.branch_id,
                created_by="system-biometric",
                user_id=resolved_uid,
                attendance_date=punch_date,
                status="PRESENT",
                check_in_at=punch_time,
                check_out_at=None,
                branch_source_id=payload.branch_id or tenant.branch_id,
                register_source="BIOMETRIC_TERMINAL",
                device_source=device_tag,
            )
            db.add(new_rec)
        else:
            if state in ("CHECK_IN", "0"):
                if not existing.check_in_at or punch_time < existing.check_in_at:
                    existing.check_in_at = punch_time
            elif state in ("CHECK_OUT", "1"):
                if not existing.check_out_at or punch_time > existing.check_out_at:
                    existing.check_out_at = punch_time
            else:
                if existing.check_in_at and punch_time > existing.check_in_at:
                    existing.check_out_at = punch_time
                elif not existing.check_in_at:
                    existing.check_in_at = punch_time

            existing.modified_at = datetime.now(timezone.utc)
            if existing.device_source and device_tag not in existing.device_source:
                existing.device_source = f"{existing.device_source}, {device_tag}"
            elif not existing.device_source:
                existing.device_source = device_tag

        processed_count += 1

    await db.commit()
    return {
        "success": True,
        "processed": processed_count,
        "device_id": payload.device_id,
        "errors": errors,
    }


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
    # Phase C (v1454): Store entity retired; store_by_id mapping is empty
    store_by_id = {}
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
        # Phase C (v1454): Store entity retired; internal_store_id retained as optional legacy reference
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
        # Phase C (v1454): Store entity retired; internal_store_id retained as optional legacy reference
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
