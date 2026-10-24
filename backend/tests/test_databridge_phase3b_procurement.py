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
Classification: Automated Test Suite — SMRITI DataBridge Phase 3B Procurement Adapters
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
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseBill, Supplier
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
# TC-PROC-001: Purchase Order Multi-Line Grouping, Preview & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_001_po_create_with_lines(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    order_no = f"PO-{suffix}"
    supp_code = f"SUPP-{suffix}"

    supp = Supplier(
        id=f"SUPP-ID-{suffix}",
        code=supp_code,
        name=f"Vendor Global {suffix}",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        outstanding=Decimal("0.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    rows = [
        {
            "order_no": order_no,
            "supplier_code": supp_code,
            "notes": "Urgent warehouse restock",
            "item_code": f"SKU-A-{suffix}",
            "item_name": "Premium Cotton Shirt",
            "quantity": 10,
            "cost_price": 500.0,
            "gst_rate": 18.0,
        },
        {
            "order_no": order_no,
            "supplier_code": supp_code,
            "notes": "Urgent warehouse restock",
            "item_code": f"SKU-B-{suffix}",
            "item_name": "Denim Trousers",
            "quantity": 5,
            "cost_price": 1000.0,
            "gst_rate": 18.0,
        },
    ]

    preview_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.PURCHASE_ORDER,
        rows=rows,
    )

    preview_resp = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=preview_req,
    )

    assert len(preview_resp.items) == 1
    item = preview_resp.items[0]
    assert item.classification == DataBridgeClassification.CREATE
    assert item.target_identifier == order_no
    assert len(item.conflicts) == 0

    norm_data = item.normalized_data
    assert norm_data["order_no"] == order_no
    assert norm_data["item_count"] == 2
    assert norm_data["subtotal"] == "10000.00"
    assert norm_data["tax_total"] == "1800.00"
    assert norm_data["grand_total"] == "11800.00"

    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.PURCHASE_ORDER,
        preview_token=preview_resp.preview_token,
        confirmed=True,
        rows=rows,
    )

    commit_resp = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=commit_req,
    )

    assert commit_resp.summary.create_count == 1
    assert len(commit_resp.items) == 1

    po_stmt = select(PurchaseOrder).where(
        PurchaseOrder.company_id == CANONICAL_COMP_ID,
        PurchaseOrder.order_no == order_no,
    )
    po_obj = (await db_session.execute(po_stmt)).scalars().first()
    assert po_obj is not None
    assert po_obj.order_no == order_no
    assert po_obj.supplier_id == supp.id
    assert po_obj.grand_total == Decimal("11800.00")
    assert len(po_obj.items) == 2


# ==============================================================================
# TC-PROC-002: Purchase Order Replay & Immutability Classification
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_002_po_existing_no_change_and_conflict(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    order_no = f"PO-{suffix}"
    supp_code = f"SUPP-{suffix}"

    supp = Supplier(
        id=f"SUPP-ID-{suffix}",
        code=supp_code,
        name=f"Vendor Replay {suffix}",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        outstanding=Decimal("0.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    prod = Product(
        id=f"PROD-{suffix}",
        code=f"SKU-{suffix}",
        sku=f"SKU-{suffix}",
        barcode=f"SKU-{suffix}",
        name="Sample Item",
        category="General",
        price=Decimal("1000.00"),
        cost_price=Decimal("1000.00"),
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
    )
    db_session.add(prod)
    await db_session.flush()

    po = PurchaseOrder(
        id=f"PO-ID-{suffix}",
        order_no=order_no,
        supplier_id=supp.id,
        status="DRAFT",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        subtotal=Decimal("1000.00"),
        tax_total=Decimal("180.00"),
        grand_total=Decimal("1180.00"),
    )
    po_item = PurchaseOrderItem(
        id=f"POI-ID-{suffix}",
        order_id=po.id,
        product_id=f"PROD-{suffix}",
        code=f"SKU-{suffix}",
        name="Sample Item",
        quantity=Decimal("1"),
        cost_price=Decimal("1000.00"),
        gst_rate=Decimal("18.00"),
        tax_amount=Decimal("180.00"),
        line_total=Decimal("1180.00"),
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
    )
    db_session.add_all([po, po_item])
    await db_session.flush()

    rows = [
        {
            "order_no": order_no,
            "supplier_code": supp_code,
            "item_code": f"SKU-{suffix}",
            "quantity": 1,
            "cost_price": 1000.0,
            "gst_rate": 18.0,
        }
    ]

    preview_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.PURCHASE_ORDER,
        rows=rows,
    )
    preview_resp = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=preview_req,
    )
    assert preview_resp.items[0].classification == DataBridgeClassification.NO_CHANGE

    po.status = "CONFIRMED"
    await db_session.flush()

    preview_conf = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=preview_req,
    )
    assert preview_conf.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    assert any(c.conflict_code == "ORDER_IMMUTABLE" for c in preview_conf.items[0].conflicts)


