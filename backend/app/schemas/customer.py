"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 30.0.0
Created      : 2026-07-22
Modified     : 2026-07-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for Customer Workspace Portal
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class LicenseDetailSchema(BaseModel):
    license_key: str
    edition: str  # "COMMUNITY", "PROFESSIONAL", "ENTERPRISE"
    status: str   # "ACTIVE", "SUSPENDED", "EXPIRED"
    tenant_id: str
    activation_date: str
    expiry_date: str
    max_stores: int
    max_warehouses: int
    max_pos_terminals: int
    enabled_modules: List[str]
    feature_flags: List[str]
    current_usage: Dict[str, int]


class BackupSnapshotSchema(BaseModel):
    snapshot_id: str
    backup_type: str  # "MANUAL", "SCHEDULED"
    timestamp: str
    size_mb: float
    verification_status: str  # "PASSED", "VERIFYING", "FAILED"
    download_url: str
    retention_days: int = 30


class TicketCreateSchema(BaseModel):
    subject: str
    category: str  # "POS_BILLING", "WMS_INVENTORY", "GST_COMPLIANCE", "HARDWARE"
    priority: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    description: str


class TicketStatusUpdateSchema(BaseModel):
    ticket_id: str
    status: str  # "NEW", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"
    comment: Optional[str] = None


class OrganizationProfileSchema(BaseModel):
    organization_name: str
    tenant_id: str
    contact_email: str
    contact_phone: str
    stores_count: int
    active_subscription_plan: str
    next_billing_date: str
