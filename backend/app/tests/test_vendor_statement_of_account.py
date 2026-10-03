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

* Version    : 6.50.0
* Created    : 2026-10-03
* Modified   : 2026-10-03
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.8 — Vendor Statement of Account & Ledger Audit Export Engine
Verifies:
  1. Authoritative Vendor Statement of Account generation for Account 2010 (AP) and 2050 (Advance).
  2. Mathematical running balance invariant: Running Balance_t = Running Balance_{t-1} + Credit - Debit.
  3. Opening balance calculation prior to from_date.
  4. Date range filtering and in-period transaction scoping.
  5. Multi-transaction lifecycle: Purchase Bills (+CR), Payments (-DR), Advance Disbursements, and Knock-Offs (-DR).
  6. Empty vendor handling returning zero opening/closing balances and empty lines gracefully.
  7. Multi-tenant company isolation.
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
    db.add(company)
    db.add(branch)
    await db.flush()

    uid = f"usr_{s}"
    user = User(
        id=uid,
        username=f"ap_manager_{s}",
        email=f"ap_{s}@smrititest.com",
        hashed_password="mock_hash",
        company_id=cid,
        role=role,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)
    await db.flush()

    tenant = TenantContext(
        company_id=cid,
        branch_id=bid,
    )
    await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(db, cid, bid)
    return tenant, user, company


async def create_test_supplier(db, company_id, code=None, name="Atlas Footwear Ltd"):
    s = uuid.uuid4().hex[:6]
    c = code or f"VEND-{s.upper()}"
    supp = Supplier(
        id=f"sup_{s}",
        company_id=company_id,
        code=c,
        name=name,
        gst_number="27ABCDE1234F1Z5",
        email=f"billing@{c.lower()}.com",
        mobile="9876543210",
        outstanding=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db.add(supp)
    await db.flush()
    return supp


async def create_confirmed_purchase_bill(db, company_id, branch_id, supplier_id, bill_no, total_amt, bill_date=None):
    b_date = bill_date or date.today()
    bill = PurchaseBill(
        id=f"pb_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        supplier_id=supplier_id,
        bill_no=bill_no,
        bill_date=b_date,
        due_date=b_date + timedelta(days=30),
        taxable_amount=(Decimal(str(total_amt)) * Decimal("0.8475")).quantize(Decimal("0.01")),
        tax_amount=(Decimal(str(total_amt)) * Decimal("0.1525")).quantize(Decimal("0.01")),
        total_amount=Decimal(str(total_amt)).quantize(Decimal("0.01")),
        paid_amount=Decimal("0.00"),
        status="POSTED",
        version=1,
        is_deleted=False,
    )
    db.add(bill)
    await db.flush()

    # Post GL voucher for purchase bill (DR 1040 / CR 2010)
    # Note: post_purchase_bill_to_gl automatically increments supplier.outstanding
    await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db,
        company_id=company_id,
        bill_id=bill.id,
        branch_id=branch_id,
    )
    await db.commit()
    await db.refresh(bill)
    return bill


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

async def test_vendor_statement_full_lifecycle(db_session):
    """
    Verifies full lifecycle statement generation:
    1. Bill 1: ₹50,000 credit (CR 2010)
    2. Payment: ₹20,000 debit (DR 2010) -> Running Balance: ₹30,000
    3. Advance Disbursed: ₹15,000 (DR 2050)
    4. Batch Advance Knock-Off: ₹10,000 debit (DR 2010) -> Running Balance: ₹20,000
    5. Closing Net Position = ₹20,000 AP - ₹5,000 Unallocated Advance = ₹15,000 Net Due.
    """
    tenant, user, company = await setup_test_tenant(db_session)
    supp = await create_test_supplier(db_session, tenant.company_id)

    # 1. Purchase Bill
    bill = await create_confirmed_purchase_bill(
        db_session, tenant.company_id, tenant.branch_id, supp.id,
        bill_no="PB-2026-001", total_amt=Decimal("50000.00"), bill_date=date.today() - timedelta(days=10)
    )

    # 2. Supplier Standard Payment
    svc = SupplierPaymentService(db_session, tenant)
    pay_res = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_{uuid.uuid4().hex[:8]}",
            supplier_id=supp.id,
            amount=Decimal("20000.00"),
            payment_mode="BANK_TRANSFER",
            reference_no="NEFT-001",
            payment_date=date.today() - timedelta(days=8),
            bill_id=bill.id,
        ),
        created_by=user.id,
    )

    # 3. Advance Payment
    adv_res = await svc.record_payment(
        SupplierPaymentCreate(
            id=f"adv_{uuid.uuid4().hex[:8]}",
            supplier_id=supp.id,
            amount=Decimal("15000.00"),
            payment_mode="BANK_TRANSFER",
            reference_no="ADV-001",
            payment_type="ADVANCE",
            payment_date=date.today() - timedelta(days=5),
            auto_allocate=False,
        ),
        created_by=user.id,
    )

    # 4. Batch Knock-Off (knock off ₹10,000 from advance against remaining bill balance)
    batch_res = await svc.batch_knockoff_advance(
        supplier_id=supp.id,
        advance_payment_id=adv_res.id,
        allocations=[SupplierBillAllocation(bill_id=bill.id, amount=Decimal("10000.00"))],
        created_by=user.id,
    )
    assert batch_res["total_knocked_off"] == Decimal("10000.00")

    # 5. Generate Statement of Account
    stmt = await UnifiedAccountingLedgerService.get_vendor_statement_of_account(
        session=db_session,
        company_id=tenant.company_id,
        supplier_id=supp.id,
        branch_id=tenant.branch_id,
    )

    assert stmt["supplier"]["id"] == supp.id
    assert stmt["supplier"]["code"] == supp.code

    summary = stmt["summary"]
    assert summary["opening_balance"] == Decimal("0.00")
    assert summary["total_billed"] == Decimal("50000.00")
    assert summary["total_paid"] == Decimal("20000.00")
    assert summary["total_knocked_off"] == Decimal("10000.00")
    assert summary["closing_balance"] == Decimal("20000.00")
    assert summary["unallocated_advance"] == Decimal("5000.00")
    assert summary["net_payable"] == Decimal("15000.00")

    lines = stmt["lines"]
    assert len(lines) == 3  # Bill, Payment, Knock-Off
    # Verify running balance
    assert lines[0]["credit"] == Decimal("50000.00")
    assert lines[0]["running_balance"] == Decimal("50000.00")
    assert lines[1]["debit"] == Decimal("20000.00")
    assert lines[1]["running_balance"] == Decimal("30000.00")
    assert lines[2]["debit"] == Decimal("10000.00")
    assert lines[2]["running_balance"] == Decimal("20000.00")


