"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Branch       : smritiNX

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: [REDACTED_PUBLIC_PII]
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 1.0.0
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Classification: Internal
"""
import uuid
from decimal import Decimal
import pytest
from sqlalchemy.future import select

from app.models.approval import ApprovalPolicy, ApprovalRequest, ApprovalAction
from app.models.tenant import Company, Branch
from app.models.auth import User, UserRole
from app.api.deps import TenantContext
from app.services.approval_engine import ApprovalEngine
from app.schemas.approval import (
    ApprovalPolicyCreateRequest,
    ApprovalEnforcementCheckRequest,
    ApprovalRequestCreateRequest,
    ApprovalActionRequest,
)
from app.services.lifecycle.engine import UniversalLifecycleEngine
from app.services.lifecycle.context import LifecycleTransitionContext
from app.services.lifecycle.exceptions import ApprovalRequiredException
from app.models.purchase import PurchaseOrder, PurchaseOrderItem


async def _make_tenant(session, s: str):
    cid = f"CMP{s.upper()[:8]}"
    bid = f"BR{s.upper()[:8]}"
    company = Company(
        id=cid, company_code=cid, name=f"Approval Test Co {s}",
        is_active=True, is_deleted=False,
    )
    branch = Branch(
        id=bid, company_id=cid, code=bid, name=f"Approval Branch {s}",
        is_active=True, is_deleted=False,
    )
    session.add_all([company, branch])
    await session.commit()
    return company, branch


@pytest.mark.asyncio
async def test_a_po_amount_below_threshold_no_approval_required(db_session):
    """TEST A: PO amount below threshold requires no approval."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)

    # Seed threshold policy for PURCHASE_ORDER: min 50,000 required role FINANCE_CONTROLLER
    policy_req = ApprovalPolicyCreateRequest(
        name="PO High Value Threshold",
        code=f"POL_PO_{s}",
        document_type="PURCHASE_ORDER",
        min_amount=Decimal("50000.00"),
        max_amount=Decimal("200000.00"),
        required_role="FINANCE_CONTROLLER",
        priority=1,
        description="POs >= 50k require Finance Controller",
    )
    await ApprovalEngine.create_policy(db_session, comp.id, policy_req)

    # Check PO of 10,000
    check_req = ApprovalEnforcementCheckRequest(
        document_type="PURCHASE_ORDER",
        document_amount=Decimal("10000.00"),
        caller_role="MANAGER",
    )
    enforcement = await ApprovalEngine.check_transaction_enforcement(db_session, comp.id, check_req)
    assert enforcement.requires_approval is False
    assert "within standard transaction limit" in enforcement.reason


@pytest.mark.asyncio
async def test_b_po_amount_inside_threshold_approval_enforced(db_session):
    """TEST B: PO amount inside approval threshold enforces approval gate."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)

    policy_req = ApprovalPolicyCreateRequest(
        name="PO Mid Tier",
        code=f"POL_MID_{s}",
        document_type="PURCHASE_ORDER",
        min_amount=Decimal("50000.00"),
        max_amount=Decimal("200000.00"),
        required_role="FINANCE_CONTROLLER",
        priority=1,
    )
    await ApprovalEngine.create_policy(db_session, comp.id, policy_req)

    # MANAGER (level 3) attempts to execute 75,000 (policy requires FINANCE_CONTROLLER level 4)
    check_req = ApprovalEnforcementCheckRequest(
        document_type="PURCHASE_ORDER",
        document_amount=Decimal("75000.00"),
        caller_role="MANAGER",
    )
    enforcement = await ApprovalEngine.check_transaction_enforcement(db_session, comp.id, check_req)
    assert enforcement.requires_approval is True
    assert enforcement.required_role == "FINANCE_CONTROLLER"
    assert enforcement.matching_policy_code == f"POL_MID_{s}"


@pytest.mark.asyncio
async def test_c_po_amount_above_higher_threshold_director_required(db_session):
    """TEST C: PO amount above high threshold requires Director."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)

    # Tier 1: 50k to 200k -> FINANCE_CONTROLLER
    await ApprovalEngine.create_policy(db_session, comp.id, ApprovalPolicyCreateRequest(
        name="Tier 1", code=f"T1_{s}", document_type="PURCHASE_ORDER",
        min_amount=Decimal("50000.00"), max_amount=Decimal("200000.00"),
        required_role="FINANCE_CONTROLLER", priority=1,
    ))
    # Tier 2: > 200k -> DIRECTOR
    await ApprovalEngine.create_policy(db_session, comp.id, ApprovalPolicyCreateRequest(
        name="Tier 2", code=f"T2_{s}", document_type="PURCHASE_ORDER",
        min_amount=Decimal("200000.01"), max_amount=None,
        required_role="DIRECTOR", priority=2,
    ))

    # Check 500,000 by FINANCE_CONTROLLER (level 4)
    check_req = ApprovalEnforcementCheckRequest(
        document_type="PURCHASE_ORDER",
        document_amount=Decimal("500000.00"),
        caller_role="FINANCE_CONTROLLER",
    )
    enforcement = await ApprovalEngine.check_transaction_enforcement(db_session, comp.id, check_req)
    assert enforcement.requires_approval is True
    assert enforcement.required_role == "DIRECTOR"
    assert enforcement.matching_policy_code == f"T2_{s}"


