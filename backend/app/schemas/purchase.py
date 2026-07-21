"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.18.0
* Created    : 2026-07-11
* Modified   : 2026-07-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

import re
from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


# ─────────────────────────── Supplier Sub-Entities ───────────────────────────

class SupplierTaxProfileCreate(BaseModel):
    pan_number: Optional[str] = None
    gstin: Optional[str] = None
    gst_registration_type_id: Optional[str] = None
    is_tds_applicable: bool = False
    tds_section_id: Optional[str] = None
    tds_rate: Decimal = Decimal("0.00")
    is_tcs_applicable: bool = False

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "":
            pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
            if not re.match(pattern, v.upper()):
                raise ValueError("Invalid Indian PAN format (expected e.g. ABCDE1234F)")
            return v.upper()
        return v

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "":
            pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
            if not re.match(pattern, v.upper()):
                raise ValueError("Invalid Indian GSTIN format (expected 15 alphanumeric characters e.g. 27ABCDE1234F1Z5)")
            return v.upper()
        return v


class SupplierTaxProfileResponse(SupplierTaxProfileCreate):
    id: str
    supplier_id: str
    model_config = ConfigDict(from_attributes=True)


class SupplierComplianceProfileCreate(BaseModel):
    msme_category: Optional[str] = None
    msme_number: Optional[str] = None
    fssai_license_no: Optional[str] = None
    drug_license_no: Optional[str] = None
    iec_code: Optional[str] = None
    valid_from: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    verification_status: str = "Unverified"


class SupplierComplianceProfileResponse(SupplierComplianceProfileCreate):
    id: str
    supplier_id: str
    model_config = ConfigDict(from_attributes=True)


class SupplierPaymentProfileCreate(BaseModel):
    payment_terms_id: Optional[str] = None
    payment_mode_id: Optional[str] = None
    currency_id: str = "INR"
    payment_cycle: Optional[str] = None


class SupplierPaymentProfileResponse(SupplierPaymentProfileCreate):
    id: str
    supplier_id: str
    model_config = ConfigDict(from_attributes=True)


class SupplierCreditProfileCreate(BaseModel):
    credit_limit: Decimal = Decimal("0.00")
    credit_days: int = 0
    opening_balance: Decimal = Decimal("0.00")
    opening_balance_type: str = "Cr"


class SupplierCreditProfileResponse(SupplierCreditProfileCreate):
    id: str
    supplier_id: str
    model_config = ConfigDict(from_attributes=True)


class SupplierBankDetailsCreate(BaseModel):
    bank_name: str
    branch_name: Optional[str] = None
    account_name: str
    account_number: str
    ifsc_code: str
    upi_id: Optional[str] = None
    is_primary: bool = False

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        if v:
            pattern = r"^[A-Z]{4}0[A-Z0-9]{6}$"
            if not re.match(pattern, v.upper()):
                raise ValueError("Invalid Indian IFSC Code format (expected e.g. SBIN0001234)")
            return v.upper()
        return v


class SupplierBankDetailsResponse(SupplierBankDetailsCreate):
    id: str
    supplier_id: str
    model_config = ConfigDict(from_attributes=True)


class SupplierAddressCreate(BaseModel):
    address_type_id: str = "Billing"
    house_no: Optional[str] = None
    building_name: Optional[str] = None
    street: Optional[str] = None
    area: Optional[str] = None
    landmark: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    pincode: Optional[str] = None
    is_primary: bool = False


class SupplierAddressResponse(SupplierAddressCreate):
    id: str
    supplier_id: str
    model_config = ConfigDict(from_attributes=True)


class SupplierContactCreate(BaseModel):
    contact_type_id: str = "Primary"
    name: str
    designation: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False


class SupplierContactResponse(SupplierContactCreate):
    id: str
    supplier_id: str
    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────── Supplier Aggregate Root ───────────────────────────

