"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.41.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_company_db, get_current_user
from ...schemas.capabilities import (
    PlatformCapabilityResponse,
    CapabilityValidationRequest,
    CapabilityValidationResponse,
    PlanTierResponse,
    PlanResolutionRequest,
    TenantEffectiveCapabilitiesResponse,
    TenantCapabilityBindingResponse,
    TenantCapabilityToggleRequest,
    FeatureFlagResponse,
    FeatureFlagToggleRequest,
    ModuleStateResponse,
)
from ...services.capability_service import CapabilityService

router = APIRouter(prefix="/capabilities", tags=["Capability & Module Registry"])


@router.get("/catalog", response_model=Dict[str, Any])
async def get_capability_catalog(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Fetch the complete capability catalog with dependency rules, categories, and core flags.
    Queries the control plane database directly.
    """
    db_caps = await CapabilityService.get_db_capabilities(db)
    if db_caps:
        caps_data = [
            {
                "code": c.code,
                "name": c.name,
                "category": c.category,
                "description": c.description,
                "dependencies": c.dependencies or [],
                "is_core": c.is_core or False,
                "default_enabled": c.default_enabled if c.default_enabled is not None else True,
                "status": c.status or "ACTIVE",
            }
            for c in db_caps
        ]
    else:
        caps_data = CapabilityService.get_all_capabilities()

    return {
        "count": len(caps_data),
        "capabilities": caps_data,
    }


@router.get("/plans", response_model=Dict[str, Dict[str, List[str]]])
async def get_plan_bundles(
    current_user=Depends(get_current_user),
):
    """
    Fetch standard plan subscription tiers (BASIC, PROFESSIONAL, ENTERPRISE) and included capabilities.
    """
    return {
        "plans": CapabilityService.PLAN_TIER_CAPABILITIES
    }


@router.post("/validate", response_model=CapabilityValidationResponse)
async def validate_capabilities(
    req: CapabilityValidationRequest,
    current_user=Depends(get_current_user),
):
    """
    Validate proposed capability selections against strict dependency chains (fail closed).
    """
    is_valid, errors = CapabilityService.validate_capability_dependencies(req.capabilities)
    return CapabilityValidationResponse(
        is_valid=is_valid,
        dependency_errors=errors,
        valid_count=len(req.capabilities) if is_valid else 0,
    )


@router.post("/resolve", response_model=TenantEffectiveCapabilitiesResponse)
async def resolve_capabilities(
    req: PlanResolutionRequest,
    current_user=Depends(get_current_user),
):
    """
    Resolve effective capabilities for tenant given a plan tier and overrides with dependency check.
    """
    res = CapabilityService.resolve_effective_capabilities(
        plan_tier=req.plan_tier,
        tenant_overrides=req.tenant_overrides,
    )
    return TenantEffectiveCapabilitiesResponse(
        plan_tier=res["plan_tier"],
        active_capabilities=res["active_capabilities"],
        total_active=res["active_count"],
        overrides_applied=req.tenant_overrides or {},
        is_valid=res["is_valid"],
        dependency_errors=res["dependency_errors"],
    )


@router.get("/tenant", response_model=List[TenantCapabilityBindingResponse])
async def get_tenant_capabilities(
    company_db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    List all active capability bindings for the requesting tenant.
    """
    return await CapabilityService.get_tenant_bindings(company_db)


@router.post("/tenant/toggle", response_model=TenantCapabilityBindingResponse)
async def toggle_tenant_capability(
    req: TenantCapabilityToggleRequest,
    company_db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    Enable or disable a capability for tenant. Validates prerequisite dependencies (fail closed).
    """
    try:
        return await CapabilityService.toggle_tenant_capability(
            company_db=company_db,
            capability_code=req.capability_code,
            enable=req.enable,
            force=req.force,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/feature-flags", response_model=List[FeatureFlagResponse])
async def get_feature_flags(
    db: AsyncSession = Depends(get_db),
    x_company_id: Optional[str] = Header(None, alias="X-Company-ID"),
    current_user=Depends(get_current_user),
):
    """
    List active feature flags with company-level enablement evaluations.
    """
    return await CapabilityService.get_feature_flags(db, x_company_id)


@router.post("/feature-flags/{flag_key}/toggle", response_model=Dict[str, Any])
async def toggle_feature_flag(
    flag_key: str,
    req: FeatureFlagToggleRequest,
    db: AsyncSession = Depends(get_db),
    x_company_id: Optional[str] = Header(None, alias="X-Company-ID"),
    current_user=Depends(get_current_user),
):
    """
    Set company-level feature flag override.
    """
    comp_id = x_company_id or "COMP-001"
    try:
        flag = await CapabilityService.toggle_feature_flag(db, flag_key, comp_id, req.enable)
        return {
            "key": flag.key,
            "company_id": comp_id,
            "is_enabled": req.enable,
            "updated_at": flag.modified_at,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/modules", response_model=List[ModuleStateResponse])
async def get_modules(
    tenant_id: Optional[str] = Query(None, description="Optional tenant ID filter"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List module registry lifecycle states.
    """
    return await CapabilityService.get_module_states(db, tenant_id)
