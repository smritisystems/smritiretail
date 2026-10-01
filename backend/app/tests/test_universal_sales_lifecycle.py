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
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.sales import (
    SalesOrder,
    SalesOrderItem,
    SalesOrderReservation,
    SalesQuotation,
    SalesQuotationItem,
    SalesInvoice,
    SalesInvoiceItem,
    SalesReturn,
    SalesReturnItem,
)
from app.models.fulfillment import (
    PackingSlip,
    PackingSlipItem,
    Dispatch,
    DispatchItem,
)
from app.models.workflow import WorkflowEvent
from app.models.accounting import JournalVoucher
from app.api.deps import TenantContext
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    LifecycleTransitionResult,
    LifecycleRegistry,
    ConcurrencyConflictException,
    InvalidTransitionException,
    PermissionDeniedException,
    DocumentNotFoundException,
    HandlerValidationException,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

async def _setup_tenant_and_actor(db, suffix: str, role=UserRole.MANAGER):
    cid = f"COMP-LC-{suffix}"
    bid = f"BR-LC-{suffix}"
    company = Company(
        id=cid,
        company_code=f"C{suffix[:6].upper()}",
        name=f"Lifecycle Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"B{suffix[:6].upper()}",
        company_id=cid,
        name=f"Lifecycle Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    user = User(
        id=f"usr-{suffix}",
        username=f"user_{suffix}",
        email=f"user_{suffix}@example.com",
        hashed_password="mocked_password",
        role=role,
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)
    await db.commit()
    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    return company, branch, user, tenant_ctx


async def _setup_product(db, suffix: str, comp_id: str, br_id: str, stock: int = 100):
    prod = Product(
        id=f"PROD-LC-{suffix}",
        code=f"SKU-LC-{suffix}",
        barcode=f"BAR-LC-{suffix}",
        name=f"Lifecycle Product {suffix}",
        category="General",
        price=Decimal("200.00"),
        mrp=Decimal("200.00"),
        gst_percentage=Decimal("18.00"),
        stock=stock,
        company_id=comp_id,
        branch_id=br_id,
        is_active=True,
        is_deleted=False,
    )
    db.add(prod)
    await db.commit()
    return prod


# ---------------------------------------------------------------------------
# Phase S3 Tests: SalesOrder Lifecycle
# ---------------------------------------------------------------------------

