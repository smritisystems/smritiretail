"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Text, text, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity


class Party(BaseEntity):
    """
    Universal Party Master in SMRITI Tenant Data Plane (smritiXXX).
    Canonical identity for any legal, business, or operational entity:
    Customer, Supplier, Dealer, Distributor, Transporter, Employee, or Salesman.
    """
    __tablename__ = "parties"

    party_code = Column(String(50), nullable=False, unique=True, index=True)
    party_type = Column(String(30), nullable=False, default="ORGANIZATION")  # INDIVIDUAL, ORGANIZATION
    legal_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=True)
    gstin = Column(String(15), nullable=True, index=True)
    pan = Column(String(10), nullable=True, index=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True, index=True)
    mobile = Column(String(20), nullable=True, index=True)
    
    # Address details
    address_line1 = Column(Text, nullable=True)
    address_line2 = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    country = Column(String(100), nullable=False, default="India")
    
    # Status & metadata
    status = Column(String(30), nullable=False, default="ACTIVE")  # ACTIVE, INACTIVE, BLOCKED, SUSPENDED
    metadata_json = Column(JSONB, server_default=text("'{}'"), default=dict)
    tags = Column(ARRAY(String), server_default="{}")

    # Relationships
    roles = relationship("PartyRole", back_populates="party", cascade="all, delete-orphan")
    customer_profile = relationship("CustomerProfile", back_populates="party", uselist=False, cascade="all, delete-orphan")
    supplier_profile = relationship("SupplierProfile", back_populates="party", uselist=False, cascade="all, delete-orphan")


class PartyRole(BaseEntity):
    """
    Polymorphic role assignment for Universal Party.
    Enables a single party entity to act in multiple operational capacities simultaneously.
    """
    __tablename__ = "party_roles"
    __table_args__ = (
        UniqueConstraint("party_id", "role_type", name="uq_party_role_type"),
    )

    party_id = Column(String(50), ForeignKey("parties.id", ondelete="CASCADE"), nullable=False, index=True)
    role_type = Column(String(30), nullable=False)  # CUSTOMER, SUPPLIER, DEALER, DISTRIBUTOR, EMPLOYEE, TRANSPORTER, SALESMAN
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    party = relationship("Party", back_populates="roles")


class CustomerProfile(BaseEntity):
    """
    Customer-specific operational profile linked to Universal Party identity.
    """
    __tablename__ = "customer_profiles"

    party_id = Column(String(50), ForeignKey("parties.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_group_id = Column(String(50), nullable=True, index=True)
    customer_category = Column(String(30), nullable=False, default="RETAIL")  # RETAIL, WHOLESALE, INSTITUTIONAL
    credit_limit = Column(Numeric(15, 2), nullable=False, default=0.00)
    credit_days = Column(Integer, nullable=False, default=0)
    tax_category = Column(String(30), nullable=False, default="B2C")  # B2B, B2C, SEZ, EXPORT
    is_credit_hold = Column(Boolean, nullable=False, default=False)
    price_tier_id = Column(String(50), nullable=True)
    loyalty_tier_id = Column(String(50), nullable=True)
    outstanding_balance = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    party = relationship("Party", back_populates="customer_profile")


class SupplierProfile(BaseEntity):
    """
    Supplier-specific operational profile linked to Universal Party identity.
    """
    __tablename__ = "supplier_profiles"

    party_id = Column(String(50), ForeignKey("parties.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    supplier_type = Column(String(30), nullable=False, default="DISTRIBUTOR")  # MANUFACTURER, DISTRIBUTOR, IMPORTER, TRADER
    payment_terms_days = Column(Integer, nullable=False, default=30)
    msme_registration_no = Column(String(50), nullable=True)
    tax_treatment = Column(String(30), nullable=False, default="REGISTERED_REGULAR")  # REGISTERED_REGULAR, COMPOSITION, UNREGISTERED
    outstanding_liability = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    party = relationship("Party", back_populates="supplier_profile")
