"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class PartyRoleItem(BaseModel):
    role_type: str
    is_active: bool = True


class PartyAddressItem(BaseModel):
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


class PartyContactItem(BaseModel):
    id: Optional[str] = None
    contact_name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False


class CustomerProfileData(BaseModel):
    customer_category: str = "RETAIL"
    credit_limit: float = 0.0
    credit_days: int = 0
    tax_category: str = "B2C"
    is_credit_hold: bool = False
    price_tier_id: Optional[str] = None
    loyalty_tier_id: Optional[str] = None
    outstanding_balance: float = 0.0


class SupplierProfileData(BaseModel):
    supplier_type: str = "DISTRIBUTOR"
    payment_terms_days: int = 30
    msme_registration_no: Optional[str] = None
    tax_treatment: str = "REGISTERED_REGULAR"
    outstanding_liability: float = 0.0


class PartyCreateRequest(BaseModel):
    party_code: Optional[str] = None
    party_type: str = "ORGANIZATION"
    legal_name: str
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    address_line1: Optional[str] = None
    roles: List[str] = Field(default_factory=lambda: ["CUSTOMER"])
    customer_profile: Optional[CustomerProfileData] = None
    supplier_profile: Optional[SupplierProfileData] = None
    addresses: List[PartyAddressItem] = Field(default_factory=list)
    contacts: List[PartyContactItem] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class PartyUpdateRequest(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    address_line1: Optional[str] = None
    status: Optional[str] = None
    customer_profile: Optional[CustomerProfileData] = None
    supplier_profile: Optional[SupplierProfileData] = None
    tags: Optional[List[str]] = None
    metadata_json: Optional[Dict[str, Any]] = None


class PartyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    party_code: str
    party_type: str
    legal_name: str
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    status: str
    merged_into_party_id: Optional[str] = None
    roles: List[PartyRoleItem]
    customer_profile: Optional[CustomerProfileData] = None
    supplier_profile: Optional[SupplierProfileData] = None
    addresses: List[PartyAddressItem] = Field(default_factory=list)
    contacts: List[PartyContactItem] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class PartyMergeRequest(BaseModel):
    primary_party_id: str
    secondary_party_id: str
    merge_reason: str = "DUPLICATE_CONVERGENCE"


class PartyMergeResponse(BaseModel):
    success: bool
    primary_party_id: str
    secondary_party_id: str
    consolidated_roles: List[str]
    message: str


class LegacyCustomerAdapterResponse(BaseModel):
    id: str
    code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    category: str
    credit_limit: float
    credit_days: int
    outstanding_balance: float
    city: Optional[str] = None
    state: Optional[str] = None
    is_active: bool


class LegacySupplierAdapterResponse(BaseModel):
    id: str
    code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    supplier_type: str
    payment_terms_days: int
    tax_treatment: str
    outstanding_liability: float
    city: Optional[str] = None
    state: Optional[str] = None
    is_active: bool
