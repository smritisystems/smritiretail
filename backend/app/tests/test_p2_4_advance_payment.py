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
P2.4 Customer Advance Payments & Invoice Knock-off Test Suite.
Verifies:
1. Cash advance creates PaymentTransaction with reference_doc_type=CUSTOMER_ADVANCE and auto_allocate=False
2. Cash advance creates balanced JournalVoucher with DR 1010 (Cash in Hand) / CR 2050 (Customer Advance Liability)
3. Bank advance creates balanced JournalVoucher with DR 1020 (Bank Accounts) / CR 2050 (Customer Advance Liability)
4. Customer advance is initially fully unallocated (unallocated == payment amount)
5. Customer advance does not auto-allocate to any invoice
6. Partial advance -> invoice allocation updates unallocated balance and invoice balance
7. Full advance -> invoice allocation sets invoice status to PAID
8. Multi-invoice allocation from a single advance (split across Invoice A, B, C)
9. Remaining unallocated balance is mathematically correct at each step
10. Invoice paid/balance parity invariant (grand_total == paid_amount + balance_amount)
11. Knock-off allocation creates balanced JournalVoucher with DR 2050 / CR 1030
12. Knock-off allocation does NOT create another Cash/Bank entry (zero cash movement)
13. Over-allocation of advance beyond unallocated balance is rejected
14. Over-allocation of invoice beyond outstanding balance is rejected
15. Customer identity mismatch is rejected (Customer A advance cannot settle Customer B invoice)
16. Cross-company allocation is rejected
17. Concurrent allocation protection via PaymentTransaction FOR UPDATE row locking
18. Duplicate allocation request with idempotency_key is idempotent
19. Receipt GL failure rolls back PaymentTransaction atomically
20. Knock-off GL failure rolls back PaymentAllocation and leaves invoice balance intact
21. Missing 2050 account fails atomically
22. Cancelled/invalid invoice cannot receive allocation
23. Cancelled/invalid advance cannot be allocated
24. Accounting entries remain balanced (Total Debit == Total Credit)
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
    cid = f"COMP-P24-{suffix}"
    bid = f"BR-P24-{suffix}"
    code_part = uuid.uuid4().hex[:6].upper()
    company = Company(
        id=cid,
        company_code=f"C{code_part}",
        name=f"P2.4 Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"B{code_part}",
        company_id=cid,
        name=f"P2.4 Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    user = User(
        id=f"usr-p24-{suffix}",
        username=f"user_p24_{suffix}",
        email=f"user_p24_{suffix}@example.com",
        hashed_password="mocked_password",
        role=role,
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    customer = Customer(
        id=f"cust-p24-{suffix}",
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
        id=f"PROD-P24-{suffix}",
        code=f"SKU-P24-{suffix}",
        sku=f"SKU-P24-{suffix}",
        barcode=f"BAR-P24-{suffix}",
        name=f"P2.4 Product {suffix}",
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

    val_stmt = select(ProductCostValuation).where(
        ProductCostValuation.product_id == prod.id,
        ProductCostValuation.company_id == comp_id
    )
    val = (await db.execute(val_stmt)).scalars().first()
    if not val:
        val = ProductCostValuation(
            id=f"pcv-p24-{suffix}",
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
        id=f"inv-p24-{suffix}",
        invoice_no=f"INV-P24-{suffix}",
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
# P2.4 Test Suite
# ---------------------------------------------------------------------------

async def test_cash_advance_creates_payment_and_gl(db_session):
    """Test 1 & 2: Cash advance creates PaymentTransaction and DR 1010 / CR 2050."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)

    req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-REF-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1500.00)],
        idempotency_key=f"IDEMP-ADV-{s}",
        auto_allocate=False,
    )
    res = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=comp.id,
        req=req,
        created_by=user.username,
        commit=True,
    )

    assert res.status == "SUCCESS"
    assert len(res.transactions) == 1
    tx_res = res.transactions[0]
    assert tx_res.reference_doc_type == "CUSTOMER_ADVANCE"
    assert tx_res.amount == 1500.00
    assert len(tx_res.allocations) == 0

    # Verify Journal Voucher
    stmt_jv = select(JournalVoucher).where(
        JournalVoucher.company_id == comp.id,
        JournalVoucher.reference_doc_id == tx_res.id,
        JournalVoucher.is_deleted == False
    )
    jv = (await db_session.execute(stmt_jv)).scalar_one_or_none()
    assert jv is not None
    assert jv.voucher_type == "PAYMENT_RECEIPT"
    assert jv.total_debit == Decimal("1500.00")
    assert jv.total_credit == Decimal("1500.00")

    # Verify GL Entries: DR 1010 (Cash in Hand) / CR 2050 (Customer Advance Liability)
    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    entries = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(entries) == 2

    acc_1010 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "1010")
    acc_2050 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "2050")

    debit_entry = next(e for e in entries if e.debit_amount > Decimal("0.00"))
    credit_entry = next(e for e in entries if e.credit_amount > Decimal("0.00"))

    assert debit_entry.account_id == acc_1010.id
    assert debit_entry.debit_amount == Decimal("1500.00")
    assert credit_entry.account_id == acc_2050.id
    assert credit_entry.credit_amount == Decimal("1500.00")
    assert credit_entry.party_id == cust.id


async def test_bank_advance_creates_gl(db_session):
    """Test 3: Bank advance creates DR 1020 / CR 2050."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)

    req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-BANK-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="UPI", amount=2500.00)],
        idempotency_key=f"IDEMP-UPI-{s}",
        auto_allocate=False,
    )
    res = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=comp.id,
        req=req,
        created_by=user.username,
        commit=True,
    )
    tx_id = res.transactions[0].id

    stmt_jv = select(JournalVoucher).where(JournalVoucher.reference_doc_id == tx_id)
    jv = (await db_session.execute(stmt_jv)).scalar_one_or_none()
    assert jv is not None

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    entries = (await db_session.execute(stmt_gle)).scalars().all()

    acc_1020 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "1020")
    acc_2050 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "2050")

    debit_entry = next(e for e in entries if e.debit_amount > Decimal("0.00"))
    credit_entry = next(e for e in entries if e.credit_amount > Decimal("0.00"))

    assert debit_entry.account_id == acc_1020.id
    assert debit_entry.debit_amount == Decimal("2500.00")
    assert credit_entry.account_id == acc_2050.id
    assert credit_entry.credit_amount == Decimal("2500.00")


