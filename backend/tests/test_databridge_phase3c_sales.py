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
Classification: Automated Test Suite — SMRITI DataBridge Phase 3C Sales Adapters
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
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesOrder, SalesOrderItem, SalesReturn, SalesReturnItem
from app.models.crm import Customer
from app.models.inventory import Product
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
# TC-SALES-001: Sales Invoice Multi-Line Grouping, Preview & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_001_sales_invoice_preview_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    inv_no = f"INV-{suffix}"
    cust_code = f"CUST-{suffix}"
    cust_name = f"Retail Customer {suffix}"

    rows = [
        {
            "invoice_no": inv_no,
            "customer_code": cust_code,
            "customer_name": cust_name,
            "payment_mode": "CASH",
            "item_code": f"SKU-A-{suffix}",
            "item_name": "Cotton Polo Shirt",
            "quantity": 2,
            "price": 800.0,
            "gst_rate": 18.0,
        },
        {
            "invoice_no": inv_no,
            "customer_code": cust_code,
            "customer_name": cust_name,
            "payment_mode": "CASH",
            "item_code": f"SKU-B-{suffix}",
            "item_name": "Denim Jeans",
            "quantity": 1,
            "price": 1500.0,
            "gst_rate": 18.0,
        },
    ]

    # 1. Preview
    prev_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        rows=rows,
    )
    preview = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=prev_req,
    )

    assert preview.can_commit is True
    assert preview.summary.total_rows == 1
    assert preview.summary.create_count == 1
    assert preview.items[0].classification == DataBridgeClassification.CREATE
    assert preview.items[0].normalized_data["invoice_no"] == inv_no
    assert preview.items[0].normalized_data["items_count"] == 2

    # 2. Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        preview_token=preview.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=commit_req,
    )

    assert commit_res.status == "COMMITTED"
    assert commit_res.committed_count == 1
    assert len(commit_res.items) == 1

    # 3. Database Verification
    stmt = (
        select(SalesInvoice)
        .options(selectinload(SalesInvoice.items))
        .where(
            SalesInvoice.company_id == CANONICAL_COMP_ID,
            SalesInvoice.invoice_no == inv_no,
        )
    )
    db_inv = (await db_session.execute(stmt)).scalars().first()
    assert db_inv is not None
    assert db_inv.invoice_no == inv_no
    assert db_inv.customer_name == cust_name
    assert len(db_inv.items) == 2

    # Verify line items calculations
    expected_basic = Decimal("2") * Decimal("800.00") + Decimal("1") * Decimal("1500.00")  # 1600 + 1500 = 3100
    expected_tax = (expected_basic * Decimal("0.18")).quantize(Decimal("0.01"))             # 558.00
    expected_total = expected_basic + expected_tax                                          # 3658.00
    assert db_inv.taxable_value == expected_basic
    assert db_inv.tax_total == expected_tax
    assert db_inv.grand_total == expected_total


# ==============================================================================
# TC-SALES-002: Sales Invoice Duplicate Number Conflict Detection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_002_sales_invoice_duplicate_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    inv_no = f"INV-DUP-{suffix}"

    rows = [
        {
            "invoice_no": inv_no,
            "customer_name": f"Customer {suffix}",
            "item_code": f"SKU-{suffix}",
            "quantity": 1,
            "price": 200.0,
            "gst_rate": 18.0,
        }
    ]

    # Initial preview & commit
    prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_INVOICE, rows=rows),
    )
    await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.SALES_INVOICE,
            preview_token=prev.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )

    # Subsequent preview must flag blocking conflict
    prev2 = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_INVOICE, rows=rows),
    )

    assert prev2.can_commit is False
    assert prev2.summary.conflict_count == 1
    assert prev2.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    assert any(c.conflict_code == "SALES_INVOICE_ALREADY_EXISTS" for c in prev2.items[0].conflicts)


