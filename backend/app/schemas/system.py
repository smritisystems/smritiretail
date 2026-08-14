"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class TallyConfigCreate(BaseModel):
    endpoint: Optional[str] = "http://localhost:9000"
    companyName: str = Field(..., alias="companyName")
    syncIntervalMins: Optional[int] = Field(60, alias="syncIntervalMins")
    isActive: Optional[bool] = Field(True, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class TallyConfigUpdate(BaseModel):
    endpoint: Optional[str] = None
    companyName: Optional[str] = Field(None, alias="companyName")
    syncIntervalMins: Optional[int] = Field(None, alias="syncIntervalMins")
    isActive: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class TallyConfigResponse(BaseModel):
    id: str
    endpoint: str
    companyName: str = Field(..., serialization_alias="companyName")
    syncIntervalMins: int = Field(..., serialization_alias="syncIntervalMins")
    isActive: bool = Field(..., serialization_alias="isActive")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class SystemConfigCreate(BaseModel):
    key: str
    value: str
    category: Optional[str] = "General"


class SystemConfigUpdate(BaseModel):
    value: str


class SystemConfigResponse(BaseModel):
    key: str
    value: str
    category: str

    model_config = {
        "from_attributes": True
    }


class LicenseInfo(BaseModel):
    status: Optional[str] = "Trial"
    type: Optional[str] = "Trial"
    mode: Optional[str] = "Offline"
    expiresAt: Optional[str] = Field(None, alias="expiresAt")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if not value:
            return "Trial"
        normalized = value.title()
        allowed = {"Trial", "Active", "Expired"}
        if normalized not in allowed:
            raise ValueError("License status must be Trial, Active, or Expired.")
        return normalized

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if not value:
            return "Trial"
        normalized = value.title()
        allowed = {"Trial", "Standard", "Enterprise"}
        if normalized not in allowed:
            raise ValueError("License type must be Trial, Standard, or Enterprise.")
        return normalized

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, value: str) -> str:
        if not value:
            return "Offline"
        normalized = value.title()
        allowed = {"Offline", "Online", "Hybrid"}
        if normalized not in allowed:
            raise ValueError("License mode must be Offline, Online, or Hybrid.")
        return normalized

    @field_validator("expiresAt")
    @classmethod
    def validate_expires_at(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        try:
            datetime.fromisoformat(value)
        except ValueError:
            raise ValueError("License expiresAt must be a valid ISO date string.")
        return value


class StoreConfig(BaseModel):
    name: str
    code: str
    type: Optional[str] = "Company Owned"
    address: Optional[str] = ""
    landmark: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pinCode: Optional[str] = Field("", alias="pinCode")
    contactPerson: Optional[str] = Field("Branch Manager", alias="contactPerson")
    mobile: Optional[str] = ""
    email: Optional[str] = ""

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Store code must not be empty.")
        if not normalized.replace("-", "").isalnum():
            raise ValueError("Store code may only contain letters, numbers, and hyphens.")
        return normalized

    @field_validator("pinCode")
    @classmethod
    def validate_pin_code(cls, value: str) -> str:
        if not value:
            return value
        pin = value.strip()
        if not pin.isdigit() or len(pin) != 6:
            raise ValueError("Store pinCode must be exactly 6 digits.")
        return pin


class BusinessInfo(BaseModel):
    name: str
    tradeName: Optional[str] = Field("", alias="tradeName")
    businessType: Optional[str] = Field("retail", alias="businessType")
    gstin: Optional[str] = ""
    pan: Optional[str] = ""
    state: Optional[str] = ""
    financialYear: Optional[str] = Field("2026-2027", alias="financialYear")
    booksStartDate: Optional[str] = Field("2026-04-01", alias="booksStartDate")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("financialYear")
    @classmethod
    def validate_financial_year(cls, value: Optional[str]) -> str:
        if not value:
            return "2026-2027"
        trimmed = value.strip()
        parts = trimmed.split("-")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            raise ValueError("financialYear must be in YYYY-YYYY format.")
        start, end = map(int, parts)
        if end != start + 1:
            raise ValueError("financialYear must span one year, e.g. 2026-2027.")
        return trimmed

    @field_validator("booksStartDate")
    @classmethod
    def validate_books_start_date(cls, value: Optional[str]) -> str:
        if not value:
            return "2026-04-01"
        try:
            datetime.fromisoformat(value)
        except ValueError:
            raise ValueError("booksStartDate must be a valid ISO date string (YYYY-MM-DD).")
        return value

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, value: Optional[str]) -> str:
        if not value:
            return ""
        gst = value.strip().upper()
        if len(gst) != 15:
            raise ValueError("gstin must be 15 characters long.")
        return gst

    @field_validator("pan")
    @classmethod
    def validate_pan(cls, value: Optional[str]) -> str:
        if not value:
            return ""
        pan = value.strip().upper()
        if len(pan) != 10:
            raise ValueError("pan must be 10 characters long.")
        return pan


