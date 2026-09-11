"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-09-11
Modified     : 2026-09-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class VendorStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    BLOCKED = "BLOCKED"
    ON_HOLD = "ON_HOLD"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ARCHIVED = "ARCHIVED"
    MERGED = "MERGED"


class SupplierType(str, Enum):
    MANUFACTURER = "MANUFACTURER"
    DISTRIBUTOR = "DISTRIBUTOR"
    IMPORTER = "IMPORTER"
    TRADER = "TRADER"
    SERVICE_PROVIDER = "SERVICE_PROVIDER"


class CommercialClassification(str, Enum):
    PREFERRED = "PREFERRED"
    APPROVED = "APPROVED"
    CONDITIONAL = "CONDITIONAL"
    RESTRICTED = "RESTRICTED"
    BLOCKED = "BLOCKED"


class MSMECategory(str, Enum):
    MICRO = "MICRO"
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class ContactCategory(str, Enum):
    SALES = "SALES"
    ACCOUNTS = "ACCOUNTS"
    LOGISTICS = "LOGISTICS"
    MANAGEMENT = "MANAGEMENT"
    OTHER = "OTHER"
    GENERAL = "GENERAL"


# ─────────────────────────────────────────────────────────────────────────────
# Sub-Entity DTOs
# ─────────────────────────────────────────────────────────────────────────────

class VendorBankAccountDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    bank_name: str
    account_holder_name: str
    account_number: str
    ifsc: str
    branch: Optional[str] = None
    account_type: str = "CURRENT"
    is_primary: bool = False
    verification_status: str = "PENDING"
    verified_at: Optional[datetime] = None


class VendorContactDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    contact_name: str
    contact_category: str = "GENERAL"
    designation: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False


class VendorAddressDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    address_type: str = "BILLING"
    address_title: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    state_code: Optional[str] = None
    pincode: str
    country: str = "India"
    gstin: Optional[str] = None
    is_primary: bool = False


class VendorCommercialProfileDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_type: str = "DISTRIBUTOR"
    payment_terms_days: int = 30
    msme_registration_no: Optional[str] = None
    msme_category: str = "NOT_APPLICABLE"
    commercial_classification: str = "APPROVED"
    tds_section: Optional[str] = "194Q"
    tds_rate: float = 0.10
    tax_treatment: str = "REGISTERED_REGULAR"
    outstanding_liability: float = 0.0


class VendorComplianceProfileDTO(BaseModel):
    gstin: Optional[str] = None
    pan: Optional[str] = None
    msme_registration_no: Optional[str] = None
    msme_category: str = "NOT_APPLICABLE"
    verification_flags: Dict[str, Any] = Field(default_factory=dict)
    gst_verified: bool = False
    pan_verified: bool = False
    bank_verified: bool = False
    msme_verified: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Canonical Vendor DTOs
# ─────────────────────────────────────────────────────────────────────────────

class VendorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    legal_name: str
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    status: str = "ACTIVE"
    commercial_classification: str = "APPROVED"
    supplier_type: str = "DISTRIBUTOR"
    outstanding: float = 0.0


class VendorDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    legal_name: str
    trade_name: Optional[str] = None
    party_type: str = "ORGANIZATION"
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    status: str = "ACTIVE"
    merged_into_party_id: Optional[str] = None
    legacy_supplier_id: Optional[str] = None

    commercial: VendorCommercialProfileDTO
    compliance: VendorComplianceProfileDTO
    contacts: List[VendorContactDTO] = Field(default_factory=list)
    addresses: List[VendorAddressDTO] = Field(default_factory=list)
    bank_accounts: List[VendorBankAccountDTO] = Field(default_factory=list)
    roles: List[str] = Field(default_factory=lambda: ["SUPPLIER"])
    tags: List[str] = Field(default_factory=list)


class VendorCreateRequest(BaseModel):
    code: Optional[str] = None
    legal_name: str
    trade_name: Optional[str] = None
    party_type: str = "ORGANIZATION"
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    phone: Optional[str] = None
    status: str = "ACTIVE"

    # Primary address
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None

    # Commercial & Statutory
    commercial: Optional[VendorCommercialProfileDTO] = None
    contacts: List[VendorContactDTO] = Field(default_factory=list)
    addresses: List[VendorAddressDTO] = Field(default_factory=list)
    bank_accounts: List[VendorBankAccountDTO] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class VendorUpdateRequest(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None

    commercial: Optional[VendorCommercialProfileDTO] = None
    contacts: Optional[List[VendorContactDTO]] = None
    addresses: Optional[List[VendorAddressDTO]] = None
    bank_accounts: Optional[List[VendorBankAccountDTO]] = None
    tags: Optional[List[str]] = None


class VendorMergeRequest(BaseModel):
    primary_vendor_id: str
    secondary_vendor_id: str
    merge_reason: str = "DUPLICATE_CONVERGENCE"


class VendorMergeResponse(BaseModel):
    success: bool
    primary_vendor_id: str
    secondary_vendor_id: str
    message: str
