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
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.approval import ApprovalPolicy, ApprovalRequest, ApprovalAction
from app.services.approval_engine import ApprovalEngine
from app.schemas.approval import (
    ApprovalPolicyCreateRequest,
    ApprovalEnforcementCheckRequest,
    ApprovalRequestCreateRequest,
    ApprovalActionRequest,
    ApprovalEscalationRequest,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
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
async def test_approval_policy_creation_and_listing():
    """Verify creation and query of multi-tier approval policies."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        pol1 = await ApprovalEngine.create_policy(
            session=session,
            company_id="COMP-001",
            req=ApprovalPolicyCreateRequest(
                name=f"Manager PO Approval {unique_suffix}",
                code=f"POL_PO_MGR_{unique_suffix.upper()}",
                document_type=f"PURCHASE_ORDER_{unique_suffix.upper()}",
                min_amount=Decimal("5000.00"),
                max_amount=Decimal("50000.00"),
                required_role="STORE_MANAGER",
                priority=1,
            ),
            created_by="usr-super",
        )
        assert pol1.required_role == "STORE_MANAGER"
        assert pol1.min_amount == Decimal("5000.00")

        pol2 = await ApprovalEngine.create_policy(
            session=session,
            company_id="COMP-001",
            req=ApprovalPolicyCreateRequest(
                name=f"Director PO Approval {unique_suffix}",
                code=f"POL_PO_DIR_{unique_suffix.upper()}",
                document_type=f"PURCHASE_ORDER_{unique_suffix.upper()}",
                min_amount=Decimal("50000.01"),
                max_amount=None,
                required_role="DIRECTOR",
                priority=2,
            ),
            created_by="usr-super",
        )
        assert pol2.required_role == "DIRECTOR"
        assert pol2.priority == 2


@pytest.mark.asyncio
async def test_transaction_approval_enforcement_evaluation():
    """Verify transaction gating: high amounts require approval for low-privilege roles."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    doc_type = f"SALES_INVOICE_{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create policy: Discount exception > ₹1,000 requires STORE_MANAGER
        await ApprovalEngine.create_policy(
            session=session,
            company_id="COMP-001",
            req=ApprovalPolicyCreateRequest(
                name=f"Discount Approval {unique_suffix}",
                code=f"POL_DISC_{unique_suffix.upper()}",
                document_type=doc_type,
                min_amount=Decimal("1000.00"),
                max_amount=None,
                required_role="STORE_MANAGER",
            ),
        )

        # 1. CASHIER requesting ₹1,500 -> Requires Approval
        check_cashier = await ApprovalEngine.check_transaction_enforcement(
            session=session,
            company_id="COMP-001",
            req=ApprovalEnforcementCheckRequest(
                document_type=doc_type,
                document_amount=Decimal("1500.00"),
                caller_role="CASHIER",
            ),
        )
        assert check_cashier.requires_approval == True
        assert check_cashier.required_role == "STORE_MANAGER"

        # 2. STORE_MANAGER requesting ₹1,500 -> Permitted directly
        check_mgr = await ApprovalEngine.check_transaction_enforcement(
            session=session,
            company_id="COMP-001",
            req=ApprovalEnforcementCheckRequest(
                document_type=doc_type,
                document_amount=Decimal("1500.00"),
                caller_role="STORE_MANAGER",
            ),
        )
        assert check_mgr.requires_approval == False

        # 3. CASHIER requesting ₹500 (below threshold) -> Permitted directly
        check_low = await ApprovalEngine.check_transaction_enforcement(
            session=session,
            company_id="COMP-001",
            req=ApprovalEnforcementCheckRequest(
                document_type=doc_type,
                document_amount=Decimal("500.00"),
                caller_role="CASHIER",
            ),
        )
        assert check_low.requires_approval == False


@pytest.mark.asyncio
async def test_submit_approval_request_lifecycle():
    """Verify submitting approval requests with status PENDING and correct role assignment."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    doc_type = f"CREDIT_MEMO_{unique_suffix.upper()}"

    async with sessionmaker() as session:
        await ApprovalEngine.create_policy(
            session=session,
            company_id="COMP-001",
            req=ApprovalPolicyCreateRequest(
                name=f"Credit Policy {unique_suffix}",
                code=f"POL_CM_{unique_suffix.upper()}",
                document_type=doc_type,
                min_amount=Decimal("10000.00"),
                required_role="FINANCE_CONTROLLER",
            ),
        )

        app_req = await ApprovalEngine.submit_approval_request(
            session=session,
            company_id="COMP-001",
            req=ApprovalRequestCreateRequest(
                reference_doc_type=doc_type,
                reference_doc_id=f"cm_{unique_suffix}",
                document_amount=Decimal("25000.00"),
                notes="Customer goodwill credit memo over threshold",
            ),
            requested_by="usr-cashier-1",
        )
        assert app_req.status == "PENDING"
        assert app_req.current_assigned_role == "FINANCE_CONTROLLER"
        assert app_req.document_amount == Decimal("25000.00")
        assert app_req.request_no.startswith("APR-")


@pytest.mark.asyncio
async def test_process_approval_action_authorized_and_unauthorized():
    """Verify RBAC authorization: authorized approvers can approve, unauthorized callers fail-closed."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Submit request assigned to STORE_MANAGER
        app_req = await ApprovalEngine.submit_approval_request(
            session=session,
            company_id="COMP-001",
            req=ApprovalRequestCreateRequest(
                reference_doc_type="SALES_INVOICE",
                reference_doc_id=f"inv_app_{unique_suffix}",
                document_amount=Decimal("12000.00"),
            ),
            requested_by="usr-cashier-1",
        )

        # 1. Unauthorized attempt by CASHIER -> Must fail
        with pytest.raises(ValueError, match="Access Denied"):
            await ApprovalEngine.process_approval_action(
                session=session,
                company_id="COMP-001",
                req=ApprovalActionRequest(request_id=app_req.id, action="APPROVE"),
                action_by="usr-cashier-1",
                action_by_role="CASHIER",
            )

        # 2. Authorized approval by STORE_MANAGER -> Must succeed
        action_res = await ApprovalEngine.process_approval_action(
            session=session,
            company_id="COMP-001",
            req=ApprovalActionRequest(request_id=app_req.id, action="APPROVE", comments="Approved after review"),
            action_by="usr-manager-1",
            action_by_role="STORE_MANAGER",
        )
        assert action_res.new_status == "APPROVED"
        assert action_res.action_by_role == "STORE_MANAGER"

        # Verify audit log in database
        stmt_log = select(ApprovalAction).where(ApprovalAction.request_id == app_req.id)
        actions = (await session.execute(stmt_log)).scalars().all()
        assert len(actions) == 1
        assert actions[0].action == "APPROVE"
        assert actions[0].comments == "Approved after review"


@pytest.mark.asyncio
async def test_escalation_workflow():
    """Verify request escalation to higher authority level."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        app_req = await ApprovalEngine.submit_approval_request(
            session=session,
            company_id="COMP-001",
            req=ApprovalRequestCreateRequest(
                reference_doc_type="PURCHASE_ORDER",
                reference_doc_id=f"po_esc_{unique_suffix}",
                document_amount=Decimal("75000.00"),
            ),
            requested_by="usr-buyer-1",
        )
        assert app_req.current_assigned_role == "STORE_MANAGER"

        # Escalate to DIRECTOR
        esc_res = await ApprovalEngine.escalate_approval_request(
            session=session,
            company_id="COMP-001",
            req=ApprovalEscalationRequest(
                request_id=app_req.id,
                escalate_to_role="DIRECTOR",
                reason="High-value procurement requiring board authorization",
            ),
            action_by="usr-manager-1",
            action_by_role="STORE_MANAGER",
        )
        assert esc_res.previous_role == "STORE_MANAGER"
        assert esc_res.new_role == "DIRECTOR"


@pytest.mark.asyncio
async def test_api_approval_endpoints():
    """Verify REST API approval endpoints: policies, enforce, requests, action, escalate."""
    unique_suffix = uuid.uuid4().hex[:4]
    doc_type = f"API_DOC_{unique_suffix.upper()}"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create policy via API
        pol_res = await client.post(
            "/api/v1/approval/policies",
            json={
                "name": f"API Policy {unique_suffix}",
                "code": f"POL_API_{unique_suffix.upper()}",
                "document_type": doc_type,
                "min_amount": 5000.0,
                "required_role": "STORE_MANAGER",
                "priority": 1,
            },
            headers=_get_auth_headers(role="SYSADMIN"),
        )
        assert pol_res.status_code == 201

        # 2. Check enforcement via API
        enf_res = await client.post(
            "/api/v1/approval/enforce",
            json={"document_type": doc_type, "document_amount": 7500.0},
            headers=_get_auth_headers(role="CASHIER"),
        )
        assert enf_res.status_code == 200
        assert enf_res.json()["requires_approval"] == True

        # 3. Submit request via API
        req_res = await client.post(
            "/api/v1/approval/requests",
            json={
                "reference_doc_type": doc_type,
                "reference_doc_id": f"ref_{unique_suffix}",
                "document_amount": 7500.0,
                "notes": "API test approval request",
            },
            headers=_get_auth_headers(role="CASHIER"),
        )
        assert req_res.status_code == 201
        req_id = req_res.json()["id"]

        # 4. Escalate via API
        esc_res = await client.post(
            "/api/v1/approval/escalate",
            json={"request_id": req_id, "escalate_to_role": "DIRECTOR", "reason": "Urgent escalation"},
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert esc_res.status_code == 200
        assert esc_res.json()["new_role"] == "DIRECTOR"

        # 5. Approve via API (as DIRECTOR)
        act_res = await client.post(
            "/api/v1/approval/action",
            json={"request_id": req_id, "action": "APPROVE", "comments": "Final director approval"},
            headers=_get_auth_headers(role="DIRECTOR"),
        )
        assert act_res.status_code == 200
        assert act_res.json()["new_status"] == "APPROVED"
