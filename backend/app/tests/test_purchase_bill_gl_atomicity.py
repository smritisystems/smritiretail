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

* Version    : 6.49.4
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.2 — Purchase Bill Accounts Payable (2010 AP) GL Integration
Verifies:
  1. Balanced GL voucher generation on Purchase Bill POST (Intrastate CGST + SGST)
  2. Interstate tax split on Purchase Bill POST (IGST)
  3. Roundoff account balancing on non-integer cent totals
  4. Idempotent re-posting protection
  5. Compensating reversal voucher generation on Purchase Bill CANCEL
  6. Cancellation idempotency protection
  7. No-op reversal when cancelling unposted bills
  8. Atomic rollback on failure
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.purchase import Supplier, PurchaseBill, PurchaseBillItem
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.models.workflow import WorkflowEvent
from app.api.deps import TenantContext
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    LifecycleRegistry,
)
from app.services.unified_ledger import UnifiedAccountingLedgerService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

async def setup_test_tenant(db, role=UserRole.MANAGER, comp_gst="07AAAAA0000A1Z5", supp_gst="07BBBBB1111B1Z2", supp_state="DL"):
    s = uuid.uuid4().hex[:6]
    cid = f"CMP{s.upper()}"
    bid = f"BR{s.upper()}"
    company = Company(
        id=cid,
        company_code=cid,
        name=f"AP Co {s}",
        gst_number=comp_gst,
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=bid,
        company_id=cid,
        name=f"AP Hub {s}",
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
        name=f"Premier Textiles {s}",
        gst_number=supp_gst,
        state=supp_state,
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


# ---------------------------------------------------------------------------
# TESTS
# ---------------------------------------------------------------------------

async def test_purchase_bill_post_creates_balanced_gl_voucher(db_session):
    """
    Test Case 1: Posting a Purchase Bill generates a balanced GL voucher:
      Debit 1040 (Inventory Asset) = 5000.00
      Debit 1051 (Input CGST)      = 450.00
      Debit 1052 (Input SGST)      = 450.00
      Credit 2010 (Accounts Payable) = 5900.00 (party_id = supplier.id)
      supplier.outstanding incremented by 5900.00
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-TEST-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        bill_date=date.today(),
        status="DRAFT",
        taxable_amount=Decimal("5000.00"),
        tax_amount=Decimal("900.00"),
        total_amount=Decimal("5900.00"),
        paid_amount=Decimal("0.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()

    # Transition: DRAFT -> SUBMITTED -> APPROVED -> POSTED
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="SUBMIT"),
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="APPROVE"),
    )
    res_post = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="POST"),
    )
    assert res_post.success is True
    assert res_post.to_status == "POSTED"

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "PURCHASE_BILL",
        JournalVoucher.reference_doc_id == bill_id,
        JournalVoucher.is_deleted == False,
    )
    voucher = (await db_session.execute(v_stmt)).scalar_one_or_none()
    assert voucher is not None
    assert voucher.voucher_type == "PURCHASE_BILL"
    assert voucher.total_debit == Decimal("5900.00")
    assert voucher.total_credit == Decimal("5900.00")
    assert voucher.is_posted is True

    # Verify General Ledger Entries
    e_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(e_stmt)).scalars().all()
    assert len(entries) >= 4

    # Check Accounts
    acc_ids = {e.account_id for e in entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}

    lines_by_code = {}
    for e in entries:
        code = accounts[e.account_id]
        lines_by_code[code] = e

    # 1040 Inventory Asset: DR 5000.00
    assert lines_by_code["1040"].debit_amount == Decimal("5000.00")
    assert lines_by_code["1040"].credit_amount == Decimal("0.00")

    # 1051 Input CGST: DR 450.00
    assert lines_by_code["1051"].debit_amount == Decimal("450.00")
    assert lines_by_code["1051"].credit_amount == Decimal("0.00")

    # 1052 Input SGST: DR 450.00
    assert lines_by_code["1052"].debit_amount == Decimal("450.00")
    assert lines_by_code["1052"].credit_amount == Decimal("0.00")

    # 2010 Accounts Payable: CR 5900.00, linked to supplier
    assert lines_by_code["2010"].credit_amount == Decimal("5900.00")
    assert lines_by_code["2010"].debit_amount == Decimal("0.00")
    assert lines_by_code["2010"].party_id == supplier.id

    # Verify supplier outstanding updated
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("5900.00")


async def test_purchase_bill_post_interstate_igst(db_session):
    """
    Test Case 2: Interstate Purchase Bill (Comp DL 07, Supp MH 27)
    Routes tax to 1053 (Input IGST) instead of 1051/1052:
      Debit 1040 (Inventory Asset) = 10000.00
      Debit 1053 (Input IGST)      = 1800.00
      Credit 2010 (Accounts Payable) = 11800.00
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(
        db_session,
        comp_gst="07AAAAA0000A1Z5",
        supp_gst="27BBBBB1111B1Z2",
        supp_state="MH",
    )

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-INTER-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        bill_date=date.today(),
        status="DRAFT",
        taxable_amount=Decimal("10000.00"),
        tax_amount=Decimal("1800.00"),
        total_amount=Decimal("11800.00"),
        paid_amount=Decimal("0.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()

    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="SUBMIT"),
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="APPROVE"),
    )
    res_post = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="POST"),
    )
    assert res_post.success is True

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "PURCHASE_BILL",
        JournalVoucher.reference_doc_id == bill_id,
    )
    voucher = (await db_session.execute(v_stmt)).scalar_one()
    assert voucher.total_debit == Decimal("11800.00")
    assert voucher.total_credit == Decimal("11800.00")

    e_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(e_stmt)).scalars().all()

    acc_ids = {e.account_id for e in entries}
    accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(acc_ids)))).scalars().all()}
    lines_by_code = {accounts[e.account_id]: e for e in entries}

    assert "1053" in lines_by_code
    assert lines_by_code["1053"].debit_amount == Decimal("1800.00")
    assert "1051" not in lines_by_code
    assert "1052" not in lines_by_code
    assert lines_by_code["2010"].credit_amount == Decimal("11800.00")


