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

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.cge_policy import CGEUnifiedPolicy
from ..models.loyalty import LoyaltyPointsLedger, LoyaltyMember
from ..models.commission import CommissionLedger
from ..schemas.cge_unified import (
    CGEPolicyCreateReq,
    CGEAntiAbuseCheckReq,
    CGEAntiAbuseCheckResponse,
    CGEReversalReq,
    CGEReversalResponse,
)


class CGEUnifiedPolicyEngine:
    """
    Commercial Growth Engine (CGE) Unified Policy & Anti-Abuse Service.
    Enforces cross-cutting rules across Loyalty, Wallet, Referral, and Commissions,
    including velocity caps, self-referral prevention, and refund reversal cascades.
    """

    @classmethod
    async def create_or_update_policy(
        cls,
        session: AsyncSession,
        company_id: str,
        req: CGEPolicyCreateReq,
    ) -> CGEUnifiedPolicy:
        """Creates or updates a CGE unified policy."""
        stmt = select(CGEUnifiedPolicy).where(
            CGEUnifiedPolicy.company_id == company_id,
            CGEUnifiedPolicy.policy_code == req.policy_code,
            CGEUnifiedPolicy.is_deleted == False,
        )
        pol = (await session.execute(stmt)).scalars().first()
        if not pol:
            pol = CGEUnifiedPolicy(
                id=f"cge_pol_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                policy_code=req.policy_code,
                name=req.name,
                max_daily_points_accrual=req.max_daily_points_accrual,
                min_order_value_for_referral=req.min_order_value_for_referral,
                allow_self_referral=req.allow_self_referral,
                commission_reversal_on_refund=req.commission_reversal_on_refund,
                is_active=True,
                is_deleted=False,
            )
            session.add(pol)
        else:
            pol.name = req.name
            pol.max_daily_points_accrual = req.max_daily_points_accrual
            pol.min_order_value_for_referral = req.min_order_value_for_referral
            pol.allow_self_referral = req.allow_self_referral
            pol.commission_reversal_on_refund = req.commission_reversal_on_refund

        await session.commit()
        await session.refresh(pol)
        return pol

    @classmethod
    async def evaluate_anti_abuse(
        cls,
        session: AsyncSession,
        company_id: str,
        req: CGEAntiAbuseCheckReq,
    ) -> CGEAntiAbuseCheckResponse:
        """Evaluates customer action against CGE anti-abuse and anti-fraud policies."""
        policy_code = req.policy_code or "DEFAULT_CGE"
        stmt = select(CGEUnifiedPolicy).where(
            CGEUnifiedPolicy.company_id == company_id,
            CGEUnifiedPolicy.policy_code == policy_code,
            CGEUnifiedPolicy.is_active == True,
        )
        pol = (await session.execute(stmt)).scalars().first()

        max_points = pol.max_daily_points_accrual if pol else Decimal("10000.00")
        min_ref_val = pol.min_order_value_for_referral if pol else Decimal("500.00")
        allow_self = pol.allow_self_referral if pol else False

        violations: List[str] = []
        risk_level = "CLEAN"
        referral_eligible = True
        allowed_points = req.requested_points

        # Rule 1: Self-Referral Prevention
        if req.referrer_id and req.customer_id.strip() == req.referrer_id.strip():
            if not allow_self:
                violations.append("SELF_REFERRAL_DISALLOWED: Customer ID matches Referrer ID.")
                risk_level = "BLOCKED"
                referral_eligible = False

        # Rule 2: Minimum Order Spend for Referral Reward
        if req.referrer_id and req.order_amount < min_ref_val:
            violations.append(f"MINIMUM_SPEND_NOT_MET: Order amount ₹{req.order_amount} below minimum threshold ₹{min_ref_val}.")
            referral_eligible = False
            if risk_level != "BLOCKED":
                risk_level = "WARNING"

        # Rule 3: Daily Points Velocity Cap
        if req.requested_points > max_points:
            violations.append(f"POINTS_VELOCITY_CAP_EXCEEDED: Requested {req.requested_points} exceeds daily max {max_points}.")
            allowed_points = max_points
            if risk_level != "BLOCKED":
                risk_level = "WARNING"

        is_allowed = risk_level != "BLOCKED"

        return CGEAntiAbuseCheckResponse(
            allowed=is_allowed,
            risk_level=risk_level,
            violations=violations,
            adjusted_points_allowed=allowed_points,
            referral_reward_eligible=referral_eligible,
        )

    @classmethod
    async def process_reversal(
        cls,
        session: AsyncSession,
        company_id: str,
        req: CGEReversalReq,
    ) -> CGEReversalResponse:
        """
        Executes cascading reversal of commercial growth benefits (loyalty points, sales commissions)
        upon order cancellation or refund.
        """
        reversal_id = f"rev_{uuid.uuid4().hex[:12]}"
        reversed_loyalty = Decimal("0.00")
        reversed_commission = Decimal("0.00")

        # 1. Reverse Loyalty Points if requested
        if req.reverse_loyalty:
            # Look up any points earned from this invoice
            stmt = select(LoyaltyPointsLedger).where(
                LoyaltyPointsLedger.company_id == company_id,
                LoyaltyPointsLedger.reference_invoice_id == req.original_invoice_no,
                LoyaltyPointsLedger.transaction_type.in_(["EARN", "EARNED", "BONUS"]),
                LoyaltyPointsLedger.points > 0,
            )
            entries = (await session.execute(stmt)).scalars().all()
            for entry in entries:
                pts_to_rev = entry.points
                rev_entry = LoyaltyPointsLedger(
                    id=f"lpl_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    member_id=entry.member_id,
                    transaction_type="REVERSAL",
                    points=-abs(pts_to_rev),
                    reference_invoice_id=req.original_invoice_no,
                    narration=f"Reversal for refunded invoice {req.original_invoice_no}: {req.reason}",
                    is_active=True,
                    is_deleted=False,
                )
                session.add(rev_entry)

                # Update member balance
                m_stmt = select(LoyaltyMember).where(LoyaltyMember.id == entry.member_id)
                member = (await session.execute(m_stmt)).scalars().first()
                if member:
                    cur_bal = Decimal(str(member.current_points_balance or 0))
                    member.current_points_balance = max(Decimal("0.00"), cur_bal - pts_to_rev)

                reversed_loyalty += pts_to_rev

        # 2. Reverse Salesperson Commission if requested
        if req.reverse_commission:
            c_stmt = select(CommissionLedger).where(
                CommissionLedger.company_id == company_id,
                CommissionLedger.reference_invoice_id == req.original_invoice_no,
                CommissionLedger.transaction_type == "EARNED",
            )
            comm_entries = (await session.execute(c_stmt)).scalars().all()
            for c_entry in comm_entries:
                rev_comm = CommissionLedger(
                    id=f"cml_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    participant_id=c_entry.participant_id,
                    participant_role=c_entry.participant_role,
                    transaction_type="REVERSED",
                    gross_sales_amount=Decimal("0.00"),
                    commission_amount=-abs(c_entry.commission_amount),
                    reference_invoice_id=req.original_invoice_no,
                    narration=f"Commission clawback on refund for {req.original_invoice_no}",
                    is_active=True,
                    is_deleted=False,
                )
                session.add(rev_comm)
                reversed_commission += c_entry.commission_amount

        await session.commit()

        return CGEReversalResponse(
            reversal_id=reversal_id,
            original_invoice_no=req.original_invoice_no,
            reversed_loyalty_points=reversed_loyalty,
            reversed_commission_amount=reversed_commission,
            status="REVERSED",
            timestamp=datetime.now(timezone.utc),
        )
