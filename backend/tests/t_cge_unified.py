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
from fastapi import HTTPException
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.models.loyalty import LoyaltyMember, LoyaltyPointsLedger
from app.models.commission import CommissionLedger, CommissionParticipant
from app.models.crm import Customer
from app.models.sales import SalesInvoice, SalesReturn
from app.services.cge_unified_svc import CGEUnifiedPolicyEngine
from app.schemas.cge_unified import (
    CGEPolicyCreateReq,
    CGEAntiAbuseCheckReq,
    CGEReversalReq,
    CGEReversalResponse,
)


@pytest.mark.asyncio
async def test_cge_reversal_validates_return_and_prorates_ledgers():
    """A verified partial return reverses only its proportional earned value."""

    class Rows:
        def __init__(self, values):
            self.values = values

        def scalars(self):
            return self

        def first(self):
            return self.values[0] if self.values else None

        def all(self):
            return self.values

    class FakeSession:
        def __init__(self, results):
            self.results = list(results)
            self.added = []
            self.commits = 0

        async def execute(self, statement):
            return Rows(self.results.pop(0))

        def add(self, value):
            self.added.append(value)

        async def commit(self):
            self.commits += 1

    sales_return = SalesReturn(
        id="ret-partial",
        company_id="COMP-001",
        original_invoice_id="inv-partial",
        grand_total=Decimal("50.00"),
        status="Completed",
        is_deleted=False,
    )
    invoice = SalesInvoice(
        id="inv-partial",
        company_id="COMP-001",
        invoice_no="INV-PARTIAL",
        grand_total=Decimal("100.00"),
        status="POSTED",
        is_deleted=False,
    )
    member = LoyaltyMember(id="member-partial", current_points_balance=Decimal("100.00"))
    earned_points = LoyaltyPointsLedger(
        id="earned-points",
        company_id="COMP-001",
        member_id=member.id,
        points=Decimal("100.00"),
    )
    earned_commission = CommissionLedger(
        id="earned-commission",
        company_id="COMP-001",
        participant_id="participant-partial",
        participant_role="SALESPERSON",
        commission_amount=Decimal("10.00"),
    )
    session = FakeSession(
        [
            [sales_return],
            [invoice],
            [],
            [],
            [],
            [],
            [earned_points],
            [member],
            [earned_commission],
        ]
    )
    req = CGEReversalReq(
        sales_return_id=sales_return.id,
        original_invoice_no=invoice.invoice_no,
        refund_amount=Decimal("50.00"),
    )
    invalid_session = FakeSession([[sales_return], [invoice]])

    with pytest.raises(HTTPException) as invalid_refund:
        await CGEUnifiedPolicyEngine.process_reversal(
            session=invalid_session,
            company_id="COMP-001",
            req=CGEReversalReq(
                sales_return_id=sales_return.id,
                original_invoice_no=invoice.invoice_no,
                refund_amount=Decimal("49.00"),
            ),
        )
    assert invalid_refund.value.status_code == 422

    result = await CGEUnifiedPolicyEngine.process_reversal(
        session=session,
        company_id="COMP-001",
        req=req,
    )

    assert result.status == "REVERSED"
    assert result.reversed_loyalty_points == Decimal("50.00")
    assert result.reversed_commission_amount == Decimal("5.00")
    assert member.current_points_balance == Decimal("50.00")
    assert session.commits == 1
    assert {entry.reference_return_id for entry in session.added} == {sales_return.id}

    duplicate_session = FakeSession(
        [
            [sales_return],
            [invoice],
            [
                LoyaltyPointsLedger(
                    id="return-reversal-points",
                    points=Decimal("-50.00"),
                )
            ],
            [
                CommissionLedger(
                    id="return-reversal-commission",
                    commission_amount=Decimal("-5.00"),
                )
            ],
            [],
            [],
        ]
    )
    duplicate = await CGEUnifiedPolicyEngine.process_reversal(
        session=duplicate_session,
        company_id="COMP-001",
        req=req,
    )

    assert duplicate.status == "DUPLICATE_IGNORED"
    assert duplicate.reversed_loyalty_points == Decimal("50.00")
    assert duplicate.reversed_commission_amount == Decimal("5.00")
    assert duplicate_session.commits == 0

    legacy_duplicate_session = FakeSession(
        [
            [sales_return],
            [invoice],
            [],
            [],
            [
                LoyaltyPointsLedger(
                    id="legacy-invoice-reversal",
                    points=Decimal("-100.00"),
                )
            ],
            [],
        ]
    )
    legacy_duplicate = await CGEUnifiedPolicyEngine.process_reversal(
        session=legacy_duplicate_session,
        company_id="COMP-001",
        req=req,
    )

    assert legacy_duplicate.status == "DUPLICATE_IGNORED"
    assert legacy_duplicate.reversed_loyalty_points == Decimal("100.00")
    assert legacy_duplicate_session.commits == 0


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

        invoice_id = f"inv_id_{suffix}"
        invoice = SalesInvoice(
            id=invoice_id,
            company_id="COMP-001",
            customer_id=cust_id,
            invoice_no=inv_no,
            grand_total=Decimal("2500.00"),
            status="POSTED",
            is_active=True,
            is_deleted=False,
        )
        session.add(invoice)
        await session.flush()

        sales_return = SalesReturn(
            id=f"ret_{suffix}",
            company_id="COMP-001",
            customer_id=cust_id,
            return_no=f"RET-REV-{suffix.upper()}",
            original_invoice_id=invoice_id,
            grand_total=Decimal("2500.00"),
            status="Completed",
            is_active=True,
            is_deleted=False,
        )
        session.add(sales_return)

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

        with pytest.raises(HTTPException) as invalid_refund:
            await CGEUnifiedPolicyEngine.process_reversal(
                session=session,
                company_id="COMP-001",
                req=CGEReversalReq(
                    sales_return_id=sales_return.id,
                    original_invoice_no=inv_no,
                    refund_amount=Decimal("2499.00"),
                ),
            )
        assert invalid_refund.value.status_code == 422

        # Process Reversal Cascade
        rev_res = await CGEUnifiedPolicyEngine.process_reversal(
            session=session,
            company_id="COMP-001",
            req=CGEReversalReq(
                sales_return_id=sales_return.id,
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

        replay_res = await CGEUnifiedPolicyEngine.process_reversal(
            session=session,
            company_id="COMP-001",
            req=CGEReversalReq(
                sales_return_id=sales_return.id,
                original_invoice_no=inv_no,
                refund_amount=Decimal("2500.00"),
            ),
        )
        assert replay_res.status == "DUPLICATE_IGNORED"

        # Verify member balance updated
        await session.refresh(mem)
        assert mem.current_points_balance == Decimal("100.00")


@pytest.mark.asyncio
async def test_cge_reversal_requires_manager_role(monkeypatch):
    """Cashiers cannot invoke the loyalty/commission reversal endpoint."""
    from types import SimpleNamespace
    from app.api.deps import (
        TenantContext,
        get_company_db,
        get_current_user,
        get_tenant_context,
        _get_db,
    )

    async def fake_db():
        yield object()

    monkeypatch.setitem(app.dependency_overrides, get_company_db, fake_db)
    monkeypatch.setitem(app.dependency_overrides, _get_db, fake_db)
    monkeypatch.setitem(
        app.dependency_overrides,
        get_tenant_context,
        lambda: TenantContext(company_id="COMP-001", branch_id="BR-001"),
    )
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user,
        lambda: SimpleNamespace(role=UserRole.CASHIER, role_id=None),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/cge-unified/reversals",
            json={
                "sales_return_id": "return-1",
                "original_invoice_no": "invoice-1",
                "refund_amount": 10.00,
            },
            headers=get_auth_headers(role="CASHIER"),
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cge_reversal_uses_validated_tenant_context(monkeypatch):
    """The reversal service receives the resolved tenant, not a raw header default."""
    from types import SimpleNamespace
    from app.api.deps import (
        TenantContext,
        get_company_db,
        get_current_user,
        get_tenant_context,
        _get_db,
    )

    async def fake_db():
        yield object()

    monkeypatch.setitem(app.dependency_overrides, get_company_db, fake_db)
    monkeypatch.setitem(app.dependency_overrides, _get_db, fake_db)
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user,
        lambda: SimpleNamespace(role=UserRole.MANAGER, role_id=None),
    )
    monkeypatch.setitem(
        app.dependency_overrides,
        get_tenant_context,
        lambda: TenantContext(company_id="COMP-777", branch_id="BR-777"),
    )
    routed_company_ids = []

    async def fake_process_reversal(cls, session, company_id, req):
        routed_company_ids.append(company_id)
        return CGEReversalResponse(
            reversal_id="rev-test",
            original_invoice_no=req.original_invoice_no,
            reversed_loyalty_points=Decimal("0.00"),
            reversed_commission_amount=Decimal("0.00"),
        )

    monkeypatch.setattr(
        CGEUnifiedPolicyEngine,
        "process_reversal",
        classmethod(fake_process_reversal),
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/cge-unified/reversals",
            json={
                "sales_return_id": "return-1",
                "original_invoice_no": "invoice-1",
                "refund_amount": 10.00,
            },
            headers=get_auth_headers(role="MANAGER", company_id="COMP-001"),
        )

    assert response.status_code == 200
    assert routed_company_ids == ["COMP-777"]


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
