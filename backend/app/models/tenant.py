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
from sqlalchemy import Column, String, Boolean, DateTime, SmallInteger, Integer, Date, ForeignKey
from sqlalchemy.orm import relationship
from ..db.base import Base

from enum import Enum

class TenantLifecycleState(str, Enum):
    CREATED = "CREATED"
    PROVISIONING = "PROVISIONING"
    VALIDATING = "VALIDATING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    ARCHIVED = "ARCHIVED"
    DELETED = "DELETED"


class Tenant(Base):
    __tablename__ = "tenants"

    id              = Column(String(50), primary_key=True)
    uuid            = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    tenant_code     = Column(String(20), unique=True, nullable=False, index=True)
    tenant_slug     = Column(String(100), unique=True, nullable=False, index=True)
    name            = Column(String(255), nullable=False)
    lifecycle_state = Column(String(30), nullable=False, default=TenantLifecycleState.CREATED.value)
    is_active       = Column(Boolean, default=True)
    is_deleted      = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), default=datetime.utcnow)
    modified_at     = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    id                = Column(String(50), primary_key=True, default=lambda: f"tset-{uuid_pkg.uuid4().hex[:12]}")
    tenant_id         = Column(String(50), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    language_code     = Column(String(10), nullable=False, default="en-IN")
    locale            = Column(String(10), nullable=False, default="en-IN")
    currency_code     = Column(String(3), nullable=False, default="INR")
    timezone          = Column(String(50), nullable=False, default="Asia/Kolkata")
    date_format       = Column(String(20), nullable=False, default="DD/MM/YYYY")
    number_format     = Column(String(20), nullable=False, default="Indian")
    decimal_precision = Column(SmallInteger, nullable=False, default=2)
    ai_enabled        = Column(Boolean, nullable=False, default=True)
    sms_enabled       = Column(Boolean, nullable=False, default=True)
    email_enabled     = Column(Boolean, nullable=False, default=True)
    created_at        = Column(DateTime(timezone=True), default=datetime.utcnow)
    modified_at       = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class TenantProvisionProfile(Base):
    __tablename__ = "tenant_provision_profiles"

    id                    = Column(String(50), primary_key=True, default=lambda: f"tprof-{uuid_pkg.uuid4().hex[:12]}")
    tenant_id             = Column(String(50), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    setup_version         = Column(String(20), nullable=False, default="1.0.0")
    schema_version        = Column(String(20), nullable=False, default="3.1.0")
    platform_version      = Column(String(20), nullable=False, default="1.0.0")
    industry_pack         = Column(String(50), nullable=True)
    industry_pack_version = Column(String(20), nullable=False, default="1.0.0")
    installed_modules     = Column(String(1000), nullable=True)
    enabled_features      = Column(String(1000), nullable=True)
    license_tier          = Column(String(50), nullable=False, default="Enterprise")
    created_by            = Column(String(100), nullable=False, default="system")
    created_at            = Column(DateTime(timezone=True), default=datetime.utcnow)


class TenantProvisionJournal(Base):
    __tablename__ = "tenant_provision_journals"

    id          = Column(String(50), primary_key=True, default=lambda: f"tjr-{uuid_pkg.uuid4().hex[:12]}")
    tenant_id   = Column(String(50), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id    = Column(String(50), nullable=False, index=True)
    started_at  = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status      = Column(String(20), nullable=False, default="PASS")  # PASS, WARNING, FAIL, SKIPPED
    duration_ms = Column(SmallInteger, nullable=True, default=0)
    error_text  = Column(String(1000), nullable=True)
    attempt     = Column(SmallInteger, nullable=False, default=1)
    created_at  = Column(DateTime(timezone=True), default=datetime.utcnow)


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
    gs1_company_prefix      = Column(String(20), nullable=True)
    barcode_source          = Column(String(30), nullable=False, default="AUTO")  # AUTO | IMPORT | MANUAL
    barcode_counter         = Column(Integer, nullable=False, default=0)

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

