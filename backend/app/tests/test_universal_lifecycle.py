"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.47.4
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Verification Suite for Universal Document Lifecycle Framework
with Purchase Order Pilot Implementation.
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem
from app.models.workflow import WorkflowEvent
from app.api.deps import TenantContext, get_db, get_company_db, get_current_user, get_tenant_context
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    LifecycleTransitionResult,
    LifecycleRegistry,
    ConcurrencyConflictException,
    InvalidTransitionException,
    PermissionDeniedException,
    DocumentNotFoundException,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers & Fixtures
# ---------------------------------------------------------------------------

async def create_test_tenant(db):
    cid = f"cmp_{uuid.uuid4().hex[:8]}"
    bid = f"br_{uuid.uuid4().hex[:8]}"
    company = Company(
        id=cid,
        company_code=f"CMP{uuid.uuid4().hex[:6].upper()}",
        name="Lifecycle Test Company",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"BR{uuid.uuid4().hex[:6].upper()}",
        company_id=cid,
        name="Main Branch",
        is_active=True,
        is_deleted=False,
    )
    db.add(company)
    db.add(branch)
    await db.flush()
    return cid, bid


async def create_test_user(db, cid, role=UserRole.MANAGER):
    uid = f"usr_{uuid.uuid4().hex[:8]}"
    user = User(
        id=uid,
        username=f"user_{uuid.uuid4().hex[:6]}",
        email=f"user_{uuid.uuid4().hex[:6]}@smriti.local",
        hashed_password="mock_hash",
        role=role,
        company_id=cid,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)
    await db.flush()
    return user


async def create_test_po(db, cid, bid, status="DRAFT", grand_total=Decimal("5000.00")):
    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid,
        name="Global Vendor Ltd",
        code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
        company_id=cid,
        branch_id=bid,
        outstanding=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db.add(supplier)
    await db.flush()

    pid = f"prod_{uuid.uuid4().hex[:8]}"
    product = Product(
        id=pid,
        name="Executive Shirt",
        code=f"ART-{uuid.uuid4().hex[:4].upper()}",
        barcode=f"BC-{uuid.uuid4().hex[:6].upper()}",
        category="Apparel",
        company_id=cid,
        branch_id=bid,
        cost_price=Decimal("500.00"),
        mrp=Decimal("1200.00"),
        is_active=True,
        is_deleted=False,
    )
    db.add(product)
    await db.flush()

    poid = f"po_{uuid.uuid4().hex[:8]}"
    po = PurchaseOrder(
        id=poid,
        order_no=f"PO-TEST-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=sid,
        status=status,
        company_id=cid,
        branch_id=bid,
        subtotal=grand_total,
        tax_total=Decimal("0.00"),
        grand_total=grand_total,
        is_active=True,
        is_deleted=False,
    )
    db.add(po)
    await db.flush()

    po_item = PurchaseOrderItem(
        id=f"poi_{uuid.uuid4().hex[:8]}",
        order_id=poid,
        product_id=pid,
        code=product.code,
        name=product.name,
        quantity=Decimal("10.00"),
        cost_price=Decimal("500.00"),
        line_total=grand_total,
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    db.add(po_item)
    await db.commit()
    return po


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

async def test_po_lifecycle_draft_to_submit_to_confirm(db_session):
    """
    Verifies the complete happy path: DRAFT -> SUBMITTED -> CONFIRMED.
    Asserts accurate state transitions and exact workflow_events audit records.
    """
    cid, bid = await create_test_tenant(db_session)
    user = await create_test_user(db_session, cid, role=UserRole.MANAGER)
    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    po = await create_test_po(db_session, cid, bid, status="DRAFT")

    # 1. Transition: SUBMIT
    ctx_submit = LifecycleTransitionContext(
        doc_type="PurchaseOrder",
        doc_id=po.id,
        action="SUBMIT",
        notes="Ready for managerial review",
    )
    res_submit = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=ctx_submit,
    )

    assert res_submit.success is True
    assert res_submit.from_status == "DRAFT"
    assert res_submit.to_status == "SUBMITTED"
    assert res_submit.action == "SUBMIT"
    assert "CONFIRM" in res_submit.available_actions or "APPROVE" in res_submit.available_actions

    # Verify PO in DB
    refreshed_po = (await db_session.execute(select(PurchaseOrder).where(PurchaseOrder.id == po.id))).scalars().first()
    assert refreshed_po.status == "SUBMITTED"
    assert refreshed_po.submitted_by == user.username
    assert refreshed_po.submitted_at is not None
    assert refreshed_po.is_deleted is False

    # 2. Transition: CONFIRM
    ctx_confirm = LifecycleTransitionContext(
        doc_type="PurchaseOrder",
        doc_id=po.id,
        action="CONFIRM",
        notes="Order approved and placed with supplier",
    )
    res_confirm = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=ctx_confirm,
    )

    assert res_confirm.success is True
    assert res_confirm.from_status == "SUBMITTED"
    assert res_confirm.to_status == "CONFIRMED"
    assert res_confirm.action == "CONFIRM"

    # Verify PO updated in DB
    refreshed_po_2 = (await db_session.execute(select(PurchaseOrder).where(PurchaseOrder.id == po.id))).scalars().first()
    assert refreshed_po_2.status == "CONFIRMED"
    assert refreshed_po_2.confirmed_by == user.username
    assert refreshed_po_2.confirmed_at is not None
    assert refreshed_po_2.is_deleted is False

    # 3. Verify WorkflowEvents audit trail
    events_res = await db_session.execute(
        select(WorkflowEvent)
        .where(WorkflowEvent.doc_id == po.id)
        .order_by(WorkflowEvent.created_at.asc())
    )
    events = events_res.scalars().all()
    assert len(events) == 2
    assert events[0].action == "SUBMIT"
    assert events[0].from_status == "DRAFT"
    assert events[0].to_status == "SUBMITTED"
    assert events[0].performed_by_name == user.username

    assert events[1].action == "CONFIRM"
    assert events[1].from_status == "SUBMITTED"
    assert events[1].to_status == "CONFIRMED"


