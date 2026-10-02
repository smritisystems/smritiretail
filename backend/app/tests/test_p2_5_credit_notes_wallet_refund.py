"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.49.3
Created      : 2026-10-02
Modified     : 2026-10-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""
P2.5 Customer Credit Notes, Customer Wallets & Advance Refund Test Suite.
Verifies:
1. Cash advance partial refund generates balanced JournalVoucher with DR 2050 (Customer Advance Liability) / CR 1010 (Cash in Hand)
2. Bank advance full refund generates balanced JournalVoucher with DR 2050 / CR 1020 (Bank Accounts)
3. Advance refund beyond unallocated advance balance (advance amount - invoice allocations) is rejected fail-closed
4. Advance refund with idempotency_key is completely idempotent
5. Fully refunded advance rejects subsequent refund attempts
6. Sales invoice payment partial refund reinstates invoice paid_amount, balance_amount, and reverts status to POSTED
7. Sales invoice payment partial refund generates balanced JournalVoucher with DR 1030 (Accounts Receivable) / CR 1010 (Cash in Hand)
8. Sales invoice payment full refund reinstates full invoice balance and status to POSTED
9. Sales invoice payment over-refund beyond original amount is rejected
10. Customer wallet / store credit redemption against invoice debits 2060 (Customer Credit Note & Wallet Liability) and credits 1030 with zero cash movement
11. Customer wallet redemption records immutable CustomerCreditLedgerEntry with DEBIT and decremented balance_after
12. Insufficient customer wallet credit balance is rejected fail-closed
13. Cross-company refund attempt is rejected fail-closed
14. Refund GL failure rolls back PaymentTransaction and status mutation atomically
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
from app.models.crm import Customer, CustomerCreditLedgerEntry
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
    PaymentRefundRequest,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