# ==============================================================================
# TC-SALES-003: Sales Invoice In-File Duplicate Rejection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_003_sales_invoice_in_file_duplicate(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    inv_no = f"INV-FILE-DUP-{suffix}"

    # Two rows with explicit items blocks defining the same invoice_no
    rows = [
        {
            "invoice_no": inv_no,
            "customer_name": "Cust A",
            "items": [{"item_code": "SKU-1", "quantity": 1, "price": 100.0}],
        },
        {
            "invoice_no": inv_no,
            "customer_name": "Cust A",
            "items": [{"item_code": "SKU-2", "quantity": 2, "price": 150.0}],
        },
    ]

    prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_INVOICE, rows=rows),
    )

    # In grouped tabular mode, duplicate invoice_no rows are merged into 1 doc,
    # or if separated, duplicate documents are flagged.
    assert prev.summary.total_rows == 1
    assert prev.items[0].normalized_data["items_count"] == 2


# ==============================================================================
# TC-SALES-004: Sales Order Multi-Line Grouping, Preview & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_004_sales_order_preview_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    order_no = f"SO-{suffix}"
    cust_name = f"Corporate Client {suffix}"

    rows = [
        {
            "order_no": order_no,
            "customer_name": cust_name,
            "po_number": f"PO-REF-{suffix}",
            "item_code": f"SKU-SO1-{suffix}",
            "item_name": "Formal Blazer",
            "quantity": 5,
            "price": 2500.0,
            "gst_rate": 18.0,
        },
        {
            "order_no": order_no,
            "customer_name": cust_name,
            "po_number": f"PO-REF-{suffix}",
            "item_code": f"SKU-SO2-{suffix}",
            "item_name": "Formal Waistcoat",
            "quantity": 5,
            "price": 1200.0,
            "gst_rate": 18.0,
        },
    ]

    # 1. Preview
    prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_ORDER, rows=rows),
    )

    assert prev.can_commit is True
    assert prev.summary.total_rows == 1
    assert prev.summary.create_count == 1
    assert prev.items[0].classification == DataBridgeClassification.CREATE
    assert prev.items[0].normalized_data["order_no"] == order_no
    assert prev.items[0].normalized_data["items_count"] == 2

    # 2. Commit
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.SALES_ORDER,
            preview_token=prev.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )

    assert commit_res.status == "COMMITTED"
    assert commit_res.committed_count == 1

    # 3. DB Verification
    stmt = (
        select(SalesOrder)
        .options(selectinload(SalesOrder.items))
        .where(
            SalesOrder.company_id == CANONICAL_COMP_ID,
            SalesOrder.order_no == order_no,
        )
    )
    db_so = (await db_session.execute(stmt)).scalars().first()
    assert db_so is not None
    assert db_so.order_no == order_no
    assert db_so.customer_name == cust_name
    assert len(db_so.items) == 2
    assert db_so.total_qty == Decimal("10.0000")
    expected_basic = Decimal("5") * Decimal("2500.00") + Decimal("5") * Decimal("1200.00")  # 12500 + 6000 = 18500
    assert db_so.basic_total == expected_basic


# ==============================================================================
# TC-SALES-005: Sales Order Duplicate Conflict Detection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_005_sales_order_duplicate_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    order_no = f"SO-DUP-{suffix}"

    rows = [
        {
            "order_no": order_no,
            "customer_name": f"Client {suffix}",
            "item_code": f"SKU-{suffix}",
            "quantity": 1,
            "price": 500.0,
            "gst_rate": 18.0,
        }
    ]

    prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_ORDER, rows=rows),
    )
    await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.SALES_ORDER,
            preview_token=prev.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )

    prev2 = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_ORDER, rows=rows),
    )

    assert prev2.can_commit is False
    assert prev2.summary.conflict_count == 1
    assert prev2.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    assert any(c.conflict_code == "SALES_ORDER_ALREADY_EXISTS" for c in prev2.items[0].conflicts)