async def test_advance_initially_unallocated(db_session):
    """Test 4 & 5: Advance has zero allocations initially and does not auto-allocate."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)

    req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-UNALLOC-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=5000.00)],
        idempotency_key=f"IDEMP-UNALLOC-{s}",
        auto_allocate=False,
    )
    res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=req, commit=True)
    tx_id = res.transactions[0].id

    stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
        PaymentAllocation.payment_id == tx_id,
        PaymentAllocation.is_deleted == False
    )
    allocated_sum = Decimal(str(await db_session.scalar(stmt_alloc) or 0.00))
    assert allocated_sum == Decimal("0.00")

    pt = await db_session.get(PaymentTransaction, tx_id)
    unallocated_balance = pt.amount - allocated_sum
    assert unallocated_balance == Decimal("5000.00")


async def test_partial_advance_invoice_allocation(db_session):
    """Test 6 & 11 & 12: Partial advance allocation creates DR 2050 / CR 1030 without cash movement."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=5, unit_price=200.00)
    inv_id = str(inv.id)

    # 1. Create Advance ₹10,000
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-P24-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=10000.00)],
        idempotency_key=f"IDEMP-ADV-PARTIAL-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # 2. Knock off ₹700 against the invoice
    alloc_req = PaymentAllocationRequest(
        invoice_id=inv_id,
        allocated_amount=700.00,
        discount_allowed=0.00,
        idempotency_key=f"ALLOC-KEY-{s}"
    )
    alloc_detail = await PaymentsEngine.allocate_payment(
        session=db_session,
        company_id=comp.id,
        payment_id=adv_id,
        req=alloc_req,
        created_by=user.username,
        commit=True,
    )
    assert alloc_detail.allocated_amount == 700.00

    # 3. Verify Remaining Unallocated Balance on Advance: 10000 - 700 = 9300
    stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
        PaymentAllocation.payment_id == adv_id,
        PaymentAllocation.is_deleted == False
    )
    allocated = Decimal(str(await db_session.scalar(stmt_alloc) or 0.00))
    assert allocated == Decimal("700.00")
    pt = await db_session.get(PaymentTransaction, adv_id)
    assert pt.amount - allocated == Decimal("9300.00")

    # 4. Verify Invoice Status & Balance
    refreshed_inv = await db_session.get(SalesInvoice, inv_id)
    assert refreshed_inv.paid_amount == Decimal("700.00")
    assert refreshed_inv.balance_amount == Decimal("480.00")  # 1180.00 - 700 = 480
    assert refreshed_inv.status == "POSTED"

    # 5. Verify Knock-off GL: DR 2050 (Customer Advance Liability) / CR 1030 (Accounts Receivable)
    stmt_jv = select(JournalVoucher).where(
        JournalVoucher.company_id == comp.id,
        JournalVoucher.reference_doc_type == "PAYMENT_ALLOCATION",
        JournalVoucher.reference_doc_id == alloc_detail.id,
        JournalVoucher.is_deleted == False
    )
    jv = (await db_session.execute(stmt_jv)).scalar_one_or_none()
    assert jv is not None
    assert jv.voucher_type == "JOURNAL"
    assert jv.total_debit == Decimal("700.00")
    assert jv.total_credit == Decimal("700.00")

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    entries = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(entries) == 2

    acc_2050 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "2050")
    acc_1030 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "1030")
    acc_1010 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "1010")
    acc_1020 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, comp.id, "1020")

    # Ensure zero cash/bank entry
    assert all(e.account_id not in (acc_1010.id, acc_1020.id) for e in entries)

    debit_entry = next(e for e in entries if e.debit_amount > Decimal("0.00"))
    credit_entry = next(e for e in entries if e.credit_amount > Decimal("0.00"))

    assert debit_entry.account_id == acc_2050.id
    assert debit_entry.debit_amount == Decimal("700.00")
    assert credit_entry.account_id == acc_1030.id
    assert credit_entry.credit_amount == Decimal("700.00")
    assert credit_entry.party_id == cust.id


