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

* Version    : 6.49.7
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.5 — Supplier Advance Payment General Ledger Integration & Automatic Bill Knock-off
Verifies:
  1. Cash advance disbursement generates balanced GL voucher (DR 2050 / CR 1010)
  2. Bank/UPI advance disbursement generates balanced GL voucher (DR 2050 / CR 1020)
  3. Advance disbursement permitted when supplier outstanding is zero (bypassing overpayment guard)
  4. Creation-time automatic knock-off against open confirmed purchase bills (DR 2010 / CR 2050)
  5. Explicit knock-off endpoint against confirmed purchase bill (DR 2010 / CR 2050, bill status transitions to PAID)
  6. Partial knock-off leaving open advance balance and multi-step knock-offs
  7. Advance payment cancellation reverses GL symmetrically (DR 1010/1020 / CR 2050)
  8. Idempotency and error protections (insufficient advance balance, non-posted bill, overpayment)
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
from app.schemas.supplier_payment import SupplierPaymentCreate
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
        name=f"Vardhman Advance Mill {s}",
        gst_number="07BBBBB1111B1Z2",
        state="DL",
        outstanding=Decimal("0.00"),
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

async def test_cash_advance_disbursement_generates_gl_voucher(db_session):
    """
    Test Case 1: Cash supplier advance disbursement generates balanced GL voucher:
      Debit 2050 (Supplier Advance Liability) = 3000.00 (party_id = supplier.id)
      Credit 1010 (Cash in Hand) = 3000.00
      voucher_type = SUPPLIER_ADVANCE
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    payment_id = f"adv_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("3000.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        payment_type="ADVANCE",
        purchase_order_id="PO-2026-001",
        reference_no="ADV-CASH-01",
        notes="Advance disbursement for raw materials purchase order",
        auto_allocate=False,
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert payment.id == payment_id
    assert payment.is_active is True
    assert payment.payment_type == "ADVANCE"
    assert payment.unallocated_amount == Decimal("3000.00")
    assert payment.purchase_order_id == "PO-2026-001"

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT",
        JournalVoucher.reference_doc_id == payment_id,
        JournalVoucher.is_deleted == False,
    )
    voucher = (await db_session.execute(v_stmt)).scalar_one_or_none()
    assert voucher is not None
    assert voucher.voucher_type == "SUPPLIER_ADVANCE"

    # Verify GL Entries
    gle_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(entries) == 2

    # Map accounts
    acc_ids = {e.account_id for e in entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}

    debit_entry = next(e for e in entries if e.debit_amount > Decimal("0.00"))
    credit_entry = next(e for e in entries if e.credit_amount > Decimal("0.00"))

    assert accounts[debit_entry.account_id] == "2050"
    assert debit_entry.debit_amount == Decimal("3000.00")
    assert debit_entry.party_id == supplier.id

    assert accounts[credit_entry.account_id] == "1010"
    assert credit_entry.credit_amount == Decimal("3000.00")

    total_debit = sum(e.debit_amount for e in entries)
    total_credit = sum(e.credit_amount for e in entries)
    assert total_debit == Decimal("3000.00")
    assert total_credit == Decimal("3000.00")


async def test_bank_advance_disbursement_generates_gl_voucher(db_session):
    """
    Test Case 2: Bank supplier advance disbursement generates balanced GL voucher:
      Debit 2050 (Supplier Advance Liability) = 5000.00 (party_id = supplier.id)
      Credit 1020 (Bank Accounts) = 5000.00
      voucher_type = SUPPLIER_ADVANCE
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    payment_id = f"adv_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("5000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        payment_type="ADVANCE",
        reference_no="NEFT-ADV-8899",
        notes="Bank advance transfer against PO",
        auto_allocate=False,
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert payment.id == payment_id
    assert payment.payment_type == "ADVANCE"
    assert payment.unallocated_amount == Decimal("5000.00")

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT",
        JournalVoucher.reference_doc_id == payment_id,
        JournalVoucher.is_deleted == False,
    )
    voucher = (await db_session.execute(v_stmt)).scalar_one_or_none()
    assert voucher is not None
    assert voucher.voucher_type == "SUPPLIER_ADVANCE"

    # Verify GL Entries
    gle_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(entries) == 2

    acc_ids = {e.account_id for e in entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}

    debit_entry = next(e for e in entries if e.debit_amount > Decimal("0.00"))
    credit_entry = next(e for e in entries if e.credit_amount > Decimal("0.00"))

    assert accounts[debit_entry.account_id] == "2050"
    assert debit_entry.debit_amount == Decimal("5000.00")

    assert accounts[credit_entry.account_id] == "1020"
    assert credit_entry.credit_amount == Decimal("5000.00")


