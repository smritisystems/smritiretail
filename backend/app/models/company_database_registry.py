"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime, timezone
import enum
from ..db.base import Base

class DatabaseStatus(str, enum.Enum):
    PROVISIONING = "PROVISIONING"
    READY = "READY"
    DEGRADED = "DEGRADED"
    SUSPENDED = "SUSPENDED"
    MIGRATING = "MIGRATING"
    ARCHIVED = "ARCHIVED"
    DECOMMISSIONED = "DECOMMISSIONED"

class CompanyDatabaseRegistry(Base):
    __tablename__ = "company_database_registries"

    company_id = Column(String(50), primary_key=True, index=True)
    database_id = Column(String(50), unique=True, nullable=False, index=True)
    database_name = Column(String(100), unique=True, nullable=False)
    database_engine = Column(String(50), default="postgresql")
    host_reference = Column(String(255), default="localhost")
    port_reference = Column(Integer, default=5432)
    status = Column(String(50), default="READY", nullable=False)
    schema_version = Column(String(50), default="3.16.0")
    region = Column(String(50), default="ap-south-1")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_health_check = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    provisioning_status = Column(String(50), default="COMPLETED")
    migration_status = Column(String(50), default="UP_TO_DATE")

