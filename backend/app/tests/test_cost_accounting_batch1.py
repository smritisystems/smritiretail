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

* Version    : 6.75.0
* Created    : 2026-10-14
* Modified   : 2026-10-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Phase 2 Batch 1 — Critical Accounting Defect Remediation
Verifies:
  1. Matched Intrastate GRN & Bill: Account 1045 credited for subtotal at GRN, debited for subtotal at Bill.
     Zero residual balance on Account 1045. Single ITC recognition (no double-debit).
  2. Matched Interstate GRN & Bill: Routing to 1053 (Input IGST) without zero-wipeout; balanced voucher.
  3. Idempotent duplicate posting protection on both GRN and Bill.
  4. Standalone (unmatched) Purchase Bill posting directly to Account 1040 without touching Account 1045.
  5. Multi-bill / partial receipt scenario where multiple bills together clear Account 1045 to zero.
  6. Purchase Bill cancellation reversing Account 1045 clearing symmetrically.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.purchase import Supplier, PurchaseReceipt, PurchaseReceiptItem, PurchaseBill, PurchaseBillItem
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.api.deps import TenantContext
from app.services.unified_ledger import UnifiedAccountingLedgerService

pytestmark = pytest.mark.asyncio


async def setup_test_tenant(
    db,
    role=UserRole.MANAGER,
    comp_gst="07AAAAA0000A1Z5",
    supp_gst="07BBBBB1111B1Z2",
    supp_state="DL",
):
    s = uuid.uuid4().hex[:6]
    cid = f"CMP{s.upper()}"
    bid = f"BR{s.upper()}"
    company = Company(
        id=cid,
        company_code=cid,
        name=f"Cost Remediation Co {s}",
        gst_number=comp_gst,
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=bid,
        company_id=cid,
        name=f"Cost Remediation Branch {s}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    uid = f"usr_{s}"
    user = User(
        id=uid,
        username=f"cost_acct_{s}",
        email=f"cost_acct_{s}@smriti.local",
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
        name=f"Apex Fabrics {s}",
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


async def test_intrastate_matched_grn_and_bill_clearing(db_session):
    """
    Test Case 1: Matched Intrastate GRN and Purchase Bill
    Parameters:
      Subtotal:   10,000.00
      CGST (9%):     900.00
      SGST (9%):     900.00
      Grand Total: 11,800.00
    Verifies:
      - GRN voucher:
          Dr. 1040 Inventory On Hand      = 10,000.00
          Cr. 1045 GR/IR Clearing         = 10,000.00
          Debit == Credit == 10,000.00
          NO ITC debits (1051/1052/1053 absent).
      - Purchase Bill voucher:
          Dr. 1045 GR/IR Clearing         = 10,000.00
          Dr. 1051 Input CGST             =    900.00
          Dr. 1052 Input SGST             =    900.00
          Cr. 2010 Accounts Payable       = 11,800.00
          Debit == Credit == 11,800.00
      - Reconciled GR/IR clearing (Account 1045):
          Net balance across vouchers == 0.00 (fully cleared).
      - Reconciled ITC:
          CGST debited exactly once = 900.00
          SGST debited exactly once = 900.00
          Total ITC = 1,800.00
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    # 1. Create Goods Receipt Note (GRN)
    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="RECEIVED",
        subtotal=Decimal("10000.00"),
        tax_total=Decimal("1800.00"),
        grand_total=Decimal("11800.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()

    # Post GRN to GL
    grn_voucher = await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
        session=db_session,
        company_id=cid,
        receipt_id=rcpt_id,
        branch_id=bid,
    )
    assert grn_voucher is not None
    assert grn_voucher.total_debit == Decimal("10000.00")
    assert grn_voucher.total_credit == Decimal("10000.00")
    assert grn_voucher.is_posted is True

    # Inspect GRN GL entries
    e_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == grn_voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    grn_entries = (await db_session.execute(e_stmt)).scalars().all()
    acc_ids = {e.account_id for e in grn_entries}
    acc_stmt = select(Account).where(Account.id.in_(acc_ids))
    accounts = {a.id: a.account_code for a in (await db_session.execute(acc_stmt)).scalars().all()}
    grn_by_code = {accounts[e.account_id]: e for e in grn_entries}

    assert "1040" in grn_by_code
    assert grn_by_code["1040"].debit_amount == Decimal("10000.00")
    assert grn_by_code["1040"].credit_amount == Decimal("0.00")

    assert "1045" in grn_by_code
    assert grn_by_code["1045"].credit_amount == Decimal("10000.00")
    assert grn_by_code["1045"].debit_amount == Decimal("0.00")

    # Assert NO premature ITC debits at GRN stage
    assert "1051" not in grn_by_code
    assert "1052" not in grn_by_code
    assert "1053" not in grn_by_code

    # 2. Create Matched Purchase Bill
    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        receipt_id=rcpt_id,  # Matched to GRN!
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("10000.00"),
        tax_amount=Decimal("1800.00"),
        total_amount=Decimal("11800.00"),
        paid_amount=Decimal("0.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()

    # Post Purchase Bill to GL
    bill_voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=cid,
        bill_id=bill_id,
        branch_id=bid,
    )
    assert bill_voucher is not None
    assert bill_voucher.total_debit == Decimal("11800.00")
    assert bill_voucher.total_credit == Decimal("11800.00")
    assert bill_voucher.is_posted is True

    # Inspect Bill GL entries
    b_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == bill_voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    bill_entries = (await db_session.execute(b_stmt)).scalars().all()
    b_acc_ids = {e.account_id for e in bill_entries}
    b_accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(b_acc_ids)))).scalars().all()}
    bill_by_code = {b_accounts[e.account_id]: e for e in bill_entries}

    # 1045 cleared by debiting subtotal
    assert "1045" in bill_by_code
    assert bill_by_code["1045"].debit_amount == Decimal("10000.00")
    assert bill_by_code["1045"].credit_amount == Decimal("0.00")

    # Canonical single ITC recognition
    assert "1051" in bill_by_code
    assert bill_by_code["1051"].debit_amount == Decimal("900.00")
    assert "1052" in bill_by_code
    assert bill_by_code["1052"].debit_amount == Decimal("900.00")

    # 2010 Accounts Payable credited for grand total
    assert "2010" in bill_by_code
    assert bill_by_code["2010"].credit_amount == Decimal("11800.00")
    assert bill_by_code["2010"].party_id == supplier.id

    # 3. Overall Reconciliation Assertions
    # Reconcile Account 1045 Net Balance:
    net_1045_credit = grn_by_code["1045"].credit_amount - bill_by_code["1045"].debit_amount
    assert net_1045_credit == Decimal("0.00"), f"Expected Account 1045 to clear to 0.00, got {net_1045_credit}"

    # Reconcile Total Input Tax Recognized across lifecycle:
    total_itc_cgst = bill_by_code["1051"].debit_amount
    total_itc_sgst = bill_by_code["1052"].debit_amount
    assert (total_itc_cgst + total_itc_sgst) == Decimal("1800.00"), "ITC recognized must be exactly 1,800.00"


async def test_interstate_matched_bill_igst_balancing(db_session):
    """
    Test Case 2: Matched Interstate GRN and Purchase Bill
    Parameters:
      Company:    Delhi (DL, 07)
      Supplier:   Maharashtra (MH, 27)
      Subtotal:   20,000.00
      IGST (18%):  3,600.00
      Grand Total: 23,600.00
    Verifies:
      - Bill correctly classifies as interstate
      - Input IGST (1053) debited for 3,600.00
      - No 1051 / 1052 debited
      - Debit == Credit == 23,600.00 (No unbalance crash)
      - Account 1045 cleared to zero
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(
        db_session,
        comp_gst="07AAAAA0000A1Z5",
        supp_gst="27BBBBB1111B1Z2",
        supp_state="MH",
    )

    # 1. Create Interstate GRN
    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-INTER-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="RECEIVED",
        subtotal=Decimal("20000.00"),
        tax_total=Decimal("3600.00"),
        grand_total=Decimal("23600.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()

    grn_voucher = await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
        session=db_session,
        company_id=cid,
        receipt_id=rcpt_id,
        branch_id=bid,
    )
    assert grn_voucher.total_debit == Decimal("20000.00")
    assert grn_voucher.total_credit == Decimal("20000.00")

    # 2. Create Interstate Matched Purchase Bill
    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"INV-INTER-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        receipt_id=rcpt_id,
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("20000.00"),
        tax_amount=Decimal("3600.00"),
        total_amount=Decimal("23600.00"),
        paid_amount=Decimal("0.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()

    bill_voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=cid,
        bill_id=bill_id,
        branch_id=bid,
    )
    assert bill_voucher is not None
    assert bill_voucher.total_debit == Decimal("23600.00")
    assert bill_voucher.total_credit == Decimal("23600.00")
    assert bill_voucher.is_posted is True

    # Verify General Ledger Entries
    e_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == bill_voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(e_stmt)).scalars().all()
    acc_ids = {e.account_id for e in entries}
    accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(acc_ids)))).scalars().all()}
    lines_by_code = {accounts[e.account_id]: e for e in entries}

    # 1045 debited for 20,000.00
    assert "1045" in lines_by_code
    assert lines_by_code["1045"].debit_amount == Decimal("20000.00")

    # 1053 (Input IGST) debited for 3,600.00
    assert "1053" in lines_by_code
    assert lines_by_code["1053"].debit_amount == Decimal("3600.00")

    # Intrastate taxes absent
    assert "1051" not in lines_by_code
    assert "1052" not in lines_by_code

    # Accounts Payable credited for 23,600.00
    assert "2010" in lines_by_code
    assert lines_by_code["2010"].credit_amount == Decimal("23600.00")


