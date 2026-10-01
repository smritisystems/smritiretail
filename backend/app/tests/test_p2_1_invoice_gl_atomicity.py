"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-01
Modified     : 2026-10-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""
P2.1 Sales Invoice General Ledger Atomicity Test Suite.
Verifies:
1. Balanced revenue & COGS GL voucher creation on Invoice POST (Total Debit == Total Credit)
2. Authoritative stock mutation and Product.stock cache synchronization
3. Complete transaction rollback on GL failure (no phantom stock, no status mutation, no orphan rows)
4. Complete transaction rollback on Stock failure
5. Costing hierarchy resolution (ProductCostValuation -> Product.cost_price -> Zero-cost audit)
6. TransactionCostSnapshot line-level audit ledger creation
7. Idempotency against duplicate GL posting
8. Multi-tenant isolation for GL vouchers and accounts
9. Symmetrical statutory reversal on cancellation (Inventory restocked, COGS credited)
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from unittest.mock import patch
from fastapi import HTTPException
from sqlalchemy import select, func

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.profitability import ProductCostValuation, TransactionCostSnapshot
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.workflow import WorkflowEvent
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.api.deps import TenantContext
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    HandlerValidationException,
)
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.sales_stock_authority import SalesStockAuthority

pytestmark = pytest.mark.asyncio


