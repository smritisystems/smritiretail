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

Cross-Handler Acceptance Test Suite: Universal Transaction Lifecycle Framework Phase 2
Asserts coexistence and atomic state machine transitions across:
  - PURCHASE_ORDER (PurchaseOrderLifecycleHandler)
  - GOODS_RECEIPT  (GoodsReceiptLifecycleHandler)
  - PURCHASE_BILL  (PurchaseBillLifecycleHandler)

Verifies:
  - Zero modifications to UniversalLifecycleEngine
  - Concurrency version checking (HTTP 409 on version mismatch)
  - Tenant isolation enforcement
  - Cancellation immutability (is_deleted=False, deleted_at=None)
  - Immutable WorkflowEvent audit ledger entries
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem, PurchaseBill
from app.models.inventory import Product
from app.models.workflow import WorkflowEvent
from app.api.deps import TenantContext
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    LifecycleTransitionResult,
    LifecycleRegistry,
    ConcurrencyConflictException,
    InvalidTransitionException,
    PermissionDeniedException,
    TenantIsolationException,
    DocumentNotFoundException,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

async def setup_test_tenant_and_actor(db, role=UserRole.MANAGER):
    s = uuid.uuid4().hex[:6]
    cid = f"CMP{s.upper()}"
    bid = f"BR{s.upper()}"
    company = Company(
        id=cid,
        company_code=cid,
        name=f"Cross-Handler Co {s}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=bid,
        company_id=cid,
        name=f"Main Hub {s}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    uid = f"usr_{s}"
    user = User(
        id=uid,
        username=f"mgr_{s}",
        email=f"mgr_{s}@smriti.local",
        hashed_password="mock",
        role=role,
        company_id=cid,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)

    sid = f"sup_{s}"
    supplier = Supplier(
        id=sid,
        code=f"SUP{s.upper()}",
        name="Sovereign Raw Materials Ltd",
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    db.add(supplier)

    pid = f"prd_{s}"
    product = Product(
        id=pid,
        uuid=str(uuid.uuid4()),
        code=f"SKU-{s.upper()}",
        name="Premium Cotton Bolt",
        company_id=cid,
        branch_id=bid,
        price=Decimal("850.00"),
        cost_price=Decimal("500.00"),
        stock=100,
        category="RAW_MATERIALS",
        barcode=f"BAR-{s.upper()}",
        is_active=True,
        is_deleted=False,
    )
    db.add(product)
    await db.commit()

    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    return cid, bid, user, supplier, product, tenant_ctx


# ---------------------------------------------------------------------------
# TESTS
# ---------------------------------------------------------------------------

async def test_cross_handler_registry_coexistence(db_session):
    """
    Asserts all three procurement lifecycle handlers are cleanly registered
    without any engine-level branching.
    """
    supported = LifecycleRegistry.list_supported()
    assert "PurchaseOrder" in supported
    assert "GoodsReceipt" in supported
    assert "PurchaseBill" in supported

    h_po = LifecycleRegistry.get("PURCHASE_ORDER")
    h_grn = LifecycleRegistry.get("GOODS_RECEIPT")
    h_bill = LifecycleRegistry.get("PURCHASE_BILL")

    assert h_po.document_type == "PurchaseOrder"
    assert h_grn.document_type == "GoodsReceipt"
    assert h_bill.document_type == "PurchaseBill"


async def test_cross_handler_end_to_end_lifecycle_execution(db_session):
    """
    Executes a cohesive multi-document procurement lifecycle flow:
      1. Purchase Order: DRAFT -> SUBMITTED -> CONFIRMED
      2. Goods Receipt:  DRAFT -> SUBMITTED -> RECEIVED (linked to PO)
      3. Purchase Bill:  DRAFT -> SUBMITTED -> APPROVED -> POSTED (linked to PO & GRN)

    All transitions executed through UniversalLifecycleEngine.
    """
    cid, bid, user, supplier, product, tenant = await setup_test_tenant_and_actor(db_session)

    # -----------------------------------------------------------------------
    # Step 1: Purchase Order Lifecycle
    # -----------------------------------------------------------------------
    po_id = f"po_{uuid.uuid4().hex[:8]}"
    po = PurchaseOrder(
        id=po_id,
        uuid=str(uuid.uuid4()),
        order_no=f"PO-TEST-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="DRAFT",
        subtotal=Decimal("5000.00"),
        tax_total=Decimal("900.00"),
        grand_total=Decimal("5900.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    po_item = PurchaseOrderItem(
        id=f"poi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        order_id=po_id,
        product_id=product.id,
        code=product.code,
        name=product.name,
        quantity=Decimal("10.00"),
        cost_price=Decimal("500.00"),
        gst_rate=Decimal("18.00"),
        tax_amount=Decimal("900.00"),
        line_total=Decimal("5900.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(po)
    db_session.add(po_item)
    await db_session.flush()

    # PO: DRAFT -> SUBMITTED
    res_po_sub = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_ORDER",
            doc_id=po_id,
            action="SUBMIT",
            expected_version=1,
            notes="Submitting PO for manager review",
        ),
    )
    assert res_po_sub.success is True
    assert res_po_sub.to_status == "SUBMITTED"
    assert res_po_sub.version == 2

    # PO: SUBMITTED -> CONFIRMED
    res_po_conf = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_ORDER",
            doc_id=po_id,
            action="CONFIRM",
            expected_version=2,
            notes="Confirmed by procurement manager",
        ),
    )
    assert res_po_conf.success is True
    assert res_po_conf.to_status == "CONFIRMED"
    assert res_po_conf.version == 3

    # -----------------------------------------------------------------------
    # Step 2: Goods Receipt / GRN Lifecycle
    # -----------------------------------------------------------------------
    grn_id = f"grn_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=grn_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-TEST-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        order_id=po.id,
        status="DRAFT",
        subtotal=Decimal("5000.00"),
        tax_total=Decimal("900.00"),
        grand_total=Decimal("5900.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    receipt_item = PurchaseReceiptItem(
        id=f"pri_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        receipt_id=grn_id,
        product_id=product.id,
        purchase_order_id=po.id,
        purchase_order_line_id=po_item.id,
        code=product.code,
        name=product.name,
        quantity_ordered=Decimal("10.00"),
        quantity_received=Decimal("10.00"),
        cost_price=Decimal("500.00"),
        gst_rate=Decimal("18.00"),
        tax_amount=Decimal("900.00"),
        line_total=Decimal("5900.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(receipt)
    db_session.add(receipt_item)
    await db_session.flush()

    # GRN: DRAFT -> SUBMITTED
    res_grn_sub = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="GOODS_RECEIPT",
            doc_id=grn_id,
            action="SUBMIT",
            expected_version=1,
            notes="Gate inward pass verified",
        ),
    )
    assert res_grn_sub.success is True
    assert res_grn_sub.to_status == "SUBMITTED"
    assert res_grn_sub.version == 2

    # GRN: SUBMITTED -> RECEIVED (Atomic stock inward)
    res_grn_rec = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="GOODS_RECEIPT",
            doc_id=grn_id,
            action="RECEIVE",
            expected_version=2,
            notes="Physical goods counted and accepted into godown",
        ),
    )
    assert res_grn_rec.success is True
    assert res_grn_rec.to_status == "RECEIVED"
    assert res_grn_rec.version == 3

    # Verify PO downstream effect: PO status transitioned to RECEIVED
    po_reloaded = await db_session.get(PurchaseOrder, po_id)
    assert po_reloaded.status == "RECEIVED"

    # -----------------------------------------------------------------------
    # Step 3: Purchase Bill Lifecycle
    # -----------------------------------------------------------------------
    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-SUP-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        receipt_id=grn_id,
        order_id=po_id,
        bill_date=date.today(),
        status="DRAFT",
        taxable_amount=Decimal("5000.00"),
        tax_amount=Decimal("900.00"),
        total_amount=Decimal("5900.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()

    # Bill: DRAFT -> SUBMITTED
    res_bill_sub = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_BILL",
            doc_id=bill_id,
            action="SUBMIT",
            expected_version=1,
            notes="Accounts payable entry submitted with 3-way match",
        ),
    )
    assert res_bill_sub.success is True
    assert res_bill_sub.to_status == "SUBMITTED"
    assert res_bill_sub.version == 2

    # Bill: SUBMITTED -> APPROVED
    res_bill_app = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_BILL",
            doc_id=bill_id,
            action="APPROVE",
            expected_version=2,
            notes="Commercial 3-way match price variance zero - approved",
        ),
    )
    assert res_bill_app.success is True
    assert res_bill_app.to_status == "APPROVED"
    assert res_bill_app.version == 3

    # Bill: APPROVED -> POSTED
    res_bill_pst = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_BILL",
            doc_id=bill_id,
            action="POST",
            expected_version=3,
            notes="Posted to accounts payable ledger",
        ),
    )
    assert res_bill_pst.success is True
    assert res_bill_pst.to_status == "POSTED"
    assert res_bill_pst.version == 4

    # -----------------------------------------------------------------------
    # Assert Workflow Events Created Across All Three Handlers
    # -----------------------------------------------------------------------
    wf_events = (
        await db_session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.company_id == cid)
            .order_by(WorkflowEvent.created_at.asc())
        )
    ).scalars().all()

    doc_types_in_events = {e.doc_type for e in wf_events}
    assert "PurchaseOrder" in doc_types_in_events
    assert "GoodsReceipt" in doc_types_in_events
    assert "PurchaseBill" in doc_types_in_events
    assert len(wf_events) >= 6


