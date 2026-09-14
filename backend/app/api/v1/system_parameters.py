"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.19.0
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db
from ...services.system_parameter import SystemParameterService
from ...schemas.system_parameter import (
    SystemParameterResponse,
    SystemParameterUpdateRequest,
    SystemParameterBatchSaveRequest,
    SystemParameterResolveRequest,
    SystemParameterResolveResponse,
    SystemParameterSeedRequest,
)

router = APIRouter(prefix="/system-parameters", tags=["System Parameters"])


@router.get("", response_model=List[SystemParameterResponse])
async def list_system_parameters(
    category: Optional[str] = Query(None, description="Filter by category name"),
    profile_type: Optional[str] = Query(None, description="Filter by profile (RETAIL, DISTRIBUTOR, COMMON)"),
    search: Optional[str] = Query(None, description="Search term in code or description"),
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    db: AsyncSession = Depends(get_db),
):
    """
    List system parameters filtered by category, profile, or search term.
    """
    params = await SystemParameterService.get_parameters(
        db=db,
        company_id=company_id,
        category=category,
        profile_type=profile_type,
        search=search,
    )
    return [
        SystemParameterResponse(
            id=p.id,
            uuid=p.uuid,
            company_id=p.company_id,
            branch_id=p.branch_id,
            param_code=p.param_code,
            category=p.category,
            category_name=p.category_name,
            description=p.description,
            data_type=p.data_type,
            mutability=p.mutability,
            profile_type=p.profile_type,
            val_boolean=p.val_boolean,
            val_integer=p.val_integer,
            val_text=p.val_text,
            val_decimal=float(p.val_decimal) if p.val_decimal is not None else None,
            val_date=p.val_date.isoformat() if p.val_date else None,
            effective_value=p.effective_value,
            scope_level=p.scope_level,
            terminal_id=p.terminal_id,
            is_locked=p.is_locked,
            created_at=p.created_at,
            modified_at=p.modified_at,
        )
        for p in params
    ]


@router.get("/map")
async def get_parameters_map(
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    terminal_id: str = Header("COMMON", alias="x-terminal-id"),
    branch_id: Optional[str] = Header(None, alias="x-branch-id"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns resolved parameters dictionary map for high-speed 0ms frontend caching.
    Precedence: Terminal > Branch > Company > Global.
    """
    return await SystemParameterService.resolve_parameters_map(
        db=db,
        company_id=company_id,
        terminal_id=terminal_id,
        branch_id=branch_id,
    )


@router.post("/resolve", response_model=SystemParameterResolveResponse)
async def resolve_single_parameter(
    req: SystemParameterResolveRequest,
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolves an individual parameter value following the 4-tier hierarchy.
    """
    param = await SystemParameterService.resolve_parameter(
        db=db,
        param_code=req.param_code,
        company_id=company_id,
        terminal_id=req.terminal_id or "COMMON",
        branch_id=req.branch_id,
    )
    if not param:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "SMRITI-PARAM-404",
                "title": "Parameter Not Found",
                "explanation": f"System parameter '{req.param_code}' not defined.",
                "suggested_action": "Verify parameter code or seed defaults.",
            },
        )
    return SystemParameterResolveResponse(
        param_code=param.param_code,
        value=param.effective_value,
        data_type=param.data_type,
        mutability=param.mutability,
        source_scope=param.scope_level,
    )


@router.put("/{param_code}", response_model=SystemParameterResponse)
async def update_single_parameter(
    param_code: str,
    req: SystemParameterUpdateRequest,
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    user_id: Optional[str] = Header("system", alias="x-user-id"),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates a single parameter with 5-tier mutability verification.
    """
    param = await SystemParameterService.update_parameter(
        db=db,
        param_code=param_code,
        value=req.value,
        company_id=company_id,
        terminal_id=req.terminal_id or "COMMON",
        branch_id=req.branch_id,
        scope_level=req.scope_level or "COMPANY",
        updated_by=user_id,
    )
    return SystemParameterResponse(
        id=param.id,
        uuid=param.uuid,
        company_id=param.company_id,
        branch_id=param.branch_id,
        param_code=param.param_code,
        category=param.category,
        category_name=param.category_name,
        description=param.description,
        data_type=param.data_type,
        mutability=param.mutability,
        profile_type=param.profile_type,
        val_boolean=param.val_boolean,
        val_integer=param.val_integer,
        val_text=param.val_text,
        val_decimal=float(param.val_decimal) if param.val_decimal is not None else None,
        val_date=param.val_date.isoformat() if param.val_date else None,
        effective_value=param.effective_value,
        scope_level=param.scope_level,
        terminal_id=param.terminal_id,
        is_locked=param.is_locked,
        created_at=param.created_at,
        modified_at=param.modified_at,
    )


@router.post("/save-batch")
async def save_batch_parameters(
    req: SystemParameterBatchSaveRequest,
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    user_id: Optional[str] = Header("system", alias="x-user-id"),
    db: AsyncSession = Depends(get_db),
):
    """
    Saves multiple parameters in a single batch with full mutability validation.
    """
    count = await SystemParameterService.save_batch(
        db=db,
        items=req.items,
        company_id=company_id,
        updated_by=user_id,
    )
    return {"status": "success", "count": count}


@router.post("/seed-profile")
async def seed_system_parameters(
    req: SystemParameterSeedRequest,
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    db: AsyncSession = Depends(get_db),
):
    """
    Seeds standard Tally Shoper 9 POS/Distributor parameters into the database.
    """
    seeded = await SystemParameterService.seed_default_parameters(
        db=db,
        profile=req.profile,
        company_id=company_id,
        overwrite_existing=req.overwrite_existing,
    )
    return {
        "status": "success",
        "profile": req.profile.upper(),
        "company_id": company_id or "GLOBAL",
        "seeded_count": seeded,
    }