async def test_invalid_transition_rejected(db_session):
    """
    Verifies that attempting an invalid state transition (e.g. DRAFT -> CONFIRM)
    is rejected with InvalidTransitionException without mutating the document.
    """
    cid, bid = await create_test_tenant(db_session)
    user = await create_test_user(db_session, cid, role=UserRole.MANAGER)
    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    po = await create_test_po(db_session, cid, bid, status="DRAFT")

    ctx_invalid = LifecycleTransitionContext(
        doc_type="PurchaseOrder",
        doc_id=po.id,
        action="CONFIRM",
    )

    with pytest.raises(InvalidTransitionException) as exc_info:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=ctx_invalid,
        )

    assert "Action 'CONFIRM' is not valid for current state 'DRAFT'" in str(exc_info.value)

    # Document status remains DRAFT
    refreshed_po = (await db_session.execute(select(PurchaseOrder).where(PurchaseOrder.id == po.id))).scalars().first()
    assert refreshed_po.status == "DRAFT"


async def test_optimistic_concurrency_conflict(db_session):
    """
    Verifies that supplying a stale expected_version triggers HTTP 409
    ConcurrencyConflictException to prevent overwriting concurrent updates.
    """
    cid, bid = await create_test_tenant(db_session)
    user = await create_test_user(db_session, cid, role=UserRole.MANAGER)
    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    po = await create_test_po(db_session, cid, bid, status="DRAFT")

    # PO version is 1, caller supplies expected_version=99
    ctx_stale = LifecycleTransitionContext(
        doc_type="PurchaseOrder",
        doc_id=po.id,
        action="SUBMIT",
        expected_version=99,
    )

    with pytest.raises(ConcurrencyConflictException) as exc_info:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=ctx_stale,
        )

    assert "Document has been modified by another user" in str(exc_info.value)
    assert exc_info.value.status_code == 409