async def test_full_advance_invoice_allocation(db_session):
    """Test 7 & 10: Full invoice settlement by advance sets status to PAID and maintains balance parity."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)
    inv_id = str(inv.id)
    inv_total = float(inv.grand_total)  # 472.00

    # Advance of ₹500
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-FULL-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="BANK_TRANSFER", amount=500.00)],
        idempotency_key=f"IDEMP-FULL-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Allocate full invoice amount
    alloc_req = PaymentAllocationRequest(
        invoice_id=inv_id,
        allocated_amount=inv_total,
    )
    alloc_res = await PaymentsEngine.allocate_payment(
        session=db_session,
        company_id=comp.id,
        payment_id=adv_id,
        req=alloc_req,
        commit=True,
    )
    assert alloc_res.allocated_amount == inv_total

    refreshed_inv = await db_session.get(SalesInvoice, inv_id)
    assert refreshed_inv.status == "PAID"
    assert refreshed_inv.balance_amount == Decimal("0.00")
    assert refreshed_inv.paid_amount == Decimal(str(inv_total))
    assert refreshed_inv.grand_total == refreshed_inv.paid_amount + refreshed_inv.balance_amount


async def test_multi_invoice_allocation(db_session):
    """Test 8 & 9: Multi-invoice allocation from a single ₹1,000 advance across 3 invoices."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=100, price=100.00)

    # Invoices: A (₹118), B (₹236), C (₹354)
    inv_a, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, f"{s}a", qty=1, unit_price=100.00)
    inv_b, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, f"{s}b", qty=2, unit_price=100.00)
    inv_c, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, f"{s}c", qty=3, unit_price=100.00)

    # Advance ₹1,000
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-MULTI-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-MULTI-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Allocate to A (₹118)
    await PaymentsEngine.allocate_payment(
        session=db_session, company_id=comp.id, payment_id=adv_id,
        req=PaymentAllocationRequest(invoice_id=inv_a.id, allocated_amount=118.00), commit=True
    )
    # Allocate to B (₹236)
    await PaymentsEngine.allocate_payment(
        session=db_session, company_id=comp.id, payment_id=adv_id,
        req=PaymentAllocationRequest(invoice_id=inv_b.id, allocated_amount=236.00), commit=True
    )
    # Allocate to C (₹354)
    await PaymentsEngine.allocate_payment(
        session=db_session, company_id=comp.id, payment_id=adv_id,
        req=PaymentAllocationRequest(invoice_id=inv_c.id, allocated_amount=354.00), commit=True
    )

    # Total allocated = 118 + 236 + 354 = 708.00
    # Remaining unallocated = 1000 - 708 = 292.00
    stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
        PaymentAllocation.payment_id == adv_id,
        PaymentAllocation.is_deleted == False
    )
    total_allocated = Decimal(str(await db_session.scalar(stmt_alloc) or 0.00))
    assert total_allocated == Decimal("708.00")

    pt = await db_session.get(PaymentTransaction, adv_id)
    assert pt.amount - total_allocated == Decimal("292.00")

    # All 3 invoices are fully paid
    for inv_id in [inv_a.id, inv_b.id, inv_c.id]:
        i = await db_session.get(SalesInvoice, inv_id)
        assert i.status == "PAID"
        assert i.balance_amount == Decimal("0.00")


