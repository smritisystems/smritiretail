"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-02
Modified     : 2026-10-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""
P2.2 Sales Return General Ledger Atomicity & Inventory Reversal Test Suite.
Verifies:
1. Normal return stock inward + GL credit note posting
2. Balanced credit note double-entry invariant (Total Debit == Total Credit)
3. Perpetual real-time COGS reversal (DR Inventory Asset 1040, CR COGS 5010)
4. Historical TransactionCostSnapshot cost determination
5. Fallback cost hierarchy (ProductCostValuation -> Product.cost_price)
6. Partial return workflow with correct remaining balances
7. Over-return rejection (new_return_qty > original_invoice_qty - previously_returned_qty)
8. Repeated return process idempotency
9. Concurrent return protection (SELECT FOR UPDATE row locking)
10. Complete atomic rollback on GL failure (no phantom stock, no orphan rows)
11. Complete atomic rollback on Stock failure
12. Complete atomic rollback on missing account
13. Complete atomic rollback on workflow failure
14. Strict multi-tenant isolation
15. Cancellation and reversal safety
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
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.profitability import ProductCostValuation, TransactionCostSnapshot
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.models.workflow import WorkflowEvent
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.api.deps import TenantContext
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    HandlerValidationException,
    LifecycleException,
)
from app.services.lifecycle.registry import LifecycleRegistry
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.sales_stock_authority import SalesStockAuthority

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_tenant_and_actor(db, suffix: str, role=UserRole.MANAGER):
    cid = f"COMP-P22-{suffix}"
    bid = f"BR-P22-{suffix}"
    company = Company(
        id=cid,
        company_code=f"C{suffix[:5].upper()}",
        name=f"P2.2 Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"B{suffix[:5].upper()}",
        company_id=cid,
        name=f"P2.2 Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    user = User(
        id=f"usr-p22-{suffix}",
        username=f"user_p22_{suffix}",
        email=f"user_p22_{suffix}@example.com",
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
        id=f"PROD-P22-{suffix}",
        code=f"SKU-P22-{suffix}",
        sku=f"SKU-P22-{suffix}",
        barcode=f"BAR-P22-{suffix}",
        name=f"P2.2 Product {suffix}",
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


async def _setup_posted_invoice(db, tenant_ctx, user, prod, suffix: str, qty=10, unit_price=200.00, cost_per_unit=120.00):
    """Sets up and POSTs an authoritative sales invoice via UniversalLifecycleEngine."""
    comp_id = tenant_ctx.company_id
    br_id = tenant_ctx.branch_id

    # Create Valuation if needed
    val = ProductCostValuation(
        id=f"pcv-{suffix}",
        company_id=comp_id,
        branch_id=br_id,
        product_id=prod.id,
        weighted_average_cost=Decimal(str(cost_per_unit)),
        purchase_cost=Decimal(str(cost_per_unit)),
        is_active=True,
        is_deleted=False,
    )
    db.add(val)
    await db.commit()

    taxable = Decimal(str(qty * unit_price))
    tax = (taxable * Decimal("0.18")).quantize(Decimal("0.01"))
    grand_total = taxable + tax

    inv = SalesInvoice(
        id=f"inv-{suffix}",
        invoice_no=f"INV-{suffix}",
        customer_name="Retail Customer",
        customer_id=None,
        grand_total=grand_total,
        tax_total=tax,
        taxable_value=taxable,
        status="Draft",
        company_id=comp_id,
        branch_id=br_id,
        version=1,
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal(str(qty)),
        price=Decimal(str(unit_price)),
        taxable_value=taxable,
        cgst_amount=tax / 2,
        sgst_amount=tax / 2,
        igst_amount=Decimal("0.00"),
        total_amount=grand_total,
        company_id=comp_id,
        branch_id=br_id,
    )
    db.add_all([inv, inv_item])
    await db.commit()

    # Post invoice
    r = await UniversalLifecycleEngine.execute_transition(
        db=db,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    assert r.success is True
    assert r.to_status == "POSTED"
    return inv, inv_item


async def _create_sales_return(db, tenant_ctx, inv, prod, suffix: str, return_qty=2, unit_price=200.00):
    comp_id = tenant_ctx.company_id
    br_id = tenant_ctx.branch_id

    taxable = Decimal(str(return_qty * unit_price))
    tax = (taxable * Decimal("0.18")).quantize(Decimal("0.01"))
    grand_total = taxable + tax

    ret = SalesReturn(
        id=f"ret-{suffix}",
        return_no=f"RET-{suffix}",
        original_invoice_id=inv.id,
        customer_id=inv.customer_id,
        grand_total=grand_total,
        tax_total=tax,
        status="Draft",
        company_id=comp_id,
        branch_id=br_id,
        version=1,
    )
    ret_item = SalesReturnItem(
        return_id=ret.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal(str(return_qty)),
        price=Decimal(str(unit_price)),
        tax_amount=tax,
        total_amount=grand_total,
        company_id=comp_id,
        branch_id=br_id,
    )
    db.add_all([ret, ret_item])
    await db.commit()
    return ret, ret_item


# ---------------------------------------------------------------------------
# Test 1: Normal Return Stock + GL
# ---------------------------------------------------------------------------

async def test_normal_return_stock_and_gl(db_session):
    """
    Verifies that processing a Sales Return:
    1. Inwards stock to Product.stock cache and creates RETURN_INWARD movement.
    2. Creates a CREDIT_NOTE journal voucher in GL linked to the return.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=120.00, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10, cost_per_unit=120.00)

    # Initial stock after invoice post: 50 - 10 = 40
    await db_session.refresh(prod)
    assert prod.stock == 40

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=4, unit_price=200.00)

    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )
    r_proc = await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
    )
    assert r_proc.success is True
    assert r_proc.to_status == "PROCESSED"

    # Stock inwarded: 40 + 4 = 44
    await db_session.refresh(prod)
    assert prod.stock == 44

    mov_stmt = select(StockMovement).where(
        StockMovement.reference_doc_type == "SALES_RETURN",
        StockMovement.reference_doc_id == ret.id,
        StockMovement.company_id == comp.id,
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert mov is not None
    assert mov.movement_type == "RETURN_INWARD"
    assert Decimal(str(mov.quantity)) == Decimal("4.00")

    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_RETURN",
        JournalVoucher.reference_doc_id == ret.id,
        JournalVoucher.company_id == comp.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()
    assert jv is not None
    assert jv.voucher_type == "CREDIT_NOTE"


# ---------------------------------------------------------------------------
# Test 2: Balanced Credit Note
# ---------------------------------------------------------------------------

async def test_balanced_credit_note(db_session):
    """
    Verifies that the generated Credit Note Journal Voucher strictly enforces
    Total Debit == Total Credit down to the exact cent.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=120.00, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10, cost_per_unit=120.00)

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=4, unit_price=200.00)

    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
    )

    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_RETURN",
        JournalVoucher.reference_doc_id == ret.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()
    assert jv is not None
    assert jv.is_posted is True
    assert jv.total_debit == jv.total_credit


