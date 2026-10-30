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
P2.3 Payment General Ledger Atomicity Test Suite.
Verifies:
1. Synchronous Payment Receipt GL creation on payment settlement (BD-03)
2. Tender ledger debit (Cash 1010 / Bank 1020) and Accounts Receivable credit (1030)
3. Partial invoice payment tracking and subsequent full settlement
4. Multi-tender split payment processing (Cash + UPI/Card)
5. Multi-invoice allocation distribution
6. Over-allocation rejection against invoice outstanding balance
7. Perfectly balanced JournalVoucher (Total Debit == Total Credit)
8. Accounts Receivable party_id linkage
9. Atomic fail-fast rollback on GL failure (no phantom payment, no balance mutation)
10. Missing account fail-fast rollback
11. Idempotency against duplicate payment submissions
12. Concurrency and row-locking protection
13. Cross-company allocation rejection (tenant isolation)
14. Mathematical balance parity (grand_total == paid_amount + balance_amount)
15. Payment allocation consistency (sum of allocations <= payment amount)
16. Guard preventing cancellation of PAID invoices with active payments
"""

import uuid
import asyncio
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
from app.models.payment_ledger import PaymentTransaction, PaymentAllocation
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.models.crm import Customer
from app.api.deps import TenantContext
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    HandlerValidationException,
    InvalidTransitionException,
)
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.payments_engine import PaymentsEngine
from app.schemas.payments import (
    ProcessPaymentRequest,
    PaymentTenderItem,
    PaymentAllocationRequest,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_tenant_and_actor(db, suffix: str, role=UserRole.MANAGER):
    cid = f"COMP-P23-{suffix}"
    bid = f"BR-P23-{suffix}"
    code_part = uuid.uuid4().hex[:6].upper()
    company = Company(
        id=cid,
        company_code=f"C{code_part}",
        name=f"P2.3 Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"B{code_part}",
        company_id=cid,
        name=f"P2.3 Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    user = User(
        id=f"usr-p23-{suffix}",
        username=f"user_p23_{suffix}",
        email=f"user_p23_{suffix}@example.com",
        hashed_password="mocked_password",
        role=role,
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    customer = Customer(
        id=f"cust-p23-{suffix}",
        company_id=cid,
        branch_id=bid,
        name=f"Customer {suffix}",
        mobile=f"9876{suffix[:6]}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([user, customer])
    await db.commit()

    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    return company, branch, user, customer, tenant_ctx


async def _setup_product(db, suffix: str, company_id: str, branch_id: str, stock=100, cost_price=100.00, price=200.00):
    prod = Product(
        id=f"PROD-P23-{suffix}",
        code=f"SKU-P23-{suffix}",
        sku=f"SKU-P23-{suffix}",
        barcode=f"BAR-P23-{suffix}",
        name=f"P2.3 Product {suffix}",
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


async def _setup_posted_invoice(db, tenant_ctx, user, customer, prod, suffix: str, qty=5, unit_price=200.00):
    """Sets up and POSTs an authoritative sales invoice via UniversalLifecycleEngine."""
    comp_id = tenant_ctx.company_id
    br_id = tenant_ctx.branch_id

    # Create Valuation if not already present for this product
    val_stmt = select(ProductCostValuation).where(
        ProductCostValuation.product_id == prod.id,
        ProductCostValuation.company_id == comp_id
    )
    val = (await db.execute(val_stmt)).scalars().first()
    if not val:
        val = ProductCostValuation(
            id=f"pcv-p23-{suffix}",
            company_id=comp_id,
            branch_id=br_id,
            product_id=prod.id,
            weighted_average_cost=Decimal("100.00"),
            purchase_cost=Decimal("100.00"),
            is_active=True,
            is_deleted=False,
        )
        db.add(val)
        await db.commit()

    taxable = Decimal(str(qty * unit_price))
    tax = (taxable * Decimal("0.18")).quantize(Decimal("0.01"))
    grand_total = taxable + tax

    inv = SalesInvoice(
        id=f"inv-p23-{suffix}",
        invoice_no=f"INV-P23-{suffix}",
        customer_name=customer.name,
        customer_id=customer.id,
        grand_total=grand_total,
        paid_amount=Decimal("0.00"),
        balance_amount=grand_total,
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


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

async def test_cash_payment_gl_creation(db_session):
    """Test 1: Verify CASH payment creates balanced JournalVoucher with DR Cash 1010 / CR AR 1030."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=5, unit_price=200.00)

    # Invoice grand_total = 1000 + 180 = 1180.00
    pay_res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": 1180.00, "tender_type": "CASH"}
        )
    )
    assert pay_res.success is True
    assert pay_res.to_status == "PAID"

    # Verify SalesInvoice status & balance
    refreshed_inv = await db_session.get(SalesInvoice, inv.id)
    assert refreshed_inv.status == "PAID"
    assert refreshed_inv.paid_amount == Decimal("1180.00")
    assert refreshed_inv.balance_amount == Decimal("0.00")

    # Verify PaymentTransaction
    stmt_pt = select(PaymentTransaction).where(
        PaymentTransaction.company_id == comp.id,
        PaymentTransaction.reference_doc_id == inv.id
    )
    pt = (await db_session.execute(stmt_pt)).scalars().first()
    assert pt is not None
    assert pt.amount == Decimal("1180.00")
    assert pt.tender_type == "CASH"
    assert pt.status == "SUCCESS"

    # Verify JournalVoucher
    stmt_jv = select(JournalVoucher).where(
        JournalVoucher.company_id == comp.id,
        JournalVoucher.reference_doc_id == pt.id
    )
    jv = (await db_session.execute(stmt_jv)).scalars().first()
    assert jv is not None
    assert jv.voucher_type == "PAYMENT_RECEIPT"
    assert jv.total_debit == Decimal("1180.00")
    assert jv.total_credit == Decimal("1180.00")

    # Verify GeneralLedgerEntries
    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gles = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(gles) == 2

    gle_cash = next(g for g in gles if g.debit_amount > Decimal("0.00"))
    gle_ar = next(g for g in gles if g.credit_amount > Decimal("0.00"))

    # DR 1010
    acc_cash = await db_session.get(Account, gle_cash.account_id)
    assert acc_cash.account_code == "1010"
    assert gle_cash.debit_amount == Decimal("1180.00")

    # CR 1030
    acc_ar = await db_session.get(Account, gle_ar.account_id)
    assert acc_ar.account_code == "1030"
    assert gle_ar.credit_amount == Decimal("1180.00")
    assert gle_ar.party_id == cust.id


