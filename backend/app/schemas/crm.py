"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-07-11
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Any, List, Optional, Dict
from datetime import datetime, date, timezone
from decimal import Decimal
from enum import Enum
import uuid as uuid_pkg
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

    @field_validator("pincode")
    @classmethod
    def validate_delivery_pincode(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if clean and (len(clean) != 6 or not clean.isdigit()):
                raise ValueError("Indian PIN code must contain exactly 6 digits")
            return clean
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

    @field_validator("pincode")
    @classmethod
    def validate_delivery_pincode_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if clean and (len(clean) != 6 or not clean.isdigit()):
                raise ValueError("Indian PIN code must contain exactly 6 digits")
            return clean
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


# ───────────────────────────── Store Typed Addresses ────────────────────────

class StoreAddressItem(BaseModel):
    """
    Typed address for a Store Code (Delivery, Billing, Warehouse, Registered, Shipping, Other).
    One Store Code can carry multiple typed addresses, with at most one active primary per type.
    """
    id: str = Field(default_factory=lambda: str(uuid_pkg.uuid4()))
    address_type: str = Field("Delivery", alias="addressType")
    address_title: Optional[str] = Field(None, alias="addressTitle")
    address_line1: str = Field(..., alias="addressLine1")
    address_line2: Optional[str] = Field(None, alias="addressLine2")
    locality: Optional[str] = None
    city: str
    district: Optional[str] = None
    state: str
    state_code: Optional[str] = Field(None, alias="stateCode")
    pincode: str
    country: str = "India"
    contact_person: Optional[str] = Field(None, alias="contactPerson")
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = Field(False, alias="isPrimary")
    is_active: bool = Field(True, alias="isActive")
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


VALID_STORE_ADDRESS_TYPES = {"Delivery", "Billing", "Warehouse", "Registered", "Shipping", "Other"}


class StoreAddressCreate(BaseModel):
    address_type: str = Field("Delivery", alias="addressType")
    address_title: Optional[str] = Field(None, alias="addressTitle")
    address_line1: str = Field(..., alias="addressLine1")
    address_line2: Optional[str] = Field(None, alias="addressLine2")
    locality: Optional[str] = None
    city: str
    district: Optional[str] = None
    state: str
    state_code: Optional[str] = Field(None, alias="stateCode")
    pincode: str
    country: str = "India"
    contact_person: Optional[str] = Field(None, alias="contactPerson")
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = Field(False, alias="isPrimary")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("address_type")
    @classmethod
    def validate_address_type(cls, v: str) -> str:
        clean = (v or "").strip().capitalize()
        if clean not in VALID_STORE_ADDRESS_TYPES:
            raise ValueError(
                f"Invalid address type '{v}'. Allowed types are: {', '.join(sorted(VALID_STORE_ADDRESS_TYPES))}"
            )
        return clean


class StoreAddressUpdate(BaseModel):
    address_type: Optional[str] = Field(None, alias="addressType")
    address_title: Optional[str] = Field(None, alias="addressTitle")
    address_line1: Optional[str] = Field(None, alias="addressLine1")
    address_line2: Optional[str] = Field(None, alias="addressLine2")
    locality: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = Field(None, alias="stateCode")
    pincode: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = Field(None, alias="contactPerson")
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: Optional[bool] = Field(None, alias="isPrimary")
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("address_type")
    @classmethod
    def validate_address_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip().capitalize()
        if clean not in VALID_STORE_ADDRESS_TYPES:
            raise ValueError(
                f"Invalid address type '{v}'. Allowed types are: {', '.join(sorted(VALID_STORE_ADDRESS_TYPES))}"
            )
        return clean


class StoreCodeLookupItem(BaseModel):
    """
    Searchable Store Code item in Master Lookup showing ownership and availability.
    Codes assigned to other customers remain visible but disabled.
    """
    id: str
    store_code: str
    store_name: str
    city: str
    state: Optional[str] = None
    store_type: str = "Supermarket"
    status: str = "Active"
    address_summary: str
    assigned_customer_id: Optional[str] = None
    assigned_customer_name: Optional[str] = None
    assigned_customer_code: Optional[str] = None
    is_assigned: bool = False
    is_selectable: bool = True
    disabled_reason: Optional[str] = None
    addresses_count: int = 1
    psv_value: Decimal = Decimal("0.00")


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
    addresses: List[StoreAddressItem] = []

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
            # Parse addresses from metadata_json if present, or construct default primary delivery address
            raw_meta = getattr(data, "metadata_json", None) or {}
            addresses_list = []
            if isinstance(raw_meta, dict) and "addresses" in raw_meta and isinstance(raw_meta["addresses"], list):
                for a in raw_meta["addresses"]:
                    try:
                        addresses_list.append(StoreAddressItem.model_validate(a))
                    except Exception:
                        pass
            if not addresses_list and getattr(data, "address_line1", None):
                addresses_list.append(StoreAddressItem(
                    id=f"addr-{data.id}",
                    address_type="Delivery",
                    address_title="Primary Delivery Address",
                    address_line1=data.address_line1 or "",
                    address_line2=getattr(data, "address_line2", None),
                    city=getattr(data, "city", None) or "Mumbai",
                    state=getattr(data, "state", None) or "Maharashtra",
                    state_code=getattr(data, "state_code", None) or "27",
                    pincode=getattr(data, "pincode", None) or "400001",
                    country=getattr(data, "country", None) or "India",
                    contact_person=getattr(data, "contact_person", None),
                    phone=getattr(data, "phone", None),
                    email=getattr(data, "email", None),
                    is_primary=True,
                    is_active=getattr(data, "is_active", True),
                ))

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
                "addresses": addresses_list,
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

    @field_validator("pincode")
    @classmethod
    def validate_billing_pincode(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) != 6 or not clean.isdigit():
            raise ValueError("Indian PIN code must contain exactly 6 digits")
        return clean


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

    @field_validator("pincode")
    @classmethod
    def validate_billing_pincode_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if clean and (len(clean) != 6 or not clean.isdigit()):
                raise ValueError("Indian PIN code must contain exactly 6 digits")
            return clean
        return v


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
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict, alias="metadataJson")
    status: Optional[str] = Field("ACTIVE")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerExternalIdentityCreate(CustomerExternalIdentityBase):
    id: Optional[str] = Field(None, max_length=50)
    customer_id: Optional[str] = Field(None, max_length=50, alias="customerId")