async def test_sales_order_full_lifecycle(db_session):
    """Verifies SalesOrder progresses through DRAFT -> SUBMITTED -> CONFIRMED -> ALLOCATED -> DELIVERED."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    # 1. Create SalesOrder in DRAFT
    so = SalesOrder(
        id=f"so-{s}",
        order_no=f"SO-{s}",
        customer_name="Alpha Corp",
        grand_total=Decimal("2000.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=1,
    )
    so_item = SalesOrderItem(
        order_id=so.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("10.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("2000.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(so)
    db_session.add(so_item)
    await db_session.commit()

    # 2. Action: SUBMIT
    res1 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesOrder",
            doc_id=so.id,
            action="SUBMIT",
            expected_version=1,
        )
    )
    assert res1.success is True
    assert res1.to_status == "SUBMITTED"
    assert res1.version == 2

    # 3. Action: CONFIRM
    res2 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesOrder",
            doc_id=so.id,
            action="CONFIRM",
            expected_version=2,
        )
    )
    assert res2.success is True
    assert res2.to_status == "CONFIRMED"
    assert res2.version == 3

    # 4. Action: ALLOCATE
    res3 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesOrder",
            doc_id=so.id,
            action="ALLOCATE",
            expected_version=3,
        )
    )
    assert res3.success is True
    assert res3.to_status == "ALLOCATED"
    assert res3.version == 4

    # 5. Action: DELIVER
    res4 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesOrder",
            doc_id=so.id,
            action="DELIVER",
            expected_version=4,
        )
    )
    assert res4.success is True
    assert res4.to_status == "DELIVERED"
    assert res4.version == 5

    # 6. Verify audit trail in workflow_events
    events_stmt = select(WorkflowEvent).where(
        WorkflowEvent.doc_id == so.id,
        WorkflowEvent.company_id == comp.id,
    ).order_by(WorkflowEvent.created_at.asc())
    events = (await db_session.execute(events_stmt)).scalars().all()
    assert len(events) == 4
    assert [e.action for e in events] == ["SUBMIT", "CONFIRM", "ALLOCATE", "DELIVER"]


async def test_sales_order_cancellation_releases_reservation(db_session):
    """Verifies cancelling a SalesOrder releases inventory reservations and marks items cancelled."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    so = SalesOrder(
        id=f"so-{s}",
        order_no=f"SO-{s}",
        customer_name="Beta Retail",
        grand_total=Decimal("1000.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=1,
    )
    so_item = SalesOrderItem(
        order_id=so.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("5.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("1000.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(so)
    db_session.add(so_item)
    await db_session.flush()

    resv = SalesOrderReservation(
        id=f"resv-{s}",
        order_id=so.id,
        order_item_id=so_item.id,
        product_id=prod.id,
        barcode=prod.barcode,
        requested_quantity=Decimal("5.00"),
        reserved_quantity=Decimal("5.00"),
        status="ACTIVE",
        idempotency_key=f"resv-{s}",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(resv)
    await db_session.commit()

    # Cancel order
    res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesOrder",
            doc_id=so.id,
            action="CANCEL",
            notes="Customer requested order cancellation",
        )
    )
    assert res.success is True
    assert res.to_status == "CANCELLED"

    await db_session.refresh(so)
    assert so.status == "CANCELLED"
    assert so.is_deleted is False

    await db_session.refresh(resv)
    assert resv.status == "RELEASED"
    assert resv.released_quantity == Decimal("5.00")

    await db_session.refresh(so_item)
    assert so_item.line_status == "CANCELLED"


async def test_sales_order_concurrency_conflict(db_session):
    """Verifies that executing a transition with stale expected_version raises ConcurrencyConflictException (409)."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id)

    so = SalesOrder(
        id=f"so-{s}",
        order_no=f"SO-{s}",
        customer_name="Gamma LLC",
        grand_total=Decimal("500.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=5,  # Current version is 5
    )
    so_item = SalesOrderItem(
        order_id=so.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("1.00"),
        price=Decimal("500.00"),
        total_amount=Decimal("500.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(so)
    db_session.add(so_item)
    await db_session.commit()

    with pytest.raises(ConcurrencyConflictException) as exc_info:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="SalesOrder",
                doc_id=so.id,
                action="SUBMIT",
                expected_version=4,  # Stale version!
            )
        )
    assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# Phase S3 Tests: SalesQuotation Lifecycle
# ---------------------------------------------------------------------------

async def test_sales_quotation_lifecycle(db_session):
    """Verifies SalesQuotation lifecycle: DRAFT -> SENT -> ACCEPTED -> CONVERTED."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id)

    sq = SalesQuotation(
        id=f"sq-{s}",
        quotation_no=f"QT-{s}",
        customer_name="Delta Enterprises",
        grand_total=Decimal("1500.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=1,
    )
    sq_item = SalesQuotationItem(
        quotation_id=sq.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("10.00"),
        price=Decimal("150.00"),
        total_amount=Decimal("1500.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(sq)
    db_session.add(sq_item)
    await db_session.commit()

    # 1. SEND
    r1 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesQuotation", doc_id=sq.id, action="SEND")
    )
    assert r1.to_status == "SENT"

    # 2. ACCEPT
    r2 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesQuotation", doc_id=sq.id, action="ACCEPT")
    )
    assert r2.to_status == "ACCEPTED"

    # 3. CONVERT
    r3 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesQuotation", doc_id=sq.id, action="CONVERT")
    )
    assert r3.to_status == "CONVERTED"
    assert sq.is_deleted is False


# ---------------------------------------------------------------------------
# Phase S3 & S2 & S7 Tests: SalesInvoice Posting & Cancellation
# ---------------------------------------------------------------------------

async def test_sales_invoice_posting_and_stock_gl(db_session):
    """Verifies posting SalesInvoice triggers OUTWARD_SALE stock movement and GL journal voucher."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    inv = SalesInvoice(
        id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        customer_name="Epsilon Trading",
        grand_total=Decimal("400.00"),
        tax_total=Decimal("0.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=1,
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("2.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("400.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    # POST invoice directly (Model A / Retail flow)
    r = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    assert r.success is True
    assert r.to_status == "POSTED"

    # Verify stock deduction: 50 - 2 = 48
    await db_session.refresh(prod)
    assert prod.stock == 48

    # Verify StockMovement ledger record
    mov_stmt = select(StockMovement).where(
        StockMovement.reference_doc_type == "SALES_INVOICE",
        StockMovement.reference_doc_id == inv.id,
        StockMovement.company_id == comp.id,
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert mov is not None
    assert mov.movement_type == "OUTWARD_SALE"
    assert Decimal(str(mov.quantity)) == Decimal("2.00")

    # Verify JournalVoucher creation
    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_INVOICE",
        JournalVoucher.reference_doc_id == inv.id,
        JournalVoucher.company_id == comp.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()
    assert jv is not None
    assert jv.voucher_type in ("SALES", "SALES_INVOICE")


async def test_sales_invoice_cancellation_reverses_stock_gl(db_session):
    """Verifies cancelling a POSTED invoice reverses stock deduction and posts reversing GL entry."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    inv = SalesInvoice(
        id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        customer_name="Zeta Stores",
        grand_total=Decimal("600.00"),
        tax_total=Decimal("0.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=1,
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("3.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("600.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    # 1. Post invoice
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    await db_session.refresh(prod)
    assert prod.stock == 47

    # 2. Cancel invoice
    r_cancel = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="CANCEL",
            notes="Customer returned items before leaving counter",
        )
    )
    assert r_cancel.to_status == "CANCELLED"

    # Stock must be restored: 47 + 3 = 50
    await db_session.refresh(prod)
    assert prod.stock == 50

    # Reversing voucher must exist
    rev_jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_INVOICE_CANCEL",
        JournalVoucher.reference_doc_id == inv.id,
        JournalVoucher.company_id == comp.id,
    )
    rev_jv = (await db_session.execute(rev_jv_stmt)).scalars().first()
    assert rev_jv is not None
    assert rev_jv.voucher_type == "SALES_CANCEL"