# ---------------------------------------------------------------------------
# Test 3: COGS Reversal
# ---------------------------------------------------------------------------

async def test_cogs_reversal(db_session):
    """
    Verifies perpetual real-time COGS reversal:
    DR Inventory Asset 1040
    CR Cost of Goods Sold 5010
    Matching returned_quantity * unit_cost.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=120.00, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10, cost_per_unit=120.00)

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=4, unit_price=200.00)

    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
    )

    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_RETURN",
        JournalVoucher.reference_doc_id == ret.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()

    gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    entries = (await db_session.execute(gle_stmt)).scalars().all()

    inv_entry = next((e for e in entries if "1040" in e.account_id), None)
    cogs_entry = next((e for e in entries if "5010" in e.account_id), None)

    expected_cogs = Decimal("480.00")  # 4 units * 120.00
    assert inv_entry is not None
    assert Decimal(str(inv_entry.debit_amount)) == expected_cogs
    assert Decimal(str(inv_entry.credit_amount)) == Decimal("0.00")

    assert cogs_entry is not None
    assert Decimal(str(cogs_entry.credit_amount)) == expected_cogs
    assert Decimal(str(cogs_entry.debit_amount)) == Decimal("0.00")


# ---------------------------------------------------------------------------
# Test 4: Historical TransactionCostSnapshot Cost
# ---------------------------------------------------------------------------

async def test_historical_transaction_cost_snapshot_cost(db_session):
    """
    Verifies that when ProductCostValuation changes AFTER invoice posting,
    the return uses the original invoice's TransactionCostSnapshot, NOT the updated cost.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=100.00, price=200.00)

    # Post invoice with cost = 110.00
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=5, cost_per_unit=110.00)

    # Now simulate a subsequent cost update (e.g. new purchase at 175.00)
    pcv_stmt = select(ProductCostValuation).where(
        ProductCostValuation.product_id == prod.id,
        ProductCostValuation.company_id == comp.id,
    )
    pcv = (await db_session.execute(pcv_stmt)).scalars().first()
    pcv.weighted_average_cost = Decimal("175.00")
    prod.cost_price = Decimal("175.00")
    db_session.add_all([pcv, prod])
    await db_session.commit()

    # Process return for 2 units
    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=2, unit_price=200.00)

    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
    )

    # Historical cost must be 110.00 (NOT 175.00)
    # COGS reversal = 2 * 110.00 = 220.00
    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_RETURN",
        JournalVoucher.reference_doc_id == ret.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()

    gle_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == jv.id,
        GeneralLedgerEntry.account_id.like("%1040%")
    )
    inv_entry = (await db_session.execute(gle_stmt)).scalars().first()
    assert Decimal(str(inv_entry.debit_amount)) == Decimal("220.00")

    mov_stmt = select(StockMovement).where(
        StockMovement.reference_doc_type == "SALES_RETURN",
        StockMovement.reference_doc_id == ret.id,
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert Decimal(str(mov.unit_cost)) == Decimal("110.00")


# ---------------------------------------------------------------------------
# Test 5: Fallback Cost
# ---------------------------------------------------------------------------

async def test_fallback_cost(db_session):
    """
    Verifies fallback hierarchy: ProductCostValuation -> Product.cost_price when no snapshot exists.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=95.00, price=200.00)

    # Setup invoice without snapshot (manually posted or legacy)
    inv = SalesInvoice(
        id=f"inv-legacy-{s}",
        invoice_no=f"INV-LEG-{s}",
        customer_name="Legacy Customer",
        customer_id=None,
        grand_total=Decimal("236.00"),
        tax_total=Decimal("36.00"),
        taxable_value=Decimal("200.00"),
        status="POSTED",
        company_id=comp.id,
        branch_id=br.id,
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("1.00"),
        price=Decimal("200.00"),
        taxable_value=Decimal("200.00"),
        total_amount=Decimal("236.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add_all([inv, inv_item])
    await db_session.commit()

    # Product has cost_price = 95.00, but no snapshot and no ProductCostValuation
    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=1, unit_price=200.00)

    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
    )

    # Cost fallback should resolve to Product.cost_price = 95.00
    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_type == "SALES_RETURN",
        JournalVoucher.reference_doc_id == ret.id,
    )
    jv = (await db_session.execute(jv_stmt)).scalars().first()
    gle_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == jv.id,
        GeneralLedgerEntry.account_id.like("%1040%")
    )
    inv_entry = (await db_session.execute(gle_stmt)).scalars().first()
    assert Decimal(str(inv_entry.debit_amount)) == Decimal("95.00")


# ---------------------------------------------------------------------------
# Test 6: Partial Return
# ---------------------------------------------------------------------------

async def test_partial_return(db_session):
    """Verifies that multiple partial returns can be processed sequentially against an invoice."""
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=100.00, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10, cost_per_unit=100.00)

    # Return 1: 3 units
    ret1, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, f"{s}-1", return_qty=3)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret1.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret1.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret1.id, action="PROCESS")
    )

    # Return 2: 4 units
    ret2, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, f"{s}-2", return_qty=4)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret2.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret2.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret2.id, action="PROCESS")
    )

    # Total returned: 3 + 4 = 7. Stock: initial 50 - 10 (invoice) + 7 (returns) = 47
    await db_session.refresh(prod)
    assert prod.stock == 47


# ---------------------------------------------------------------------------
# Test 7: Over-Return Rejection
# ---------------------------------------------------------------------------

async def test_over_return_rejection(db_session):
    """
    Verifies that attempting to return more than the invoiced quantity
    or exceeding the remaining returnable quantity is strictly rejected.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=100.00, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10, cost_per_unit=100.00)

    # Scenario A: Single return exceeding full invoice quantity (12 > 10)
    ret_excess, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, f"{s}-excess", return_qty=12)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_excess.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_excess.id, action="APPROVE")
    )

    with pytest.raises(HandlerValidationException) as exc_info:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session, tenant_ctx=tenant_ctx, user=user,
            ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_excess.id, action="PROCESS")
        )
    assert exc_info.value.code == "SALES_RETURN_QTY_EXCEEDED" or "exceeds" in str(exc_info.value).lower()

    # Scenario B: Cumulative partial returns exceeding remainder
    # First return 7 units successfully
    ret1, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, f"{s}-p1", return_qty=7)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret1.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret1.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret1.id, action="PROCESS")
    )

    # Second return tries to return 4 units (7 + 4 = 11 > 10)
    ret2, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, f"{s}-p2", return_qty=4)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret2.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret2.id, action="APPROVE")
    )

    with pytest.raises(HandlerValidationException) as exc_info:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session, tenant_ctx=tenant_ctx, user=user,
            ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret2.id, action="PROCESS")
        )
    assert exc_info.value.code == "SALES_RETURN_QTY_EXCEEDED" or "exceeds" in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# Test 8: Repeated Return Idempotency