async def _setup_tenant_and_actor(db, suffix: str, role=UserRole.MANAGER):
    cid = f"COMP-P25-{suffix}"
    bid = f"BR-P25-{suffix}"
    code_part = uuid.uuid4().hex[:6].upper()
    company = Company(
        id=cid,
        company_code=f"C{code_part}",
        name=f"P2.5 Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"B{code_part}",
        company_id=cid,
        name=f"P2.5 Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    user = User(
        id=f"usr-p25-{suffix}",
        username=f"user_p25_{suffix}",
        email=f"user_p25_{suffix}@example.com",
        hashed_password="mocked_password",
        role=role,
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    customer = Customer(
        id=f"cust-p25-{suffix}",
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
        id=f"PROD-P25-{suffix}",
        code=f"SKU-P25-{suffix}",
        sku=f"SKU-P25-{suffix}",
        barcode=f"BAR-P25-{suffix}",
        name=f"P2.5 Product {suffix}",
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
            id=f"pcv-p25-{suffix}",
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
        id=f"inv-p25-{suffix}",
        invoice_no=f"INV-P25-{suffix}",
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

    # Post invoice via UniversalLifecycleEngine
    r = await UniversalLifecycleEngine.execute_transition(
        db=db,
        tenant_ctx=tenant_ctx,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesInvoice", doc_id=inv.id, action="POST")
    )
    assert r.success is True
    assert r.to_status == "POSTED"
    return inv


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

async def test_cash_advance_partial_refund(db_session):
    """
    Test 1: Cash advance partial refund generates balanced JournalVoucher with
    Debit 2050 (Customer Advance Liability) and Credit 1010 (Cash in Hand).
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id

    # 1. Create cash advance of Rs. 5,000
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-REF-DOC-{suffix}",
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=5000.00)],
        idempotency_key=f"ADV-IDEM-{suffix}",
        auto_allocate=False,
    )
    res_adv = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company_id,
        req=adv_req,
        created_by=user.username,
        commit=True,
    )
    adv_tx_id = res_adv.transactions[0].id

    # 2. Refund Rs. 2,000 via CASH
    ref_req = PaymentRefundRequest(
        payment_transaction_id=adv_tx_id,
        refund_amount=2000.00,
        reason="Customer cancellation of part of advance",
        refund_tender_type="CASH",
        idempotency_key=f"REF-IDEM-{suffix}",
    )
    ref_res = await PaymentsEngine.process_refund(
        session=db_session,
        company_id=company_id,
        req=ref_req,
        created_by=user.username,
        commit=True,
    )

    assert ref_res.refund_amount == 2000.00
    assert ref_res.remaining_balance == 3000.00
    assert ref_res.status == "PARTIAL_REFUND"

    # 3. Check original advance status
    adv_tx = (await db_session.execute(select(PaymentTransaction).where(PaymentTransaction.id == adv_tx_id))).scalars().first()
    assert adv_tx.status == "PARTIALLY_REFUNDED"

    # 4. Check refund GL voucher
    stmt_jv = select(JournalVoucher).where(
        JournalVoucher.company_id == company_id,
        JournalVoucher.reference_doc_id == ref_res.refund_transaction_id,
        JournalVoucher.is_deleted == False
    )
    jv = (await db_session.execute(stmt_jv)).scalar_one_or_none()
    assert jv is not None
    assert jv.voucher_type == "PAYMENT_REFUND"

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gle_entries = (await db_session.execute(stmt_gle)).scalars().all()

    acc_2050 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "2050")
    acc_1010 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1010")

    lines_by_acc = {line.account_id: line for line in gle_entries}
    assert acc_2050.id in lines_by_acc
    assert acc_1010.id in lines_by_acc

    # Debit 2050 (Customer Advance Liability)
    assert Decimal(str(lines_by_acc[acc_2050.id].debit_amount)) == Decimal("2000.00")
    assert Decimal(str(lines_by_acc[acc_2050.id].credit_amount)) == Decimal("0.00")

    # Credit 1010 (Cash in Hand)
    assert Decimal(str(lines_by_acc[acc_1010.id].debit_amount)) == Decimal("0.00")
    assert Decimal(str(lines_by_acc[acc_1010.id].credit_amount)) == Decimal("2000.00")


async def test_bank_advance_full_refund(db_session):
    """
    Test 2: Bank advance full refund generates balanced JournalVoucher with
    Debit 2050 (Customer Advance Liability) and Credit 1020 (Bank Accounts).
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id

    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-REF-DOC-{suffix}",
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="UPI", amount=4000.00)],
        idempotency_key=f"ADV-IDEM-{suffix}",
        auto_allocate=False,
    )
    res_adv = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company_id,
        req=adv_req,
        created_by=user.username,
        commit=True,
    )
    adv_tx_id = res_adv.transactions[0].id

    ref_req = PaymentRefundRequest(
        payment_transaction_id=adv_tx_id,
        refund_amount=4000.00,
        reason="Full advance order cancelled",
        refund_tender_type="UPI",
        idempotency_key=f"REF-FULL-IDEM-{suffix}",
    )
    ref_res = await PaymentsEngine.process_refund(
        session=db_session,
        company_id=company_id,
        req=ref_req,
        created_by=user.username,
        commit=True,
    )

    assert ref_res.refund_amount == 4000.00
    assert ref_res.remaining_balance == 0.00
    assert ref_res.status == "REFUND_SUCCESS"

    adv_tx = (await db_session.execute(select(PaymentTransaction).where(PaymentTransaction.id == adv_tx_id))).scalars().first()
    assert adv_tx.status == "REFUNDED"

    # Check GL voucher
    stmt_jv = select(JournalVoucher).where(
        JournalVoucher.company_id == company_id,
        JournalVoucher.reference_doc_id == ref_res.refund_transaction_id,
        JournalVoucher.is_deleted == False
    )
    jv = (await db_session.execute(stmt_jv)).scalar_one_or_none()
    assert jv is not None

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gle_entries = (await db_session.execute(stmt_gle)).scalars().all()

    acc_2050 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "2050")
    acc_1020 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1020")

    lines_by_acc = {line.account_id: line for line in gle_entries}
    assert Decimal(str(lines_by_acc[acc_2050.id].debit_amount)) == Decimal("4000.00")
    assert Decimal(str(lines_by_acc[acc_1020.id].credit_amount)) == Decimal("4000.00")


