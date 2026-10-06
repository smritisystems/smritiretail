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
Classification: Automated Test Suite — SMRITI DataBridge Phase 5 Streaming Exporter & Strangler-Fig
"""

import io
import json
import uuid
import openpyxl
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
from app.models.exchange import DataExchangeTask
from app.services.databridge.export_engine import DataBridgeExportEngine
from app.services.databridge.models import (
    DataBridgeEntityType,
    DataBridgeExportFormat,
    DataBridgeExportRequest,
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
# PHASE 5 TEST SUITE: MULTI-FORMAT STREAMING EXPORT & STRANGLER-FIG MIGRATION
# ==============================================================================

@pytest.mark.asyncio
async def test_tc_export_001_csv_export_catalog(db_session: AsyncSession):
    """
    TC-EXPORT-001: Exports ITEM catalog to CSV format and verifies UTF-8 BOM,
    RFC 4180 headers, and accurate field serialization.
    """
    uid = uuid.uuid4().hex[:6].upper()
    test_item = Item(
        id=f"itm_{uid}",
        company_id=CANONICAL_COMP_ID,
        item_code=f"EXP-CSV-{uid}",
        item_name=f"Export CSV Item {uid}",
        brand="SMRITI",
        category="Footwear",
        primary_uom="Pair",
        mrp=1999.0,
        selling_price=1499.0,
        cost_price=800.0,
        is_active=True,
    )
    db_session.add(test_item)
    await db_session.commit()

    req = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.ITEM,
        file_format=DataBridgeExportFormat.CSV,
        limit=1000,
    )

    content_bytes, media_type, filename, sha256_hash = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert media_type == "text/csv; charset=utf-8"
    assert filename.startswith("SMRITI_ITEM_")
    assert filename.endswith(".csv")
    assert content_bytes.startswith(b"\xef\xbb\xbf")  # UTF-8 BOM
    csv_text = content_bytes.decode("utf-8")
    assert "item_code" in csv_text
    assert f"EXP-CSV-{uid}" in csv_text
    assert len(sha256_hash) == 64


@pytest.mark.asyncio
async def test_tc_export_002_json_export_parties(db_session: AsyncSession):
    """
    TC-EXPORT-002: Exports CUSTOMER records to JSON format and verifies valid JSON array.
    """
    uid = uuid.uuid4().hex[:6].upper()
    cust = Customer(
        id=f"cus_{uid}",
        company_id=CANONICAL_COMP_ID,
        code=f"EXP-CUST-{uid}",
        name=f"Export Customer {uid}",
        mobile=f"98{uid[:8].zfill(8)}",
    )
    db_session.add(cust)
    await db_session.commit()

    req = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        file_format=DataBridgeExportFormat.JSON,
        limit=1000,
    )

    content_bytes, media_type, filename, sha256_hash = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert media_type == "application/json; charset=utf-8"
    assert filename.endswith(".json")
    data = json.loads(content_bytes.decode("utf-8"))
    assert isinstance(data, list)
    matching = [c for c in data if c.get("customer_code") == f"EXP-CUST-{uid}"]
    assert len(matching) == 1
    assert matching[0]["customer_name"] == f"Export Customer {uid}"


@pytest.mark.asyncio
async def test_tc_export_003_smriti_x_export_envelope(db_session: AsyncSession):
    """
    TC-EXPORT-003: Exports SMRITI-X sealed package with metadata and cryptographic digest.
    """
    req = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.ITEM,
        file_format=DataBridgeExportFormat.SMRITI_X,
        limit=20,
    )

    content_bytes, media_type, filename, sha256_hash = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert filename.endswith(".smritix")
    pkg = json.loads(content_bytes.decode("utf-8"))
    assert "metadata" in pkg
    assert "data" in pkg
    meta = pkg["metadata"]
    assert meta["schema_version"] == "1.0.0"
    assert meta["system"] == "SMRITI Retail OS DataBridge"
    assert meta["entity_type"] == "ITEM"
    assert meta["company_id"] == CANONICAL_COMP_ID
    assert "integrity_sha256" in meta
    assert isinstance(pkg["data"], list)


@pytest.mark.asyncio
async def test_tc_export_004_xlsx_export_binary(db_session: AsyncSession):
    """
    TC-EXPORT-004: Exports OpenXML .xlsx binary workbook and validates headers and styling.
    """
    req = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.ITEM,
        file_format=DataBridgeExportFormat.XLSX,
        limit=10,
    )

    content_bytes, media_type, filename, sha256_hash = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    assert media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert filename.endswith(".xlsx")
    assert content_bytes[:4] == b"PK\x03\x04"  # ZIP container header

    # Verify workbook can be parsed by openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content_bytes))
    ws = wb.active
    assert ws.title == "ITEM"
    assert ws.max_row >= 1
    first_cell = ws.cell(row=1, column=1).value
    assert first_cell is not None


@pytest.mark.asyncio
async def test_tc_export_005_tenant_isolation_boundary(db_session: AsyncSession):
    """
    TC-EXPORT-005: Verifies that export requests targeting control plane smritisys are blocked.
    """
    req = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.ITEM,
        file_format=DataBridgeExportFormat.CSV,
    )

    from app.services.databridge.exceptions import DataBridgeTenantIsolationError
    with pytest.raises(DataBridgeTenantIsolationError) as exc_info:
        await DataBridgeExportEngine.export_dataset(
            company_db=db_session,
            company_id="smritisys",
            actor_id="usr-super",
            actor_role="SYSADMIN",
            req=req,
        )
    assert "SMRITI-TENANT-001" in exc_info.value.code


@pytest.mark.asyncio
async def test_tc_export_006_worm_audit_log_created(db_session: AsyncSession):
    """
    TC-EXPORT-006: Verifies permanent WORM audit logging in compliance_immutable_audit_logs.
    """
    req = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.SUPPLIER,
        file_format=DataBridgeExportFormat.CSV,
        include_audit_signature=True,
    )

    content_bytes, media_type, filename, sha256_hash = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req,
    )

    stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.entity_id == filename,
        ComplianceImmutableAuditLog.company_id == CANONICAL_COMP_ID,
    )
    audit = (await db_session.execute(stmt)).scalars().first()
    assert audit is not None
    assert audit.event_type == "DATABRIDGE_DATA_EXPORT"
    assert audit.payload_hash is not None
    assert len(audit.payload_hash) == 64
    assert audit.hash_chain_verified is True
    assert "Exported" in audit.action_summary


@pytest.mark.asyncio
async def test_tc_export_007_rest_streaming_endpoints_and_strangler(db_session: AsyncSession):
    """
    TC-EXPORT-007: Tests FastAPI GET /export/{entity_type} endpoint and verifies
    legacy /api/v1/exchange/tasks/{id}/execute returns deprecation notice.
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
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[require_databridge_entitlement] = lambda: test_binding

    transport = ASGITransport(app=app)
    headers = _get_auth_headers()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Part A: Test canonical DataBridge streaming export endpoint
        resp = await client.get(
            "/api/v1/databridge/export/ITEM?format=CSV&limit=10",
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        assert "attachment; filename=\"SMRITI_ITEM_" in resp.headers["content-disposition"]
        assert "x-smriti-checksum-sha256" in resp.headers
        assert resp.text.startswith("\ufeff")

        # Part B: Test legacy exchange strangler-fig execution
        task_id = f"tsk_{uid}"
        legacy_task = DataExchangeTask(
            id=task_id,
            name=f"Legacy Export Task {uid}",
            direction="Export",
            entity_type="Products",
            file_type="CSV",
            status="Idle",
            is_deleted=False,
        )
        db_session.add(legacy_task)
        await db_session.commit()

        exec_resp = await client.post(
            f"/api/v1/exchange/tasks/{task_id}/execute",
            json={"payload": []},
            headers=headers,
        )
        assert exec_resp.status_code == 200
        exec_data = exec_resp.json()
        assert exec_data["success"] is True
        assert "deprecationNotice" in exec_data
        assert "SMRITI-DEPR-001" in exec_data["deprecationNotice"]
        assert "[SMRITI-DEPRECATION]" in exec_data["logs"]

    app.dependency_overrides.clear()