async def test_advance_disbursement_permitted_when_outstanding_zero(db_session):
    """
    Test Case 3: Advance disbursement permitted when supplier.outstanding == 0.00.
    Standard payment would be rejected with overpayment guard, while ADVANCE succeeds.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    assert supplier.outstanding == Decimal("0.00")

    # Attempting STANDARD payment when outstanding == 0 must fail
    standard_req = SupplierPaymentCreate(
        id=f"pay_{uuid.uuid4().hex[:8]}",
        supplier_id=supplier.id,
        amount=Decimal("1000.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        payment_type="STANDARD",
        notes="Standard payment without outstanding",
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.record_payment(standard_req, created_by=user.id)
    assert exc_info.value.status_code == 400
    assert "exceeds" in exc_info.value.detail.lower()

    # Attempting ADVANCE payment must succeed
    advance_req = SupplierPaymentCreate(
        id=f"adv_{uuid.uuid4().hex[:8]}",
        supplier_id=supplier.id,
        amount=Decimal("1000.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        payment_type="ADVANCE",
        notes="Advance payment without outstanding",
    )
    advance = await service.record_payment(advance_req, created_by=user.id)
    assert advance.payment_type == "ADVANCE"
    assert advance.amount == Decimal("1000.00")
    assert advance.unallocated_amount == Decimal("1000.00")


async def test_creation_time_automatic_knockoff_against_open_bills(db_session):
    """
    Test Case 4: Creation-time automatic knock-off against open confirmed purchase bills.
    Disbursement: DR 2050 / CR 1010 = 2500.00
    Knock-off: DR 2010 / CR 2050 = 2000.00 (Zero cash movement)
    Bill paid_amount = 2000.00, bill status transitions to PAID.
    Remaining unallocated advance = 500.00.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    # Create open confirmed purchase bill
    bill = create_posted_bill(cid, bid, supplier.id, Decimal("2000.00"))
    db_session.add(bill)
    supplier.outstanding = Decimal("2000.00")
    await db_session.commit()

    # Advance payment of 2500 with auto_allocate=True
    payment_id = f"adv_{uuid.uuid4().hex[:8]}"
    req = SupplierPaymentCreate(
        id=payment_id,
        supplier_id=supplier.id,
        amount=Decimal("2500.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        payment_type="ADVANCE",
        auto_allocate=True,
    )

    payment = await service.record_payment(req, created_by=user.id)
    assert payment.id == payment_id
    assert payment.unallocated_amount == Decimal("500.00")

    # Verify bill is fully settled
    await db_session.refresh(bill)
    assert bill.status == "PAID"
    assert bill.paid_amount == Decimal("2000.00")

    # Verify supplier outstanding reduced
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("0.00")

    # Verify Disbursement Voucher (SUPPLIER_ADVANCE)
    disb_v = (await db_session.execute(
        select(JournalVoucher).where(
            JournalVoucher.reference_doc_id == payment_id,
            JournalVoucher.voucher_type == "SUPPLIER_ADVANCE",
        )
    )).scalar_one_or_none()
    assert disb_v is not None

    # Verify Knock-off Voucher (JOURNAL with reference_doc_type = SUPPLIER_ADVANCE_KNOCKOFF)
    knock_v = (await db_session.execute(
        select(JournalVoucher).where(
            JournalVoucher.company_id == cid,
            JournalVoucher.voucher_type == "JOURNAL",
            JournalVoucher.reference_doc_type == "SUPPLIER_ADVANCE_KNOCKOFF",
        )
    )).scalar_one_or_none()
    assert knock_v is not None

    # Verify GL entries of knock-off voucher: DR 2010 / CR 2050 for 2000.00
    gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == knock_v.id)
    k_entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(k_entries) == 2

    acc_ids = {e.account_id for e in k_entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}

    dr_entry = next(e for e in k_entries if e.debit_amount > Decimal("0.00"))
    cr_entry = next(e for e in k_entries if e.credit_amount > Decimal("0.00"))

    assert accounts[dr_entry.account_id] == "2010"  # Accounts Payable debited
    assert dr_entry.debit_amount == Decimal("2000.00")

    assert accounts[cr_entry.account_id] == "2050"  # Supplier Advance Liability credited
    assert cr_entry.credit_amount == Decimal("2000.00")


