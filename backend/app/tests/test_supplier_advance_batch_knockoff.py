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

* Version    : 6.49.9
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.7 — Multi-Bill Batch Advance Knock-Off & FIFO Allocation Engine
Verifies:
  1. Explicit multi-bill batch knock-off allocating advance across multiple purchase bills atomically.
  2. Automated FIFO batch knock-off cascading available advance across oldest open bills first.
  3. Compound double-entry General Ledger journal voucher generation (DR 2010 per bill / CR 2050 Advance).
  4. Balance invariant enforcement: sum(DR) == sum(CR) and Net Cash Movement: ₹0.00.
  5. Bill status transitions (PAID vs PARTIALLY_PAID) and supplier.outstanding liability decrement.
  6. Over-allocation protection when total allocation exceeds unallocated advance credit.
  7. Over-allocation protection when bill allocation exceeds individual bill unpaid balance.
  8. Rejection of cancelled or draft bills in batch knock-off.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
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
        code=f"SUP-{s.upper()}",
        name=f"Vardhman Mills {s}",
        company_id=cid,
        outstanding=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db.add(supplier)
    await db.commit()

    tenant = TenantContext(company_id=cid, branch_id=bid)
    return tenant, supplier, user


async def create_posted_bill(
    db,
    tenant: TenantContext,
    supplier_id: str,
    total_amount: Decimal,
    bill_no: str,
    bill_date: date,
    paid_amount: Decimal = Decimal("0.00"),
    status: str = "POSTED",
) -> PurchaseBill:
    bill = PurchaseBill(
        id=f"pb_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        bill_no=bill_no,
        supplier_id=supplier_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        bill_date=bill_date,
        taxable_amount=(Decimal(str(total_amount)) * Decimal("0.8475")).quantize(Decimal("0.01")),
        tax_amount=(Decimal(str(total_amount)) * Decimal("0.1525")).quantize(Decimal("0.01")),
        total_amount=Decimal(str(total_amount)).quantize(Decimal("0.01")),
        paid_amount=Decimal(str(paid_amount)).quantize(Decimal("0.01")),
        status=status,
        version=1,
        is_deleted=False,
    )
    db.add(bill)

    # Increment supplier outstanding
    unpaid = total_amount - paid_amount
    supp_stmt = select(Supplier).where(Supplier.id == supplier_id)
    supplier = (await db.execute(supp_stmt)).scalar_one()
    supplier.outstanding = (Decimal(str(supplier.outstanding or 0)) + unpaid).quantize(Decimal("0.01"))

    await db.commit()
    await db.refresh(bill)
    return bill


# ---------------------------------------------------------------------------
# Test Battery
# ---------------------------------------------------------------------------