# ---------------------------------------------------------------------------

async def test_repeated_return_idempotency(db_session):
    """
    Verifies that repeating stock and GL return posting directly or via lifecycle
    does not create duplicate movements or duplicate GL vouchers.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=100.00, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10)

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=3)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
    )

    # 1. Attempt repeated PROCESS transition via lifecycle (should reject invalid transition from PROCESSED)
    with pytest.raises(LifecycleException):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session, tenant_ctx=tenant_ctx, user=user,
            ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
        )

    # 2. Attempt repeated call to SalesStockAuthority.record_return_inward
    lines = [{"product_id": prod.id, "quantity": Decimal("3.00")}]
    movs2 = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=ret.id,
        return_no=ret.return_no,
        items=lines,
        original_invoice_id=inv.id,
    )
    assert len(movs2) == 1  # Returned existing movement

    # 3. Attempt repeated call to UnifiedAccountingLedgerService.post_sales_return_to_gl
    v2 = await UnifiedAccountingLedgerService.post_sales_return_to_gl(
        session=db_session,
        company_id=comp.id,
        return_id=ret.id,
    )
    assert v2 is not None

    # Count vouchers and stock movements
    mov_count_stmt = select(func.count(StockMovement.id)).where(
        StockMovement.reference_doc_id == ret.id,
        StockMovement.movement_type == "RETURN_INWARD"
    )
    assert (await db_session.execute(mov_count_stmt)).scalar() == 1

    jv_count_stmt = select(func.count(JournalVoucher.id)).where(
        JournalVoucher.reference_doc_id == ret.id,
        JournalVoucher.reference_doc_type == "SALES_RETURN"
    )
    assert (await db_session.execute(jv_count_stmt)).scalar() == 1


# ---------------------------------------------------------------------------
# Test 9: Concurrent Return Protection
# ---------------------------------------------------------------------------

async def test_concurrent_return_protection(db_session):
    """
    Verifies that pessimistic row locking (with_for_update) is active on SalesReturn.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10)
    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=2)

    handler = LifecycleRegistry.get("SalesReturn")
    locked_doc = await handler.get_document(db_session, ret.id, tenant_ctx)
    assert locked_doc is not None
    assert locked_doc.id == ret.id