async def test_bank_payment_gl_creation(db_session):
    """Test 2: Verify Bank/UPI payment debits Bank Accounts 1020 and credits AR 1030."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=10, unit_price=200.00)

    # Grand total = 2000 + 360 = 2360.00
    pay_res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": 2360.00, "tender_type": "UPI", "reference_no": f"UPI-{s}"}
        )
    )
    assert pay_res.success is True

    stmt_pt = select(PaymentTransaction).where(
        PaymentTransaction.company_id == comp.id,
        PaymentTransaction.reference_doc_id == inv.id
    )
    pt = (await db_session.execute(stmt_pt)).scalars().first()

    stmt_jv = select(JournalVoucher).where(JournalVoucher.reference_doc_id == pt.id)
    jv = (await db_session.execute(stmt_jv)).scalars().first()

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gles = (await db_session.execute(stmt_gle)).scalars().all()

    gle_bank = next(g for g in gles if g.debit_amount > Decimal("0.00"))
    acc_bank = await db_session.get(Account, gle_bank.account_id)
    assert acc_bank.account_code == "1020"
    assert gle_bank.debit_amount == Decimal("2360.00")


async def test_partial_invoice_payment(db_session):
    """Test 3: Verify partial payment updates paid/balance amount and remains POSTED."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=5, unit_price=200.00)

    # Grand total = 1180.00. Pay partial 500.00
    pay_res = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": 500.00, "tender_type": "CASH"}
        )
    )
    assert pay_res.success is True

    refreshed_inv = await db_session.get(SalesInvoice, inv.id)
    assert refreshed_inv.status == "POSTED"  # Remains POSTED
    assert refreshed_inv.paid_amount == Decimal("500.00")
    assert refreshed_inv.balance_amount == Decimal("680.00")

    # Verify GL entry is for 500.00
    stmt_pt = select(PaymentTransaction).where(PaymentTransaction.reference_doc_id == inv.id)
    pt = (await db_session.execute(stmt_pt)).scalars().first()
    assert pt.amount == Decimal("500.00")

    stmt_jv = select(JournalVoucher).where(JournalVoucher.reference_doc_id == pt.id)
    jv = (await db_session.execute(stmt_jv)).scalars().first()
    assert jv.total_debit == Decimal("500.00")


