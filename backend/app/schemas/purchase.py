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
from typing import Optional, List, Dict, Any
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


# ──────────────────────────────────────────────────────────────
# v5.8.0 3-Way Matching, Landed Cost & Tolerance Policy Schemas
# ──────────────────────────────────────────────────────────────

class LandedCostVoucherCreate(BaseModel):
    charge_type: str  # Freight, Customs, Insurance, Handling
    charge_amount: Decimal
    currency_id: str = "INR"
    vendor_name: Optional[str] = None
    allocation_method: str = "VALUE"  # VALUE, WEIGHT, VOLUME, QUANTITY, MANUAL


class LandedCostAllocationRequest(BaseModel):
    vouchers: List[LandedCostVoucherCreate]
    manual_ratios: Optional[Dict[str, float]] = None


class ThreeWayMatchLineResponse(BaseModel):
    id: str
    product_id: str
    ordered_qty: Decimal
    received_qty: Decimal
    billed_qty: Decimal
    po_unit_price: Decimal
    billed_unit_price: Decimal
    price_variance_pct: Decimal
    qty_variance_pct: Decimal
    line_status: str
    resolution_trace: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class BilledItemInput(BaseModel):
    product_id: str
    billed_qty: Decimal
    billed_unit_price: Decimal


class ThreeWayMatchRequest(BaseModel):
    po_id: str
    grn_id: str
    vendor_bill_no: str
    vendor_bill_date: Optional[datetime] = None
    billed_items: List[BilledItemInput]


