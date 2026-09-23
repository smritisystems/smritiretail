"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Module       : Dedicated Loyalty Studio & Points Ledger API Router
"""

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import (
    get_company_db,
    get_tenant_context,
    get_current_user,
    TenantContext,
    require_role,
)
from ...models.auth import User, UserRole
from ...models.loyalty import LoyaltyTier, LoyaltyMember, LoyaltyPointsLedger, LoyaltyRule
from ...models.crm import Customer
from ...services.crm_engine import CrmGrowthEngine
from ...services.compliance_audit import ComplianceAuditService
from ...schemas.crm_cge import (
    LoyaltyMemberEnrollRequest,
    LoyaltyMemberResponse,
    PointsAdjustmentRequest,
    LoyaltyLedgerListResponse,
    LoyaltyLedgerItemResponse,
)

router = APIRouter(prefix="/loyalty", tags=["Loyalty Studio"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

class LoyaltyTierCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    min_spend: Decimal = Field(default=Decimal("0.00"), ge=0)
    earn_multiplier: Decimal = Field(default=Decimal("1.00"), ge=0)
    redemption_ratio: Decimal = Field(default=Decimal("1.00"), ge=0)
    benefits: Optional[Dict[str, Any]] = None
    is_active: bool = True


class LoyaltyTierResponse(BaseModel):
    id: str
    name: str
    min_spend: Decimal
    earn_multiplier: Decimal
    redemption_ratio: Decimal
    benefits: Optional[Dict[str, Any]] = None
    is_active: bool
    member_count: int = 0


class LoyaltySummaryResponse(BaseModel):
    total_active_members: int
    total_points_outstanding: Decimal
    total_points_earned_all_time: Decimal
    total_points_redeemed_all_time: Decimal
    estimated_liability_inr: Decimal
    tier_distribution: List[Dict[str, Any]]


class ManualPointsAdjustmentRequest(BaseModel):
    points: Decimal = Field(..., description="Points delta. Positive to grant, negative to deduct.")
    reason: str = Field(..., min_length=3, description="Mandatory audit reason for manual points adjustment.")
    reference_doc: Optional[str] = Field(default=None, description="Optional invoice or ticket reference.")


# ─────────────────────────────────────────────────────────────────────────────
# Tier Management Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tiers", response_model=List[LoyaltyTierResponse])
async def list_loyalty_tiers(
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """List all configured loyalty tiers with active member counts."""
    company_id = tenant.company_id if tenant else "COMP-001"

    stmt = select(LoyaltyTier).where(
        LoyaltyTier.is_deleted == False
    ).order_by(LoyaltyTier.min_spend.asc())
    tiers = (await db.execute(stmt)).scalars().all()

    # Aggregate member counts per tier
    counts_stmt = select(
        LoyaltyMember.loyalty_tier_id,
        func.count(LoyaltyMember.id)
    ).where(
        LoyaltyMember.company_id == company_id,
        LoyaltyMember.is_deleted == False,
    ).group_by(LoyaltyMember.loyalty_tier_id)
    tier_counts = dict((await db.execute(counts_stmt)).all())

    results = []
    for t in tiers:
        results.append(
            LoyaltyTierResponse(
                id=t.id,
                name=t.name,
                min_spend=Decimal(str(t.min_spend or 0)),
                earn_multiplier=Decimal(str(t.earn_multiplier or 1)),
                redemption_ratio=Decimal(str(t.redemption_ratio or 1)),
                benefits=t.benefits,
                is_active=bool(t.is_active),
                member_count=tier_counts.get(t.id, 0),
            )
        )
    return results


@router.post("/tiers", response_model=LoyaltyTierResponse, status_code=201)
async def create_or_update_loyalty_tier(
    payload: LoyaltyTierCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER)),
):
    """Create a new loyalty tier (SYSADMIN or MANAGER role required)."""
    company_id = tenant.company_id if tenant else "COMP-001"

    # Check for existing tier by name
    stmt = select(LoyaltyTier).where(
        LoyaltyTier.name.ilike(payload.name.strip()),
        LoyaltyTier.is_deleted == False
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        existing.min_spend = payload.min_spend
        existing.earn_multiplier = payload.earn_multiplier
        existing.redemption_ratio = payload.redemption_ratio
        existing.benefits = payload.benefits or {}
        existing.is_active = payload.is_active
        tier = existing
    else:
        tier = LoyaltyTier(
            id=f"tier_{uuid.uuid4().hex[:10]}",
            company_id=company_id,
            name=payload.name.strip(),
            min_spend=payload.min_spend,
            earn_multiplier=payload.earn_multiplier,
            redemption_ratio=payload.redemption_ratio,
            benefits=payload.benefits or {},
            is_active=payload.is_active,
            is_deleted=False,
        )
        db.add(tier)

    await db.commit()
    await db.refresh(tier)

    # Record compliance audit
    await ComplianceAuditService.record_audit_event(
        session=db,
        company_id=company_id,
        event_type="LOYALTY_TIER_CONFIGURED",
        entity_name="loyalty_tiers",
        entity_id=tier.id,
        action_summary=f"Configured loyalty tier '{tier.name}' (min_spend={tier.min_spend})",
        actor_user_id=current_user.id,
        actor_role=getattr(current_user.role, "value", str(current_user.role)),
    )
    await db.commit()

    return LoyaltyTierResponse(
        id=tier.id,
        name=tier.name,
        min_spend=Decimal(str(tier.min_spend or 0)),
        earn_multiplier=Decimal(str(tier.earn_multiplier or 1)),
        redemption_ratio=Decimal(str(tier.redemption_ratio or 1)),
        benefits=tier.benefits,
        is_active=bool(tier.is_active),
        member_count=0,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Member Management & Enrollment
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/members")
async def list_loyalty_members(
    q: Optional[str] = Query(default=None, description="Search card number or customer ID"),
    tier_id: Optional[str] = Query(default=None, description="Filter by loyalty tier"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """Search and paginate loyalty members with current balances and lifetime spend."""
    company_id = tenant.company_id if tenant else "COMP-001"

    stmt = select(LoyaltyMember).where(
        LoyaltyMember.company_id == company_id,
        LoyaltyMember.is_deleted == False,
    )
    if tier_id:
        stmt = stmt.where(LoyaltyMember.loyalty_tier_id == tier_id)
    if q:
        q_clean = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                LoyaltyMember.card_number.ilike(q_clean),
                LoyaltyMember.customer_id.ilike(q_clean),
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    items = (await db.execute(stmt.order_by(desc(LoyaltyMember.current_points_balance)).offset(offset).limit(limit))).scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": m.id,
                "customer_id": m.customer_id,
                "card_number": m.card_number,
                "loyalty_tier_id": m.loyalty_tier_id,
                "current_points_balance": float(m.current_points_balance or 0),
                "total_points_earned": float(m.total_points_earned or 0),
                "total_points_redeemed": float(m.total_points_redeemed or 0),
                "total_lifetime_spend": float(m.total_lifetime_spend or 0),
                "joined_date": m.joined_date.isoformat() if m.joined_date else None,
            }
            for m in items
        ],
    }


@router.get("/members/{member_id}")
async def get_loyalty_member(
    member_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full loyalty member profile and linked customer information."""
    company_id = tenant.company_id if tenant else "COMP-001"

    stmt = select(LoyaltyMember).where(
        LoyaltyMember.company_id == company_id,
        LoyaltyMember.id == member_id,
        LoyaltyMember.is_deleted == False,
    )
    member = (await db.execute(stmt)).scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="SMRITI-CGE-404: Loyalty member not found.")

    cust_stmt = select(Customer).where(Customer.id == member.customer_id)
    cust = (await db.execute(cust_stmt)).scalars().first()

    return {
        "id": member.id,
        "customer_id": member.customer_id,
        "customer_name": cust.name if cust else "Unknown Customer",
        "customer_mobile": cust.mobile if cust else None,
        "card_number": member.card_number,
        "loyalty_tier_id": member.loyalty_tier_id,
        "current_points_balance": float(member.current_points_balance or 0),
        "total_points_earned": float(member.total_points_earned or 0),
        "total_points_redeemed": float(member.total_points_redeemed or 0),
        "total_lifetime_spend": float(member.total_lifetime_spend or 0),
        "joined_date": member.joined_date.isoformat() if member.joined_date else None,
    }