# ==============================================================================
# TC-PROC-003: Supplier Auto-Provisioning on Purchase Order Ingress
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_003_po_supplier_auto_provisioning(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    order_no = f"PO-AUTO-{suffix}"
    unknown_supp_name = f"Auto Created Vendor {suffix}"
    unknown_supp_code = f"SUP-NEW-{suffix}"
    supp_gstin = f"27AAAA{suffix[:4]}1Z5"

    rows = [
        {
            "order_no": order_no,
            "supplier_name": unknown_supp_name,
            "supplier_code": unknown_supp_code,
            "supplier_gstin": supp_gstin,
            "item_code": f"SKU-{suffix}",
            "quantity": 2,
            "cost_price": 150.0,
        }
    ]

    preview_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.PURCHASE_ORDER,
        rows=rows,
    )
    preview_resp = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=preview_req,
    )
    assert preview_resp.items[0].classification == DataBridgeClassification.CREATE

    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.PURCHASE_ORDER,
        preview_token=preview_resp.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_resp = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=commit_req,
    )
    assert commit_resp.summary.create_count == 1

    s_stmt = select(Supplier).where(
        Supplier.company_id == CANONICAL_COMP_ID,
        Supplier.code == unknown_supp_code,
    )
    supp_obj = (await db_session.execute(s_stmt)).scalars().first()
    assert supp_obj is not None
    assert supp_obj.name == unknown_supp_name
    assert supp_obj.gst_number == supp_gstin


# ==============================================================================
# TC-PROC-004: Purchase Order Validation & Duplicate In-File Detection
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_004_po_line_math_validation(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()

    invalid_rows = [
        {
            "order_no": f"PO-BAD-{suffix}",
            "supplier_name": "Test Vendor",
            "item_code": "SKU-BAD-1",
            "quantity": 0,
            "cost_price": 100.0,
        },
        {
            "order_no": f"PO-BAD2-{suffix}",
            "supplier_name": "Test Vendor",
            "item_code": "SKU-BAD-2",
            "quantity": 5,
            "cost_price": -50.0,
        },
    ]

    preview_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.PURCHASE_ORDER,
        rows=invalid_rows,
    )
    preview_resp = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=preview_req,
    )

    errs_0 = [c.conflict_code for c in preview_resp.items[0].conflicts]
    assert "SMRITI-VAL-PO-LINE-QTY" in errs_0

    errs_1 = [c.conflict_code for c in preview_resp.items[1].conflicts]
    assert "SMRITI-VAL-PO-LINE-COST" in errs_1