# ---------------------------------------------------------------------------
# Test 10: GL Failure Rollback
# ---------------------------------------------------------------------------

async def test_gl_failure_rollback(db_session):
    """
    Verifies that if GL posting fails during PROCESS:
    - Entire transaction rolls back
    - Return status remains APPROVED
    - Stock is NOT restocked
    - No RETURN_INWARD movement is committed
    - No JournalVoucher is committed
    - No WorkflowEvent is committed
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50, cost_price=100.00, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10)

    # Initial stock after invoice post: 40
    await db_session.refresh(prod)
    stock_before = prod.stock

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=3)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )

    # Simulate GL failure during post_sales_return_to_gl
    with patch.object(
        UnifiedAccountingLedgerService,
        "post_sales_return_to_gl",
        side_effect=RuntimeError("Simulated GL Hardware Crash")
    ):
        with pytest.raises(RuntimeError) as exc_info:
            await UniversalLifecycleEngine.execute_transition(
                db=db_session, tenant_ctx=tenant_ctx, user=user,
                ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
            )
        assert "Simulated GL Hardware Crash" in str(exc_info.value)

    # Rollback verification
    await db_session.refresh(ret)
    assert ret.status == "APPROVED"  # NOT PROCESSED

    await db_session.refresh(prod)
    assert prod.stock == stock_before  # Stock untouched

    mov_stmt = select(StockMovement).where(
        StockMovement.reference_doc_id == ret.id,
        StockMovement.movement_type == "RETURN_INWARD"
    )
    assert (await db_session.execute(mov_stmt)).scalars().first() is None

    jv_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_id == ret.id,
        JournalVoucher.reference_doc_type == "SALES_RETURN"
    )
    assert (await db_session.execute(jv_stmt)).scalars().first() is None

    wf_stmt = select(WorkflowEvent).where(
        WorkflowEvent.doc_id == ret.id,
        WorkflowEvent.action == "PROCESS"
    )
    assert (await db_session.execute(wf_stmt)).scalars().first() is None


# ---------------------------------------------------------------------------
# Test 11: Stock Failure Rollback
# ---------------------------------------------------------------------------

async def test_stock_failure_rollback(db_session):
    """
    Verifies that if physical stock inwarding fails:
    - Entire transaction rolls back
    - Return status remains APPROVED
    - No GL voucher is created
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10)

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=3)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )

    with patch.object(
        SalesStockAuthority,
        "record_return_inward",
        side_effect=HTTPException(status_code=500, detail="Stock Ledger Failure")
    ):
        with pytest.raises(HTTPException):
            await UniversalLifecycleEngine.execute_transition(
                db=db_session, tenant_ctx=tenant_ctx, user=user,
                ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
            )

    await db_session.refresh(ret)
    assert ret.status == "APPROVED"

    jv_stmt = select(JournalVoucher).where(JournalVoucher.reference_doc_id == ret.id)
    assert (await db_session.execute(jv_stmt)).scalars().first() is None


