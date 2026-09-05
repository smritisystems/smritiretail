"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-07-11
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, date
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, DateTime, Text, UniqueConstraint, Index, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity


class CustomerGroup(BaseEntity):
    __tablename__ = "customer_groups"

    name = Column(String(100), nullable=False, unique=True)
    credit_limit = Column(Numeric(15, 2), default=0.00)
    unlimited_credit = Column(Boolean, default=False)
    credit_days = Column(Integer, default=0)
    grace_days = Column(Integer, default=0)
    credit_hold = Column(Boolean, default=False)
    auto_block_sales = Column(Boolean, default=True)
    warning_threshold_percent = Column(Numeric(5, 2), default=80.00)
    allow_override = Column(Boolean, default=False)
    tax_inclusive = Column(Boolean, default=True)
    max_discount_percent = Column(Numeric(5, 2), default=0.00)
    min_margin_percent = Column(Numeric(5, 2), default=0.00)
    rounding_rule = Column(String(30), default="Nearest1")
    allowed_payment_methods = Column(ARRAY(String), server_default="{}")
    preferred_payment_method = Column(String(50))
    allow_back_orders = Column(Boolean, default=False)
    allow_negative_stock_sales = Column(Boolean, default=False)
    require_po_number = Column(Boolean, default=False)
    invoice_language = Column(String(10), default="en")
    can_view_price = Column(Boolean, default=True)
    can_view_margin = Column(Boolean, default=False)
    can_purchase_on_credit = Column(Boolean, default=False)
    can_receive_discount = Column(Boolean, default=True)

    # Relationships
    customers = relationship("Customer", back_populates="group")


