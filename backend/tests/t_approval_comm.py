"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from decimal import Decimal
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.unified_approval import UnifiedApprovalCommunicatorService
from app.models.approval import ApprovalPolicy, ApprovalRequest, ApprovalAction
from app.models.communicator import CommunicatorTemplate, CommunicatorLog


@pytest.fixture(autouse=True)
async def cleanup_approval_communicator_data():
    """Clean up test data across both databases before and after tests."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(CommunicatorLog).where(CommunicatorLog.recipient.like("98200%")))
            await session.execute(delete(CommunicatorTemplate).where(CommunicatorTemplate.code.like("TPL-TEST-%")))
            await session.execute(delete(ApprovalAction).where(ApprovalAction.action_by.like("test_approver_%")))
            await session.execute(delete(ApprovalRequest).where(ApprovalRequest.request_no.like("APR-%")))
            await session.execute(delete(ApprovalPolicy).where(ApprovalPolicy.code.like("POL-TEST-%")))
            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(CommunicatorLog).where(CommunicatorLog.recipient.like("98200%")))
            await session.execute(delete(CommunicatorTemplate).where(CommunicatorTemplate.code.like("TPL-TEST-%")))
            await session.execute(delete(ApprovalAction).where(ApprovalAction.action_by.like("test_approver_%")))
            await session.execute(delete(ApprovalRequest).where(ApprovalRequest.request_no.like("APR-%")))
            await session.execute(delete(ApprovalPolicy).where(ApprovalPolicy.code.like("POL-TEST-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_approval_policy_threshold_trigger_and_request_creation():
    """Verify approval policy evaluation against transaction thresholds."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create policy: Invoices >= 50,000 require STORE_MANAGER
        policy = ApprovalPolicy(
            id="pol_test_invoice_50k",
            company_id="COMP-001",
            name="High Value Invoice Approval Policy",
            code="POL-TEST-INV-50K",
            document_type="SALES_INVOICE",
            min_amount=Decimal("50000.00"),
            required_role="STORE_MANAGER",
            status="ACTIVE",
            is_active=True,
            is_deleted=False
        )
        session.add(policy)
        await session.commit()

        # Case 1: Low amount (Rs 15,000) -> No approval required
        res_low = await UnifiedApprovalCommunicatorService.evaluate_and_create_approval_request(
            session=session,
            company_id="COMP-001",
            reference_doc_type="SALES_INVOICE",
            reference_doc_id="INV-TEST-LOW-01",
            document_amount=15000.00,
            requested_by="cashier_01"
        )
        assert res_low["requires_approval"] is False
        assert res_low["approval_request"] is None

        # Case 2: High amount (Rs 85,000) -> Triggers approval request
        res_high = await UnifiedApprovalCommunicatorService.evaluate_and_create_approval_request(
            session=session,
            company_id="COMP-001",
            reference_doc_type="SALES_INVOICE",
            reference_doc_id="INV-TEST-HIGH-02",
            document_amount=85000.00,
            requested_by="cashier_01"
        )
        assert res_high["requires_approval"] is True
        assert res_high["approval_request"] is not None
        assert res_high["required_role"] == "STORE_MANAGER"
        assert res_high["approval_request"].status == "PENDING"


@pytest.mark.asyncio
async def test_approval_action_decision_lifecycle():
    """Verify approval decision execution and audit action recording."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        policy = ApprovalPolicy(
            id="pol_test_po_100k",
            company_id="COMP-001",
            name="Purchase Order Approval Policy",
            code="POL-TEST-PO-100K",
            document_type="PURCHASE_ORDER",
            min_amount=Decimal("100000.00"),
            required_role="FINANCE_CONTROLLER",
            status="ACTIVE",
            is_active=True,
            is_deleted=False
        )
        session.add(policy)
        await session.commit()

        # 1. Create request
        eval_res = await UnifiedApprovalCommunicatorService.evaluate_and_create_approval_request(
            session=session,
            company_id="COMP-001",
            reference_doc_type="PURCHASE_ORDER",
            reference_doc_id="PO-TEST-9988",
            document_amount=150000.00,
            requested_by="procurement_officer_01"
        )
        req = eval_res["approval_request"]
        assert req.status == "PENDING"

        # 2. Process Approval Action
        approved_req = await UnifiedApprovalCommunicatorService.process_approval_action(
            session=session,
            company_id="COMP-001",
            request_id=req.id,
            action="APPROVE",
            action_by="test_approver_manager",
            action_by_role="FINANCE_CONTROLLER",
            comments="Approved for Q3 procurement budget"
        )

        assert approved_req.status == "APPROVED"
        assert len(approved_req.actions) == 1
        action = approved_req.actions[0]
        assert action.action == "APPROVE"
        assert action.action_by == "test_approver_manager"


@pytest.mark.asyncio
async def test_communicator_template_rendering_and_dispatch_log():
    """Verify template variable placeholder substitution and immutable dispatch logging."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        tpl = CommunicatorTemplate(
            id="tpl_test_whatsapp_01",
            company_id="COMP-001",
            name="Sales Invoice WhatsApp Notification",
            code="TPL-TEST-SALES-WA",
            channel="WHATSAPP",
            body_template="Dear {{customer_name}}, your invoice {{invoice_no}} for Rs. {{amount}} has been confirmed. Thank you!",
            status="ACTIVE",
            is_active=True,
            is_deleted=False
        )
        session.add(tpl)
        await session.commit()

        log = await UnifiedApprovalCommunicatorService.render_and_dispatch_message(
            session=session,
            company_id="COMP-001",
            template_code="TPL-TEST-SALES-WA",
            recipient="9820011223",
            context_data={
                "customer_name": "Sunil Verma",
                "invoice_no": "INV/2026-27/0045",
                "amount": "12,450.00"
            },
            reference_doc_type="SALES_INVOICE",
            reference_doc_id="inv_0045"
        )

        assert log is not None
        assert log.status == "SENT"
        assert log.channel == "WHATSAPP"
        assert "Dear Sunil Verma" in log.rendered_body
        assert "invoice INV/2026-27/0045" in log.rendered_body
        assert "Rs. 12,450.00" in log.rendered_body


@pytest.mark.asyncio
async def test_approval_and_communicator_tenant_isolation():
    """Verify approval policies and message logs are strictly isolated per tenant database."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        pol = ApprovalPolicy(
            id="pol_test_iso_01",
            company_id="COMP-001",
            name="Iso Policy",
            code="POL-TEST-ISO-01",
            document_type="SALES_INVOICE",
            min_amount=Decimal("1000.00"),
            required_role="STORE_MANAGER",
            status="ACTIVE",
            is_active=True,
            is_deleted=False
        )
        s1.add(pol)
        await s1.commit()

    async with session_002() as s2:
        stmt = select(ApprovalPolicy).where(ApprovalPolicy.code == "POL-TEST-ISO-01")
        pol2 = (await s2.execute(stmt)).scalar_one_or_none()
        assert pol2 is None, "ApprovalPolicy from smriti001 must not leak into smriti002!"