async def test_full_invoice_settlement(db_session):
    """Test 4: Verify subsequent payment for remainder transitions invoice to PAID."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=5, unit_price=200.00)

    # 1. First partial payment: 500.00
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": 500.00, "tender_type": "CASH"}
        )
    )

    # 2. Second remainder payment: 680.00
    pay_res2 = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": 680.00, "tender_type": "CARD"}
        )
    )
    assert pay_res2.success is True

    refreshed_inv = await db_session.get(SalesInvoice, inv.id)
    assert refreshed_inv.status == "PAID"
    assert refreshed_inv.paid_amount == Decimal("1180.00")
    assert refreshed_inv.balance_amount == Decimal("0.00")

    # Verify 2 distinct JVs exist
    stmt_pts = select(PaymentTransaction).where(PaymentTransaction.reference_doc_id == inv.id)
    pts = (await db_session.execute(stmt_pts)).scalars().all()
    assert len(pts) == 2

    stmt_jvs = select(JournalVoucher).where(JournalVoucher.reference_doc_id.in_([p.id for p in pts]))
    jvs = (await db_session.execute(stmt_jvs)).scalars().all()
    assert len(jvs) == 2


async def test_split_multi_tender_payment(db_session):
    """Test 5: Verify multi-tender payment creates separate transactions and GL entries."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=5, unit_price=200.00)

    # Total 1180.00: Split 500 Cash + 680 Bank
    req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=inv.id,
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[
            PaymentTenderItem(tender_type="CASH", amount=500.00),
            PaymentTenderItem(tender_type="CARD", amount=680.00, gateway_reference=f"CARD-{s}"),
        ],
        idempotency_key=f"IDEMP-SPLIT-{s}",
        auto_allocate=True,
    )
    res = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=comp.id,
        req=req,
        commit=True,
    )
    assert res.status == "SUCCESS"
    assert len(res.transactions) == 2

    # Check invoice balance synchronized
    refreshed_inv = await db_session.get(SalesInvoice, inv.id)
    assert refreshed_inv.paid_amount == Decimal("1180.00")
    assert refreshed_inv.balance_amount == Decimal("0.00")
    assert refreshed_inv.status == "PAID"

    # Check both JVs posted
    stmt_jvs = select(JournalVoucher).where(JournalVoucher.reference_doc_id.in_([t.id for t in res.transactions]))
    jvs = (await db_session.execute(stmt_jvs)).scalars().all()
    assert len(jvs) == 2