async def test_po_cancellation_preserves_record_and_is_deleted_false(db_session):
    """
    CRITICAL INVARIANT TEST:
    Verifies that cancelling a Purchase Order sets status to CANCELLED,
    stamps cancellation audit columns, logs WorkflowEvent, and DOES NOT set is_deleted=True.
    The order must remain visible in standard queries.
    """
    cid, bid = await create_test_tenant(db_session)
    user = await create_test_user(db_session, cid, role=UserRole.MANAGER)
    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    po = await create_test_po(db_session, cid, bid, status="DRAFT")

    ctx_cancel = LifecycleTransitionContext(
        doc_type="PurchaseOrder",
        doc_id=po.id,
        action="CANCEL",
        payload={"reason": "Supplier out of fabric stock", "reason_code": "OUT_OF_STOCK"},
    )
    res_cancel = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=ctx_cancel,
    )

    assert res_cancel.success is True
    assert res_cancel.to_status == "CANCELLED"

    # Query using standard is_deleted == False filter
    query = select(PurchaseOrder).where(
        PurchaseOrder.id == po.id,
        PurchaseOrder.is_deleted == False,
    )
    cancelled_po = (await db_session.execute(query)).scalars().first()
    assert cancelled_po is not None
    assert cancelled_po.status == "CANCELLED"
    assert cancelled_po.is_deleted is False
    assert cancelled_po.cancelled_by == user.username
    assert cancelled_po.cancelled_at is not None
    assert "OUT_OF_STOCK" in (cancelled_po.cancellation_reason or "") or "fabric stock" in (cancelled_po.cancellation_reason or "")


async def test_cross_tenant_isolation_denied(db_session):
    """
    Verifies that attempting to transition a document belonging to Company A
    from Company B's tenant context produces DocumentNotFoundException.
    """
    cid_a, bid_a = await create_test_tenant(db_session)
    cid_b, bid_b = await create_test_tenant(db_session)

    user_b = await create_test_user(db_session, cid_b, role=UserRole.MANAGER)
    tenant_b = TenantContext(company_id=cid_b, branch_id=bid_b)

    po_a = await create_test_po(db_session, cid_a, bid_a, status="DRAFT")

    ctx_cross = LifecycleTransitionContext(
        doc_type="PurchaseOrder",
        doc_id=po_a.id,
        action="SUBMIT",
    )

    with pytest.raises(DocumentNotFoundException):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_b,
            user=user_b,
            ctx=ctx_cross,
        )


async def test_universal_lifecycle_api_endpoints(db_session):
    """
    Tests the HTTP API surface:
    - POST /api/v1/lifecycle/{doc_type}/{doc_id}/{action}
    - GET /api/v1/lifecycle/{doc_type}/{doc_id}/state
    - GET /api/v1/lifecycle/{doc_type}/{doc_id}/events
    """
    cid, bid = await create_test_tenant(db_session)
    user = await create_test_user(db_session, cid, role=UserRole.MANAGER)
    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    po = await create_test_po(db_session, cid, bid, status="DRAFT")

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_tenant_context] = lambda: tenant_ctx

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Query State
        r_state = await client.get(f"/api/v1/lifecycle/PurchaseOrder/{po.id}/state")
        assert r_state.status_code == 200
        state_data = r_state.json()
        assert state_data["status"] == "DRAFT"
        assert "SUBMIT" in state_data["available_actions"]

        # 2. Execute SUBMIT via Universal API
        r_trans = await client.post(
            f"/api/v1/lifecycle/PurchaseOrder/{po.id}/SUBMIT",
            json={"notes": "HTTP API Submit Test"},
        )
        assert r_trans.status_code == 200
        trans_data = r_trans.json()
        assert trans_data["success"] is True
        assert trans_data["from_status"] == "DRAFT"
        assert trans_data["to_status"] == "SUBMITTED"

        # 3. Query Audit Events
        r_events = await client.get(f"/api/v1/lifecycle/PurchaseOrder/{po.id}/events")
        assert r_events.status_code == 200
        events_data = r_events.json()
        assert len(events_data) == 1
        assert events_data[0]["action"] == "SUBMIT"
        assert events_data[0]["from_status"] == "DRAFT"
        assert events_data[0]["to_status"] == "SUBMITTED"


