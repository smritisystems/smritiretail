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
Classification: Automated Test Suite — SMRITI DataBridge Phase 3D Inventory Adapters
"""

import uuid
from decimal import Decimal
from typing import Dict, Any
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import selectinload

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.capability_template import TenantCapabilityBinding
from app.api.deps import get_company_db, get_current_user
from app.api.v1.databridge import require_databridge_entitlement
from app.models.inventory import StockTransfer, StockTransferItem, StockAudit, StockAuditItem, Warehouse, Product
from app.services.databridge.service import DataBridgeService
from app.services.databridge.models import (
    DataBridgeClassification,
    DataBridgeEntityType,
    DataBridgePreviewRequest,
    DataBridgeCommitRequest,
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
# TC-INV-001: Stock Transfer Multi-Line Grouping, Preview & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_inv_001_stock_transfer_preview_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    transfer_no = f"STO-{suffix}"
    src_wh = f"WH-SRC-{suffix}"
    dst_wh = f"WH-DST-{suffix}"
    sku_1 = f"SKU-X-{suffix}"
    sku_2 = f"SKU-Y-{suffix}"

    rows = [
        {
            "transfer_no": transfer_no,
            "source_warehouse": src_wh,
            "dest_warehouse": dst_wh,
            "item_code": sku_1,
            "item_name": "Product Alpha",
            "quantity": 10.0,
            "unit_cost": 150.0,
            "batch_no": "BATCH-01",
        },
        {
            "transfer_no": transfer_no,
            "source_warehouse": src_wh,
            "dest_warehouse": dst_wh,
            "item_code": sku_2,
            "item_name": "Product Beta",
            "quantity": 5.0,
            "unit_cost": 300.0,
            "batch_no": "BATCH-02",
        },
    ]

    # 1. Preview
    req_prev = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.STOCK_TRANSFER,
        rows=rows,
    )
    resp_prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_prev,
    )

    assert resp_prev.summary.total_rows == 1
    assert resp_prev.summary.create_count == 1
    assert resp_prev.can_commit is True
    assert len(resp_prev.blocking_reasons) == 0

    token = resp_prev.preview_token

    # 2. Commit
    req_comm = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.STOCK_TRANSFER,
        preview_token=token,
        confirmed=True,
        rows=rows,
    )
    resp_comm = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_comm,
    )

    assert resp_comm.status == "COMMITTED"
    assert resp_comm.committed_count == 1
    assert resp_comm.summary.create_count == 1

    # 3. Database Invariant Assertions
    q_st = (
        select(StockTransfer)
        .where(
            StockTransfer.company_id == CANONICAL_COMP_ID,
            StockTransfer.transfer_no == transfer_no,
            StockTransfer.is_deleted == False,
        )
        .options(selectinload(StockTransfer.items))
    )
    res_st = await db_session.execute(q_st)
    st_row = res_st.scalars().first()
    assert st_row is not None
    assert st_row.status == "DRAFT"
    assert len(st_row.items) == 2

    # Assert quantities and items
    item_qtys = {it.batch_no: float(it.quantity_dispatched) for it in st_row.items}
    assert item_qtys["BATCH-01"] == 10.0
    assert item_qtys["BATCH-02"] == 5.0


# ==============================================================================
# TC-INV-002: Stock Transfer Same Source and Destination Conflict
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_inv_002_stock_transfer_same_warehouse_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    transfer_no = f"STO-SAME-{suffix}"
    same_wh = f"WH-SAME-{suffix}"

    rows = [
        {
            "transfer_no": transfer_no,
            "source_warehouse": same_wh,
            "dest_warehouse": same_wh,
            "item_code": f"SKU-{suffix}",
            "quantity": 10.0,
            "unit_cost": 100.0,
        }
    ]

    req_prev = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.STOCK_TRANSFER,
        rows=rows,
    )
    resp_prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_prev,
    )

    assert resp_prev.can_commit is False
    assert resp_prev.items[0].classification == DataBridgeClassification.VALIDATION_ERROR
    codes = [c.conflict_code for c in resp_prev.items[0].conflicts]
    assert "SMRITI-VAL-WAREHOUSE-SAME" in codes


# ==============================================================================
# TC-INV-003: Stock Transfer Duplicate Conflict
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_inv_003_stock_transfer_duplicate_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    transfer_no = f"STO-DUP-{suffix}"

    rows = [
        {
            "transfer_no": transfer_no,
            "source_warehouse": f"WH-A-{suffix}",
            "dest_warehouse": f"WH-B-{suffix}",
            "item_code": f"SKU-{suffix}",
            "quantity": 1.0,
            "unit_cost": 100.0,
        }
    ]

    # Commit initial transfer
    prev1 = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.STOCK_TRANSFER, rows=rows),
    )
    await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.STOCK_TRANSFER,
            preview_token=prev1.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )

    # Re-preview identical transfer_no -> should flag conflict
    prev2 = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.STOCK_TRANSFER, rows=rows),
    )

    assert prev2.can_commit is False
    assert prev2.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    codes = [c.conflict_code for c in prev2.items[0].conflicts]
    assert "SMRITI-CONFL-TRANSFER-EXISTS" in codes


# ==============================================================================
# TC-INV-004: Stock Transfer In-File Duplicate Detection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_inv_004_stock_transfer_in_file_duplicate(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    transfer_no = f"STO-FILE-DUP-{suffix}"

    rows = [
        {
            "transfer_no": transfer_no,
            "source_warehouse": f"WH-A-{suffix}",
            "dest_warehouse": f"WH-B-{suffix}",
            "items": [{"item_code": "SKU-1", "quantity_dispatched": 1.0}],
        },
        {
            "transfer_no": transfer_no,
            "source_warehouse": f"WH-A-{suffix}",
            "dest_warehouse": f"WH-B-{suffix}",
            "items": [{"item_code": "SKU-2", "quantity_dispatched": 2.0}],
        },
    ]

    resp_prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.STOCK_TRANSFER, rows=rows),
    )

    assert resp_prev.can_commit is False
    assert resp_prev.summary.conflict_count >= 1
    codes = [c.conflict_code for c in resp_prev.items[1].conflicts]
    assert "SMRITI-CONFL-TRANSFER-DUP-FILE" in codes


# ==============================================================================
# TC-INV-005: Stock Audit Multi-Line Grouping, Preview & Commit with Variance Math
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_inv_005_stock_audit_preview_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    audit_no = f"AUD-{suffix}"
    wh = f"WH-AUDIT-{suffix}"
    sku_1 = f"SKU-A-{suffix}"
    sku_2 = f"SKU-B-{suffix}"

    rows = [
        {
            "audit_no": audit_no,
            "warehouse": wh,
            "item_code": sku_1,
            "item_name": "Product Alpha",
            "system_qty": 50.0,
            "counted_qty": 48.0,
            "unit_cost": 200.0,
            "discrepancy_reason": "DAMAGED",
            "batch_no": "B1",
        },
        {
            "audit_no": audit_no,
            "warehouse": wh,
            "item_code": sku_2,
            "item_name": "Product Beta",
            "system_qty": 20.0,
            "counted_qty": 25.0,
            "unit_cost": 100.0,
            "discrepancy_reason": "SURPLUS_FOUND",
            "batch_no": "B2",
        },
    ]

    # 1. Preview
    req_prev = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.STOCK_AUDIT,
        rows=rows,
    )
    resp_prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_prev,
    )

    assert resp_prev.summary.total_rows == 1
    assert resp_prev.summary.create_count == 1
    assert resp_prev.can_commit is True
    token = resp_prev.preview_token

    # 2. Commit
    req_comm = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.STOCK_AUDIT,
        preview_token=token,
        confirmed=True,
        rows=rows,
    )
    resp_comm = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_comm,
    )

    assert resp_comm.status == "COMMITTED"
    assert resp_comm.committed_count == 1

    # 3. Database Invariant Assertions
    q_sa = (
        select(StockAudit)
        .where(
            StockAudit.company_id == CANONICAL_COMP_ID,
            StockAudit.audit_no == audit_no,
            StockAudit.is_deleted == False,
        )
        .options(selectinload(StockAudit.items))
    )
    res_sa = await db_session.execute(q_sa)
    sa_row = res_sa.scalars().first()
    assert sa_row is not None
    assert len(sa_row.items) == 2

    # Assert variance calculations
    variances = {it.batch_no: (float(it.variance_qty), float(it.variance_value)) for it in sa_row.items}
    # Line 1: counted(48) - system(50) = -2, -2 * 200 = -400
    assert variances["B1"] == (-2.0, -400.0)
    # Line 2: counted(25) - system(20) = 5, 5 * 100 = 500
    assert variances["B2"] == (5.0, 500.0)


# ==============================================================================
# TC-INV-006: Stock Audit Duplicate Conflict
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_inv_006_stock_audit_duplicate_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    audit_no = f"AUD-DUP-{suffix}"

    rows = [
        {
            "audit_no": audit_no,
            "warehouse": f"WH-{suffix}",
            "item_code": f"SKU-{suffix}",
            "counted_qty": 10.0,
            "unit_cost": 50.0,
        }
    ]

    prev1 = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.STOCK_AUDIT, rows=rows),
    )
    await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.STOCK_AUDIT,
            preview_token=prev1.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )

    # Re-preview identical audit_no -> should flag conflict
    prev2 = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.STOCK_AUDIT, rows=rows),
    )

    assert prev2.can_commit is False
    assert prev2.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    codes = [c.conflict_code for c in prev2.items[0].conflicts]
    assert "SMRITI-CONFL-AUDIT-EXISTS" in codes


# ==============================================================================
# TC-INV-007: REST API Endpoints E2E Preview & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_inv_007_rest_endpoints_e2e_preview_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    transfer_no = f"STO-REST-{suffix}"
    audit_no = f"AUD-REST-{suffix}"
    headers = _get_auth_headers()

    transfer_rows = [
        {
            "transfer_no": transfer_no,
            "source_warehouse": f"WH-SRC-{suffix}",
            "dest_warehouse": f"WH-DST-{suffix}",
            "item_code": f"SKU-TR-{suffix}",
            "quantity": 12.0,
            "unit_cost": 250.0,
        }
    ]

    audit_rows = [
        {
            "audit_no": audit_no,
            "warehouse": f"WH-AUD-{suffix}",
            "item_code": f"SKU-AU-{suffix}",
            "system_qty": 10.0,
            "counted_qty": 12.0,
            "unit_cost": 100.0,
        }
    ]

    async def override_get_company_db():
        yield db_session

    async def override_get_current_user():
        user = User(
            id="usr-super",
            username="superadmin",
            role=UserRole.SYSADMIN,
            is_active=True,
            company_id=CANONICAL_COMP_ID,
        )
        return user

    async def override_entitlement():
        return TenantCapabilityBinding(
            capability_code="DATABRIDGE",
            is_enabled=True,
            company_id=CANONICAL_COMP_ID,
        )

    app.dependency_overrides[get_company_db] = override_get_company_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_databridge_entitlement] = override_entitlement

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Stock Transfer Preview
        resp_tr_prev = await client.post(
            "/api/v1/databridge/stock-transfer/preview",
            json={"rows": transfer_rows},
            headers=headers,
        )
        assert resp_tr_prev.status_code == 200, resp_tr_prev.text
        tr_prev_data = resp_tr_prev.json()
        assert tr_prev_data["can_commit"] is True

        # 2. Stock Transfer Commit
        resp_tr_comm = await client.post(
            "/api/v1/databridge/stock-transfer/commit",
            json={
                "preview_token": tr_prev_data["preview_token"],
                "confirmed": True,
                "rows": transfer_rows,
            },
            headers=headers,
        )
        assert resp_tr_comm.status_code == 200, resp_tr_comm.text
        assert resp_tr_comm.json()["status"] == "COMMITTED"

        # 3. Stock Audit Preview
        resp_au_prev = await client.post(
            "/api/v1/databridge/stock-audit/preview",
            json={"rows": audit_rows},
            headers=headers,
        )
        assert resp_au_prev.status_code == 200, resp_au_prev.text
        au_prev_data = resp_au_prev.json()
        assert au_prev_data["can_commit"] is True

        # 4. Stock Audit Commit
        resp_au_comm = await client.post(
            "/api/v1/databridge/stock-audit/commit",
            json={
                "preview_token": au_prev_data["preview_token"],
                "confirmed": True,
                "rows": audit_rows,
            },
            headers=headers,
        )
        assert resp_au_comm.status_code == 200, resp_au_comm.text
        assert resp_au_comm.json()["status"] == "COMMITTED"

    app.dependency_overrides.clear()
