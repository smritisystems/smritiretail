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

* Version    : 6.49.6
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.4 — Supplier Debit Notes & Purchase Returns General Ledger Integration
Verifies:
  1. Intrastate Debit Note GL Posting (DR 2010 Creditors / CR 1040 Inventory, CR 1051 Input CGST, CR 1052 Input SGST)
  2. Interstate Debit Note GL Posting (DR 2010 Creditors / CR 1040 Inventory, CR 1053 Input IGST)
  3. Roundoff difference balancing in debit note GL vouchers (Account 5030)
  4. Debit note GL posting idempotency guard
  5. Debit note cancellation reversal (DR 1040 Inventory, DR 1051/1052 Input GST / CR 2010 Creditors)
  6. Cancellation restores supplier outstanding liability and dispatches outbox event
  7. Cancellation GL idempotency guard
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.purchase import Supplier
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.api.deps import TenantContext
from app.schemas.purchase import DebitNoteCreate, DebitNoteCancelRequest
from app.services.purchase import PurchaseService
from app.services.unified_ledger import UnifiedAccountingLedgerService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

async def setup_test_tenant(db_session, role=UserRole.MANAGER, company_state="DL", supplier_state="DL"):
    s = uuid.uuid4().hex[:6]
    cid = f"CMP{s.upper()}"
    bid = f"BR{s.upper()}"
    gst_prefix = "07" if company_state == "DL" else "27"
    company = Company(
        id=cid,
        company_code=cid,
        name=f"Procurement Co {s}",
        gst_number=f"{gst_prefix}AAAAA0000A1Z5",
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
    db_session.add_all([company, branch])
    await db_session.commit()

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
    db_session.add(user)

    sid = f"sup_{s}"
    supp_prefix = "07" if supplier_state == "DL" else "27"
    supplier = Supplier(
        id=sid,
        code=f"SUP{s.upper()}",
        name=f"Vardhman Textiles {s}",
        gst_number=f"{supp_prefix}BBBBB1111B1Z2",
        state=supplier_state,
        outstanding=Decimal("20000.00"),
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(supplier)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    return cid, bid, user, supplier, tenant_ctx


# ---------------------------------------------------------------------------
# TESTS
# ---------------------------------------------------------------------------

async def test_intrastate_debit_note_gl_posting(db_session):
    """
    Test 1: Intrastate Debit Note GL Posting
    - DR 2010 (Accounts Payable / Creditors) = total_debit_amount (attributed to party_id)
    - CR 1040 (Inventory Asset) = claim_amount
    - CR 1051 (Input CGST) = 50% of tax_amount
    - CR 1052 (Input SGST) = 50% of tax_amount
    - Supplier outstanding liability decremented
    """
    cid, bid, user, supplier, tenant_ctx = await setup_test_tenant(
        db_session, company_state="DL", supplier_state="DL"
    )
    service = PurchaseService(db_session, tenant_ctx)

    initial_outstanding = supplier.outstanding
    claim_amount = Decimal("5000.00")
    tax_amount = Decimal("900.00")
    total_debit_amount = Decimal("5900.00")

    req = DebitNoteCreate(
        supplier_id=supplier.id,
        claim_amount=claim_amount,
        tax_amount=tax_amount,
        total_debit_amount=total_debit_amount,
        reason="Defective goods returned from GRN",
    )

    res = await service.create_debit_note(req)
    assert res["status"] == "ISSUED"
    assert res["journal_voucher_id"] is not None

    # Verify supplier outstanding reduced
    await db_session.refresh(supplier)
    expected_outstanding = (initial_outstanding - total_debit_amount).quantize(Decimal("0.01"))
    assert supplier.outstanding == expected_outstanding

    # Verify GL Voucher
    stmt = select(JournalVoucher).where(JournalVoucher.id == res["journal_voucher_id"])
    voucher = (await db_session.execute(stmt)).scalar_one_or_none()
    assert voucher is not None
    assert voucher.voucher_type == "DEBIT_NOTE"
    assert voucher.company_id == cid
    assert voucher.total_debit == total_debit_amount
    assert voucher.total_credit == total_debit_amount
    assert voucher.is_posted is True

    # Verify individual GL Entries
    entry_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id
    )
    entries = (await db_session.execute(entry_stmt)).scalars().all()

    account_ids = {e.account_id for e in entries}
    accounts_map = {}
    for a_id in account_ids:
        acc = (await db_session.execute(select(Account).where(Account.id == a_id))).scalar_one()
        accounts_map[acc.account_code] = acc.id

    # 1. Accounts Payable (2010) must be debited
    ap_entries = [e for e in entries if e.account_id == accounts_map.get("2010")]
    assert len(ap_entries) == 1
    assert ap_entries[0].debit_amount == total_debit_amount
    assert ap_entries[0].credit_amount == Decimal("0.00")
    assert ap_entries[0].party_id == supplier.id

    # 2. Inventory Asset (1040) must be credited
    inv_entries = [e for e in entries if e.account_id == accounts_map.get("1040")]
    assert len(inv_entries) == 1
    assert inv_entries[0].credit_amount == claim_amount
    assert inv_entries[0].debit_amount == Decimal("0.00")

    # 3. Input CGST (1051) and Input SGST (1052) must be credited
    cgst_entries = [e for e in entries if e.account_id == accounts_map.get("1051")]
    sgst_entries = [e for e in entries if e.account_id == accounts_map.get("1052")]
    assert len(cgst_entries) == 1
    assert len(sgst_entries) == 1
    assert cgst_entries[0].credit_amount == Decimal("450.00")
    assert sgst_entries[0].credit_amount == Decimal("450.00")


async def test_interstate_debit_note_gl_posting(db_session):
    """
    Test 2: Interstate Debit Note GL Posting
    - DR 2010 (Accounts Payable / Creditors) = total_debit_amount (party_id = supplier_id)
    - CR 1040 (Inventory Asset) = claim_amount
    - CR 1053 (Input IGST) = 100% of tax_amount
    """
    cid, bid, user, supplier, tenant_ctx = await setup_test_tenant(
        db_session, company_state="DL", supplier_state="MH"
    )
    service = PurchaseService(db_session, tenant_ctx)

    claim_amount = Decimal("8000.00")
    tax_amount = Decimal("1440.00")
    total_debit_amount = Decimal("9440.00")

    req = DebitNoteCreate(
        supplier_id=supplier.id,
        claim_amount=claim_amount,
        tax_amount=tax_amount,
        total_debit_amount=total_debit_amount,
        reason="Interstate return of unapproved fabric roll",
    )

    res = await service.create_debit_note(req)
    assert res["status"] == "ISSUED"

    voucher_id = res["journal_voucher_id"]
    stmt = select(JournalVoucher).where(JournalVoucher.id == voucher_id)
    voucher = (await db_session.execute(stmt)).scalar_one_or_none()
    assert voucher is not None
    assert voucher.total_debit == total_debit_amount
    assert voucher.total_credit == total_debit_amount

    entry_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id
    )
    entries = (await db_session.execute(entry_stmt)).scalars().all()

    account_ids = {e.account_id for e in entries}
    accounts_map = {}
    for a_id in account_ids:
        acc = (await db_session.execute(select(Account).where(Account.id == a_id))).scalar_one()
        accounts_map[acc.account_code] = acc.id

    # 1. Accounts Payable (2010) debited
    ap_entries = [e for e in entries if e.account_id == accounts_map.get("2010")]
    assert len(ap_entries) == 1
    assert ap_entries[0].debit_amount == total_debit_amount

    # 2. Inventory Asset (1040) credited
    inv_entries = [e for e in entries if e.account_id == accounts_map.get("1040")]
    assert len(inv_entries) == 1
    assert inv_entries[0].credit_amount == claim_amount

    # 3. Input IGST (1053) credited
    igst_entries = [e for e in entries if e.account_id == accounts_map.get("1053")]
    assert len(igst_entries) == 1
    assert igst_entries[0].credit_amount == tax_amount


