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

from ...models.tenant import Company
from ...models.company_registry import CompanyDatabaseRegistry
from ...models.auth import User

# Canonical Model Aliases (Legacy Control Models Retired)
ControlCompany = Company
ControlCompanyDatabase = CompanyDatabaseRegistry
ControlUser = User


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
