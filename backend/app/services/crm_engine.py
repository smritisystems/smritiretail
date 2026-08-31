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
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc

from app.models.crm import CrmLead, CrmOpportunity, CrmCampaign, CrmCustomerActivity, Customer, CustomerGroup
from app.models.loyalty import LoyaltyTier, LoyaltyRule, LoyaltyMember, LoyaltyPointsLedger
from app.models.commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger
from app.models.referral import ReferralProgram, ReferralRelationship, ReferralReward
from app.models.sales import SalesInvoice
from app.schemas.crm_cge import (
    LeadStatus,
    OpportunityStage,
    CustomerSegment,
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
    LoyaltyLedgerItemResponse,
    LoyaltyLedgerListResponse,
    CalculateCommissionRequest,
    CalculateCommissionResponse,
    CommissionLedgerItemResponse,
    ReferralEnrollRequest,
    ReferralRelationshipResponse,
    ReferralRewardCreditRequest,
    ReferralRewardResponse,
)


class CrmGrowthEngine:
    """
    Authoritative SMRITI CRM & Commercial Growth Engine (Blueprint Section 7).
    Governs Lead/Deal Pipeline, RFM Segmentation, Multi-Tier Loyalty Points,
    Universal Commission Settlement, and Referral Attribution.
    """

    # -----------------------------------------------------------------------
    # 1. Lead & Opportunity Pipeline Management
    # -----------------------------------------------------------------------
    @classmethod
    async def create_lead(
        cls,
        session: AsyncSession,
        company_id: str,
        req: LeadCreate,
        user_id: Optional[str] = None,
    ) -> CrmLead:
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        lead_no = f"LED-{today_str}-{uuid.uuid4().hex[:6].upper()}"
        lead_id = f"led_{uuid.uuid4().hex[:12]}"

        lead = CrmLead(
            id=lead_id,
            company_id=company_id,
            lead_no=lead_no,
            first_name=req.first_name,
            last_name=req.last_name,
            company_name=req.company_name,
            email=req.email,
            mobile=req.mobile,
            lead_source=req.lead_source,
            status=LeadStatus.NEW.value,
            assigned_to=req.assigned_to,
            notes=req.notes,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(lead)
        await session.commit()
        await session.refresh(lead)
        return lead

    @classmethod
    async def update_lead(
        cls,
        session: AsyncSession,
        company_id: str,
        lead_id: str,
        req: LeadUpdate,
        user_id: Optional[str] = None,
    ) -> CrmLead:
        stmt = select(CrmLead).where(
            CrmLead.company_id == company_id,
            CrmLead.id == lead_id,
            CrmLead.is_deleted == False,
        )
        lead = (await session.execute(stmt)).scalars().first()
        if not lead:
            raise ValueError(f"Lead '{lead_id}' not found.")

        if req.first_name is not None:
            lead.first_name = req.first_name
        if req.last_name is not None:
            lead.last_name = req.last_name
        if req.company_name is not None:
            lead.company_name = req.company_name
        if req.email is not None:
            lead.email = req.email
        if req.mobile is not None:
            lead.mobile = req.mobile
        if req.status is not None:
            lead.status = req.status.value
        if req.assigned_to is not None:
            lead.assigned_to = req.assigned_to
        if req.notes is not None:
            lead.notes = req.notes
        lead.updated_by = user_id

        await session.commit()
        await session.refresh(lead)
        return lead

    @classmethod
    async def create_opportunity(
        cls,
        session: AsyncSession,
        company_id: str,
        req: OpportunityCreate,
        user_id: Optional[str] = None,
    ) -> CrmOpportunity:
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        opp_no = f"OPP-{today_str}-{uuid.uuid4().hex[:6].upper()}"
        opp_id = f"opp_{uuid.uuid4().hex[:12]}"

        opp = CrmOpportunity(
            id=opp_id,
            company_id=company_id,
            opp_no=opp_no,
            name=req.name,
            lead_id=req.lead_id,
            customer_id=req.customer_id,
            stage=req.stage.value,
            probability_percent=req.probability_percent,
            expected_revenue=req.expected_revenue,
            expected_close_date=req.expected_close_date,
            assigned_to=req.assigned_to,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(opp)
        await session.commit()
        await session.refresh(opp)
        return opp

    @classmethod
    async def update_opportunity(
        cls,
        session: AsyncSession,
        company_id: str,
        opp_id: str,
        req: OpportunityUpdate,
        user_id: Optional[str] = None,
    ) -> CrmOpportunity:
        stmt = select(CrmOpportunity).where(
            CrmOpportunity.company_id == company_id,
            CrmOpportunity.id == opp_id,
            CrmOpportunity.is_deleted == False,
        )
        opp = (await session.execute(stmt)).scalars().first()
        if not opp:
            raise ValueError(f"Opportunity '{opp_id}' not found.")

        if req.name is not None:
            opp.name = req.name
        if req.stage is not None:
            opp.stage = req.stage.value
        if req.probability_percent is not None:
            opp.probability_percent = req.probability_percent
        if req.expected_revenue is not None:
            opp.expected_revenue = req.expected_revenue
        if req.expected_close_date is not None:
            opp.expected_close_date = req.expected_close_date
        if req.assigned_to is not None:
            opp.assigned_to = req.assigned_to
        opp.updated_by = user_id

        await session.commit()
        await session.refresh(opp)
        return opp

    # -----------------------------------------------------------------------
    # 2. Customer Segmentation & RFM Scoring
    # -----------------------------------------------------------------------
    @classmethod
    async def evaluate_customer_rfm(
        cls,
        session: AsyncSession,
        company_id: str,
        customer_id: str,
    ) -> CustomerSegmentationResponse:
        """
        Computes Recency (days), Frequency (order count), and Monetary (total spend)
        and segments the customer into VIP, FREQUENT, NEW, AT_RISK, or DORMANT.
        """
        # Fetch customer
        stmt_c = select(Customer).where(
            Customer.company_id == company_id,
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        cust = (await session.execute(stmt_c)).scalars().first()
        if not cust:
            raise ValueError(f"Customer '{customer_id}' not found.")

        # Invoices query
        stmt_inv = (
            select(SalesInvoice)
            .where(
                SalesInvoice.company_id == company_id,
                SalesInvoice.customer_id == customer_id,
                SalesInvoice.is_deleted == False,
                SalesInvoice.status != "CANCELLED",
            )
            .order_by(desc(SalesInvoice.date))
        )
        invoices = (await session.execute(stmt_inv)).scalars().all()

        freq = len(invoices)
        total_spend = sum(Decimal(str(inv.grand_total)) for inv in invoices) if invoices else Decimal("0.00")

        now_date = datetime.now(timezone.utc).date()
        recency_days = 999
        if invoices and invoices[0].date:
            last_date = invoices[0].date
            if isinstance(last_date, datetime):
                last_date = last_date.date()
            recency_days = (now_date - last_date).days

        # Loyalty info
        stmt_lm = select(LoyaltyMember).where(
            LoyaltyMember.company_id == company_id,
            LoyaltyMember.customer_id == customer_id,
            LoyaltyMember.is_deleted == False,
        )
        lm = (await session.execute(stmt_lm)).scalars().first()
        points_bal = Decimal(str(lm.current_points_balance)) if lm else Decimal("0.00")
        tier_name = lm.loyalty_tier_id if lm else None

        # Segment Classification
        if total_spend >= Decimal("50000.00") or freq >= 10:
            segment = CustomerSegment.VIP
            rfm = "5-5-5"
        elif freq >= 4:
            segment = CustomerSegment.FREQUENT
            rfm = "4-4-4"
        elif freq == 0:
            segment = CustomerSegment.NEW
            rfm = "0-0-0"
        elif recency_days > 180:
            segment = CustomerSegment.DORMANT
            rfm = "1-1-1"
        elif recency_days > 60:
            segment = CustomerSegment.AT_RISK
            rfm = "2-2-2"
        else:
            segment = CustomerSegment.NEW
            rfm = "3-1-2"

        return CustomerSegmentationResponse(
            customer_id=cust.id,
            customer_name=cust.name,
            recency_days=recency_days,
            frequency_orders=freq,
            monetary_total_spend=total_spend,
            rfm_score=rfm,
            segment=segment,
            loyalty_tier=tier_name,
            points_balance=points_bal,
        )

    # -----------------------------------------------------------------------
    # 3. Loyalty Program & Points Ledger
    # -----------------------------------------------------------------------
    @classmethod
    async def enroll_loyalty_member(
        cls,
        session: AsyncSession,
        company_id: str,
        req: LoyaltyMemberEnrollRequest,
        user_id: Optional[str] = None,
    ) -> LoyaltyMember:
        stmt = select(LoyaltyMember).where(
            LoyaltyMember.company_id == company_id,
            LoyaltyMember.customer_id == req.customer_id,
            LoyaltyMember.is_deleted == False,
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            return existing

        card_no = req.card_number or f"CARD-{uuid.uuid4().hex[:8].upper()}"
        member_id = f"lm_{uuid.uuid4().hex[:12]}"

        member = LoyaltyMember(
            id=member_id,
            company_id=company_id,
            customer_id=req.customer_id,
            loyalty_tier_id=req.loyalty_tier_id,
            card_number=card_no,
            total_points_earned=Decimal("0.00"),
            total_points_redeemed=Decimal("0.00"),
            current_points_balance=Decimal("0.00"),
            total_lifetime_spend=Decimal("0.00"),
            joined_date=datetime.now(timezone.utc).replace(tzinfo=None),
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(member)
        await session.commit()
        await session.refresh(member)
        return member

    @classmethod
    async def record_points_transaction(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PointsAdjustmentRequest,
        user_id: Optional[str] = None,
    ) -> Tuple[LoyaltyPointsLedger, Decimal]:
        """
        Appends an authoritative entry to LoyaltyPointsLedger and updates member balance.
        Fails closed if redemption causes negative balance.
        """
        stmt_m = select(LoyaltyMember).where(
            LoyaltyMember.company_id == company_id,
            LoyaltyMember.id == req.member_id,
            LoyaltyMember.is_deleted == False,
        )
        member = (await session.execute(stmt_m)).scalars().first()
        if not member:
            raise ValueError(f"Loyalty member '{req.member_id}' not found.")

        current_bal = Decimal(str(member.current_points_balance or 0.00))
        delta = Decimal(str(req.points))

        # Check negative redemption guard
        if req.transaction_type in ("REDEEM", "BURN", "EXPIRY") and delta > 0:
            delta = -delta  # Ensure negative for deductions

        new_bal = current_bal + delta
        if new_bal < 0:
            raise ValueError(f"Insufficient loyalty points balance ({current_bal:.2f}). Requested deduction: {abs(delta):.2f}")

        ledger_id = f"lpl_{uuid.uuid4().hex[:12]}"
        ledger_entry = LoyaltyPointsLedger(
            id=ledger_id,
            company_id=company_id,
            member_id=member.id,
            transaction_type=req.transaction_type.upper(),
            points=delta,
            reference_invoice_id=req.reference_invoice_id,
            reference_return_id=req.reference_return_id,
            narration=req.narration,
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(ledger_entry)

        # Update member balances
        member.current_points_balance = new_bal
        if delta > 0:
            member.total_points_earned = Decimal(str(member.total_points_earned or 0.00)) + delta
        else:
            member.total_points_redeemed = Decimal(str(member.total_points_redeemed or 0.00)) + abs(delta)

        await session.commit()
        await session.refresh(ledger_entry)
        return ledger_entry, new_bal

    @classmethod
    async def list_member_ledger(
        cls,
        session: AsyncSession,
        company_id: str,
        member_id: str,
        limit: int = 50,
    ) -> LoyaltyLedgerListResponse:
        stmt_m = select(LoyaltyMember).where(
            LoyaltyMember.company_id == company_id,
            LoyaltyMember.id == member_id,
            LoyaltyMember.is_deleted == False,
        )
        member = (await session.execute(stmt_m)).scalars().first()
        if not member:
            raise ValueError(f"Loyalty member '{member_id}' not found.")

        stmt = (
            select(LoyaltyPointsLedger)
            .where(
                LoyaltyPointsLedger.company_id == company_id,
                LoyaltyPointsLedger.member_id == member_id,
                LoyaltyPointsLedger.is_deleted == False,
            )
            .order_by(desc(LoyaltyPointsLedger.timestamp))
            .limit(limit)
        )
        entries = (await session.execute(stmt)).scalars().all()
        mapped = [
            LoyaltyLedgerItemResponse(
                id=e.id,
                member_id=e.member_id,
                transaction_type=e.transaction_type,
                points=Decimal(str(e.points)),
                reference_invoice_id=e.reference_invoice_id,
                reference_return_id=e.reference_return_id,
                narration=e.narration,
                timestamp=e.timestamp,
            )
            for e in entries
        ]
        return LoyaltyLedgerListResponse(
            total=len(mapped),
            current_balance=Decimal(str(member.current_points_balance)),
            items=mapped,
        )

    # -----------------------------------------------------------------------
    # 4. Universal Commission & Incentive Governance
    # -----------------------------------------------------------------------
    @classmethod
    async def calculate_and_post_commission(
        cls,
        session: AsyncSession,
        company_id: str,
        req: CalculateCommissionRequest,
        user_id: Optional[str] = None,
    ) -> CalculateCommissionResponse:
        """
        Calculates salesperson tier commission, driver delivery payout, or agent commission,
        and posts an authoritative record in CommissionLedger.
        """
        stmt_p = select(CommissionParticipant).where(
            CommissionParticipant.company_id == company_id,
            CommissionParticipant.id == req.participant_id,
            CommissionParticipant.is_deleted == False,
        )
        participant = (await session.execute(stmt_p)).scalars().first()
        if not participant:
            raise ValueError(f"Commission participant '{req.participant_id}' not found.")

        # Find matching commission rule for participant role
        stmt_r = select(CommissionRule).where(
            CommissionRule.company_id == company_id,
            CommissionRule.participant_role == req.participant_role.upper(),
            CommissionRule.is_active == True,
            CommissionRule.is_deleted == False,
        )
        rule = (await session.execute(stmt_r)).scalars().first()

        comm_amount = Decimal("0.00")
        rule_applied = "DEFAULT_ZERO"

        if rule:
            if rule.calculation_type == "PERCENTAGE":
                rate = Decimal(str(rule.rate_percent)) / Decimal("100.00")
                comm_amount = req.gross_sales_amount * rate
                rule_applied = f"PERCENTAGE_{rule.rate_percent}%"
            elif rule.calculation_type == "FIXED_AMOUNT":
                comm_amount = Decimal(str(rule.fixed_amount))
                rule_applied = f"FIXED_₹{rule.fixed_amount}"
            elif rule.calculation_type == "SLAB_BASED":
                comm_amount = req.gross_sales_amount * Decimal("0.03")  # 3% standard slab
                rule_applied = "SLAB_TIER_1"
        else:
            # Fallback default heuristics if no specific rule program configured
            if req.participant_role.upper() == "SALESPERSON":
                comm_amount = req.gross_sales_amount * Decimal("0.02")  # 2% default sales incentive
                rule_applied = "DEFAULT_SALESPERSON_2%"
            elif req.participant_role.upper() == "DRIVER":
                comm_amount = Decimal("50.00")  # ₹50 fixed delivery commission
                rule_applied = "DEFAULT_DRIVER_FIXED_₹50"
            elif req.participant_role.upper() == "AGENT":
                comm_amount = req.gross_sales_amount * Decimal("0.05")  # 5% agent commission
                rule_applied = "DEFAULT_AGENT_5%"

        # Max commission cap check
        if rule and rule.max_commission_amount and comm_amount > Decimal(str(rule.max_commission_amount)):
            comm_amount = Decimal(str(rule.max_commission_amount))

        # Post to CommissionLedger
        ledger_id = f"cml_{uuid.uuid4().hex[:12]}"
        ledger_row = CommissionLedger(
            id=ledger_id,
            company_id=company_id,
            participant_id=participant.id,
            participant_role=req.participant_role.upper(),
            transaction_type="EARNED",
            gross_sales_amount=req.gross_sales_amount,
            commission_amount=comm_amount,
            reference_invoice_id=req.invoice_id,
            narration=f"Commission applied via rule {rule_applied}",
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(ledger_row)
        await session.commit()
        await session.refresh(ledger_row)

        return CalculateCommissionResponse(
            success=True,
            participant_id=participant.id,
            participant_role=req.participant_role.upper(),
            gross_sales_amount=req.gross_sales_amount,
            commission_amount=comm_amount,
            calculation_rule_applied=rule_applied,
            ledger_id=ledger_row.id,
        )

    # -----------------------------------------------------------------------
    # 5. Referral Program & Reward Credits
    # -----------------------------------------------------------------------
    @classmethod
    async def enroll_referral(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ReferralEnrollRequest,
    ) -> ReferralRelationship:
        rel_id = f"ref_rel_{uuid.uuid4().hex[:12]}"
        rel = ReferralRelationship(
            id=rel_id,
            company_id=company_id,
            program_id=req.program_id,
            referrer_person_id=req.referrer_person_id,
            referred_customer_id=req.referred_customer_id,
            referral_code_used=req.referral_code,
            status="QUALIFIED",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            is_active=True,
            is_deleted=False,
        )
        session.add(rel)
        await session.commit()
        await session.refresh(rel)
        return rel

    @classmethod
    async def credit_referral_reward(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ReferralRewardCreditRequest,
        user_id: Optional[str] = None,
    ) -> ReferralRewardResponse:
        stmt_rel = select(ReferralRelationship).where(
            ReferralRelationship.company_id == company_id,
            ReferralRelationship.id == req.relationship_id,
            ReferralRelationship.is_deleted == False,
        )
        rel = (await session.execute(stmt_rel)).scalars().first()
        if not rel:
            raise ValueError(f"Referral relationship '{req.relationship_id}' not found.")

        stmt_prog = select(ReferralProgram).where(
            ReferralProgram.company_id == company_id,
            ReferralProgram.id == rel.program_id,
            ReferralProgram.is_deleted == False,
        )
        prog = (await session.execute(stmt_prog)).scalars().first()

        reward_amount = Decimal(str(prog.referrer_reward_amount)) if prog else Decimal("100.00")
        min_order = Decimal(str(prog.min_qualifying_order_amount)) if prog else Decimal("500.00")

        if req.qualifying_order_amount < min_order:
            raise ValueError(f"Order amount ₹{req.qualifying_order_amount:.2f} does not meet qualifying threshold ₹{min_order:.2f}")

        reward_id = f"rfr_{uuid.uuid4().hex[:12]}"
        reward_row = ReferralReward(
            id=reward_id,
            company_id=company_id,
            relationship_id=rel.id,
            referrer_person_id=rel.referrer_person_id,
            transaction_type="EARNED",
            reward_amount=reward_amount,
            reference_invoice_id=req.invoice_id,
            narration=f"Referral reward credit for order ₹{req.qualifying_order_amount:.2f}",
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(reward_row)
        await session.commit()
        await session.refresh(reward_row)

        return ReferralRewardResponse(
            success=True,
            reward_id=reward_row.id,
            referrer_person_id=rel.referrer_person_id,
            reward_amount=reward_amount,
            status="EARNED",
            narration=reward_row.narration,
        )