# ==============================================================================
# TC-PROC-005: Goods Receipt Note (GRN) Inwarding & Commit
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_005_grn_create_and_match(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    receipt_no = f"GRN-{suffix}"
    supp_code = f"SUPP-GRN-{suffix}"

    supp = Supplier(
        id=f"SUPP-GRN-ID-{suffix}",
        code=supp_code,
        name=f"GRN Vendor {suffix}",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        outstanding=Decimal("0.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    rows = [
        {
            "receipt_no": receipt_no,
            "supplier_code": supp_code,
            "notes": "Direct factory shipment",
            "item_code": f"SKU-GRN-{suffix}",
            "item_name": "Silk Scarf",
            "batch_no": f"BATCH-{suffix}",
            "quantity_received": 25,
            "cost_price": 200.0,
            "gst_rate": 18.0,
        }
    ]

    preview_req = DataBridgePreviewRequest(
        entity_type=DataBridgeEntityType.GOODS_RECEIPT_NOTE,
        rows=rows,
    )
    preview_resp = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=preview_req,
    )

    assert len(preview_resp.items) == 1
    assert preview_resp.items[0].classification == DataBridgeClassification.CREATE
    assert preview_resp.items[0].normalized_data["receipt_no"] == receipt_no

    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.GOODS_RECEIPT_NOTE,
        preview_token=preview_resp.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_resp = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=commit_req,
    )
    assert commit_resp.summary.create_count == 1

    grn_stmt = select(PurchaseReceipt).where(
        PurchaseReceipt.company_id == CANONICAL_COMP_ID,
        PurchaseReceipt.receipt_no == receipt_no,
    )
    grn_obj = (await db_session.execute(grn_stmt)).scalars().first()
    assert grn_obj is not None
    assert grn_obj.supplier_id == supp.id


# ==============================================================================
# TC-PROC-006: Purchase Invoice / Bill Creation & Math Invariant Check
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_006_purchase_bill_create(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    bill_no = f"BILL-{suffix}"
    supp_code = f"SUPP-BILL-{suffix}"

    supp = Supplier(
        id=f"SUPP-BILL-ID-{suffix}",
        code=supp_code,
        name=f"Billing Vendor {suffix}",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        outstanding=Decimal("0.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    bad_rows = [
        {
            "bill_no": bill_no,
            "supplier_code": supp_code,
            "taxable_amount": 1000.0,
            "tax_amount": 180.0,
            "total_amount": 1500.0,
        }
    ]
    preview_bad = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(
            entity_type=DataBridgeEntityType.PURCHASE_INVOICE,
            rows=bad_rows,
        ),
    )
    err_codes = [c.conflict_code for c in preview_bad.items[0].conflicts]
    assert "SMRITI-VAL-BILL-MATH-INVARIANT" in err_codes

    valid_rows = [
        {
            "bill_no": bill_no,
            "supplier_code": supp_code,
            "taxable_amount": 1000.0,
            "tax_amount": 180.0,
            "total_amount": 1180.0,
            "notes": "Verified against delivery challan",
        }
    ]
    preview_good = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(
            entity_type=DataBridgeEntityType.PURCHASE_INVOICE,
            rows=valid_rows,
        ),
    )
    assert preview_good.items[0].classification == DataBridgeClassification.CREATE

    commit_resp = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.PURCHASE_INVOICE,
            preview_token=preview_good.preview_token,
            confirmed=True,
            rows=valid_rows,
        ),
    )
    assert commit_resp.summary.create_count == 1

    b_stmt = select(PurchaseBill).where(
        PurchaseBill.company_id == CANONICAL_COMP_ID,
        PurchaseBill.bill_no == bill_no,
    )
    bill_obj = (await db_session.execute(b_stmt)).scalars().first()
    assert bill_obj is not None
    assert bill_obj.total_amount == Decimal("1180.00")


# ==============================================================================
# TC-PROC-007: Purchase Debit Note Creation & GL Posting
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_007_debit_note_create(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    dn_no = f"DN-{suffix}"
    supp_code = f"SUPP-DN-{suffix}"

    supp = Supplier(
        id=f"SUPP-DN-ID-{suffix}",
        code=supp_code,
        name=f"Debit Vendor {suffix}",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        outstanding=Decimal("5000.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    rows = [
        {
            "debit_note_no": dn_no,
            "supplier_code": supp_code,
            "claim_amount": 500.0,
            "tax_amount": 90.0,
            "total_debit_amount": 590.0,
            "reason": "Damaged goods returned to manufacturer",
        }
    ]

    preview_resp = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=DataBridgePreviewRequest(
            entity_type=DataBridgeEntityType.PURCHASE_DEBIT_NOTE,
            rows=rows,
        ),
    )
    assert preview_resp.items[0].classification == DataBridgeClassification.CREATE

    commit_resp = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        actor_id="test_admin",
        actor_role="SYSADMIN",
        req=DataBridgeCommitRequest(
            entity_type=DataBridgeEntityType.PURCHASE_DEBIT_NOTE,
            preview_token=preview_resp.preview_token,
            confirmed=True,
            rows=rows,
        ),
    )
    assert commit_resp.summary.create_count == 1
    assert commit_resp.items[0].normalized_data["debit_note_no"] == dn_no