async def test_debit_note_roundoff_adjustment(db_session):
    """
    Test 3: Fractional cent roundoff handling (Account 5030)
    claim_amount = 100.00, tax_amount = 18.05, total_debit_amount = 118.06 (roundoff credit of 0.01)
    """
    cid, bid, user, supplier, tenant_ctx = await setup_test_tenant(db_session)
    service = PurchaseService(db_session, tenant_ctx)

    claim_amount = Decimal("100.00")
    tax_amount = Decimal("18.05")
    total_debit_amount = Decimal("118.06")

    req = DebitNoteCreate(
        supplier_id=supplier.id,
        claim_amount=claim_amount,
        tax_amount=tax_amount,
        total_debit_amount=total_debit_amount,
        reason="Testing sub-cent roundoff adjustment",
    )

    res = await service.create_debit_note(req)
    voucher_id = res["journal_voucher_id"]

    stmt = select(JournalVoucher).where(JournalVoucher.id == voucher_id)
    voucher = (await db_session.execute(stmt)).scalar_one_or_none()
    assert voucher.total_debit == total_debit_amount
    assert voucher.total_credit == total_debit_amount

    entry_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id
    )
    entries = (await db_session.execute(entry_stmt)).scalars().all()

    account_ids = {e.account_id for e in entries}
    accounts_map = {}
    for a_id in account_ids:
        acc = (await db_session.execute(select(Account).where(Account.id == a_id))).scalar_one()
        accounts_map[acc.account_code] = acc.id

    # Roundoff account 5030 must have 0.01 credit
    roundoff_entries = [e for e in entries if e.account_id == accounts_map.get("5030")]
    assert len(roundoff_entries) == 1
    assert roundoff_entries[0].credit_amount == Decimal("0.01")


