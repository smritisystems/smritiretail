"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.52.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Statutory Compliance & Government Remittance Test Suite
"""

import uuid
import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.models.tenant import Company, Branch
from app.models.party import Party, SupplierProfile
from app.models.purchase import Supplier, PurchaseBill
from app.models.auth import User
from app.api.deps import TenantContext
from app.schemas.challan_281 import Challan281Create, Challan281Response
from app.services.challan_281 import Challan281Service
from app.services.form26q_generator import Form26QGeneratorService
from app.services.unified_ledger import UnifiedAccountingLedgerService


@pytest.fixture
async def setup_tax_company(db_session: AsyncSession):
    """Sets up a tenant company, user, and seeded Chart of Accounts."""
    company_id = f"co-tax-{uuid.uuid4().hex[:6]}"
    branch_id = f"br-tax-{uuid.uuid4().hex[:6]}"

    comp = Company(
        id=company_id,
        name="Smriti Tax Compliance Test Corp",
        gst_number="07AAAAA1234A1Z5",
        company_code=f"TAX{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    branch = Branch(
        id=branch_id,
        company_id=company_id,
        name="Main Corporate Branch",
        code=f"BR-{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    user = User(
        id=f"usr-{uuid.uuid4().hex[:6]}",
        company_id=company_id,
        username=f"taxadmin_{uuid.uuid4().hex[:4]}",
        email=f"taxadmin_{uuid.uuid4().hex[:4]}@smritibooks.com",
        hashed_password="test_argon2_hash_placeholder",
        is_active=True,
    )
    db_session.add(comp)
    db_session.add(branch)
    db_session.add(user)
    await db_session.flush()

    await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(db_session, company_id, branch_id)
    return {"company_id": company_id, "branch_id": branch_id, "user_id": user.id}


def test_challan_281_validation_bsr_and_quarter():
    """Validates that BSR code (7 digits) and Quarter (Q1-Q4) are strictly enforced."""
    # Invalid BSR length (< 7 digits)
    with pytest.raises(Exception):
        Challan281Create(
            challan_no="00142",
            bsr_code="12345",  # Only 5 digits
            challan_date=date(2026, 8, 5),
            tax_amount=Decimal("5000.00"),
            quarter="Q2",
        )

    # Invalid non-digit BSR (7 chars but non-numeric)
    with pytest.raises(ValueError, match="BSR code must be exactly 7 numeric digits"):
        Challan281Create(
            challan_no="00142",
            bsr_code="123456A",  # 7 chars, contains alpha
            challan_date=date(2026, 8, 5),
            tax_amount=Decimal("5000.00"),
            quarter="Q2",
        )

    # Invalid Quarter
    with pytest.raises(ValueError, match="Quarter must be one of: Q1, Q2, Q3, Q4"):
        Challan281Create(
            challan_no="00142",
            bsr_code="0002134",
            challan_date=date(2026, 8, 5),
            tax_amount=Decimal("5000.00"),
            quarter="Q5",
        )

    # Valid payload
    payload = Challan281Create(
        challan_no="00142",
        bsr_code="0002134",
        challan_date=date(2026, 8, 5),
        tax_amount=Decimal("5000.00"),
        quarter="q2",  # Should normalize to Q2
    )
    assert payload.quarter == "Q2"
    assert payload.bsr_code == "0002134"


@pytest.mark.asyncio
async def test_challan_281_gl_posting_standard(db_session: AsyncSession, setup_tax_company: dict):
    """
    Asserts standard Challan 281 deposit:
      DR 2030 (TDS Payable) = 5,000.00
      CR 1020 (Bank)        = 5,000.00
      Difference == 0.00
    """
    company_id = setup_tax_company["company_id"]
    branch_id = setup_tax_company["branch_id"]

    payload = Challan281Create(
        challan_no="00981",
        bsr_code="0002134",
        challan_date=date(2026, 8, 6),
        tax_amount=Decimal("5000.00"),
        surcharge=Decimal("0.00"),
        cess=Decimal("0.00"),
        interest=Decimal("0.00"),
        fee=Decimal("0.00"),
        minor_head="200",
        financial_year="2026-27",
        quarter="Q2",
        tds_section="194Q",
        bank_name="HDFC Bank",
    )

    resp = await Challan281Service.record_challan_281(
        session=db_session,
        company_id=company_id,
        payload=payload,
        branch_id=branch_id,
    )

    assert resp.challan_no == "00981"
    assert resp.total_amount == 5000.00
    assert resp.is_cancelled is False

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(JournalVoucher.id == resp.voucher_id)
    voucher = (await db_session.execute(v_stmt)).scalars().first()
    assert voucher is not None
    assert voucher.voucher_type == "TDS_CHALLAN_281"
    assert voucher.total_debit == Decimal("5000.00")
    assert voucher.total_credit == Decimal("5000.00")

    # Verify General Ledger Entries
    gl_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(gl_stmt)).scalars().all()
    assert len(entries) == 2

    acc_tds = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "2030")
    acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1020")

    debit_entry = next(e for e in entries if e.account_id == acc_tds.id)
    credit_entry = next(e for e in entries if e.account_id == acc_bank.id)

    assert debit_entry.debit_amount == Decimal("5000.00")
    assert debit_entry.credit_amount == Decimal("0.00")
    assert credit_entry.credit_amount == Decimal("5000.00")
    assert credit_entry.debit_amount == Decimal("0.00")


@pytest.mark.asyncio
async def test_challan_281_gl_posting_with_interest_and_late_fee(
    db_session: AsyncSession, setup_tax_company: dict
):
    """
    Asserts Challan 281 deposit with statutory interest and late filing fees:
      DR 2030 (TDS Payable)     = 10,900.00 (Tax 10,000 + Surcharge 500 + Cess 400)
      DR 5090 (Interest & Fees) =    350.00 (Interest 150 + Fee 200)
      CR 1020 (Bank)            = 11,250.00
      Total DR == Total CR == 11,250.00
    """
    company_id = setup_tax_company["company_id"]

    payload = Challan281Create(
        challan_no="00982",
        bsr_code="0210088",
        challan_date=date(2026, 8, 10),
        tax_amount=Decimal("10000.00"),
        surcharge=Decimal("500.00"),
        cess=Decimal("400.00"),
        interest=Decimal("150.00"),
        fee=Decimal("200.00"),
        penalty=Decimal("0.00"),
        minor_head="200",
        financial_year="2026-27",
        quarter="Q2",
        tds_section="194C",
        bank_name="State Bank of India",
    )

    resp = await Challan281Service.record_challan_281(
        session=db_session,
        company_id=company_id,
        payload=payload,
    )

    assert resp.total_amount == 11250.00
    assert resp.tax_amount == 10000.00
    assert resp.interest == 150.00
    assert resp.fee == 200.00

    # Verify Journal Voucher
    v_stmt = select(JournalVoucher).where(JournalVoucher.id == resp.voucher_id)
    voucher = (await db_session.execute(v_stmt)).scalars().first()
    assert voucher.total_debit == Decimal("11250.00")
    assert voucher.total_credit == Decimal("11250.00")

    # Verify General Ledger Entries (3 lines: 2030, 5090, 1020)
    gl_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(gl_stmt)).scalars().all()
    assert len(entries) == 3

    acc_tds = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "2030")
    acc_interest = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "5090")
    acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1020")

    ent_tds = next(e for e in entries if e.account_id == acc_tds.id)
    ent_interest = next(e for e in entries if e.account_id == acc_interest.id)
    ent_bank = next(e for e in entries if e.account_id == acc_bank.id)

    assert ent_tds.debit_amount == Decimal("10900.00")
    assert ent_interest.debit_amount == Decimal("350.00")
    assert ent_bank.credit_amount == Decimal("11250.00")
    assert (ent_tds.debit_amount + ent_interest.debit_amount) == ent_bank.credit_amount


@pytest.mark.asyncio
async def test_challan_281_cancellation_reversal(db_session: AsyncSession, setup_tax_company: dict):
    """
    Asserts symmetrical compensating reversal on Challan 281 cancellation:
      DR 1020 (Bank)            = 11,250.00
      CR 2030 (TDS Payable)     = 10,900.00
      CR 5090 (Interest & Fees) =    350.00
      Original voucher marked is_cancelled = True.
    """
    company_id = setup_tax_company["company_id"]

    payload = Challan281Create(
        challan_no="00983",
        bsr_code="0210088",
        challan_date=date(2026, 8, 12),
        tax_amount=Decimal("10000.00"),
        surcharge=Decimal("500.00"),
        cess=Decimal("400.00"),
        interest=Decimal("150.00"),
        fee=Decimal("200.00"),
        minor_head="200",
        financial_year="2026-27",
        quarter="Q2",
        tds_section="194C",
    )

    resp = await Challan281Service.record_challan_281(
        session=db_session,
        company_id=company_id,
        payload=payload,
    )

    # Now cancel
    cancelled = await Challan281Service.cancel_challan_281(
        session=db_session,
        company_id=company_id,
        challan_identifier=resp.voucher_id,
        reason="Cheque dishonoured / re-submission required",
    )
    assert cancelled.is_cancelled is True

    # Find Reversal Voucher
    rev_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == company_id,
        JournalVoucher.voucher_type == "CHALLAN_281_CANCEL",
        JournalVoucher.reference_doc_id == resp.voucher_id,
    )
    rev_voucher = (await db_session.execute(rev_stmt)).scalars().first()
    assert rev_voucher is not None
    assert rev_voucher.total_debit == Decimal("11250.00")
    assert rev_voucher.total_credit == Decimal("11250.00")

    # Verify Reversal GL Lines
    gl_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == rev_voucher.id)
    rev_entries = (await db_session.execute(gl_stmt)).scalars().all()
    assert len(rev_entries) == 3

    acc_tds = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "2030")
    acc_interest = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "5090")
    acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company_id, "1020")

    r_bank = next(e for e in rev_entries if e.account_id == acc_bank.id)
    r_tds = next(e for e in rev_entries if e.account_id == acc_tds.id)
    r_interest = next(e for e in rev_entries if e.account_id == acc_interest.id)

    assert r_bank.debit_amount == Decimal("11250.00")
    assert r_tds.credit_amount == Decimal("10900.00")
    assert r_interest.credit_amount == Decimal("350.00")


@pytest.mark.asyncio
async def test_form26q_quarterly_deductee_aggregation_and_summary(
    db_session: AsyncSession, setup_tax_company: dict
):
    """
    Asserts quarterly deductee aggregation for Form 26Q:
    Records bill with TDS, records Challan 281, and asserts Form 26Q summary reconciliation.
    """
    company_id = setup_tax_company["company_id"]
    branch_id = setup_tax_company["branch_id"]

    s = uuid.uuid4().hex[:6]
    supp_id = f"sup-ded-{s}"

    # 1. Create a Supplier and Party
    supp_party = Party(
        id=supp_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        legal_name="Apex Fabrics Pvt Ltd",
        trade_name="Apex Fabrics",
        party_code=f"SUP-APEX-{s.upper()}",
        pan="AAACA1234A",
        gstin="07AAACA1234A1Z5",
        party_type="ORGANIZATION",
    )
    supp = Supplier(
        id=supp_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        code=supp_party.party_code,
        name="Apex Fabrics Pvt Ltd",
        gst_number="07AAACA1234A1Z5",
        outstanding=Decimal("0.00"),
        is_active=True,
    )
    profile = SupplierProfile(
        id=f"sp-ded-{s}",
        uuid=str(uuid.uuid4()),
        party_id=supp_id,
        company_id=company_id,
        branch_id=branch_id,
        supplier_type="DISTRIBUTOR",
        commercial_classification="APPROVED",
        tds_section="194Q",
        tds_rate=Decimal("0.10"),
    )
    db_session.add(supp_party)
    db_session.add(supp)
    db_session.add(profile)
    await db_session.flush()

    # 2. Post Purchase Bill with TDS in Q2 (August 2026)
    bill = PurchaseBill(
        id=f"bill-ded-{s}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        supplier_id=supp.id,
        bill_no=f"BILL-APEX-{s.upper()}",
        bill_date=date(2026, 8, 15),
        status="APPROVED",
        taxable_amount=Decimal("100000.00"),
        tax_amount=Decimal("18000.00"),
        total_amount=Decimal("118000.00"),
        paid_amount=Decimal("0.00"),
        notes="__TDS_AMOUNT__:118.00|__TDS_SECTION__:194Q",
    )
    db_session.add(bill)
    await db_session.flush()

    # Post to GL with TDS (118.00)
    await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=company_id,
        bill_id=bill.id,
        branch_id=branch_id,
        tds_amount=Decimal("118.00"),
        tds_section="194Q",
    )

    # 3. Record Challan 281 depositing TDS (118.00)
    chl_payload = Challan281Create(
        challan_no="00771",
        bsr_code="0002134",
        challan_date=date(2026, 9, 5),
        tax_amount=Decimal("118.00"),
        quarter="Q2",
        financial_year="2026-27",
        tds_section="194Q",
    )
    await Challan281Service.record_challan_281(
        session=db_session,
        company_id=company_id,
        payload=chl_payload,
        branch_id=branch_id,
    )

    # 4. Compile Form 26Q Summary for Q2 2026-27
    summary = await Form26QGeneratorService.get_quarterly_summary(
        session=db_session,
        company_id=company_id,
        quarter="Q2",
        financial_year="2026-27",
    )

    assert summary.quarter == "Q2"
    assert summary.financial_year == "2026-27"
    assert summary.total_deductees_count >= 1
    assert summary.total_challans_count >= 1
    assert summary.total_tds_deducted >= 118.00
    assert summary.total_tds_deposited >= 118.00
    assert summary.unallocated_shortfall == 0.00

    # Assert Deductee Line
    ded_line = next(d for d in summary.deductees if d.vendor_name == "Apex Fabrics Pvt Ltd")
    assert ded_line.deductee_code == "01"  # Company (4th char 'C' in AAACA1234A)
    assert ded_line.pan == "AAACA1234A"
    assert ded_line.pan_valid is True
    assert ded_line.section == "194Q"
    assert ded_line.tds_amount == 118.00


@pytest.mark.asyncio
async def test_form26q_penal_rate_flag_c_for_missing_pan(
    db_session: AsyncSession, setup_tax_company: dict
):
    """
    Asserts that deductees without valid PAN are flagged with Section 206AA reason code 'C'.
    """
    company_id = setup_tax_company["company_id"]
    branch_id = setup_tax_company["branch_id"]

    s = uuid.uuid4().hex[:6]
    supp_id = f"sup-nopan-{s}"

    # Deductee with invalid/missing PAN
    supp_party = Party(
        id=supp_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        legal_name="Ramesh Contractor",
        trade_name="Ramesh Works",
        party_code=f"SUP-NOPAN-{s.upper()}",
        pan=None,
        gstin=None,
        party_type="INDIVIDUAL",
    )
    supp = Supplier(
        id=supp_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        code=supp_party.party_code,
        name="Ramesh Contractor",
        gst_number=None,
        outstanding=Decimal("0.00"),
        is_active=True,
    )
    profile = SupplierProfile(
        id=f"sp-nopan-{s}",
        uuid=str(uuid.uuid4()),
        party_id=supp_id,
        company_id=company_id,
        branch_id=branch_id,
        supplier_type="DISTRIBUTOR",
        commercial_classification="APPROVED",
        tds_section="194C",
        tds_rate=Decimal("20.00"),
    )
    db_session.add(supp_party)
    db_session.add(supp)
    db_session.add(profile)
    await db_session.flush()

    # Record Purchase Bill with 20% penal rate in Q2
    bill = PurchaseBill(
        id=f"bill-nopan-{s}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        supplier_id=supp.id,
        bill_no=f"BILL-NOPAN-{s.upper()}",
        bill_date=date(2026, 8, 20),
        status="APPROVED",
        taxable_amount=Decimal("10000.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("10000.00"),
        paid_amount=Decimal("0.00"),
        notes="__TDS_AMOUNT__:2000.00|__TDS_SECTION__:194C",
    )
    db_session.add(bill)
    await db_session.flush()

    await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=company_id,
        bill_id=bill.id,
        branch_id=branch_id,
        tds_amount=Decimal("2000.00"),
        tds_section="194C",
    )

    summary = await Form26QGeneratorService.get_quarterly_summary(
        session=db_session,
        company_id=company_id,
        quarter="Q2",
        financial_year="2026-27",
    )

    ded_line = next(d for d in summary.deductees if d.vendor_name == "Ramesh Contractor")
    assert ded_line.deductee_code == "02"  # Non-Company
    assert ded_line.pan_valid is False
    assert ded_line.tds_amount == 2000.00
    assert ded_line.reason_code == "C"  # 206AA Penal Flag


@pytest.mark.asyncio
async def test_form26q_text_file_formatting_fhu_bhu_cdu_ddu(
    db_session: AsyncSession, setup_tax_company: dict
):
    """
    Asserts standard NSDL ASCII e-TDS text file export structure:
    FH (File Header), BH (Batch Header), CD (Challan Detail), DD (Deductee Detail).
    """
    company_id = setup_tax_company["company_id"]

    export = await Form26QGeneratorService.generate_form26q_text(
        session=db_session,
        company_id=company_id,
        quarter="Q2",
        financial_year="2026-27",
    )

    assert export.filename.startswith("FORM26Q_")
    assert export.filename.endswith(".txt")
    assert export.total_records >= 2

    raw_text = export.file_content
    lines = raw_text.strip().split("\r\n")

    # Assert Record Types
    assert lines[0].split("^")[1] == "FH"
    assert "26Q" in lines[0]
    assert "SMRITI RETAIL OS" in lines[0]

    assert lines[1].split("^")[1] == "BH"
    assert "26Q" in lines[1]
    assert "Q2" in lines[1]

    # Verify CRLF line endings
    assert "\r\n" in export.file_content