# ---------------------------------------------------------------------------
# Phase S5 Tests: 3-Way Matching Line Level Check
# ---------------------------------------------------------------------------

async def test_sales_invoice_3way_matching_enforcement(db_session):
    """Verifies that billing higher quantity or rate than agreed Sales Order raises HandlerValidationException."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    # Sales Order agreed for 5 units @ 200.00
    so = SalesOrder(
        id=f"so-{s}",
        order_no=f"SO-{s}",
        customer_name="Theta Logistics",
        grand_total=Decimal("1000.00"),
        status="CONFIRMED",
        company_id=comp.id,
        branch_id=br.id,
    )
    so_item = SalesOrderItem(
        order_id=so.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("5.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("1000.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(so)
    db_session.add(so_item)
    await db_session.commit()

    # Case A: Invoiced Quantity Exceeded (6 > 5)
    inv_exceed_qty = SalesInvoice(
        id=f"inv-qty-{s}",
        invoice_no=f"INV-QTY-{s}",
        customer_name="Theta Logistics",
        grand_total=Decimal("1200.00"),
        source_document_type="SALES_ORDER",
        source_document_id=so.id,
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
    )
    inv_item_exceed = SalesInvoiceItem(
        invoice_id=inv_exceed_qty.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("6.00"),  # Exceeds SO qty 5.00!
        price=Decimal("200.00"),
        total_amount=Decimal("1200.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv_exceed_qty)
    db_session.add(inv_item_exceed)
    await db_session.commit()

    with pytest.raises(HandlerValidationException) as exc_qty:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="SalesInvoice",
                doc_id=inv_exceed_qty.id,
                action="POST",
            )
        )
    assert exc_qty.value.code == "SALES_3WAY_QTY_EXCEEDED"

    # Case B: Invoiced Rate Exceeded (250.00 > 200.00)
    inv_exceed_rate = SalesInvoice(
        id=f"inv-rate-{s}",
        invoice_no=f"INV-RATE-{s}",
        customer_name="Theta Logistics",
        grand_total=Decimal("1250.00"),
        source_document_type="SALES_ORDER",
        source_document_id=so.id,
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
    )
    inv_item_rate = SalesInvoiceItem(
        invoice_id=inv_exceed_rate.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("5.00"),
        price=Decimal("250.00"),  # Exceeds SO rate 200.00!
        total_amount=Decimal("1250.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv_exceed_rate)
    db_session.add(inv_item_rate)
    await db_session.commit()

    with pytest.raises(HandlerValidationException) as exc_rate:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="SalesInvoice",
                doc_id=inv_exceed_rate.id,
                action="POST",
            )
        )
    assert exc_rate.value.code == "SALES_3WAY_RATE_EXCEEDED"


# ---------------------------------------------------------------------------
# Phase S3 & S2 & S7 Tests: SalesReturn Processing
# ---------------------------------------------------------------------------

async def test_sales_return_processing_restocks_and_credit_note(db_session):
    """Verifies that processing a SalesReturn restocks inventory and creates credit note GL voucher."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    # Preceding invoice for foreign key
    orig_inv = SalesInvoice(
        id=f"inv-orig-{s}",
        invoice_no=f"INV-ORIG-{s}",
        customer_name="Iota Wholesale",
        grand_total=Decimal("400.00"),
        status="POSTED",
        company_id=comp.id,
        branch_id=br.id,
    )
    orig_item = SalesInvoiceItem(
        invoice_id=orig_inv.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("2.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("400.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add_all([orig_inv, orig_item])
    await db_session.commit()

    sr = SalesReturn(
        id=f"sr-{s}",
        return_no=f"SR-{s}",
        original_invoice_id=orig_inv.id,
        customer_id=None,
        grand_total=Decimal("400.00"),
        tax_total=Decimal("0.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=1,
    )
    sr_item = SalesReturnItem(
        return_id=sr.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("2.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("400.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(sr)
    db_session.add(sr_item)
    await db_session.commit()

    # 1. SUBMIT
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=sr.id, action="SUBMIT")
    )

    # 2. APPROVE
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=sr.id, action="APPROVE")
    )

    # 3. PROCESS
    r_proc = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=sr.id, action="PROCESS")
    )
    assert r_proc.to_status == "PROCESSED"

    # Restock check: 50 + 2 = 52
    await db_session.refresh(prod)
    assert prod.stock == 52

    # Credit Note JournalVoucher check
    cn_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_RETURN",
        JournalVoucher.reference_doc_id == sr.id,
        JournalVoucher.company_id == comp.id,
    )
    cn = (await db_session.execute(cn_stmt)).scalars().first()
    assert cn is not None
    assert cn.voucher_type == "CREDIT_NOTE"