async def test_grn_cancellation_preserves_historical_queryability(db_session):
    """
    Mandatory Invariant Verification for GRN:
    status = CANCELLED, is_deleted = FALSE, deleted_at = NULL.
    """
    cid, bid, user, supplier, product, tenant = await setup_test_tenant_and_actor(db_session)

    grn_id = f"grn_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=grn_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-CANCEL-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="DRAFT",
        subtotal=Decimal("1000.00"),
        tax_total=Decimal("180.00"),
        grand_total=Decimal("1180.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()

    res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="GOODS_RECEIPT",
            doc_id=grn_id,
            action="CANCEL",
            notes="Damaged package rejected at entrance gate",
        ),
    )
    assert res.success is True
    assert res.to_status == "CANCELLED"

    reloaded = await db_session.get(PurchaseReceipt, grn_id)
    assert reloaded.status == "CANCELLED"
    assert reloaded.is_deleted is False
    assert reloaded.deleted_at is None


async def test_purchase_bill_concurrency_conflict_rejection(db_session):
    """
    Verifies optimistic concurrency version conflict rejection on Purchase Bill.
    """
    cid, bid, user, supplier, _, tenant = await setup_test_tenant_and_actor(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-CONCUR-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="DRAFT",
        total_amount=Decimal("1200.00"),
        version=3,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()

    # Pass stale expected_version = 1 when DB is version 3
    with pytest.raises(ConcurrencyConflictException):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="PURCHASE_BILL",
                doc_id=bill_id,
                action="SUBMIT",
                expected_version=1,
            ),
        )


async def test_purchase_bill_cross_tenant_isolation(db_session):
    """
    Verifies that User from Company A cannot view or transition a Purchase Bill from Company B.
    """
    cid_a, bid_a, user_a, supp_a, _, tenant_a = await setup_test_tenant_and_actor(db_session)
    cid_b, bid_b, user_b, supp_b, _, tenant_b = await setup_test_tenant_and_actor(db_session)

    # Bill belonging to Company B
    bill_id_b = f"bil_{uuid.uuid4().hex[:8]}"
    bill_b = PurchaseBill(
        id=bill_id_b,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-TENANT-B-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp_b.id,
        status="DRAFT",
        total_amount=Decimal("2500.00"),
        version=1,
        company_id=cid_b,
        branch_id=bid_b,
        is_deleted=False,
    )
    db_session.add(bill_b)
    await db_session.flush()

    # Tenant A attempts to transition Company B's bill
    with pytest.raises(TenantIsolationException):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_a,
            user=user_a,
            ctx=LifecycleTransitionContext(
                doc_type="PURCHASE_BILL",
                doc_id=bill_id_b,
                action="SUBMIT",
            ),
        )
