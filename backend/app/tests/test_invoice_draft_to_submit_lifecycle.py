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

* Version    : 6.47.5
* Created    : 2026-10-26
* Modified   : 2026-10-26
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal Test Suite
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select
from fastapi import HTTPException

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.sales import (
    SalesQuotation,
    SalesQuotationItem,
    SalesInvoice,
    SalesInvoiceItem,
)
from app.models.workflow import WorkflowEvent
from app.models.accounting import JournalVoucher
from app.api.deps import TenantContext
from app.schemas.sales import SalesInvoiceUpdate
from app.services.sales import SalesService
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    LifecycleRegistry,
)

pytestmark = pytest.mark.asyncio


async def _setup_tenant_and_user(db, suffix: str, role=UserRole.SYSADMIN):
    cid = f"COMP-DS-{suffix}"
    bid = f"BR-DS-{suffix}"
    company = Company(
        id=cid,
        company_code=f"C{suffix[:6].upper()}",
        name=f"Draft-Submit Test Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"B{suffix[:6].upper()}",
        company_id=cid,
        name=f"Draft-Submit Test Branch {suffix}",
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


async def _setup_stock_product(db, suffix: str, comp_id: str, br_id: str, stock: int = 100):
    prod = Product(
        id=f"PROD-DS-{suffix}",
        code=f"SKU-DS-{suffix}",
        barcode=f"BAR-DS-{suffix}",
        name=f"Draft-Submit Test Product {suffix}",
        category="Footwear",
        price=Decimal("150.00"),
        mrp=Decimal("150.00"),
        gst_percentage=Decimal("18.00"),
        stock=stock,
        company_id=comp_id,
        branch_id=br_id,
        is_active=True,
        is_deleted=False,
    )
    db.add(prod)
    if stock > 0:
        mov = StockMovement(
            id=f"sm-open-{suffix}",
            company_id=comp_id,
            branch_id=br_id,
            product_id=prod.id,
            product_name=prod.name,
            sku=prod.code,
            movement_type="OPENING_STOCK",
            quantity=Decimal(str(stock)),
            reference_doc_type="OPENING_BALANCE",
            reference_doc_id=f"OPEN-{suffix}",
            user="SYSTEM",
            created_at=datetime.now(timezone.utc),
            is_deleted=False,
        )
        db.add(mov)
    await db.commit()
    return prod


async def test_invoice_save_as_draft_to_submit_and_post_lifecycle(db_session):
    """
    End-to-End Regression Test:
    1. Create quotation in Draft status.
    2. Convert quotation to draft sales invoice (status = 'Draft').
    3. Verify invoice is mutable while in Draft status.
    4. Transition Draft -> SUBMITTED via UniversalLifecycleEngine.
    5. Verify state machine updates and workflow event audit logging.
    6. Transition SUBMITTED -> POSTED via UniversalLifecycleEngine.
    7. Verify stock deduction (OUTWARD_SALE) and GL JournalVoucher creation.
    8. Verify immutability guard blocks modifications to POSTED invoice.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_user(db_session, s)
    prod = await _setup_stock_product(db_session, s, comp.id, br.id, stock=50)

    # 1. Create Sales Quotation in Draft Status
    quotation = SalesQuotation(
        id=f"q-{s}",
        uuid=str(uuid.uuid4()),
        quotation_no=f"QTN-{s}",
        customer_name="ShopperStop Test",
        status="Draft",
        grand_total=Decimal("300.00"),
        tax_total=Decimal("0.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    q_item = SalesQuotationItem(
        quotation_id=quotation.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("2.00"),
        price=Decimal("150.00"),
        total_amount=Decimal("300.00"),
        gst_rate=Decimal("18.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add_all([quotation, q_item])
    await db_session.commit()

    # 2. Convert Quotation to Invoice via SalesService
    sales_svc = SalesService(db_session, tenant_ctx)
    invoice = await sales_svc.convert_quotation_to_invoice(quotation.id)
    assert invoice is not None
    assert invoice.status == "Draft"
    assert invoice.company_id == comp.id

    # Verify Quotation marked as Converted
    await db_session.refresh(quotation)
    assert quotation.status == "Converted"

    # 3. Update Draft Invoice (Mutable while in Draft status)
    update_payload = SalesInvoiceUpdate(
        status="Draft",
        customer_name="ShopperStop Flagship Store",
        payment_mode="CREDIT",
    )
    updated_inv = await sales_svc.update_sales_invoice(invoice.id, update_payload)
    assert updated_inv.customer_name == "ShopperStop Flagship Store"
    assert updated_inv.status == "Draft"

    # 4. Check Lifecycle State & Available Actions
    state_res = await UniversalLifecycleEngine.get_lifecycle_state(
        db=db_session,
        doc_type="SalesInvoice",
        doc_id=invoice.id,
        tenant_ctx=tenant_ctx,
        user=user,
    )
    assert state_res.status == "DRAFT"
    assert "SUBMIT" in state_res.available_actions
    assert "POST" in state_res.available_actions

    # 5. Execute Transition: SUBMIT (DRAFT -> SUBMITTED)
    submit_res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=invoice.id,
            action="SUBMIT",
            expected_version=state_res.version,
            notes="Submitting invoice draft for accountant review",
        ),
    )
    assert submit_res.success is True
    assert submit_res.from_status == "DRAFT"
    assert submit_res.to_status == "SUBMITTED"
    assert submit_res.version == 2

    # Verify database state after SUBMIT
    await db_session.refresh(invoice)
    assert invoice.status == "SUBMITTED"

    # Verify WorkflowEvent logged for SUBMIT
    ev_stmt = select(WorkflowEvent).where(
        WorkflowEvent.doc_id == invoice.id,
        WorkflowEvent.action == "SUBMIT",
    )
    ev_submit = (await db_session.execute(ev_stmt)).scalars().first()
    assert ev_submit is not None
    assert ev_submit.from_status == "DRAFT"
    assert ev_submit.to_status == "SUBMITTED"

    # 6. Execute Transition: POST (SUBMITTED -> POSTED)
    post_res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=invoice.id,
            action="POST",
            expected_version=submit_res.version,
            notes="Approved and posted to ledger and stock",
        ),
    )
    assert post_res.success is True
    assert post_res.from_status == "SUBMITTED"
    assert post_res.to_status == "POSTED"
    assert post_res.version == 3

    # 7. Verify Database Persistence across Systems of Record
    await db_session.refresh(invoice)
    assert invoice.status == "POSTED"

    # 7a. Verify Stock Deduction in StockMovement: 50 - 2 = 48
    mov_stmt = select(StockMovement).where(
        StockMovement.reference_doc_id == invoice.id,
        StockMovement.movement_type == "OUTWARD_SALE",
    )
    outward_mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert outward_mov is not None
    assert Decimal(str(outward_mov.quantity)) == Decimal("2.00")
    assert outward_mov.product_id == prod.id

    # 7b. Verify General Ledger JournalVoucher
    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_id == invoice.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()
    assert jv is not None
    assert jv.voucher_type == "SALES_INVOICE"

    # 8. Verify Immutability Guard: Editing a POSTED invoice raises HTTP 409
    with pytest.raises(HTTPException) as exc_info:
        await sales_svc.update_sales_invoice(
            invoice.id,
            SalesInvoiceUpdate(customer_name="Illegal Modification Attempt"),
        )
    assert exc_info.value.status_code == 409
    assert "immutable" in exc_info.value.detail.lower()

    # 9. Verify Complete Workflow Event Trail
    events_stmt = (
        select(WorkflowEvent)
        .where(WorkflowEvent.doc_id == invoice.id)
        .order_by(WorkflowEvent.created_at.asc())
    )
    all_events = (await db_session.execute(events_stmt)).scalars().all()
    assert len(all_events) == 2
    assert all_events[0].action == "SUBMIT"
    assert all_events[1].action == "POST"