# ---------------------------------------------------------------------------
# Phase S3 & S2 Tests: Logistics Fulfillment Double-Deduction Safety
# ---------------------------------------------------------------------------

async def test_fulfillment_dispatch_safe_double_deduction(db_session):
    """Verifies that Dispatch linked to an already-posted invoice does not double-deduct inventory."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    # 1. Post invoice
    inv = SalesInvoice(
        id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        customer_name="Kappa Cargo",
        grand_total=Decimal("400.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("2.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("400.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    await db_session.refresh(prod)
    assert prod.stock == 48

    # 2. Create Packing Slip and Dispatch linked to this invoice
    ps = PackingSlip(
        id=f"ps-{s}",
        packing_slip_number=f"PS-{s}",
        sales_invoice_id=inv.id,
        status="PENDING",
        company_id=comp.id,
        branch_id=br.id,
    )
    ps_item = PackingSlipItem(
        id=f"psi-{s}",
        packing_slip_id=ps.id,
        product_id=prod.id,
        sku=prod.code,
        quantity=Decimal("2.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(ps)
    db_session.add(ps_item)
    await db_session.commit()

    # Pack the slip
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PackingSlip", doc_id=ps.id, action="PACK")
    )
    await db_session.refresh(ps)
    assert ps.status == "PACKED"

    # Create Dispatch
    disp = Dispatch(
        id=f"disp-{s}",
        dispatch_number=f"DSP-{s}",
        packing_slip_id=ps.id,
        status="DRAFT",
        company_id=comp.id,
        branch_id=br.id,
    )
    disp_item = DispatchItem(
        id=f"di-{s}",
        dispatch_id=disp.id,
        product_id=prod.id,
        quantity=Decimal("2.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(disp)
    db_session.add(disp_item)
    await db_session.commit()

    # Dispatch the manifest
    r_disp = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="Dispatch", doc_id=disp.id, action="DISPATCH")
    )
    assert r_disp.to_status == "DISPATCHED"

    # Stock MUST NOT be double-deducted: stays 48, not 46!
    await db_session.refresh(prod)
    assert prod.stock == 48


# ---------------------------------------------------------------------------
# Cross-Tenant Rejection Safety Test
# ---------------------------------------------------------------------------

async def test_sales_tenant_isolation_rejection(db_session):
    """Verifies that accessing a sales document belonging to another company raises DocumentNotFoundException."""
    s1 = uuid.uuid4().hex[:8]
    s2 = uuid.uuid4().hex[:8]
    comp1, br1, user1, tenant_ctx1 = await _setup_tenant_and_actor(db_session, s1)
    comp2, br2, user2, tenant_ctx2 = await _setup_tenant_and_actor(db_session, s2)

    so = SalesOrder(
        id=f"so-{s1}",
        order_no=f"SO-{s1}",
        customer_name="Tenant 1 Customer",
        grand_total=Decimal("500.00"),
        status="Draft",
        company_id=comp1.id,
        branch_id=br1.id,
    )
    db_session.add(so)
    await db_session.commit()

    # User 2 tries to submit User 1's SalesOrder
    with pytest.raises(DocumentNotFoundException):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx2,  # Tenant 2 context
            user=user2,
            ctx=LifecycleTransitionContext(
                doc_type="SalesOrder",
                doc_id=so.id,
                action="SUBMIT",
            )
        )
