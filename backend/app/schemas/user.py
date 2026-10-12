"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-07-11
Modified     : 2026-10-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from ..models.auth import UserRole


# Sub-schemas for salary structure, bank payments, and metrics
class CommissionStructure(BaseModel):
    type: str = "None"  # e.g. None, Percentage, Fixed
    value: float = 0.0


class TravelAllowanceStructure(BaseModel):
    type: str = "None"
    value: float = 0.0


class OtherAllowancesStructure(BaseModel):
    da: float = 0.0
    mobile: float = 0.0
    internet: float = 0.0
    fuel: float = 0.0


class SalaryStructure(BaseModel):
    fixedMonthly: float = 25000.0
    commission: CommissionStructure = Field(default_factory=CommissionStructure)
    travelAllowance: TravelAllowanceStructure = Field(default_factory=TravelAllowanceStructure)
    otherAllowances: OtherAllowancesStructure = Field(default_factory=OtherAllowancesStructure)

    @field_validator("fixedMonthly", mode="before")
    @classmethod
    def sanitize_fixed_monthly(cls, v):
        if v is None or v == "":
            return 25000.0
        try:
            return float(v)
        except (ValueError, TypeError):
            return 25000.0


class PaymentDetails(BaseModel):
    frequency: Optional[str] = "Monthly"
    paymentMode: Optional[str] = "Bank Transfer"
    bankName: Optional[str] = ""
    accountNumber: Optional[str] = ""
    ifscCode: Optional[str] = ""
    branchName: Optional[str] = ""
    accountType: Optional[str] = "Savings"
    nameAsPerBank: Optional[str] = ""
    bankDetails: Optional[str] = ""
    upi: Optional[str] = ""
    salaryEffectiveFrom: Optional[str] = ""
    commissionEffectiveFrom: Optional[str] = ""
    aadhaarNumber: Optional[str] = ""
    panNumber: Optional[str] = ""
    providentFundUan: Optional[str] = ""
    esicNumber: Optional[str] = ""
    fatherSpouseName: Optional[str] = ""
    bloodGroup: Optional[str] = ""
    maritalStatus: Optional[str] = ""
    emergencyContactRelation: Optional[str] = ""
    permanentAddress: Optional[str] = ""

    @field_validator("*", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        if v is None:
            return ""
        if isinstance(v, str):
            return v.strip()
        return str(v)

    @field_validator("frequency", mode="after")
    @classmethod
    def default_frequency(cls, v):
        return v or "Monthly"

    @field_validator("paymentMode", mode="after")
    @classmethod
    def default_payment_mode(cls, v):
        return v or "Bank Transfer"

    @field_validator("accountType", mode="after")
    @classmethod
    def default_account_type(cls, v):
        return v or "Savings"


class PerformanceMetrics(BaseModel):
    attendancePercentage: float = 100.0
    monthlySales: float = 0.0
    targetsAssigned: float = 0.0
    targetsAchieved: float = 0.0
    commissionEarned: float = 0.0
    travelClaimStatus: str = "None"


# ---------------------------------------------------------------------------
# Theme Preset — canonical IDs must match frontend src/config/theme_presets.ts
# Density and fontScale are kept as plain strings to avoid tight coupling.
# ---------------------------------------------------------------------------
VALID_PRESET_IDS = {
    "enterprise-light", "enterprise-dark",
    "pos-dark", "retail-day", "high-contrast",
}
VALID_DENSITIES  = {"compact", "comfortable", "spacious"}
VALID_FONT_SCALES = {"sm", "md", "lg"}


class UserPreferencesSchema(BaseModel):
    """User workspace visual and regional preferences."""
    # ── Base mode (legacy field — kept for backward compat) ──
    theme: str = "light"
    # ── Preset system (Phase 6 — 2026-10-11) ────────────────
    presetId: Optional[str] = "enterprise-light"
    density: Optional[str] = "comfortable"
    fontScale: Optional[str] = "md"
    accentOverride: Optional[str] = None
    # ── Regional ─────────────────────────────────────────────
    language: str = "English"
    timeZone: str = "Asia/Kolkata"

    @field_validator("presetId", mode="before")
    @classmethod
    def validate_preset_id(cls, v):
        if v is None:
            return v
        if v not in VALID_PRESET_IDS:
            # Accept unknown presets gracefully (future-proof)
            return v
        return v

    @field_validator("density", mode="before")
    @classmethod
    def validate_density(cls, v):
        if v is None:
            return v
        if v not in VALID_DENSITIES:
            return "comfortable"  # safe fallback
        return v

    @field_validator("fontScale", mode="before")
    @classmethod
    def validate_font_scale(cls, v):
        if v is None:
            return v
        if v not in VALID_FONT_SCALES:
            return "md"  # safe fallback
        return v


class NotificationSettings(BaseModel):
    salaryCredit: bool = True
    commissionEarned: bool = True
    targetAchievement: bool = True
    travelClaimApproval: bool = True
    leaveApproval: bool = True
    attendanceAlerts: bool = True
    holidayWeeklyOff: bool = True
    birthdayAnniversary: bool = True
    policyAnnouncements: bool = True


class PreferencesUpdate(BaseModel):
    """
    Typed request body for PUT /api/v1/users/{id}/preferences.
    All fields are optional — only provided fields are merged into the stored JSON.
    """
    theme: Optional[str] = None
    presetId: Optional[str] = None
    density: Optional[str] = None
    fontScale: Optional[str] = None
    accentOverride: Optional[str] = None
    language: Optional[str] = None
    timeZone: Optional[str] = None

    @field_validator("presetId", mode="before")
    @classmethod
    def validate_preset_id(cls, v):
        if v is None:
            return v
        if v not in VALID_PRESET_IDS:
            return v  # accept unknown — future-proof
        return v

    @field_validator("density", mode="before")
    @classmethod
    def validate_density(cls, v):
        if v is None:
            return v
        return v if v in VALID_DENSITIES else "comfortable"

    @field_validator("fontScale", mode="before")
    @classmethod
    def validate_font_scale(cls, v):
        if v is None:
            return v
        return v if v in VALID_FONT_SCALES else "md"


# System Schemas
class UserCreate(BaseModel):
    """SYSADMIN creates a new user and assigns them to a company + branch."""
    username: str
    password: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: UserRole = UserRole.CASHIER
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    @field_validator("role", mode="before")
    def normalize_role(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            cleaned = v.strip().upper()
            if cleaned in ("ADMIN", "SYS_ADMIN", "SYSTEM_ADMIN"):
                return UserRole.SYSADMIN
            if cleaned in UserRole.__members__:
                return UserRole[cleaned]
        return v


class UserUpdate(BaseModel):
    """SYSADMIN updates an existing user's profile or tenant assignment."""
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[UserRole] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("role", mode="before")
    def normalize_role(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            cleaned = v.strip().upper()
            if cleaned in ("ADMIN", "SYS_ADMIN", "SYSTEM_ADMIN"):
                return UserRole.SYSADMIN
            if cleaned in UserRole.__members__:
                return UserRole[cleaned]
        return v


class PasswordChange(BaseModel):
    """Authenticated user changes their own password."""
    current_password: str
    new_password: str


# Staff Specific CRUD Schemas
class StaffUserCreate(BaseModel):
    username: str
    fullName: str
    role: UserRole
    passwordHash: Optional[str] = None
    # Compatibility input for legacy callers; the service validates either field.
    password: Optional[str] = None
    status: Optional[str] = "Active"
    employeeId: Optional[str] = None
    employeeCode: Optional[str] = None
    displayName: Optional[str] = None
    gender: Optional[str] = "Male"
    dateOfBirth: Optional[str] = "1990-01-01"
    mobile: Optional[str] = "0000000000"
    alternateMobile: Optional[str] = ""
    email: Optional[str] = None
    emergencyContact: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    country: Optional[str] = "India"
    pinCode: Optional[str] = ""
    department: Optional[str] = "Retail Operations"
    designation: Optional[str] = "Executive"
    branch: Optional[str] = "Andheri West, Mumbai"
    departmentId: Optional[str] = None
    designationId: Optional[str] = None
    branchId: Optional[str] = None
    dateOfJoining: Optional[str] = None
    reportingManager: Optional[str] = ""
    employmentType: Optional[str] = "Permanent"
    allowedBranches: Optional[List[str]] = None
    photo: Optional[str] = ""
    salary: Optional[SalaryStructure] = None
    payment: Optional[PaymentDetails] = None
    performance: Optional[PerformanceMetrics] = None
    preferences: Optional[UserPreferencesSchema] = None
    notificationSettings: Optional[NotificationSettings] = None

    roleId: Optional[str] = None
    role_id: Optional[str] = None

    @field_validator("email", mode="before")
    def sanitize_email(cls, v):
        if not v or not isinstance(v, str) or not v.strip():
            return None
        return v.strip().lower()

    @field_validator("role", mode="before")
    def normalize_role(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            cleaned = v.strip().upper().replace(" ", "_").replace("-", "_")
            if cleaned in ("ADMIN", "SYS_ADMIN", "SYSTEM_ADMIN", "SUPERADMIN", "SUPER_ADMIN"):
                return UserRole.SYSADMIN
            if cleaned in ("STORE", "STORE_MGR"):
                return UserRole.STORE_MANAGER
            if cleaned in ("PURCHASE", "PURCHASE_EXEC"):
                return UserRole.PURCHASE_EXECUTIVE
            if cleaned in ("SALES", "SALES_EXEC"):
                return UserRole.SALES_EXECUTIVE
            if cleaned in ("ACCOUNT", "ACCOUNTS"):
                return UserRole.ACCOUNTANT
            if cleaned in ("HR", "HR_EXEC"):
                return UserRole.HR_EXECUTIVE
            if cleaned in UserRole.__members__:
                return UserRole[cleaned]
        return v


class StaffUserUpdate(BaseModel):
    fullName: Optional[str] = None
    role: Optional[UserRole] = None
    roleId: Optional[str] = None
    role_id: Optional[str] = None
    passwordHash: Optional[str] = None
    status: Optional[str] = None
    employeeId: Optional[str] = None
    employeeCode: Optional[str] = None

    @field_validator("role", mode="before")
    def normalize_role(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            cleaned = v.strip().upper().replace(" ", "_").replace("-", "_")
            if cleaned in ("SYS_ADMIN", "SYSTEM_ADMIN", "SUPERADMIN", "SUPER_ADMIN"):
                return UserRole.SYSADMIN
            if cleaned in UserRole.__members__:
                return UserRole[cleaned]
        return v

    @field_validator("email", mode="before")
    def sanitize_email(cls, v):
        if not v or not isinstance(v, str) or not v.strip():
            return None
        return v.strip().lower()
    displayName: Optional[str] = None
    gender: Optional[str] = None
    dateOfBirth: Optional[str] = None
    mobile: Optional[str] = None
    alternateMobile: Optional[str] = None
    email: Optional[str] = None
    emergencyContact: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pinCode: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    branch: Optional[str] = None
    departmentId: Optional[str] = None
    designationId: Optional[str] = None
    branchId: Optional[str] = None
    dateOfJoining: Optional[str] = None
    reportingManager: Optional[str] = None
    employmentType: Optional[str] = None
    allowedBranches: Optional[List[str]] = None
    photo: Optional[str] = None
    salary: Optional[SalaryStructure] = None
    payment: Optional[PaymentDetails] = None
    performance: Optional[PerformanceMetrics] = None
    preferences: Optional[UserPreferencesSchema] = None
    notificationSettings: Optional[NotificationSettings] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: UserRole
    is_active: bool
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    model_config = {"from_attributes": True}


class StaffUserResponse(BaseModel):
    id: str
    userId: str
    username: str
    email: Optional[str] = ""
    mobile: Optional[str] = "0000000000"
    role: UserRole
    status: str
    fullName: str
    displayName: str
    employeeId: str
    employeeCode: str
    gender: str
    dateOfBirth: str
    alternateMobile: str
    emergencyContact: str
    address: str
    city: str
    state: str
    country: str
    pinCode: str
    department: str
    designation: str
    branch: str
    departmentId: Optional[str] = None
    designationId: Optional[str] = None
    branchId: Optional[str] = None
    companyId: Optional[str] = None
    dateOfJoining: str
    reportingManager: str
    employmentType: str
    allowedBranches: List[str] = []
    photo: str = ""
    salary: SalaryStructure
    payment: PaymentDetails
    performance: PerformanceMetrics
    preferences: UserPreferencesSchema
    notificationSettings: NotificationSettings
    roleId: Optional[str] = None
    role_id: Optional[str] = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    total: int
    users: List[UserResponse]


class StaffUserListResponse(BaseModel):
    total: int
    users: List[StaffUserResponse]
