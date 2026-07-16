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
from ..schemas.user import (
    UserCreate, UserUpdate, PasswordChange, StaffUserCreate, StaffUserUpdate,
    StaffUserResponse, SalaryStructure, PaymentDetails, PerformanceMetrics,
    UserPreferencesSchema, NotificationSettings
)
from ..core.security import hash_password, verify_password


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
        dateOfJoining=user.date_of_joining or "",
        reportingManager=user.reporting_manager or "",
        employmentType=user.employment_type or "Permanent",
        allowedBranches=allowed_branches,
        photo=user.photo or "",
        salary=salary,
        payment=payment,
        performance=performance,
        preferences=preferences,
        notificationSettings=notifications
    )


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Create user (SYSADMIN only)
    # ------------------------------------------------------------------
    async def create_user(self, req: UserCreate) -> User:
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
            await self.db.commit()
        except IntegrityError:
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
    async def get_user(self, user_id: str) -> User:
        res = await self.db.execute(
            select(User).where(User.id == user_id, User.is_deleted == False)
        )
        user = res.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return user

    # ------------------------------------------------------------------
    # Update user (SYSADMIN only)
    # ------------------------------------------------------------------
    async def update_user(self, user_id: str, req: UserUpdate) -> User:
        user = await self.get_user(user_id)

        if req.email      is not None: user.email      = req.email
        if req.mobile     is not None: user.mobile     = req.mobile
        if req.role       is not None: user.role       = req.role
        if req.is_active  is not None: user.is_active  = req.is_active
        if req.company_id is not None: user.company_id = req.company_id
        if req.branch_id  is not None: user.branch_id  = req.branch_id

        effective_role = req.role if req.role is not None else user.role
        if effective_role != UserRole.SYSADMIN:
            if not user.company_id or not user.branch_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"A {effective_role.value} user must have both a company and branch assigned.",
                )

        user.modified_at = datetime.now(timezone.utc)
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
        user.is_active  = False
        user.is_deleted = True
        user.status = "Inactive"
        user.modified_at = datetime.now(timezone.utc)
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
        if len(req.new_password) < 8:
            raise HTTPException(
                status_code=400,
                detail="Your new password must be at least 8 characters long.",
            )
        user.hashed_password = hash_password(req.new_password)
        user.modified_at = datetime.now(timezone.utc)
        await self.db.commit()

    # ==================================================================
    # Staff Management Extended Operations
    # ==================================================================
    async def create_staff_user(self, req: StaffUserCreate) -> StaffUserResponse:
        # Check if username exists
        q = select(User).where(User.username == req.username, User.is_deleted == False)
        existing = (await self.db.execute(q)).scalars().first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Username '{req.username}' is already taken.")

        emp_id = req.employeeId or f"EMP-{random.randint(1000, 9999)}"
        emp_code = req.employeeCode or f"EMP-{random.randint(1000, 9999)}"
        display_name = req.displayName or (req.fullName.split(" ")[0] if req.fullName else "")
        pwd = req.passwordHash or "smriti123"
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

        # Resolve company_id from branch
        comp_id = None
        if req.branchId:
            br_q = select(Branch).where(Branch.id == req.branchId)
            br_obj = (await self.db.execute(br_q)).scalars().first()
            if not br_obj:
                raise HTTPException(status_code=400, detail=f"Branch with ID '{req.branchId}' does not exist.")
            comp_id = br_obj.company_id

        allowed_br = json.dumps(req.allowedBranches) if req.allowedBranches else json.dumps([req.branch or "Andheri West, Mumbai"])

        user = User(
            id=f"usr-{uuid.uuid4().hex[:8]}",
            username=req.username,
            email=req.email or "",
            mobile=req.mobile or "0000000000",
            hashed_password=hashed,
            role=req.role,
            is_active=True,
            is_deleted=False,
            company_id=comp_id,
            branch_id=req.branchId,
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
        await self.db.commit()
        await self.db.refresh(user)
        return to_staff_response(user)

    async def update_staff_user(self, user_id: str, req: StaffUserUpdate, requesting_user: User) -> StaffUserResponse:
        user = await self.get_user(user_id)
        is_self = (requesting_user.id == user_id)
        is_manager = (requesting_user.role in [UserRole.MANAGER, UserRole.SYSADMIN])

        if not is_manager and not is_self:
            raise HTTPException(status_code=403, detail="Access Denied: You do not have permission to modify this profile.")

        # Fields only editable by manager/admin
        if is_manager:
            if req.fullName is not None: user.full_name = req.fullName
            if req.role is not None: user.role = req.role
            if req.status is not None:
                user.status = req.status
                user.is_active = (req.status == "Active")
            if req.passwordHash is not None:
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
        if req.mobile is not None: user.mobile = req.mobile
        if req.alternateMobile is not None: user.alternate_mobile = req.alternateMobile
        if req.email is not None: user.email = req.email
        if req.emergencyContact is not None: user.emergency_contact = req.emergencyContact
        if req.address is not None: user.address = req.address
        if req.city is not None: user.city = req.city
        if req.state is not None: user.state = req.state
        if req.country is not None: user.country = req.country
        if req.pinCode is not None: user.pin_code = req.pinCode
        if req.photo is not None: user.photo = req.photo
        if req.preferences is not None: user.preferences_json = req.preferences.json()
        if req.notificationSettings is not None: user.notification_settings_json = req.notificationSettings.json()

        user.modified_at = datetime.now(timezone.utc)
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
        search: str | None = None
    ) -> tuple[int, list[StaffUserResponse]]:
        q = select(User).where(User.is_deleted == False)
        
        if role_filter:
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

    async def deactivate_staff(self, user_id: str, requesting_user_id: str) -> None:
        if user_id == requesting_user_id:
            raise HTTPException(status_code=400, detail="You cannot delete your own active operator profile.")
        user = await self.get_user(user_id)
        user.is_active = False
        user.is_deleted = True
        user.status = "Inactive"
        user.modified_at = datetime.now(timezone.utc)
        await self.db.commit()