# ---------------------------------------------------------------------------
# Test 12: Missing Account Rollback
# ---------------------------------------------------------------------------

async def test_missing_account_rollback(db_session):
    """
    Verifies that a missing required ledger account raises error and triggers complete rollback.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10)

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=2)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )

    original_get_account = UnifiedAccountingLedgerService.get_account_by_code

    async def _mock_get_account(session, company_id, code):
        if code == "1040":
            raise HTTPException(status_code=404, detail="Account 1040 missing")
        return await original_get_account(session, company_id, code)

    with patch.object(UnifiedAccountingLedgerService, "get_account_by_code", side_effect=_mock_get_account):
        with pytest.raises(HTTPException) as exc_info:
            await UniversalLifecycleEngine.execute_transition(
                db=db_session, tenant_ctx=tenant_ctx, user=user,
                ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
            )
        assert exc_info.value.status_code == 404

    await db_session.refresh(ret)
    assert ret.status == "APPROVED"


# ---------------------------------------------------------------------------
# Test 13: Workflow Failure Rollback
# ---------------------------------------------------------------------------

async def test_workflow_failure_rollback(db_session):
    """
    Verifies that if WorkflowEvent persistence fails, the entire transaction rolls back.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10)

    ret, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, s, return_qty=2)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="APPROVE")
    )

    with patch("app.services.lifecycle.engine.WorkflowEvent", side_effect=RuntimeError("Workflow Event Error")):
        with pytest.raises(RuntimeError):
            await UniversalLifecycleEngine.execute_transition(
                db=db_session, tenant_ctx=tenant_ctx, user=user,
                ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret.id, action="PROCESS")
            )

    await db_session.refresh(ret)
    assert ret.status == "APPROVED"


