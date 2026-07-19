"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity


class CustomerGroup(BaseEntity):
    """
    Classifies customers for reporting, credit policy, marketing, and business
    segmentation.  Answers: "What TYPE of customer is this?"

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


class PricingGroup(BaseEntity):
    """
    Controls COMMERCIAL PRICING STRATEGY for customers.
    Answers: "Which price list or discount policy applies to this customer?"

    A customer of group "Retailer" may still receive any PricingGroup:
      Retail Price | VIP Price | Promotional | Corporate Contract | Festival Price

    PricingGroup is kept intentionally separate from CustomerGroup so a single
    customer category can have multiple pricing strategies without losing its
    business classification.
    """
    __tablename__ = "pricing_groups"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    # --- Price list strategy ---
    # Base price field used as the selling price reference
    # Values: "mrp" | "cost_price" | "price" | "custom"
    base_price_field = Column(String(30), default="price")

    # Flat discount applied on top of base price (0.00 = no discount)
    discount_percent = Column(Numeric(5, 2), default=0.00)

    # Absolute price markup/markdown on base (positive = markup, negative = markdown)
    price_adjustment = Column(Numeric(15, 2), default=0.00)

    # Rounding rule for final selling price
    rounding_rule = Column(String(30), default="Nearest1")

    # Maximum additional discount a salesperson can give over group discount
    max_additional_discount_percent = Column(Numeric(5, 2), default=0.00)

    # Whether tax is included in the selling price
    tax_inclusive = Column(Boolean, default=True)

    # Whether this group is eligible for promotional schemes
    scheme_eligible = Column(Boolean, default=True)

    # Whether quantity-based break pricing applies
    quantity_break_eligible = Column(Boolean, default=False)

    # Minimum order value to qualify for this pricing group
    min_order_value = Column(Numeric(15, 2), default=0.00)

    # Relationships
    customers = relationship("Customer", back_populates="pricing_group")


class Customer(BaseEntity):
    __tablename__ = "customers"

    # Business classification — "What TYPE of customer is this?"
    customer_group_id = Column(String(50), ForeignKey("customer_groups.id", ondelete="RESTRICT"), index=True)

    # Commercial pricing strategy — "Which price list applies?"
    pricing_group_id = Column(String(50), ForeignKey("pricing_groups.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    mobile = Column(String(20), index=True)
    email = Column(String(255))
    gst_number = Column(String(15))
    outstanding = Column(Numeric(15, 2), default=0.00)
    status = Column(String(20), default="Active")
    created_date = Column(Date, default=datetime.utcnow)
    tags = Column(ARRAY(String), server_default="{}")

    # Address Details
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