@pytest.mark.asyncio
async def test_d_unauthorized_role_attempts_approval_action_rejected(db_session):
    """TEST D: Insufficient role attempting to act on approval request is rejected."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)

    # Create policy and request assigned to FINANCE_CONTROLLER
    policy_req = ApprovalPolicyCreateRequest(
        name="Finance Only", code=f"FIN_{s}", document_type="PURCHASE_ORDER",
        min_amount=Decimal("50000.00"), required_role="FINANCE_CONTROLLER",
    )
    pol = await ApprovalEngine.create_policy(db_session, comp.id, policy_req)

    app_req = await ApprovalEngine.submit_approval_request(
        session=db_session,
        company_id=comp.id,
        req=ApprovalRequestCreateRequest(
            reference_doc_type="PURCHASE_ORDER",
            reference_doc_id=f"po_{s}",
            document_amount=Decimal("60000.00"),
            notes="Please approve",
        ),
        requested_by=f"user_{s}",
    )
    assert app_req.current_assigned_role == "FINANCE_CONTROLLER"

    # CASHIER (level 1) attempts to approve
    with pytest.raises(ValueError, match="Access Denied: Role 'CASHIER' is insufficient"):
        await ApprovalEngine.process_approval_action(
            session=db_session,
            company_id=comp.id,
            req=ApprovalActionRequest(request_id=app_req.id, action="APPROVE", comments="I approve"),
            action_by=f"cashier_{s}",
            action_by_role="CASHIER",
        )


@pytest.mark.asyncio
async def test_e_authorized_approval_creates_request_and_action(db_session):
    """TEST E: Authorized role approves; ApprovalRequest status becomes APPROVED and Action is logged."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)

    await ApprovalEngine.create_policy(db_session, comp.id, ApprovalPolicyCreateRequest(
        name="Finance Gate", code=f"GATE_{s}", document_type="PURCHASE_ORDER",
        min_amount=Decimal("50000.00"), required_role="FINANCE_CONTROLLER",
    ))

    app_req = await ApprovalEngine.submit_approval_request(
        session=db_session, company_id=comp.id,
        req=ApprovalRequestCreateRequest(
            reference_doc_type="PURCHASE_ORDER",
            reference_doc_id=f"po_{s}",
            document_amount=Decimal("75000.00"),
        ),
        requested_by="buyer_1",
    )

    # FINANCE_CONTROLLER approves
    action_res = await ApprovalEngine.process_approval_action(
        session=db_session, company_id=comp.id,
        req=ApprovalActionRequest(request_id=app_req.id, action="APPROVE", comments="Authorized by Finance"),
        action_by="cfo_user",
        action_by_role="FINANCE_CONTROLLER",
    )
    assert action_res.action == "APPROVE"

    # Verify DB state
    stmt = select(ApprovalRequest).where(ApprovalRequest.id == app_req.id)
    refreshed = (await db_session.execute(stmt)).scalars().first()
    assert refreshed.status == "APPROVED"

    stmt_acts = select(ApprovalAction).where(ApprovalAction.request_id == app_req.id)
    actions = (await db_session.execute(stmt_acts)).scalars().all()
    assert len(actions) == 1
    assert actions[0].action == "APPROVE"
    assert actions[0].action_by_role == "FINANCE_CONTROLLER"


