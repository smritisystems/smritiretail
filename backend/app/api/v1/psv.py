"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_company_db, get_current_user
from app.models.auth import User
from app.services.psv_projection import PSVProjectionService
from app.schemas.psv import (
    PSVEventProjectionReq,
    PSVVisibilityPolicyCreateReq,
    PSVPartyScopeCreateReq,
    PSVScopedVisibilityResponse,
)

router = APIRouter(prefix="/psv", tags=["Projected Stock Visibility (PSV)"])


@router.post("/policies")
async def create_psv_policy(
    req: PSVVisibilityPolicyCreateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Creates or updates a PSV visibility policy."""
    pol = await PSVProjectionService.create_visibility_policy(
        session=session,
        company_id=company_id,
        req=req,
    )
    return {
        "status": "SUCCESS",
        "policy_id": pol.id,
        "policy_code": pol.policy_code,
        "name": pol.name,
    }


@router.post("/party-scopes")
async def assign_party_scope(
    req: PSVPartyScopeCreateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Binds a party to a specific visibility scope."""
    scope = await PSVProjectionService.assign_party_scope(
        session=session,
        company_id=company_id,
        req=req,
    )
    return {
        "status": "SUCCESS",
        "scope_id": scope.id,
        "party_id": scope.party_id,
        "policy_code": scope.policy_code,
    }


@router.post("/project-event")
async def project_psv_event(
    req: PSVEventProjectionReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Projects an immutable stock event into the non-authoritative PSV visibility ledger."""
    res = await PSVProjectionService.project_psv_stock_event(
        psv_session=session,
        event_payload=req.model_dump(),
    )
    return res


@router.get("/scoped-balances/{party_id}", response_model=PSVScopedVisibilityResponse)
async def get_scoped_party_visibility(
    party_id: str,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_code: str = Header(default="001", alias="X-Company-Code"),
) -> PSVScopedVisibilityResponse:
    """Retrieves projected stock visibility strictly scoped to the requesting party."""
    res = await PSVProjectionService.get_scoped_party_visibility(
        session=session,
        company_code=company_code,
        party_id=party_id,
    )
    return res
