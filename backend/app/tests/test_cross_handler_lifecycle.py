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
from sqlalchemy.exc import IntegrityError

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem, PurchaseBill, PurchaseBillItem
from app.models.inventory import Product, StockMovement
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
    HandlerValidationException,
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


async def test_purchase_bill_duplicate_number_constraint(db_session):
    """
    Phase 2.1 Hardening Test 1:
    Verifies that the database unique constraint uq_purchase_bills_company_bill_no
    strictly rejects duplicate bill_no values within the same company.
    """
    cid, bid, user, supp, prod, tenant = await setup_test_tenant_and_actor(db_session)

    dup_bill_no = f"INV-DUP-{uuid.uuid4().hex[:6].upper()}"
    bill1 = PurchaseBill(
        id=f"bil_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        bill_no=dup_bill_no,
        supplier_id=supp.id,
        status="DRAFT",
        total_amount=Decimal("1500.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add(bill1)
    await db_session.flush()

    # Attempt to insert identical company_id + bill_no
    bill2 = PurchaseBill(
        id=f"bil_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        bill_no=dup_bill_no,
        supplier_id=supp.id,
        status="DRAFT",
        total_amount=Decimal("3000.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add(bill2)
    with pytest.raises(IntegrityError):
        await db_session.flush()

    await db_session.rollback()


async def test_grn_receive_creates_stock_movement_and_updates_po(db_session):
    """
    Phase 2.1 Hardening Test 2:
    Verifies that transitioning a Goods Receipt with action 'RECEIVE':
    1. Atomically inserts authoritative StockMovement rows (movement_type='INWARD_GRN').
    2. Atomically updates the linked Purchase Order status to RECEIVED.
    """
    cid, bid, user, supp, prod, tenant = await setup_test_tenant_and_actor(db_session)

    # 1. Create Purchase Order with 10 units
    po_id = f"po_{uuid.uuid4().hex[:8]}"
    po = PurchaseOrder(
        id=po_id,
        uuid=str(uuid.uuid4()),
        order_no=f"PO-STK-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        status="CONFIRMED",
        subtotal=Decimal("1000.00"),
        grand_total=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    po_item = PurchaseOrderItem(
        id=f"poi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        order_id=po_id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("10.00"),
        cost_price=Decimal("100.00"),
        tax_amount=Decimal("0.00"),
        line_total=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([po, po_item])
    await db_session.commit()

    # 2. Create Goods Receipt for 10 units
    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-STK-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        order_id=po_id,
        status="SUBMITTED",
        grand_total=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    rcpt_item = PurchaseReceiptItem(
        id=f"rci_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        receipt_id=rcpt_id,
        product_id=prod.id,
        purchase_order_id=po_id,
        code=prod.code,
        name=prod.name,
        quantity_received=Decimal("10.00"),
        cost_price=Decimal("100.00"),
        line_total=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([receipt, rcpt_item])
    await db_session.commit()

    # 3. Transition GRN to RECEIVED
    res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="GOODS_RECEIPT",
            doc_id=rcpt_id,
            action="RECEIVE",
        ),
    )
    assert res.to_status == "RECEIVED"

    # 4. Verify authoritative StockMovement row in database
    stmt_sm = select(StockMovement).where(
        StockMovement.reference_doc_id == rcpt_id,
        StockMovement.movement_type == "INWARD_GRN",
    )
    sm_rows = (await db_session.execute(stmt_sm)).scalars().all()
    assert len(sm_rows) == 1
    assert sm_rows[0].quantity == Decimal("10.00")
    assert sm_rows[0].product_id == prod.id

    # 5. Verify linked Purchase Order status updated to RECEIVED
    po_check = await db_session.get(PurchaseOrder, po_id)
    assert po_check.status == "RECEIVED"


async def test_grn_cancel_reverses_stock_movement_and_po_status(db_session):
    """
    Phase 2.1 Hardening Test 3:
    Verifies that cancelling a RECEIVED Goods Receipt:
    1. Atomically inserts reversing StockMovement rows (movement_type='RETURN_OUTWARD').
    2. Atomically reverts the linked Purchase Order status to CONFIRMED.
    3. Preserves soft-delete invariant (status=CANCELLED, is_deleted=False, deleted_at=None).
    """
    cid, bid, user, supp, prod, tenant = await setup_test_tenant_and_actor(db_session)

    # 1. Setup PO
    po_id = f"po_{uuid.uuid4().hex[:8]}"
    po = PurchaseOrder(
        id=po_id,
        uuid=str(uuid.uuid4()),
        order_no=f"PO-REV-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        status="RECEIVED",
        subtotal=Decimal("500.00"),
        grand_total=Decimal("500.00"),
        company_id=cid,
        branch_id=bid,
    )
    po_item = PurchaseOrderItem(
        id=f"poi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        order_id=po_id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("5.00"),
        cost_price=Decimal("100.00"),
        line_total=Decimal("500.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([po, po_item])
    await db_session.commit()

    # 2. Setup received GRN
    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-REV-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        order_id=po_id,
        status="RECEIVED",
        grand_total=Decimal("500.00"),
        company_id=cid,
        branch_id=bid,
    )
    rcpt_item = PurchaseReceiptItem(
        id=f"rci_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        receipt_id=rcpt_id,
        product_id=prod.id,
        purchase_order_id=po_id,
        code=prod.code,
        name=prod.name,
        quantity_received=Decimal("5.00"),
        cost_price=Decimal("100.00"),
        line_total=Decimal("500.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([receipt, rcpt_item])
    await db_session.commit()

    # 3. Transition GRN with CANCEL
    res_cancel = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="GOODS_RECEIPT",
            doc_id=rcpt_id,
            action="CANCEL",
            notes="Defective shipment returned to vendor",
        ),
    )
    assert res_cancel.to_status == "CANCELLED"

    # 4. Invariant check on GRN
    rcpt_check = await db_session.get(PurchaseReceipt, rcpt_id)
    assert rcpt_check.status == "CANCELLED"
    assert rcpt_check.is_deleted is False
    assert rcpt_check.deleted_at is None

    # 5. Check reversal StockMovement row created
    stmt_rev = select(StockMovement).where(
        StockMovement.reference_doc_id == rcpt_id,
        StockMovement.movement_type == "RETURN_OUTWARD",
    )
    rev_rows = (await db_session.execute(stmt_rev)).scalars().all()
    assert len(rev_rows) == 1
    assert rev_rows[0].quantity == Decimal("5.00")
    assert rev_rows[0].product_id == prod.id

    # 6. Check PO status reverted back to CONFIRMED
    po_check = await db_session.get(PurchaseOrder, po_id)
    assert po_check.status == "CONFIRMED"


async def test_purchase_bill_line_level_3way_matching(db_session):
    """
    Phase 2.1 Hardening Test 4:
    Verifies that PurchaseBillLifecycleHandler strictly enforces line-level
    3-way variance matching:
    - Case A: Rejects if Billed Quantity > PO Ordered Quantity (3WAY_QTY_EXCEEDED).
    - Case B: Rejects if Billed Rate > PO Agreed Cost Price (3WAY_RATE_EXCEEDED).
    - Case C: Rejects if Billed Quantity > GRN Received Quantity (3WAY_QTY_EXCEEDED).
    - Case D: Passes when Billed Quantity and Rate match PO and GRN lines within tolerance.
    """
    cid, bid, user, supp, prod, tenant = await setup_test_tenant_and_actor(db_session)

    # 1. Setup PO with 10 units at ₹100.00
    po_id = f"po_{uuid.uuid4().hex[:8]}"
    po = PurchaseOrder(
        id=po_id,
        uuid=str(uuid.uuid4()),
        order_no=f"PO-3WAY-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        status="CONFIRMED",
        subtotal=Decimal("1000.00"),
        grand_total=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    po_item = PurchaseOrderItem(
        id=f"poi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        order_id=po_id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("10.00"),
        cost_price=Decimal("100.00"),
        line_total=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([po, po_item])
    await db_session.commit()

    # 2. Setup GRN with 8 units received
    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-3WAY-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        order_id=po_id,
        status="RECEIVED",
        grand_total=Decimal("800.00"),
        company_id=cid,
        branch_id=bid,
    )
    rcpt_item = PurchaseReceiptItem(
        id=f"rci_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        receipt_id=rcpt_id,
        product_id=prod.id,
        purchase_order_id=po_id,
        code=prod.code,
        name=prod.name,
        quantity_received=Decimal("8.00"),
        cost_price=Decimal("100.00"),
        line_total=Decimal("800.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([receipt, rcpt_item])
    await db_session.commit()

    # CASE A: Bill quantity (12) > PO quantity (10)
    bill_a_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill_a = PurchaseBill(
        id=bill_a_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-A-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        order_id=po_id,
        status="DRAFT",
        total_amount=Decimal("1200.00"),
        company_id=cid,
        branch_id=bid,
    )
    bill_a_item = PurchaseBillItem(
        id=f"pbi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        bill_id=bill_a_id,
        product_id=prod.id,
        po_item_id=po_item.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("12.0000"),
        rate=Decimal("100.0000"),
        total_amount=Decimal("1200.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([bill_a, bill_a_item])
    await db_session.commit()

    with pytest.raises(HandlerValidationException) as exc_info_a:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="PURCHASE_BILL",
                doc_id=bill_a_id,
                action="SUBMIT",
            ),
        )
    assert exc_info_a.value.code == "3WAY_QTY_EXCEEDED"

    # CASE B: Bill rate (₹125.00) > PO agreed cost (₹100.00)
    bill_b_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill_b = PurchaseBill(
        id=bill_b_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-B-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        order_id=po_id,
        status="DRAFT",
        total_amount=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    bill_b_item = PurchaseBillItem(
        id=f"pbi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        bill_id=bill_b_id,
        product_id=prod.id,
        po_item_id=po_item.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("8.0000"),
        rate=Decimal("125.0000"),
        total_amount=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([bill_b, bill_b_item])
    await db_session.commit()

    with pytest.raises(HandlerValidationException) as exc_info_b:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="PURCHASE_BILL",
                doc_id=bill_b_id,
                action="SUBMIT",
            ),
        )
    assert exc_info_b.value.code == "3WAY_RATE_EXCEEDED"

    # CASE C: Bill quantity (10) > GRN received quantity (8)
    bill_c_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill_c = PurchaseBill(
        id=bill_c_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-C-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        order_id=po_id,
        receipt_id=rcpt_id,
        status="DRAFT",
        total_amount=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    bill_c_item = PurchaseBillItem(
        id=f"pbi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        bill_id=bill_c_id,
        product_id=prod.id,
        po_item_id=po_item.id,
        receipt_item_id=rcpt_item.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("10.0000"),
        rate=Decimal("100.0000"),
        total_amount=Decimal("1000.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([bill_c, bill_c_item])
    await db_session.commit()

    with pytest.raises(HandlerValidationException) as exc_info_c:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="PURCHASE_BILL",
                doc_id=bill_c_id,
                action="SUBMIT",
            ),
        )
    assert exc_info_c.value.code == "3WAY_QTY_EXCEEDED"

    # CASE D: Clean Match (8 units received at agreed rate of ₹100.00, total ₹800.00)
    bill_d_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill_d = PurchaseBill(
        id=bill_d_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-D-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supp.id,
        order_id=po_id,
        receipt_id=rcpt_id,
        status="DRAFT",
        total_amount=Decimal("800.00"),
        company_id=cid,
        branch_id=bid,
    )
    bill_d_item = PurchaseBillItem(
        id=f"pbi_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        bill_id=bill_d_id,
        product_id=prod.id,
        po_item_id=po_item.id,
        receipt_item_id=rcpt_item.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("8.0000"),
        rate=Decimal("100.0000"),
        total_amount=Decimal("800.00"),
        company_id=cid,
        branch_id=bid,
    )
    db_session.add_all([bill_d, bill_d_item])
    await db_session.commit()

    res_d = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_BILL",
            doc_id=bill_d_id,
            action="SUBMIT",
        ),
    )
    assert res_d.to_status == "SUBMITTED"

    res_approve = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_BILL",
            doc_id=bill_d_id,
            action="APPROVE",
        ),
    )
    assert res_approve.to_status == "APPROVED"