async def test_architectural_acceptance_pluggable_handler_coexistence(db_session):
    """
    ARCHITECTURAL ACCEPTANCE TEST:
    Proves that UniversalLifecycleEngine can process a new document family
    (e.g. SalesOrder, StockTransfer, GoodsReceipt, Payment) simply by registering
    a new BaseDocumentLifecycleHandler, with ZERO modifications or branching
    inside UniversalLifecycleEngine.
    """
    from app.services.lifecycle.contracts import BaseDocumentLifecycleHandler
    from app.services.lifecycle.registry import register_lifecycle_handler

    # Mock in-memory document representing a future Sales Order
    class MockSalesOrder:
        def __init__(self, doc_id, company_id, status="DRAFT"):
            self.id = doc_id
            self.company_id = company_id
            self.order_no = f"SO-{doc_id[-6:]}"
            self.status = status
            self.version = 1
            self.grand_total = Decimal("15000.00")
            self.is_deleted = False
            self.confirmed_by = None

    fake_sales_orders: dict[str, MockSalesOrder] = {}

    # Future Domain Handler for Sales Order
    @register_lifecycle_handler("SalesOrder", "SALES_ORDER")
    class SalesOrderLifecycleHandler(BaseDocumentLifecycleHandler):
        document_type = "SalesOrder"

        def get_resource_name(self) -> str:
            return "sales_order"

        def get_document_summary(self, doc: MockSalesOrder) -> dict:
            return {"order_no": doc.order_no}

        def get_default_workflow_definition(self) -> dict:
            return {
                "code": "WF_SALES_ORDER",
                "version": 1,
                "doc_type": "SalesOrder",
                "initial_state": "DRAFT",
                "states": ["DRAFT", "CONFIRMED", "CANCELLED"],
                "transitions": [
                    {"from": "DRAFT", "to": "CONFIRMED", "action": "CONFIRM", "required_roles": ["MANAGER", "SYSADMIN"]},
                    {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                ],
            }

        async def get_document(self, db, doc_id, tenant_ctx):
            doc = fake_sales_orders.get(doc_id)
            if not doc or doc.company_id != tenant_ctx.company_id:
                raise DocumentNotFoundException(self.document_type, doc_id)
            return doc

        def get_document_amount(self, doc: MockSalesOrder) -> Decimal:
            return doc.grand_total

        async def apply_transition(self, db, doc, action, next_state, user, tenant_ctx, payload=None):
            doc.status = next_state
            if action == "CONFIRM":
                doc.confirmed_by = user.username

    # Set up tenant and user
    cid, bid = await create_test_tenant(db_session)
    user = await create_test_user(db_session, cid, role=UserRole.MANAGER)
    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)

    so_id = f"so_{uuid.uuid4().hex[:8]}"
    fake_sales_orders[so_id] = MockSalesOrder(so_id, cid, status="DRAFT")

    # 1. Execute transition on SalesOrder via UniversalLifecycleEngine
    ctx_so = LifecycleTransitionContext(
        doc_type="SalesOrder",
        doc_id=so_id,
        action="CONFIRM",
        notes="Sales order authorized for fulfillment",
    )
    result_so = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=ctx_so,
    )

    assert result_so.success is True
    assert result_so.doc_type == "SalesOrder"
    assert result_so.from_status == "DRAFT"
    assert result_so.to_status == "CONFIRMED"
    assert fake_sales_orders[so_id].status == "CONFIRMED"
    assert fake_sales_orders[so_id].confirmed_by == user.username

    # 2. Also execute transition on PurchaseOrder in the same engine session
    po = await create_test_po(db_session, cid, bid, status="DRAFT")
    ctx_po = LifecycleTransitionContext(
        doc_type="PurchaseOrder",
        doc_id=po.id,
        action="SUBMIT",
    )
    result_po = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=ctx_po,
    )

    assert result_po.success is True
    assert result_po.doc_type == "PurchaseOrder"
    assert result_po.to_status == "SUBMITTED"

    # Both handlers coexisted simultaneously with zero changes to UniversalLifecycleEngine!