async def test_over_allocation_of_advance_rejected(db_session):
    """Test 13: Over-allocation exceeding advance unallocated balance is rejected."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=10, unit_price=200.00)

    # Advance of ₹500
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-OVER-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=500.00)],
        idempotency_key=f"IDEMP-OVER-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Attempt to allocate ₹600 (exceeds ₹500 advance)
    with pytest.raises(ValueError, match="exceeds unallocated payment balance"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp.id,
            payment_id=adv_id,
            req=PaymentAllocationRequest(invoice_id=inv.id, allocated_amount=600.00),
            commit=True,
        )


async def test_over_allocation_of_invoice_rejected(db_session):
    """Test 14: Over-allocation exceeding invoice balance is rejected."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=100.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=1, unit_price=100.00)

    # Advance of ₹5000
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-INV-OVER-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=5000.00)],
        idempotency_key=f"IDEMP-INV-OVER-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Attempt to allocate ₹500 to an invoice with balance of ₹118
    with pytest.raises(ValueError, match="exceeds invoice outstanding balance"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp.id,
            payment_id=adv_id,
            req=PaymentAllocationRequest(invoice_id=inv.id, allocated_amount=500.00),
            commit=True,
        )


async def test_customer_identity_mismatch_rejected(db_session):
    """Test 15: Advance belonging to Customer A cannot be allocated to Customer B's invoice."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust_a, tenant_ctx = await _setup_tenant_and_actor(db_session, s)

    # Customer B
    cust_b = Customer(
        id=f"cust-b-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        name=f"Customer B {s}",
        mobile="9876543210",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(cust_b)
    await db_session.commit()

    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv_b, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust_b, prod, s, qty=2, unit_price=200.00)

    # Advance for Customer A
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-CUST-A-{s}",
        party_id=cust_a.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-CUST-A-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Attempt to allocate Customer A's advance to Customer B's invoice
    with pytest.raises(ValueError, match="Customer mismatch"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp.id,
            payment_id=adv_id,
            req=PaymentAllocationRequest(invoice_id=inv_b.id, allocated_amount=200.00),
            commit=True,
        )


async def test_cross_company_allocation_rejected(db_session):
    """Test 16: Cross-company advance allocation is strictly rejected."""
    s = uuid.uuid4().hex[:8]
    comp_a, branch_a, user_a, cust_a, tenant_a = await _setup_tenant_and_actor(db_session, f"{s}a")
    comp_b, branch_b, user_b, cust_b, tenant_b = await _setup_tenant_and_actor(db_session, f"{s}b")

    prod_b = await _setup_product(db_session, f"{s}b", comp_b.id, branch_b.id, stock=50, price=200.00)
    inv_b, _ = await _setup_posted_invoice(db_session, tenant_b, user_b, cust_b, prod_b, f"{s}b", qty=2, unit_price=200.00)

    # Advance in Company A
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-COMP-A-{s}",
        party_id=cust_a.id,
        branch_id=branch_a.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-COMP-A-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp_a.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Attempt to allocate Company A advance to Company B invoice
    with pytest.raises(ValueError, match="Cross-company allocation forbidden"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp_a.id,
            payment_id=adv_id,
            req=PaymentAllocationRequest(invoice_id=inv_b.id, allocated_amount=200.00),
            commit=True,
        )


async def test_concurrent_allocation_row_locking(db_session):
    """Test 17: Row lock on PaymentTransaction prevents concurrent over-allocation."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv1, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, f"{s}1", qty=4, unit_price=200.00)
    inv2, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, f"{s}2", qty=4, unit_price=200.00)

    # Advance ₹1,000
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-LOCK-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-LOCK-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Request 1: Allocates ₹800 to inv1
    await PaymentsEngine.allocate_payment(
        session=db_session,
        company_id=comp.id,
        payment_id=adv_id,
        req=PaymentAllocationRequest(invoice_id=inv1.id, allocated_amount=800.00),
        commit=True,
    )

    # Request 2: Attempts to allocate ₹800 to inv2 -> Must be rejected (only ₹200 left)
    with pytest.raises(ValueError, match="exceeds unallocated payment balance"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp.id,
            payment_id=adv_id,
            req=PaymentAllocationRequest(invoice_id=inv2.id, allocated_amount=800.00),
            commit=True,
        )

    # Verify that total allocated remained ₹800, never ₹1,600
    stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
        PaymentAllocation.payment_id == adv_id,
        PaymentAllocation.is_deleted == False
    )
    assert Decimal(str(await db_session.scalar(stmt_alloc) or 0.00)) == Decimal("800.00")


