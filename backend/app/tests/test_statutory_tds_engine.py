# -*- coding: utf-8 -*-
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

* Version    : 6.51.0
* Created    : 2026-10-03
* Modified   : 2026-10-03
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.9 — Statutory Withholding Tax (TDS) & GL Account 2030 Integration
Verifies:
  1. Statutory TDS Calculation Engine (Sections 194Q, 194C, 194J, 194H).
  2. PAN validation and entity structure classification (4th character parsing).
  3. Section 206AA penal rate enforcement for missing / invalid PAN (5% for 194Q, 20% for 194C/J/H).
  4. Account 2030 (TDS Payable) presence in DEFAULT_CHART_OF_ACCOUNTS and company seeding.
  5. Purchase Bill GL booking with TDS deduction: DR 1040/GST = CR 2010 (Net) + CR 2030 (TDS).
  6. Symmetrical Purchase Bill cancellation reversing Account 2030 and 2010 without balance drift.
  7. Supplier Payment disbursement with TDS withholding: DR 2010 (Gross) = CR Cash/Bank (Net) + CR 2030 (TDS).
  8. Symmetrical Supplier Payment cancellation restoring Account 2030 and Cash/Bank.
  9. Standalone TDS deduction and reversal vouchers (post_tds_deduction_to_gl / reverse_tds_deduction_gl).
  10. Vendor TDS summary (get_vendor_tds_summary) FY aggregation and threshold monitoring.
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
from app.models.party import Party, SupplierProfile
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.api.deps import TenantContext
from app.schemas.supplier_payment import SupplierPaymentCreate
from app.services.supplier_payment import SupplierPaymentService
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.tds_engine import StatutoryTdsEngine


# ---------------------------------------------------------------------------
# Test Fixture Helpers
# ---------------------------------------------------------------------------