# ==============================================================================
# TC-PROC-008: HTTP API Endpoints for Procurement Documents
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_proc_008_api_procurement_endpoints(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    order_no = f"PO-API-{suffix}"
    supp_code = f"SUPP-API-{suffix}"

    supp = Supplier(
        id=f"SUPP-API-ID-{suffix}",
        code=supp_code,
        name=f"API Vendor {suffix}",
        company_id=CANONICAL_COMP_ID,
        branch_id="BR-MAIN-001",
        outstanding=Decimal("0.00"),
    )
    db_session.add(supp)
    await db_session.flush()

    headers = _get_auth_headers()

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
            # 1. Purchase Order Preview & Commit
            po_rows = [
                {
                    "order_no": order_no,
                    "supplier_code": supp_code,
                    "item_code": "SKU-T1",
                    "quantity": 5,
                    "cost_price": 100.0,
                }
            ]
            po_prev_res = await client.post(
                "/api/v1/databridge/purchase-order/preview",
                json={"rows": po_rows},
                headers=headers,
            )
            assert po_prev_res.status_code == 200, f"Preview failed: {po_prev_res.text}"
            po_prev_data = po_prev_res.json()
            assert po_prev_data["items"][0]["classification"] == "CREATE"
            token = po_prev_data["preview_token"]

            po_commit_res = await client.post(
                "/api/v1/databridge/purchase-order/commit",
                json={
                    "preview_token": token,
                    "confirmed": True,
                    "rows": po_rows,
                },
                headers=headers,
            )
            assert po_commit_res.status_code == 200, f"Commit failed: {po_commit_res.text}"
            assert po_commit_res.json()["status"] == "COMMITTED"
            assert po_commit_res.json()["committed_count"] == 1

            # 2. GRN Preview
            grn_rows = [
                {
                    "receipt_no": f"GRN-API-{suffix}",
                    "supplier_code": supp_code,
                    "item_code": "SKU-T1",
                    "quantity_received": 5,
                    "cost_price": 100.0,
                }
            ]
            grn_prev_res = await client.post(
                "/api/v1/databridge/grn/preview",
                json={"rows": grn_rows},
                headers=headers,
            )
            assert grn_prev_res.status_code == 200, f"GRN preview failed: {grn_prev_res.text}"
            assert grn_prev_res.json()["items"][0]["classification"] == "CREATE"

            # 3. Purchase Invoice Preview
            inv_rows = [
                {
                    "bill_no": f"INV-API-{suffix}",
                    "supplier_code": supp_code,
                    "taxable_amount": 500.0,
                    "tax_amount": 90.0,
                    "total_amount": 590.0,
                }
            ]
            inv_prev_res = await client.post(
                "/api/v1/databridge/purchase-invoice/preview",
                json={"rows": inv_rows},
                headers=headers,
            )
            assert inv_prev_res.status_code == 200, f"Invoice preview failed: {inv_prev_res.text}"
            assert inv_prev_res.json()["items"][0]["classification"] == "CREATE"

            # 4. Debit Note Preview
            dn_rows = [
                {
                    "debit_note_no": f"DN-API-{suffix}",
                    "supplier_code": supp_code,
                    "claim_amount": 100.0,
                    "tax_amount": 18.0,
                    "total_debit_amount": 118.0,
                }
            ]
            dn_prev_res = await client.post(
                "/api/v1/databridge/purchase-debit-note/preview",
                json={"rows": dn_rows},
                headers=headers,
            )
            assert dn_prev_res.status_code == 200, f"Debit Note preview failed: {dn_prev_res.text}"
            assert dn_prev_res.json()["items"][0]["classification"] == "CREATE"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_databridge_entitlement, None)
        app.dependency_overrides.pop(get_company_db, None)
