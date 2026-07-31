"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.3.0
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import re
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# CustomerGroup schemas
# ---------------------------------------------------------------------------

class CustomerGroupBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    credit_limit: Decimal = Decimal("0.00")
    unlimited_credit: bool = False
    credit_days: int = 0
    grace_days: int = 0
    credit_hold: bool = False
    auto_block_sales: bool = True
    warning_threshold_percent: Decimal = Decimal("80.00")
    allow_override: bool = False
    tax_inclusive: bool = True
    max_discount_percent: Decimal = Decimal("0.00")
    min_margin_percent: Decimal = Decimal("0.00")
    rounding_rule: str = "Nearest1"
    allowed_payment_methods: List[str] = []
    preferred_payment_method: Optional[str] = None
    allow_back_orders: bool = False
    allow_negative_stock_sales: bool = False
    require_po_number: bool = False
    invoice_language: str = "en"
    can_view_price: bool = True
    can_view_margin: bool = False
    can_purchase_on_credit: bool = False
    can_receive_discount: bool = True


class CustomerGroupCreate(CustomerGroupBase):
    id: str = Field(..., max_length=50)


class CustomerGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
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
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# PricingGroup schemas
# ---------------------------------------------------------------------------

class PricingGroupBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    base_price_field: str = Field("price", max_length=30)
    discount_percent: Decimal = Decimal("0.00")
    price_adjustment: Decimal = Decimal("0.00")
    rounding_rule: str = Field("Nearest1", max_length=30)
    max_additional_discount_percent: Decimal = Decimal("0.00")
    tax_inclusive: bool = True
    scheme_eligible: bool = True
    quantity_break_eligible: bool = False
    min_order_value: Decimal = Decimal("0.00")


class PricingGroupCreate(PricingGroupBase):
    id: str = Field(..., max_length=50)


class PricingGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price_field: Optional[str] = None
    discount_percent: Optional[Decimal] = None
    price_adjustment: Optional[Decimal] = None
    rounding_rule: Optional[str] = None
    max_additional_discount_percent: Optional[Decimal] = None
    tax_inclusive: Optional[bool] = None
    scheme_eligible: Optional[bool] = None
    quantity_break_eligible: Optional[bool] = None
    min_order_value: Optional[Decimal] = None


class PricingGroupResponse(PricingGroupBase):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Sub-Entity Schemas (v5.3.0 DDD Architecture Standard)
# ---------------------------------------------------------------------------

class CustomerAddressBase(BaseModel):
    address_type_id: str = Field(..., max_length=50)
    house_no: Optional[str] = None
    building_name: Optional[str] = None
    street: Optional[str] = None
    area: Optional[str] = None
    landmark: Optional[str] = None
    city: str = Field(..., max_length=100)
    district: Optional[str] = None
    state: str = Field(..., max_length=100)
    country: str = Field("India", max_length=100)
    pincode: str = Field(..., max_length=10)
    is_primary: bool = False


class CustomerAddressCreate(CustomerAddressBase):
    pass


class CustomerAddressResponse(CustomerAddressBase):
    id: str
    customer_id: str
    company_id: Optional[str] = None
    is_active: bool
    is_deleted: bool

    model_config = ConfigDict(from_attributes=True)


class CustomerContactBase(BaseModel):
    contact_type_id: str = Field(..., max_length=50)
    name: str = Field(..., max_length=150)
    designation: Optional[str] = None
    mobile: str = Field(..., max_length=20)
    email: Optional[str] = None
    is_primary: bool = False


class CustomerContactCreate(CustomerContactBase):
    pass


class CustomerContactResponse(CustomerContactBase):
    id: str
    customer_id: str
    company_id: Optional[str] = None
    is_active: bool
    is_deleted: bool

    model_config = ConfigDict(from_attributes=True)


class CustomerCreditProfileBase(BaseModel):
    credit_limit: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    credit_days: int = Field(0, ge=0)
    block_sales_on_limit: bool = True
    allow_override: bool = False
    opening_balance: Decimal = Decimal("0.00")
    opening_balance_type: str = Field("Dr", pattern="^(Dr|Cr)$")
    credit_hold_reason_id: Optional[str] = None


class CustomerCreditProfileCreate(CustomerCreditProfileBase):
    pass


