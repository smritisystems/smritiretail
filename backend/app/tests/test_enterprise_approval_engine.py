"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db, get_tenant_context
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.approval import (
    ApprovalRequestStatus,
    SMRITIApprovalPolicy,
    SMRITIApprovalMatrix,
    SMRITIApprovalStep,
    SMRITIApprovalCondition,
    SMRITIApprovalRequest,
    SMRITIApprovalOutbox,
    SMRITIApprovalDelegation,
)
from app.services.approval_resolver import ApprovalResolver
from app.services.approval_fsm import ApprovalFSM
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    ApprovalResolver.clear_cache()
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    ApprovalResolver.clear_cache()
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


def _bearer(user: User) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
        "company_id": "comp-test",
        "branch_id": "br-test",
        "is_platform_admin": user.is_platform_admin,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_ast_safe_evaluator():
    """Test ASTSafeEvaluator multi-attribute rule condition evaluation."""
    resolver = ApprovalResolver()
    ctx = {
        "Amount": 75000.00,
        "Margin": 0.05,
        "Category": "IMPORTED",
        "Store": {"Region": "WEST"},
    }
    # Test valid expression matching
    expr_true = "Amount > 50000 AND Margin < 0.08 AND Category == 'IMPORTED'"
    assert resolver.evaluate_condition(expr_true, ctx) is True

    # Test failing expression
    expr_false = "Amount > 100000 OR Category == 'LOCAL'"
    assert resolver.evaluate_condition(expr_false, ctx) is False


@pytest.mark.asyncio
async def test_submit_document_auto_approval_when_no_policy(db_session):
    """Test auto-approval when no policy matches the document type."""
    fsm = ApprovalFSM()
    payload = {"amount": 10000.00, "supplier": "Local Vendor"}
    res = await fsm.submit_document(
        db=db_session,
        document_type="NonExistentDocType",
        document_id="doc-001",
        payload=payload,
        requester_id="usr-staff-1",
    )
    assert res["approved"] is True
    assert res["auto_approved"] is True


@pytest.mark.asyncio
async def test_submit_document_and_execute_approval_flow(db_session):
    """Test full multi-level approval submission, step execution, and outbox event creation."""
    # 1. Setup policy and matrix
    policy = SMRITIApprovalPolicy(
        id=str(uuid.uuid4()),
        code="POL-PO-01",
        name="Purchase Order Policy",
        document_type="PurchaseOrder",
        priority=1,
    )
    matrix = SMRITIApprovalMatrix(
        id=str(uuid.uuid4()),
        policy_id=policy.id,
        matrix_name="PO Threshold Band 50k+",
        min_amount=50000.00,
    )
    step1 = SMRITIApprovalStep(
        id=str(uuid.uuid4()),
        matrix_id=matrix.id,
        step_number=1,
        step_name="Manager Approval",
        strategy="SEQUENTIAL",
    )
    db_session.add(policy)
    db_session.add(matrix)
    db_session.add(step1)
    await db_session.commit()

    # 2. Submit document above threshold
    fsm = ApprovalFSM()
    payload = {"amount": 80000.00, "supplier": "Apex Distributers"}
    sub_res = await fsm.submit_document(
        db=db_session,
        document_type="PurchaseOrder",
        document_id="po-999",
        payload=payload,
        requester_id="usr-buyer-01",
    )
    assert sub_res["approved"] is False
    assert sub_res["status"] == ApprovalRequestStatus.PENDING.value
    request_id = sub_res["request_id"]

    # Verify outbox event created
    outbox_res = await db_session.execute(
        select(SMRITIApprovalOutbox).where(SMRITIApprovalOutbox.event_type == "approval.requested")
    )
    outbox_events = outbox_res.scalars().all()
    assert len(outbox_events) == 1
    assert outbox_events[0].payload_json["document_id"] == "po-999"

    # 3. Execute step approval
    app_res = await fsm.execute_action(
        db=db_session,
        request_id=request_id,
        user_id="usr-manager-01",
        user_role="MANAGER",
        action="APPROVE",
        payload=payload,
        expected_version=1,
        remarks="Approved by Branch Manager",
    )
    assert app_res["success"] is True
    assert app_res["status"] == ApprovalRequestStatus.APPROVED.value

    # 4. Verify tampering detection with altered payload
    altered_payload = {"amount": 120000.00, "supplier": "Apex Distributers"}
    with pytest.raises(ValueError, match="integrity mismatch"):
        await fsm.execute_action(
            db=db_session,
            request_id=request_id,
            user_id="usr-manager-01",
            user_role="MANAGER",
            action="APPROVE",
            payload=altered_payload,
            expected_version=2,
        )


@pytest.mark.asyncio
async def test_emergency_platform_admin_override(db_session):
    """Test emergency override executed by a platform administrator."""
    # 1. Setup policy
    policy = SMRITIApprovalPolicy(
        id=str(uuid.uuid4()),
        code="POL-SO-01",
        name="Sales Order Policy",
        document_type="SalesOrder",
        priority=1,
    )
    matrix = SMRITIApprovalMatrix(
        id=str(uuid.uuid4()),
        policy_id=policy.id,
        matrix_name="SO Band",
        min_amount=10000.00,
    )
    step1 = SMRITIApprovalStep(
        id=str(uuid.uuid4()),
        matrix_id=matrix.id,
        step_number=1,
        step_name="Supervisor Approval",
    )
    db_session.add(policy)
    db_session.add(matrix)
    db_session.add(step1)
    await db_session.commit()

    fsm = ApprovalFSM()
    payload = {"amount": 25000.00}
    sub_res = await fsm.submit_document(
        db=db_session,
        document_type="SalesOrder",
        document_id="so-777",
        payload=payload,
        requester_id="usr-cashier-01",
    )
    request_id = sub_res["request_id"]

    # Attempt override by non-admin should raise PermissionError
    with pytest.raises(PermissionError):
        await fsm.execute_action(
            db=db_session,
            request_id=request_id,
            user_id="usr-staff-01",
            user_role="STAFF",
            action="OVERRIDE",
            payload=payload,
            expected_version=1,
            is_platform_admin=False,
        )

    # Admin emergency override succeeds
    ov_res = await fsm.execute_action(
        db=db_session,
        request_id=request_id,
        user_id="usr-admin-01",
        user_role="SYSADMIN",
        action="OVERRIDE",
        payload=payload,
        expected_version=1,
        remarks="Emergency override for urgent dispatch",
        is_platform_admin=True,
    )
    assert ov_res["success"] is True
    assert ov_res["status"] == ApprovalRequestStatus.APPROVED.value


@pytest.mark.asyncio
async def test_approvals_api_endpoints(db_session):
    """Test REST API endpoints /api/v1/approvals/pending and /api/v1/approvals/dashboard."""
    user = User(
        id="usr-api-admin",
        username="admin_user",
        hashed_password="hashed_password",
        role=UserRole.SYSADMIN,
        is_platform_admin=True,
    )
    db_session.add(user)
    await db_session.commit()

    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id="comp-test", branch_id="br-test")

    headers = _bearer(user)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test pending list
        res_pending = await client.get("/api/v1/approvals/pending", headers=headers)
        assert res_pending.status_code == 200
        assert isinstance(res_pending.json(), list)

        # Test dashboard metrics
        res_dash = await client.get("/api/v1/approvals/dashboard", headers=headers)
        assert res_dash.status_code == 200
        data = res_dash.json()
        assert "pending_approvals_count" in data
        assert "cache_hit_rate_percentage" in data

    app.dependency_overrides.pop(get_tenant_context, None)