async def setup_test_tenant(db, role=UserRole.MANAGER):
    s = uuid.uuid4().hex[:6]
    cid = f"CMP{s.upper()}"
    bid = f"BR{s.upper()}"
    company = Company(
        id=cid,
        company_code=cid,
        name=f"TDS Procurement Co {s}",
        gst_number="07AAAAA0000A1Z5",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=bid,
        name=f"Main Branch {s}",
        company_id=cid,
        is_active=True,
        is_deleted=False,
    )
    db.add(company)
    db.add(branch)
    await db.flush()

    user = User(
        id=f"u_{s}",
        username=f"mgr_{s}",
        email=f"mgr_{s}@smrititest.com",
        hashed_password="mock_hash_for_testing",
        role=role,
        company_id=cid,
        branch_id=bid,
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


async def create_test_vendor(db, company_id, branch_id=None, pan="ABCDE1234F", tds_sec="194Q", tds_rate=Decimal("0.10")):
    s = uuid.uuid4().hex[:6]
    gstin = f"07{pan}1Z5"
    supplier = Supplier(
        id=f"sup-{s}",
        company_id=company_id,
        branch_id=branch_id,
        name=f"Statutory Vendor {s}",
        code=f"VEN-{s.upper()}",
        gst_number=gstin,
        mobile="9876543210",
        email=f"vendor_{s}@example.com",
        address="100 Commercial Plaza, New Delhi",
        city="New Delhi",
        state="DL",
        pincode="110001",
        outstanding=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db.add(supplier)

    party = Party(
        id=f"pty_{s}",
        party_code=f"VEN-{s.upper()}",
        company_id=company_id,
        branch_id=branch_id,
        party_type="ORGANIZATION",
        legal_name=f"Statutory Vendor {s}",
        gstin=gstin,
        pan=pan,
        email=f"vendor_{s}@example.com",
        is_active=True,
        is_deleted=False,
    )
    db.add(party)
    await db.flush()

    profile = SupplierProfile(
        id=f"sp_{s}",
        company_id=company_id,
        branch_id=branch_id,
        party_id=party.id,
        supplier_type="DISTRIBUTOR",
        payment_terms_days=30,
        commercial_classification="APPROVED",
        tds_section=tds_sec,
        tds_rate=tds_rate,
        tax_treatment="REGISTERED_REGULAR",
        outstanding_liability=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db.add(profile)
    await db.flush()
    return supplier, profile


# ---------------------------------------------------------------------------
# 1. Statutory Calculation Engine Unit Tests (Synchronous)
# ---------------------------------------------------------------------------

def test_pan_validation():
    # Valid PAN
    assert StatutoryTdsEngine.is_valid_pan("ABCDE1234F") is True
    assert StatutoryTdsEngine.validate_pan("abcde1234f") is True  # Case insensitive
    assert StatutoryTdsEngine.is_valid_pan("AAACA1234B") is True

    # Invalid PANs
    assert StatutoryTdsEngine.is_valid_pan("ABCDE12345") is False  # 5 digits at end
    assert StatutoryTdsEngine.is_valid_pan("ABC1234F") is False    # Too short
    assert StatutoryTdsEngine.is_valid_pan("ABCDEF1234F") is False # 6 letters
    assert StatutoryTdsEngine.is_valid_pan(None) is False
    assert StatutoryTdsEngine.is_valid_pan("") is False


def test_entity_classification():
    # Company / Firm / LLP: 4th char in C, F, L, A, T, B
    assert StatutoryTdsEngine.is_company_or_firm_pan("AAACA1234B") is True   # Company (C)
    assert StatutoryTdsEngine.is_company_or_firm_pan("AAFFA1234B") is True   # Firm (F)
    assert StatutoryTdsEngine.is_company_or_firm_pan("AALLA1234B") is True   # LLP (L)

    # Individual / HUF: 4th char in P, H
    assert StatutoryTdsEngine.is_company_or_firm_pan("ABCPE1234F") is False  # Person (P)
    assert StatutoryTdsEngine.is_company_or_firm_pan("ABCHE1234F") is False  # HUF (H)

    # Missing / Invalid
    assert StatutoryTdsEngine.is_company_or_firm_pan(None) is None
    assert StatutoryTdsEngine.is_company_or_firm_pan("ABC") is None


def test_statutory_tds_calculation_194q_standard_and_penal():
    # Standard 194Q: 0.10% on Gross ₹1,000,000 = ₹1,000
    res = StatutoryTdsEngine.calculate_tds(
        gross_amount=Decimal("1000000.00"),
        section="194Q",
        pan="ABCDE1234F",
    )
    assert res.has_valid_pan is True
    assert res.is_penal_rate is False
    assert res.rate_percentage == Decimal("0.10")
    assert res.tds_amount == Decimal("1000.00")
    assert res.net_payable == Decimal("999000.00")

    # Section 206AA Penal Rate: 5.00% when PAN is missing or invalid
    res_penal = StatutoryTdsEngine.calculate_tds(
        gross_amount=Decimal("1000000.00"),
        section="194Q",
        pan=None,
    )
    assert res_penal.has_valid_pan is False
    assert res_penal.is_penal_rate is True
    assert res_penal.rate_percentage == Decimal("5.00")
    assert res_penal.tds_amount == Decimal("50000.00")
    assert res_penal.net_payable == Decimal("950000.00")


def test_statutory_tds_calculation_194c_individual_vs_company_vs_penal():
    # 194C Individual / HUF: 1.00%
    res_ind = StatutoryTdsEngine.calculate_tds(
        gross_amount=Decimal("100000.00"),
        section="194C",
        pan="ABCPE1234F",  # 4th char P
    )
    assert res_ind.rate_percentage == Decimal("1.00")
    assert res_ind.tds_amount == Decimal("1000.00")
    assert res_ind.net_payable == Decimal("99000.00")

    # 194C Company / Firm: 2.00%
    res_co = StatutoryTdsEngine.calculate_tds(
        gross_amount=Decimal("100000.00"),
        section="194C",
        pan="AAACA1234B",  # 4th char C
    )
    assert res_co.rate_percentage == Decimal("2.00")
    assert res_co.tds_amount == Decimal("2000.00")
    assert res_co.net_payable == Decimal("98000.00")

    # 194C Missing PAN: 20.00% penal rate under Section 206AA
    res_penal = StatutoryTdsEngine.calculate_tds(
        gross_amount=Decimal("100000.00"),
        section="194C",
        pan="INVALID_PAN",
    )
    assert res_penal.is_penal_rate is True
    assert res_penal.rate_percentage == Decimal("20.00")
    assert res_penal.tds_amount == Decimal("20000.00")
    assert res_penal.net_payable == Decimal("80000.00")


def test_statutory_tds_custom_override_rate():
    # Lower Deduction Certificate rate: e.g. 0.05%
    res = StatutoryTdsEngine.calculate_tds(
        gross_amount=Decimal("500000.00"),
        section="194Q",
        pan="AAACA1234B",
        custom_rate=Decimal("0.05"),
    )
    assert res.rate_percentage == Decimal("0.05")
    assert res.tds_amount == Decimal("250.00")
    assert res.net_payable == Decimal("499750.00")


# ---------------------------------------------------------------------------
# 2. General Ledger Account 2030 & Double-Entry Invariant Tests (Async)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chart_of_accounts_2030_present(db_session):
    tenant, user, company = await setup_test_tenant(db_session)
    acc_2030 = await UnifiedAccountingLedgerService.get_account_by_code(
        session=db_session,
        company_id=company.id,
        account_code="2030",
    )
    assert acc_2030 is not None
    assert acc_2030.account_code == "2030"
    assert "Withholding Tax Payable" in acc_2030.account_name
    assert acc_2030.account_type == "LIABILITY"


@pytest.mark.asyncio
async def test_purchase_bill_gl_posting_and_reversal_with_tds(db_session):
    """
    Purchase Bill of ₹100,000 + 18% GST = ₹118,000 with TDS of ₹100 u/s 194Q.
    Posting:
      DR 1040 (Inventory)       = ₹100,000.00
      DR 1051 (Input CGST 9%)   = ₹9,000.00
      DR 1052 (Input SGST 9%)   = ₹9,000.00
      CR 2010 (Accounts Payable)= ₹117,900.00 (Net AP)
      CR 2030 (TDS Payable)     = ₹100.00
    Double-entry invariant: Total Debit (118,000) == Total Credit (118,000).
    Supplier outstanding increases strictly by Net AP: ₹117,900.00.
    """
    tenant, user, company = await setup_test_tenant(db_session)
    vendor, profile = await create_test_vendor(db_session, company.id, branch_id=tenant.branch_id, pan="ABCDE1234F")

    bill = PurchaseBill(
        id=f"bill_{uuid.uuid4().hex[:8]}",
        company_id=company.id,
        branch_id=tenant.branch_id,
        bill_no="PB-2026-TDS-01",
        supplier_id=vendor.id,
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("100000.00"),
        tax_amount=Decimal("18000.00"),
        total_amount=Decimal("118000.00"),
        paid_amount=Decimal("0.00"),
        notes="__TDS_AMOUNT__:100.00|__TDS_SECTION__:194Q",
    )
    db_session.add(bill)
    await db_session.flush()

    # Post to GL
    voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=company.id,
        bill_id=bill.id,
        branch_id=tenant.branch_id,
        tds_amount=Decimal("100.00"),
        tds_section="194Q",
    )
    assert voucher is not None
    assert voucher.total_debit == Decimal("118000.00")
    assert voucher.total_credit == Decimal("118000.00")
    assert voucher.total_debit == voucher.total_credit

    # Verify Supplier outstanding is incremented by Net AP (117,900)
    await db_session.refresh(vendor)
    assert vendor.outstanding == Decimal("117900.00")

    # Verify GeneralLedgerEntry has Account 2030 credited with ₹100.00
    gl_stmt = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id,
        GeneralLedgerEntry.is_deleted == False,
    )
    entries = (await db_session.execute(gl_stmt)).scalars().all()
    tds_entry = next((e for e in entries if e.credit_amount == Decimal("100.00")), None)
    assert tds_entry is not None
    assert tds_entry.party_id == vendor.id

    # Now reverse / cancel the bill
    cancel_voucher = await UnifiedAccountingLedgerService.reverse_purchase_bill_gl(
        session=db_session,
        company_id=company.id,
        bill_id=bill.id,
        branch_id=tenant.branch_id,
        reason="Statutory test cancellation",
    )
    assert cancel_voucher is not None
    assert cancel_voucher.total_debit == Decimal("118000.00")
    assert cancel_voucher.total_credit == Decimal("118000.00")
    assert cancel_voucher.total_debit == cancel_voucher.total_credit

    # Verify Supplier outstanding is restored to ₹0.00 without under/over decrement
    await db_session.refresh(vendor)
    assert vendor.outstanding == Decimal("0.00")


@pytest.mark.asyncio
async def test_supplier_payment_gl_posting_and_reversal_with_tds(db_session):
    """
    Supplier Payment of ₹50,000 settling bills, with ₹1,000 withheld under 194C.
    Posting:
      DR 2010 (Accounts Payable)= ₹50,000.00 (full liability knocked off)
      CR 1020 (Bank Account)    = ₹49,000.00 (net cash disbursed)
      CR 2030 (TDS Payable)     = ₹1,000.00 (statutory tax withheld)
    Double-entry invariant: Total Debit (50,000) == Total Credit (50,000).
    Zero net cash leakage for TDS deduction.
    """
    tenant, user, company = await setup_test_tenant(db_session)
    vendor, profile = await create_test_vendor(db_session, company.id, branch_id=tenant.branch_id, pan="ABCPE1234F", tds_sec="194C")
    vendor.outstanding = Decimal("60000.00")
    await db_session.flush()

    payment_svc = SupplierPaymentService(db_session, tenant)
    pay_req = SupplierPaymentCreate(
        id=f"pay_{uuid.uuid4().hex[:8]}",
        supplier_id=vendor.id,
        amount=Decimal("50000.00"),
        payment_mode="BANK_TRANSFER",
        payment_date=date.today(),
        tds_amount=Decimal("1000.00"),
        tds_section="194C",
        tds_rate=Decimal("2.00"),
        notes="Monthly contractor settlement",
    )
    payment = await payment_svc.record_payment(pay_req)
    assert payment is not None
    assert payment.tds_amount == Decimal("1000.00")
    assert payment.tds_section == "194C"

    # Supplier outstanding decremented by full gross payment ₹50,000: 60,000 - 50,000 = 10,000
    await db_session.refresh(vendor)
    assert vendor.outstanding == Decimal("10000.00")

    # Check GL Voucher
    voucher_stmt = select(JournalVoucher).where(
        JournalVoucher.reference_doc_id == payment.id,
        JournalVoucher.reference_doc_type == "SUPPLIER_PAYMENT",
        JournalVoucher.is_deleted == False,
    )
    voucher = (await db_session.execute(voucher_stmt)).scalar_one_or_none()
    assert voucher is not None
    assert voucher.total_debit == Decimal("50000.00")
    assert voucher.total_credit == Decimal("50000.00")

    # Cancel payment and verify reversal
    cancel_payment = await payment_svc.cancel_payment(payment.id, reason="Correction")
    assert cancel_payment is not None

    # Supplier outstanding restored to ₹60,000.00
    await db_session.refresh(vendor)
    assert vendor.outstanding == Decimal("60000.00")


@pytest.mark.asyncio
async def test_standalone_tds_deduction_and_reversal(db_session):
    """
    Test standalone TDS withholding adjustment entry:
      post_tds_deduction_to_gl: DR 2010 (5,000) / CR 2030 (5,000).
      Vendor outstanding decreases by ₹5,000.
      reverse_tds_deduction_gl: DR 2030 (5,000) / CR 2010 (5,000).
      Vendor outstanding restored.
    """
    tenant, user, company = await setup_test_tenant(db_session)
    vendor, profile = await create_test_vendor(db_session, company.id, branch_id=tenant.branch_id, pan="ABCDE1234F")
    vendor.outstanding = Decimal("25000.00")
    await db_session.flush()

    # Post standalone TDS deduction
    voucher = await UnifiedAccountingLedgerService.post_tds_deduction_to_gl(
        session=db_session,
        company_id=company.id,
        supplier_id=vendor.id,
        tds_amount=Decimal("5000.00"),
        tds_section="194J",
        branch_id=tenant.branch_id,
        remarks="Standalone professional fees TDS adjustment",
    )
    assert voucher is not None
    assert voucher.total_debit == Decimal("5000.00")
    assert voucher.total_credit == Decimal("5000.00")

    await db_session.refresh(vendor)
    assert vendor.outstanding == Decimal("20000.00")

    # Reverse standalone TDS deduction
    rev_voucher = await UnifiedAccountingLedgerService.reverse_tds_deduction_gl(
        session=db_session,
        company_id=company.id,
        voucher_id=voucher.id,
        reason="Mistaken duplicate deduction",
    )
    assert rev_voucher is not None
    assert rev_voucher.total_debit == Decimal("5000.00")
    assert rev_voucher.total_credit == Decimal("5000.00")

    await db_session.refresh(vendor)
    assert vendor.outstanding == Decimal("25000.00")


@pytest.mark.asyncio
async def test_vendor_tds_summary_fy_aggregation(db_session):
    """
    Test get_vendor_tds_summary:
      Computes cumulative purchases, Section 194Q threshold status, active rate, and cumulative TDS deducted.
    """
    tenant, user, company = await setup_test_tenant(db_session)
    vendor, profile = await create_test_vendor(db_session, company.id, branch_id=tenant.branch_id, pan="AAACA1234B", tds_sec="194Q", tds_rate=Decimal("0.10"))

    # Create bill and post with TDS
    bill = PurchaseBill(
        id=f"bill_{uuid.uuid4().hex[:8]}",
        company_id=company.id,
        branch_id=tenant.branch_id,
        bill_no="PB-2026-FY-01",
        supplier_id=vendor.id,
        bill_date=date.today(),
        status="APPROVED",
        taxable_amount=Decimal("200000.00"),
        tax_amount=Decimal("36000.00"),
        total_amount=Decimal("236000.00"),
        paid_amount=Decimal("0.00"),
        notes="__TDS_AMOUNT__:200.00|__TDS_SECTION__:194Q",
    )
    db_session.add(bill)
    await db_session.flush()

    await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
        session=db_session,
        company_id=company.id,
        bill_id=bill.id,
        branch_id=tenant.branch_id,
        tds_amount=Decimal("200.00"),
        tds_section="194Q",
    )

    summary = await UnifiedAccountingLedgerService.get_vendor_tds_summary(
        session=db_session,
        company_id=company.id,
        supplier_id=vendor.id,
    )
    assert summary["supplier_id"] == vendor.id
    assert summary["has_valid_pan"] is True
    assert summary["active_section"] == "194Q"
    assert summary["active_rate"] == Decimal("0.10")
    assert summary["total_invoiced_fy"] == Decimal("236000.00")
    assert summary["total_tds_deducted_fy"] == Decimal("200.00")
    assert summary["threshold_applicable"] is True
    assert summary["threshold_exceeded"] is False
    assert summary["section_breakdown"].get("194Q") == Decimal("200.00")
