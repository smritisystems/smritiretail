"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ...services.capability_service import CapabilityService

router = APIRouter(prefix="/capabilities", tags=["Capability & Module Registry"])


class CapabilityValidationRequest(BaseModel):
    capabilities: List[str] = Field(..., description="List of capability codes to validate")


class CapabilityValidationResponse(BaseModel):
    is_valid: bool
    dependency_errors: List[str]
    valid_count: int


class PlanResolutionRequest(BaseModel):
    plan_tier: str = Field("ENTERPRISE", description="BASIC, PROFESSIONAL, or ENTERPRISE")
    tenant_overrides: Optional[Dict[str, bool]] = Field(default_factory=dict)


@router.get("/catalog")
async def get_capability_catalog():
    """
    Fetch the complete 26-capability catalog with dependency rules and categories.
    """
    capabilities = CapabilityService.get_all_capabilities()
    return {
        "count": len(capabilities),
        "capabilities": capabilities,
    }


@router.get("/plans")
async def get_plan_bundles():
    """
    Fetch standard plan subscription tiers and included capabilities.
    """
    return {
        "plans": CapabilityService.PLAN_TIER_CAPABILITIES
    }


@router.post("/validate", response_model=CapabilityValidationResponse)
async def validate_capabilities(req: CapabilityValidationRequest):
    """
    Validate proposed capability selections against strict dependency chains (fail closed).
    """
    is_valid, errors = CapabilityService.validate_capability_dependencies(req.capabilities)
    return CapabilityValidationResponse(
        is_valid=is_valid,
        dependency_errors=errors,
        valid_count=len(req.capabilities) if is_valid else 0
    )


@router.post("/resolve")
async def resolve_capabilities(req: PlanResolutionRequest):
    """
    Resolve effective capabilities for tenant given a plan tier and overrides.
    """
    return CapabilityService.resolve_effective_capabilities(
        plan_tier=req.plan_tier,
        tenant_overrides=req.tenant_overrides
    )
