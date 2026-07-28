"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-11
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

tenant.py — Company and Branch ORM Models.
ADR-015: Extended with Foundation Platform v3.0 additive fields (AOP-004).
"""


import uuid as uuid_pkg
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, SmallInteger, Date, ForeignKey
from sqlalchemy.orm import relationship
from ..db.base import Base

class Company(Base):
    __tablename__ = "companies"

    id          = Column(String(50), primary_key=True)
    uuid        = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    tenant_id   = Column(String(50), nullable=True, index=True)
    name        = Column(String(255), nullable=False)
    gst_number  = Column(String(15), nullable=True)
    is_active   = Column(Boolean, default=True)
    is_deleted  = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), default=datetime.utcnow)
    modified_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # ADR-015 Additive Extensions (AOP-004 — no existing column altered)
    organization_id         = Column(String(50), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    company_code            = Column(String(20), nullable=True, unique=True)
    legal_name              = Column(String(255), nullable=True)
    short_name              = Column(String(50), nullable=True)
    company_type            = Column(String(30), nullable=True, default="PRIVATE_LTD")
    # PROPRIETORSHIP|PARTNERSHIP|LLP|PRIVATE_LTD|PUBLIC_LTD|OPC|TRUST|NGO
    industry_type           = Column(String(50), nullable=True, default="RETAIL")
    is_default              = Column(Boolean, nullable=False, default=False)
    is_gst_registered       = Column(Boolean, nullable=False, default=False)
    incorporation_date      = Column(Date, nullable=True)
    fiscal_year_start_month = Column(SmallInteger, nullable=True, default=4)  # 4 = April
    currency_code           = Column(String(3), nullable=True, default="INR")
    country_code            = Column(String(2), nullable=True, default="IN")
    timezone                = Column(String(50), nullable=True, default="Asia/Kolkata")
    language_code           = Column(String(10), nullable=True, default="en-IN")
    description             = Column(String(1000), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="companies")

class Branch(Base):
    __tablename__ = "branches"

    id          = Column(String(50), primary_key=True)
    uuid        = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    tenant_id   = Column(String(50), nullable=True, index=True)
    company_id  = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    code        = Column(String(50), nullable=False, unique=True)
    is_active   = Column(Boolean, default=True)
    is_deleted  = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), default=datetime.utcnow)
    modified_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # ADR-015 Additive Extensions (AOP-004)
    branch_type    = Column(String(30), nullable=True, default="RETAIL")
    # RETAIL|WHOLESALE|WAREHOUSE|HQ|FRANCHISE
    gstin          = Column(String(15), nullable=True)
    phone          = Column(String(20), nullable=True)
    email          = Column(String(255), nullable=True)
    manager_user_id = Column(String(50), nullable=True)

    # Relationships
    company = relationship("Company", backref="branches")

