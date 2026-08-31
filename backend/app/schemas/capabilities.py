"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.41.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class PlatformCapabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    category: str
    description: Optional[str] = None
    dependencies: List[str] = Field(default_factory=list)
    is_core: bool = False
    default_enabled: bool = True
    min_version: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    is_active: bool = True


class CapabilityValidationRequest(BaseModel):
    capabilities: List[str] = Field(..., description="List of capability codes to validate")


class CapabilityValidationResponse(BaseModel):
    is_valid: bool
    dependency_errors: List[str]
    valid_count: int


class PlanTierResponse(BaseModel):
    tier: str
    name: str
    description: str
    included_capabilities: List[str]


class PlanResolutionRequest(BaseModel):
    plan_tier: str = Field("ENTERPRISE", description="BASIC, PROFESSIONAL, or ENTERPRISE")
    tenant_overrides: Optional[Dict[str, bool]] = Field(default_factory=dict)


class TenantEffectiveCapabilitiesResponse(BaseModel):
    plan_tier: str
    active_capabilities: List[str]
    total_active: int
    overrides_applied: Dict[str, bool]
    is_valid: bool
    dependency_errors: List[str] = Field(default_factory=list)


class TenantCapabilityBindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    capability_code: str
    is_enabled: bool
    plan_tier: Optional[str] = None
    status: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    activated_at: Optional[datetime] = None


class TenantCapabilityToggleRequest(BaseModel):
    capability_code: str
    enable: bool
    force: bool = False


class FeatureFlagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    is_global_enabled: bool
    is_enabled_for_company: bool = False


class FeatureFlagToggleRequest(BaseModel):
    enable: bool


class ModuleStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    module_uuid: str
    tenant_id: str
    state: str
    version: Optional[str] = None
    is_critical: bool = False
    updated_at: Optional[datetime] = None