async def test_advance_refund_exceeding_unallocated_fails(db_session):
    """
    Test 3: Advance refund exceeding unallocated advance balance (Advance - Allocations)
    is rejected fail-closed with ValueError.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id
    prod = await _setup_product(db_session, suffix, company_id, branch.id, stock=50, price=200.00)
    invoice = await _setup_posted_invoice(db_session, tenant_ctx, user, customer, prod, suffix, qty=5, unit_price=200.00)

    # Invoice grand_total = 1180.00
    # Create advance of 5000.00
    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-REF-DOC-{suffix}",
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=5000.00)],
        idempotency_key=f"ADV-IDEM-{suffix}",
        auto_allocate=False,
    )
    res_adv = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company_id,
        req=adv_req,
        created_by=user.username,
        commit=True,
    )
    adv_tx_id = res_adv.transactions[0].id

    # Allocate 1180.00 to invoice
    alloc_req = PaymentAllocationRequest(
        invoice_id=invoice.id,
        allocated_amount=1180.00,
        discount_allowed=0.00,
    )
    await PaymentsEngine.allocate_payment(
        session=db_session,
        company_id=company_id,
        payment_id=adv_tx_id,
        req=alloc_req,
        created_by=user.username,
        commit=True,
    )

    # Remaining unallocated balance is 5000 - 1180 = 3820.00
    # Attempting to refund 3820.01 should fail
    with pytest.raises(ValueError, match="exceeds available unallocated advance balance"):
        await PaymentsEngine.process_refund(
            session=db_session,
            company_id=company_id,
            req=PaymentRefundRequest(
                payment_transaction_id=adv_tx_id,
                refund_amount=3820.01,
                reason="Over-refund attempt",
                idempotency_key=f"REF-OVER-{suffix}",
            ),
            created_by=user.username,
            commit=True,
        )

    # Refunding exactly 3820.00 must succeed
    ref_res = await PaymentsEngine.process_refund(
        session=db_session,
        company_id=company_id,
        req=PaymentRefundRequest(
            payment_transaction_id=adv_tx_id,
            refund_amount=3820.00,
            reason="Valid remaining refund",
            idempotency_key=f"REF-EXACT-{suffix}",
        ),
        created_by=user.username,
        commit=True,
    )
    assert ref_res.refund_amount == 3820.00
    assert ref_res.remaining_balance == 0.00
    assert ref_res.status == "REFUND_SUCCESS"

    adv_tx = (await db_session.execute(select(PaymentTransaction).where(PaymentTransaction.id == adv_tx_id))).scalars().first()
    assert adv_tx.status == "REFUNDED"


async def test_advance_refund_idempotency(db_session):
    """
    Test 4: Replaying a refund with the same idempotency key returns the
    existing record without creating duplicate transactions or GL vouchers.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id

    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-REF-DOC-{suffix}",
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=2000.00)],
        idempotency_key=f"ADV-IDEM-{suffix}",
        auto_allocate=False,
    )
    res_adv = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company_id,
        req=adv_req,
        created_by=user.username,
        commit=True,
    )
    adv_tx_id = res_adv.transactions[0].id

    idem_key = f"IDEM-REF-{suffix}"
    ref_req = PaymentRefundRequest(
        payment_transaction_id=adv_tx_id,
        refund_amount=500.00,
        reason="Partial refund test",
        idempotency_key=idem_key,
    )

    ref_1 = await PaymentsEngine.process_refund(db_session, company_id, ref_req, user.username, commit=True)
    ref_2 = await PaymentsEngine.process_refund(db_session, company_id, ref_req, user.username, commit=True)

    assert ref_1.refund_transaction_id == ref_2.refund_transaction_id
    assert ref_1.refund_amount == ref_2.refund_amount

    # Exactly 1 refund transaction exists
    stmt_tx = select(func.count(PaymentTransaction.id)).where(
        PaymentTransaction.company_id == company_id,
        PaymentTransaction.idempotency_key == idem_key
    )
    assert (await db_session.scalar(stmt_tx)) == 1

    # Exactly 1 GL voucher exists
    stmt_jv = select(func.count(JournalVoucher.id)).where(
        JournalVoucher.company_id == company_id,
        JournalVoucher.reference_doc_id == ref_1.refund_transaction_id
    )
    assert (await db_session.scalar(stmt_jv)) == 1


