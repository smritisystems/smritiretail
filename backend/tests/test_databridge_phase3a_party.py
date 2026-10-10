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
Classification: Automated Test Suite — SMRITI DataBridge Phase 3A Party Adapters
"""

import uuid
from decimal import Decimal
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
from app.models.crm import Customer
from app.models.purchase import Supplier
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
# TC-PARTY-001: New Customer Create & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_001_customer_create_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    cust_code = f"CUST-{suffix}"
    cust_mobile = f"98{uuid.uuid4().int % 100000000:08d}"
    rows = [
        {
            "customer_code": cust_code,
            "customer_name": f"Acme Retail {suffix}",
            "mobile": cust_mobile,
            "email": f"acme_{suffix.lower()}@example.com",
            "gstin": "27AAACS1234A1Z1",
            "pan": "AAACS1234A",
            "customer_type": "RETAIL",
            "pricing_basis": "MRP",
        }
    ]

    # Preview
    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is True
    assert prev_res.summary.total_rows == 1
    assert prev_res.summary.create_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.CREATE
    assert prev_res.items[0].target_identifier == cust_code

    # Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )

    assert commit_res.status == "COMMITTED"
    assert commit_res.committed_count == 1

    # Verify DB persistence
    saved = (await db_session.execute(
        select(Customer).where(Customer.company_id == CANONICAL_COMP_ID, Customer.code == cust_code)
    )).scalars().first()
    assert saved is not None
    assert saved.name == f"Acme Retail {suffix}"
    assert saved.mobile == cust_mobile
    assert saved.gst_number == "27AAACS1234A1Z1"
    assert saved.pan_number == "AAACS1234A"


# ==============================================================================
# TC-PARTY-002: Existing Customer Replay (NO_CHANGE)
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_002_customer_existing_no_change(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    cust_code = f"CUST-EX-{suffix}"
    cust_mobile = f"97{uuid.uuid4().int % 100000000:08d}"
    cust = Customer(
        id=f"c_{suffix}",
        company_id=CANONICAL_COMP_ID,
        code=cust_code,
        name=f"Existing Corp {suffix}",
        mobile=cust_mobile,
        email=f"corp_{suffix.lower()}@smriti.com",
        gst_number="07AAAAA0000A1Z5",
        status="Active",
    )
    db_session.add(cust)
    await db_session.flush()

    rows = [
        {
            "code": cust_code,
            "name": f"Existing Corp {suffix}",
            "phone": cust_mobile,
            "email": f"corp_{suffix.lower()}@smriti.com",
            "gst_number": "07AAAAA0000A1Z5",
        }
    ]

    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is True
    assert prev_res.summary.no_change_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.NO_CHANGE
    assert len(prev_res.items[0].diff.fields) == 0


# ==============================================================================
# TC-PARTY-003: Customer Update with Field Diff
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_003_customer_update_fields(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    cust_code = f"CUST-UP-{suffix}"
    cust = Customer(
        id=f"c_up_{suffix}",
        company_id=CANONICAL_COMP_ID,
        code=cust_code,
        name=f"Old Name {suffix}",
        email=f"old_{suffix.lower()}@smriti.com",
        customer_type="RETAIL",
        pricing_basis="MRP",
        status="Active",
    )
    db_session.add(cust)
    await db_session.flush()

    rows = [
        {
            "code": cust_code,
            "name": f"New Name {suffix}",
            "email": f"new_{suffix.lower()}@smriti.com",
            "customer_type": "WHOLESALE",
            "pricing_basis": "RATE",
        }
    ]

    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is True
    assert prev_res.summary.update_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.UPDATE
    diff_fields = prev_res.items[0].diff.fields
    assert "name" in diff_fields
    assert diff_fields["name"].new_value == f"New Name {suffix}"
    assert "pricing_basis" in diff_fields
    assert diff_fields["pricing_basis"].new_value == "RATE"

    # Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert commit_res.committed_count == 1

    # Verify updated state
    await db_session.refresh(cust)
    assert cust.name == f"New Name {suffix}"
    assert cust.pricing_basis == "RATE"
    assert cust.customer_type == "WHOLESALE"


# ==============================================================================
# TC-PARTY-004: Customer Invalid GSTIN Rejection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_004_customer_invalid_gstin_blocked(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    rows = [
        {
            "customer_code": f"CUST-INV-{suffix}",
            "customer_name": "Invalid GSTIN Corp",
            "gstin": "INVALID12345",
        }
    ]

    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is False
    assert prev_res.summary.validation_error_count == 1
    assert any("SMRITI-VAL-GSTIN-INVALID" == c.conflict_code for c in prev_res.items[0].conflicts)

    # Attempt commit must be rejected
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    with pytest.raises(Exception):
        await DataBridgeService.execute_commit(
            company_db=db_session,
            tenant_id="smriti001",
            company_id=CANONICAL_COMP_ID,
            branch_id="BR-MAIN-001",
            actor_id="usr-test",
            actor_role="ADMIN",
            req=commit_req,
        )


# ==============================================================================
# TC-PARTY-005: Customer Phone Conflict Detection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_005_customer_phone_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    shared_mobile = f"95{uuid.uuid4().int % 100000000:08d}"

    # Existing customer with mobile
    cust1 = Customer(
        id=f"c1_{suffix}",
        company_id=CANONICAL_COMP_ID,
        code=f"CUST-ORIG-{suffix}",
        name=f"Original Customer {suffix}",
        mobile=shared_mobile,
        status="Active",
    )
    db_session.add(cust1)
    await db_session.flush()

    # Ingress row has a DIFFERENT code but same mobile number
    rows = [
        {
            "customer_code": f"CUST-DIFF-{suffix}",
            "customer_name": f"Different Customer {suffix}",
            "mobile": shared_mobile,
        }
    ]

    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.CUSTOMER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    # Must be classified as existing conflict
    assert prev_res.can_commit is False
    assert prev_res.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    assert any("SMRITI-CONFL-CUST-PHONE" in c.conflict_code for c in prev_res.items[0].conflicts)


# ==============================================================================
# TC-PARTY-006: New Supplier Create & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_006_supplier_create_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    supp_code = f"VEND-{suffix}"
    supp_mobile = f"94{uuid.uuid4().int % 100000000:08d}"
    rows = [
        {
            "supplier_code": supp_code,
            "supplier_name": f"Apex Leather Works {suffix}",
            "mobile": supp_mobile,
            "email": f"apex_{suffix.lower()}@example.com",
            "gstin": "27AAACS1234A1Z1",
            "address": "123 Industrial Area, Phase II",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
        }
    ]

    # Preview
    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.SUPPLIER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is True
    assert prev_res.summary.total_rows == 1
    assert prev_res.summary.create_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.CREATE
    assert prev_res.items[0].target_identifier == supp_code

    # Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.SUPPLIER,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )

    assert commit_res.status == "COMMITTED"
    assert commit_res.committed_count == 1

    # Verify DB persistence
    saved_supp = (await db_session.execute(
        select(Supplier).where(Supplier.company_id == CANONICAL_COMP_ID, Supplier.code == supp_code)
    )).scalars().first()
    assert saved_supp is not None
    assert saved_supp.name == f"Apex Leather Works {suffix}"
    assert saved_supp.city == "Mumbai"
    assert saved_supp.state == "Maharashtra"
    assert saved_supp.pincode == "400001"
    assert saved_supp.outstanding == Decimal("0.00")


# ==============================================================================
# TC-PARTY-007: Existing Supplier Replay (NO_CHANGE)
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_007_supplier_existing_no_change(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    supp_code = f"VEND-EX-{suffix}"
    supp_mobile = f"93{uuid.uuid4().int % 100000000:08d}"
    supp = Supplier(
        id=f"s_{suffix}",
        company_id=CANONICAL_COMP_ID,
        code=supp_code,
        name=f"Existing Mill {suffix}",
        mobile=supp_mobile,
        email=f"mill_{suffix.lower()}@smriti.com",
        gst_number="07AAAAA0000A1Z5",
        city="Delhi",
        state="Delhi",
        pincode="110001",
        outstanding=Decimal("0.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    rows = [
        {
            "code": supp_code,
            "name": f"Existing Mill {suffix}",
            "mobile": supp_mobile,
            "email": f"mill_{suffix.lower()}@smriti.com",
            "gst_number": "07AAAAA0000A1Z5",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
        }
    ]

    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.SUPPLIER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is True
    assert prev_res.summary.no_change_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.NO_CHANGE
    assert len(prev_res.items[0].diff.fields) == 0


# ==============================================================================
# TC-PARTY-008: Supplier Update with Diff
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_008_supplier_update_fields(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    supp_code = f"VEND-UP-{suffix}"
    supp = Supplier(
        id=f"s_up_{suffix}",
        company_id=CANONICAL_COMP_ID,
        code=supp_code,
        name=f"Old Mill {suffix}",
        city="Old City",
        pincode="400001",
        outstanding=Decimal("0.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    rows = [
        {
            "code": supp_code,
            "name": f"Updated Mill {suffix}",
            "city": "New City",
            "pincode": "400099",
        }
    ]

    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.SUPPLIER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is True
    assert prev_res.summary.update_count == 1
    diff_fields = prev_res.items[0].diff.fields
    assert "name" in diff_fields
    assert diff_fields["city"].new_value == "New City"
    assert diff_fields["pincode"].new_value == "400099"

    # Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.SUPPLIER,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert commit_res.committed_count == 1

    await db_session.refresh(supp)
    assert supp.name == f"Updated Mill {suffix}"
    assert supp.city == "New City"
    assert supp.pincode == "400099"


# ==============================================================================
# TC-PARTY-009: In-File Duplicate Code Detection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_009_in_file_duplicate_code_detection(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    dup_code = f"SUPP-DUP-{suffix}"
    rows = [
        {"code": dup_code, "name": "First Supplier Row"},
        {"code": dup_code, "name": "Second Supplier Row (Duplicate)"},
    ]

    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.SUPPLIER,
        rows=rows,
    )
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )

    assert prev_res.can_commit is False
    assert prev_res.summary.validation_error_count >= 1
    assert any("SMRITI-VAL-DUP-ROW-CODE" in c.conflict_code for c in prev_res.items[1].conflicts)


# ==============================================================================
# TC-PARTY-010: HTTP API Endpoints (/customer/preview & /customer/commit)
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_010_api_customer_endpoints(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    headers = _get_auth_headers()

    cust_code = f"API-CUST-{suffix}"
    cust_mobile = f"91{uuid.uuid4().int % 100000000:08d}"
    rows = [
        {
            "code": cust_code,
            "name": f"API Customer {suffix}",
            "mobile": cust_mobile,
            "gstin": "27AAACS1234A1Z1",
        }
    ]

    mock_user = User(
        id="usr-super",
        username="superadmin",
        email="super@smriti.com",
        role=UserRole.SYSADMIN,
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        is_active=True,
        status="Active",
    )
    mock_binding = TenantCapabilityBinding(
        capability_code="DATABRIDGE",
        is_enabled=True,
        company_id=CANONICAL_COMP_ID,
        status="ACTIVE",
    )

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[require_databridge_entitlement] = lambda: mock_binding
    app.dependency_overrides[get_company_db] = lambda: db_session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Preview
            prev_res = await client.post(
                "/api/v1/databridge/customer/preview",
                json={"rows": rows},
                headers=headers,
            )
            assert prev_res.status_code == 200, f"Preview failed: {prev_res.text}"
            prev_data = prev_res.json()
            assert prev_data["can_commit"] is True
            token = prev_data["preview_token"]

            # Commit
            commit_res = await client.post(
                "/api/v1/databridge/customer/commit",
                json={
                    "preview_token": token,
                    "confirmed": True,
                    "rows": rows,
                },
                headers=headers,
            )
            assert commit_res.status_code == 200, f"Commit failed: {commit_res.text}"
            commit_data = commit_res.json()
            assert commit_data["status"] == "COMMITTED"
            assert commit_data["committed_count"] == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_databridge_entitlement, None)
        app.dependency_overrides.pop(get_company_db, None)


# ==============================================================================
# TC-PARTY-011: HTTP API Endpoints (/supplier/preview & /supplier/commit)
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_party_011_api_supplier_endpoints(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    headers = _get_auth_headers()

    supp_code = f"API-SUPP-{suffix}"
    supp_mobile = f"90{uuid.uuid4().int % 100000000:08d}"
    rows = [
        {
            "code": supp_code,
            "name": f"API Supplier {suffix}",
            "mobile": supp_mobile,
            "city": "Bengaluru",
            "pincode": "560001",
        }
    ]

    mock_user = User(
        id="usr-super",
        username="superadmin",
        email="super@smriti.com",
        role=UserRole.SYSADMIN,
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        is_active=True,
        status="Active",
    )
    mock_binding = TenantCapabilityBinding(
        capability_code="DATABRIDGE",
        is_enabled=True,
        company_id=CANONICAL_COMP_ID,
        status="ACTIVE",
    )

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[require_databridge_entitlement] = lambda: mock_binding
    app.dependency_overrides[get_company_db] = lambda: db_session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Preview
            prev_res = await client.post(
                "/api/v1/databridge/supplier/preview",
                json={"rows": rows},
                headers=headers,
            )
            assert prev_res.status_code == 200, f"Preview failed: {prev_res.text}"
            prev_data = prev_res.json()
            assert prev_data["can_commit"] is True
            token = prev_data["preview_token"]

            # Commit
            commit_res = await client.post(
                "/api/v1/databridge/supplier/commit",
                json={
                    "preview_token": token,
                    "confirmed": True,
                    "rows": rows,
                },
                headers=headers,
            )
            assert commit_res.status_code == 200, f"Commit failed: {commit_res.text}"
            commit_data = commit_res.json()
            assert commit_data["status"] == "COMMITTED"
            assert commit_data["committed_count"] == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_databridge_entitlement, None)
        app.dependency_overrides.pop(get_company_db, None)