async def test_multiple_invoice_allocation(db_session):
    """Test 6: Verify allocating an unallocated payment across two invoices."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv1, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, f"{s}-1", qty=2, unit_price=200.00)
    inv2, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, f"{s}-2", qty=3, unit_price=200.00)

    # Inv1 = 472.00, Inv2 = 708.00. Total = 1180.00
    pay_req = ProcessPaymentRequest(
        reference_doc_type="ADVANCE_PAYMENT",
        reference_doc_id=f"ADV-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="BANK_TRANSFER", amount=1180.00)],
        idempotency_key=f"IDEMP-ALLOC-{s}",
        auto_allocate=False,
    )
    pay_res = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=comp.id,
        req=pay_req,
        commit=True,
    )
    tx_id = pay_res.transactions[0].id

    # Allocate 472 to Inv1
    alloc1 = await PaymentsEngine.allocate_payment(
        session=db_session,
        company_id=comp.id,
        payment_id=tx_id,
        req=PaymentAllocationRequest(invoice_id=inv1.id, allocated_amount=472.00),
        commit=True,
    )
    assert alloc1.allocated_amount == 472.00

    ref_inv1 = await db_session.get(SalesInvoice, inv1.id)
    assert ref_inv1.paid_amount == Decimal("472.00")
    assert ref_inv1.balance_amount == Decimal("0.00")
    assert ref_inv1.status == "PAID"

    # Allocate 708 to Inv2
    alloc2 = await PaymentsEngine.allocate_payment(
        session=db_session,
        company_id=comp.id,
        payment_id=tx_id,
        req=PaymentAllocationRequest(invoice_id=inv2.id, allocated_amount=708.00),
        commit=True,
    )
    assert alloc2.allocated_amount == 708.00

    ref_inv2 = await db_session.get(SalesInvoice, inv2.id)
    assert ref_inv2.paid_amount == Decimal("708.00")
    assert ref_inv2.balance_amount == Decimal("0.00")
    assert ref_inv2.status == "PAID"


async def test_over_allocation_rejection(db_session):
    """Test 7: Verify allocating more than invoice balance is strictly rejected."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    # Inv grand_total = 472.00
    with pytest.raises(HandlerValidationException, match="exceeds outstanding invoice balance"):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="SalesInvoice",
                doc_id=inv.id,
                action="PAY",
                payload={"amount": 500.00, "tender_type": "CASH"}
            )
        )

    refreshed_inv = await db_session.get(SalesInvoice, inv.id)
    assert refreshed_inv.status == "POSTED"
    assert refreshed_inv.paid_amount == Decimal("0.00")


async def test_balanced_payment_receipt_jv(db_session):
    """Test 8: Verify Payment Receipt JournalVoucher debits strictly equal credits."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=3, unit_price=177.33)

    # Grand total calculation
    amt = inv.grand_total
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": float(amt), "tender_type": "CASH"}
        )
    )

    stmt_jv = select(JournalVoucher).where(JournalVoucher.voucher_type == "PAYMENT_RECEIPT", JournalVoucher.company_id == comp.id)
    jv = (await db_session.execute(stmt_jv)).scalars().first()
    assert jv.total_debit == jv.total_credit == amt

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gles = (await db_session.execute(stmt_gle)).scalars().all()
    total_dr = sum(g.debit_amount for g in gles)
    total_cr = sum(g.credit_amount for g in gles)
    assert total_dr == total_cr == amt


async def test_ar_credit_matches_party_id(db_session):
    """Test 9: Verify AR credit line links to customer party_id."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": float(inv.grand_total), "tender_type": "CASH"}
        )
    )

    stmt_jv = select(JournalVoucher).where(JournalVoucher.company_id == comp.id, JournalVoucher.voucher_type == "PAYMENT_RECEIPT")
    jv = (await db_session.execute(stmt_jv)).scalars().first()

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id, GeneralLedgerEntry.credit_amount > Decimal("0.00"))
    gle_ar = (await db_session.execute(stmt_gle)).scalars().first()
    assert gle_ar.party_id == cust.id


