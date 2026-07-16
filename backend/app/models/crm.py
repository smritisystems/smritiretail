"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.7.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
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

    customer_group_id = Column(String(50), ForeignKey("customer_groups.id", ondelete="RESTRICT"), index=True)
    name = Column(String(255), nullable=False)
    mobile = Column(String(20), index=True)
    email = Column(String(255))
    gst_number = Column(String(15))
    outstanding = Column(Numeric(15, 2), default=0.00)
    status = Column(String(20), default="Active")
    created_date = Column(Date, default=datetime.utcnow)
    tags = Column(ARRAY(String), server_default="{}")

    # Relationships
    group = relationship("CustomerGroup", back_populates="customers")