class CustomerCreditProfileResponse(CustomerCreditProfileBase):
    id: str
    customer_id: str
    company_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerTaxProfileBase(BaseModel):
    gstin: Optional[str] = None
    gst_registration_type_id: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    msme_number: Optional[str] = None
    fssai_license_no: Optional[str] = None
    drug_license_no: Optional[str] = None
    is_gst_exempt: bool = False
    is_tds_applicable: bool = False
    is_tcs_applicable: bool = False

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v_clean = v.strip().upper()
            if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", v_clean):
                raise ValueError("SMRITI-VAL-030: Invalid Indian Income Tax PAN format (expected ABCDE1234F)")
            return v_clean
        return v

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v_clean = v.strip().upper()
            if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", v_clean):
                raise ValueError("SMRITI-VAL-031: Invalid Statutory 15-character GSTIN format")
            return v_clean
        return v


class CustomerTaxProfileCreate(CustomerTaxProfileBase):
    pass


class CustomerTaxProfileResponse(CustomerTaxProfileBase):
    id: str
    customer_id: str
    company_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerChannelPreferenceBase(BaseModel):
    channel_type_id: str = Field(..., max_length=50)
    is_enabled: bool = True
    priority: int = Field(1, ge=1)


class CustomerChannelPreferenceCreate(CustomerChannelPreferenceBase):
    pass


class CustomerChannelPreferenceResponse(CustomerChannelPreferenceBase):
    id: str
    customer_id: str
    company_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Customer Aggregate Schemas (v5.3.0 DDD Architecture Standard)
# ---------------------------------------------------------------------------

class CustomerBase(BaseModel):
    code: Optional[str] = None  # Server auto-generated if omitted
    customer_group_id: Optional[str] = Field(None, max_length=50)
    pricing_group_id: Optional[str] = Field(None, max_length=50)
    customer_type_id: Optional[str] = Field(None, max_length=50)
    territory_id: Optional[str] = Field(None, max_length=50)
    route_id: Optional[str] = Field(None, max_length=50)
    preferred_language_id: Optional[str] = Field(None, max_length=50)

    name: str = Field(..., max_length=255)
    mobile: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    gst_number: Optional[str] = Field(None, max_length=15)
    outstanding: Decimal = Decimal("0.00")

    lifecycle_stage: str = Field("Customer", max_length=30)  # Lead | Prospect | Customer | VIP
    account_status: str = Field("Active", max_length=20)      # Active | Inactive | Blocked
    status: str = Field("Active", max_length=20)

    created_date: date = Field(default_factory=date.today)
    tags: List[str] = []
    custom_attributes: Dict[str, Any] = {}

    # Legacy Backward-Compatibility Address Details
    billing_address_line1: Optional[str] = Field(None, max_length=255)
    billing_address_line2: Optional[str] = Field(None, max_length=255)
    billing_city: Optional[str] = Field(None, max_length=100)
    billing_state: Optional[str] = Field(None, max_length=100)
    billing_country: Optional[str] = Field("India", max_length=100)
    billing_pincode: Optional[str] = Field(None, max_length=10)
    shipping_same_as_billing: Optional[bool] = True
    shipping_address_line1: Optional[str] = Field(None, max_length=255)
    shipping_address_line2: Optional[str] = Field(None, max_length=255)
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=100)
    shipping_country: Optional[str] = Field(None, max_length=100)
    shipping_pincode: Optional[str] = Field(None, max_length=10)
    additional_addresses: List[dict] = []

    # SCDM billing policy for modern-trade customers.
    billing_policy: str = "InvoiceOnDispatch"

    @field_validator("gst_number")
    @classmethod
    def validate_legacy_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v_clean = v.strip().upper()
            if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", v_clean):
                raise ValueError("SMRITI-VAL-031: Invalid Statutory 15-character GSTIN format")
            return v_clean
        return v


class CustomerCreate(CustomerBase):
    id: Optional[str] = Field(None, max_length=50)

    # Optional initial nested child sub-entities
    tax_profile: Optional[CustomerTaxProfileCreate] = None
    credit_profile: Optional[CustomerCreditProfileCreate] = None
    addresses: List[CustomerAddressCreate] = []
    contacts: List[CustomerContactCreate] = []
    channel_preferences: List[CustomerChannelPreferenceCreate] = []


