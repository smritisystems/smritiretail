"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.37.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import time
import uuid
import pytest
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db
from app.models.auth import User, UserRole
from app.models.api_key import SMRITIServiceAccount, SMRITIAPIKey
from app.models.approval import (
    SMRITIApprovalPolicy,
    SMRITIApprovalMatrix,
    SMRITIApprovalStep,
    SMRITIApprovalRequest,
    ApprovalRequestStatus,
)
from app.services.api_key_service import APIKeyService
from app.services.approval_fsm import ApprovalFSM
from app.services.approval_resolver import ASTSafeEvaluator
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
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
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


@pytest.mark.asyncio
async def test_concurrent_api_key_authentications(db_session):
    """Simulates 50 API Key secret verification operations."""
    svc = APIKeyService()
    sa = await svc.create_service_account(
        db=db_session,
        code="SA-STRESS-01",
        name="High Volume Stress Agent",
    )

    gen = await svc.generate_api_key(
        db=db_session,
        service_account_id=sa.id,
        name="Stress Key 1",
        permission_set_ids=[],
    )

    raw_key = gen["raw_key"]

    start_time = time.time()
    for _ in range(50):
        auth_key = await svc.authenticate_api_key(db=db_session, raw_key=raw_key)
        assert auth_key.id == gen["api_key_id"]
    duration = time.time() - start_time

    assert duration < 5.0, f"50 authentications took too long: {duration:.2f}s"


@pytest.mark.asyncio
async def test_optimistic_locking_race_condition(db_session):
    """Verifies that simultaneous approval actions on identical versions produce clean locking conflicts."""
    user_a = User(
        id="usr-admin-a",
        username="admin_a",
        hashed_password="hashed_password",
        role=UserRole.SYSADMIN,
        is_platform_admin=True,
    )
    user_b = User(
        id="usr-admin-b",
        username="admin_b",
        hashed_password="hashed_password",
        role=UserRole.SYSADMIN,
        is_platform_admin=True,
    )
    db_session.add_all([user_a, user_b])

    policy = SMRITIApprovalPolicy(
        id=str(uuid.uuid4()),
        code="POL-RACE-01",
        name="Race Condition Policy",
        document_type="PurchaseOrder",
    )
    matrix = SMRITIApprovalMatrix(
        id=str(uuid.uuid4()),
        policy_id=policy.id,
        matrix_name="Race Matrix",
        min_amount=1000.00,
    )
    step = SMRITIApprovalStep(
        id=str(uuid.uuid4()),
        matrix_id=matrix.id,
        step_number=1,
        step_name="SYSADMIN Step",
        strategy="SEQUENTIAL",
    )
    db_session.add_all([policy, matrix, step])
    await db_session.commit()

    fsm = ApprovalFSM()
    payload = {"amount": 5000.00}

    sub_res = await fsm.submit_document(
        db=db_session,
        document_type="PurchaseOrder",
        document_id="po-race-100",
        payload=payload,
        requester_id="usr-buyer-01",
    )
    request_id = sub_res["request_id"]

    # Task A attempts approval at expected_version 1
    res_a = await fsm.execute_action(
        db=db_session,
        request_id=request_id,
        user_id="usr-admin-a",
        user_role="SYSADMIN",
        action="APPROVE",
        payload=payload,
        expected_version=1,
        remarks="Action A",
    )
    assert res_a["success"] is True

    # Task B attempts approval at stale expected_version 1
    with pytest.raises(ValueError, match="Concurrency conflict"):
        await fsm.execute_action(
            db=db_session,
            request_id=request_id,
            user_id="usr-admin-b",
            user_role="SYSADMIN",
            action="APPROVE",
            payload=payload,
            expected_version=1,
            remarks="Action B Stale",
        )


@pytest.mark.asyncio
async def test_policy_cache_performance_under_load():
    """Evaluates AST condition evaluation throughput over 100 iterations."""
    condition = "amount > 50000 and supplier_rating >= 4.5"
    payload = {"amount": 75000, "supplier_rating": 4.8}
    evaluator = ASTSafeEvaluator(context=payload)

    start_time = time.time()
    for _ in range(100):
        eval_res = evaluator.eval(condition)
        assert eval_res is True
    duration = time.time() - start_time

    assert duration < 0.1, f"100 AST condition evaluations took too long: {duration:.4f}s"