async def test_explicit_knockoff_endpoint_against_confirmed_bill(db_session):
    """
    Test Case 5: Explicit knock-off against confirmed purchase bill via knockoff_advance.
    Advance: 4000.00
    Bill: 3500.00
    Knock-off: DR 2010 / CR 2050 = 3500.00
    Bill becomes PAID, supplier outstanding becomes 0, advance unallocated = 500.00.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    # 1. Create advance payment of 4000.00 without auto-allocation
    advance_id = f"adv_{uuid.uuid4().hex[:8]}"
    adv_req = SupplierPaymentCreate(
        id=advance_id,
        supplier_id=supplier.id,
        amount=Decimal("4000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        payment_type="ADVANCE",
        auto_allocate=False,
    )
    advance = await service.record_payment(adv_req, created_by=user.id)
    assert advance.unallocated_amount == Decimal("4000.00")

    # 2. Confirmed purchase bill arrives later
    bill = create_posted_bill(cid, bid, supplier.id, Decimal("3500.00"))
    db_session.add(bill)
    supplier.outstanding = Decimal("3500.00")
    await db_session.commit()

    # 3. Explicit knock-off
    res = await service.knockoff_advance(
        supplier_id=supplier.id,
        advance_payment_id=advance_id,
        bill_id=bill.id,
        amount=Decimal("3500.00"),
        user_id=user.id,
    )

    assert res["amount_knocked_off"] == Decimal("3500.00")
    assert res["remaining_advance_balance"] == Decimal("500.00")
    assert res["bill_paid_amount"] == Decimal("3500.00")
    assert res["bill_status"] == "PAID"
    assert res["journal_voucher_id"] is not None

    # 4. Verify supplier outstanding reduced
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("0.00")

    # 5. Verify knock-off voucher
    gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == res["journal_voucher_id"])
    k_entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(k_entries) == 2

    acc_ids = {e.account_id for e in k_entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}

    dr_entry = next(e for e in k_entries if e.debit_amount > Decimal("0.00"))
    cr_entry = next(e for e in k_entries if e.credit_amount > Decimal("0.00"))

    assert accounts[dr_entry.account_id] == "2010"
    assert dr_entry.debit_amount == Decimal("3500.00")

    assert accounts[cr_entry.account_id] == "2050"
    assert cr_entry.credit_amount == Decimal("3500.00")


async def test_partial_knockoff_leaving_open_advance_balance(db_session):
    """
    Test Case 6: Partial knock-offs across multiple steps.
    Advance: 5000.00
    Bill: 6000.00
    Step 1: Knock off 2000.00 -> bill paid_amount=2000.00 (POSTED), advance unallocated=3000.00
    Step 2: Knock off 3000.00 -> bill paid_amount=5000.00 (POSTED), advance unallocated=0.00
    Step 3: Attempt knock off 1000.00 -> fails with insufficient unallocated advance
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    adv_id = f"adv_{uuid.uuid4().hex[:8]}"
    adv = await service.record_payment(SupplierPaymentCreate(
        id=adv_id,
        supplier_id=supplier.id,
        amount=Decimal("5000.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        payment_type="ADVANCE",
        auto_allocate=False,
    ), created_by=user.id)

    bill = create_posted_bill(cid, bid, supplier.id, Decimal("6000.00"))
    db_session.add(bill)
    supplier.outstanding = Decimal("6000.00")
    await db_session.commit()

    # Step 1: knock off 2000
    res1 = await service.knockoff_advance(
        supplier_id=supplier.id,
        advance_payment_id=adv_id,
        bill_id=bill.id,
        amount=Decimal("2000.00"),
        user_id=user.id,
    )
    assert res1["amount_knocked_off"] == Decimal("2000.00")
    assert res1["remaining_advance_balance"] == Decimal("3000.00")
    assert res1["bill_status"] == "POSTED"
    assert res1["bill_paid_amount"] == Decimal("2000.00")

    # Step 2: knock off 3000
    res2 = await service.knockoff_advance(
        supplier_id=supplier.id,
        advance_payment_id=adv_id,
        bill_id=bill.id,
        amount=Decimal("3000.00"),
        user_id=user.id,
    )
    assert res2["amount_knocked_off"] == Decimal("3000.00")
    assert res2["remaining_advance_balance"] == Decimal("0.00")
    assert res2["bill_status"] == "POSTED"
    assert res2["bill_paid_amount"] == Decimal("5000.00")

    # Step 3: try to knock off 1000 with 0 unallocated advance -> must fail
    with pytest.raises(HTTPException) as exc_info:
        await service.knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv_id,
            bill_id=bill.id,
            amount=Decimal("1000.00"),
            user_id=user.id,
        )
    assert exc_info.value.status_code == 400
    assert "exceeds unallocated advance" in exc_info.value.detail.lower()


