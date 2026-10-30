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

* Version    : 6.49.5
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.3 — Supplier Payment General Ledger Integration & Purchase Bill Knock-off
Verifies:
  1. Cash payment generates balanced GL voucher (DR 2010 / CR 1010)
  2. Bank/UPI payment generates balanced GL voucher (DR 2010 / CR 1020)
  3. Direct bill knock-off full settlement (bill status transitions to PAID)
  4. Direct bill knock-off partial settlement (bill remains POSTED with incremented paid_amount)
  5. Multi-bill explicit allocations across multiple purchase bills
  6. Automatic FIFO knock-off across open POSTED bills
  7. Overpayment rejection guard against outstanding balance
  8. Payment cancellation reverses GL, restores supplier outstanding, and reverts bill status
  9. Idempotent GL voucher posting and cancellation safety
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select
from fastapi import HTTPException

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.purchase import Supplier, PurchaseBill
from app.models.supplier_payment import SupplierPayment
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.api.deps import TenantContext
from app.schemas.supplier_payment import SupplierPaymentCreate, SupplierBillAllocation
from app.services.supplier_payment import SupplierPaymentService
from app.services.unified_ledger import UnifiedAccountingLedgerService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

async def setup_test_tenant(db, role=UserRole.MANAGER):
    s = uuid.uuid4().hex[:6]
    cid = f"CMP{s.upper()}"
    bid = f"BR{s.upper()}"
    company = Company(
        id=cid,
        company_code=cid,
        name=f"Procurement Co {s}",
        gst_number="07AAAAA0000A1Z5",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=bid,
        company_id=cid,
        name=f"Central Hub {s}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    uid = f"usr_{s}"
    user = User(
        id=uid,
        username=f"acct_{s}",
        email=f"acct_{s}@smriti.local",
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
        name=f"Vardhman Textiles {s}",
        gst_number="07BBBBB1111B1Z2",
        state="DL",
        outstanding=Decimal("10000.00"),
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    db.add(supplier)
    await db.commit()

    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    return cid, bid, user, supplier, tenant_ctx


def create_posted_bill(cid, bid, supplier_id, total_amount, bill_date=None, bill_no=None):
    b_id = f"bil_{uuid.uuid4().hex[:8]}"
    return PurchaseBill(
        id=b_id,
        uuid=str(uuid.uuid4()),
        bill_no=bill_no or f"BILL-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier_id,
        bill_date=bill_date or date.today(),
        status="POSTED",
        taxable_amount=(Decimal(str(total_amount)) * Decimal("0.8475")).quantize(Decimal("0.01")),
        tax_amount=(Decimal(str(total_amount)) * Decimal("0.1525")).quantize(Decimal("0.01")),
        total_amount=Decimal(str(total_amount)).quantize(Decimal("0.01")),
        paid_amount=Decimal("0.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )


# ---------------------------------------------------------------------------
# TESTS
# ---------------------------------------------------------------------------

async def test_cash_payment_generates_balanced_gl_voucher(db_session):
    """
    Test Case 1: Cash supplier payment generates balanced GL voucher:
      Debit 2010 (Accounts Payable / Creditors) = 2000.00 (party_id = supplier.id)
      Credit 1010 (Cash in Hand) = 2000.00
      supplier.outstanding decremented from 10000.00 to 8000.00
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("2000.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        reference_no="CASH-VOUCH-01",
        notes="Cash disbursement for inventory",
        auto_allocate=False,
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert payment.id == payment_id
    assert payment.is_active is True

    # Verify supplier outstanding decremented
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("8000.00")

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT",
        JournalVoucher.reference_doc_id == payment_id,
        JournalVoucher.is_deleted == False,
    )
    voucher = (await db_session.execute(v_stmt)).scalar_one_or_none()
    assert voucher is not None
    assert voucher.voucher_type == "SUPPLIER_PAYMENT"

    # Verify GL Entries
    gle_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(entries) == 2

    # Check Accounts
    acc_ids = {e.account_id for e in entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}

    total_debit = sum(e.debit_amount for e in entries)
    total_credit = sum(e.credit_amount for e in entries)
    assert total_debit == Decimal("2000.00")
    assert total_credit == Decimal("2000.00")

    entry_by_code = {accounts[e.account_id]: e for e in entries}
    assert "2010" in entry_by_code
    assert "1010" in entry_by_code

    # 2010 AP must be debited with party_id
    ap_entry = entry_by_code["2010"]
    assert ap_entry.debit_amount == Decimal("2000.00")
    assert ap_entry.credit_amount == Decimal("0.00")
    assert ap_entry.party_id == supplier.id

    # 1010 Cash must be credited
    cash_entry = entry_by_code["1010"]
    assert cash_entry.debit_amount == Decimal("0.00")
    assert cash_entry.credit_amount == Decimal("2000.00")


async def test_bank_payment_generates_balanced_gl_voucher(db_session):
    """
    Test Case 2: Bank transfer payment credits Bank Accounts (1020):
      Debit 2010 (Accounts Payable) = 3500.00 (party_id = supplier.id)
      Credit 1020 (Bank Accounts) = 3500.00
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("3500.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        reference_no="NEFT-UTR-999888",
        notes="Bank disbursement for fabrics",
        auto_allocate=False,
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert payment.id == payment_id

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT",
        JournalVoucher.reference_doc_id == payment_id,
    )
    voucher = (await db_session.execute(v_stmt)).scalar_one_or_none()
    assert voucher is not None

    gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(entries) == 2

    acc_ids = {e.account_id for e in entries}
    accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(acc_ids)))).scalars().all()}
    entry_by_code = {accounts[e.account_id]: e for e in entries}

    assert "2010" in entry_by_code
    assert "1020" in entry_by_code

    assert entry_by_code["2010"].debit_amount == Decimal("3500.00")
    assert entry_by_code["2010"].party_id == supplier.id
    assert entry_by_code["1020"].credit_amount == Decimal("3500.00")