class SupplierCreate(BaseModel):
    name: str
    code: Optional[str] = None
    trade_name: Optional[str] = None
    supplier_type_id: Optional[str] = None
    supplier_group_id: Optional[str] = None
    gst_number: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    lifecycle_stage: str = "Active"
    account_status: str = "Active"
    custom_attributes: Optional[dict] = None

    tax_profile: Optional[SupplierTaxProfileCreate] = None
    compliance_profile: Optional[SupplierComplianceProfileCreate] = None
    payment_profile: Optional[SupplierPaymentProfileCreate] = None
    credit_profile: Optional[SupplierCreditProfileCreate] = None
    bank_details: Optional[List[SupplierBankDetailsCreate]] = None
    addresses: Optional[List[SupplierAddressCreate]] = None
    contacts: Optional[List[SupplierContactCreate]] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    trade_name: Optional[str] = None
    supplier_type_id: Optional[str] = None
    supplier_group_id: Optional[str] = None
    gst_number: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    lifecycle_stage: Optional[str] = None
    account_status: Optional[str] = None
    custom_attributes: Optional[dict] = None

    tax_profile: Optional[SupplierTaxProfileCreate] = None
    compliance_profile: Optional[SupplierComplianceProfileCreate] = None
    payment_profile: Optional[SupplierPaymentProfileCreate] = None
    credit_profile: Optional[SupplierCreditProfileCreate] = None
    bank_details: Optional[List[SupplierBankDetailsCreate]] = None
    addresses: Optional[List[SupplierAddressCreate]] = None
    contacts: Optional[List[SupplierContactCreate]] = None


class SupplierResponse(BaseModel):
    id: str
    code: str
    name: str
    trade_name: Optional[str] = None
    supplier_type_id: Optional[str] = None
    supplier_group_id: Optional[str] = None
    gst_number: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    outstanding: Decimal
    lifecycle_stage: str
    account_status: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    tax_profile: Optional[SupplierTaxProfileResponse] = None
    compliance_profile: Optional[SupplierComplianceProfileResponse] = None
    payment_profile: Optional[SupplierPaymentProfileResponse] = None
    credit_profile: Optional[SupplierCreditProfileResponse] = None
    bank_details: List[SupplierBankDetailsResponse] = []
    addresses: List[SupplierAddressResponse] = []
    contacts: List[SupplierContactResponse] = []

    model_config = ConfigDict(from_attributes=True)



class SupplierUpdate(BaseModel):
    """Partial-update schema for a supplier. All fields optional."""
    name:       Optional[str] = None
    gst_number: Optional[str] = None
    mobile:     Optional[str] = None
    email:      Optional[str] = None
    address:    Optional[str] = None
    city:       Optional[str] = None
    state:      Optional[str] = None
    pincode:    Optional[str] = None


# ─────────────────────────── Purchase Order ───────────────────────────

class PurchaseOrderItemCreate(BaseModel):
    product_id: str
    code:       str
    name:       str
    quantity:   Decimal
    cost_price: Decimal
    gst_rate:   Decimal = Decimal("18.00")


class PurchaseOrderItemResponse(BaseModel):
    id:         str
    product_id: str
    code:       str
    name:       str
    quantity:   Decimal
    cost_price: Decimal
    gst_rate:   Decimal
    tax_amount: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    id:          str
    order_no:    str
    supplier_id: str
    notes:       Optional[str] = None
    items:       List[PurchaseOrderItemCreate]

class PurchaseOrderCancelRequest(BaseModel):
    """Optional cancellation reason for cancelling a purchase order."""
    reason: Optional[str] = None


class PurchaseOrderAmendRequest(BaseModel):
    """
    Amendment: the original (Confirmed) PO is cancelled and a new Confirmed
    PO is created from the supplied items.
    """
    new_order_id: str
    new_order_no: str
    items:        List[PurchaseOrderItemCreate]
    reason:       Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    id:          str
    order_no:    str
    supplier_id: str
    status:      str
    notes:       Optional[str] = None
    subtotal:    Decimal
    tax_total:   Decimal
    grand_total: Decimal
    items:       List[PurchaseOrderItemResponse] = []
    company_id:  Optional[str] = None
    branch_id:   Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Receipt (GRN) ───────────────────────────

class PurchaseReceiptItemCreate(BaseModel):
    product_id:       str
    code:             str
    name:             str
    quantity_ordered:  Optional[Decimal] = None
    quantity_received: Decimal
    cost_price:       Decimal
    gst_rate:         Decimal = Decimal("18.00")


class PurchaseReceiptItemResponse(BaseModel):
    id:                str
    product_id:        str
    code:              str
    name:              str
    quantity_ordered:  Optional[Decimal] = None
    quantity_received: Decimal
    cost_price:        Decimal
    gst_rate:          Decimal
    tax_amount:        Decimal
    line_total:        Decimal

    model_config = {"from_attributes": True}


class PurchaseReceiptCreate(BaseModel):
    id:          str
    receipt_no:  str
    supplier_id: str
    order_id:    Optional[str] = None   # link to PO — optional
    notes:       Optional[str] = None
    items:       List[PurchaseReceiptItemCreate]