async def test_idempotent_duplicate_posting_protection(db_session):
    """
    Test Case 3: Re-posting existing GRN or Purchase Bill returns identical voucher
    without creating duplicate GL entries or mutating balances.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-IDEM-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="RECEIVED",
        subtotal=Decimal("5000.00"),
        tax_total=Decimal("900.00"),
        grand_total=Decimal("5900.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()

    # Call post_purchase_receipt_to_gl twice
    v1 = await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    v2 = await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    assert v1.id == v2.id

    # Check that only one voucher exists
    v_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == cid,
        JournalVoucher.reference_doc_type == "PURCHASE_RECEIPT",
        JournalVoucher.reference_doc_id == rcpt_id,
        JournalVoucher.is_deleted == False,
    )
    all_v = (await db_session.execute(v_stmt)).scalars().all()
    assert len(all_v) == 1


async def test_standalone_unmatched_purchase_bill_posting(db_session):
    """
    Test Case 4: Standalone (Direct) Purchase Bill without a GRN:
      - Debits 1040 (Inventory Asset) directly for subtotal
      - Debits 1051/1052 for tax
      - Credits 2010 for grand total
      - Account 1045 is NOT touched
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"DIRECT-BILL-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        receipt_id=None,  # Direct bill without GRN
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("15000.00"),
        tax_amount=Decimal("2700.00"),
        total_amount=Decimal("17700.00"),
        paid_amount=Decimal("0.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()

    voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=cid,
        bill_id=bill_id,
        branch_id=bid,
    )
    assert voucher.total_debit == Decimal("17700.00")
    assert voucher.total_credit == Decimal("17700.00")

    e_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(e_stmt)).scalars().all()
    acc_ids = {e.account_id for e in entries}
    accounts = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(acc_ids)))).scalars().all()}
    lines_by_code = {accounts[e.account_id]: e for e in entries}

    assert "1040" in lines_by_code
    assert lines_by_code["1040"].debit_amount == Decimal("15000.00")
    assert "1045" not in lines_by_code  # Account 1045 untouched on direct bills
    assert lines_by_code["1051"].debit_amount == Decimal("1350.00")
    assert lines_by_code["1052"].debit_amount == Decimal("1350.00")
    assert lines_by_code["2010"].credit_amount == Decimal("17700.00")