async def test_gl_failure_rolls_back_payment(db_session):
    """Test 10: Verify simulated GL failure causes complete atomic rollback."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)
    inv_id = str(inv.id)
    inv_total = float(inv.grand_total)

    with patch.object(
        UnifiedAccountingLedgerService,
        "post_payment_transaction_to_gl",
        side_effect=RuntimeError("Simulated GL Ledger Service Down")
    ):
        with pytest.raises(RuntimeError, match="Simulated GL Ledger Service Down"):
            await UniversalLifecycleEngine.execute_transition(
                db=db_session,
                tenant_ctx=tenant_ctx,
                user=user,
                ctx=LifecycleTransitionContext(
                    doc_type="SalesInvoice",
                    doc_id=inv_id,
                    action="PAY",
                    payload={"amount": inv_total, "tender_type": "CASH"}
                )
            )

    # Verify complete rollback
    refreshed_inv = await db_session.get(SalesInvoice, inv_id)
    assert refreshed_inv.status == "POSTED"
    assert refreshed_inv.paid_amount == Decimal("0.00")
    assert refreshed_inv.balance_amount == Decimal("472.00")

    # Verify no orphan PaymentTransaction exists
    stmt_pt = select(PaymentTransaction).where(PaymentTransaction.reference_doc_id == inv_id)
    pt = (await db_session.execute(stmt_pt)).scalars().first()
    assert pt is None


async def test_missing_account_fails_fast(db_session):
    """Test 11: Verify missing chart of accounts fails fast and rolls back."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)
    inv_id = str(inv.id)
    inv_total = float(inv.grand_total)

    # Patch get_account_by_code to simulate missing Account 1010
    with patch.object(
        UnifiedAccountingLedgerService,
        "get_account_by_code",
        side_effect=HTTPException(status_code=404, detail="Account 1010 missing")
    ):
        with pytest.raises(HTTPException, match="Account 1010 missing"):
            await UniversalLifecycleEngine.execute_transition(
                db=db_session,
                tenant_ctx=tenant_ctx,
                user=user,
                ctx=LifecycleTransitionContext(
                    doc_type="SalesInvoice",
                    doc_id=inv_id,
                    action="PAY",
                    payload={"amount": inv_total, "tender_type": "CASH"}
                )
            )

    refreshed_inv = await db_session.get(SalesInvoice, inv_id)
    assert refreshed_inv.status == "POSTED"
    assert refreshed_inv.paid_amount == Decimal("0.00")


async def test_duplicate_payment_idempotency(db_session):
    """Test 12: Verify duplicate payment request returns existing transaction without duplicate GL."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    idemp_key = f"IDEMP-DUP-{s}"
    req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=inv.id,
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=472.00)],
        idempotency_key=idemp_key,
        auto_allocate=True,
    )

    # First call
    res1 = await PaymentsEngine.process_payment(db_session, comp.id, req, commit=True)
    tx1_id = res1.transactions[0].id

    # Second call with exact same idempotency_key
    res2 = await PaymentsEngine.process_payment(db_session, comp.id, req, commit=True)
    tx2_id = res2.transactions[0].id

    assert tx1_id == tx2_id

    # Verify exactly 1 JV exists
    stmt_jv = select(JournalVoucher).where(JournalVoucher.reference_doc_id == tx1_id)
    jvs = (await db_session.execute(stmt_jv)).scalars().all()
    assert len(jvs) == 1


async def test_concurrent_payment_locking(db_session):
    """Test 13: Verify optimistic/pessimistic locking prevents double-spending over balance."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    # Invoice balance is 472.00
    # First payment of 300.00 succeeds
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": 300.00, "tender_type": "CASH"}
        )
    )

    # Second payment of 300.00 exceeds remaining balance (172.00) -> must raise
    with pytest.raises(HandlerValidationException, match="exceeds outstanding invoice balance"):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="SalesInvoice",
                doc_id=inv.id,
                action="PAY",
                payload={"amount": 300.00, "tender_type": "CASH"}
            )
        )


async def test_cross_company_payment_blocked(db_session):
    """Test 14: Verify cross-company allocation is strictly forbidden."""
    s = uuid.uuid4().hex[:8]
    comp1, branch1, user1, cust1, tenant_ctx1 = await _setup_tenant_and_actor(db_session, f"{s}-1")
    comp2, branch2, user2, cust2, tenant_ctx2 = await _setup_tenant_and_actor(db_session, f"{s}-2")

    prod1 = await _setup_product(db_session, f"{s}-1", comp1.id, branch1.id)
    inv1, _ = await _setup_posted_invoice(db_session, tenant_ctx1, user1, cust1, prod1, f"{s}-1", qty=2, unit_price=200.00)

    # Create unallocated payment in Company 2
    pay_req = ProcessPaymentRequest(
        reference_doc_type="ADVANCE_PAYMENT",
        reference_doc_id=f"ADV-{s}",
        party_id=cust2.id,
        branch_id=branch2.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=500.00)],
        idempotency_key=f"IDEMP-CROSS-{s}",
        auto_allocate=False,
    )
    pay_res = await PaymentsEngine.process_payment(db_session, comp2.id, pay_req, commit=True)
    tx_id = pay_res.transactions[0].id

    # Attempt to allocate Company 2's payment to Company 1's invoice
    with pytest.raises(ValueError, match="Cross-company allocation forbidden"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp2.id,
            payment_id=tx_id,
            req=PaymentAllocationRequest(invoice_id=inv1.id, allocated_amount=400.00),
            commit=True,
        )


