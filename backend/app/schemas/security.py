"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from ..models.security import PermissionType


# ---------------------------------------------------------------------------
# SMRITIPermission Schemas
# ---------------------------------------------------------------------------
class SMRITIPermissionCreate(BaseModel):
    code: str
    resource: str
    action: str
    scope: str = "OWN_BRANCH"
    module: str
    description: Optional[str] = None


class SMRITIPermissionResponse(BaseModel):
    id: str
    uuid: str
    code: str
    resource: str
    action: str
    scope: str
    module: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SMRITIPolicy Schemas
# ---------------------------------------------------------------------------
class SMRITIPolicyCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class SMRITIPolicyResponse(BaseModel):
    id: str
    uuid: str
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SMRITIRole Schemas
# ---------------------------------------------------------------------------
class SMRITIRoleCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    parent_role_id: Optional[str] = None
    is_system_role: bool = False


class SMRITIRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_role_id: Optional[str] = None
    is_active: Optional[bool] = None


class SMRITIRoleResponse(BaseModel):
    id: str
    uuid: str
    code: str
    name: str
    description: Optional[str] = None
    parent_role_id: Optional[str] = None
    is_system_role: bool
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SMRITIRolePolicy Mapping Schemas
# ---------------------------------------------------------------------------
class SMRITIRolePolicyCreate(BaseModel):
    role_id: str
    policy_id: str


class SMRITIRolePolicyResponse(BaseModel):
    id: str
    role_id: str
    policy_id: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SMRITIPolicyPermission Mapping Schemas
# ---------------------------------------------------------------------------
class SMRITIPolicyPermissionCreate(BaseModel):
    policy_id: str
    permission_id: str
    permission_type: PermissionType = PermissionType.ALLOW


class SMRITIPolicyPermissionResponse(BaseModel):
    id: str
    policy_id: str
    permission_id: str
    permission_type: PermissionType

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SMRITIUserRole Mapping Schemas
# ---------------------------------------------------------------------------
class SMRITIUserRoleCreate(BaseModel):
    user_id: str
    role_id: str


class SMRITIUserRoleResponse(BaseModel):
    id: str
    user_id: str
    role_id: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SMRITIMenu Schemas
# ---------------------------------------------------------------------------
class SMRITIMenuCreate(BaseModel):
    parent_id: Optional[str] = None
    title: str
    route: Optional[str] = None
    icon: Optional[str] = None
    module: str
    permission: Optional[str] = None
    sequence: int = 0
    feature_flag: Optional[str] = None
    badge: Optional[str] = None


class SMRITIMenuResponse(BaseModel):
    id: str
    uuid: str
    parent_id: Optional[str] = None
    title: str
    route: Optional[str] = None
    icon: Optional[str] = None
    module: str
    permission: Optional[str] = None
    sequence: int
    feature_flag: Optional[str] = None
    badge: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# SMRITISecurityAudit Response Schema
# ---------------------------------------------------------------------------
class SMRITISecurityAuditResponse(BaseModel):
    id: str
    user_id: str
    username: str
    action: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    device_info: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Dynamic Authorization Check Schemas
# ---------------------------------------------------------------------------
class SecurityCheckRequest(BaseModel):
    permission: str
    resource: Optional[str] = None
    id: Optional[str] = None


class SecurityCheckResponse(BaseModel):
    allowed: bool
    reason: Optional[str] = None