class OrgStructure(BaseModel):
    layout: Optional[str] = "single"
    stores: Optional[list[StoreConfig]] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class OperationsInfo(BaseModel):
    modules: Optional[dict[str, bool]] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class AccountingInfo(BaseModel):
    gstType: Optional[str] = Field("regular", alias="gstType")
    createLedgers: Optional[bool] = Field(True, alias="createLedgers")
    roundOffMode: Optional[str] = Field("auto", alias="roundOffMode")
    bankName: Optional[str] = Field("", alias="bankName")
    accountNo: Optional[str] = Field("", alias="accountNo")
    ifsc: Optional[str] = Field("", alias="ifsc")

    model_config = ConfigDict(populate_by_name=True)


class InventoryInfo(BaseModel):
    valuation: Optional[str] = "FIFO"
    negativeStock: Optional[str] = Field("block", alias="negativeStock")
    baseUOM: Optional[str] = Field("Nos", alias="baseUOM")

    model_config = ConfigDict(populate_by_name=True)


class PosInfo(BaseModel):
    printerWidth: Optional[str] = Field("80mm", alias="printerWidth")
    paymentModes: Optional[dict[str, bool]] = Field(default_factory=dict, alias="paymentModes")

    model_config = ConfigDict(populate_by_name=True)


class NumberingSeriesConfig(BaseModel):
    name: str
    documentType: str = Field(..., alias="documentType")
    module: Optional[str] = None
    prefix: Optional[str] = ""
    suffix: Optional[str] = ""
    runningLength: Optional[int] = Field(6, alias="runningLength")
    resetRule: Optional[str] = Field("Financial Year", alias="resetRule")
    currentNumber: Optional[int] = Field(0, alias="currentNumber")
    financialYear: Optional[str] = Field("2026-2027", alias="financialYear")
    companyCode: Optional[str] = Field(None, alias="companyCode")
    mode: Optional[str] = "Auto"
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("runningLength")
    @classmethod
    def validate_running_length(cls, value: int) -> int:
        if value is None or value <= 0:
            raise ValueError("runningLength must be a positive integer.")
        return value

    @field_validator("currentNumber")
    @classmethod
    def validate_current_number(cls, value: int) -> int:
        if value is None or value < 0:
            raise ValueError("currentNumber must be zero or positive.")
        return value

    @field_validator("resetRule")
    @classmethod
    def validate_reset_rule(cls, value: str) -> str:
        normalized = value.strip().title() if value else "Financial Year"
        allowed = {"Financial Year", "Calendar Year", "Monthly", "Daily", "Never"}
        if normalized not in allowed:
            raise ValueError("resetRule must be one of Financial Year, Calendar Year, Monthly, Daily, Never.")
        return normalized


class StaffMember(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    username: str
    role: Optional[str] = "Cashier"
    email: Optional[str] = None
    mobile: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class UsersInfo(BaseModel):
    staff: Optional[list[StaffMember]] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class CompanySetupRequest(BaseModel):
    businessInfo: BusinessInfo = Field(..., alias="businessInfo")
    orgStructure: OrgStructure = Field(default_factory=OrgStructure, alias="orgStructure")
    license: LicenseInfo = Field(default_factory=LicenseInfo)
    operations: OperationsInfo = Field(default_factory=OperationsInfo)
    accounting: AccountingInfo = Field(default_factory=AccountingInfo)
    inventory: InventoryInfo = Field(default_factory=InventoryInfo)
    pos: PosInfo = Field(default_factory=PosInfo)
    users: UsersInfo = Field(default_factory=UsersInfo)
    numbering: Optional[list[NumberingSeriesConfig]] = Field(default_factory=list, alias="numbering")

    model_config = ConfigDict(populate_by_name=True)

    model_config = ConfigDict(populate_by_name=True)