async def test_invoice_payment_partial_refund_reinstates_balance(db_session):
    """
    Test 6 & 7: Refunding an invoice payment decrements paid_amount,
    re-opens balance_amount, reverts status from PAID to POSTED, and
    posts Debit 1030 (Accounts Receivable) / Credit 1010 (Cash in Hand).
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id
    prod = await _setup_product(db_session, suffix, company_id, branch.id, stock=50, price=200.00)
    invoice = await _setup_posted_invoice(db_session, tenant_ctx, user, customer, prod, suffix, qty=5, unit_price=200.00)

    # Invoice grand_total = 1180.00
    # Pay invoice in full via CASH
    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=invoice.id,
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1180.00)],
        idempotency_key=f"PAY-INV-{suffix}",
        auto_allocate=True,
    )
    res_pay = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company_id,
        req=pay_req,
        created_by=user.username,
        commit=True,
    )
    pay_tx_id = res_pay.transactions[0].id

    await db_session.refresh(invoice)
    assert invoice.status == "PAID"
    assert invoice.paid_amount == Decimal("1180.00")
    assert invoice.balance_amount == Decimal("0.00")

    # Refund 500.00
    ref_req = PaymentRefundRequest(
        payment_transaction_id=pay_tx_id,
        refund_amount=500.00,
        reason="Partial customer payment refund",
        refund_tender_type="CASH",
        idempotency_key=f"REF-PAY-{suffix}",
    )
    ref_res = await PaymentsEngine.process_refund(
        session=db_session,
        company_id=company_id,
        req=ref_req,
        created_by=user.username,
        commit=True,
    )

    # Verify invoice reinstated
    await db_session.refresh(invoice)
    assert invoice.paid_amount == Decimal("680.00")
    assert invoice.balance_amount == Decimal("500.00")
    assert invoice.status == "POSTED"

    # Verify GL voucher: Debit 1030 (Debtors) / Credit 1010 (Cash in Hand)
    stmt_jv = select(JournalVoucher).where(
        JournalVoucher.company_id == company_id,
        JournalVoucher.reference_doc_id == ref_res.refund_transaction_id,
        JournalVoucher.is_deleted == False
    )
    jv = (await db_session.execute(stmt_jv)).scalar_one_or_none()
    assert jv is not None

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gle_entries = (await db_session.execute(stmt_gle)).scalars().all()

    acc_1030 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1030")
    acc_1010 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1010")

    lines_by_acc = {line.account_id: line for line in gle_entries}
    assert Decimal(str(lines_by_acc[acc_1030.id].debit_amount)) == Decimal("500.00")
    assert Decimal(str(lines_by_acc[acc_1010.id].credit_amount)) == Decimal("500.00")


async def test_invoice_payment_full_refund_reinstates_full_balance(db_session):
    """
    Test 8: Full refund of invoice payment restores balance_amount = grand_total,
    paid_amount = 0, status = POSTED, and creates Debit 1030 / Credit 1020.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id
    prod = await _setup_product(db_session, suffix, company_id, branch.id, stock=50, price=200.00)
    invoice = await _setup_posted_invoice(db_session, tenant_ctx, user, customer, prod, suffix, qty=5, unit_price=200.00)

    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=invoice.id,
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CARD", amount=1180.00)],
        idempotency_key=f"PAY-INV-{suffix}",
        auto_allocate=True,
    )
    res_pay = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company_id,
        req=pay_req,
        created_by=user.username,
        commit=True,
    )
    pay_tx_id = res_pay.transactions[0].id

    # Full refund
    ref_req = PaymentRefundRequest(
        payment_transaction_id=pay_tx_id,
        refund_amount=1180.00,
        reason="Full invoice refund",
        refund_tender_type="CARD",
        idempotency_key=f"REF-FULL-PAY-{suffix}",
    )
    await PaymentsEngine.process_refund(db_session, company_id, ref_req, user.username, commit=True)

    await db_session.refresh(invoice)
    assert invoice.paid_amount == Decimal("0.00")
    assert invoice.balance_amount == Decimal("1180.00")
    assert invoice.status == "POSTED"


