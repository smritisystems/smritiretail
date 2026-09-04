"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-07-11
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Any, List, Optional
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import inspect
from sqlalchemy.orm.base import NO_VALUE

# ───────────────────────────── CustomerGSTRegistration ──────────────────────

class CustomerGSTRegistrationBase(BaseModel):
    """Represents one GST registration of a corporate customer in a specific state."""
    gstin: str = Field(..., max_length=50, alias="gstin")
    state_name: str = Field(..., max_length=100, alias="stateName")
    state_code: str = Field(..., max_length=10, alias="stateCode")
    registration_type: Optional[str] = Field(
        "REGULAR", alias="registrationType"
    )  # REGULAR, COMPOSITION, SEZ_WITH_TAX, SEZ_WITHOUT_TAX, UIN, EMBASSY
    is_primary: Optional[bool] = Field(False, alias="isPrimary")
    status: Optional[str] = Field("ACTIVE", alias="status")  # ACTIVE, CANCELLED, SURRENDERED
    remarks: Optional[str] = Field(None, alias="remarks")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("gstin")
    @classmethod
    def normalize_gstin(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("GSTIN cannot be blank")
        v = v.strip().upper()
        from ..core.gst_engine import GSTIN_REGEX
        if not GSTIN_REGEX.match(v):
            raise ValueError(f"Invalid GSTIN format '{v}'. Must be 15 alphanumeric characters matching Indian GST format.")
        return v

    @field_validator("state_code")
    @classmethod
    def normalize_state_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("State code cannot be blank")
        v = v.strip()
        if len(v) == 1:
            v = f"0{v}"
        from ..core.gst_engine import GST_STATE_CODES
        if v not in GST_STATE_CODES:
            raise ValueError(f"Invalid Indian state code '{v}'")
        return v

    @model_validator(mode="after")
    def validate_gstin_state_code(self) -> "CustomerGSTRegistrationBase":
        """
        Validate that the GST registration's own 15-digit GSTIN prefix matches its state_code.
        Under Indian GST law, the first 2 digits of a GSTIN are always the state code.
        """
        if self.gstin and self.state_code:
            gstin_prefix = self.gstin[:2]
            if gstin_prefix != self.state_code:
                raise ValueError(
                    f"GSTIN state prefix '{gstin_prefix}' does not match state_code '{self.state_code}'"
                )
        return self


class CustomerGSTRegistrationCreate(CustomerGSTRegistrationBase):
    """Request body for adding a GST registration to a customer."""
    id: Optional[str] = Field(None, max_length=50)
    customer_id: Optional[str] = Field(None, max_length=50, alias="customerId")


class CustomerGSTRegistrationUpdate(BaseModel):
    """Partial update for a GST registration."""
    gstin: Optional[str] = None
    state_name: Optional[str] = Field(None, alias="stateName")
    state_code: Optional[str] = Field(None, alias="stateCode")
    registration_type: Optional[str] = Field(None, alias="registrationType")
    is_primary: Optional[bool] = Field(None, alias="isPrimary")
    status: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("gstin")
    @classmethod
    def normalize_gstin_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("GSTIN cannot be blank")
            v = v.strip().upper()
            from ..core.gst_engine import GSTIN_REGEX
            if not GSTIN_REGEX.match(v):
                raise ValueError(f"Invalid GSTIN format '{v}'")
        return v

    @field_validator("state_code")
    @classmethod
    def normalize_state_code_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("State code cannot be blank")
            v = v.strip()
            if len(v) == 1:
                v = f"0{v}"
            from ..core.gst_engine import GST_STATE_CODES
            if v not in GST_STATE_CODES:
                raise ValueError(f"Invalid Indian state code '{v}'")
        return v

    @model_validator(mode="after")
    def validate_gstin_state_code_update(self) -> "CustomerGSTRegistrationUpdate":
        if self.gstin and self.state_code:
            gstin_prefix = self.gstin[:2]
            if gstin_prefix != self.state_code:
                raise ValueError(
                    f"GSTIN state prefix '{gstin_prefix}' does not match state_code '{self.state_code}'"
                )
        return self


class CustomerGSTRegistrationResponse(CustomerGSTRegistrationBase):
    id: str
    customer_id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# ───────────────────────────── CustomerDeliveryLocation ─────────────────────

class CustomerDeliveryLocationBase(BaseModel):
    """
    One physical delivery location / store of a corporate customer.
    store_code MUST be String — includes alphanumeric values (e.g. 'T97D', 'TFW4').
    """
    store_code: str = Field(..., max_length=100, alias="storeCode")
    location_name: str = Field(..., max_length=500, alias="locationName")
    address_line1: Optional[str] = Field(None, alias="addressLine1")
    address_line2: Optional[str] = Field(None, alias="addressLine2")
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    state_code: Optional[str] = Field(None, max_length=10, alias="stateCode")
    pincode: Optional[str] = Field(None, max_length=10)
    country: Optional[str] = Field("India", max_length=100)
    gst_registration_id: Optional[str] = Field(None, max_length=50, alias="gstRegistrationId")
    gstin: Optional[str] = Field(None, max_length=50)
    contact_person: Optional[str] = Field(None, max_length=150, alias="contactPerson")
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    is_default: Optional[bool] = Field(False, alias="isDefault")
    status: Optional[str] = Field("ACTIVE")  # ACTIVE, INACTIVE
    source: Optional[str] = Field("MANUAL")  # MANUAL, DISPATCH_IMPORT, EXCEL_IMPORT, API
    remarks: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("store_code")
    @classmethod
    def validate_store_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Store code cannot be blank")
        return v.strip().upper()

    @field_validator("location_name")
    @classmethod
    def validate_location_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Location name cannot be blank")
        return v.strip()

    @field_validator("gstin")
    @classmethod
    def normalize_delivery_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip().upper()
            from ..core.gst_engine import GSTIN_REGEX
            if not GSTIN_REGEX.match(v):
                raise ValueError(f"Invalid GSTIN format '{v}' for delivery location")
        return v

    @field_validator("state_code")
    @classmethod
    def normalize_deliv_state_code(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if len(v) == 1:
                v = f"0{v}"
            from ..core.gst_engine import GST_STATE_CODES
            if v not in GST_STATE_CODES:
                raise ValueError(f"Invalid Indian state code '{v}'")
        return v

    @model_validator(mode="after")
    def validate_delivery_gstin_state_consistency(self) -> "CustomerDeliveryLocationBase":
        if self.gstin and self.state_code:
            clean_gstin = self.gstin.strip().upper()
            clean_state = self.state_code.strip()
            if len(clean_state) == 1:
                clean_state = f"0{clean_state}"
            if clean_gstin[:2] != clean_state:
                raise ValueError(
                    f"Delivery GSTIN prefix '{clean_gstin[:2]}' does not match delivery state code '{clean_state}'"
                )
        return self


class CustomerDeliveryLocationCreate(CustomerDeliveryLocationBase):
    """Request body for adding a delivery location to a customer."""
    id: Optional[str] = Field(None, max_length=50)
    customer_id: Optional[str] = Field(None, max_length=50, alias="customerId")


class CustomerDeliveryLocationUpdate(BaseModel):
    """Partial update for a delivery location."""
    store_code: Optional[str] = Field(None, alias="storeCode")
    location_name: Optional[str] = Field(None, alias="locationName")
    address_line1: Optional[str] = Field(None, alias="addressLine1")
    address_line2: Optional[str] = Field(None, alias="addressLine2")
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = Field(None, alias="stateCode")
    pincode: Optional[str] = None
    country: Optional[str] = None
    gst_registration_id: Optional[str] = Field(None, alias="gstRegistrationId")
    gstin: Optional[str] = None
    contact_person: Optional[str] = Field(None, alias="contactPerson")
    phone: Optional[str] = None
    email: Optional[str] = None
    is_default: Optional[bool] = Field(None, alias="isDefault")
    status: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("store_code")
    @classmethod
    def validate_store_code_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Store code cannot be blank")
            return v.strip().upper()
        return v

    @field_validator("location_name")
    @classmethod
    def validate_location_name_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Location name cannot be blank")
            return v.strip()
        return v

    @field_validator("gstin")
    @classmethod
    def normalize_delivery_gstin_opt(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip().upper()
            from ..core.gst_engine import GSTIN_REGEX
            if not GSTIN_REGEX.match(v):
                raise ValueError(f"Invalid GSTIN format '{v}' for delivery location")
        return v

    @field_validator("state_code")
    @classmethod
    def normalize_deliv_state_code_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) == 1:
                v = f"0{v}"
            from ..core.gst_engine import GST_STATE_CODES
            if v not in GST_STATE_CODES:
                raise ValueError(f"Invalid Indian state code '{v}'")
            return v
        return v

    @model_validator(mode="after")
    def validate_delivery_update_gstin_state_consistency(self) -> "CustomerDeliveryLocationUpdate":
        if self.gstin and self.state_code:
            clean_gstin = self.gstin.strip().upper()
            clean_state = self.state_code.strip()
            if len(clean_state) == 1:
                clean_state = f"0{clean_state}"
            if clean_gstin[:2] != clean_state:
                raise ValueError(
                    f"Delivery GSTIN prefix '{clean_gstin[:2]}' does not match delivery state code '{clean_state}'"
                )
        return self


class CustomerDeliveryLocationResponse(CustomerDeliveryLocationBase):
    id: str
    customer_id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1
    # Optionally embed resolved GST registration
    gst_registration: Optional[CustomerGSTRegistrationResponse] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def resolve_delivery_location_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        # Safe extraction from ORM model without triggering async lazy loading
        try:
            from sqlalchemy import inspect as sa_inspect
            from sqlalchemy.orm.base import NO_VALUE
            state = sa_inspect(data)
            gst_reg = None
            if state and "gst_registration" in state.dict and state.dict["gst_registration"] is not NO_VALUE:
                gst_reg = data.gst_registration
            return {
                "id": data.id,
                "customer_id": data.customer_id,
                "uuid": str(data.uuid) if getattr(data, "uuid", None) else None,
                "store_code": data.store_code,
                "location_name": data.location_name,
                "address_line1": getattr(data, "address_line1", None),
                "address_line2": getattr(data, "address_line2", None),
                "city": getattr(data, "city", None),
                "state": getattr(data, "state", None),
                "state_code": getattr(data, "state_code", None),
                "pincode": getattr(data, "pincode", None),
                "country": getattr(data, "country", "India"),
                "gst_registration_id": getattr(data, "gst_registration_id", None),
                "gstin": getattr(data, "gstin", None),
                "contact_person": getattr(data, "contact_person", None),
                "phone": getattr(data, "phone", None),
                "email": getattr(data, "email", None),
                "is_default": getattr(data, "is_default", False),
                "status": getattr(data, "status", "ACTIVE"),
                "source": getattr(data, "source", "MANUAL"),
                "remarks": getattr(data, "remarks", None),
                "company_id": getattr(data, "company_id", None),
                "created_at": getattr(data, "created_at", None),
                "modified_at": getattr(data, "modified_at", None),
                "is_active": getattr(data, "is_active", True),
                "is_deleted": getattr(data, "is_deleted", False),
                "version": getattr(data, "version", 1),
                "gst_registration": gst_reg,
            }
        except Exception:
            return data


# ───────────────────────────── CustomerBillingLocation ──────────────────────

class CustomerBillingLocationBase(BaseModel):
    """
    Commercial / Billing Location of a Corporate Customer.
    Carries the Billing Store Code (e.g. 'REL-HO-MUM') and authoritative billing address.
    """
    billing_store_code: str = Field(..., max_length=100, alias="billingStoreCode")
    location_name: str = Field(..., max_length=500, alias="locationName")
    address_line1: str = Field(..., alias="addressLine1")
    address_line2: Optional[str] = Field(None, alias="addressLine2")
    city: str = Field(..., max_length=100)
    state: str = Field(..., max_length=100)
    state_code: str = Field(..., max_length=10, alias="stateCode")
    pincode: str = Field(..., max_length=10)
    country: Optional[str] = Field("India", max_length=100)
    gst_registration_id: Optional[str] = Field(None, max_length=50, alias="gstRegistrationId")
    gstin: Optional[str] = Field(None, max_length=50)
    contact_person: Optional[str] = Field(None, max_length=150, alias="contactPerson")
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    is_default: Optional[bool] = Field(False, alias="isDefault")
    status: Optional[str] = Field("ACTIVE")
    source: Optional[str] = Field("MANUAL")
    remarks: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("billing_store_code")
    @classmethod
    def validate_billing_store_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Billing store code cannot be blank")
        return v.strip().upper()

    @field_validator("state_code")
    @classmethod
    def normalize_billing_state_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("State code cannot be blank")
        v = v.strip()
        if len(v) == 1:
            v = f"0{v}"
        from ..core.gst_engine import GST_STATE_CODES
        if v not in GST_STATE_CODES:
            raise ValueError(f"Invalid Indian state code '{v}'")
        return v


class CustomerBillingLocationCreate(CustomerBillingLocationBase):
    id: Optional[str] = Field(None, max_length=50)
    customer_id: Optional[str] = Field(None, max_length=50, alias="customerId")


class CustomerBillingLocationUpdate(BaseModel):
    billing_store_code: Optional[str] = Field(None, alias="billingStoreCode")
    location_name: Optional[str] = Field(None, alias="locationName")
    address_line1: Optional[str] = Field(None, alias="addressLine1")
    address_line2: Optional[str] = Field(None, alias="addressLine2")
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = Field(None, alias="stateCode")
    pincode: Optional[str] = None
    country: Optional[str] = None
    gst_registration_id: Optional[str] = Field(None, alias="gstRegistrationId")
    gstin: Optional[str] = None
    contact_person: Optional[str] = Field(None, alias="contactPerson")
    phone: Optional[str] = None
    email: Optional[str] = None
    is_default: Optional[bool] = Field(None, alias="isDefault")
    status: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerBillingLocationResponse(CustomerBillingLocationBase):
    id: str
    customer_id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# ───────────────────────────── CustomerExternalIdentity ─────────────────────

class CustomerExternalIdentityBase(BaseModel):
    source_system: str = Field(..., max_length=50, alias="sourceSystem")
    external_type: str = Field("CUSTOMER", max_length=50, alias="externalType")
    external_code: str = Field(..., max_length=100, alias="externalCode")
    status: Optional[str] = Field("ACTIVE")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerExternalIdentityCreate(CustomerExternalIdentityBase):
    id: Optional[str] = Field(None, max_length=50)
    customer_id: Optional[str] = Field(None, max_length=50, alias="customerId")


class CustomerExternalIdentityUpdate(BaseModel):
    source_system: Optional[str] = Field(None, alias="sourceSystem")
    external_type: Optional[str] = Field(None, alias="externalType")
    external_code: Optional[str] = Field(None, alias="externalCode")
    status: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerExternalIdentityResponse(CustomerExternalIdentityBase):
    id: str
    customer_id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# ───────────────────────────── Duplicate Resolution Engine ──────────────────

class DuplicateDecision(str, Enum):
    ALLOW = "ALLOW"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"
    HARD_DUPLICATE = "HARD_DUPLICATE"


class MatchedIdentityType(str, Enum):
    CUSTOMER_ID = "CUSTOMER_ID"
    CUSTOMER_CODE = "CUSTOMER_CODE"
    GSTIN = "GSTIN"
    STORE_CODE = "STORE_CODE"
    BILLING_STORE_CODE = "BILLING_STORE_CODE"
    EXTERNAL_ID = "EXTERNAL_ID"
    MOBILE = "MOBILE"
    EMAIL = "EMAIL"
    NAME = "NAME"


class CustomerDuplicateCheckRequest(BaseModel):
    id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = Field(None, alias="gstNumber")
    gstin: Optional[str] = None
    store_code: Optional[str] = Field(None, alias="storeCode")
    billing_store_code: Optional[str] = Field(None, alias="billingStoreCode")
    source_system: Optional[str] = Field(None, alias="sourceSystem")
    external_type: Optional[str] = Field("CUSTOMER", alias="externalType")
    external_code: Optional[str] = Field(None, alias="externalCode")

    model_config = ConfigDict(populate_by_name=True)


class ExistingCustomerSummary(BaseModel):
    id: str
    code: Optional[str] = None
    name: str
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    status: Optional[str] = "Active"


class CustomerDuplicateCheckResponse(BaseModel):
    decision: DuplicateDecision
    matched_identity: Optional[MatchedIdentityType] = None
    existing_customer: Optional[ExistingCustomerSummary] = None
    reason: str
    allow_override: bool = False


# Base schema for CustomerGroup
class CustomerGroupBase(BaseModel):
    name: str = Field(..., max_length=100)
    credit_limit: Optional[Decimal] = Decimal("0.00")
    unlimited_credit: Optional[bool] = False
    credit_days: Optional[int] = 0
    grace_days: Optional[int] = 0
    credit_hold: Optional[bool] = False
    auto_block_sales: Optional[bool] = True
    warning_threshold_percent: Optional[Decimal] = Decimal("80.00")
    allow_override: Optional[bool] = False
    tax_inclusive: Optional[bool] = True
    max_discount_percent: Optional[Decimal] = Decimal("0.00")
    min_margin_percent: Optional[Decimal] = Decimal("0.00")
    rounding_rule: Optional[str] = "Nearest1"
    allowed_payment_methods: Optional[List[str]] = []
    preferred_payment_method: Optional[str] = None
    allow_back_orders: Optional[bool] = False
    allow_negative_stock_sales: Optional[bool] = False
    require_po_number: Optional[bool] = False
    invoice_language: Optional[str] = "en"
    can_view_price: Optional[bool] = True
    can_view_margin: Optional[bool] = False
    can_purchase_on_credit: Optional[bool] = False
    can_receive_discount: Optional[bool] = True

class CustomerGroupCreate(CustomerGroupBase):
    id: Optional[str] = Field(None, max_length=50)

class CustomerGroupUpdate(BaseModel):
    name: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    unlimited_credit: Optional[bool] = None
    credit_days: Optional[int] = None
    grace_days: Optional[int] = None
    credit_hold: Optional[bool] = None
    auto_block_sales: Optional[bool] = None
    warning_threshold_percent: Optional[Decimal] = None
    allow_override: Optional[bool] = None
    tax_inclusive: Optional[bool] = None
    max_discount_percent: Optional[Decimal] = None
    min_margin_percent: Optional[Decimal] = None
    rounding_rule: Optional[str] = None
    allowed_payment_methods: Optional[List[str]] = None
    preferred_payment_method: Optional[str] = None
    allow_back_orders: Optional[bool] = None
    allow_negative_stock_sales: Optional[bool] = None
    require_po_number: Optional[bool] = None
    invoice_language: Optional[str] = None
    can_view_price: Optional[bool] = None
    can_view_margin: Optional[bool] = None
    can_purchase_on_credit: Optional[bool] = None
    can_receive_discount: Optional[bool] = None

class CustomerGroupResponse(CustomerGroupBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1

    model_config = ConfigDict(from_attributes=True)

# Base schema for Customer
class CustomerBase(BaseModel):
    customer_group_id: Optional[str] = Field(None, max_length=50, alias="customerGroupId")
    code: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., max_length=255)
    mobile: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    gst_number: Optional[str] = Field(None, max_length=30, alias="gstNumber")
    outstanding: Optional[Decimal] = Decimal("0.00")
    status: Optional[str] = "Active"
    created_date: Optional[date] = Field(default_factory=date.today, alias="createdDate")
    tags: List[str] = []
    credit_limit: Optional[Decimal] = Field(None, alias="creditLimit")
    credit_days: Optional[int] = Field(None, alias="creditDays")
    unlimited_credit: Optional[bool] = Field(None, alias="unlimitedCredit")
    credit_hold: Optional[bool] = Field(None, alias="creditHold")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def map_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "name" not in data and "customer_name" in data:
                data["name"] = data["customer_name"]
            elif "name" not in data and "customerName" in data:
                data["name"] = data["customerName"]
            if "gst_number" not in data and "gstin" in data:
                data["gst_number"] = data["gstin"]
            elif "gst_number" not in data and "gstNumber" in data:
                data["gst_number"] = data["gstNumber"]
        return data

class CustomerCreate(CustomerBase):
    id: Optional[str] = Field(None, max_length=50)
    allow_duplicate_override: Optional[bool] = Field(False, alias="allowDuplicateOverride")

class CustomerUpdate(BaseModel):
    customer_group_id: Optional[str] = Field(None, alias="customerGroupId")
    code: Optional[str] = None
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = Field(None, alias="gstNumber")
    outstanding: Optional[Decimal] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

def get_loaded_customer_group(customer: Any) -> Optional[Any]:
    """
    Safely retrieve CustomerGroup only if already loaded in-memory.
    Never calls hasattr(customer, 'group') or getattr(customer, 'group')
    as a mechanism for discovering/loading the relationship, preventing MissingGreenlet.
    """
    if isinstance(customer, dict):
        return customer.get("group")

    # Check SQLAlchemy instance state without triggering attribute loaders
    insp = inspect(customer, raiseerr=False)
    if insp is not None and hasattr(insp, "attrs") and "group" in insp.attrs:
        loaded = insp.attrs.group.loaded_value
        if loaded is not NO_VALUE and loaded is not None:
            return loaded
        return None

    # Check instance __dict__ directly to avoid instrumented descriptor triggers
    if hasattr(customer, "__dict__"):
        val = customer.__dict__.get("group")
        if val is not NO_VALUE and val is not None:
            return val

    return None


def map_customer_to_response_dict(customer: Any) -> dict:
    """
    Safely build a dictionary DTO for CustomerResponse validation without
    triggering async lazy loading.
    Authoritative credit policy fields are copied from the eagerly-loaded
    CustomerGroup without attempting dynamic lazy loading.
    """
    if isinstance(customer, dict):
        return customer

    grp = get_loaded_customer_group(customer)

    return {
        "id": customer.id,
        "uuid": str(customer.uuid) if getattr(customer, "uuid", None) else None,
        "customer_group_id": customer.customer_group_id,
        "code": customer.code,
        "name": customer.name,
        "mobile": customer.mobile,
        "email": customer.email,
        "gst_number": customer.gst_number,
        "outstanding": customer.outstanding if customer.outstanding is not None else Decimal("0.00"),
        "status": customer.status if customer.status is not None else "Active",
        "created_date": customer.created_date,
        "tags": list(customer.tags or []),
        "company_id": customer.company_id,
        "branch_id": customer.branch_id,
        "created_at": customer.created_at,
        "modified_at": customer.modified_at,
        "is_active": customer.is_active if customer.is_active is not None else True,
        "is_deleted": customer.is_deleted if customer.is_deleted is not None else False,
        "version": customer.version if customer.version is not None else 1,
        # Sourced authoritatively from eagerly-loaded CustomerGroup
        "credit_limit": grp.credit_limit if grp else None,
        "credit_days": grp.credit_days if grp else None,
        "unlimited_credit": grp.unlimited_credit if grp else None,
        "credit_hold": grp.credit_hold if grp else None,
        "billing_locations": [
            CustomerBillingLocationResponse.model_validate(bl)
            for bl in getattr(customer, "billing_locations", []) or []
        ] if hasattr(customer, "billing_locations") else [],
        "external_identities": [
            CustomerExternalIdentityResponse.model_validate(ei)
            for ei in getattr(customer, "external_identities", []) or []
        ] if hasattr(customer, "external_identities") else [],
    }


class CustomerResponse(CustomerBase):
    id: str
    uuid: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    is_active: bool = True
    is_deleted: bool = False
    version: Optional[int] = 1
    # Corporate B2B extensions — empty list for retail/non-corporate customers
    gst_registrations: List[CustomerGSTRegistrationResponse] = []
    delivery_locations: List[CustomerDeliveryLocationResponse] = []
    billing_locations: List[CustomerBillingLocationResponse] = []
    external_identities: List[CustomerExternalIdentityResponse] = []

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @classmethod
    def from_orm_customer(cls, customer: Any) -> "Optional[CustomerResponse]":
        """Explicit DTO constructor from Customer ORM model or mapping."""
        if customer is None:
            return None
        return cls.model_validate(map_customer_to_response_dict(customer))

    @model_validator(mode="before")
    @classmethod
    def resolve_customer_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return map_customer_to_response_dict(data)