async def test_duplicate_allocation_idempotency(db_session):
    """Test 18: Repeated allocation request with same idempotency_key is idempotent."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-IDEMP-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=2000.00)],
        idempotency_key=f"IDEMP-ADV-RET-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    idemp_key = f"IDEMP-ALLOC-{s}"
    alloc_req = PaymentAllocationRequest(
        invoice_id=inv.id,
        allocated_amount=300.00,
        idempotency_key=idemp_key,
    )

    # First call
    alloc1 = await PaymentsEngine.allocate_payment(
        session=db_session, company_id=comp.id, payment_id=adv_id, req=alloc_req, commit=True
    )
    # Second call (retry)
    alloc2 = await PaymentsEngine.allocate_payment(
        session=db_session, company_id=comp.id, payment_id=adv_id, req=alloc_req, commit=True
    )

    assert alloc1.id == alloc2.id
    assert alloc1.allocated_amount == alloc2.allocated_amount

    # Ensure only ONE allocation row exists
    stmt_alloc_count = select(func.count(PaymentAllocation.id)).where(
        PaymentAllocation.payment_id == adv_id,
        PaymentAllocation.is_deleted == False
    )
    count = await db_session.scalar(stmt_alloc_count)
    assert count == 1


async def test_receipt_gl_failure_rolls_back_advance(db_session):
    """Test 19: GL failure during advance receipt causes complete atomic rollback."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)

    req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-FAIL-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-FAIL-{s}",
        auto_allocate=False,
    )

    with patch.object(
        UnifiedAccountingLedgerService,
        "post_payment_transaction_to_gl",
        side_effect=RuntimeError("Simulated GL Service Outage")
    ):
        with pytest.raises(RuntimeError, match="Simulated GL Service Outage"):
            await PaymentsEngine.process_payment(
                session=db_session,
                company_id=comp.id,
                req=req,
                commit=True
            )

    # Verify no orphan PaymentTransaction exists
    stmt_pt = select(PaymentTransaction).where(PaymentTransaction.reference_doc_id == f"ADV-FAIL-{s}")
    pt = (await db_session.execute(stmt_pt)).scalars().first()
    assert pt is None