class CustomerExternalIdentityUpdate(BaseModel):
    source_system: Optional[str] = Field(None, alias="sourceSystem")
    external_type: Optional[str] = Field(None, alias="externalType")
    external_code: Optional[str] = Field(None, alias="externalCode")
    metadata_json: Optional[Dict[str, Any]] = Field(None, alias="metadataJson")
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
    reason: str = "Unique and valid."
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
    is_tax_inclusive: Optional[bool] = Field(True, alias="isTaxInclusive")
    default_pricing_basis: Optional[str] = Field("MRP", alias="defaultPricingBasis")
    default_allow_promotions_on_rate: Optional[bool] = Field(False, alias="defaultAllowPromotionsOnRate")
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
    is_tax_inclusive: Optional[bool] = Field(None, alias="isTaxInclusive")
    default_pricing_basis: Optional[str] = Field(None, alias="defaultPricingBasis")
    default_allow_promotions_on_rate: Optional[bool] = Field(None, alias="defaultAllowPromotionsOnRate")
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
    is_tax_inclusive: Optional[bool] = Field(None, alias="isTaxInclusive")
    pricing_basis: Optional[str] = Field("MRP", alias="pricingBasis")
    allow_promotions_on_rate: Optional[bool] = Field(False, alias="allowPromotionsOnRate")
    religion: Optional[str] = None
    ethnicity: Optional[str] = None
    age_group: Optional[str] = Field(None, alias="ageGroup")
    profession: Optional[str] = None
    customer_type: Optional[str] = Field(None, alias="customerType")
    profile_notes: Optional[str] = Field(None, alias="profileNotes")
    company_code: Optional[str] = Field(None, alias="companyCode")
    environment: Optional[str] = None
    flat_file_format: Optional[str] = Field(None, alias="flatFileFormat")
    delimiter: Optional[str] = None
    buying_factor: Optional[Decimal] = Field(None, alias="buyingFactor")
    selling_factor: Optional[Decimal] = Field(None, alias="sellingFactor")
    is_dependant: Optional[bool] = Field(False, alias="isDependant")
    gender: Optional[str] = None
    date_of_birth: Optional[date] = Field(None, alias="dateOfBirth")
    is_married: Optional[bool] = Field(None, alias="isMarried")
    wedding_anniversary: Optional[date] = Field(None, alias="weddingAnniversary")
    lst_number: Optional[str] = Field(None, alias="lstNumber")
    lst_date: Optional[date] = Field(None, alias="lstDate")
    cst_number: Optional[str] = Field(None, alias="cstNumber")
    cst_date: Optional[date] = Field(None, alias="cstDate")
    pan_number: Optional[str] = Field(None, alias="panNumber")
    is_pre_sale_form_applicable: Optional[bool] = Field(False, alias="isPreSaleFormApplicable")
    pre_sale_form_name: Optional[str] = Field(None, alias="preSaleFormName")
    is_post_sale_form_applicable: Optional[bool] = Field(False, alias="isPostSaleFormApplicable")
    post_sale_form_name: Optional[str] = Field(None, alias="postSaleFormName")
    payment_category: Optional[str] = Field(None, alias="paymentCategory")
    payment_term: Optional[str] = Field(None, alias="paymentTerm")
    transport_mode: Optional[str] = Field(None, alias="transportMode")
    transport_code: Optional[str] = Field(None, alias="transportCode")
    transit_days: Optional[int] = Field(None, alias="transitDays")
    bank_code: Optional[str] = Field(None, alias="bankCode")
    bank_location: Optional[str] = Field(None, alias="bankLocation")
    retail_factor: Optional[Decimal] = Field(None, alias="retailFactor")
    dealer_factor: Optional[Decimal] = Field(None, alias="dealerFactor")
    destination_tax_type: Optional[str] = Field(None, alias="destinationTaxType")
    allow_cash_bill: Optional[bool] = Field(None, alias="allowCashBill")
    allow_dc_gen: Optional[bool] = Field(None, alias="allowDcGen")
    allow_credit_invoice: Optional[bool] = Field(None, alias="allowCreditInvoice")
    allow_misc_issue: Optional[bool] = Field(None, alias="allowMiscIssue")
    allow_misc_receipts: Optional[bool] = Field(None, alias="allowMiscReceipts")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("gst_number")
    @classmethod
    def normalize_customer_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        value = v.strip().upper()
        from ..core.gst_engine import GSTIN_REGEX
        if not GSTIN_REGEX.match(value):
            raise ValueError(f"Invalid GSTIN format '{value}'")
        return value

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
    is_tax_inclusive: Optional[bool] = Field(None, alias="isTaxInclusive")
    pricing_basis: Optional[str] = Field(None, alias="pricingBasis")
    allow_promotions_on_rate: Optional[bool] = Field(None, alias="allowPromotionsOnRate")
    religion: Optional[str] = None
    ethnicity: Optional[str] = None
    age_group: Optional[str] = Field(None, alias="ageGroup")
    profession: Optional[str] = None
    customer_type: Optional[str] = Field(None, alias="customerType")
    profile_notes: Optional[str] = Field(None, alias="profileNotes")
    company_code: Optional[str] = Field(None, alias="companyCode")
    environment: Optional[str] = None
    flat_file_format: Optional[str] = Field(None, alias="flatFileFormat")
    delimiter: Optional[str] = None
    buying_factor: Optional[Decimal] = Field(None, alias="buyingFactor")
    selling_factor: Optional[Decimal] = Field(None, alias="sellingFactor")
    is_dependant: Optional[bool] = Field(None, alias="isDependant")
    gender: Optional[str] = None
    date_of_birth: Optional[date] = Field(None, alias="dateOfBirth")
    is_married: Optional[bool] = Field(None, alias="isMarried")
    wedding_anniversary: Optional[date] = Field(None, alias="weddingAnniversary")
    lst_number: Optional[str] = Field(None, alias="lstNumber")
    lst_date: Optional[date] = Field(None, alias="lstDate")
    cst_number: Optional[str] = Field(None, alias="cstNumber")
    cst_date: Optional[date] = Field(None, alias="cstDate")
    pan_number: Optional[str] = Field(None, alias="panNumber")
    is_pre_sale_form_applicable: Optional[bool] = Field(None, alias="isPreSaleFormApplicable")
    pre_sale_form_name: Optional[str] = Field(None, alias="preSaleFormName")
    is_post_sale_form_applicable: Optional[bool] = Field(None, alias="isPostSaleFormApplicable")
    post_sale_form_name: Optional[str] = Field(None, alias="postSaleFormName")
    payment_category: Optional[str] = Field(None, alias="paymentCategory")
    payment_term: Optional[str] = Field(None, alias="paymentTerm")
    transport_mode: Optional[str] = Field(None, alias="transportMode")
    transport_code: Optional[str] = Field(None, alias="transportCode")
    transit_days: Optional[int] = Field(None, alias="transitDays")
    bank_code: Optional[str] = Field(None, alias="bankCode")
    bank_location: Optional[str] = Field(None, alias="bankLocation")
    retail_factor: Optional[Decimal] = Field(None, alias="retailFactor")
    dealer_factor: Optional[Decimal] = Field(None, alias="dealerFactor")
    destination_tax_type: Optional[str] = Field(None, alias="destinationTaxType")
    allow_cash_bill: Optional[bool] = Field(None, alias="allowCashBill")
    allow_dc_gen: Optional[bool] = Field(None, alias="allowDcGen")
    allow_credit_invoice: Optional[bool] = Field(None, alias="allowCreditInvoice")
    allow_misc_issue: Optional[bool] = Field(None, alias="allowMiscIssue")
    allow_misc_receipts: Optional[bool] = Field(None, alias="allowMiscReceipts")
    outstanding: Optional[Decimal] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    expected_modified_at: Optional[datetime] = Field(None, alias="expectedModifiedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("gst_number")
    @classmethod
    def normalize_customer_gstin_update(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        value = v.strip().upper()
        from ..core.gst_engine import GSTIN_REGEX
        if not GSTIN_REGEX.match(value):
            raise ValueError(f"Invalid GSTIN format '{value}'")
        return value


class CustomerDeactivateRequest(BaseModel):
    """Payload for customer account deactivation."""
    reason: Optional[str] = Field(None, description="Operational explanation for customer deactivation")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerDeleteEligibilityResponse(BaseModel):
    """Authoritative pre-flight evaluation response for customer deletion."""
    customer_id: str = Field(..., alias="customerId")
    customer_code: Optional[str] = Field(None, alias="customerCode")
    customer_name: str = Field(..., alias="customerName")
    status: str
    eligible: bool
    blockers: List[str] = []
    warnings: List[str] = []
    recommendation: str = "DEACTIVATE"  # "DEACTIVATE" or "PERMANENT_DELETE"
    reason: str
    metrics: Dict[str, Any] = {}

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerMergeRequest(BaseModel):
    """Payload for authoritative customer account consolidation (BD-2)."""
    target_customer_id: str = Field(..., alias="targetCustomerId", description="Surviving target customer ID")
    source_customer_id: str = Field(..., alias="sourceCustomerId", description="Duplicate customer ID being absorbed")
    reason: Optional[str] = Field(None, description="Operational explanation for customer merge")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerMergeResponse(BaseModel):
    """Result of authoritative customer account consolidation."""
    target_customer_id: str = Field(..., alias="targetCustomerId")
    source_customer_id: str = Field(..., alias="sourceCustomerId")
    status: str = "merged"
    message: str
    reassigned_records: Dict[str, int] = Field(default_factory=dict, alias="reassignedRecords")
    merged_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="mergedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerRelationshipCreate(BaseModel):
    dependant_customer_id: str = Field(..., alias="dependantCustomerId")
    relation: str
    apply_same_mailing: bool = Field(False, alias="applySameMailing")
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class CustomerRelationshipResponse(CustomerRelationshipCreate):
    id: str
    parent_customer_id: str = Field(..., alias="parentCustomerId")
    dependant_customer_name: Optional[str] = Field(None, alias="dependantCustomerName")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# ──────────────────────── CustomerCompanyRelationship ───────────────────────

class CustomerCompanyRelationshipBase(BaseModel):
    company_id: str
    branch_id: Optional[str] = None
    customer_group_id: Optional[str] = None
    price_tier_id: Optional[str] = None
    credit_limit: Decimal = Field(default=Decimal("0.00"))
    credit_days: int = Field(default=0)
    credit_hold: bool = Field(default=False)
    status: str = Field(default="Active")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerCompanyRelationshipCreate(CustomerCompanyRelationshipBase):
    customer_id: str


class CustomerCompanyRelationshipUpdate(BaseModel):
    customer_group_id: Optional[str] = None
    price_tier_id: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    credit_days: Optional[int] = None
    credit_hold: Optional[bool] = None
    status: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerCompanyRelationshipResponse(CustomerCompanyRelationshipBase):
    id: str
    uuid: str
    customer_id: str
    is_active: bool
    is_deleted: bool
    created_at: datetime
    modified_at: Optional[datetime] = None

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


def get_loaded_relationship(customer: Any, attr_name: str) -> list:
    """
    Safely extract relationship collection without triggering SQLAlchemy async lazy loader.
    """
    if isinstance(customer, dict):
        return customer.get(attr_name) or []

    insp = inspect(customer, raiseerr=False)
    if insp is not None and hasattr(insp, "attrs") and attr_name in insp.attrs:
        loaded = insp.attrs[attr_name].loaded_value
        if loaded is not NO_VALUE and loaded is not None:
            return loaded if isinstance(loaded, (list, tuple, set)) else [loaded]
        return []

    if hasattr(customer, "__dict__"):
        val = customer.__dict__.get(attr_name)
        if val is not NO_VALUE and val is not None:
            return val if isinstance(val, (list, tuple, set)) else [val]

    return []


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
    policy = customer.__dict__.get("policy") if hasattr(customer, "__dict__") else None
    loyalty_members = get_loaded_relationship(customer, "loyalty_members")
    loyalty_member = loyalty_members[0] if loyalty_members else None
    dependant_rows = []
    for relationship in get_loaded_relationship(customer, "dependant_relationships"):
        dependant = getattr(relationship, "dependant_customer", None)
        dependant_rows.append({
            "id": relationship.id,
            "parent_customer_id": relationship.parent_customer_id,
            "dependant_customer_id": relationship.dependant_customer_id,
            "dependant_customer_name": getattr(dependant, "name", None),
            "relation": relationship.relation,
            "apply_same_mailing": relationship.apply_same_mailing,
            "notes": relationship.notes,
        })

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
        "is_tax_inclusive": getattr(customer, "is_tax_inclusive", None),
        "pricing_basis": getattr(customer, "pricing_basis", "MRP") or "MRP",
        "allow_promotions_on_rate": bool(getattr(customer, "allow_promotions_on_rate", False)),
        "religion": getattr(customer, "religion", None),
        "ethnicity": getattr(customer, "ethnicity", None),
        "age_group": getattr(customer, "age_group", None),
        "profession": getattr(customer, "profession", None),
        "customer_type": getattr(customer, "customer_type", None),
        "profile_notes": getattr(customer, "profile_notes", None),
        "company_code": getattr(customer, "company_code", None),
        "environment": getattr(customer, "environment", None),
        "flat_file_format": getattr(customer, "flat_file_format", None),
        "delimiter": getattr(customer, "delimiter", None),
        "buying_factor": getattr(customer, "buying_factor", None),
        "selling_factor": getattr(customer, "selling_factor", None),
        "is_dependant": bool(getattr(customer, "is_dependant", False)),
        "gender": getattr(customer, "gender", None),
        "date_of_birth": getattr(customer, "date_of_birth", None),
        "is_married": getattr(customer, "is_married", None),
        "wedding_anniversary": getattr(customer, "wedding_anniversary", None),
        "lst_number": getattr(customer, "lst_number", None),
        "lst_date": getattr(customer, "lst_date", None),
        "cst_number": getattr(customer, "cst_number", None),
        "cst_date": getattr(customer, "cst_date", None),
        "pan_number": getattr(customer, "pan_number", None),
        "is_pre_sale_form_applicable": bool(getattr(customer, "is_pre_sale_form_applicable", False)),
        "pre_sale_form_name": getattr(customer, "pre_sale_form_name", None),
        "is_post_sale_form_applicable": bool(getattr(customer, "is_post_sale_form_applicable", False)),
        "post_sale_form_name": getattr(customer, "post_sale_form_name", None),
        "payment_category": getattr(policy, "payment_category", None) if policy else None,
        "payment_term": getattr(policy, "payment_term", None) if policy else None,
        "transport_mode": getattr(policy, "transport_mode", None) if policy else None,
        "transport_code": getattr(policy, "transport_code", None) if policy else None,
        "transit_days": getattr(policy, "transit_days", None) if policy else None,
        "bank_code": getattr(policy, "bank_code", None) if policy else None,
        "bank_location": getattr(policy, "bank_location", None) if policy else None,
        "retail_factor": getattr(policy, "retail_factor", None) if policy else None,
        "dealer_factor": getattr(policy, "dealer_factor", None) if policy else None,
        "destination_tax_type": getattr(policy, "destination_tax_type", None) if policy else None,
        "allow_cash_bill": getattr(policy, "allow_cash_bill", None) if policy else None,
        "allow_dc_gen": getattr(policy, "allow_dc_gen", None) if policy else None,
        "allow_credit_invoice": getattr(policy, "allow_credit_invoice", None) if policy else None,
        "allow_misc_issue": getattr(policy, "allow_misc_issue", None) if policy else None,
        "allow_misc_receipts": getattr(policy, "allow_misc_receipts", None) if policy else None,
        "dependants": dependant_rows,
        "loyalty_pgm_id": getattr(loyalty_member, "loyalty_program_id", None) if loyalty_member else None,
        "loyalty_pgm_code": getattr(loyalty_member, "loyalty_program_code", None) if loyalty_member else None,
        "loyalty_tier": getattr(loyalty_member, "loyalty_tier_id", None) if loyalty_member else None,
        "loyalty_points_balance": getattr(loyalty_member, "current_points_balance", None) if loyalty_member else None,
        "credit_used": customer.outstanding if customer.outstanding is not None else Decimal("0.00"),
        "company_id": customer.company_id,
        "branch_id": customer.branch_id,
        "identity_code": getattr(customer, "identity_code", None),
        "created_at": customer.created_at,
        "modified_at": customer.modified_at,
        "is_active": customer.is_active if customer.is_active is not None else True,
        "is_deleted": customer.is_deleted if customer.is_deleted is not None else False,
        "version": customer.version if customer.version is not None else 1,
        # Sourced authoritatively from company relationship (if present) or eagerly-loaded CustomerGroup
        "credit_limit": (
            next((rel.credit_limit for rel in get_loaded_relationship(customer, "company_relationships") if not getattr(rel, "is_deleted", False) and getattr(rel, "company_id", None) == customer.company_id and rel.credit_limit is not None), None)
            or (grp.credit_limit if grp else None)
        ),
        "credit_days": (
            next((rel.credit_days for rel in get_loaded_relationship(customer, "company_relationships") if not getattr(rel, "is_deleted", False) and getattr(rel, "company_id", None) == customer.company_id and rel.credit_days is not None), None)
            or (grp.credit_days if grp else None)
        ),
        "unlimited_credit": grp.unlimited_credit if grp else None,
        "credit_hold": (
            next((rel.credit_hold for rel in get_loaded_relationship(customer, "company_relationships") if not getattr(rel, "is_deleted", False) and getattr(rel, "company_id", None) == customer.company_id and rel.credit_hold is not None), None)
            or (grp.credit_hold if grp else None)
        ),
        "billing_locations": [
            CustomerBillingLocationResponse.model_validate(bl)
            for bl in get_loaded_relationship(customer, "billing_locations")
            if not getattr(bl, "is_deleted", False)
        ],
        "gst_registrations": [
            CustomerGSTRegistrationResponse.model_validate(reg)
            for reg in get_loaded_relationship(customer, "gst_registrations")
            if not getattr(reg, "is_deleted", False)
        ],
        "delivery_locations": [
            CustomerDeliveryLocationResponse.model_validate(loc)
            for loc in get_loaded_relationship(customer, "delivery_locations")
            if not getattr(loc, "is_deleted", False)
        ],
        "external_identities": [
            CustomerExternalIdentityResponse.model_validate(ei)
            for ei in get_loaded_relationship(customer, "external_identities")
            if not getattr(ei, "is_deleted", False)
        ],
        "company_relationships": [
            CustomerCompanyRelationshipResponse.model_validate(rel)
            for rel in get_loaded_relationship(customer, "company_relationships")
            if not getattr(rel, "is_deleted", False)
        ],
    }


class CustomerResponse(CustomerBase):
    id: str
    uuid: Optional[str] = None
    identity_code: Optional[str] = None
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
    dependants: List[CustomerRelationshipResponse] = []
    company_relationships: List[CustomerCompanyRelationshipResponse] = []
    loyalty_pgm_id: Optional[str] = Field(None, alias="loyaltyPgmId")
    loyalty_pgm_code: Optional[str] = Field(None, alias="loyaltyPgmCode")
    loyalty_tier: Optional[str] = Field(None, alias="loyaltyTier")
    loyalty_points_balance: Optional[Decimal] = Field(None, alias="loyaltyPointsBalance")
    credit_used: Optional[Decimal] = Field(None, alias="creditUsed")

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


class CorporateKpis(BaseModel):
    total_orders: int = 0
    orders_growth_pct: float = 0.0
    total_purchase_value: Decimal = Decimal("0.00")
    purchase_growth_pct: float = 0.0
    average_order_value: Decimal = Decimal("0.00")
    aov_growth_pct: float = 0.0
    last_order_date: Optional[str] = None
    last_order_relative: Optional[str] = None
    total_stores: int = 0
    active_stores: int = 0
    active_stores_pct: float = 0.0
    total_psv_value: Decimal = Decimal("0.00")
    psv_stores_count: int = 0


class CorporateStoreItem(BaseModel):
    id: str
    store_code: str
    store_name: str
    city: str
    state: str
    store_type: str = "Supermarket"
    status: str = "Active"
    psv_value: Decimal = Decimal("0.00")
    psv_status: Optional[str] = "Healthy"
    psv_value_display: Optional[str] = None
    contact: str = "—"
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address_summary: Optional[str] = None
    addresses: List[StoreAddressItem] = []


class CorporatePsvSummary(BaseModel):
    total_value: Decimal = Decimal("0.00")
    in_stock_value: Decimal = Decimal("0.00")
    in_stock_stores: int = 0
    low_stock_value: Decimal = Decimal("0.00")
    low_stock_stores: int = 0
    out_of_stock_value: Decimal = Decimal("0.00")
    out_of_stock_stores: int = 0
    not_reporting_stores: int = 0


class StoreTypeSlice(BaseModel):
    type: str
    count: int = 0
    percentage: float = 0.0
    color: str = "#3b82f6"


class RecentOrderItem(BaseModel):
    order_no: str
    date: str
    stores_count: int = 1
    items_count: int = 0
    value: Decimal = Decimal("0.00")
    status: str = "Completed"


class PurchaseTrendItem(BaseModel):
    month: str
    purchase_value: float = 0.0
    orders: int = 0


class CategoryShareItem(BaseModel):
    category: str
    value: Decimal = Decimal("0.00")
    share_pct: float = 0.0


class CorporateCustomer360Response(BaseModel):
    customer: CustomerResponse
    kpis: CorporateKpis
    store_network: List[CorporateStoreItem] = []
    psv_summary: CorporatePsvSummary
    store_type_distribution: List[StoreTypeSlice] = []
    recent_orders: List[RecentOrderItem] = []
    purchase_trend: List[PurchaseTrendItem] = []
    top_categories: List[CategoryShareItem] = []


# ──────────────────────── Customer Credit Exposure (BD-6) ───────────────────

class CompanyCreditExposureItem(BaseModel):
    company_id: str = Field(..., alias="companyId")
    company_name: Optional[str] = Field(None, alias="companyName")
    company_code: Optional[str] = Field(None, alias="companyCode")
    relationship_id: Optional[str] = Field(None, alias="relationshipId")
    customer_group_id: Optional[str] = Field(None, alias="customerGroupId")
    credit_limit: Decimal = Field(default=Decimal("0.00"), alias="creditLimit")
    credit_days: int = Field(default=0, alias="creditDays")
    credit_hold: bool = Field(default=False, alias="creditHold")
    credit_used: Decimal = Field(default=Decimal("0.00"), alias="creditUsed")
    available_credit: Decimal = Field(default=Decimal("0.00"), alias="availableCredit")
    utilization_percent: float = Field(default=0.0, alias="utilizationPercent")
    exposure_status: str = Field(default="NORMAL", alias="exposureStatus")  # NORMAL | HIGH_WARNING | CRITICAL_BREACH | ON_HOLD
    status: str = Field(default="Active")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerCreditExposureResponse(BaseModel):
    customer_id: str = Field(..., alias="customerId")
    customer_name: str = Field(..., alias="customerName")
    code: Optional[str] = None
    identity_code: Optional[str] = Field(None, alias="identityCode")
    pan_number: Optional[str] = Field(None, alias="panNumber")
    total_credit_limit: Decimal = Field(default=Decimal("0.00"), alias="totalCreditLimit")
    total_credit_used: Decimal = Field(default=Decimal("0.00"), alias="totalCreditUsed")
    total_available_credit: Decimal = Field(default=Decimal("0.00"), alias="totalAvailableCredit")
    group_utilization_percent: float = Field(default=0.0, alias="groupUtilizationPercent")
    group_risk_level: str = Field(default="LOW", alias="groupRiskLevel")  # LOW | MODERATE | HIGH | CRITICAL | ON_HOLD
    company_count: int = Field(default=0, alias="companyCount")
    hold_count: int = Field(default=0, alias="holdCount")
    company_exposures: List[CompanyCreditExposureItem] = Field(default_factory=list, alias="companyExposures")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerCodeRecommendationResponse(BaseModel):
    suggested_code: str = Field(..., alias="suggestedCode")
    assignment_mode: str = Field(default="HYBRID", alias="assignmentMode")
    uniqueness_scope: str = Field(default="COMPANY", alias="uniquenessScope")
    manual_entry_allowed: bool = Field(default=True, alias="manualEntryAllowed")
    prefix: str = Field(default="CUST-")
    has_eligible_existing_codes: bool = Field(default=False, alias="hasEligibleExistingCodes")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CustomerCodeValidationRequest(BaseModel):
    code: str


class CustomerCodeValidationResponse(BaseModel):
    is_valid: bool = Field(..., alias="isValid")
    code: str
    reason: Optional[str] = None
    company_id: Optional[str] = Field(None, alias="companyId")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class EligibleCustomerCodeItem(BaseModel):
    code: str
    name: Optional[str] = None
    status: str = "AVAILABLE"
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