@router.post("/members/enroll", response_model=LoyaltyMemberResponse, status_code=201)
async def enroll_member(
    req: LoyaltyMemberEnrollRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
):
    """Enroll a customer into the loyalty program."""
    company_id = tenant.company_id if tenant else "COMP-001"
    try:
        member = await CrmGrowthEngine.enroll_loyalty_member(
            session=db,
            company_id=company_id,
            req=req,
            user_id=current_user.id,
        )
        return LoyaltyMemberResponse(
            id=member.id,
            customer_id=member.customer_id,
            card_number=member.card_number,
            loyalty_tier_id=member.loyalty_tier_id,
            total_points_earned=Decimal(str(member.total_points_earned or 0)),
            total_points_redeemed=Decimal(str(member.total_points_redeemed or 0)),
            current_points_balance=Decimal(str(member.current_points_balance or 0)),
            total_lifetime_spend=Decimal(str(member.total_lifetime_spend or 0)),
            joined_date=member.joined_date,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMRITI-LOYALTY-001: Enrollment failed: {e}")


@router.post("/members/{member_id}/adjust-points")
async def adjust_member_points(
    member_id: str,
    payload: ManualPointsAdjustmentRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN)),
):
    """
    Manually adjust member points with mandatory business reason and compliance audit log.
    Requires MANAGER or SYSADMIN role.
    """
    company_id = tenant.company_id if tenant else "COMP-001"

    adj_req = PointsAdjustmentRequest(
        member_id=member_id,
        transaction_type="ADJUSTMENT",
        points=payload.points,
        reference_invoice_id=payload.reference_doc,
        narration=payload.reason,
    )

    try:
        ledger_entry, new_balance = await CrmGrowthEngine.record_points_transaction(
            session=db,
            company_id=company_id,
            req=adj_req,
            user_id=current_user.id,
        )

        # Compliance audit trail
        await ComplianceAuditService.record_audit_event(
            session=db,
            company_id=company_id,
            event_type="LOYALTY_POINTS_ADJUSTMENT",
            entity_name="loyalty_members",
            entity_id=member_id,
            action_summary=f"Adjusted loyalty points by {payload.points} (Reason: {payload.reason}). New balance: {new_balance}",
            actor_user_id=current_user.id,
            actor_role=getattr(current_user.role, "value", str(current_user.role)),
        )
        await db.commit()

        return {
            "success": True,
            "member_id": member_id,
            "points_delta": float(payload.points),
            "new_balance": float(new_balance),
            "ledger_id": ledger_entry.id,
            "narration": payload.reason,
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=f"SMRITI-LOYALTY-002: {val_err}")
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"SMRITI-SYS-001: Points adjustment failed: {err}")