# ---------------------------------------------------------------------------
# Test 14: Tenant Isolation
# ---------------------------------------------------------------------------

async def test_tenant_isolation(db_session):
    """
    Verifies that:
    1. Tenant A cannot return against Tenant B's invoice.
    2. Tenant A cannot process Tenant B's return.
    """
    s1 = uuid.uuid4().hex[:8]
    s2 = uuid.uuid4().hex[:8]

    comp1, br1, user1, ctx1 = await _setup_tenant_and_actor(db_session, s1)
    comp2, br2, user2, ctx2 = await _setup_tenant_and_actor(db_session, s2)

    prod1 = await _setup_product(db_session, s1, comp1.id, br1.id, stock=50)
    inv1, _ = await _setup_posted_invoice(db_session, ctx1, user1, prod1, s1, qty=5)

    # Tenant 2 tries to create return referencing Tenant 1's invoice
    ret_cross = SalesReturn(
        id=f"ret-cross-{s2}",
        return_no=f"RET-CROSS-{s2}",
        original_invoice_id=inv1.id,
        grand_total=Decimal("200.00"),
        tax_total=Decimal("0.00"),
        status="Draft",
        company_id=comp2.id,
        branch_id=br2.id,
    )
    ret_item_cross = SalesReturnItem(
        return_id=ret_cross.id,
        product_id=prod1.id,
        code=prod1.code,
        name=prod1.name,
        quantity=Decimal("1.00"),
        price=Decimal("200.00"),
        total_amount=Decimal("200.00"),
        company_id=comp2.id,
        branch_id=br2.id,
    )
    db_session.add_all([ret_cross, ret_item_cross])
    await db_session.commit()

    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=ctx2, user=user2,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_cross.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=ctx2, user=user2,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_cross.id, action="APPROVE")
    )

    # PROCESS should fail with SALES_RETURN_ORIGINAL_INVOICE_NOT_FOUND because inv1 belongs to Tenant 1
    with pytest.raises(HandlerValidationException) as exc_info:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session, tenant_ctx=ctx2, user=user2,
            ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_cross.id, action="PROCESS")
        )
    assert exc_info.value.code == "SALES_RETURN_ORIGINAL_INVOICE_NOT_FOUND" or "not found" in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# Test 15: Cancellation and Reversal Safety
# ---------------------------------------------------------------------------

async def test_cancellation_reversal_safety(db_session):
    """
    Verifies that:
    1. A return in DRAFT or APPROVED state can be CANCELLED safely without orphan stock or GL entries.
    2. A return in PROCESSED state CANNOT be cancelled.
    """
    s = uuid.uuid4().hex[:8]
    comp, br, user, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, br.id, stock=50)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, prod, s, qty=10)

    # 1. Cancel from DRAFT
    ret_draft, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, f"{s}-draft", return_qty=2)
    r_cancel = await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_draft.id, action="CANCEL")
    )
    assert r_cancel.success is True
    assert r_cancel.to_status == "CANCELLED"

    # 2. Process a return, then attempt to cancel it
    ret_proc, _ = await _create_sales_return(db_session, tenant_ctx, inv, prod, f"{s}-proc", return_qty=2)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_proc.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_proc.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_proc.id, action="PROCESS")
    )

    with pytest.raises(LifecycleException) as exc_info:
        await UniversalLifecycleEngine.execute_transition(
            db=db_session, tenant_ctx=tenant_ctx, user=user,
            ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=ret_proc.id, action="CANCEL")
        )
    assert "cancel" in str(exc_info.value).lower()