@pytest.mark.asyncio
async def test_f_rejected_approval_marks_request_rejected(db_session):
    """TEST F: Rejection marks ApprovalRequest as REJECTED."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)

    await ApprovalEngine.create_policy(db_session, comp.id, ApprovalPolicyCreateRequest(
        name="Policy F", code=f"POL_F_{s}", document_type="PURCHASE_ORDER",
        min_amount=Decimal("50000.00"), required_role="FINANCE_CONTROLLER",
    ))

    app_req = await ApprovalEngine.submit_approval_request(
        session=db_session, company_id=comp.id,
        req=ApprovalRequestCreateRequest(
            reference_doc_type="PURCHASE_ORDER",
            reference_doc_id=f"po_f_{s}",
            document_amount=Decimal("80000.00"),
        ),
        requested_by="buyer_f",
    )

    action_res = await ApprovalEngine.process_approval_action(
        session=db_session, company_id=comp.id,
        req=ApprovalActionRequest(request_id=app_req.id, action="REJECT", comments="Exceeds quarterly budget"),
        action_by="cfo_user",
        action_by_role="FINANCE_CONTROLLER",
    )
    assert action_res.action == "REJECT"

    stmt = select(ApprovalRequest).where(ApprovalRequest.id == app_req.id)
    refreshed = (await db_session.execute(stmt)).scalars().first()
    assert refreshed.status == "REJECTED"


@pytest.mark.asyncio
async def test_g_po_amendment_crosses_threshold_triggers_re_evaluation(db_session):
    """TEST G: An amendment increasing PO amount above threshold causes approval requirement."""
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)

    # Policy: >= 50,000 requires FINANCE_CONTROLLER
    await ApprovalEngine.create_policy(db_session, comp.id, ApprovalPolicyCreateRequest(
        name="PO Threshold G", code=f"POL_G_{s}", document_type="PURCHASE_ORDER",
        min_amount=Decimal("50000.00"), required_role="FINANCE_CONTROLLER",
    ))

    # Initial order: 30,000 -> No approval needed for MANAGER
    initial_check = await ApprovalEngine.check_transaction_enforcement(
        db_session, comp.id,
        ApprovalEnforcementCheckRequest(
            document_type="PURCHASE_ORDER",
            document_amount=Decimal("30000.00"),
            caller_role="MANAGER",
        )
    )
    assert initial_check.requires_approval is False

    # After amendment: quantity increased, new total = 85,000 -> Approval NOW required
    amended_check = await ApprovalEngine.check_transaction_enforcement(
        db_session, comp.id,
        ApprovalEnforcementCheckRequest(
            document_type="PURCHASE_ORDER",
            document_amount=Decimal("85000.00"),
            caller_role="MANAGER",
        )
    )
    assert amended_check.requires_approval is True
    assert amended_check.required_role == "FINANCE_CONTROLLER"


@pytest.mark.asyncio
async def test_h_cross_tenant_approval_attempt_rejected(db_session):
    """TEST H: Approver from Tenant B cannot act on Tenant A's approval request."""
    s1 = uuid.uuid4().hex[:6]
    s2 = uuid.uuid4().hex[:6]
    comp1, br1 = await _make_tenant(db_session, s1)
    comp2, br2 = await _make_tenant(db_session, s2)

    app_req = await ApprovalEngine.submit_approval_request(
        session=db_session, company_id=comp1.id,
        req=ApprovalRequestCreateRequest(
            reference_doc_type="PURCHASE_ORDER",
            reference_doc_id=f"po_{s1}",
            document_amount=Decimal("100000.00"),
        ),
        requested_by=f"user_{s1}",
    )

    # Actor specifies company 2
    with pytest.raises(ValueError, match="not found"):
        await ApprovalEngine.process_approval_action(
            session=db_session, company_id=comp2.id,
            req=ApprovalActionRequest(request_id=app_req.id, action="APPROVE", comments="Cross-tenant approve"),
            action_by=f"cfo_{s2}",
            action_by_role="DIRECTOR",
        )
