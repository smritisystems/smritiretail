"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from backend.app.models.company_database_registry import DatabaseStatus

class CompanyDatabaseRegistryBase(BaseModel):
    company_id: str
    database_id: str
    database_name: str
    database_engine: str = "postgresql"
    host_reference: str = "localhost"
    port_reference: int = 5432
    status: DatabaseStatus = DatabaseStatus.READY
    schema_version: str = "3.16.0"
    region: str = "ap-south-1"

class CompanyDatabaseRegistryResponse(CompanyDatabaseRegistryBase):
    created_at: datetime
    updated_at: datetime
    last_health_check: datetime
    provisioning_status: str
    migration_status: str

    class Config:
        from_attributes = True