class Customer(BaseEntity):
    __tablename__ = "customers"

    __table_args__ = (
        Index(
            "uq_customers_company_code_active",
            "company_id", "code",
            unique=True,
            postgresql_where=text("code IS NOT NULL AND status = 'Active' AND is_deleted = false"),
        ),
    )

    customer_group_id = Column(String(50), ForeignKey("customer_groups.id", ondelete="RESTRICT"), index=True)
    code = Column(String(50), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    mobile = Column(String(20), index=True)
    email = Column(String(255))
    # Legacy primary GSTIN (backward-compat). Authoritative multi-state GSTINs
    # are in CustomerGSTRegistration. Kept in sync with the primary registration
    # row by the service layer.
    gst_number = Column(String(15))
    outstanding = Column(Numeric(15, 2), default=0.00)
    status = Column(String(20), default="Active")
    created_date = Column(Date, default=date.today)
    tags = Column(ARRAY(String), server_default="{}")

    # Relationships
    group = relationship("CustomerGroup", back_populates="customers", lazy="selectin")
    gst_registrations = relationship(
        "CustomerGSTRegistration",
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="CustomerGSTRegistration.is_primary.desc()",
    )
    delivery_locations = relationship(
        "CustomerDeliveryLocation",
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="CustomerDeliveryLocation.store_code",
    )
    billing_locations = relationship(
        "CustomerBillingLocation",
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="CustomerBillingLocation.billing_store_code",
    )
    external_identities = relationship(
        "CustomerExternalIdentity",
        back_populates="customer",
        cascade="all, delete-orphan",
    )



class CustomerGSTRegistration(BaseEntity):
    """
    Multi-state GST Registration for a Corporate Customer.

    Each row represents ONE valid GSTIN for the customer in a specific state.
    A single corporate entity (e.g., Reliance Retail Limited) may hold registrations
    across 25+ states; each state registration is a distinct row here.

    Uniqueness: (customer_id, gstin) — one GSTIN per customer, enforced at DB level.
    The is_primary flag nominates the fallback billing GSTIN for contexts that
    do not specify a delivery location (e.g., advance receipt, CASH invoice).

    Immutability: Once a GSTIN row is referenced by a SalesInvoice (via
    billed_party_gstin_id or delivery_gstin_snapshot), it MUST NOT be hard-deleted.
    Use status='CANCELLED' / 'SURRENDERED' for deactivation.
    """
    __tablename__ = "customer_gst_registrations"
    __table_args__ = (
        UniqueConstraint("customer_id", "gstin", name="uq_cust_gst_reg_customer_gstin"),
        Index(
            "uq_cust_gst_reg_primary_per_customer",
            "customer_id",
            unique=True,
            postgresql_where=text("is_primary = true AND is_deleted = false"),
        ),
    )

    customer_id = Column(
        String(50), ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    gstin = Column(String(15), nullable=False, index=True)
    state_name = Column(String(100), nullable=False)          # e.g. 'Maharashtra'
    state_code = Column(String(2), nullable=False)            # e.g. '27'
    # REGULAR, COMPOSITION, SEZ_WITH_TAX, SEZ_WITHOUT_TAX, UIN, EMBASSY
    registration_type = Column(String(30), nullable=False, default="REGULAR")
    is_primary = Column(Boolean, nullable=False, default=False)  # Primary billing GSTIN
    status = Column(String(20), nullable=False, default="ACTIVE")  # ACTIVE, CANCELLED, SURRENDERED
    remarks = Column(Text, nullable=True)
    metadata_json = Column(JSONB, nullable=True)              # spare extensible fields

    # Relationships
    customer = relationship("Customer", back_populates="gst_registrations")
    delivery_locations = relationship(
        "CustomerDeliveryLocation",
        back_populates="gst_registration",
        foreign_keys="CustomerDeliveryLocation.gst_registration_id",
    )


class CustomerDeliveryLocation(BaseEntity):
    """
    Physical Delivery Location / Store of a Corporate Customer.

    Replaces the legacy 'CustomerAddress' phantom entity that was referenced
    in dispatch_import.py but never implemented. This is the canonical entity
    for Customer Delivery Locations with Store Codes.

    Key Constraints:
    - store_code is String (NOT Integer) — RIL codes include alphanumeric values
      such as 'T97D', 'TFW4', 'TYAC' in addition to numeric codes like '1888'.
    - Uniqueness: (customer_id, store_code) per active location.
    - gst_registration_id FK is nullable (SET NULL) to allow location records
      to survive GST registration soft-deletes.
    - Hard deletes are PROHIBITED once the location is referenced by a SalesInvoice.
      Use status='INACTIVE' for deactivation.

    Immutability: SalesInvoice snapshots (delivery_store_code, delivery_location_snapshot,
    delivery_gstin) are written at invoice creation time and are never updated.
    The FK delivery_location_id on SalesInvoice uses SET NULL so invoice history
    remains intact even if this record is soft-deleted.
    """
    __tablename__ = "customer_delivery_locations"
    __table_args__ = (
        # Partial unique index: one active location per (customer, store_code).
        # Inactive or soft-deleted locations are excluded so a store code can be reactivated.
        Index(
            "uq_cdl_customer_store_code_active",
            "customer_id", "store_code",
            unique=True,
            postgresql_where=text("status = 'ACTIVE' AND is_deleted = false"),
        ),
        Index(
            "uq_cdl_customer_default",
            "customer_id",
            unique=True,
            postgresql_where=text("is_default = true AND status = 'ACTIVE' AND is_deleted = false"),
        ),
    )

    customer_id = Column(
        String(50), ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    # Store Code: STRING (alphanumeric). Examples: '1888', 'T97D', 'TFW4', 'TYAC'
    store_code = Column(String(50), nullable=False, index=True)
    location_name = Column(String(255), nullable=False)       # Store / Site name
    address_line1 = Column(Text, nullable=True)
    address_line2 = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    state_code = Column(String(2), nullable=True)             # '27', '06', etc.
    pincode = Column(String(10), nullable=True)
    country = Column(String(100), nullable=False, default="India")
    # FK to this location's GST registration (if any)
    gst_registration_id = Column(
        String(50),
        ForeignKey("customer_gst_registrations.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    # Denormalized GSTIN for quick access without JOIN (kept in sync with gst_registration)
    gstin = Column(String(15), nullable=True)
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    # ACTIVE / INACTIVE — soft-delete only once referenced by invoice
    status = Column(String(20), nullable=False, default="ACTIVE")
    # Source / origin tag: MANUAL, DISPATCH_IMPORT, EXCEL_IMPORT, API
    source = Column(String(30), nullable=True, default="MANUAL")
    remarks = Column(Text, nullable=True)
    metadata_json = Column(JSONB, nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="delivery_locations")
    gst_registration = relationship(
        "CustomerGSTRegistration",
        back_populates="delivery_locations",
        foreign_keys=[gst_registration_id],
    )


class CustomerBillingLocation(BaseEntity):
    """
    Commercial / Billing Location of a Corporate Customer.

    Represents a specific commercial billing office, regional accounts branch,
    or corporate accounting center to which invoices and financial statements
    are routed. Each billing location carries a Billing Store Code (e.g. 'REL-HO-MUM')
    and holds the customer's canonical billing address.

    Uniqueness: (customer_id, billing_store_code) per active location.
    The is_default flag designates the fallback billing location for new transactions.
    """
    __tablename__ = "customer_billing_locations"
    __table_args__ = (
        Index(
            "uq_cbl_customer_store_code_active",
            "customer_id", "billing_store_code",
            unique=True,
            postgresql_where=text("status = 'ACTIVE' AND is_deleted = false"),
        ),
        Index(
            "uq_cbl_customer_default",
            "customer_id",
            unique=True,
            postgresql_where=text("is_default = true AND status = 'ACTIVE' AND is_deleted = false"),
        ),
    )

    customer_id = Column(
        String(50), ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    billing_store_code = Column(String(50), nullable=False, index=True)
    location_name = Column(String(255), nullable=False)       # e.g. "Reliance Corporate Accounts - Mumbai"
    address_line1 = Column(Text, nullable=False)
    address_line2 = Column(Text, nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    state_code = Column(String(2), nullable=False)             # '27', '06', etc.
    pincode = Column(String(10), nullable=False)
    country = Column(String(100), nullable=False, default="India")
    gst_registration_id = Column(
        String(50),
        ForeignKey("customer_gst_registrations.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    gstin = Column(String(15), nullable=True)
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    source = Column(String(30), nullable=True, default="MANUAL")
    remarks = Column(Text, nullable=True)
    metadata_json = Column(JSONB, nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="billing_locations")
    gst_registration = relationship(
        "CustomerGSTRegistration",
        foreign_keys=[gst_registration_id],
    )


class CustomerExternalIdentity(BaseEntity):
    """
    External ERP and software identity mapping for Customer.

    Allows a customer to be associated with external codes from external systems
    (e.g., SAP Customer Code '10004567', Oracle 'CUST-77881', Reliance EDI 'REL-001').

    Composite Uniqueness: (company_id, source_system, external_type, external_code)
    ensuring uniqueness per external system source within the tenant company.
    """
    __tablename__ = "customer_external_identities"
    __table_args__ = (
        Index(
            "uq_cust_ext_ident_composite",
            "company_id", "source_system", "external_type", "external_code",
            unique=True,
            postgresql_where=text("status = 'ACTIVE' AND is_deleted = false"),
        ),
    )

    customer_id = Column(
        String(50), ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    source_system = Column(String(50), nullable=False)       # SAP, ORACLE, TALLY, RELIANCE_EDI
    external_type = Column(String(50), nullable=False, default="CUSTOMER")  # CUSTOMER, ACCOUNT, VENDOR_REF
    external_code = Column(String(100), nullable=False)      # e.g. "10004567"
    status = Column(String(20), nullable=False, default="ACTIVE")
    metadata_json = Column(JSONB, nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="external_identities")


class CrmLead(BaseEntity):
    """SMRITI Commercial Growth Engine - Lead Master."""
    __tablename__ = "crm_leads"

    lead_no = Column(String(50), nullable=False, unique=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    company_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    mobile = Column(String(30), nullable=True, index=True)
    lead_source = Column(String(50), default="DIRECT")  # DIRECT, WEB, REFERRAL, CAMPAIGN, PARTNER, POS
    status = Column(String(30), default="NEW")  # NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST, DISQUALIFIED
    assigned_to = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)


class CrmOpportunity(BaseEntity):
    """SMRITI Commercial Growth Engine - Deal / Opportunity Pipeline."""
    __tablename__ = "crm_opportunities"

    opp_no = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    lead_id = Column(String(50), ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    stage = Column(String(50), default="PROSPECTING")  # PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
    probability_percent = Column(Numeric(5, 2), default=10.00)
    expected_revenue = Column(Numeric(15, 2), default=0.00)
    expected_close_date = Column(Date, nullable=True)
    assigned_to = Column(String(50), nullable=True)


class CrmCampaign(BaseEntity):
    """SMRITI Commercial Growth Engine - Marketing & Outreach Campaign."""
    __tablename__ = "crm_campaigns"

    campaign_no = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    campaign_type = Column(String(50), default="SMS")  # SMS, WHATSAPP, EMAIL, IN_STORE, DIGITAL
    status = Column(String(30), default="PLANNED")  # PLANNED, ACTIVE, COMPLETED, CANCELLED
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    budget = Column(Numeric(15, 2), default=0.00)
    actual_cost = Column(Numeric(15, 2), default=0.00)


class CrmCustomerActivity(BaseEntity):
    """Customer Touchpoint and Interaction Log (Call, Visit, WhatsApp, Note)."""
    __tablename__ = "crm_customer_activities"

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    lead_id = Column(String(50), ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=True, index=True)
    activity_type = Column(String(50), nullable=False)  # CALL, MEETING, EMAIL, WHATSAPP, NOTE, TASK
    summary = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    activity_date = Column(DateTime, default=datetime.utcnow)
