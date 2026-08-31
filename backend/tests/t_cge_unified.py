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

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.models.loyalty import LoyaltyMember, LoyaltyPointsLedger
from app.models.commission import CommissionLedger, CommissionParticipant
from app.models.crm import Customer
from app.services.cge_unified_svc import CGEUnifiedPolicyEngine
from app.schemas.cge_unified import (
    CGEPolicyCreateReq,
    CGEAntiAbuseCheckReq,
    CGEReversalReq,
)


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_cge_unified_policy_creation_and_anti_abuse_evaluation():
    """Verify CGE unified anti-abuse rules, velocity caps, and self-referral prevention."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    pol_code = f"POL_CGE_{suffix.upper()}"

    async with sessionmaker() as session:
        # Create Policy with strict limits: max 500 points/day, min ₹1000 spend, no self-referral
        pol = await CGEUnifiedPolicyEngine.create_or_update_policy(
            session=session,
            company_id="COMP-001",
            req=CGEPolicyCreateReq(
                policy_code=pol_code,
                name="Strict Anti-Fraud Growth Policy",
                max_daily_points_accrual=Decimal("500.00"),
                min_order_value_for_referral=Decimal("1000.00"),
                allow_self_referral=False,
                commission_reversal_on_refund=True,
            ),
        )
        assert pol.id is not None
        assert pol.policy_code == pol_code

        # Case 1: Self-Referral Attempt -> BLOCKED
        res_self = await CGEUnifiedPolicyEngine.evaluate_anti_abuse(
            session=session,
            company_id="COMP-001",
            req=CGEAntiAbuseCheckReq(
                customer_id="CUST-100",
                referrer_id="CUST-100",
                order_amount=Decimal("1500.00"),
                policy_code=pol_code,
            ),
        )
        assert res_self.allowed == False
        assert res_self.risk_level == "BLOCKED"
        assert res_self.referral_reward_eligible == False
        assert any("SELF_REFERRAL_DISALLOWED" in v for v in res_self.violations)

        # Case 2: Below Minimum Spend Threshold -> WARNING / Referral Ineligible
        res_min = await CGEUnifiedPolicyEngine.evaluate_anti_abuse(
            session=session,
            company_id="COMP-001",
            req=CGEAntiAbuseCheckReq(
                customer_id="CUST-101",
                referrer_id="CUST-100",
                order_amount=Decimal("450.00"),  # below ₹1000
                policy_code=pol_code,
            ),
        )
        assert res_min.allowed == True
        assert res_min.risk_level == "WARNING"
        assert res_min.referral_reward_eligible == False

        # Case 3: Points Velocity Exceeded -> Capped to Max Allowed
        res_pts = await CGEUnifiedPolicyEngine.evaluate_anti_abuse(
            session=session,
            company_id="COMP-001",
            req=CGEAntiAbuseCheckReq(
                customer_id="CUST-102",
                requested_points=Decimal("800.00"),  # exceeds 500
                order_amount=Decimal("2000.00"),
                policy_code=pol_code,
            ),
        )
        assert res_pts.allowed == True
        assert res_pts.adjusted_points_allowed == Decimal("500.00")


@pytest.mark.asyncio
async def test_cge_refund_reversal_cascade():
    """Verify cascading clawback of loyalty points and salesperson commissions on refund."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    inv_no = f"INV-REV-{suffix.upper()}"
    member_id = f"mem_rev_{suffix}"

    async with sessionmaker() as session:
        cust_id = f"cust_{suffix}"
        cust = Customer(
            id=cust_id,
            company_id="COMP-001",
            name=f"Loyal Customer {suffix}",
            mobile=f"98{suffix[:8]}",
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add(cust)
        await session.flush()

        # Seed Loyalty Member
        mem = LoyaltyMember(
            id=member_id,
            company_id="COMP-001",
            customer_id=cust_id,
            card_number=f"CARD-{suffix.upper()}",
            total_points_earned=Decimal("150.00"),
            current_points_balance=Decimal("150.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(mem)

        # Seed Earned Points on Invoice
        l_entry = LoyaltyPointsLedger(
            id=f"lpl_{suffix}",
            company_id="COMP-001",
            member_id=member_id,
            transaction_type="EARN",
            points=Decimal("50.00"),
            reference_invoice_id=inv_no,
            narration=f"Points earned on {inv_no}",
            is_active=True,
            is_deleted=False,
        )
        session.add(l_entry)

        # Seed Commission Participant
        part_id = f"part_{suffix}"
        part = CommissionParticipant(
            id=part_id,
            company_id="COMP-001",
            person_name="Sales Executive",
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add(part)
        await session.flush()

        # Seed Salesperson Commission
        comm_entry = CommissionLedger(
            id=f"cml_{suffix}",
            company_id="COMP-001",
            participant_id=part_id,
            participant_role="SALESPERSON",
            transaction_type="EARNED",
            gross_sales_amount=Decimal("2500.00"),
            commission_amount=Decimal("50.00"),
            reference_invoice_id=inv_no,
            narration=f"Commission earned on {inv_no}",
            is_active=True,
            is_deleted=False,
        )
        session.add(comm_entry)
        await session.commit()

        # Process Reversal Cascade
        rev_res = await CGEUnifiedPolicyEngine.process_reversal(
            session=session,
            company_id="COMP-001",
            req=CGEReversalReq(
                original_invoice_no=inv_no,
                refund_amount=Decimal("2500.00"),
                reason="Customer Returned Defective Goods",
                reverse_loyalty=True,
                reverse_commission=True,
            ),
        )

        assert rev_res.status == "REVERSED"
        assert rev_res.reversed_loyalty_points == Decimal("50.00")
        assert rev_res.reversed_commission_amount == Decimal("50.00")

        # Verify member balance updated
        await session.refresh(mem)
        assert mem.current_points_balance == Decimal("100.00")


@pytest.mark.asyncio
async def test_api_cge_endpoints():
    """Verify CGE unified REST API endpoints."""
    headers = get_auth_headers()
    transport = ASGITransport(app=app)
    suffix = uuid.uuid4().hex[:6]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Policy
        p_res = await client.post(
            "/api/v1/cge-unified/policies",
            json={
                "policy_code": f"POL_API_{suffix.upper()}",
                "name": f"API Policy {suffix}",
                "max_daily_points_accrual": 5000.00,
            },
            headers=headers,
        )
        assert p_res.status_code == 200
        assert p_res.json()["status"] == "SUCCESS"

        # 2. Validate Action
        v_res = await client.post(
            "/api/v1/cge-unified/validate-action",
            json={
                "customer_id": "CUST-999",
                "referrer_id": "CUST-999",
                "order_amount": 2000.00,
            },
            headers=headers,
        )
        assert v_res.status_code == 200
        assert v_res.json()["allowed"] == False
        assert v_res.json()["risk_level"] == "BLOCKED"