async def _setup_tenant_and_actor(db, suffix: str, role=UserRole.MANAGER):
    cid = f"COMP-P2-{suffix}"
    bid = f"BR-P2-{suffix}"
    company = Company(
        id=cid,
        company_code=f"CP{suffix[:5].upper()}",
        name=f"P2 Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"BP{suffix[:5].upper()}",
        company_id=cid,
        name=f"P2 Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    user = User(
        id=f"usr-p2-{suffix}",
        username=f"user_p2_{suffix}",
        email=f"user_p2_{suffix}@example.com",
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


async def _setup_product(db, suffix: str, company_id: str, branch_id: str, stock=100, cost_price=100.00, price=200.00):
    prod = Product(
        id=f"PROD-P2-{suffix}",
        code=f"SKU-P2-{suffix}",
        sku=f"SKU-P2-{suffix}",
        barcode=f"BAR-P2-{suffix}",
        name=f"P2 Product {suffix}",
        category="General",
        stock=stock,
        mrp=Decimal(str(price * 1.2)),
        buying_price=Decimal(str(cost_price)),
        cost_price=Decimal(str(cost_price)),
        gst_percentage=Decimal("18.00"),
        company_id=company_id,
        branch_id=branch_id,
        is_active=True,
        is_deleted=False,
    )
    db.add(prod)
    await db.commit()
    return prod


# ---------------------------------------------------------------------------
# Test 1 & 2: Invoice POST creates balanced revenue and COGS GL + Stock Movement
# ---------------------------------------------------------------------------

async def test_invoice_post_creates_balanced_revenue_and_cogs_gl(db_session):
    """Verifies that posting an invoice creates balanced GL entries for revenue and COGS, and deducts stock."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=120.00, price=200.00)

    # Setup ProductCostValuation (Hierarchy 1)
    val = ProductCostValuation(
        id=f"pcv-{s}",
        company_id=comp.id,
        branch_id=br.id,
        product_id=prod.id,
        weighted_average_cost=Decimal("125.00"),
        purchase_cost=Decimal("120.00"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add(val)
    await db_session.commit()

    inv = SalesInvoice(
        id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        customer_name="Alpha Retailers",
        grand_total=Decimal("472.00"),
        tax_total=Decimal("72.00"),
        taxable_value=Decimal("400.00"),
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
        taxable_value=Decimal("400.00"),
        cgst_amount=Decimal("36.00"),
        sgst_amount=Decimal("36.00"),
        igst_amount=Decimal("0.00"),
        total_amount=Decimal("472.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    # Execute transition POST
    r = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    assert r.success is True
    assert r.to_status == "POSTED"

    # 1. Stock Verification: 50 - 2 = 48
    await db_session.refresh(prod)
    assert prod.stock == 48

    mov_stmt = select(StockMovement).where(
        StockMovement.reference_doc_type == "SALES_INVOICE",
        StockMovement.reference_doc_id == inv.id,
        StockMovement.company_id == comp.id,
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert mov is not None
    assert mov.movement_type == "OUTWARD_SALE"
    assert Decimal(str(mov.quantity)) == Decimal("2.00")

    # 2. GL Verification
    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_INVOICE",
        JournalVoucher.reference_doc_id == inv.id,
        JournalVoucher.company_id == comp.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()
    assert jv is not None
    assert jv.is_posted is True
    assert jv.total_debit == jv.total_credit  # Total Debit == Total Credit Invariant

    # Expected COGS = 2 * 125.00 = 250.00
    # Expected Grand Total = 472.00
    # Total debits = 472.00 (AR) + 250.00 (COGS) = 722.00
    assert Decimal(str(jv.total_debit)) == Decimal("722.00")
    assert Decimal(str(jv.total_credit)) == Decimal("722.00")

    # 3. Line items verification
    gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gles = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(gles) >= 5  # AR, Revenue, CGST, SGST, COGS, Inventory

    # 4. TransactionCostSnapshot verification
    snap_stmt = select(TransactionCostSnapshot).where(
        TransactionCostSnapshot.sales_invoice_id == inv.id,
        TransactionCostSnapshot.company_id == comp.id,
    )
    snap = (await db_session.execute(snap_stmt)).scalars().first()
    assert snap is not None
    assert Decimal(str(snap.cost_per_unit)) == Decimal("125.00")
    assert Decimal(str(snap.total_cogs)) == Decimal("250.00")
    assert snap.valuation_method_used == "WEIGHTED_AVERAGE"


# ---------------------------------------------------------------------------
# Test 3: GL failure causes complete atomic rollback
# ---------------------------------------------------------------------------

async def test_gl_failure_causes_complete_rollback(db_session):
    """Simulates a GL posting exception and verifies complete rollback of stock, invoice status, and audit events."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    inv = SalesInvoice(
        id=f"inv-fail-{s}",
        invoice_no=f"INV-FAIL-{s}",
        customer_name="Beta Corp",
        grand_total=Decimal("200.00"),
        taxable_value=Decimal("200.00"),
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
        quantity=Decimal("1.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("200.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    inv_id = inv.id
    prod_id = prod.id

    # Mock post_sales_invoice_to_gl to simulate an accounting system failure (e.g. closed fiscal period or GL error)
    with patch.object(
        UnifiedAccountingLedgerService,
        "post_sales_invoice_to_gl",
        side_effect=HTTPException(status_code=400, detail="SMRITI-GL-SIMULATED-FAIL: Accounting period locked.")
    ):
        with pytest.raises(HTTPException) as exc:
            await UniversalLifecycleEngine.execute_transition(
                db=db_session,
                tenant_ctx=tenant_ctx,
                user=user,
                ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv_id, action="POST")
            )
        assert "SMRITI-GL-SIMULATED-FAIL" in exc.value.detail

    # Atomic Rollback Verification
    # 1. Invoice status must NOT remain POSTED (must remain Draft)
    inv_check = (await db_session.execute(select(SalesInvoice).where(SalesInvoice.id == inv_id))).scalar_one()
    assert inv_check.status == "Draft"

    # 2. Stock must NOT be deducted: still 50
    prod_check = (await db_session.execute(select(Product).where(Product.id == prod_id))).scalar_one()
    assert prod_check.stock == 50

    # 3. StockMovement row must NOT exist
    mov_check = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == inv_id)
    )).scalars().all()
    assert len(mov_check) == 0

    # 4. JournalVoucher must NOT exist
    jv_check = (await db_session.execute(
        select(JournalVoucher).where(JournalVoucher.reference_doc_id == inv_id)
    )).scalars().all()
    assert len(jv_check) == 0

    # 5. WorkflowEvent must NOT exist
    wf_check = (await db_session.execute(
        select(WorkflowEvent).where(WorkflowEvent.doc_id == inv_id, WorkflowEvent.action == "POST")
    )).scalars().all()
    assert len(wf_check) == 0


