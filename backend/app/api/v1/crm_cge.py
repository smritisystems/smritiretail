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

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from ...api.deps import get_company_db, get_current_user
from ...models.auth import User
from ...models.crm import CrmLead, CrmOpportunity
from ...services.crm_engine import CrmGrowthEngine
from ...schemas.crm_cge import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    OpportunityCreate,
    OpportunityUpdate,
    OpportunityResponse,
    CustomerSegmentationResponse,
    LoyaltyMemberEnrollRequest,
    LoyaltyMemberResponse,
    PointsAdjustmentRequest,
    LoyaltyLedgerListResponse,
    CalculateCommissionRequest,
    CalculateCommissionResponse,
    ReferralEnrollRequest,
    ReferralRelationshipResponse,
    ReferralRewardCreditRequest,
    ReferralRewardResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Leads & Deals
# ---------------------------------------------------------------------------
@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_crm_lead(
    req: LeadCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Creates a new sales lead."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    lead = await CrmGrowthEngine.create_lead(
        session=session,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return LeadResponse(
        id=lead.id,
        lead_no=lead.lead_no,
        first_name=lead.first_name,
        last_name=lead.last_name,
        company_name=lead.company_name,
        email=lead.email,
        mobile=lead.mobile,
        lead_source=lead.lead_source,
        status=lead.status,
        assigned_to=lead.assigned_to,
        notes=lead.notes,
        created_at=lead.created_at,
    )


@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_crm_lead(
    lead_id: str,
    req: LeadUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Updates lead stage and details."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        lead = await CrmGrowthEngine.update_lead(
            session=session,
            company_id=company_id,
            lead_id=lead_id,
            req=req,
            user_id=user_id,
        )
        return LeadResponse(
            id=lead.id,
            lead_no=lead.lead_no,
            first_name=lead.first_name,
            last_name=lead.last_name,
            company_name=lead.company_name,
            email=lead.email,
            mobile=lead.mobile,
            lead_source=lead.lead_source,
            status=lead.status,
            assigned_to=lead.assigned_to,
            notes=lead.notes,
            created_at=lead.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/opportunities", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_crm_opportunity(
    req: OpportunityCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Creates a new deal or opportunity pipeline item."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    opp = await CrmGrowthEngine.create_opportunity(
        session=session,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return OpportunityResponse(
        id=opp.id,
        opp_no=opp.opp_no,
        name=opp.name,
        lead_id=opp.lead_id,
        customer_id=opp.customer_id,
        stage=opp.stage,
        probability_percent=opp.probability_percent,
        expected_revenue=opp.expected_revenue,
        expected_close_date=opp.expected_close_date,
        assigned_to=opp.assigned_to,
        created_at=opp.created_at,
    )


# ---------------------------------------------------------------------------
# Customer RFM Segmentation
# ---------------------------------------------------------------------------
@router.get("/customers/{customer_id}/segmentation", response_model=CustomerSegmentationResponse)
async def get_customer_segmentation(
    customer_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Evaluates customer RFM score and segment."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    try:
        return await CrmGrowthEngine.evaluate_customer_rfm(
            session=session,
            company_id=company_id,
            customer_id=customer_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---------------------------------------------------------------------------
# Loyalty Program & Points Ledger
# ---------------------------------------------------------------------------
@router.post("/loyalty/enroll-member", response_model=LoyaltyMemberResponse)
async def enroll_loyalty_member(
    req: LoyaltyMemberEnrollRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Enrolls a customer into the loyalty rewards program."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    member = await CrmGrowthEngine.enroll_loyalty_member(
        session=session,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return LoyaltyMemberResponse(
        id=member.id,
        customer_id=member.customer_id,
        card_number=member.card_number,
        loyalty_tier_id=member.loyalty_tier_id,
        total_points_earned=member.total_points_earned,
        total_points_redeemed=member.total_points_redeemed,
        current_points_balance=member.current_points_balance,
        total_lifetime_spend=member.total_lifetime_spend,
        joined_date=member.joined_date,
    )


@router.post("/loyalty/adjust-points")
async def adjust_loyalty_points(
    req: PointsAdjustmentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Records an authoritative earn, redeem, or bonus adjustment to the loyalty points ledger."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        ledger_entry, new_balance = await CrmGrowthEngine.record_points_transaction(
            session=session,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
        return {
            "success": True,
            "ledger_id": ledger_entry.id,
            "member_id": ledger_entry.member_id,
            "transaction_type": ledger_entry.transaction_type,
            "points": float(ledger_entry.points),
            "new_balance": float(new_balance),
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/loyalty/members/{member_id}/ledger", response_model=LoyaltyLedgerListResponse)
async def get_loyalty_member_ledger(
    member_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Fetches the immutable loyalty points ledger for a member."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    try:
        return await CrmGrowthEngine.list_member_ledger(
            session=session,
            company_id=company_id,
            member_id=member_id,
            limit=limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---------------------------------------------------------------------------
# Commission & Incentive Governance
# ---------------------------------------------------------------------------
@router.post("/commissions/calculate", response_model=CalculateCommissionResponse)
async def calculate_and_post_commission(
    req: CalculateCommissionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Calculates and posts salesperson or driver commission into the authoritative ledger."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        return await CrmGrowthEngine.calculate_and_post_commission(
            session=session,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ---------------------------------------------------------------------------
# Referral Program
# ---------------------------------------------------------------------------
@router.post("/referrals/enroll", response_model=ReferralRelationshipResponse)
async def enroll_referral(
    req: ReferralEnrollRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Registers a referrer person to referred customer relationship."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    rel = await CrmGrowthEngine.enroll_referral(
        session=session,
        company_id=company_id,
        req=req,
    )
    return ReferralRelationshipResponse(
        id=rel.id,
        program_id=rel.program_id,
        referrer_person_id=rel.referrer_person_id,
        referred_customer_id=rel.referred_customer_id,
        referral_code_used=rel.referral_code_used,
        status=rel.status,
        created_at=rel.created_at,
    )


@router.post("/referrals/credit-reward", response_model=ReferralRewardResponse)
async def credit_referral_reward(
    req: ReferralRewardCreditRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """Credits a referral reward when a qualifying purchase order occurs."""
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        return await CrmGrowthEngine.credit_referral_reward(
            session=session,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