async def test_explicit_multi_bill_batch_knockoff(db_session):
    """
    Verifies allocating a single advance of ₹50,000 across 2 bills:
    Bill 1: ₹20,000 (fully paid)
    Bill 2: ₹15,000 (partially paid against ₹35,000 total)
    Remaining advance: ₹15,000.
    Compound GL voucher generated:
      DR 2010 (Bill 1): ₹20,000
      DR 2010 (Bill 2): ₹15,000
      CR 2050 (Advance): ₹35,000
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    # 1. Disburse advance of ₹50,000
    adv_payload = SupplierPaymentCreate(
        id=f"pay_adv_{uuid.uuid4().hex[:6]}",
        supplier_id=supplier.id,
        amount=Decimal("50000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        payment_type="ADVANCE",
        notes="Prepayment for bulk yarn consignment",
        auto_allocate=False,
    )
    adv = await svc.record_payment(adv_payload, created_by=user.id)
    assert adv.amount == Decimal("50000.00")
    assert adv.unallocated_amount == Decimal("50000.00")

    # 2. Create 2 open bills
    bill1 = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("20000.00"), "BILL-YARN-001", date.today() - timedelta(days=5)
    )
    bill2 = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("35000.00"), "BILL-YARN-002", date.today() - timedelta(days=2)
    )
    assert supplier.outstanding == Decimal("55000.00")

    # 3. Execute batch knock-off
    allocations = [
        SupplierBillAllocation(bill_id=bill1.id, amount=Decimal("20000.00")),
        SupplierBillAllocation(bill_id=bill2.id, amount=Decimal("15000.00")),
    ]
    res = await svc.batch_knockoff_advance(
        supplier_id=supplier.id,
        advance_payment_id=adv.id,
        allocations=allocations,
        user_id=user.id,
    )

    assert res["success"] is True
    assert res["total_knocked_off"] == Decimal("35000.00")
    assert res["remaining_advance_balance"] == Decimal("15000.00")
    assert len(res["allocated_bills"]) == 2

    # Verify bills state
    await db_session.refresh(bill1)
    await db_session.refresh(bill2)
    assert bill1.paid_amount == Decimal("20000.00")
    assert bill1.status == "PAID"
    assert bill2.paid_amount == Decimal("15000.00")
    assert bill2.status == "PARTIALLY_PAID"

    # Verify supplier outstanding: was 55000, knocked off 35000 -> 20000
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("20000.00")

    # Verify Compound GL Journal Voucher
    v_id = res["journal_voucher_id"]
    assert v_id is not None
    voucher_stmt = select(JournalVoucher).where(JournalVoucher.id == v_id)
    voucher = (await db_session.execute(voucher_stmt)).scalar_one()
    assert voucher.reference_doc_type == "SUPPLIER_ADVANCE_BATCH_KNOCKOFF"

    entries_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == v_id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(entries_stmt)).scalars().all()
    assert len(entries) == 3

    acc_creditors = await UnifiedAccountingLedgerService.get_account_by_code(db_session, tenant.company_id, "2010")
    acc_advance = await UnifiedAccountingLedgerService.get_account_by_code(db_session, tenant.company_id, "2050")

    dr_entries = [e for e in entries if e.debit_amount > 0]
    cr_entries = [e for e in entries if e.credit_amount > 0]
    assert len(dr_entries) == 2
    assert len(cr_entries) == 1

    total_dr = sum(e.debit_amount for e in dr_entries)
    total_cr = sum(e.credit_amount for e in cr_entries)
    assert total_dr == Decimal("35000.00")
    assert total_cr == Decimal("35000.00")
    assert total_dr == total_cr  # Strict balance invariant

    # Verify DR lines are to Creditors (2010)
    for dr in dr_entries:
        assert dr.account_id == acc_creditors.id
        assert dr.party_id == supplier.id

    # Verify CR line is to Supplier Advance (2050)
    assert cr_entries[0].account_id == acc_advance.id
    assert cr_entries[0].credit_amount == Decimal("35000.00")


async def test_auto_fifo_batch_knockoff(db_session):
    """
    Verifies automated FIFO cascading of an advance across 3 open bills:
    Advance: ₹40,000
    Bill 1 (oldest, 10 days ago): ₹15,000 -> fully paid
    Bill 2 (5 days ago): ₹15,000 -> fully paid
    Bill 3 (1 day ago): ₹25,000 -> ₹10,000 allocated, remaining unpaid ₹15,000
    Total knocked off: ₹40,000. Remaining advance: ₹0.00.
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    adv_payload = SupplierPaymentCreate(
        id=f"pay_adv_{uuid.uuid4().hex[:6]}",
        supplier_id=supplier.id,
        amount=Decimal("40000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        payment_type="ADVANCE",
        auto_allocate=False,
    )
    adv = await svc.record_payment(adv_payload, created_by=user.id)

    bill1 = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("15000.00"), "FIFO-BILL-001", date.today() - timedelta(days=10)
    )
    bill2 = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("15000.00"), "FIFO-BILL-002", date.today() - timedelta(days=5)
    )
    bill3 = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("25000.00"), "FIFO-BILL-003", date.today() - timedelta(days=1)
    )

    res = await svc.batch_knockoff_advance(
        supplier_id=supplier.id,
        advance_payment_id=adv.id,
        auto_fifo=True,
        user_id=user.id,
    )

    assert res["success"] is True
    assert res["total_knocked_off"] == Decimal("40000.00")
    assert res["remaining_advance_balance"] == Decimal("0.00")
    assert len(res["allocated_bills"]) == 3

    # Check FIFO allocation order and amounts
    assert res["allocated_bills"][0]["bill_id"] == bill1.id
    assert res["allocated_bills"][0]["amount"] == Decimal("15000.00")

    assert res["allocated_bills"][1]["bill_id"] == bill2.id
    assert res["allocated_bills"][1]["amount"] == Decimal("15000.00")

    assert res["allocated_bills"][2]["bill_id"] == bill3.id
    assert res["allocated_bills"][2]["amount"] == Decimal("10000.00")

    # Refresh bills
    await db_session.refresh(bill1)
    await db_session.refresh(bill2)
    await db_session.refresh(bill3)
    assert bill1.status == "PAID"
    assert bill1.paid_amount == Decimal("15000.00")
    assert bill2.status == "PAID"
    assert bill2.paid_amount == Decimal("15000.00")
    assert bill3.status == "PARTIALLY_PAID"
    assert bill3.paid_amount == Decimal("10000.00")