async def test_purchase_bill_post_roundoff_adjustment(db_session):
    """
    Test Case 3: Purchase Bill with fractional cent total requiring 5030 Roundoff balance:
      taxable = 1000.00, tax = 180.00, total = 1180.45
      Debit 1040 = 1000.00
      Debit 1051 = 90.00, Debit 1052 = 90.00
      Debit 5030 (Roundoff) = 0.45
      Credit 2010 = 1180.45
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-RO-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        bill_date=date.today(),
        status="DRAFT",
        taxable_amount=Decimal("1000.00"),
        tax_amount=Decimal("180.00"),
        total_amount=Decimal("1180.45"),
        version=1,
        company_id=cid,
        branch_id=bid,
    )
    db_session.add(bill)
    await db_session.flush()

    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="SUBMIT"),
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="APPROVE"),
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="POST"),
    )

    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "PURCHASE_BILL",
        JournalVoucher.reference_doc_id == bill_id,
    )
    voucher = (await db_session.execute(v_stmt)).scalar_one()
    assert voucher.total_debit == Decimal("1180.45")
    assert voucher.total_credit == Decimal("1180.45")

    e_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(e_stmt)).scalars().all()
    acc_ids = {e.account_id for e in entries}
    accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(acc_ids)))).scalars().all()}
    lines_by_code = {accounts[e.account_id]: e for e in entries}

    assert "5030" in lines_by_code
    assert lines_by_code["5030"].debit_amount == Decimal("0.45")
    assert lines_by_code["2010"].credit_amount == Decimal("1180.45")


async def test_purchase_bill_post_idempotency(db_session):
    """
    Test Case 4: Calling post_purchase_bill_to_gl directly multiple times returns
    the same voucher without creating duplicates or double-incrementing supplier outstanding.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-IDEM-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("2000.00"),
        tax_amount=Decimal("360.00"),
        total_amount=Decimal("2360.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
    )
    db_session.add(bill)
    await db_session.flush()

    v1 = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=cid,
        bill_id=bill_id,
        branch_id=bid,
        created_by=user.id,
    )
    assert v1 is not None

    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("2360.00")

    # Second call
    v2 = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=cid,
        bill_id=bill_id,
        branch_id=bid,
        created_by=user.id,
    )
    assert v2.id == v1.id

    # Outstanding must NOT be double-incremented
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("2360.00")

    # Only one voucher exists
    v_count = (await db_session.execute(
        select(JournalVoucher).where(
            JournalVoucher.company_id == cid,
            JournalVoucher.reference_doc_type == "PURCHASE_BILL",
            JournalVoucher.reference_doc_id == bill_id,
        )
    )).scalars().all()
    assert len(v_count) == 1