# ---------------------------------------------------------------------------
# Test 3: Stock failure causes complete rollback
# ---------------------------------------------------------------------------

async def test_stock_failure_causes_complete_rollback(db_session):
    """Simulates a stock authority mutation failure and verifies complete rollback of all entities."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    inv = SalesInvoice(
        id=f"inv-stkfail-{s}",
        invoice_no=f"INV-STKFAIL-{s}",
        customer_name="Delta Stock Fail",
        grand_total=Decimal("200.00"),
        taxable_value=Decimal("200.00"),
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
        quantity=Decimal("1.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("200.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    inv_id = inv.id
    prod_id = prod.id

    with patch.object(
        SalesStockAuthority,
        "record_outward_sale",
        side_effect=HTTPException(status_code=400, detail="SMRITI-STOCK-SIMULATED-FAIL: Warehouse partition locked.")
    ):
        with pytest.raises(HTTPException) as exc:
            await UniversalLifecycleEngine.execute_transition(
                db=db_session,
                tenant_ctx=tenant_ctx,
                user=user,
                ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv_id, action="POST")
            )
        assert "SMRITI-STOCK-SIMULATED-FAIL" in exc.value.detail

    # Atomic Rollback Verification
    inv_check = (await db_session.execute(select(SalesInvoice).where(SalesInvoice.id == inv_id))).scalar_one()
    assert inv_check.status == "Draft"

    prod_check = (await db_session.execute(select(Product).where(Product.id == prod_id))).scalar_one()
    assert prod_check.stock == 50

    mov_check = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == inv_id)
    )).scalars().all()
    assert len(mov_check) == 0

    jv_check = (await db_session.execute(
        select(JournalVoucher).where(JournalVoucher.reference_doc_id == inv_id)
    )).scalars().all()
    assert len(jv_check) == 0

    wf_check = (await db_session.execute(
        select(WorkflowEvent).where(WorkflowEvent.doc_id == inv_id, WorkflowEvent.action == "POST")
    )).scalars().all()
    assert len(wf_check) == 0


# ---------------------------------------------------------------------------
# Test 4: Missing GL account causes complete rollback
# ---------------------------------------------------------------------------

async def test_missing_account_causes_complete_rollback(db_session):
    """Simulates a missing mandatory COA account (e.g. 1030) and verifies complete transaction rollback."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)

    inv = SalesInvoice(
        id=f"inv-noacc-{s}",
        invoice_no=f"INV-NOACC-{s}",
        customer_name="Zeta No Account",
        grand_total=Decimal("200.00"),
        taxable_value=Decimal("200.00"),
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
        quantity=Decimal("1.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("200.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    inv_id = inv.id
    prod_id = prod.id

    with patch.object(
        UnifiedAccountingLedgerService,
        "get_account_by_code",
        side_effect=HTTPException(status_code=404, detail="SMRITI-GL-404: Account code '1030' not found.")
    ):
        with pytest.raises(HTTPException) as exc:
            await UniversalLifecycleEngine.execute_transition(
                db=db_session,
                tenant_ctx=tenant_ctx,
                user=user,
                ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv_id, action="POST")
            )
        assert "SMRITI-GL-404" in exc.value.detail

    # Atomic Rollback Verification
    inv_check = (await db_session.execute(select(SalesInvoice).where(SalesInvoice.id == inv_id))).scalar_one()
    assert inv_check.status == "Draft"

    prod_check = (await db_session.execute(select(Product).where(Product.id == prod_id))).scalar_one()
    assert prod_check.stock == 50

    mov_check = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == inv_id)
    )).scalars().all()
    assert len(mov_check) == 0

    jv_check = (await db_session.execute(
        select(JournalVoucher).where(JournalVoucher.reference_doc_id == inv_id)
    )).scalars().all()
    assert len(jv_check) == 0

    wf_check = (await db_session.execute(
        select(WorkflowEvent).where(WorkflowEvent.doc_id == inv_id, WorkflowEvent.action == "POST")
    )).scalars().all()
    assert len(wf_check) == 0


