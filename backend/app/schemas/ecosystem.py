"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for Digital Platform Ecosystem
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class PortalMetadataSchema(BaseModel):
    id: str
    name: str
    route: str
    visibility: str  # "public" or "authenticated"
    icon: str
    required_license: List[str]
    enabled: bool


class CustomerDashboardSchema(BaseModel):
    customer_name: str
    active_licenses_count: int
    installed_extensions_count: int
    open_tickets_count: int
    learning_progress_pct: float
    recent_backups_count: int
    latest_update_version: str


class CourseSchema(BaseModel):
    course_code: str
    title: str
    category: str
    duration_minutes: int
    level: str
    modules_count: int
    certification_name: Optional[str] = None