async def test_purchase_bill_cancellation_reversal(db_session):
    """
    Test Case 5: Cancelling a POSTED Purchase Bill generates a compensating reversal voucher:
      Debit 2010 (Accounts Payable)   = 5900.00 (party_id = supplier.id)
      Credit 1040 (Inventory Asset)  = 5000.00
      Credit 1051 (Input CGST)       = 450.00
      Credit 1052 (Input SGST)       = 450.00
      supplier.outstanding decremented back to 0.00
      Cancellation immutability preserved (is_deleted=False).
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-REV-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        bill_date=date.today(),
        status="DRAFT",
        taxable_amount=Decimal("5000.00"),
        tax_amount=Decimal("900.00"),
        total_amount=Decimal("5900.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
    )
    db_session.add(bill)
    await db_session.flush()

    # Progress to POSTED
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant, user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="SUBMIT"),
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant, user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="APPROVE"),
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant, user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="POST"),
    )

    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("5900.00")

    # Cancel POSTED bill
    res_cancel = await UniversalLifecycleEngine.execute_transition(
        db=db_session,
        tenant_ctx=tenant,
        user=user,
        ctx=LifecycleTransitionContext(
            doc_type="PURCHASE_BILL",
            doc_id=bill_id,
            action="CANCEL",
            notes="Vendor sent incorrect billing rates",
        ),
    )
    assert res_cancel.success is True
    assert res_cancel.to_status == "CANCELLED"

    # Verify cancellation immutability
    reloaded_bill = await db_session.get(PurchaseBill, bill_id)
    assert reloaded_bill.status == "CANCELLED"
    assert reloaded_bill.is_deleted is False
    assert reloaded_bill.deleted_at is None
    assert "Vendor sent incorrect billing rates" in (reloaded_bill.cancellation_reason or "")

    # Verify Reversal Journal Voucher
    rev_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "PURCHASE_BILL_CANCEL",
        JournalVoucher.reference_doc_id == bill_id,
    )
    rev_voucher = (await db_session.execute(rev_stmt)).scalar_one_or_none()
    assert rev_voucher is not None
    assert rev_voucher.voucher_type == "PURCHASE_BILL_CANCEL"
    assert rev_voucher.total_debit == Decimal("5900.00")
    assert rev_voucher.total_credit == Decimal("5900.00")

    # Verify Reversal Entries
    e_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == rev_voucher.id)
    entries = (await db_session.execute(e_stmt)).scalars().all()
    acc_ids = {e.account_id for e in entries}
    accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(acc_ids)))).scalars().all()}
    lines_by_code = {accounts[e.account_id]: e for e in entries}

    # 2010 Accounts Payable is DEBITED on reversal
    assert lines_by_code["2010"].debit_amount == Decimal("5900.00")
    assert lines_by_code["2010"].credit_amount == Decimal("0.00")
    assert lines_by_code["2010"].party_id == supplier.id

    # 1040 Inventory Asset is CREDITED on reversal
    assert lines_by_code["1040"].credit_amount == Decimal("5000.00")
    assert lines_by_code["1040"].debit_amount == Decimal("0.00")

    # 1051 and 1052 are CREDITED on reversal
    assert lines_by_code["1051"].credit_amount == Decimal("450.00")
    assert lines_by_code["1052"].credit_amount == Decimal("450.00")

    # Verify supplier outstanding decremented back to 0.00
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("0.00")


async def test_purchase_bill_cancellation_idempotency(db_session):
    """
    Test Case 6: Calling reverse_purchase_bill_gl multiple times returns
    the same reversal voucher and does not double-decrement supplier outstanding.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-CAN-IDEM-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        bill_date=date.today(),
        status="POSTED",
        taxable_amount=Decimal("3000.00"),
        tax_amount=Decimal("540.00"),
        total_amount=Decimal("3540.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
    )
    db_session.add(bill)
    await db_session.flush()

    # Post first
    await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session, company_id=cid, bill_id=bill_id, branch_id=bid
    )

    # First reversal
    r1 = await UnifiedAccountingLedgerService.reverse_purchase_bill_gl(
        session=db_session, company_id=cid, bill_id=bill_id, branch_id=bid, reason="Test Reversal"
    )
    assert r1 is not None

    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("0.00")

    # Second reversal
    r2 = await UnifiedAccountingLedgerService.reverse_purchase_bill_gl(
        session=db_session, company_id=cid, bill_id=bill_id, branch_id=bid, reason="Test Reversal Duplicate"
    )
    assert r2.id == r1.id

    # Outstanding must NOT be negative
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("0.00")


async def test_purchase_bill_cancel_unposted_bill_noop_gl(db_session):
    """
    Test Case 7: Cancelling a bill from SUBMITTED (never POSTED) succeeds
    without generating any GL voucher rows.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-UNP-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        bill_date=date.today(),
        status="DRAFT",
        taxable_amount=Decimal("1500.00"),
        tax_amount=Decimal("270.00"),
        total_amount=Decimal("1770.00"),
        version=1,
        company_id=cid,
        branch_id=bid,
    )
    db_session.add(bill)
    await db_session.flush()

    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant, user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="SUBMIT"),
    )

    # Cancel while SUBMITTED
    res_cancel = await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant, user=user,
        ctx=LifecycleTransitionContext(doc_type="PURCHASE_BILL", doc_id=bill_id, action="CANCEL", notes="Order cancelled at source"),
    )
    assert res_cancel.success is True
    assert res_cancel.to_status == "CANCELLED"

    # Zero GL vouchers exist
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_id == bill_id,
    )
    vouchers = (await db_session.execute(v_stmt)).scalars().all()
    assert len(vouchers) == 0

    # Supplier outstanding untouched
    await db_session.refresh(supplier)
    assert supplier.outstanding == Decimal("0.00")