async def test_direct_bill_knockoff_full_settlement(db_session):
    """
    Test Case 3: Direct bill knock-off with exact amount transitions PurchaseBill to PAID.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    bill = create_posted_bill(cid, bid, supplier.id, Decimal("4200.00"))
    db_session.add(bill)
    await db_session.commit()

    service = SupplierPaymentService(db_session, tenant)
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("4200.00"),
        payment_mode="UPI",
        payment_date=date.today(),
        reference_no="UPI-REF-112233",
        bill_id=bill.id,
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert len(payment.allocated_bills) == 1
    assert payment.allocated_bills[0]["bill_id"] == bill.id
    assert payment.allocated_bills[0]["amount"] == "4200.00"

    await db_session.refresh(bill)
    assert bill.paid_amount == Decimal("4200.00")
    assert bill.status == "PAID"


async def test_direct_bill_knockoff_partial_settlement(db_session):
    """
    Test Case 4: Partial bill knock-off keeps PurchaseBill in POSTED with incremented paid_amount.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    bill = create_posted_bill(cid, bid, supplier.id, Decimal("5000.00"))
    db_session.add(bill)
    await db_session.commit()

    service = SupplierPaymentService(db_session, tenant)
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("2000.00"),
        payment_mode="CHEQUE",
        payment_date=date.today(),
        reference_no="CHQ-554433",
        bill_id=bill.id,
    )

    await service.record_payment(req, created_by=user.id)

    await db_session.refresh(bill)
    assert bill.paid_amount == Decimal("2000.00")
    assert bill.status == "POSTED"


