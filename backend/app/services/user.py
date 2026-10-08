"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import json
import random
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.auth import User, UserRole
from ..models.tenant import Company, Branch
from ..models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from ..schemas.user import (
    UserCreate, UserUpdate, PasswordChange, StaffUserCreate, StaffUserUpdate,
    StaffUserResponse, SalaryStructure, PaymentDetails, PerformanceMetrics,
    UserPreferencesSchema, NotificationSettings
)
from ..core.security import hash_password, verify_password, validate_password_strength
from ..api.deps import TenantContext


def to_staff_response(user: User) -> StaffUserResponse:
    # default presets
    salary = SalaryStructure()
    payment = PaymentDetails()
    performance = PerformanceMetrics()
    preferences = UserPreferencesSchema()
    notifications = NotificationSettings()
    
    if user.salary_json:
        try:
            salary = SalaryStructure.parse_raw(user.salary_json)
        except Exception:
            pass
    if user.payment_json:
        try:
            payment = PaymentDetails.parse_raw(user.payment_json)
        except Exception:
            pass
    if user.performance_json:
        try:
            performance = PerformanceMetrics.parse_raw(user.performance_json)
        except Exception:
            pass
    if user.preferences_json:
        try:
            preferences = UserPreferencesSchema.parse_raw(user.preferences_json)
        except Exception:
            pass
    if user.notification_settings_json:
        try:
            notifications = NotificationSettings.parse_raw(user.notification_settings_json)
        except Exception:
            pass
            
    allowed_branches = []
    if user.allowed_branches:
        try:
            allowed_branches = json.loads(user.allowed_branches)
        except Exception:
            pass
            
    return StaffUserResponse(
        id=user.id,
        userId=user.id,
        username=user.username,
        email=user.email or "",
        mobile=user.mobile or "0000000000",
        role=user.role,
        status=user.status or "Active",
        fullName=user.full_name or "",
        displayName=user.display_name or "",
        employeeId=user.employee_id or "",
        employeeCode=user.employee_code or "",
        gender=user.gender or "Male",
        dateOfBirth=user.date_of_birth or "1990-01-01",
        alternateMobile=user.alternate_mobile or "",
        emergencyContact=user.emergency_contact or "",
        address=user.address or "",
        city=user.city or "",
        state=user.state or "",
        country=user.country or "India",
        pinCode=user.pin_code or "",
        department=user.department or "Retail Operations",
        designation=user.designation or "Executive",
        branch=user.branch or "Andheri West, Mumbai",
        departmentId=user.department_id,
        designationId=user.designation_id,
        branchId=user.branch_id,
        companyId=user.company_id,
        dateOfJoining=user.date_of_joining or "",
        reportingManager=user.reporting_manager or "",
        employmentType=user.employment_type or "Permanent",
        allowedBranches=allowed_branches,
        photo=user.photo or "",
        salary=salary,
        payment=payment,
        performance=performance,
        preferences=preferences,
        notificationSettings=notifications,
        roleId=user.role_id,
        role_id=user.role_id,
    )