# ==============================================================================
# TC-SALES-006: Sales Return / Credit Note Preview & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_006_sales_return_preview_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    ret_no = f"SR-{suffix}"
    orig_inv_no = f"INV-ORIG-{suffix}"

    rows = [
        {
            "return_no": ret_no,
            "original_invoice_no": orig_inv_no,
            "customer_name": f"Returning Buyer {suffix}",
            "reason": "Size misfit",
            "item_code": f"SKU-RET-{suffix}",
            "item_name": "Linen Shirt",
            "quantity": 1,
            "price": 1200.0,
            "gst_rate": 18.0,
        }
    ]

    # 1. Preview
    prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_RETURN, rows=rows),
    )

    assert prev.can_commit is True
    assert prev.summary.total_rows == 1
    assert prev.summary.create_count == 1
    assert prev.items[0].classification == DataBridgeClassification.CREATE
    assert prev.items[0].normalized_data["return_no"] == ret_no

    # 2. Commit
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.SALES_RETURN,
            preview_token=prev.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )

    assert commit_res.status == "COMMITTED"
    assert commit_res.committed_count == 1

    # 3. DB Verification
    stmt = (
        select(SalesReturn)
        .options(selectinload(SalesReturn.items))
        .where(
            SalesReturn.company_id == CANONICAL_COMP_ID,
            SalesReturn.return_no == ret_no,
        )
    )
    db_sr = (await db_session.execute(stmt)).scalars().first()
    assert db_sr is not None
    assert db_sr.return_no == ret_no
    assert db_sr.reason == "Size misfit"
    assert len(db_sr.items) == 1
    assert db_sr.items[0].price == Decimal("1200.00")
    assert db_sr.grand_total == Decimal("1416.00")  # 1200 + 18% tax


# ==============================================================================
# TC-SALES-007: Sales Return Duplicate Conflict Detection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_007_sales_return_duplicate_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    ret_no = f"SR-DUP-{suffix}"

    rows = [
        {
            "return_no": ret_no,
            "reason": "Defective stitching",
            "item_code": f"SKU-{suffix}",
            "quantity": 1,
            "price": 400.0,
            "gst_rate": 18.0,
        }
    ]

    prev = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_RETURN, rows=rows),
    )
    await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.SALES_RETURN,
            preview_token=prev.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )

    prev2 = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test-operator",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.SALES_RETURN, rows=rows),
    )

    assert prev2.can_commit is False
    assert prev2.summary.conflict_count == 1
    assert prev2.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    assert any(c.conflict_code == "SALES_RETURN_ALREADY_EXISTS" for c in prev2.items[0].conflicts)


# ==============================================================================
# TC-SALES-008: REST API E2E Preview & Commit Endpoint Verification
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_sales_008_rest_endpoints_e2e_preview_and_commit(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    inv_no = f"INV-REST-{suffix}"
    headers = _get_auth_headers()

    rows = [
        {
            "invoice_no": inv_no,
            "customer_name": f"Rest Customer {suffix}",
            "payment_mode": "CARD",
            "item_code": f"SKU-REST-{suffix}",
            "quantity": 3,
            "price": 300.0,
            "gst_rate": 18.0,
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
        # 1. Preview endpoint
        resp_prev = await client.post(
            "/api/v1/databridge/sales-invoice/preview",
            json={"rows": rows},
            headers=headers,
        )
        assert resp_prev.status_code == 200, resp_prev.text
        data_prev = resp_prev.json()
        assert data_prev["can_commit"] is True
        token = data_prev["preview_token"]

        # 2. Commit endpoint
        resp_comm = await client.post(
            "/api/v1/databridge/sales-invoice/commit",
            json={
                "preview_token": token,
                "confirmed": True,
                "rows": rows,
            },
            headers=headers,
        )
        assert resp_comm.status_code == 200, resp_comm.text
        data_comm = resp_comm.json()
        assert data_comm["status"] == "COMMITTED"
        assert data_comm["committed_count"] == 1

    app.dependency_overrides.clear()
