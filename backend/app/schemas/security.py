"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class MenuPermissionAction(BaseModel):
    resource: str
    action: str
    allowed: bool = True

class SubjectMenuAccessRequest(BaseModel):
    subject_type: str = Field(..., description="'User' | 'Group' | 'Node'")
    subject_id: str = Field(..., description="ID of the user, group, or node")
    company_code: Optional[str] = "All"
    permissions: List[MenuPermissionAction] = Field(default_factory=list)

class SubjectMenuAccessResponse(BaseModel):
    subject_type: str
    subject_id: str
    company_code: Optional[str] = "All"
    permissions: List[MenuPermissionAction] = Field(default_factory=list)

class PasswordConfigSchema(BaseModel):
    max_password_length: int = 50
    min_password_length: int = 6
    min_uppercase: int = 1
    min_lowercase: int = 1
    min_numeric: int = 2
    passwords_to_remember: int = 5
    password_resetting_days: int = 60
    max_invalid_attempts: int = 5

class HousekeepingConfigSchema(BaseModel):
    days_to_retain_activity_log: int = 0
    country_code: str = "+91"
    remind_patch_updation_days: int = 7
    activate_company_wise_restrictions: bool = True
    custom_reports_in_menu_screen: int = 0
    custom_reports_refresh_interval_seconds: int = 0

class SecurityConfigResponse(BaseModel):
    password_config: PasswordConfigSchema
    housekeeping_config: HousekeepingConfigSchema
