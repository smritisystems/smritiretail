"""
Project      : SMRITI Retail OS
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

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, Text, ForeignKey, Date, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity, RowSecuredMixin


class CustomerGroup(RowSecuredMixin, BaseEntity):
    """
    Classifies customers for reporting, credit policy, marketing, and business
    segmentation. Answers: "What TYPE of customer is this?"

    Examples: Retailer | Distributor | Corporate | Government | VIP | Employee
    """
    __tablename__ = "customer_groups"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
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


class PricingGroup(RowSecuredMixin, BaseEntity):
    """
    Controls COMMERCIAL PRICING STRATEGY for customers.
    Answers: "Which price list or discount policy applies to this customer?"
    """
    __tablename__ = "pricing_groups"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    base_price_field = Column(String(30), default="price")
    discount_percent = Column(Numeric(5, 2), default=0.00)
    price_adjustment = Column(Numeric(15, 2), default=0.00)
    rounding_rule = Column(String(30), default="Nearest1")
    max_additional_discount_percent = Column(Numeric(5, 2), default=0.00)
    tax_inclusive = Column(Boolean, default=True)
    scheme_eligible = Column(Boolean, default=True)
    quantity_break_eligible = Column(Boolean, default=False)
    min_order_value = Column(Numeric(15, 2), default=0.00)

    # Relationships
    customers = relationship("Customer", back_populates="pricing_group")


class Customer(RowSecuredMixin, BaseEntity):
    """
    Customer Aggregate Root (v5.3.0 DDD Architecture Standard)
    Governs child entities: CustomerAddress, CustomerContact, CustomerCreditProfile,
    CustomerTaxProfile, CustomerCommunicationPreference.
    """
    __tablename__ = "customers"

    # Human-readable auto-generated identifier (e.g. CUS-100001)
    code = Column(String(50), nullable=False, index=True)

    # Relationships to masters
    customer_group_id = Column(String(50), ForeignKey("customer_groups.id", ondelete="RESTRICT"), index=True, nullable=True)
    pricing_group_id = Column(String(50), ForeignKey("pricing_groups.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_type_id = Column(String(50), index=True, nullable=True)  # Master: customer_type
    territory_id = Column(String(50), index=True, nullable=True)      # Master: customer_territory
    route_id = Column(String(50), index=True, nullable=True)          # Master: customer_route
    preferred_language_id = Column(String(50), nullable=True)         # Master: customer_language

    name = Column(String(255), nullable=False, index=True)
    mobile = Column(String(20), index=True, nullable=True)
    email = Column(String(255), nullable=True)
    gst_number = Column(String(15), nullable=True)
    outstanding = Column(Numeric(15, 2), default=0.00)

    # Status & Lifecycle
    lifecycle_stage = Column(String(30), default="Customer", nullable=False)  # Lead | Prospect | Customer | VIP
    account_status = Column(String(20), default="Active", nullable=False)      # Active | Inactive | Blocked
    status = Column(String(20), default="Active")                             # Legacy backward-compatibility status
    created_date = Column(Date, default=datetime.utcnow)
    tags = Column(ARRAY(String), server_default="{}")

    # Optimistic Concurrency Control
    version = Column(Integer, default=1, nullable=False)

    # Loyalty Cache Summary
    loyalty_tier = Column(String(30), default="Bronze")
    loyalty_points_balance = Column(Numeric(15, 2), default=0.00)
    lifetime_points = Column(Numeric(15, 2), default=0.00)

    # Extensible JSONB custom attributes (Zero-migration tenant schema extension)
    custom_attributes = Column(JSONB, server_default="'{}'::jsonb", default=dict)

    # Legacy Backward-Compatibility Address Columns (Deprecated in v5.3.0 in favor of CustomerAddress)
    billing_address_line1 = Column(String(255), nullable=True)
    billing_address_line2 = Column(String(255), nullable=True)
    billing_city = Column(String(100), nullable=True)
    billing_state = Column(String(100), nullable=True)
    billing_country = Column(String(100), default="India", nullable=True)
    billing_pincode = Column(String(10), nullable=True)
    shipping_same_as_billing = Column(Boolean, default=True, nullable=True)
    shipping_address_line1 = Column(String(255), nullable=True)
    shipping_address_line2 = Column(String(255), nullable=True)
    shipping_city = Column(String(100), nullable=True)
    shipping_state = Column(String(100), nullable=True)
    shipping_country = Column(String(100), nullable=True)
    shipping_pincode = Column(String(10), nullable=True)
    additional_addresses = Column(JSONB, server_default="'[]'::jsonb", default=list)

    # Relationships
    group = relationship("CustomerGroup", back_populates="customers")
    pricing_group = relationship("PricingGroup", back_populates="customers")

    # Decomposed Child Entity Relationships (DDD Aggregate Boundaries)
    addresses = relationship("CustomerAddress", back_populates="customer", cascade="all, delete-orphan")
    contacts = relationship("CustomerContact", back_populates="customer", cascade="all, delete-orphan")
    credit_profile = relationship("CustomerCreditProfile", uselist=False, back_populates="customer", cascade="all, delete-orphan")
    tax_profile = relationship("CustomerTaxProfile", uselist=False, back_populates="customer", cascade="all, delete-orphan")
    channel_preferences = relationship("CustomerCommunicationPreference", back_populates="customer", cascade="all, delete-orphan")


class CustomerAddress(RowSecuredMixin, BaseEntity):
    """
    Normalized multi-location customer addresses (1:N Sub-Entity)
    """
    __tablename__ = "customer_addresses"

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    address_type_id = Column(String(50), nullable=False)  # Master: customer_address_type (Billing, Shipping, Warehouse, etc.)

    house_no = Column(String(100), nullable=True)
    building_name = Column(String(150), nullable=True)
    street = Column(String(255), nullable=True)
    area = Column(String(150), nullable=True)
    landmark = Column(String(150), nullable=True)
    city = Column(String(100), nullable=False)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=False)
    country = Column(String(100), default="India", nullable=False)
    pincode = Column(String(10), nullable=False)

    is_primary = Column(Boolean, default=False, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="addresses")


class CustomerContact(RowSecuredMixin, BaseEntity):
    """
    B2B Representative & Multi-Contact Person Table (1:N Sub-Entity)
    """
    __tablename__ = "customer_contacts"

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_type_id = Column(String(50), nullable=False)  # Master: customer_contact_type (Owner, Accounts, Purchase, etc.)

    name = Column(String(150), nullable=False)
    designation = Column(String(100), nullable=True)
    mobile = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="contacts")


class CustomerCreditProfile(RowSecuredMixin, BaseEntity):
    """
    Encapsulates financial credit rules and ledger opening balance (1:1 Sub-Entity)
    """
    __tablename__ = "customer_credit_profiles"

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    credit_limit = Column(Numeric(15, 2), default=0.00, nullable=False)
    credit_days = Column(Integer, default=0, nullable=False)
    block_sales_on_limit = Column(Boolean, default=True, nullable=False)
    allow_override = Column(Boolean, default=False, nullable=False)

    opening_balance = Column(Numeric(15, 2), default=0.00, nullable=False)
    opening_balance_type = Column(String(10), default="Dr", nullable=False)  # "Dr" | "Cr"
    credit_hold_reason_id = Column(String(50), nullable=True)                 # Master: credit_hold_reason

    # Relationships
    customer = relationship("Customer", back_populates="credit_profile")


class CustomerTaxProfile(RowSecuredMixin, BaseEntity):
    """
    Encapsulates statutory Indian compliance & tax registration identifiers (1:1 Sub-Entity)
    """
    __tablename__ = "customer_tax_profiles"

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    gstin = Column(String(15), nullable=True, index=True)
    gst_registration_type_id = Column(String(50), nullable=True)  # Master: gst_registration_type (Regular, Composition, etc.)
    pan_number = Column(String(10), nullable=True, index=True)
    aadhaar_number = Column(String(12), nullable=True)
    msme_number = Column(String(30), nullable=True)
    fssai_license_no = Column(String(30), nullable=True)
    drug_license_no = Column(String(30), nullable=True)

    is_gst_exempt = Column(Boolean, default=False, nullable=False)
    is_tds_applicable = Column(Boolean, default=False, nullable=False)
    is_tcs_applicable = Column(Boolean, default=False, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="tax_profile")


class CustomerCommunicationPreference(RowSecuredMixin, BaseEntity):
    """
    Multi-channel invoice and alert preferences (1:N Sub-Entity)
    """
    __tablename__ = "customer_channel_preferences"

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_type_id = Column(String(50), nullable=False)  # Master: customer_channel_type (WhatsApp, SMS, Email, Print, E-Invoice)

    is_enabled = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=1, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="channel_preferences")
