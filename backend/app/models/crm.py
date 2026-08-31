"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-07-11
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, date
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Date, DateTime, Text
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

    customer_group_id = Column(String(50), ForeignKey("customer_groups.id", ondelete="RESTRICT"), index=True)
    code = Column(String(50), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    mobile = Column(String(20), index=True)
    email = Column(String(255))
    gst_number = Column(String(15))
    outstanding = Column(Numeric(15, 2), default=0.00)
    status = Column(String(20), default="Active")
    created_date = Column(Date, default=date.today)
    tags = Column(ARRAY(String), server_default="{}")

    # Relationships
    group = relationship("CustomerGroup", back_populates="customers")


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