async def test_multi_bill_explicit_allocations(db_session):
    """
    Test Case 5: Explicit allocations across multiple bills splits payment accurately.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    bill1 = create_posted_bill(cid, bid, supplier.id, Decimal("2000.00"))
    bill2 = create_posted_bill(cid, bid, supplier.id, Decimal("4000.00"))
    db_session.add_all([bill1, bill2])
    await db_session.commit()

    service = SupplierPaymentService(db_session, tenant)
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("5000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        allocations=[
            SupplierBillAllocation(bill_id=bill1.id, amount=Decimal("2000.00")),
            SupplierBillAllocation(bill_id=bill2.id, amount=Decimal("3000.00")),
        ],
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert len(payment.allocated_bills) == 2

    await db_session.refresh(bill1)
    await db_session.refresh(bill2)

    assert bill1.paid_amount == Decimal("2000.00")
    assert bill1.status == "PAID"

    assert bill2.paid_amount == Decimal("3000.00")
    assert bill2.status == "POSTED"


async def test_fifo_auto_allocation_across_open_bills(db_session):
    """
    Test Case 6: Automatic FIFO allocation applies payment to oldest open bill first.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    bill_old = create_posted_bill(cid, bid, supplier.id, Decimal("1500.00"), bill_date=date(2026, 8, 1))
    bill_new = create_posted_bill(cid, bid, supplier.id, Decimal("2500.00"), bill_date=date(2026, 9, 1))
    db_session.add_all([bill_old, bill_new])
    await db_session.commit()

    service = SupplierPaymentService(db_session, tenant)
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("2500.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        auto_allocate=True,
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert len(payment.allocated_bills) == 2

    await db_session.refresh(bill_old)
    await db_session.refresh(bill_new)

    # bill_old must be fully settled
    assert bill_old.paid_amount == Decimal("1500.00")
    assert bill_old.status == "PAID"

    # bill_new must be partially settled
    assert bill_new.paid_amount == Decimal("1000.00")
    assert bill_new.status == "POSTED"


async def test_overpayment_rejection_guard(db_session):
    """
    Test Case 7: Attempting to pay more than supplier.outstanding raises HTTPException(400).
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    supplier.outstanding = Decimal("1000.00")
    await db_session.commit()

    service = SupplierPaymentService(db_session, tenant)
    req = SupplierPaymentCreate(
        id=f"pay_{uuid.uuid4().hex[:8]}",
        supplier_id=supplier.id,
        amount=Decimal("1500.00"),
        payment_mode="CASH",
        payment_date=date.today(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.record_payment(req, created_by=user.id)
    assert exc_info.value.status_code == 400
    assert "exceeds supplier outstanding balance" in str(exc_info.value.detail)

    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("1000.00")


async def test_payment_cancellation_reverses_gl_and_restores_bills(db_session):
    """
    Test Case 8: Cancelling a payment reverses the GL entries, restores supplier outstanding,
    and rolls back knocked-off bills from PAID to POSTED.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    bill = create_posted_bill(cid, bid, supplier.id, Decimal("3000.00"))
    db_session.add(bill)
    await db_session.commit()

    service = SupplierPaymentService(db_session, tenant)
    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("3000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        bill_id=bill.id,
    )

    payment = await service.record_payment(req, created_by=user.id)
    await db_session.refresh(bill)
    assert bill.status == "PAID"
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("7000.00")

    # Cancel payment
    cancelled_payment = await service.cancel_payment(
        payment_id=payment_id,
        reason="Wrong invoice billed by vendor",
        cancelled_by=user.id,
    )
    assert cancelled_payment.is_active is False

    # Verify supplier outstanding restored to 10000.00
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("10000.00")

    # Verify bill paid_amount reset to 0.00 and status reverted to POSTED
    await db_session.refresh(bill)
    assert bill.paid_amount == Decimal("0.00")
    assert bill.status == "POSTED"

    # Verify Reversing Journal Voucher exists
    rev_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT_CANCEL",
        JournalVoucher.reference_doc_id == payment_id,
    )
    rev_voucher = (await db_session.execute(rev_stmt)).scalar_one_or_none()
    assert rev_voucher is not None
    assert rev_voucher.voucher_type == "SUPPLIER_PAYMENT_CANCEL"

    # Verify reversing GL entries: DR 1020 / CR 2010
    gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == rev_voucher.id)
    rev_entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(rev_entries) == 2

    acc_ids = {e.account_id for e in rev_entries}
    accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(acc_ids)))).scalars().all()}
    rev_by_code = {accounts[e.account_id]: e for e in rev_entries}

    assert rev_by_code["1020"].debit_amount == Decimal("3000.00")
    assert rev_by_code["2010"].credit_amount == Decimal("3000.00")
    assert rev_by_code["2010"].party_id == supplier.id


async def test_idempotent_voucher_posting_and_cancellation(db_session):
    """
    Test Case 9: Repeated posting or cancellation is idempotent and does not corrupt ledger.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    payment_id = f"pay_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("1000.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        auto_allocate=False,
    )
    payment = await service.record_payment(req, created_by=user.id)

    # Call post_supplier_payment_to_gl directly a second time
    v2 = await UnifiedAccountingLedgerService.post_supplier_payment_to_gl(
        session=db_session,
        company_id=cid,
        payment_id=payment.id,
    )
    assert v2 is not None

    # Verify exactly 1 voucher exists for this payment
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT",
        JournalVoucher.reference_doc_id == payment_id,
    )
    vouchers = (await db_session.execute(v_stmt)).scalars().all()
    assert len(vouchers) == 1

    # Cancel payment first time
    c1 = await service.cancel_payment(payment_id, reason="Test 1")
    assert c1.is_active is False

    # Cancel payment second time (idempotency check)
    c2 = await service.cancel_payment(payment_id, reason="Test 2")
    assert c2.is_active is False

    # Verify only 1 cancellation voucher exists
    rev_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT_CANCEL",
        JournalVoucher.reference_doc_id == payment_id,
    )
    rev_vouchers = (await db_session.execute(rev_stmt)).scalars().all()
    assert len(rev_vouchers) == 1