class ThreeWayMatchResponse(BaseModel):
    id: str
    po_id: str
    grn_id: str
    vendor_bill_no: str
    vendor_bill_date: Optional[datetime] = None
    match_status: str
    overall_price_variance: Decimal
    overall_qty_variance: Decimal
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_notes: Optional[str] = None
    created_at: datetime
    lines: List[ThreeWayMatchLineResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TolerancePolicyCreate(BaseModel):
    level: str  # SYSTEM, COMPANY, VENDOR, PRODUCT
    target_id: Optional[str] = None
    allowed_price_variance_pct: Decimal = Decimal("2.00")
    allowed_qty_variance_pct: Decimal = Decimal("0.00")
    auto_approve_under_threshold: bool = True


class TolerancePolicyResponse(BaseModel):
    id: str
    level: str
    target_id: Optional[str] = None
    allowed_price_variance_pct: Decimal
    allowed_qty_variance_pct: Decimal
    auto_approve_under_threshold: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────
# v5.9.0 Request for Quotation (RFQ) & Vendor Quotation Schemas
# ──────────────────────────────────────────────────────────────

class RFQItemCreate(BaseModel):
    product_id: str
    required_quantity: Decimal
    target_unit_price: Optional[Decimal] = None
    target_delivery_date: Optional[datetime] = None


class RFQCreate(BaseModel):
    title: str
    description: Optional[str] = None
    submission_deadline: datetime
    evaluation_profile: str = "RETAIL_DEFAULT"
    items: List[RFQItemCreate] = []
    invited_vendors: List[str] = []  # List of supplier_id strings


class RFQItemResponse(BaseModel):
    id: str
    product_id: str
    required_quantity: Decimal
    target_unit_price: Optional[Decimal] = None
    target_delivery_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RFQVendorResponse(BaseModel):
    id: str
    supplier_id: str
    invitation_status: str
    invited_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RFQResponse(BaseModel):
    id: str
    rfq_code: str
    title: str
    description: Optional[str] = None
    submission_deadline: datetime
    evaluation_profile: str
    status: str
    created_at: datetime
    items: List[RFQItemResponse] = []
    invited_vendors: List[RFQVendorResponse] = []

    model_config = ConfigDict(from_attributes=True)


class VendorQuotationItemCreate(BaseModel):
    product_id: str
    offered_quantity: Decimal
    offered_unit_price: Decimal
    discount_percentage: Decimal = Decimal("0.00")


class VendorQuotationCreate(BaseModel):
    quotation_code: str
    currency_id: str = "INR"
    offered_lead_time_days: int = 7
    payment_terms: Optional[str] = None
    quote_validity_date: datetime
    items: List[VendorQuotationItemCreate] = []


class VendorQuotationItemResponse(BaseModel):
    id: str
    product_id: str
    offered_quantity: Decimal
    offered_unit_price: Decimal
    discount_percentage: Decimal
    net_unit_price: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class VendorQuotationResponse(BaseModel):
    id: str
    rfq_id: str
    supplier_id: str
    quotation_code: str
    version_number: int
    currency_id: str
    offered_lead_time_days: int
    payment_terms: Optional[str] = None
    quote_validity_date: datetime
    total_quote_value: Decimal
    score: Optional[Decimal] = None
    rank: Optional[int] = None
    status: str
    created_at: datetime
    items: List[VendorQuotationItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class QuotationAwardRequest(BaseModel):
    quotation_id: str
    awarded_by: str
    award_notes: Optional[str] = ""
    convert_to: str  # PURCHASE_ORDER or VENDOR_CONTRACT


class QuotationEvaluationResponse(BaseModel):
    id: str
    rfq_id: str
    winning_quotation_id: str
    winning_supplier_id: str
    evaluation_profile: str
    winning_score: Decimal
    comparison_matrix_snapshot: Dict[str, Any]
    awarded_by: str
    awarded_at: datetime
    award_notes: Optional[str] = None
    converted_doc_type: Optional[str] = None
    converted_doc_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────
# v6.0.0 Blanket Purchase Agreement (BPA) Schemas
# ──────────────────────────────────────────────────────────────

class BPALineCreate(BaseModel):
    product_id: str
    agreed_unit_price: Decimal
    committed_quantity: Decimal


class BPACreate(BaseModel):
    bpa_code: str
    title: str
    supplier_id: str
    valid_from: datetime
    valid_to: datetime
    max_commitment_value: Decimal
    terms_and_conditions: Optional[str] = None
    lines: List[BPALineCreate] = []


class BPALineResponse(BaseModel):
    id: str
    bpa_id: str
    product_id: str
    agreed_unit_price: Decimal
    committed_quantity: Decimal
    released_quantity: Decimal
    remaining_quantity: Decimal

    model_config = ConfigDict(from_attributes=True)


class BPAResponse(BaseModel):
    id: str
    bpa_code: str
    title: str
    supplier_id: str
    valid_from: datetime
    valid_to: datetime
    max_commitment_value: Decimal
    released_value: Decimal
    remaining_value: Decimal
    status: str
    created_at: datetime
    lines: List[BPALineResponse] = []

    model_config = ConfigDict(from_attributes=True)


class BPAReleaseItemRequest(BaseModel):
    product_id: str
    release_quantity: Decimal


class BPAReleaseRequest(BaseModel):
    items: List[BPAReleaseItemRequest]


# ──────────────────────────────────────────────────────────────
# v6.1.0 Purchase Requisition Schemas
# ──────────────────────────────────────────────────────────────

class RequisitionLineCreate(BaseModel):
    product_id: str
    requested_quantity: Decimal
    estimated_unit_price: Decimal
    preferred_supplier_id: Optional[str] = None
    notes: Optional[str] = None


class RequisitionCreate(BaseModel):
    requisition_no: str
    title: str
    requestor_id: Optional[str] = None
    department: Optional[str] = None
    cost_center: Optional[str] = None
    required_by_date: Optional[datetime] = None
    notes: Optional[str] = None
    lines: List[RequisitionLineCreate] = []


class RequisitionLineResponse(BaseModel):
    id: str
    requisition_id: str
    product_id: str
    requested_quantity: Decimal
    estimated_unit_price: Decimal
    line_total: Decimal
    preferred_supplier_id: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RequisitionApprovalResponse(BaseModel):
    id: str
    requisition_id: str
    stage_order: int
    stage_name: str
    required_approver_role: Optional[str] = None
    approver_id: Optional[str] = None
    decision: Optional[str] = None
    decided_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RequisitionResponse(BaseModel):
    id: str
    requisition_no: str
    title: str
    requestor_id: Optional[str] = None
    department: Optional[str] = None
    cost_center: Optional[str] = None
    required_by_date: Optional[datetime] = None
    estimated_total: Decimal
    notes: Optional[str] = None
    status: str
    current_approval_stage: Optional[int] = None
    converted_doc_type: Optional[str] = None
    converted_doc_id: Optional[str] = None
    created_at: datetime
    lines: List[RequisitionLineResponse] = []
    approvals: List[RequisitionApprovalResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ApprovalDecisionRequest(BaseModel):
    approver_id: str
    decision: str  # APPROVED, REJECTED
    notes: Optional[str] = None


class RequisitionConvertRequest(BaseModel):
    strategy: str  # DIRECT_PO, RFQ, BPA_RELEASE
    supplier_id: Optional[str] = None
    bpa_id: Optional[str] = None


class ApprovalPolicyCreate(BaseModel):
    policy_name: str
    min_value: Decimal = Decimal("0.00")
    max_value: Optional[Decimal] = None
    required_approver_role: Optional[str] = None
    stage_order: int = 1
    auto_approve: bool = False


class ApprovalPolicyResponse(BaseModel):
    id: str
    policy_name: str
    min_value: Decimal
    max_value: Optional[Decimal] = None
    required_approver_role: Optional[str] = None
    stage_order: int
    auto_approve: bool

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────
# v6.2.0 Quality Control (QC) & Debit Note Schemas
# ──────────────────────────────────────────────────────────────

class QCItemEvaluationRequest(BaseModel):
    product_id: str
    accepted_quantity: Decimal = Decimal("0.00")
    rejected_quantity: Decimal = Decimal("0.00")
    quarantine_quantity: Decimal = Decimal("0.00")
    defect_category: Optional[str] = "NONE"
    defect_reason: Optional[str] = None


class QCEvaluationRequest(BaseModel):
    evaluations: List[QCItemEvaluationRequest]
    remarks: Optional[str] = None


class QCInspectionItemResponse(BaseModel):
    id: str
    inspection_id: str
    product_id: str
    received_quantity: Decimal
    inspected_quantity: Decimal
    accepted_quantity: Decimal
    rejected_quantity: Decimal
    quarantine_quantity: Decimal
    defect_category: Optional[str] = None
    defect_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class QCInspectionResponse(BaseModel):
    id: str
    inspection_no: str
    receipt_id: str
    supplier_id: str
    inspector_id: Optional[str] = None
    inspected_at: Optional[datetime] = None
    overall_status: str
    total_received_qty: Decimal
    total_accepted_qty: Decimal
    total_rejected_qty: Decimal
    total_quarantine_qty: Decimal
    debit_note_id: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime
    items: List[QCInspectionItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SupplierDebitNoteResponse(BaseModel):
    id: str
    debit_note_no: str
    supplier_id: str
    receipt_id: str
    inspection_id: Optional[str] = None
    claim_amount: Decimal
    tax_amount: Decimal
    total_debit_amount: Decimal
    status: str
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────
# v6.3.0 Supplier Performance & Scorecard Analytics Schemas
# ──────────────────────────────────────────────────────────────

class SupplierScorecardMetricResponse(BaseModel):
    id: str
    scorecard_id: str
    metric_type: str
    raw_value: Decimal
    weight: Decimal
    weighted_score: Decimal
    details_json: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class SupplierScorecardResponse(BaseModel):
    id: str
    supplier_id: str
    scorecard_no: str
    evaluation_date: datetime
    days_window: int
    otif_score: Decimal
    quality_score: Decimal
    price_score: Decimal
    rfq_score: Decimal
    composite_score: Decimal
    grade: str
    tier_classification: str
    metrics: List[SupplierScorecardMetricResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ScorecardRecalculateRequest(BaseModel):
    days_window: int = 90
    supplier_id: Optional[str] = None