async def test_partial_fifo_knockoff_leaving_unpaid_balance(db_session):
    """
    Verifies FIFO allocation when advance is smaller than the single oldest bill.
    Advance: ₹8,000
    Bill: ₹25,000
    Result: ₹8,000 allocated, unpaid balance ₹17,000, advance exhausted.
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    adv = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_adv_{uuid.uuid4().hex[:6]}",
            supplier_id=supplier.id,
            amount=Decimal("8000.00"),
            payment_mode="CASH",
            payment_date=date.today(),
            payment_type="ADVANCE",
            auto_allocate=False,
        ),
        created_by=user.id,
    )

    bill = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("25000.00"), "PARTIAL-BILL-001", date.today()
    )

    res = await svc.batch_knockoff_advance(
        supplier_id=supplier.id,
        advance_payment_id=adv.id,
        auto_fifo=True,
        user_id=user.id,
    )

    assert res["total_knocked_off"] == Decimal("8000.00")
    assert res["remaining_advance_balance"] == Decimal("0.00")

    await db_session.refresh(bill)
    assert bill.paid_amount == Decimal("8000.00")
    assert bill.status == "PARTIALLY_PAID"


async def test_over_allocation_exceeds_advance_rejected(db_session):
    """
    Verifies that requesting allocations totaling more than the unallocated advance raises HTTPException 400.
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    adv = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_adv_{uuid.uuid4().hex[:6]}",
            supplier_id=supplier.id,
            amount=Decimal("10000.00"),
            payment_mode="CASH",
            payment_date=date.today(),
            payment_type="ADVANCE",
            auto_allocate=False,
        ),
        created_by=user.id,
    )
    bill = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("50000.00"), "OVERALLOC-BILL-001", date.today()
    )

    with pytest.raises(HTTPException) as exc_info:
        await svc.batch_knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv.id,
            allocations=[SupplierBillAllocation(bill_id=bill.id, amount=Decimal("15000.00"))],
            user_id=user.id,
        )
    assert exc_info.value.status_code == 400
    assert "exceeds unallocated advance" in exc_info.value.detail


