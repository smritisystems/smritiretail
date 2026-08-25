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
from app.services.cge_unified_svc import CGEUnifiedPolicyEngine
from app.schemas.cge_unified import (
    CGEPolicyCreateReq,
    CGEAntiAbuseCheckReq,
    CGEAntiAbuseCheckResponse,
    CGEReversalReq,
    CGEReversalResponse,
)

router = APIRouter(prefix="/cge-unified", tags=["Commercial Growth Engine Unified Policies (CGE)"])


@router.post("/policies")
async def create_cge_policy(
    req: CGEPolicyCreateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Creates or updates a CGE unified policy."""
    pol = await CGEUnifiedPolicyEngine.create_or_update_policy(
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


@router.post("/validate-action", response_model=CGEAntiAbuseCheckResponse)
async def validate_action_against_anti_abuse(
    req: CGEAntiAbuseCheckReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> CGEAntiAbuseCheckResponse:
    """Validates a commercial growth action against anti-abuse, velocity, and self-referral policies."""
    res = await CGEUnifiedPolicyEngine.evaluate_anti_abuse(
        session=session,
        company_id=company_id,
        req=req,
    )
    return res


@router.post("/reversals", response_model=CGEReversalResponse)
async def process_growth_reversal(
    req: CGEReversalReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> CGEReversalResponse:
    """Processes cascading clawbacks for loyalty points and commissions on refunded invoices."""
    res = await CGEUnifiedPolicyEngine.process_reversal(
        session=session,
        company_id=company_id,
        req=req,
    )
    return res