class PurchaseReceiptResponse(BaseModel):
    id:          str
    receipt_no:  str
    supplier_id: str
    order_id:    Optional[str] = None
    status:      str
    notes:       Optional[str] = None
    subtotal:    Decimal
    tax_total:   Decimal
    grand_total: Decimal
    items:       List[PurchaseReceiptItemResponse] = []
    company_id:  Optional[str] = None
    branch_id:   Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Reorder Configurations ───────────────────────────

class PurchaseReorderConfigCreate(BaseModel):
    product_id:            str
    reorder_level:         Decimal
    reorder_quantity:      Decimal
    preferred_supplier_id: Optional[str] = None


class PurchaseReorderConfigResponse(BaseModel):
    id:                    str
    uuid:                  str
    product_id:            str
    reorder_level:         Decimal
    reorder_quantity:      Decimal
    preferred_supplier_id: Optional[str] = None
    company_id:            Optional[str] = None
    branch_id:             Optional[str] = None
    created_at:            datetime
    modified_at:           datetime
    is_active:             bool

    model_config = {"from_attributes": True}


# ─────────────────────────── Purchase Jurisdiction Config ───────────────────────────

class PurchaseJurisdictionConfigCreate(BaseModel):
    company_state: str


class PurchaseConfigJurisdictionRequest(BaseModel):
    state: Optional[str] = None


class PurchaseReorderConvertRequest(BaseModel):
    supplierId: str
    selectedProductIds: List[str]


class PurchaseJurisdictionConfigResponse(BaseModel):
    id:            str
    uuid:          str
    company_state: str
    company_id:    Optional[str] = None
    branch_id:     Optional[str] = None
    created_at:    datetime
    modified_at:   datetime
    is_active:     bool

    model_config = {"from_attributes": True}


# ─────────────────────────── Vendor Contract Schemas ───────────────────────────

class VendorContractTierCreate(BaseModel):
    id: Optional[str] = None
    product_id: str
    purchase_uom_id: Optional[str] = None
    currency_id: str = "INR"
    min_quantity: Decimal = Decimal("1.00")
    max_quantity: Optional[Decimal] = None
    contract_unit_price: Decimal
    discount_percentage: Decimal = Decimal("0.00")
    bonus_quantity: Decimal = Decimal("0.00")
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None

    @field_validator("contract_unit_price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Contract unit price cannot be negative")
        return v


class VendorContractTierResponse(VendorContractTierCreate):
    id: str
    contract_id: str
    model_config = ConfigDict(from_attributes=True)


class VendorContractCreate(BaseModel):
    id: Optional[str] = None
    supplier_id: str
    contract_code: str
    contract_title: str
    valid_from: datetime
    valid_to: datetime
    currency_id: str = "INR"
    payment_terms_id: Optional[str] = None
    delivery_terms: Optional[str] = None
    min_commitment_value: Decimal = Decimal("0.00")
    terms_and_conditions: Optional[str] = None
    attachment_url: Optional[str] = None
    digital_signature_hash: Optional[str] = None
    tiers: List[VendorContractTierCreate] = []


class VendorContractUpdate(BaseModel):
    contract_title: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    payment_terms_id: Optional[str] = None
    delivery_terms: Optional[str] = None
    min_commitment_value: Optional[Decimal] = None
    terms_and_conditions: Optional[str] = None
    attachment_url: Optional[str] = None
    digital_signature_hash: Optional[str] = None


class VendorContractResponse(BaseModel):
    id: str
    supplier_id: str
    contract_code: str
    contract_title: str
    version_number: int
    parent_contract_id: Optional[str] = None
    valid_from: datetime
    valid_to: datetime
    currency_id: str
    payment_terms_id: Optional[str] = None
    delivery_terms: Optional[str] = None
    min_commitment_value: Decimal
    terms_and_conditions: Optional[str] = None
    attachment_url: Optional[str] = None
    digital_signature_hash: Optional[str] = None
    approval_status: str
    lifecycle_stage: str
    created_at: datetime
    modified_at: datetime
    is_active: bool
    tiers: List[VendorContractTierResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ProcurementSourcingResolution(BaseModel):
    vendor_id: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    contract_id: Optional[str] = None
    contract_code: Optional[str] = None
    contract_version: Optional[int] = None
    tier_id: Optional[str] = None
    strategy_used: str
    applied_price: float
    applied_discount: float
    reason: str
    estimated_lead_time: int
    resolution_trace: List[str] = []

