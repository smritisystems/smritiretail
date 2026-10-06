"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI DataBridge Phase 4 Asynchronous Queue
"""

import uuid
from typing import Dict, Any
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.capability_template import TenantCapabilityBinding
from app.api.deps import get_company_db, get_current_user
from app.api.v1.databridge import require_databridge_entitlement
from app.models.outbox import IntegrationOutboxEvent
from app.models.audit import ComplianceImmutableAuditLog
from app.models.item_master import Item
from app.services.databridge.service import DataBridgeService
from app.services.databridge.async_engine import DataBridgeAsyncEngine
from app.services.databridge.models import (
    DataBridgeEntityType,
    DataBridgeAsyncSubmitRequest,
    DataBridgeAsyncJobResponse,
    DataBridgeJobStatusResponse,
)

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"
CANONICAL_COMP_ID = "COMP-001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        session.info["resolved_database_name"] = "smriti001"
        session.info["company_id"] = CANONICAL_COMP_ID
        yield session
    await engine.dispose()


def _get_auth_headers(
    role: str = "SYSADMIN",
    company_id: str = CANONICAL_COMP_ID,
    branch_id: str = "BR-MAIN-001",
    tenant_id: str = "smriti001",
):
    token = create_access_token(
        data={
            "sub": "usr-super",
            "role": role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": tenant_id,
            "db_name": tenant_id,
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
        "X-Branch-ID": branch_id,
    }


# ==============================================================================
# PHASE 4 TEST SUITE: HIGH-VOLUME ASYNCHRONOUS IMPORT & OUTBOX CHUNKING
# ==============================================================================

@pytest.mark.asyncio
async def test_tc_async_001_submit_job_returns_202_accepted(db_session: AsyncSession):
    """
    TC-ASYNC-001: Submits an async import job with chunk size 5 and verifies
    staging in integration_outbox_events table with PENDING status.
    """
    uid = uuid.uuid4().hex[:6].upper()
    rows = [
        {
            "item_code": f"ASYNC-ITM-{uid}-{i}",
            "item_name": f"Async Item {uid} #{i}",
            "brand": "SMRITI",
            "category": "Footwear",
            "primary_uom": "Pair",
            "mrp": 999.0 + i,
            "selling_price": 799.0 + i,
        }
        for i in range(12)
    ]

    req = DataBridgeAsyncSubmitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        rows=rows,
        chunk_size=5,
        filename=f"async_items_{uid}.json",
    )

    res = await DataBridgeAsyncEngine.submit_job(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert res.job_id.startswith("dbj_")
    assert res.status == "PENDING"
    assert res.total_rows == 12
    assert res.chunk_size == 5

    # Verify staged record in tenant database outbox
    stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.source_event_id == res.job_id,
        IntegrationOutboxEvent.company_id == CANONICAL_COMP_ID,
    )
    record = (await db_session.execute(stmt)).scalars().first()
    assert record is not None
    assert record.target_channel == DataBridgeAsyncEngine.TARGET_CHANNEL
    assert record.status == "PENDING"
    assert record.payload_json["total_chunks"] == 3


@pytest.mark.asyncio
async def test_tc_async_002_get_job_status(db_session: AsyncSession):
    """
    TC-ASYNC-002: Verifies querying real-time progress and status of a pending job.
    """
    uid = uuid.uuid4().hex[:6].upper()
    rows = [
        {
            "item_code": f"ASYNC-STAT-{uid}-{i}",
            "item_name": f"Async Status Item {uid} #{i}",
            "brand": "SMRITI",
            "category": "Footwear",
            "primary_uom": "Pair",
        }
        for i in range(6)
    ]

    req = DataBridgeAsyncSubmitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        rows=rows,
        chunk_size=3,
    )

    submit_res = await DataBridgeAsyncEngine.submit_job(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    status_res = await DataBridgeAsyncEngine.get_job_status(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        job_id=submit_res.job_id,
    )

    assert status_res.job_id == submit_res.job_id
    assert status_res.status == "PENDING"
    assert status_res.total_rows == 6
    assert status_res.processed_rows == 0
    assert status_res.progress_percent == 0.0
    assert status_res.total_chunks == 2


@pytest.mark.asyncio
async def test_tc_async_003_process_chunks_to_completion(db_session: AsyncSession):
    """
    TC-ASYNC-003: Processes all chunks of an async import job and verifies
    status transitions to COMPLETED, progress reaches 100%, and records are persisted.
    """
    uid = uuid.uuid4().hex[:6].upper()
    codes = [f"ASYNC-PROC-{uid}-{i}" for i in range(4)]
    rows = [
        {
            "item_code": code,
            "item_name": f"Async Proc Item {uid} #{i}",
            "brand": "SMRITI",
            "category": "Footwear",
            "primary_uom": "Pair",
            "mrp": 1200.0,
            "selling_price": 950.0,
        }
        for i, code in enumerate(codes)
    ]

    req = DataBridgeAsyncSubmitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        rows=rows,
        chunk_size=2,
    )

    submit_res = await DataBridgeAsyncEngine.submit_job(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    final_status = await DataBridgeAsyncEngine.process_job_chunks(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        job_id=submit_res.job_id,
        max_chunks=None,
    )

    assert final_status.status == "COMPLETED"
    assert final_status.processed_rows == 4
    assert final_status.committed_count == 4
    assert final_status.progress_percent == 100.0
    assert final_status.compliance_sha256 is not None

    # Verify actual persistence in items table
    stmt = select(Item).where(Item.item_code.in_(codes), Item.company_id == CANONICAL_COMP_ID)
    items = (await db_session.execute(stmt)).scalars().all()
    assert len(items) == 4


@pytest.mark.asyncio
async def test_tc_async_004_worm_audit_log_on_completion(db_session: AsyncSession):
    """
    TC-ASYNC-004: Verifies tamper-evident WORM audit logging inside
    compliance_immutable_audit_logs upon async job completion.
    """
    uid = uuid.uuid4().hex[:6].upper()
    rows = [
        {
            "item_code": f"ASYNC-WORM-{uid}",
            "item_name": f"WORM Item {uid}",
            "brand": "SMRITI",
            "category": "Footwear",
            "primary_uom": "Pair",
        }
    ]

    req = DataBridgeAsyncSubmitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        rows=rows,
        chunk_size=10,
    )

    submit_res = await DataBridgeAsyncEngine.submit_job(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    final_status = await DataBridgeAsyncEngine.process_job_chunks(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        job_id=submit_res.job_id,
    )

    assert final_status.status == "COMPLETED"
    assert final_status.compliance_sha256 is not None

    stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.entity_id == submit_res.job_id,
        ComplianceImmutableAuditLog.company_id == CANONICAL_COMP_ID,
    )
    audit_entry = (await db_session.execute(stmt)).scalars().first()
    assert audit_entry is not None
    assert audit_entry.event_type == "DATABRIDGE_ASYNC_COMMIT"
    assert audit_entry.payload_hash == final_status.compliance_sha256
    assert audit_entry.hash_chain_verified is True


@pytest.mark.asyncio
async def test_tc_async_005_idempotent_submission(db_session: AsyncSession):
    """
    TC-ASYNC-005: Verifies that submitting with an existing idempotency key
    returns the staged job instead of duplicating rows.
    """
    uid = uuid.uuid4().hex[:6].upper()
    idemp_key = f"idemp-async-{uid}"

    req = DataBridgeAsyncSubmitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        rows=[{"item_code": f"IDEMP-{uid}", "item_name": "Idemp Item"}],
        idempotency_key=idemp_key,
    )

    res1 = await DataBridgeAsyncEngine.submit_job(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    res2 = await DataBridgeAsyncEngine.submit_job(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert res1.job_id == res2.job_id
    assert "Idempotent replay" in res2.message


@pytest.mark.asyncio
async def test_tc_async_006_cancel_job(db_session: AsyncSession):
    """
    TC-ASYNC-006: Verifies cancelling an active or pending job transitions
    status to CANCELLED in both payload and outbox record.
    """
    uid = uuid.uuid4().hex[:6].upper()
    req = DataBridgeAsyncSubmitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        rows=[{"item_code": f"CANCEL-{uid}", "item_name": "Cancel Item"}],
    )

    submit_res = await DataBridgeAsyncEngine.submit_job(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    cancel_res = await DataBridgeAsyncEngine.cancel_job(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        job_id=submit_res.job_id,
    )

    assert cancel_res.status == "CANCELLED"

    # Verify outbox event status
    stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.source_event_id == submit_res.job_id,
    )
    rec = (await db_session.execute(stmt)).scalars().first()
    assert rec.status == "CANCELLED"


@pytest.mark.asyncio
async def test_tc_async_007_rest_endpoints_e2e_lifecycle(db_session: AsyncSession):
    """
    TC-ASYNC-007: End-to-end REST lifecycle via FastAPI:
    submit (202 Accepted) -> status (PENDING) -> process-next -> status (COMPLETED).
    """
    uid = uuid.uuid4().hex[:6].upper()
    test_user = User(
        id=f"usr-test-{uid}",
        username=f"admin_{uid}",
        email=f"admin_{uid}@smritibooks.com",
        role=UserRole.SYSADMIN,
        is_active=True,
    )
    test_binding = TenantCapabilityBinding(
        id=f"bind_{uid}",
        company_id=CANONICAL_COMP_ID,
        capability_code="DATABRIDGE",
        is_enabled=True,
        status="ACTIVE",
    )

    app.dependency_overrides[get_company_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[require_databridge_entitlement] = lambda: test_binding

    transport = ASGITransport(app=app)
    headers = _get_auth_headers()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Submit job
        submit_payload = {
            "entity_type": "ITEM",
            "rows": [
                {
                    "item_code": f"E2E-ASYNC-{uid}-1",
                    "item_name": f"E2E Async Item {uid} 1",
                    "brand": "SMRITI",
                    "category": "Footwear",
                    "primary_uom": "Pair",
                    "mrp": 1500.0,
                    "selling_price": 1200.0,
                },
                {
                    "item_code": f"E2E-ASYNC-{uid}-2",
                    "item_name": f"E2E Async Item {uid} 2",
                    "brand": "SMRITI",
                    "category": "Footwear",
                    "primary_uom": "Pair",
                    "mrp": 1800.0,
                    "selling_price": 1400.0,
                },
            ],
            "chunk_size": 2,
            "filename": f"e2e_{uid}.json",
        }

        sub_resp = await client.post(
            "/api/v1/databridge/async/submit",
            json=submit_payload,
            headers=headers,
        )
        assert sub_resp.status_code == 202
        sub_data = sub_resp.json()
        job_id = sub_data["job_id"]
        assert job_id.startswith("dbj_")
        assert sub_data["status"] == "PENDING"

        # Step 2: Poll status
        stat_resp = await client.get(
            f"/api/v1/databridge/async/status/{job_id}",
            headers=headers,
        )
        assert stat_resp.status_code == 200
        stat_data = stat_resp.json()
        assert stat_data["status"] == "PENDING"
        assert stat_data["total_rows"] == 2

        # Step 3: Trigger process-next
        proc_resp = await client.post(
            "/api/v1/databridge/async/process-next",
            params={"job_id": job_id},
            headers=headers,
        )
        assert proc_resp.status_code == 200

        # Step 4: Verify completion
        final_stat_resp = await client.get(
            f"/api/v1/databridge/async/status/{job_id}",
            headers=headers,
        )
        assert final_stat_resp.status_code == 200
        final_stat = final_stat_resp.json()
        assert final_stat["status"] == "COMPLETED"
        assert final_stat["progress_percent"] == 100.0
        assert final_stat["committed_count"] == 2
        assert final_stat["compliance_sha256"] is not None

    app.dependency_overrides.clear()