# ---------------------------------------------------------------------------
# Test 4: Costing hierarchy fallback & zero-cost handling
# ---------------------------------------------------------------------------

async def test_cost_valuation_hierarchy_and_zero_cost(db_session):
    """Verifies fallback to Product.cost_price and audit logging for standard zero-cost items."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)

    # Product A: Has Product.cost_price = 85.00 (No ProductCostValuation row)
    prod_a = await _setup_product(db_session, f"{s}-a", comp.id, br.id, stock=20, cost_price=85.00, price=150.00)

    # Product B: Standard merchandise with 0 cost
    prod_b = await _setup_product(db_session, f"{s}-b", comp.id, br.id, stock=20, cost_price=0.00, price=100.00)

    inv = SalesInvoice(
        id=f"inv-cost-{s}",
        invoice_no=f"INV-COST-{s}",
        customer_name="Gamma Distributors",
        grand_total=Decimal("250.00"),
        taxable_value=Decimal("250.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
        version=1,
    )
    item_a = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod_a.id,
        code=prod_a.code,
        name=prod_a.name,
        quantity=Decimal("1.00"),
        price=Decimal("150.00"),
        total_amount=Decimal("150.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    item_b = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod_b.id,
        code=prod_b.code,
        name=prod_b.name,
        quantity=Decimal("1.00"),
        price=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add_all([item_a, item_b])
    await db_session.commit()

    r = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    assert r.success is True

    # Check snapshots
    snaps = (await db_session.execute(
        select(TransactionCostSnapshot).where(TransactionCostSnapshot.sales_invoice_id == inv.id)
    )).scalars().all()
    assert len(snaps) == 2

    snap_a = next(s for s in snaps if s.product_id == prod_a.id)
    assert snap_a.valuation_method_used == "COST_PRICE_FALLBACK"
    assert Decimal(str(snap_a.cost_per_unit)) == Decimal("85.00")

    snap_b = next(s for s in snaps if s.product_id == prod_b.id)
    assert snap_b.valuation_method_used == "ZERO_COST_UNVALUED"
    assert Decimal(str(snap_b.cost_per_unit)) == Decimal("0.00")

    # Check JournalVoucher: Total debits = 250.00 (AR) + 85.00 (COGS for item A) = 335.00
    jv = (await db_session.execute(
        select(JournalVoucher).where(JournalVoucher.reference_doc_id == inv.id)
    )).scalar_one()
    assert jv.total_debit == jv.total_credit
    assert Decimal(str(jv.total_debit)) == Decimal("335.00")


# ---------------------------------------------------------------------------
# Test 5: Idempotent GL Posting
# ---------------------------------------------------------------------------

async def test_duplicate_post_idempotency(db_session):
    """Verifies that duplicate GL posting calls return the existing voucher and do not create duplicates."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=50.00, price=100.00)

    inv = SalesInvoice(
        id=f"inv-idemp-{s}",
        invoice_no=f"INV-IDEMP-{s}",
        customer_name="Delta Services",
        grand_total=Decimal("100.00"),
        taxable_value=Decimal("100.00"),
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
        quantity=Decimal("1.00"),
        price=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    # First POST
    r1 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    assert r1.success is True

    # Direct secondary call to post_sales_invoice_to_gl
    jv2 = await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
        branch_id=br.id,
    )

    # Exactly one JournalVoucher must exist
    jvs = (await db_session.execute(
        select(JournalVoucher).where(
            JournalVoucher.reference_doc_id == inv.id,
            JournalVoucher.company_id == comp.id,
        )
    )).scalars().all()
    assert len(jvs) == 1
    assert jvs[0].id == jv2.id