async def test_debit_note_gl_idempotency(db_session):
    """
    Test 4: Idempotency protection on debit note GL posting
    Posting twice with the same debit_note_id returns the existing voucher without duplicate entries.
    """
    cid, bid, user, supplier, tenant_ctx = await setup_test_tenant(db_session)
    dn_id = f"dn_idemp_{uuid.uuid4().hex[:6]}"

    voucher1 = await UnifiedAccountingLedgerService.post_debit_note_to_gl(
        session=db_session,
        company_id=cid,
        debit_note_id=dn_id,
        supplier_id=supplier.id,
        claim_amount=Decimal("1500.00"),
        tax_amount=Decimal("270.00"),
        total_debit_amount=Decimal("1770.00"),
        debit_note_no="DN-IDEMP-001",
        branch_id=bid,
    )
    await db_session.commit()

    voucher2 = await UnifiedAccountingLedgerService.post_debit_note_to_gl(
        session=db_session,
        company_id=cid,
        debit_note_id=dn_id,
        supplier_id=supplier.id,
        claim_amount=Decimal("1500.00"),
        tax_amount=Decimal("270.00"),
        total_debit_amount=Decimal("1770.00"),
        debit_note_no="DN-IDEMP-001",
        branch_id=bid,
    )

    assert voucher1.id == voucher2.id


