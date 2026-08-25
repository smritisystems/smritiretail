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
from datetime import datetime, date, timezone
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.crm import Customer, CustomerGroup, CrmLead, CrmOpportunity
from app.models.loyalty import LoyaltyTier, LoyaltyMember, LoyaltyPointsLedger
from app.models.commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger
from app.models.referral import ReferralProgram, ReferralRelationship, ReferralReward
from app.models.sales import SalesInvoice
from app.services.crm_engine import CrmGrowthEngine
from app.schemas.crm_cge import (
    LeadStatus,
    OpportunityStage,
    CustomerSegment,
    LeadCreate,
    LeadUpdate,
    OpportunityCreate,
    OpportunityUpdate,
    LoyaltyMemberEnrollRequest,
    PointsAdjustmentRequest,
    CalculateCommissionRequest,
    ReferralEnrollRequest,
    ReferralRewardCreditRequest,
)


def _get_auth_headers(role: str = "STORE_MANAGER") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_lead_creation_and_stage_progression():
    """Verify Lead creation, stage transitions, and Opportunity pipeline generation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # 1. Create Lead
        lead_req = LeadCreate(
            first_name="Rohan",
            last_name=f"Kapoor_{suffix}",
            company_name=f"Kapoor Textiles {suffix}",
            email=f"rohan_{suffix}@example.com",
            mobile=f"+9198{suffix[:8].zfill(8)}",
            lead_source="CAMPAIGN",
            assigned_to="usr_sales_01",
            notes="Interested in bulk festive wholesale purchase",
        )
        lead = await CrmGrowthEngine.create_lead(
            session=session,
            company_id="COMP-001",
            req=lead_req,
            user_id="usr-super",
        )
        assert lead.id is not None
        assert "LED-" in lead.lead_no
        assert lead.status == "NEW"

        # 2. Update Lead Stage to QUALIFIED
        up_lead = await CrmGrowthEngine.update_lead(
            session=session,
            company_id="COMP-001",
            lead_id=lead.id,
            req=LeadUpdate(status=LeadStatus.QUALIFIED, notes="Budget verified > ₹1,00,000"),
            user_id="usr-super",
        )
        assert up_lead.status == "QUALIFIED"

        # 3. Create Opportunity linked to Lead
        opp_req = OpportunityCreate(
            name=f"Festive Bulk Supply {suffix}",
            lead_id=lead.id,
            stage=OpportunityStage.PROPOSAL,
            probability_percent=Decimal("60.00"),
            expected_revenue=Decimal("150000.00"),
            expected_close_date=date(2026, 9, 30),
            assigned_to="usr_sales_01",
        )
        opp = await CrmGrowthEngine.create_opportunity(
            session=session,
            company_id="COMP-001",
            req=opp_req,
            user_id="usr-super",
        )
        assert opp.id is not None
        assert "OPP-" in opp.opp_no
        assert opp.expected_revenue == Decimal("150000.00")
        assert opp.stage == "PROPOSAL"


@pytest.mark.asyncio
async def test_customer_rfm_evaluation_and_segmentation():
    """Verify RFM recency, frequency, and monetary scoring engine categorizing VIP customer."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Customer
        cust = Customer(
            id=f"cust_rfm_{suffix}",
            company_id="COMP-001",
            name=f"Pooja Enterprises {suffix}",
            mobile=f"98{suffix[:8].zfill(8)}",
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add(cust)

        # Seed 5 Invoices totaling ₹75,000
        for i in range(5):
            inv = SalesInvoice(
                id=f"inv_rfm_{suffix}_{i}",
                company_id="COMP-001",
                customer_id=cust.id,
                invoice_no=f"INV-RFM-{suffix.upper()}-{i+1}",
                grand_total=Decimal("15000.00"),
                date=date(2026, 8, 20),
                status="PAID",
                is_active=True,
                is_deleted=False,
            )
            session.add(inv)
        await session.commit()

        # Evaluate RFM
        rfm_res = await CrmGrowthEngine.evaluate_customer_rfm(
            session=session,
            company_id="COMP-001",
            customer_id=cust.id,
        )
        assert rfm_res.frequency_orders == 5
        assert rfm_res.monetary_total_spend == Decimal("75000.00")
        assert rfm_res.segment == CustomerSegment.VIP
        assert rfm_res.rfm_score == "5-5-5"


@pytest.mark.asyncio
async def test_loyalty_member_enrollment_and_points_ledger_earn_burn():
    """Verify loyalty member enrollment, points earning, redemption, and negative balance protection."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Customer
        cust = Customer(
            id=f"cust_loy_{suffix}",
            company_id="COMP-001",
            name=f"Kiran Patel {suffix}",
            mobile=f"97{suffix[:8].zfill(8)}",
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add(cust)
        await session.commit()

        # 1. Enroll Member
        member = await CrmGrowthEngine.enroll_loyalty_member(
            session=session,
            company_id="COMP-001",
            req=LoyaltyMemberEnrollRequest(customer_id=cust.id),
            user_id="usr-super",
        )
        assert member.id is not None
        assert member.current_points_balance == Decimal("0.00")

        # 2. Earn Points (+500)
        earn_row, bal_after_earn = await CrmGrowthEngine.record_points_transaction(
            session=session,
            company_id="COMP-001",
            req=PointsAdjustmentRequest(
                member_id=member.id,
                transaction_type="EARN",
                points=Decimal("500.00"),
                narration="Welcome bonus + purchase points",
            ),
            user_id="usr-super",
        )
        assert bal_after_earn == Decimal("500.00")
        assert earn_row.transaction_type == "EARN"

        # 3. Redeem Points (-200)
        burn_row, bal_after_burn = await CrmGrowthEngine.record_points_transaction(
            session=session,
            company_id="COMP-001",
            req=PointsAdjustmentRequest(
                member_id=member.id,
                transaction_type="REDEEM",
                points=Decimal("200.00"),
                narration="Redeemed at POS checkout",
            ),
            user_id="usr-super",
        )
        assert bal_after_burn == Decimal("300.00")

        # 4. Attempt Invalid Over-Redemption (-400 points when balance is 300)
        with pytest.raises(ValueError) as exc_info:
            await CrmGrowthEngine.record_points_transaction(
                session=session,
                company_id="COMP-001",
                req=PointsAdjustmentRequest(
                    member_id=member.id,
                    transaction_type="REDEEM",
                    points=Decimal("400.00"),
                ),
            )
        assert "Insufficient loyalty points balance" in str(exc_info.value)

        # 5. List Ledger
        ledger_res = await CrmGrowthEngine.list_member_ledger(
            session=session,
            company_id="COMP-001",
            member_id=member.id,
        )
        assert ledger_res.total == 2
        assert ledger_res.current_balance == Decimal("300.00")


@pytest.mark.asyncio
async def test_salesperson_and_driver_commission_calculation():
    """Verify incentive calculations across Salesperson percentage rules and Driver fixed payouts."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Salesperson Participant
        sp = CommissionParticipant(
            id=f"part_sp_{suffix}",
            company_id="COMP-001",
            person_name=f"Vikram Sales {suffix}",
            mobile=f"96{suffix[:8].zfill(8)}",
            roles=["SALESPERSON"],
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add(sp)

        # Seed Driver Participant
        dr = CommissionParticipant(
            id=f"part_dr_{suffix}",
            company_id="COMP-001",
            person_name=f"Suresh Driver {suffix}",
            mobile=f"95{suffix[:8].zfill(8)}",
            roles=["DRIVER"],
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add(dr)
        await session.commit()

        # 1. Calculate Salesperson Commission (2% on ₹50,000 -> ₹1,000)
        res_sp = await CrmGrowthEngine.calculate_and_post_commission(
            session=session,
            company_id="COMP-001",
            req=CalculateCommissionRequest(
                participant_id=sp.id,
                participant_role="SALESPERSON",
                gross_sales_amount=Decimal("50000.00"),
                invoice_id=f"inv_test_{suffix}",
            ),
            user_id="usr-super",
        )
        assert res_sp.success == True
        assert res_sp.commission_amount == Decimal("1000.00")
        assert res_sp.ledger_id is not None

        # 2. Calculate Driver Delivery Commission (Fixed ₹50.00)
        res_dr = await CrmGrowthEngine.calculate_and_post_commission(
            session=session,
            company_id="COMP-001",
            req=CalculateCommissionRequest(
                participant_id=dr.id,
                participant_role="DRIVER",
                gross_sales_amount=Decimal("1200.00"),
                fixed_order_delivery=True,
            ),
            user_id="usr-super",
        )
        assert res_dr.success == True
        assert res_dr.commission_amount == Decimal("50.00")


@pytest.mark.asyncio
async def test_referral_relationship_and_reward_credit():
    """Verify Referral link attribution and minimum qualifying order reward credits."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Seed Customer
        cust = Customer(
            id=f"cust_ref_{suffix}",
            company_id="COMP-001",
            name=f"Referred User {suffix}",
            mobile=f"94{suffix[:8].zfill(8)}",
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add(cust)

        # Seed Referral Program (Min order ₹500, Reward ₹100)
        prog = ReferralProgram(
            id=f"prog_{suffix}",
            company_id="COMP-001",
            name=f"Summer Referral Program {suffix}",
            referral_code_prefix="REF",
            min_qualifying_order_amount=Decimal("500.00"),
            referrer_reward_amount=Decimal("100.00"),
            referee_discount_percent=Decimal("10.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(prog)
        await session.commit()

        # 1. Enroll Referral Link
        rel = await CrmGrowthEngine.enroll_referral(
            session=session,
            company_id="COMP-001",
            req=ReferralEnrollRequest(
                program_id=prog.id,
                referrer_person_id=f"person_adv_{suffix}",
                referred_customer_id=cust.id,
                referral_code=f"REF-{suffix.upper()}",
            ),
        )
        assert rel.id is not None
        assert rel.status == "QUALIFIED"

        # 2. Credit Reward on Qualifying Order (₹1,500 >= ₹500)
        reward_res = await CrmGrowthEngine.credit_referral_reward(
            session=session,
            company_id="COMP-001",
            req=ReferralRewardCreditRequest(
                relationship_id=rel.id,
                invoice_id=f"inv_ref_{suffix}",
                qualifying_order_amount=Decimal("1500.00"),
            ),
            user_id="usr-super",
        )
        assert reward_res.success == True
        assert reward_res.reward_amount == Decimal("100.00")
        assert reward_res.reward_id is not None

        # 3. Attempt Reward on Non-Qualifying Order (₹250 < ₹500)
        with pytest.raises(ValueError) as exc:
            await CrmGrowthEngine.credit_referral_reward(
                session=session,
                company_id="COMP-001",
                req=ReferralRewardCreditRequest(
                    relationship_id=rel.id,
                    qualifying_order_amount=Decimal("250.00"),
                ),
            )
        assert "does not meet qualifying threshold" in str(exc.value)


@pytest.mark.asyncio
async def test_api_crm_cge_endpoints():
    """Verify REST API endpoints for leads, opportunities, loyalty, commissions, and referrals."""
    transport = ASGITransport(app=app)
    suffix = uuid.uuid4().hex[:6]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. POST /crm-growth/leads
        lead_res = await client.post(
            "/api/v1/crm-growth/leads",
            json={
                "first_name": "Anita",
                "last_name": f"Deshmukh_{suffix}",
                "company_name": f"Deshmukh Retail {suffix}",
                "email": f"anita_{suffix}@test.com",
                "mobile": f"+9193{suffix[:8].zfill(8)}",
                "lead_source": "DIRECT",
                "notes": "Met at Pune trade fair",
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert lead_res.status_code == 201
        lead_id = lead_res.json()["id"]

        # 2. PUT /crm-growth/leads/{id}
        up_res = await client.put(
            f"/api/v1/crm-growth/leads/{lead_id}",
            json={"status": "QUALIFIED"},
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert up_res.status_code == 200
        assert up_res.json()["status"] == "QUALIFIED"

        # 3. POST /crm-growth/opportunities
        opp_res = await client.post(
            "/api/v1/crm-growth/opportunities",
            json={
                "name": f"Deshmukh Annual Order {suffix}",
                "lead_id": lead_id,
                "stage": "PROPOSAL",
                "probability_percent": 75.0,
                "expected_revenue": 250000.0,
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert opp_res.status_code == 201
        assert Decimal(str(opp_res.json()["expected_revenue"])) == Decimal("250000.00")

        # 4. GET /crm-growth/customers/{id}/segmentation
        sessionmaker = get_company_sessionmaker("smriti001")
        async with sessionmaker() as session:
            cust = Customer(
                id=f"cust_api_{suffix}",
                company_id="COMP-001",
                name=f"API Test Customer {suffix}",
                mobile=f"92{suffix[:8].zfill(8)}",
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(cust)
            await session.commit()

        seg_res = await client.get(
            f"/api/v1/crm-growth/customers/cust_api_{suffix}/segmentation",
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert seg_res.status_code == 200
        assert seg_res.json()["customer_id"] == f"cust_api_{suffix}"
        assert seg_res.json()["segment"] == "NEW"

        # 5. POST /crm-growth/loyalty/enroll-member
        lm_res = await client.post(
            "/api/v1/crm-growth/loyalty/enroll-member",
            json={"customer_id": f"cust_api_{suffix}"},
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert lm_res.status_code == 200
        member_id = lm_res.json()["id"]

        # 6. POST /crm-growth/loyalty/adjust-points
        adj_res = await client.post(
            "/api/v1/crm-growth/loyalty/adjust-points",
            json={
                "member_id": member_id,
                "transaction_type": "EARN",
                "points": 150.0,
                "narration": "API test earn",
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert adj_res.status_code == 200
        assert adj_res.json()["new_balance"] == 150.0

        # 7. GET /crm-growth/loyalty/members/{id}/ledger
        ledger_res = await client.get(
            f"/api/v1/crm-growth/loyalty/members/{member_id}/ledger",
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert ledger_res.status_code == 200
        assert ledger_res.json()["total"] == 1

        # 8. POST /crm-growth/commissions/calculate
        async with sessionmaker() as session:
            sp = CommissionParticipant(
                id=f"sp_api_{suffix}",
                company_id="COMP-001",
                person_name=f"Salesperson API {suffix}",
                roles=["SALESPERSON"],
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(sp)
            await session.commit()

        comm_res = await client.post(
            "/api/v1/crm-growth/commissions/calculate",
            json={
                "participant_id": f"sp_api_{suffix}",
                "participant_role": "SALESPERSON",
                "gross_sales_amount": 20000.0,
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert comm_res.status_code == 200
        assert Decimal(str(comm_res.json()["commission_amount"])) == Decimal("400.00")
