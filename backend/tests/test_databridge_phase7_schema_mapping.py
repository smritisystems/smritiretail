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
Classification: Automated Test Suite — SMRITI DataBridge Phase 7 Schema Mapping Intelligence
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.capability_template import TenantCapabilityBinding
from app.api.deps import get_company_db, get_current_user
from app.api.v1.databridge import require_databridge_entitlement
from app.services.databridge.models import (
    DataBridgeEntityType,
    DataBridgeSchemaDetectRequest,
    DataBridgeSchemaDetectResponse,
)
from app.services.databridge.schema_mapping_engine import DataBridgeSchemaMapper

import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.api.deps import get_company_db, get_current_user

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
) -> dict:
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
        "X-Company-Id": company_id,
        "X-Branch-Id": branch_id,
        "X-Tenant-Id": tenant_id,
    }


def test_tc_map_001_exact_alias_resolution():
    """
    TC-MAP-001: Verifies that exact and commercial aliases match with 1.0 score and EXACT confidence.
    """
    req = DataBridgeSchemaDetectRequest(
        entity_type=DataBridgeEntityType.ITEM,
        headers=["Item Code", "Product Name", "UOM", "MRP", "Selling Price", "HSN Code", "Brand", "Color", "Size"],
    )
    res = DataBridgeSchemaMapper.detect_schema(req)

    assert res.entity_type == "ITEM"
    assert res.exact_count >= 8
    assert len(res.missing_required_fields) == 0
    assert res.is_valid_for_import is True

    col_map = {c.source_header: c for c in res.columns}
    assert col_map["Item Code"].mapped_field_key == "item_code"
    assert col_map["Item Code"].confidence == "EXACT"
    assert col_map["Product Name"].mapped_field_key == "item_name"
    assert col_map["UOM"].mapped_field_key == "primary_uom"
    assert col_map["MRP"].mapped_field_key == "mrp"
    assert col_map["Selling Price"].mapped_field_key == "selling_price"
    assert col_map["HSN Code"].mapped_field_key == "hsn_code"
    assert col_map["HSN Code"].is_statutory is True


def test_tc_map_002_fuzzy_token_similarity_matching():
    """
    TC-MAP-002: Verifies that misspelled or camelCase headers match via token similarity with HIGH/MEDIUM confidence.
    """
    req = DataBridgeSchemaDetectRequest(
        entity_type=DataBridgeEntityType.ITEM,
        headers=["itmcde", "product_titl", "unit_measure", "max_retail_prc", "salesRate"],
    )
    res = DataBridgeSchemaMapper.detect_schema(req)

    col_map = {c.source_header: c for c in res.columns}
    assert col_map["itmcde"].mapped_field_key == "item_code"
    assert col_map["product_titl"].mapped_field_key == "item_name"
    assert col_map["unit_measure"].mapped_field_key == "primary_uom"
    assert col_map["max_retail_prc"].mapped_field_key == "mrp"
    assert col_map["salesRate"].mapped_field_key == "selling_price"


def test_tc_map_003_content_profiling_gstin_elevation():
    """
    TC-MAP-003: Verifies that an ambiguous header with GSTIN format sample values is profiled and boosted to 'gstin'.
    """
    req = DataBridgeSchemaDetectRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        headers=["Party Name", "Phone", "Govt Registration Code"],
        sample_rows=[
            {"Party Name": "Rajesh Kumar", "Phone": "9820012345", "Govt Registration Code": "27AAPFU0939F1ZV"},
            {"Party Name": "Amit Verma", "Phone": "9820098765", "Govt Registration Code": "07AAAAA0000A1Z5"},
        ],
    )
    res = DataBridgeSchemaMapper.detect_schema(req)

    col_map = {c.source_header: c for c in res.columns}
    assert col_map["Govt Registration Code"].mapped_field_key == "gstin"
    assert col_map["Govt Registration Code"].is_statutory is True
    assert "GSTIN" in col_map["Govt Registration Code"].match_reason
    assert col_map["Govt Registration Code"].confidence_score >= 0.90


