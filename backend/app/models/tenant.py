"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid as uuid_pkg
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..db.base import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    gst_number = Column(String(15), nullable=True)
    company_code = Column(String(50), nullable=True, unique=True, index=True)
    identity_code = Column(String(100), nullable=True, unique=True, index=True)
    logo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Canonical Company Profile & Settings Extensions (v1537)
    legal_name = Column(String(255), nullable=True, index=True)
    trade_name = Column(String(255), nullable=True)
    business_type = Column(String(50), nullable=True, default="PRIVATE_LIMITED")
    pan = Column(String(10), nullable=True, index=True)
    cin = Column(String(25), nullable=True)
    address_line1 = Column(Text, nullable=True)
    address_line2 = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    state_code = Column(String(5), nullable=True)
    pincode = Column(String(10), nullable=True)
    country = Column(String(100), nullable=False, default="India")
    phone = Column(String(25), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    dispatch_email = Column(String(255), nullable=True)
    accounts_email = Column(String(255), nullable=True)
    contact_person = Column(String(150), nullable=True)
    print_logo_url = Column(String(500), nullable=True)
    signature_url = Column(String(500), nullable=True)
    stamp_url = Column(String(500), nullable=True)
    currency_code = Column(String(10), nullable=False, default="INR")
    timezone = Column(String(100), nullable=False, default="Asia/Kolkata")
    date_format = Column(String(30), nullable=False, default="DD/MM/YYYY")
    number_format = Column(String(30), nullable=False, default="INDIAN_LAKH_CRORE")

    # Relationships
    bank_accounts = relationship("CompanyBankAccount", backref="company", cascade="all, delete-orphan")

class Branch(Base):
    __tablename__ = "branches"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, unique=True)
    identity_code = Column(String(100), nullable=True, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Branch Location & Operational Extensions (v1537)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    state_code = Column(String(5), nullable=True)
    pincode = Column(String(10), nullable=True)
    gstin = Column(String(15), nullable=True)
    phone = Column(String(25), nullable=True)
    email = Column(String(255), nullable=True)

    # Relationships
    company = relationship("Company", backref="branches")