class CustomerUpdate(BaseModel):
    customer_group_id: Optional[str] = None
    pricing_group_id: Optional[str] = None
    customer_type_id: Optional[str] = None
    territory_id: Optional[str] = None
    route_id: Optional[str] = None
    preferred_language_id: Optional[str] = None
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    outstanding: Optional[Decimal] = None
    lifecycle_stage: Optional[str] = None
    account_status: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_attributes: Optional[Dict[str, Any]] = None
    billing_policy: Optional[str] = None

    # Legacy Backward-Compatibility Address Fields
    billing_address_line1: Optional[str] = None
    billing_address_line2: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_country: Optional[str] = None
    billing_pincode: Optional[str] = None
    shipping_same_as_billing: Optional[bool] = None
    shipping_address_line1: Optional[str] = None
    shipping_address_line2: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_country: Optional[str] = None
    shipping_pincode: Optional[str] = None
    additional_addresses: Optional[List[dict]] = None

    tax_profile: Optional[CustomerTaxProfileCreate] = None
    credit_profile: Optional[CustomerCreditProfileCreate] = None


class CustomerResponse(CustomerBase):
    id: str
    code: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    version: int
    loyalty_tier: str
    loyalty_points_balance: Decimal
    lifetime_points: Decimal
    billing_policy: str

    created_at: datetime
    modified_at: datetime
    is_active: bool
    is_deleted: bool

    # Decomposed Sub-Entities
    tax_profile: Optional[CustomerTaxProfileResponse] = None
    credit_profile: Optional[CustomerCreditProfileResponse] = None
    addresses: List[CustomerAddressResponse] = []
    contacts: List[CustomerContactResponse] = []
    channel_preferences: List[CustomerChannelPreferenceResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Milestone 3 CRM Pipeline Schemas (Task C-1 to C-5)
# ---------------------------------------------------------------------------

class LeadCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    company_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    mobile: Optional[str] = Field(None, max_length=20)
    lead_source: str = Field("Website", max_length=50)
    status: str = Field("NEW", max_length=30)
    assigned_to: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class LeadResponse(LeadCreate):
    id: str
    lead_no: str
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OpportunityCreate(BaseModel):
    name: str = Field(..., max_length=255)
    lead_id: Optional[str] = Field(None, max_length=50)
    customer_id: Optional[str] = Field(None, max_length=50)
    stage: str = Field("PROSPECTING", max_length=50)
    probability_percent: Decimal = Field(Decimal("10.00"), ge=Decimal("0.00"), le=Decimal("100.00"))
    expected_revenue: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    expected_close_date: Optional[date] = None
    assigned_to: Optional[str] = Field(None, max_length=50)


class OpportunityResponse(OpportunityCreate):
    id: str
    opp_no: str
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class CampaignCreate(BaseModel):
    name: str = Field(..., max_length=255)
    campaign_type: str = Field("EMAIL", max_length=50)
    status: str = Field("PLANNING", max_length=30)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    actual_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))


class CampaignResponse(CampaignCreate):
    id: str
    campaign_no: str
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TicketCommentCreate(BaseModel):
    comment_text: str = Field(..., min_length=1)
    is_internal: bool = False


class TicketCommentResponse(TicketCommentCreate):
    id: str
    ticket_id: str
    author_name: str
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SupportTicketCreate(BaseModel):
    customer_id: str = Field(..., max_length=50)
    subject: str = Field(..., max_length=255)
    category: str = Field("PRODUCT", max_length=50)
    priority: str = Field("MEDIUM", max_length=20)
    assigned_to: Optional[str] = Field(None, max_length=50)


class SupportTicketResponse(SupportTicketCreate):
    id: str
    ticket_no: str
    status: str
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    comments: List[TicketCommentResponse] = []
    model_config = ConfigDict(from_attributes=True)


class CustomerActivityCreate(BaseModel):
    customer_id: Optional[str] = Field(None, max_length=50)
    lead_id: Optional[str] = Field(None, max_length=50)
    activity_type: str = Field(..., max_length=50)
    summary: str = Field(..., max_length=255)
    details: Optional[str] = None
    activity_date: Optional[datetime] = Field(default_factory=datetime.utcnow)


class CustomerActivityResponse(CustomerActivityCreate):
    id: str
    company_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

