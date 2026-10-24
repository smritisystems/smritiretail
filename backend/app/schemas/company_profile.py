"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Version      : 6.92.0
Created      : 2026-10-18
Classification: Canonical Company Profile & Settings Schemas
"""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")


class CompanyBankAccountSchema(BaseModel):
    id: str
    bank_name: str | None = None
    account_no: str | None = None
    ifsc: str | None = None
    branch: str | None = None
    is_default: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class CompanyBankAccountCreate(BaseModel):
    id: str | None = None
    bank_name: str = Field(..., min_length=2, max_length=255)
    account_no: str = Field(..., min_length=5, max_length=50)
    ifsc: str = Field(..., min_length=5, max_length=20)
    branch: str | None = Field(None, max_length=255)
    is_default: bool = True

    @field_validator("ifsc")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if len(cleaned) != 11:
            raise ValueError("IFSC code must be exactly 11 characters (e.g. SBIN0001234)")
        return cleaned


class BranchProfileSchema(BaseModel):
    id: str
    code: str
    name: str
    identity_code: str | None = None
    is_active: bool = True
    address: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    pincode: str | None = None
    gstin: str | None = None
    phone: str | None = None
    email: str | None = None

    class Config:
        from_attributes = True


class BranchProfileUpdate(BaseModel):
    id: str
    name: str | None = Field(None, min_length=2, max_length=255)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    state_code: str | None = Field(None, max_length=5)
    pincode: str | None = Field(None, max_length=10)
    gstin: str | None = Field(None, max_length=15)
    phone: str | None = Field(None, max_length=25)
    email: str | None = Field(None, max_length=255)


class CompanyProfileResponse(BaseModel):
    id: str
    uuid: str
    company_code: str | None = None
    identity_code: str | None = None
    name: str
    legal_name: str | None = None
    trade_name: str | None = None
    business_type: str = "PRIVATE_LIMITED"
    gst_number: str | None = None
    pan: str | None = None
    cin: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    pincode: str | None = None
    country: str = "India"
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    dispatch_email: str | None = None
    accounts_email: str | None = None
    contact_person: str | None = None
    logo_url: str | None = None
    print_logo_url: str | None = None
    signature_url: str | None = None
    stamp_url: str | None = None
    currency_code: str = "INR"
    timezone: str = "Asia/Kolkata"
    date_format: str = "DD/MM/YYYY"
    number_format: str = "INDIAN_LAKH_CRORE"
    is_active: bool = True
    created_at: datetime | None = None
    modified_at: datetime | None = None
    bank_accounts: list[CompanyBankAccountSchema] = Field(default_factory=list)
    branches: list[BranchProfileSchema] = Field(default_factory=list)

    class Config:
        from_attributes = True


class CompanyProfileUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    legal_name: str | None = Field(None, min_length=2, max_length=255)
    trade_name: str | None = Field(None, max_length=255)
    business_type: str | None = Field(None, max_length=50)
    gst_number: str | None = None
    pan: str | None = None
    cin: str | None = Field(None, max_length=25)
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    state_code: str | None = Field(None, max_length=5)
    pincode: str | None = Field(None, max_length=10)
    country: str | None = Field("India", max_length=100)
    phone: str | None = Field(None, max_length=25)
    email: str | None = Field(None, max_length=255)
    website: str | None = Field(None, max_length=255)
    dispatch_email: str | None = Field(None, max_length=255)
    accounts_email: str | None = Field(None, max_length=255)
    contact_person: str | None = Field(None, max_length=150)
    logo_url: str | None = Field(None, max_length=500)
    print_logo_url: str | None = Field(None, max_length=500)
    signature_url: str | None = Field(None, max_length=500)
    stamp_url: str | None = Field(None, max_length=500)
    currency_code: str | None = Field(None, max_length=10)
    timezone: str | None = Field(None, max_length=100)
    date_format: str | None = Field(None, max_length=30)
    number_format: str | None = Field(None, max_length=30)
    bank_accounts: list[CompanyBankAccountCreate] | None = None
    branches: list[BranchProfileUpdate] | None = None

    @field_validator("gst_number")
    @classmethod
    def validate_gstin(cls, v: str | None) -> str | None:
        if not v or not v.strip():
            return None
        cleaned = v.strip().upper()
        if not GSTIN_REGEX.match(cleaned):
            raise ValueError(
                f"Invalid Indian GSTIN format '{cleaned}'. Must be 15 alphanumeric characters (e.g. 27AAXFT2508H1ZR)."
            )
        return cleaned

    @field_validator("pan")
    @classmethod
    def validate_pan(cls, v: str | None) -> str | None:
        if not v or not v.strip():
            return None
        cleaned = v.strip().upper()
        if not PAN_REGEX.match(cleaned):
            raise ValueError(
                f"Invalid Indian PAN format '{cleaned}'. Must be 10 characters: "
                "5 letters, 4 digits, 1 letter (e.g. AAXFT2508H)."
            )
        return cleaned