@router.get("/members/{member_id}/ledger", response_model=LoyaltyLedgerListResponse)
async def get_member_ledger(
    member_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """Get transactional points ledger history for a specific loyalty member."""
    company_id = tenant.company_id if tenant else "COMP-001"
    try:
        return await CrmGrowthEngine.list_member_ledger(
            session=db,
            company_id=company_id,
            member_id=member_id,
            limit=limit,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=f"SMRITI-LOYALTY-404: {ve}")


# ─────────────────────────────────────────────────────────────────────────────
# Program Analytics & Summary
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=LoyaltySummaryResponse)
async def get_loyalty_summary(
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Authoritative financial and operational summary of the Loyalty Program
    for the Loyalty Studio dashboard (liability calculation, member distribution).
    """
    company_id = tenant.company_id if tenant else "COMP-001"

    # Aggregates across active loyalty members
    stmt = select(
        func.count(LoyaltyMember.id).label("total_members"),
        func.coalesce(func.sum(LoyaltyMember.current_points_balance), Decimal("0.00")).label("outstanding_points"),
        func.coalesce(func.sum(LoyaltyMember.total_points_earned), Decimal("0.00")).label("earned_points"),
        func.coalesce(func.sum(LoyaltyMember.total_points_redeemed), Decimal("0.00")).label("redeemed_points"),
    ).where(
        LoyaltyMember.company_id == company_id,
        LoyaltyMember.is_deleted == False,
    )
    res = (await db.execute(stmt)).first()
    total_members = res.total_members if res else 0
    outstanding = Decimal(str(res.outstanding_points)) if res else Decimal("0.00")
    earned = Decimal(str(res.earned_points)) if res else Decimal("0.00")
    redeemed = Decimal(str(res.redeemed_points)) if res else Decimal("0.00")

    # Estimated monetary liability (assuming average ₹1 / point or tier ratio)
    estimated_liability = outstanding * Decimal("1.00")

    # Tier breakdown
    tier_stmt = select(
        LoyaltyMember.loyalty_tier_id,
        func.count(LoyaltyMember.id).label("count"),
        func.coalesce(func.sum(LoyaltyMember.current_points_balance), Decimal("0.00")).label("points")
    ).where(
        LoyaltyMember.company_id == company_id,
        LoyaltyMember.is_deleted == False,
    ).group_by(LoyaltyMember.loyalty_tier_id)

    tier_rows = (await db.execute(tier_stmt)).all()
    tier_distribution = [
        {
            "tier_id": row.loyalty_tier_id or "UNASSIGNED",
            "member_count": row.count,
            "points_balance": float(row.points),
        }
        for row in tier_rows
    ]

    return LoyaltySummaryResponse(
        total_active_members=total_members,
        total_points_outstanding=outstanding,
        total_points_earned_all_time=earned,
        total_points_redeemed_all_time=redeemed,
        estimated_liability_inr=estimated_liability,
        tier_distribution=tier_distribution,
    )