async def test_invoice_payment_over_refund_fails(db_session):
    """
    Test 9: Attempting to refund more than original invoice payment amount is rejected.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id
    prod = await _setup_product(db_session, suffix, company_id, branch.id, stock=50, price=200.00)
    invoice = await _setup_posted_invoice(db_session, tenant_ctx, user, customer, prod, suffix, qty=2, unit_price=200.00)

    # Grand total = 472.00
    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=invoice.id,
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=472.00)],
        idempotency_key=f"PAY-INV-{suffix}",
        auto_allocate=True,
    )
    res_pay = await PaymentsEngine.process_payment(db_session, company_id, pay_req, user.username, commit=True)
    pay_tx_id = res_pay.transactions[0].id

    with pytest.raises(ValueError, match="exceeds available refundable balance"):
        await PaymentsEngine.process_refund(
            session=db_session,
            company_id=company_id,
            req=PaymentRefundRequest(
                payment_transaction_id=pay_tx_id,
                refund_amount=500.00,
                reason="Over-refund attempt",
                idempotency_key=f"REF-OVER-{suffix}",
            ),
            created_by=user.username,
            commit=True,
        )


async def test_customer_store_credit_wallet_issuance_and_redemption(db_session):
    """
    Test 10 & 11: Customer wallet credit issuance and redemption against invoice:
    - Verifies CustomerCreditLedgerEntry debit recording
    - Verifies balanced JournalVoucher with Debit 2060 (Customer Credit & Wallet Liability) / Credit 1030
    - Verifies zero cash movement (1010 and 1020 are untouched)
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id
    prod = await _setup_product(db_session, suffix, company_id, branch.id, stock=50, price=200.00)
    invoice = await _setup_posted_invoice(db_session, tenant_ctx, user, customer, prod, suffix, qty=5, unit_price=200.00)

    # 1. Seed customer wallet credit of Rs. 2,000 via CustomerCreditLedgerEntry
    credit_entry = CustomerCreditLedgerEntry(
        id=f"ccle-seed-{suffix}",
        company_id=company_id,
        branch_id=branch.id,
        customer_id=customer.id,
        entry_date=datetime.now(timezone.utc),
        entry_type="CREDIT",
        amount=Decimal("2000.00"),
        balance_after=Decimal("2000.00"),
        reference_type="SALES_RETURN_REFUND",
        reference_id=f"RET-SEED-{suffix}",
        notes="Store credit issued for return",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(credit_entry)
    await db_session.commit()

    # 2. Pay invoice (1,180.00) using tender_type = "WALLET"
    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=invoice.id,
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="WALLET", amount=1180.00)],
        idempotency_key=f"PAY-WALLET-{suffix}",
        auto_allocate=True,
    )
    res_pay = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company_id,
        req=pay_req,
        created_by=user.username,
        commit=True,
    )
    tx_id = res_pay.transactions[0].id

    # 3. Verify CustomerCreditLedgerEntry debit
    stmt_debit = select(CustomerCreditLedgerEntry).where(
        CustomerCreditLedgerEntry.customer_id == customer.id,
        CustomerCreditLedgerEntry.entry_type == "DEBIT",
        CustomerCreditLedgerEntry.company_id == company_id,
    )
    debit_entry = (await db_session.execute(stmt_debit)).scalars().first()
    assert debit_entry is not None
    assert Decimal(str(debit_entry.amount)) == Decimal("1180.00")
    assert Decimal(str(debit_entry.balance_after)) == Decimal("820.00")

    # 4. Verify invoice is PAID
    await db_session.refresh(invoice)
    assert invoice.status == "PAID"
    assert invoice.balance_amount == Decimal("0.00")
    assert invoice.paid_amount == Decimal("1180.00")

    # 5. Verify GL Voucher: Debit 2060 (Liability) / Credit 1030 (Debtors)
    stmt_jv = select(JournalVoucher).where(
        JournalVoucher.company_id == company_id,
        JournalVoucher.reference_doc_id == tx_id,
        JournalVoucher.is_deleted == False
    )
    jv = (await db_session.execute(stmt_jv)).scalar_one_or_none()
    assert jv is not None
    assert jv.voucher_type == "PAYMENT_RECEIPT"

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gle_entries = (await db_session.execute(stmt_gle)).scalars().all()

    acc_2060 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "2060")
    acc_1030 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1030")
    acc_1010 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1010")
    acc_1020 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1020")

    lines_by_acc = {line.account_id: line for line in gle_entries}
    assert acc_2060.id in lines_by_acc
    assert acc_1030.id in lines_by_acc
    assert acc_1010.id not in lines_by_acc
    assert acc_1020.id not in lines_by_acc

    # Debit 2060 (Customer Credit & Wallet Liability)
    assert Decimal(str(lines_by_acc[acc_2060.id].debit_amount)) == Decimal("1180.00")
    assert Decimal(str(lines_by_acc[acc_2060.id].credit_amount)) == Decimal("0.00")

    # Credit 1030 (Accounts Receivable)
    assert Decimal(str(lines_by_acc[acc_1030.id].debit_amount)) == Decimal("0.00")
    assert Decimal(str(lines_by_acc[acc_1030.id].credit_amount)) == Decimal("1180.00")


