"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
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


class PaymentDetails(BaseModel):
    frequency: str = "Monthly"
    bankDetails: str = ""
    upi: str = ""
    salaryEffectiveFrom: str = ""
    commissionEffectiveFrom: str = ""
    aadhaarNumber: Optional[str] = ""
    panNumber: Optional[str] = ""
    providentFundUan: Optional[str] = ""
    esicNumber: Optional[str] = ""
    fatherSpouseName: Optional[str] = ""
    bloodGroup: Optional[str] = ""
    maritalStatus: Optional[str] = ""
    permanentAddress: Optional[str] = ""


class PerformanceMetrics(BaseModel):
    attendancePercentage: float = 100.0
    monthlySales: float = 0.0
    targetsAssigned: float = 0.0
    targetsAchieved: float = 0.0
    commissionEarned: float = 0.0
    travelClaimStatus: str = "None"


class UserPreferencesSchema(BaseModel):
    theme: str = "dark"
    language: str = "English"
    timeZone: str = "Asia/Kolkata"


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


class UserUpdate(BaseModel):
    """SYSADMIN updates an existing user's profile or tenant assignment."""
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[UserRole] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: Optional[bool] = None


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
    status: Optional[str] = "Active"
    employeeId: Optional[str] = None
    employeeCode: Optional[str] = None
    displayName: Optional[str] = None
    gender: Optional[str] = "Male"
    dateOfBirth: Optional[str] = "1990-01-01"
    mobile: Optional[str] = "0000000000"
    alternateMobile: Optional[str] = ""
    email: Optional[str] = ""
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


class StaffUserUpdate(BaseModel):
    fullName: Optional[str] = None
    role: Optional[UserRole] = None
    passwordHash: Optional[str] = None
    status: Optional[str] = None
    employeeId: Optional[str] = None
    employeeCode: Optional[str] = None
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

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    total: int
    users: List[UserResponse]


class StaffUserListResponse(BaseModel):
    total: int
    users: List[StaffUserResponse]
