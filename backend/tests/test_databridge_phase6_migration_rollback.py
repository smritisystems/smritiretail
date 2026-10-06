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
Classification: Automated Test Suite — SMRITI DataBridge Phase 6 Migration Toolkit & Rollback Engine
"""

import io
import json
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.capability_template import TenantCapabilityBinding
from app.api.deps import get_company_db, get_current_user, get_db
from app.api.v1.databridge import require_databridge_entitlement
from app.models.audit import ComplianceImmutableAuditLog
from app.models.item_master import Item
from app.models.crm import Customer
from app.services.databridge.migration_engine import DataBridgeMigrationToolkit
from app.services.databridge.models import (
    DataBridgeEntityType,
    DataBridgeRollbackRequest,
    DataBridgeRollbackResponse,
    DataBridgeTenantTransferRequest,
    DataBridgeTenantTransferResponse,
)
from app.services.databridge.exceptions import DataBridgePermissionError

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
# PHASE 6 TEST SUITE: MIGRATION TOOLKIT & REVERSIBLE ROLLBACK ENGINE
# ==============================================================================

@pytest.mark.asyncio
async def test_tc_migr_001_rollback_created_records_soft_delete(db_session: AsyncSession):
    """
    TC-MIGR-001: Verifies that rollback marks created entities as is_deleted=True
    without performing destructive hard SQL DELETE queries.
    """
    uid = uuid.uuid4().hex[:6].upper()
    batch_tag = f"batch_{uid}"
    item_id = f"itm_rbk_{uid}"

    test_item = Item(
        id=item_id,
        company_id=CANONICAL_COMP_ID,
        item_code=f"RBK-ITM-{uid}",
        item_name=f"Rollback Item {uid}",
        brand="SMRITI",
        category="Apparel",
        primary_uom="PCS",
        mrp=999.0,
        selling_price=799.0,
        cost_price=400.0,
        is_active=True,
        is_deleted=False,
        created_by=batch_tag,
    )
    db_session.add(test_item)
    await db_session.commit()

    req = DataBridgeRollbackRequest(
        job_or_batch_id=batch_tag,
        entity_type=DataBridgeEntityType.ITEM,
        reason=f"Operator uploaded incorrect price list for batch {batch_tag}",
        dry_run=False,
    )

    res: DataBridgeRollbackResponse = await DataBridgeMigrationToolkit.execute_rollback(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert res.status == "COMPLETED"
    assert res.reverted_creates == 1
    assert item_id in res.affected_ids
    assert len(res.compliance_sha256) == 64

    # Verify soft-delete in database
    refreshed = (await db_session.execute(select(Item).where(Item.id == item_id))).scalars().first()
    assert refreshed is not None
    assert refreshed.is_deleted is True
    assert refreshed.deleted_at is not None
    assert refreshed.deleted_by == "usr-super"


@pytest.mark.asyncio
async def test_tc_migr_002_rollback_dry_run_simulation(db_session: AsyncSession):
    """
    TC-MIGR-002: Verifies that dry_run=True simulates rollback metrics without mutating DB rows.
    """
    uid = uuid.uuid4().hex[:6].upper()
    batch_tag = f"batch_dry_{uid}"
    item_id = f"itm_dry_{uid}"

    test_item = Item(
        id=item_id,
        company_id=CANONICAL_COMP_ID,
        item_code=f"DRY-ITM-{uid}",
        item_name=f"Dry Run Item {uid}",
        brand="SMRITI",
        category="Apparel",
        primary_uom="PCS",
        mrp=1200.0,
        selling_price=999.0,
        is_active=True,
        is_deleted=False,
        created_by=batch_tag,
    )
    db_session.add(test_item)
    await db_session.commit()

    req = DataBridgeRollbackRequest(
        job_or_batch_id=batch_tag,
        entity_type=DataBridgeEntityType.ITEM,
        reason="Testing dry-run rollback impact analysis",
        dry_run=True,
    )

    res = await DataBridgeMigrationToolkit.execute_rollback(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert res.status == "SIMULATED"
    assert res.dry_run is True
    assert res.reverted_creates == 1
    assert item_id in res.affected_ids

    # Verify record was NOT modified in database
    refreshed = (await db_session.execute(select(Item).where(Item.id == item_id))).scalars().first()
    assert refreshed is not None
    assert refreshed.is_deleted is False


@pytest.mark.asyncio
async def test_tc_migr_003_rollback_tenant_boundary_protection(db_session: AsyncSession):
    """
    TC-MIGR-003: Verifies unprivileged roles and cross-tenant attempts are rejected.
    """
    req = DataBridgeRollbackRequest(
        job_or_batch_id="batch_unauth",
        entity_type=DataBridgeEntityType.ITEM,
        reason="Unauthorized rollback attempt",
        dry_run=False,
    )

    # CASHIER / STORE_ASSOCIATE role must be rejected
    with pytest.raises(DataBridgePermissionError):
        await DataBridgeMigrationToolkit.execute_rollback(
            company_db=db_session,
            company_id=CANONICAL_COMP_ID,
            actor_id="usr-cashier",
            actor_role="CASHIER",
            req=req,
        )


@pytest.mark.asyncio
async def test_tc_migr_004_rollback_worm_audit_chain(db_session: AsyncSession):
    """
    TC-MIGR-004: Verifies that completed rollbacks produce tamper-evident WORM audit logs.
    """
    uid = uuid.uuid4().hex[:6].upper()
    item_id = f"itm_aud_{uid}"

    test_item = Item(
        id=item_id,
        company_id=CANONICAL_COMP_ID,
        item_code=f"AUD-ITM-{uid}",
        item_name=f"Audit Item {uid}",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(test_item)
    await db_session.commit()

    req = DataBridgeRollbackRequest(
        job_or_batch_id=item_id,
        entity_type=DataBridgeEntityType.ITEM,
        reason="Audited rollback test execution",
        dry_run=False,
    )

    res = await DataBridgeMigrationToolkit.execute_rollback(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="ADMIN",
        req=req,
    )

    stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.entity_id == res.rollback_id,
        ComplianceImmutableAuditLog.company_id == CANONICAL_COMP_ID,
    )
    audit = (await db_session.execute(stmt)).scalars().first()
    assert audit is not None
    assert audit.event_type == "DATABRIDGE_ROLLBACK_EXECUTED"
    assert audit.hash_chain_verified is True
    assert "Rolled back" in audit.action_summary


@pytest.mark.asyncio
async def test_tc_migr_005_tenant_transfer_preview_mode(db_session: AsyncSession):
    """
    TC-MIGR-005: Tests cross-tenant replication in PREVIEW_ONLY mode.
    """
    req = DataBridgeTenantTransferRequest(
        source_company_id=CANONICAL_COMP_ID,
        target_company_id=CANONICAL_COMP_ID,
        entity_types=[DataBridgeEntityType.ITEM],
        transfer_mode="PREVIEW_ONLY",
        limit_per_entity=5,
    )

    res = await DataBridgeMigrationToolkit.execute_tenant_transfer(
        source_db=db_session,
        target_db=db_session,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert res.status == "PREVIEWED"
    assert res.transfer_mode == "PREVIEW_ONLY"
    assert "ITEM" in res.entity_summaries
    assert res.entity_summaries["ITEM"]["status"] == "PREVIEWED"


@pytest.mark.asyncio
async def test_tc_migr_006_tenant_transfer_commit_mode(db_session: AsyncSession):
    """
    TC-MIGR-006: Tests cross-tenant replication in COMMIT mode.
    """
    req = DataBridgeTenantTransferRequest(
        source_company_id=CANONICAL_COMP_ID,
        target_company_id=CANONICAL_COMP_ID,
        entity_types=[DataBridgeEntityType.ITEM],
        transfer_mode="COMMIT",
        limit_per_entity=5,
    )

    res = await DataBridgeMigrationToolkit.execute_tenant_transfer(
        source_db=db_session,
        target_db=db_session,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert res.status == "COMMITTED"
    assert res.transfer_mode == "COMMIT"
    assert "ITEM" in res.entity_summaries
    assert res.entity_summaries["ITEM"]["status"] == "COMMITTED"
    assert len(res.compliance_sha256) == 64


@pytest.mark.asyncio
async def test_tc_migr_007_rest_api_endpoints(db_session: AsyncSession):
    """
    TC-MIGR-007: Tests FastAPI POST /rollback and POST /sync/tenant-transfer endpoints.
    """
    uid = uuid.uuid4().hex[:6].upper()
    test_user = User(
        id=f"usr-rbk-{uid}",
        username=f"admin_rbk_{uid}",
        email=f"admin_rbk_{uid}@smritibooks.com",
        role=UserRole.SYSADMIN,
        is_active=True,
    )
    test_binding = TenantCapabilityBinding(
        id=f"bind_rbk_{uid}",
        company_id=CANONICAL_COMP_ID,
        capability_code="DATABRIDGE",
        is_enabled=True,
        status="ACTIVE",
    )
    headers = _get_auth_headers(role="SYSADMIN")

    async def override_get_company_db():
        yield db_session

    async def override_get_current_user():
        return test_user

    async def override_require_databridge_entitlement():
        return test_binding

    app.dependency_overrides[get_company_db] = override_get_company_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_databridge_entitlement] = override_require_databridge_entitlement

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Test POST /rollback (dry-run)
            rbk_res = await client.post(
                "/api/v1/databridge/rollback",
                headers=headers,
                json={
                    "job_or_batch_id": f"batch_api_{uid}",
                    "entity_type": "ITEM",
                    "reason": "API dry-run rollback test",
                    "dry_run": True,
                },
            )
            assert rbk_res.status_code == 200
            rbk_data = rbk_res.json()
            assert rbk_data["status"] == "SIMULATED"
            assert rbk_data["dry_run"] is True

            # 2. Test POST /sync/tenant-transfer (preview)
            txfr_res = await client.post(
                "/api/v1/databridge/sync/tenant-transfer",
                headers=headers,
                json={
                    "source_company_id": CANONICAL_COMP_ID,
                    "target_company_id": CANONICAL_COMP_ID,
                    "entity_types": ["ITEM"],
                    "transfer_mode": "PREVIEW_ONLY",
                    "limit_per_entity": 5,
                },
            )
            assert txfr_res.status_code == 200
            txfr_data = txfr_res.json()
            assert txfr_data["status"] == "PREVIEWED"
            assert "ITEM" in txfr_data["entity_summaries"]

    finally:
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_databridge_entitlement, None)