class UserService:
    def __init__(self, db: AsyncSession, tenant: TenantContext | None = None):
        self.db = db
        self.tenant = tenant

    def _tenant_scope(self, query, tenant: TenantContext | None = None):
        active_tenant = tenant or self.tenant
        if not active_tenant:
            return query
        # Global SYSADMIN manages users across all companies and branches
        role = getattr(active_tenant, "role", None)
        if role in (UserRole.SYSADMIN, "SYSADMIN"):
            return query
        if active_tenant.company_id:
            query = query.where(or_(User.company_id == active_tenant.company_id, User.role == UserRole.SYSADMIN))
        if active_tenant.branch_id:
            query = query.where(or_(User.branch_id == active_tenant.branch_id, User.role == UserRole.SYSADMIN))
        return query

    async def _assert_not_last_active_sysadmin(self, user_id: str, action_desc: str = "deactivate or demote") -> None:
        """
        AUD-USR-02: Guard against demoting or inactivating the last remaining SYSADMIN account.
        """
        q = select(func.count()).where(
            User.role == UserRole.SYSADMIN,
            User.is_deleted == False,
            User.is_active == True,
            User.id != user_id,
        )
        remaining = (await self.db.execute(q)).scalar_one()
        if remaining == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot {action_desc} the last active SYSADMIN. Ensure at least one other active SYSADMIN exists before modifying this account.",
            )

    async def _check_active_pos_shifts(self, user_id: str, company_id: str | None = None) -> None:
        """
        AUD-USR-06: Pre-check for open POS shifts before cashier deactivation.
        """
        cid = company_id or (self.tenant.company_id if self.tenant else None)
        if not cid:
            return
        try:
            from ..db.session import resolve_company_database_name, get_company_sessionmaker
            from ..models.pos import Shift
            db_name = await resolve_company_database_name(cid)
            session_factory = get_company_sessionmaker(db_name)
            async with session_factory() as tenant_session:
                q = select(Shift.id).where(
                    Shift.cashier_id == user_id,
                    Shift.status == "OPEN",
                    Shift.is_deleted == False
                )
                open_shift = (await tenant_session.execute(q)).scalars().first()
                if open_shift:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Cannot deactivate operator '{user_id}': User has an active OPEN POS shift ({open_shift}). "
                            "Please perform shift reconciliation and close the shift before deactivation."
                        )
                    )
        except HTTPException as http_exc:
            if http_exc.status_code == 400 and "active OPEN POS shift" in str(http_exc.detail):
                raise
            # If company database registry is not found or not in READY status, pass
            pass
        except Exception:
            pass

    async def _enroll_assignments(self, user: User) -> None:
        """
        AUD-USR-04: Automatically maintain relational company and branch assignments.
        """
        if not user.company_id:
            return
        try:
            q_uca = select(UserCompanyAssignment).where(
                UserCompanyAssignment.user_id == user.id,
                UserCompanyAssignment.company_id == user.company_id,
                UserCompanyAssignment.is_deleted == False
            )
            existing_uca = (await self.db.execute(q_uca)).scalars().first()
            if not existing_uca:
                uca = UserCompanyAssignment(
                    company_id=user.company_id,
                    user_id=user.id,
                    is_default=True,
                )
                self.db.add(uca)

            if user.branch_id:
                q_uba = select(UserBranchAssignment).where(
                    UserBranchAssignment.user_id == user.id,
                    UserBranchAssignment.branch_id == user.branch_id,
                    UserBranchAssignment.is_deleted == False
                )
                existing_uba = (await self.db.execute(q_uba)).scalars().first()
                if not existing_uba:
                    uba = UserBranchAssignment(
                        company_id=user.company_id,
                        branch_id=user.branch_id,
                        user_id=user.id,
                        is_default=True,
                    )
                    self.db.add(uba)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Notice: unable to enroll user assignments: {e}")

    async def _record_audit(
        self,
        event_type: str,
        record_id: str,
        actor: User | None = None,
        details: dict | None = None,
        reason: str | None = None,
        old_val: str | None = None,
        new_val: str | None = None,
    ) -> None:
        """
        AUD-USR-07: Record immutable audit journal entry in smriti_audit_log.
        """
        try:
            from ..models.security import SmritiAuditLog
            async with self.db.begin_nested():
                entry = SmritiAuditLog(
                    id=f"aud-{uuid.uuid4().hex[:12]}",
                    tenant_id=self.tenant.company_id if self.tenant else None,
                    entity_id=record_id,
                    changed_table="users",
                    changed_record_id=record_id,
                    change_type=event_type,
                    change_reason=reason or (json.dumps(details) if details else None),
                    change_source="api/v1/users",
                    changed_by=actor.id if actor else None,
                    changed_by_name=actor.username if actor else "SYSTEM",
                    old_value=old_val,
                    new_value=new_val,
                    changed_at=datetime.now(timezone.utc),
                )
                self.db.add(entry)
                await self.db.flush()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Notice: unable to persist SmritiAuditLog: {e}")

    # ------------------------------------------------------------------
    # Create user (SYSADMIN only)
    # ------------------------------------------------------------------
    async def create_user(self, req: UserCreate, commit: bool = True, requesting_user: User | None = None) -> User:
        if req.role != UserRole.SYSADMIN:
            if not req.company_id or not req.branch_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"A {req.role.value} user must be assigned to a company and branch. "
                        "Please provide company_id and branch_id."
                    ),
                )
            company = await self.db.get(Company, req.company_id)
            if not company or not company.is_active or company.is_deleted:
                raise HTTPException(
                    status_code=400,
                    detail="The specified company does not exist or is inactive.",
                )
            branch = await self.db.get(Branch, req.branch_id)
            if not branch or branch.company_id != req.company_id \
                    or not branch.is_active or branch.is_deleted:
                raise HTTPException(
                    status_code=400,
                    detail="The specified branch does not exist, is inactive, "
                           "or does not belong to the given company.",
                )

        validate_password_strength(req.password)
        user = User(
            id=f"usr-{uuid.uuid4().hex[:8]}",
            username=req.username,
            email=req.email,
            mobile=req.mobile,
            hashed_password=hash_password(req.password),
            role=req.role,
            is_active=True,
            is_deleted=False,
            company_id=req.company_id,
            branch_id=req.branch_id,
        )
        self.db.add(user)
        try:
            await self._enroll_assignments(user)
            await self._record_audit(
                event_type="USER_CREATED",
                record_id=user.id,
                actor=requesting_user,
                details={"role": str(user.role), "username": user.username},
                reason="Control plane user created",
            )
            if commit:
                await self.db.commit()
            else:
                await self.db.flush()
        except IntegrityError:
            if commit:
                await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A user with this username or email already exists. "
                       "Please choose a different username or email.",
            )
        await self.db.refresh(user)
        return user

    # ------------------------------------------------------------------
    # List users (SYSADMIN only)
    # ------------------------------------------------------------------
    async def list_users(
        self,
        skip: int = 0,
        limit: int = 50,
        company_id: str | None = None,
        role: UserRole | None = None,
    ) -> tuple[int, list[User]]:
        q = select(User).where(User.is_deleted == False)
        if company_id:
            q = q.where(User.company_id == company_id)
        if role:
            q = q.where(User.role == role)

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        result = await self.db.execute(q.offset(skip).limit(limit))
        return total, result.scalars().all()

    # ------------------------------------------------------------------
    # Get single user
    # ------------------------------------------------------------------
    async def get_user(self, user_id: str, tenant: TenantContext | None = None, include_deleted: bool = False) -> User:
        query = select(User).where(User.id == user_id)
        if not include_deleted:
            query = query.where(User.is_deleted == False)
        query = self._tenant_scope(query, tenant)
        res = await self.db.execute(query)
        user = res.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return user

    # ------------------------------------------------------------------
    # Update user (SYSADMIN only)
    # ------------------------------------------------------------------
    async def update_user(self, user_id: str, req: UserUpdate, requesting_user: User | None = None) -> User:
        is_reactivation = (req.is_active is True)
        user = await self.get_user(user_id, include_deleted=is_reactivation)

        effective_role = req.role if req.role is not None else user.role
        if user.role == UserRole.SYSADMIN and (
            (req.role is not None and req.role != UserRole.SYSADMIN) or
            (req.is_active is False)
        ):
            await self._assert_not_last_active_sysadmin(user.id, "demote or deactivate")

        old_role = user.role
        old_active = user.is_active

        if req.email      is not None: user.email      = req.email
        if req.mobile     is not None: user.mobile     = req.mobile
        if req.role       is not None: user.role       = req.role
        if req.is_active  is not None:
            user.is_active  = req.is_active
            user.status = "Active" if req.is_active else "Inactive"
            if req.is_active:
                user.is_deleted = False
        if req.company_id is not None: user.company_id = req.company_id
        if req.branch_id  is not None: user.branch_id  = req.branch_id

        if effective_role != UserRole.SYSADMIN:
            if not user.company_id or not user.branch_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"A {effective_role.value} user must have both a company and branch assigned.",
                )

        await self._enroll_assignments(user)
        user.modified_at = datetime.now(timezone.utc)

        # Audit
        if old_active is False and user.is_active is True:
            await self._record_audit("USER_REACTIVATED", user.id, actor=requesting_user, reason="User reactivated")
        elif old_active is True and user.is_active is False:
            await self._record_audit("USER_DEACTIVATED", user.id, actor=requesting_user, reason="User deactivated via is_active=False")
        elif req.role is not None and old_role != user.role:
            await self._record_audit("USER_ROLE_CHANGED", user.id, actor=requesting_user, old_val=str(old_role), new_val=str(user.role))
        else:
            await self._record_audit("USER_UPDATED", user.id, actor=requesting_user)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="The update conflicts with an existing record (duplicate email or username).",
            )
        await self.db.refresh(user)
        return user

    # ------------------------------------------------------------------
    # Deactivate user — soft delete (SYSADMIN only)
    # ------------------------------------------------------------------
    async def deactivate_user(self, user_id: str, requesting_user_id: str) -> None:
        if user_id == requesting_user_id:
            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account. "
                       "Ask another SYSADMIN to deactivate it.",
            )
        user = await self.get_user(user_id)
        if user.role == UserRole.SYSADMIN:
            await self._assert_not_last_active_sysadmin(user.id, "deactivate")

        await self._check_active_pos_shifts(user.id, user.company_id)

        user.is_active  = False
        user.is_deleted = True
        user.status = "Inactive"
        user.modified_at = datetime.now(timezone.utc)
        await self._record_audit(
            event_type="USER_DEACTIVATED",
            record_id=user.id,
            reason=f"SYSADMIN deactivation by {requesting_user_id}",
        )
        await self.db.commit()

    # ------------------------------------------------------------------
    # Change own password
    # ------------------------------------------------------------------
    async def change_password(self, user_id: str, req: PasswordChange) -> None:
        user = await self.get_user(user_id)
        if not verify_password(req.current_password, user.hashed_password):
            raise HTTPException(
                status_code=400,
                detail="The current password you entered is incorrect. "
                       "Please try again.",
            )
        if req.current_password == req.new_password:
            raise HTTPException(
                status_code=400,
                detail="The new password must be different from the current password.",
            )
        validate_password_strength(req.new_password)
        user.hashed_password = hash_password(req.new_password)
        user.modified_at = datetime.now(timezone.utc)
        user.status = "Active"
        await self._record_audit(
            event_type="USER_PASSWORD_CHANGED",
            record_id=user.id,
            actor=user,
            reason="User self-service password update",
        )
        await self.db.commit()

    # ==================================================================
    # Staff Management Extended Operations
    # ==================================================================
    async def create_staff_user(self, req: StaffUserCreate, requesting_user: User | None = None) -> StaffUserResponse:
        # Check privilege escalation
        if req.role == UserRole.SYSADMIN:
            if requesting_user is not None and requesting_user.role != UserRole.SYSADMIN:
                raise HTTPException(
                    status_code=403,
                    detail="Access Denied: Only a SYSADMIN can create another SYSADMIN user."
                )

        # Check if username exists
        q = select(User).where(User.username == req.username, User.is_deleted == False)
        existing = (await self.db.execute(q)).scalars().first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Username '{req.username}' is already taken.")

        # Resolve and check email uniqueness if provided
        email_val = req.email.strip().lower() if req.email and req.email.strip() else None
        if not email_val and req.username and "@" in req.username:
            email_val = req.username.strip().lower()

        if email_val:
            eq = select(User).where(User.email == email_val, User.is_deleted == False)
            existing_email = (await self.db.execute(eq)).scalars().first()
            if existing_email:
                raise HTTPException(status_code=400, detail=f"Email '{email_val}' is already registered to another account.")

        emp_id = req.employeeId or f"EMP-{random.randint(1000, 9999)}"
        emp_code = req.employeeCode or f"EMP-{random.randint(1000, 9999)}"
        display_name = req.displayName or (req.fullName.split(" ")[0] if req.fullName else "")
        supplied_password = req.passwordHash or req.password
        if not supplied_password:
            raise HTTPException(
                status_code=400,
                detail="A temporary password is required when creating a staff account.",
            )
        validate_password_strength(supplied_password)
        pwd = supplied_password
        hashed = hash_password(pwd)

        salary_str = req.salary.json() if req.salary else json.dumps({
            "fixedMonthly": 25000,
            "commission": {"type": "None", "value": 0},
            "travelAllowance": {"type": "None", "value": 0},
            "otherAllowances": {"da": 0, "mobile": 0, "internet": 0, "fuel": 0}
        })
        payment_str = req.payment.json() if req.payment else json.dumps({
            "frequency": "Monthly",
            "bankDetails": "",
            "upi": "",
            "salaryEffectiveFrom": datetime.now().strftime("%Y-%m-%d"),
            "commissionEffectiveFrom": datetime.now().strftime("%Y-%m-%d")
        })
        performance_str = req.performance.json() if req.performance else json.dumps({
            "attendancePercentage": 100,
            "monthlySales": 0,
            "targetsAssigned": 0,
            "targetsAchieved": 0,
            "commissionEarned": 0,
            "travelClaimStatus": "None"
        })
        pref_str = req.preferences.json() if req.preferences else json.dumps({
            "theme": "dark",
            "language": "English",
            "timeZone": "Asia/Kolkata"
        })
        notif_str = req.notificationSettings.json() if req.notificationSettings else json.dumps({
            "salaryCredit": True,
            "commissionEarned": True,
            "targetAchievement": True,
            "travelClaimApproval": True,
            "leaveApproval": True,
            "attendanceAlerts": True,
            "holidayWeeklyOff": True,
            "birthdayAnniversary": True,
            "policyAnnouncements": True
        })

        # Resolve and validate company/branch from the authenticated tenant.
        is_sysadmin_caller = (requesting_user is not None and requesting_user.role == UserRole.SYSADMIN)

        if req.role == UserRole.SYSADMIN:
            comp_id = None
            branch_id = None
        else:
            comp_id = self.tenant.company_id if (self.tenant and not is_sysadmin_caller) else None
            branch_id = req.branchId or (self.tenant.branch_id if self.tenant else None)
            if not is_sysadmin_caller:
                if not comp_id or not branch_id:
                    if not branch_id:
                        raise HTTPException(status_code=400, detail="A company and branch context are required to create staff.")
                if self.tenant and self.tenant.company_id and req.branchId and req.branchId != self.tenant.branch_id:
                    raise HTTPException(status_code=403, detail="Staff must be created in the active branch context.")
            if branch_id:
                br_q = select(Branch).where(Branch.id == branch_id)
                if comp_id:
                    br_q = br_q.where(Branch.company_id == comp_id)
                br_obj = (await self.db.execute(br_q)).scalars().first()
                if not br_obj:
                    raise HTTPException(status_code=400, detail=f"Branch with ID '{branch_id}' does not exist.")
                comp_id = br_obj.company_id

        allowed_br = json.dumps(req.allowedBranches) if req.allowedBranches else json.dumps([req.branch or "Andheri West, Mumbai"])

        role_to_id = {
            UserRole.SYSADMIN: "role-sysadmin",
            UserRole.ADMIN: "role-admin",
            UserRole.MANAGER: "role-manager",
            UserRole.STORE_MANAGER: "role-store-manager",
            UserRole.BRANCH_ADMIN: "role-branch-admin",
            UserRole.INVENTORY_MANAGER: "role-inventory-manager",
            UserRole.PURCHASE_EXECUTIVE: "role-purchase-executive",
            UserRole.SALES_EXECUTIVE: "role-sales-executive",
            UserRole.CASHIER: "role-cashier",
            UserRole.ACCOUNTANT: "role-accountant",
            UserRole.AUDITOR: "role-auditor",
            UserRole.HR_EXECUTIVE: "role-hr-executive",
            UserRole.REPORT_USER: "role-report-user",
            UserRole.VIEWER: "role-viewer",
        }
        assigned_role_id = req.role_id or req.roleId or role_to_id.get(req.role)

        user = User(
            id=f"usr-{uuid.uuid4().hex[:8]}",
            username=req.username,
            email=email_val,
            mobile=req.mobile or "0000000000",
            hashed_password=hashed,
            role=req.role,
            role_id=assigned_role_id,
            is_active=True,
            is_deleted=False,
            company_id=comp_id,
            branch_id=branch_id,
            employee_id=emp_id,
            employee_code=emp_code,
            display_name=display_name,
            full_name=req.fullName,
            gender=req.gender or "Male",
            date_of_birth=req.dateOfBirth or "1990-01-01",
            alternate_mobile=req.alternateMobile or "",
            emergency_contact=req.emergencyContact or "",
            address=req.address or "",
            city=req.city or "",
            state=req.state or "",
            country=req.country or "India",
            pin_code=req.pinCode or "",
            department=req.department or "Retail Operations",
            designation=req.designation or "Executive",
            branch=req.branch or "Andheri West, Mumbai",
            department_id=req.departmentId,
            designation_id=req.designationId,
            date_of_joining=req.dateOfJoining or datetime.now().strftime("%Y-%m-%d"),
            reporting_manager=req.reportingManager or "",
            employment_type=req.employmentType or "Permanent",
            allowed_branches=allowed_br,
            photo=req.photo or "",
            salary_json=salary_str,
            payment_json=payment_str,
            performance_json=performance_str,
            preferences_json=pref_str,
            notification_settings_json=notif_str,
            status=req.status or "Active"
        )
        self.db.add(user)
        await self._enroll_assignments(user)
        await self._record_audit(
            event_type="USER_CREATED",
            record_id=user.id,
            actor=requesting_user,
            details={"role": str(user.role), "username": user.username, "employee_id": user.employee_id},
            reason="Staff user created",
        )
        await self.db.commit()
        await self.db.refresh(user)
        return to_staff_response(user)

    async def update_staff_user(
        self,
        user_id: str,
        req: StaffUserUpdate,
        requesting_user: User,
        tenant: TenantContext | None = None,
    ) -> StaffUserResponse:
        is_reactivation = (req.status == "Active")
        user = await self.get_user(user_id, tenant=tenant, include_deleted=is_reactivation)
        is_self = (requesting_user.id == user_id)
        is_sysadmin = (requesting_user.role == UserRole.SYSADMIN)
        is_manager = (requesting_user.role in [UserRole.MANAGER, UserRole.SYSADMIN])

        if not is_manager and not is_self:
            raise HTTPException(status_code=403, detail="Access Denied: You do not have permission to modify this profile.")

        # Self-deactivation prevention
        if is_self and req.status == "Inactive":
            raise HTTPException(status_code=400, detail="You cannot deactivate your own operator account.")

        # Role change permission checks
        if req.role is not None and req.role != user.role:
            if not is_sysadmin:
                raise HTTPException(status_code=403, detail="Access Denied: Only a SYSADMIN can assign or modify user roles.")
            if user.role == UserRole.SYSADMIN and req.role != UserRole.SYSADMIN:
                await self._assert_not_last_active_sysadmin(user.id, "demote")

        # Inactivation of SYSADMIN check
        if req.status == "Inactive" and user.role == UserRole.SYSADMIN:
            await self._assert_not_last_active_sysadmin(user.id, "deactivate")

        old_role = user.role
        old_status = user.status

        # Fields only editable by manager/admin
        if is_manager:
            if req.fullName is not None: user.full_name = req.fullName
            if req.role is not None:
                user.role = req.role
                user.role_id = req.role_id or req.roleId or role_to_id.get(req.role, user.role_id)
            elif req.role_id or req.roleId:
                user.role_id = req.role_id or req.roleId
            if req.status is not None:
                user.status = req.status
                user.is_active = (req.status == "Active")
                if req.status == "Active":
                    user.is_deleted = False
            if req.passwordHash is not None:
                validate_password_strength(req.passwordHash)
                user.hashed_password = hash_password(req.passwordHash)
            if req.department is not None: user.department = req.department
            if req.designation is not None: user.designation = req.designation
            if req.branch is not None: user.branch = req.branch
            if req.departmentId is not None: user.department_id = req.departmentId
            if req.designationId is not None: user.designation_id = req.designationId
            if req.branchId is not None: user.branch_id = req.branchId
            if req.dateOfJoining is not None: user.date_of_joining = req.dateOfJoining
            if req.reportingManager is not None: user.reporting_manager = req.reportingManager
            if req.employmentType is not None: user.employment_type = req.employmentType
            if req.allowedBranches is not None: user.allowed_branches = json.dumps(req.allowedBranches)
            if req.salary is not None: user.salary_json = req.salary.json()
            if req.payment is not None: user.payment_json = req.payment.json()
            if req.performance is not None: user.performance_json = req.performance.json()

        # Fields editable by cashier for self
        if req.displayName is not None: user.display_name = req.displayName
        if req.gender is not None: user.gender = req.gender
        if req.dateOfBirth is not None: user.date_of_birth = req.dateOfBirth
        if req.email is not None:
            email_val = req.email.strip().lower() if req.email.strip() else None
            if email_val and email_val != user.email:
                eq = select(User).where(User.email == email_val, User.id != user.id, User.is_deleted == False)
                existing_email = (await self.db.execute(eq)).scalars().first()
                if existing_email:
                    raise HTTPException(status_code=400, detail=f"Email '{email_val}' is already registered to another account.")
            user.email = email_val
        if req.address is not None: user.address = req.address
        if req.city is not None: user.city = req.city
        if req.state is not None: user.state = req.state
        if req.country is not None: user.country = req.country
        if req.pinCode is not None: user.pin_code = req.pinCode
        if req.photo is not None: user.photo = req.photo
        if req.preferences is not None: user.preferences_json = req.preferences.json()
        if req.notificationSettings is not None: user.notification_settings_json = req.notificationSettings.json()

        await self._enroll_assignments(user)
        user.modified_at = datetime.now(timezone.utc)

        # Audit logging
        if old_status == "Inactive" and user.status == "Active":
            await self._record_audit("USER_REACTIVATED", user.id, actor=requesting_user, reason="Staff account reactivated")
        elif old_status == "Active" and user.status == "Inactive":
            await self._record_audit("USER_DEACTIVATED", user.id, actor=requesting_user, reason="Staff account deactivated via status update")
        elif req.role is not None and old_role != user.role:
            await self._record_audit("USER_ROLE_CHANGED", user.id, actor=requesting_user, old_val=str(old_role), new_val=str(user.role), reason="User role updated")
        elif req.passwordHash is not None:
            await self._record_audit("USER_PASSWORD_CHANGED", user.id, actor=requesting_user, reason="Staff password reset by manager")
        else:
            await self._record_audit("USER_UPDATED", user.id, actor=requesting_user, reason="Staff profile fields updated")

        await self.db.commit()
        await self.db.refresh(user)
        return to_staff_response(user)

    async def update_preferences(self, user_id: str, preferences: dict) -> StaffUserResponse:
        user = await self.get_user(user_id)
        current = {}
        if user.preferences_json:
            try:
                current = json.loads(user.preferences_json)
            except Exception:
                pass
        current.update(preferences)
        user.preferences_json = json.dumps(current)
        user.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return to_staff_response(user)

    async def update_notifications(self, user_id: str, notifications: dict) -> StaffUserResponse:
        user = await self.get_user(user_id)
        current = {}
        if user.notification_settings_json:
            try:
                current = json.loads(user.notification_settings_json)
            except Exception:
                pass
        current.update(notifications)
        user.notification_settings_json = json.dumps(current)
        user.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return to_staff_response(user)

    async def update_photo(self, user_id: str, photo: str) -> StaffUserResponse:
        user = await self.get_user(user_id)
        user.photo = photo
        user.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return to_staff_response(user)

    async def list_staff(
        self,
        skip: int = 0,
        limit: int = 50,
        role_filter: str | None = None,
        status_filter: str | None = None,
        search: str | None = None,
        tenant: TenantContext | None = None,
        include_deleted: bool = False,
    ) -> tuple[int, list[StaffUserResponse]]:
        if status_filter == "Inactive" or include_deleted:
            q = select(User)
        else:
            q = select(User).where(User.is_deleted == False)
        q = self._tenant_scope(q, tenant)
        
        if role_filter:
            norm_role = role_filter.strip().upper()
            if norm_role in ("ADMIN", "SYSADMIN"):
                q = q.where(User.role == UserRole.SYSADMIN)
            elif norm_role in UserRole.__members__:
                q = q.where(User.role == UserRole[norm_role])
            else:
                q = q.where(User.role == role_filter)
        if status_filter:
            q = q.where(User.status == status_filter)
        if search:
            search_clause = or_(
                User.username.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%"),
                User.employee_id.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
            q = q.where(search_clause)

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        result = await self.db.execute(q.offset(skip).limit(limit))
        users_list = result.scalars().all()
        
        return total, [to_staff_response(u) for u in users_list]

    async def deactivate_staff(self, user_id: str, requesting_user_id: str, tenant: TenantContext | None = None) -> None:
        if user_id == requesting_user_id:
            raise HTTPException(status_code=400, detail="You cannot delete your own active operator profile.")
        user = await self.get_user(user_id, tenant=tenant)
        if user.role == UserRole.SYSADMIN:
            await self._assert_not_last_active_sysadmin(user.id, "deactivate")

        await self._check_active_pos_shifts(user.id, user.company_id)

        user.is_active = False
        user.is_deleted = True
        user.status = "Inactive"
        user.modified_at = datetime.now(timezone.utc)
        await self._record_audit(
            event_type="USER_DEACTIVATED",
            record_id=user.id,
            reason=f"Deactivated by operator {requesting_user_id}",
        )
        await self.db.commit()