async def test_vendor_statement_date_range_and_opening_balance(db_session):
    """
    Verifies that date range filtering accurately computes opening balance from prior transactions
    and includes only in-period transactions.
    """
    tenant, user, company = await setup_test_tenant(db_session)
    supp = await create_test_supplier(db_session, tenant.company_id)

    # Prior month transaction: Bill ₹35,000 and Payment ₹10,000 -> Net liability = ₹25,000
    prior_date = date(2026, 8, 15)
    bill_prior = await create_confirmed_purchase_bill(
        db_session, tenant.company_id, tenant.branch_id, supp.id,
        bill_no="PB-AUG-001", total_amt=Decimal("35000.00"), bill_date=prior_date
    )
    svc = SupplierPaymentService(db_session, tenant)
    await svc.record_payment(
        SupplierPaymentCreate(
            id=f"pay_{uuid.uuid4().hex[:8]}",
            supplier_id=supp.id,
            amount=Decimal("10000.00"),
            payment_mode="BANK_TRANSFER",
            reference_no="NEFT-AUG-01",
            payment_date=prior_date + timedelta(days=2),
            bill_id=bill_prior.id,
        ),
        created_by=user.id,
    )

    # In-period transaction: September Bill ₹15,000
    in_period_date = date(2026, 9, 10)
    await create_confirmed_purchase_bill(
        db_session, tenant.company_id, tenant.branch_id, supp.id,
        bill_no="PB-SEP-001", total_amt=Decimal("15000.00"), bill_date=in_period_date
    )

    # Query statement for September only (from_date = 2026-09-01)
    stmt = await UnifiedAccountingLedgerService.get_vendor_statement_of_account(
        session=db_session,
        company_id=tenant.company_id,
        supplier_id=supp.id,
        from_date=date(2026, 9, 1),
        to_date=date(2026, 9, 30),
        branch_id=tenant.branch_id,
    )

    summary = stmt["summary"]
    # Opening balance should equal ₹35,000 - ₹10,000 = ₹25,000
    assert summary["opening_balance"] == Decimal("25000.00")
    assert summary["total_billed"] == Decimal("15000.00")
    assert summary["closing_balance"] == Decimal("40000.00")

    # In-period lines should only contain September bill
    lines = stmt["lines"]
    assert len(lines) == 1
    assert lines[0]["voucher_no"] == "PB-SEP-001" or "JV-" in lines[0]["voucher_no"]
    assert lines[0]["credit"] == Decimal("15000.00")
    assert lines[0]["running_balance"] == Decimal("40000.00")


async def test_vendor_statement_empty_vendor(db_session):
    """
    Verifies that a vendor with zero transactions returns clean zero balances without errors.
    """
    tenant, user, company = await setup_test_tenant(db_session)
    supp = await create_test_supplier(db_session, tenant.company_id, name="Fresh New Supplier")

    stmt = await UnifiedAccountingLedgerService.get_vendor_statement_of_account(
        session=db_session,
        company_id=tenant.company_id,
        supplier_id=supp.id,
        branch_id=tenant.branch_id,
    )

    assert stmt["supplier"]["id"] == supp.id
    assert stmt["summary"]["opening_balance"] == Decimal("0.00")
    assert stmt["summary"]["closing_balance"] == Decimal("0.00")
    assert stmt["summary"]["unallocated_advance"] == Decimal("0.00")
    assert stmt["summary"]["net_payable"] == Decimal("0.00")
    assert stmt["lines"] == []
    assert stmt["unpaid_bills_count"] == 0
    assert stmt["active_advances_count"] == 0


async def test_vendor_statement_tenant_isolation(db_session):
    """
    Verifies that querying statement for a vendor from a different company returns 404.
    """
    tenant_a, user_a, _ = await setup_test_tenant(db_session)
    tenant_b, user_b, _ = await setup_test_tenant(db_session)

    supp_a = await create_test_supplier(db_session, tenant_a.company_id)

    with pytest.raises(HTTPException) as exc_info:
        await UnifiedAccountingLedgerService.get_vendor_statement_of_account(
            session=db_session,
            company_id=tenant_b.company_id,
            supplier_id=supp_a.id,
        )
    assert exc_info.value.status_code == 404