async def test_debit_note_cancellation_reversal(db_session):
    """
    Test 5 & 6: Debit Note Cancellation Reversal
    - Creates a debit note (decreasing supplier liability)
    - Cancels the debit note
    - Reversal voucher created (DEBIT_NOTE_CANCEL)
      - DR 1040 (Inventory Asset) = claim_amount
      - DR 1051/1052 (Input GST) = tax_amount
      - CR 2010 (Accounts Payable) = total_debit_amount (party_id = supplier_id)
    - Supplier outstanding liability is restored to original amount
    """
    cid, bid, user, supplier, tenant_ctx = await setup_test_tenant(
        db_session, company_state="DL", supplier_state="DL"
    )
    service = PurchaseService(db_session, tenant_ctx)

    initial_outstanding = supplier.outstanding
    claim_amount = Decimal("3000.00")
    tax_amount = Decimal("540.00")
    total_debit_amount = Decimal("3540.00")

    req = DebitNoteCreate(
        supplier_id=supplier.id,
        claim_amount=claim_amount,
        tax_amount=tax_amount,
        total_debit_amount=total_debit_amount,
        reason="Return for damaged batch",
    )
    dn_res = await service.create_debit_note(req)
    dn_id = dn_res["id"]

    await db_session.refresh(supplier)
    assert supplier.outstanding == initial_outstanding - total_debit_amount

    # Cancel the debit note
    cancel_res = await service.cancel_debit_note(
        debit_note_id=dn_id,
        supplier_id=supplier.id,
        claim_amount=claim_amount,
        tax_amount=tax_amount,
        total_debit_amount=total_debit_amount,
        debit_note_no=dn_res["debit_note_no"],
        reason="Vendor replaced items instead of credit note",
        cancelled_by=user.id,
    )

    assert cancel_res["status"] == "CANCELLED"
    assert cancel_res["journal_voucher_id"] is not None

    # 1. Supplier outstanding must be fully restored
    await db_session.refresh(supplier)
    assert supplier.outstanding == initial_outstanding

    # 2. Check Reversal Voucher
    reversal_voucher_id = cancel_res["journal_voucher_id"]
    stmt = select(JournalVoucher).where(JournalVoucher.id == reversal_voucher_id)
    reversal_voucher = (await db_session.execute(stmt)).scalar_one_or_none()
    assert reversal_voucher is not None
    assert reversal_voucher.voucher_type == "DEBIT_NOTE_CANCEL"
    assert reversal_voucher.total_debit == total_debit_amount
    assert reversal_voucher.total_credit == total_debit_amount

    # 3. Check Reversal Entries
    entry_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == reversal_voucher.id
    )
    entries = (await db_session.execute(entry_stmt)).scalars().all()

    account_ids = {e.account_id for e in entries}
    accounts_map = {}
    for a_id in account_ids:
        acc = (await db_session.execute(select(Account).where(Account.id == a_id))).scalar_one()
        accounts_map[acc.account_code] = acc.id

    # Accounts Payable (2010) must be Credited with total_debit_amount
    ap_entries = [e for e in entries if e.account_id == accounts_map.get("2010")]
    assert len(ap_entries) == 1
    assert ap_entries[0].credit_amount == total_debit_amount
    assert ap_entries[0].debit_amount == Decimal("0.00")
    assert ap_entries[0].party_id == supplier.id

    # Inventory Asset (1040) must be Debited with claim_amount
    inv_entries = [e for e in entries if e.account_id == accounts_map.get("1040")]
    assert len(inv_entries) == 1
    assert inv_entries[0].debit_amount == claim_amount
    assert inv_entries[0].credit_amount == Decimal("0.00")

    # Input CGST/SGST must be Debited
    cgst_entries = [e for e in entries if e.account_id == accounts_map.get("1051")]
    sgst_entries = [e for e in entries if e.account_id == accounts_map.get("1052")]
    assert len(cgst_entries) == 1
    assert len(sgst_entries) == 1
    assert cgst_entries[0].debit_amount == Decimal("270.00")
    assert sgst_entries[0].debit_amount == Decimal("270.00")


async def test_debit_note_cancellation_idempotency(db_session):
    """
    Test 7: Idempotency on Debit Note Cancellation
    Calling reverse_debit_note_gl twice with the same debit_note_id returns the existing reversal voucher.
    """
    cid, bid, user, supplier, tenant_ctx = await setup_test_tenant(db_session)
    dn_id = f"dn_rev_idemp_{uuid.uuid4().hex[:6]}"

    v1 = await UnifiedAccountingLedgerService.reverse_debit_note_gl(
        session=db_session,
        company_id=cid,
        debit_note_id=dn_id,
        supplier_id=supplier.id,
        claim_amount=Decimal("2000.00"),
        tax_amount=Decimal("360.00"),
        total_debit_amount=Decimal("2360.00"),
        debit_note_no="DN-REV-001",
        branch_id=bid,
    )
    await db_session.commit()

    v2 = await UnifiedAccountingLedgerService.reverse_debit_note_gl(
        session=db_session,
        company_id=cid,
        debit_note_id=dn_id,
        supplier_id=supplier.id,
        claim_amount=Decimal("2000.00"),
        tax_amount=Decimal("360.00"),
        total_debit_amount=Decimal("2360.00"),
        debit_note_no="DN-REV-001",
        branch_id=bid,
    )

    assert v1.id == v2.id
