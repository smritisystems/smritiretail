"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid as uuid_pkg
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ...db.base import Base

class ControlCompany(Base):
    """
    ControlCompany — Central Company Master Registry in SmritiSys.
    """
    __tablename__ = "control_companies"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    company_code = Column(String(50), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=False)
    legal_name = Column(String(255), nullable=True)
    gstin = Column(String(15), nullable=True)
    pan = Column(String(10), nullable=True)
    currency = Column(String(10), default="INR")
    status = Column(String(30), nullable=False, default="ACTIVE") # ACTIVE, INACTIVE, SUSPENDED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ControlCompanyDatabase(Base):
    """
    ControlCompanyDatabase — Authoritative Database Registry & Routing Table in SmritiSys.
    """
    __tablename__ = "control_company_databases"

    id = Column(String(50), primary_key=True)
    company_id = Column(String(50), ForeignKey("control_companies.id", ondelete="CASCADE"), nullable=False)
    company_code = Column(String(50), nullable=False, unique=True, index=True)
    database_name = Column(String(100), nullable=False, unique=True)
    database_type = Column(String(30), nullable=False, default="POSTGRESQL")
    host = Column(String(255), nullable=False, default="localhost")
    port = Column(Integer, nullable=False, default=5432)
    db_user = Column(String(100), nullable=False, default="postgres")
    encrypted_credentials = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE") # ACTIVE, READ_ONLY, MAINTENANCE, ARCHIVED
    schema_version = Column(String(30), nullable=False, default="1.0.0")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_health_check = Column(DateTime(timezone=True), nullable=True)


class ControlUser(Base):
    """
    ControlUser — Central User Authentication Master in SmritiSys.
    """
    __tablename__ = "control_users"

    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
    username = Column(String(100), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role_code = Column(String(50), nullable=False, default="STAFF")
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    allowed_company_codes = Column(ARRAY(String), default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ControlPSVConfig(Base):
    """
    ControlPSVConfig — Company-level PSV Enablement Configuration in SmritiSys.
    """
    __tablename__ = "control_psv_configs"

    id = Column(String(50), primary_key=True)
    company_id = Column(String(50), ForeignKey("control_companies.id", ondelete="CASCADE"), nullable=False, unique=True)
    company_code = Column(String(50), nullable=False, unique=True)
    psv_enabled = Column(Boolean, nullable=False, default=False)
    psv_mode = Column(String(30), nullable=False, default="CENTRAL") # CENTRAL (shared SmritiPSV), DEDICATED (SmritiPSV_<Code>)
    psv_database_name = Column(String(100), nullable=False, default="SmritiPSV")
    tracked_customer_ids = Column(ARRAY(String), server_default="{}")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