def test_tc_map_004_content_profiling_phone_elevation():
    """
    TC-MAP-004: Verifies that generic header 'Contact ID' with Indian 10-digit mobile sample values is boosted to 'phone'.
    """
    req = DataBridgeSchemaDetectRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        headers=["Customer Name", "Contact ID"],
        sample_rows=[
            {"Customer Name": "Suresh Raina", "Contact ID": "9811223344"},
            {"Customer Name": "Deepak Chahar", "Contact ID": "9877665544"},
        ],
    )
    res = DataBridgeSchemaMapper.detect_schema(req)

    col_map = {c.source_header: c for c in res.columns}
    assert col_map["Contact ID"].mapped_field_key == "phone"
    assert col_map["Contact ID"].is_required is True
    assert "PHONE" in col_map["Contact ID"].match_reason


def test_tc_map_005_missing_mandatory_fields_validation():
    """
    TC-MAP-005: Verifies that missing required fields (e.g. primary_uom) are flagged in missing_required_fields.
    """
    req = DataBridgeSchemaDetectRequest(
        entity_type=DataBridgeEntityType.ITEM,
        headers=["Item Code", "MRP", "Brand"],  # Missing item_name and primary_uom
    )
    res = DataBridgeSchemaMapper.detect_schema(req)

    assert res.is_valid_for_import is False
    missing_keys = [m.field_key for m in res.missing_required_fields]
    assert "item_name" in missing_keys
    assert "primary_uom" in missing_keys


def test_tc_map_006_unmapped_unknown_columns():
    """
    TC-MAP-006: Verifies that arbitrary, unmatchable columns are cleanly marked UNMAPPED with 0.0 confidence score.
    """
    req = DataBridgeSchemaDetectRequest(
        entity_type=DataBridgeEntityType.ITEM,
        headers=["Item Code", "Item Name", "UOM", "Random Gibberish 999", "FooBarBaz123"],
    )
    res = DataBridgeSchemaMapper.detect_schema(req)

    col_map = {c.source_header: c for c in res.columns}
    assert col_map["Random Gibberish 999"].confidence == "UNMAPPED"
    assert col_map["Random Gibberish 999"].mapped_field_key is None
    assert col_map["FooBarBaz123"].confidence == "UNMAPPED"
    assert res.unmapped_count == 2


@pytest.mark.asyncio
async def test_tc_map_007_fastapi_rest_detect_endpoint(db_session: AsyncSession):
    """
    TC-MAP-007: Tests FastAPI POST /api/v1/databridge/schema/detect endpoint end-to-end.
    """
    uid = uuid.uuid4().hex[:6].upper()
    test_user = User(
        id=f"usr-map-{uid}",
        username=f"admin_map_{uid}",
        email=f"admin_map_{uid}@smritibooks.com",
        role=UserRole.SYSADMIN,
        is_active=True,
    )
    test_binding = TenantCapabilityBinding(
        id=f"bind_map_{uid}",
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
            resp = await client.post(
                "/api/v1/databridge/schema/detect",
                headers=headers,
                json={
                    "entity_type": "PURCHASE_ORDER",
                    "headers": ["PO Number", "PO Date", "Vendor Name", "SKU Code", "Ordered Qty", "Rate", "Tax Pct"],
                    "sample_rows": [
                        {
                            "PO Number": "PO-2026-001",
                            "PO Date": "2026-10-06",
                            "Vendor Name": "Metro Footwear Ltd",
                            "SKU Code": "SHO-001-BLK-42",
                            "Ordered Qty": 100,
                            "Rate": 450.0,
                            "Tax Pct": 18.0,
                        }
                    ],
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["entity_type"] == "PURCHASE_ORDER"
            assert data["is_valid_for_import"] is True
            assert len(data["missing_required_fields"]) == 0
            assert data["exact_count"] >= 5

            col_map = {c["source_header"]: c for c in data["columns"]}
            assert col_map["PO Number"]["mapped_field_key"] == "order_no"
            assert col_map["Vendor Name"]["mapped_field_key"] == "supplier_name"
            assert col_map["Ordered Qty"]["mapped_field_key"] == "quantity"
            assert col_map["Rate"]["mapped_field_key"] == "unit_price"
    finally:
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_databridge_entitlement, None)