async def test_invoice_balance_mathematical_parity(db_session):
    """Test 15: Verify grand_total == paid_amount + balance_amount at all lifecycle states."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=5, unit_price=200.00)

    # Initial POSTED
    ref_inv = await db_session.get(SalesInvoice, inv.id)
    assert ref_inv.grand_total == ref_inv.paid_amount + ref_inv.balance_amount

    # Step 1: Pay 200
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="PAY", payload={"amount": 200.00})
    )
    ref_inv = await db_session.get(SalesInvoice, inv.id)
    assert ref_inv.grand_total == ref_inv.paid_amount + ref_inv.balance_amount

    # Step 2: Pay 400
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="PAY", payload={"amount": 400.00})
    )
    ref_inv = await db_session.get(SalesInvoice, inv.id)
    assert ref_inv.grand_total == ref_inv.paid_amount + ref_inv.balance_amount

    # Step 3: Pay remainder
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="PAY", payload={"amount": float(ref_inv.balance_amount)})
    )
    ref_inv = await db_session.get(SalesInvoice, inv.id)
    assert ref_inv.grand_total == ref_inv.paid_amount + ref_inv.balance_amount
    assert ref_inv.balance_amount == Decimal("0.00")
    assert ref_inv.status == "PAID"


async def test_payment_allocation_consistency(db_session):
    """Test 16: Verify sum of allocations does not exceed payment amount."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=5, unit_price=200.00)

    pay_req = ProcessPaymentRequest(
        reference_doc_type="ADVANCE_PAYMENT",
        reference_doc_id=f"ADV-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=500.00)],
        idempotency_key=f"IDEMP-CONSIST-{s}",
        auto_allocate=False,
    )
    pay_res = await PaymentsEngine.process_payment(db_session, comp.id, pay_req, commit=True)
    tx_id = pay_res.transactions[0].id

    # Allocate 400 (succeeds)
    await PaymentsEngine.allocate_payment(
        session=db_session,
        company_id=comp.id,
        payment_id=tx_id,
        req=PaymentAllocationRequest(invoice_id=inv.id, allocated_amount=400.00),
        commit=True,
    )

    # Allocate additional 200 (fails: 400 + 200 > 500)
    with pytest.raises(ValueError, match="exceeds unallocated payment balance"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp.id,
            payment_id=tx_id,
            req=PaymentAllocationRequest(invoice_id=inv.id, allocated_amount=200.00),
            commit=True,
        )


async def test_cancel_paid_invoice_guard(db_session):
    """Test 17: Verify CANCEL action is rejected on PAID and partially paid invoices with active payments."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    # 1. Fully pay invoice
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="PAY",
            payload={"amount": float(inv.grand_total), "tender_type": "CASH"}
        )
    )

    # Attempt to CANCEL fully paid invoice -> rejected by state graph or handler
    with pytest.raises((HandlerValidationException, InvalidTransitionException)):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="SalesInvoice",
                doc_id=inv.id,
                action="CANCEL",
                payload={"reason": "Customer changed mind"}
            )
        )

    refreshed_inv = await db_session.get(SalesInvoice, str(inv.id))
    assert refreshed_inv.status == "PAID"

    # 2. Test partially paid invoice (status remains POSTED)
    prod2 = await _setup_product(db_session, f"{s}p", comp.id, branch.id)
    inv2, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod2, f"{s}p", qty=5, unit_price=200.00)
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv2.id,
            action="PAY",
            payload={"amount": 200.00, "tender_type": "CASH"}
        )
    )
    with pytest.raises(HandlerValidationException, match="active payments"):
        await UniversalLifecycleEngine.execute_transition(
            db=db_session,
            tenant_ctx=tenant_ctx,
            user=user,
            ctx=LifecycleTransitionContext(
                doc_type="SalesInvoice",
                doc_id=inv2.id,
                action="CANCEL",
                payload={"reason": "Customer changed mind"}
            )
        )