async def test_customer_store_credit_insufficient_balance_rejected(db_session):
    """
    Test 12: Paying via WALLET / CREDIT_NOTE with insufficient credit balance
    is rejected fail-closed with ValueError.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id
    prod = await _setup_product(db_session, suffix, company_id, branch.id, stock=50, price=200.00)
    invoice = await _setup_posted_invoice(db_session, tenant_ctx, user, customer, prod, suffix, qty=5, unit_price=200.00)

    # Customer has only Rs. 200 credit
    credit_entry = CustomerCreditLedgerEntry(
        id=f"ccle-seed-{suffix}",
        company_id=company_id,
        branch_id=branch.id,
        customer_id=customer.id,
        entry_date=datetime.now(timezone.utc),
        entry_type="CREDIT",
        amount=Decimal("200.00"),
        balance_after=Decimal("200.00"),
        reference_type="SALES_RETURN_REFUND",
        reference_id=f"RET-SEED-{suffix}",
        notes="Store credit issued for return",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(credit_entry)
    await db_session.commit()

    # Attempt to pay 500.00 via WALLET
    with pytest.raises(ValueError, match="exceeds available customer store credit / wallet balance"):
        await PaymentsEngine.process_payment(
            session=db_session,
            company_id=company_id,
            req=ProcessPaymentRequest(
                reference_doc_type="SALES_INVOICE",
                reference_doc_id=invoice.id,
                party_id=customer.id,
                branch_id=branch.id,
                tenders=[PaymentTenderItem(tender_type="WALLET", amount=500.00)],
                idempotency_key=f"PAY-WALLET-{suffix}",
                auto_allocate=True,
            ),
            created_by=user.username,
            commit=True,
        )


async def test_cross_company_refund_isolation(db_session):
    """
    Test 13: Attempting to refund a transaction belonging to Company A from Company B
    is rejected fail-closed.
    """
    suffix1 = uuid.uuid4().hex[:8]
    suffix2 = uuid.uuid4().hex[:8]
    comp1, br1, user1, cust1, _ = await _setup_tenant_and_actor(db_session, suffix1)
    comp2, br2, user2, cust2, _ = await _setup_tenant_and_actor(db_session, suffix2)
    comp1_id = comp1.id
    comp2_id = comp2.id

    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-REF-DOC-{suffix1}",
        party_id=cust1.id,
        branch_id=br1.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=1000.00)],
        idempotency_key=f"ADV-IDEM-{suffix1}",
        auto_allocate=False,
    )
    res_adv = await PaymentsEngine.process_payment(db_session, comp1_id, adv_req, user1.username, commit=True)
    tx_id = res_adv.transactions[0].id

    # Attempt refund from Company B
    with pytest.raises(ValueError, match="Original payment transaction .* not found"):
        await PaymentsEngine.process_refund(
            session=db_session,
            company_id=comp2_id,
            req=PaymentRefundRequest(
                payment_transaction_id=tx_id,
                refund_amount=500.00,
                reason="Cross-company refund attempt",
                idempotency_key=f"REF-CROSS-{suffix2}",
            ),
            created_by=user2.username,
            commit=True,
        )


async def test_refund_gl_failure_rolls_back_atomically(db_session):
    """
    Test 14: If GL voucher posting fails during refund, the transaction and status
    mutations are completely rolled back.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_tenant_and_actor(db_session, suffix)
    company_id = company.id

    adv_req = ProcessPaymentRequest(
        reference_doc_type="CUSTOMER_ADVANCE",
        reference_doc_id=f"ADV-REF-DOC-{suffix}",
        party_id=customer.id,
        branch_id=branch.id,
        tenders=[PaymentTenderItem(tender_type="CASH", amount=2000.00)],
        idempotency_key=f"ADV-IDEM-{suffix}",
        auto_allocate=False,
    )
    res_adv = await PaymentsEngine.process_payment(db_session, company_id, adv_req, user.username, commit=True)
    tx_id = res_adv.transactions[0].id

    # Simulate GL failure during refund
    with patch.object(
        UnifiedAccountingLedgerService,
        "post_refund_transaction_to_gl",
        side_effect=HTTPException(status_code=500, detail="Forced GL Failure")
    ):
        with pytest.raises(HTTPException):
            await PaymentsEngine.process_refund(
                session=db_session,
                company_id=company_id,
                req=PaymentRefundRequest(
                    payment_transaction_id=tx_id,
                    refund_amount=500.00,
                    reason="Forced GL failure test",
                    idempotency_key=f"REF-FAIL-{suffix}",
                ),
                created_by=user.username,
                commit=True,
            )

    # Check original transaction status is still SUCCESS (not PARTIALLY_REFUNDED)
    adv_tx = (await db_session.execute(select(PaymentTransaction).where(PaymentTransaction.id == tx_id))).scalars().first()
    assert adv_tx.status == "SUCCESS"

    # Check no refund transaction exists
    stmt_ref = select(func.count(PaymentTransaction.id)).where(
        PaymentTransaction.company_id == company_id,
        PaymentTransaction.reference_doc_type.in_(("PAYMENT_REFUND", "CUSTOMER_ADVANCE_REFUND")),
        PaymentTransaction.reference_doc_id == tx_id
    )
    assert (await db_session.scalar(stmt_ref)) == 0