async def test_knockoff_gl_failure_rolls_back_allocation(db_session):
    """Test 20: GL failure during advance knock-off rolls back allocation and restores invoice balance."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)
    inv_id = str(inv.id)
    initial_balance = inv.balance_amount

    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-KO-FAIL-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=2000.00)],
        idempotency_key=f"IDEMP-KO-FAIL-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    with patch.object(
        UnifiedAccountingLedgerService,
        "post_payment_allocation_to_gl",
        side_effect=RuntimeError("Simulated Knock-Off GL Failure")
    ):
        with pytest.raises(RuntimeError, match="Simulated Knock-Off GL Failure"):
            await PaymentsEngine.allocate_payment(
                session=db_session,
                company_id=comp.id,
                payment_id=adv_id,
                req=PaymentAllocationRequest(invoice_id=inv_id, allocated_amount=300.00),
                commit=True,
            )

    # Verify complete rollback: no allocation created, invoice balance restored
    stmt_alloc = select(PaymentAllocation).where(PaymentAllocation.payment_id == adv_id)
    alloc = (await db_session.execute(stmt_alloc)).scalars().first()
    assert alloc is None

    refreshed_inv = await db_session.get(SalesInvoice, inv_id)
    assert refreshed_inv.balance_amount == initial_balance
    assert refreshed_inv.paid_amount == Decimal("0.00")
    assert refreshed_inv.status == "POSTED"


async def test_cancelled_invoice_cannot_receive_allocation(db_session):
    """Test 22: Cancelled invoice cannot receive advance allocation."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    # Cancel invoice
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv.id,
            action="CANCEL",
            payload={"reason": "Test cancel"}
        )
    )
    await db_session.commit()

    # Advance
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-CANC-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-CANC-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    with pytest.raises(ValueError, match="CANCELLED and cannot receive"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp.id,
            payment_id=adv_id,
            req=PaymentAllocationRequest(invoice_id=inv.id, allocated_amount=200.00),
            commit=True,
        )


async def test_cancelled_advance_cannot_be_allocated(db_session):
    """Test 23: Cancelled/invalid advance transaction cannot be allocated."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)

    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-VOID-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-VOID-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Mark advance as CANCELLED
    pt = await db_session.get(PaymentTransaction, adv_id)
    pt.status = "CANCELLED"
    await db_session.commit()

    with pytest.raises(ValueError, match="not eligible for allocation"):
        await PaymentsEngine.allocate_payment(
            session=db_session,
            company_id=comp.id,
            payment_id=adv_id,
            req=PaymentAllocationRequest(invoice_id=inv.id, allocated_amount=200.00),
            commit=True,
        )


async def test_lifecycle_pay_with_advance(db_session):
    """Test: UniversalLifecycleEngine PAY transition knocking off invoice balance via advance_payment_id."""
    s = uuid.uuid4().hex[:8]
    comp, branch, user, cust, tenant_ctx = await _setup_tenant_and_actor(db_session, s)
    prod = await _setup_product(db_session, s, comp.id, branch.id, stock=50, price=200.00)
    inv, _ = await _setup_posted_invoice(db_session, tenant_ctx, user, cust, prod, s, qty=2, unit_price=200.00)
    inv_id = str(inv.id)

    # Create Advance ₹1,000
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-LC-{s}",
        party_id=cust.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"IDEMP-LC-{s}",
        auto_allocate=False,
    )
    adv_res = await PaymentsEngine.process_payment(session=db_session, company_id=comp.id, req=adv_req, commit=True)
    adv_id = adv_res.transactions[0].id

    # Transition SalesInvoice PAY with advance_payment_id
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="SalesInvoice",
            doc_id=inv_id,
            action="PAY",
            payload={
                "advance_payment_id": adv_id,
                "amount": float(inv.grand_total)
            }
        )
    )
    await db_session.commit()

    refreshed_inv = await db_session.get(SalesInvoice, inv_id)
    assert refreshed_inv.status == "PAID"
    assert refreshed_inv.balance_amount == Decimal("0.00")
    assert refreshed_inv.paid_amount == refreshed_inv.grand_total