# ---------------------------------------------------------------------------
# Test 6: Multi-Tenant Isolation
# ---------------------------------------------------------------------------

async def test_tenant_isolation_gl_lookup(db_session):
    """Verifies that an invoice posted in Tenant A never references or touches Tenant B accounts or ledgers."""
    s1 = uuid.uuid4().hex[:8]
    s2 = uuid.uuid4().hex[:8]
    comp1, br1, user1, tenant_ctx1 = await _setup_tenant_and_actor(db_session, s1)
    comp2, br2, user2, tenant_ctx2 = await _setup_tenant_and_actor(db_session, s2)

    prod1 = await _setup_product(db_session, s1, comp1.id, br1.id, stock=50, cost_price=50.00, price=100.00)

    inv1 = SalesInvoice(
        id=f"inv-t1-{s1}",
        invoice_no=f"INV-T1-{s1}",
        customer_name="Tenant 1 Client",
        grand_total=Decimal("100.00"),
        taxable_value=Decimal("100.00"),
        status="Draft",
        company_id=comp1.id,
        branch_id=br1.id,
        version=1,
    )
    inv_item1 = SalesInvoiceItem(
        invoice_id=inv1.id,
        product_id=prod1.id,
        code=prod1.code,
        name=prod1.name,
        quantity=Decimal("1.00"),
        price=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        company_id=comp1.id,
        branch_id=br1.id,
    )
    db_session.add(inv1)
    db_session.add(inv_item1)
    await db_session.commit()

    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx1,
        user=user1,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv1.id, action="POST")
    )

    # Assert 0 vouchers exist under comp2
    comp2_jvs = (await db_session.execute(
        select(JournalVoucher).where(JournalVoucher.company_id == comp2.id)
    )).scalars().all()
    assert len(comp2_jvs) == 0

    # Assert all GL lines for inv1 belong strictly to comp1
    jv1 = (await db_session.execute(
        select(JournalVoucher).where(JournalVoucher.reference_doc_id == inv1.id)
    )).scalar_one()
    gles = (await db_session.execute(
        select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv1.id)
    )).scalars().all()
    for gle in gles:
        assert gle.company_id == comp1.id


# ---------------------------------------------------------------------------
# Test 7: Cancellation Reversal of Revenue and COGS
# ---------------------------------------------------------------------------

async def test_invoice_cancellation_reverses_revenue_and_cogs(db_session):
    """Verifies that cancelling a POSTED invoice creates a balanced reversal voucher that restocks inventory and credits COGS."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=60.00, price=100.00)

    inv = SalesInvoice(
        id=f"inv-rev-{s}",
        invoice_no=f"INV-REV-{s}",
        customer_name="Epsilon Enterprises",
        grand_total=Decimal("100.00"),
        taxable_value=Decimal("100.00"),
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
        quantity=Decimal("1.00"),
        price=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    # 1. Post Invoice
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    await db_session.refresh(prod)
    assert prod.stock == 49

    # 2. Cancel Invoice
    rc = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="CANCEL",
            payload={"reason": "Customer cancellation"}
        )
    )
    assert rc.success is True
    assert rc.to_status == "CANCELLED"

    # 3. Stock restored: 49 + 1 = 50
    await db_session.refresh(prod)
    assert prod.stock == 50

    # 4. Check cancellation JournalVoucher
    jv_cancel = (await db_session.execute(
        select(JournalVoucher).where(
            JournalVoucher.reference_doc_type == "SALES_INVOICE_CANCEL",
            JournalVoucher.reference_doc_id == inv.id,
            JournalVoucher.company_id == comp.id,
        )
    )).scalar_one()
    assert jv_cancel.is_posted is True
    assert jv_cancel.total_debit == jv_cancel.total_credit
    # Total debits = 100.00 (Revenue reversal) + 60.00 (Inventory restock) = 160.00
    assert Decimal(str(jv_cancel.total_debit)) == Decimal("160.00")
    assert Decimal(str(jv_cancel.total_credit)) == Decimal("160.00")