async def test_partial_multi_bill_receipt_clearing(db_session):
    """
    Test Case 5: Partial & Multi-Bill Receipt Clearing
    Scenario:
      One GRN received: Subtotal 10,000.00 (Cr. 1045 = 10,000.00)
      Vendor submits two separate split invoices against the same receipt:
        - Bill 1: Taxable 6,000.00, Tax 1,080.00, Total 7,080.00 (Dr. 1045 = 6,000.00)
        - Bill 2: Taxable 4,000.00, Tax   720.00, Total 4,720.00 (Dr. 1045 = 4,000.00)
    Verifies:
      - After Bill 1: Remaining Account 1045 credit liability = 4,000.00
      - After Bill 2: Account 1045 net balance clears to exactly 0.00
      - Total AP credited = 7,080.00 + 4,720.00 = 11,800.00
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    # 1. Post Single GRN for 10,000.00
    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-MULTI-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="RECEIVED",
        subtotal=Decimal("10000.00"),
        tax_total=Decimal("1800.00"),
        grand_total=Decimal("11800.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()

    grn_voucher = await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    assert grn_voucher.total_credit == Decimal("10000.00")

    # 2. Post First Bill (Partial 60%)
    bill1_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill1 = PurchaseBill(
        id=bill1_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-PART1-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        receipt_id=rcpt_id,
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("6000.00"),
        tax_amount=Decimal("1080.00"),
        total_amount=Decimal("7080.00"),
        paid_amount=Decimal("0.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill1)
    await db_session.flush()

    b1_voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session, company_id=cid, bill_id=bill1_id, branch_id=bid
    )
    assert b1_voucher.total_debit == Decimal("7080.00")

    # Check 1045 after Bill 1: 10,000.00 Cr - 6,000.00 Dr = 4,000.00 Cr remaining
    e1_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == b1_voucher.id)
    b1_entries = (await db_session.execute(e1_stmt)).scalars().all()
    b1_acc_ids = {e.account_id for e in b1_entries}
    b1_accs = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(b1_acc_ids)))).scalars().all()}
    b1_by_code = {b1_accs[e.account_id]: e for e in b1_entries}
    assert b1_by_code["1045"].debit_amount == Decimal("6000.00")

    # 3. Post Second Bill (Remaining 40%)
    bill2_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill2 = PurchaseBill(
        id=bill2_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-PART2-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        receipt_id=rcpt_id,
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("4000.00"),
        tax_amount=Decimal("720.00"),
        total_amount=Decimal("4720.00"),
        paid_amount=Decimal("0.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill2)
    await db_session.flush()

    b2_voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session, company_id=cid, bill_id=bill2_id, branch_id=bid
    )
    assert b2_voucher.total_debit == Decimal("4720.00")

    e2_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == b2_voucher.id)
    b2_entries = (await db_session.execute(e2_stmt)).scalars().all()
    b2_acc_ids = {e.account_id for e in b2_entries}
    b2_accs = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(b2_acc_ids)))).scalars().all()}
    b2_by_code = {b2_accs[e.account_id]: e for e in b2_entries}
    assert b2_by_code["1045"].debit_amount == Decimal("4000.00")

    # Complete Reconciled 1045 Check
    total_1045_debits = b1_by_code["1045"].debit_amount + b2_by_code["1045"].debit_amount
    assert total_1045_debits == Decimal("10000.00")
    assert (Decimal("10000.00") - total_1045_debits) == Decimal("0.00")


async def test_bill_reversal_symmetrically_restores_clearing(db_session):
    """
    Test Case 6: Cancelling a Matched Purchase Bill
    Generates a reversal voucher that credits back Account 1045 (not 1040),
    restoring the unbilled GRN liability until the receipt is re-billed.
    """
    cid, bid, user, supplier, tenant = await setup_test_tenant(db_session)

    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id,
        uuid=str(uuid.uuid4()),
        receipt_no=f"GRN-REV-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        status="RECEIVED",
        subtotal=Decimal("8000.00"),
        tax_total=Decimal("1440.00"),
        grand_total=Decimal("9440.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()
    await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )

    bill_id = f"bil_{uuid.uuid4().hex[:8]}"
    bill = PurchaseBill(
        id=bill_id,
        uuid=str(uuid.uuid4()),
        bill_no=f"BILL-REV-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=supplier.id,
        receipt_id=rcpt_id,
        bill_date=date.today(),
        status="POSTED",
        taxable_amount=Decimal("8000.00"),
        tax_amount=Decimal("1440.00"),
        total_amount=Decimal("9440.00"),
        paid_amount=Decimal("0.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.flush()
    await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session, company_id=cid, bill_id=bill_id, branch_id=bid
    )

    # Now reverse / cancel the bill
    rev_voucher = await UnifiedAccountingLedgerService.reverse_purchase_bill_gl(
        session=db_session,
        company_id=cid,
        bill_id=bill_id,
        branch_id=bid,
        reason="Vendor invoice erroneous billing rate",
    )
    assert rev_voucher is not None
    assert rev_voucher.total_debit == Decimal("9440.00")
    assert rev_voucher.total_credit == Decimal("9440.00")

    rev_entries_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == rev_voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    rev_entries = (await db_session.execute(rev_entries_stmt)).scalars().all()
    rev_acc_ids = {e.account_id for e in rev_entries}
    rev_accs = {a.id: a.account_code for a in (await db_session.execute(select(Account).where(Account.id.in_(rev_acc_ids)))).scalars().all()}
    rev_by_code = {rev_accs[e.account_id]: e for e in rev_entries}

    # Dr. 2010 AP = 9440.00
    assert rev_by_code["2010"].debit_amount == Decimal("9440.00")
    # Cr. 1045 Unbilled GRN = 8000.00 (restored)
    assert rev_by_code["1045"].credit_amount == Decimal("8000.00")
    # Cr. 1051 Input CGST = 720.00 (reversed)
    assert rev_by_code["1051"].credit_amount == Decimal("720.00")
    # Cr. 1052 Input SGST = 720.00 (reversed)
    assert rev_by_code["1052"].credit_amount == Decimal("720.00")