async def test_over_allocation_exceeds_bill_unpaid_rejected(db_session):
    """
    Verifies that attempting to allocate more to a single bill than its unpaid balance raises HTTPException 400.
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    adv = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_adv_{uuid.uuid4().hex[:6]}",
            supplier_id=supplier.id,
            amount=Decimal("50000.00"),
            payment_mode="BANK_TRANSFER",
            payment_date=date.today(),
            payment_type="ADVANCE",
            auto_allocate=False,
        ),
        created_by=user.id,
    )
    bill = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("10000.00"), "OVERBILL-001", date.today()
    )

    with pytest.raises(HTTPException) as exc_info:
        await svc.batch_knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv.id,
            allocations=[SupplierBillAllocation(bill_id=bill.id, amount=Decimal("15000.00"))],
            user_id=user.id,
        )
    assert exc_info.value.status_code == 400
    assert "exceeds unpaid bill balance" in exc_info.value.detail


async def test_cancelled_or_draft_bill_rejected_in_batch(db_session):
    """
    Verifies that attempting to knock off against a CANCELLED or DRAFT bill raises HTTPException 400.
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    adv = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_adv_{uuid.uuid4().hex[:6]}",
            supplier_id=supplier.id,
            amount=Decimal("20000.00"),
            payment_mode="BANK_TRANSFER",
            payment_date=date.today(),
            payment_type="ADVANCE",
            auto_allocate=False,
        ),
        created_by=user.id,
    )
    canc_bill = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("10000.00"), "CANCELLED-001", date.today(), status="CANCELLED"
    )

    with pytest.raises(HTTPException) as exc_info:
        await svc.batch_knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv.id,
            allocations=[SupplierBillAllocation(bill_id=canc_bill.id, amount=Decimal("5000.00"))],
            user_id=user.id,
        )
    assert exc_info.value.status_code == 400
    assert "status" in exc_info.value.detail.lower()


async def test_already_fully_allocated_advance_rejected(db_session):
    """
    Verifies that attempting a batch knock-off on an advance with zero unallocated balance raises HTTPException 400.
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    adv = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_adv_{uuid.uuid4().hex[:6]}",
            supplier_id=supplier.id,
            amount=Decimal("10000.00"),
            payment_mode="BANK_TRANSFER",
            payment_date=date.today(),
            payment_type="ADVANCE",
            auto_allocate=False,
        ),
        created_by=user.id,
    )
    bill = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("10000.00"), "SETTLE-001", date.today()
    )

    # First knock-off exhausts advance
    await svc.batch_knockoff_advance(
        supplier_id=supplier.id,
        advance_payment_id=adv.id,
        allocations=[SupplierBillAllocation(bill_id=bill.id, amount=Decimal("10000.00"))],
        user_id=user.id,
    )

    bill2 = await create_posted_bill(
        db_session, tenant, supplier.id, Decimal("10000.00"), "SETTLE-002", date.today()
    )

    # Second knock-off should fail
    with pytest.raises(HTTPException) as exc_info:
        await svc.batch_knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv.id,
            allocations=[SupplierBillAllocation(bill_id=bill2.id, amount=Decimal("5000.00"))],
            user_id=user.id,
        )
    assert exc_info.value.status_code == 400
    assert "already fully allocated" in exc_info.value.detail


async def test_missing_allocations_and_auto_fifo_rejected(db_session):
    """
    Verifies that omitting both allocations and auto_fifo=True raises HTTPException 400.
    """
    tenant, supplier, user = await setup_test_tenant(db_session)
    svc = SupplierPaymentService(db_session, tenant)

    adv = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_adv_{uuid.uuid4().hex[:6]}",
            supplier_id=supplier.id,
            amount=Decimal("10000.00"),
            payment_mode="BANK_TRANSFER",
            payment_date=date.today(),
            payment_type="ADVANCE",
            auto_allocate=False,
        ),
        created_by=user.id,
    )

    with pytest.raises(HTTPException) as exc_info:
        await svc.batch_knockoff_advance(
            supplier_id=supplier.id,
            advance_payment_id=adv.id,
            allocations=None,
            auto_fifo=False,
            user_id=user.id,
        )
    assert exc_info.value.status_code == 400
    assert "Either explicit allocations list or auto_fifo=True" in exc_info.value.detail