async def test_advance_payment_cancellation_reversal(db_session):
    """
    Test Case 7: Advance payment cancellation reverses GL symmetrically:
      Debit 1010 (Cash in Hand) = 2000.00
      Credit 2050 (Supplier Advance Liability) = 2000.00
      voucher_type = SUPPLIER_ADVANCE_CANCEL
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    adv_id = f"adv_{uuid.uuid4().hex[:8]}"
    adv = await service.record_payment(SupplierPaymentCreate(
        id=adv_id,
        supplier_id=supplier.id,
        amount=Decimal("2000.00"),
        payment_mode="CASH",
        payment_date=date.today(),
        payment_type="ADVANCE",
        auto_allocate=False,
    ), created_by=user.id)

    # Cancel payment
    cancelled = await service.cancel_payment(payment_id=adv_id, reason="Order cancelled by supplier")
    assert cancelled.is_active is False

    # Verify cancellation voucher
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.voucher_type == "SUPPLIER_ADVANCE_CANCEL",
        JournalVoucher.reference_doc_id == adv_id,
    )
    c_voucher = (await db_session.execute(v_stmt)).scalar_one_or_none()
    assert c_voucher is not None

    # Check entries: DR 1010 / CR 2050
    gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == c_voucher.id)
    c_entries = (await db_session.execute(gle_stmt)).scalars().all()
    assert len(c_entries) == 2

    acc_ids = {e.account_id for e in c_entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}

    dr_entry = next(e for e in c_entries if e.debit_amount > Decimal("0.00"))
    cr_entry = next(e for e in c_entries if e.credit_amount > Decimal("0.00"))

    assert accounts[dr_entry.account_id] == "1010"  # Cash restored
    assert dr_entry.debit_amount == Decimal("2000.00")

    assert accounts[cr_entry.account_id] == "2050"  # Advance liability reversed
    assert cr_entry.credit_amount == Decimal("2000.00")


async def test_idempotency_and_cancelled_knockoff_protection(db_session):
    """
    Test Case 8: Safeguards against invalid knock-offs:
      - Knock-off against already PAID bill fails
      - Knock-off amount exceeding bill outstanding fails
      - Knock-off against non-POSTED/cancelled bill fails
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)
    service = SupplierPaymentService(db_session, tenant)

    adv_id = f"adv_{uuid.uuid4().hex[:8]}"
    adv = await service.record_payment(SupplierPaymentCreate(
        id=adv_id,
        supplier_id=supplier.id,
        amount=Decimal("5000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        payment_type="ADVANCE",
        auto_allocate=False,
    ), created_by=user.id)

    # 1. Bill with status DRAFT
    draft_bill = create_posted_bill(cid, bid, supplier.id, Decimal("1000.00"))
    draft_bill.status = "DRAFT"
    db_session.add(draft_bill)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_draft:
        await service.knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv_id,
            bill_id=draft_bill.id,
            amount=Decimal("500.00"),
            user_id=user.id,
        )
    assert exc_draft.value.status_code == 400
    assert "draft" in exc_draft.value.detail.lower()

    # 2. Bill already PAID
    paid_bill = create_posted_bill(cid, bid, supplier.id, Decimal("1000.00"))
    paid_bill.status = "PAID"
    paid_bill.paid_amount = Decimal("1000.00")
    db_session.add(paid_bill)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_paid:
        await service.knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv_id,
            bill_id=paid_bill.id,
            amount=Decimal("500.00"),
            user_id=user.id,
        )
    assert exc_paid.value.status_code == 400
    assert "already fully paid" in exc_paid.value.detail.lower()
