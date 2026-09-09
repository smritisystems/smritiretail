"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Sales Posting Writer Test Suite (Phase 2C Step 2)
"""

import sys
import os
import uuid
import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import dotenv_values
env_file = backend_dir.parent / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

from sqlalchemy import select, delete
from fastapi import HTTPException

from app.db.session import get_company_sessionmaker
from app.models.tenant import Company, Branch
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.crm import Customer, CustomerCreditLedgerEntry
from app.models.pos import Shift
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter


@pytest.fixture(scope="module", autouse=True)
async def setup_test_master_data():
    """Ensure test company, branch, customer, product, and open shift exist in smriti001."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Company & Branch
        comp = (await session.execute(select(Company).where(Company.id == "COMP-001"))).scalar_one_or_none()
        if not comp:
            comp = Company(id="COMP-001", name="SMRITI Test Retail Co", company_code="001", gst_number="27AAACA0001A1Z5")
            session.add(comp)

        branch = (await session.execute(select(Branch).where(Branch.id == "MAIN"))).scalar_one_or_none()
        if not branch:
            branch = Branch(id="MAIN", company_id="COMP-001", name="Main Store", code="MAIN")
            session.add(branch)

        # 2. CustomerGroup with credit limit
        from app.models.crm import CustomerGroup
        cg = (await session.execute(select(CustomerGroup).where(CustomerGroup.id == "cg_canon_test_01"))).scalar_one_or_none()
        if not cg:
            cg = CustomerGroup(
                id="cg_canon_test_01",
                company_id="COMP-001",
                name="Wholesale Tier 1",
                credit_limit=Decimal("5000.00"),
                credit_days=30,
                is_active=True,
                is_deleted=False,
            )
            session.add(cg)

        # 3. Customer linked to CustomerGroup
        cust = (await session.execute(select(Customer).where(Customer.id == "cust_canonical_test_01"))).scalar_one_or_none()
        if not cust:
            cust = Customer(
                id="cust_canonical_test_01",
                company_id="COMP-001",
                code="CUST-CANON-01",
                name="Metro Garments Wholesalers",
                mobile="9820123456",
                gst_number="27AAACA9999Z1Z5",
                customer_group_id="cg_canon_test_01",
                outstanding=Decimal("0.00"),
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(cust)
        else:
            cust.customer_group_id = "cg_canon_test_01"
            cust.outstanding = Decimal("0.00")
            session.add(cust)

        # 3. Product
        prod = (await session.execute(select(Product).where(Product.code == "PROD-CANON-01"))).scalar_one_or_none()
        if not prod:
            prod = Product(
                id="prod_canon_01",
                company_id="COMP-001",
                code="PROD-CANON-01",
                name="SMRITI Denim Trousers",
                category="Apparel",
                barcode="8901112229999",
                price=1000.00,
                mrp=1180.00,
                cost_price=600.00,
                stock=100,
                is_active=True,
                is_deleted=False,
            )
            session.add(prod)

        # 4. CashRegister & Open Shift
        from app.models.pos import CashRegister
        reg = (await session.execute(select(CashRegister).where(CashRegister.id == "REG-01"))).scalar_one_or_none()
        if not reg:
            reg = CashRegister(
                id="REG-01",
                company_id="COMP-001",
                branch_id="MAIN",
                code="REG-01",
                name="Primary POS Register",
                is_active=True,
                is_deleted=False,
            )
            session.add(reg)
            await session.flush()

        from app.models.auth import User
        user_rec = (await session.execute(select(User).where(User.is_active == True, User.is_deleted == False))).scalars().first()
        if not user_rec:
            user_rec = User(
                id="usr-canon-test-01",
                username="cashier_test",
                email="cashier@smritibooks.com",
                hashed_password="hash",
                role="CASHIER",
                is_active=True,
                is_deleted=False,
            )
            session.add(user_rec)
            await session.flush()
        cashier_id = user_rec.id

        shift = (await session.execute(select(Shift).where(Shift.id == "shift_canon_open_01"))).scalar_one_or_none()
        if not shift:
            shift = Shift(
                id="shift_canon_open_01",
                company_id="COMP-001",
                branch_id="MAIN",
                cashier_id=cashier_id,
                register_id="REG-01",
                status="OPEN",
                opened_at=datetime.now(timezone.utc),
                opening_balance=Decimal("1000.00"),
                is_deleted=False,
            )
            session.add(shift)

        # Clean old test sales
        await session.execute(delete(SalesInvoiceItem).where(SalesInvoiceItem.code.like("%CANON%")))
        await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("TEST-CANON-%")))
        await session.commit()

    yield

    async with session_factory() as session:
        await session.execute(delete(SalesInvoiceItem).where(SalesInvoiceItem.code.like("%CANON%")))
        await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("TEST-CANON-%")))
        await session.commit()


@pytest.mark.asyncio
async def test_01_retail_pos_mrp_inclusive_posting():
    """
    Test 1: Retail POS mode default (Tax-Inclusive MRP).
    MRP = 1180.00, GST = 18%
    Taxable Value = 1180 / 1.18 = 1000.00
    CGST = 90.00, SGST = 90.00, Total = 1180.00
    Tender: Cash 1200.00 -> Change = 20.00
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        idem_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_canon_open_01",
                cashier_id="CASHIER-01",
                terminal_id="TERM-01",
                idempotency_key=idem_key,
                client_invoice_no=f"TEST-CANON-RETAIL-{uuid.uuid4().hex[:6].upper()}",
                source_channel="POS_RETAIL",
            ),
            items=[
                CanonicalPostingLineItem(
                    code="PROD-CANON-01",
                    name="SMRITI Denim Trousers",
                    product_id="prod_canon_01",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1180.00"),
                    mrp=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1200.00"))
            ],
            customer_name="Walk-in Customer",
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert result.success is True
        assert result.is_replayed is False
        assert result.taxable_amount == Decimal("1000.00")
        assert result.cgst_amount == Decimal("90.00")
        assert result.sgst_amount == Decimal("90.00")
        assert result.tax_total == Decimal("180.00")
        assert result.net_amount == Decimal("1180.00")
        assert result.paid_amount == Decimal("1200.00")
        assert result.change_amount == Decimal("20.00")
        assert result.balance_amount == Decimal("0.00")
        assert result.outbox_event_id is not None

        # Verify DB persistence
        db_inv = (await session.execute(select(SalesInvoice).where(SalesInvoice.id == result.invoice_id))).scalar_one_or_none()
        assert db_inv is not None
        assert db_inv.grand_total == Decimal("1180.00")
        assert db_inv.shift_id == "shift_canon_open_01"


@pytest.mark.asyncio
async def test_02_b2b_wholesale_base_rate_exclusive_with_discount():
    """
    Test 2: B2B Wholesale mode (Tax-Exclusive Base Rate with Discount).
    Rate = 1000.00, Qty = 2, Base = 2000.00
    Discount = 10% = 200.00 -> Net Base = 1800.00
    Tax (18% on 1800.00) = 324.00 (CGST 162.00, SGST 162.00)
    Grand Total = 2124.00
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        idem_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
        inv_no = f"TEST-CANON-B2B-{uuid.uuid4().hex[:6].upper()}"
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                idempotency_key=idem_key,
                client_invoice_no=inv_no,
                source_channel="B2B_WHOLESALE",
            ),
            customer_id="cust_canonical_test_01",
            customer_name="Metro Garments Wholesalers",
            customer_gstin="27AAACA9999Z1Z5",
            items=[
                CanonicalPostingLineItem(
                    code="PROD-CANON-01",
                    name="SMRITI Denim Trousers",
                    product_id="prod_canon_01",
                    quantity=Decimal("2.0000"),
                    unit_price=Decimal("1000.00"),
                    disc_pct=Decimal("10.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="BANK_TRANSFER", amount=Decimal("2124.00"), reference_no="UTR-998877")
            ],
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert result.success is True
        assert result.gross_amount == Decimal("2000.00")
        assert result.discount_amount == Decimal("200.00")
        assert result.taxable_amount == Decimal("1800.00")
        assert result.cgst_amount == Decimal("162.00")
        assert result.sgst_amount == Decimal("162.00")
        assert result.tax_total == Decimal("324.00")
        assert result.net_amount == Decimal("2124.00")
        assert result.balance_amount == Decimal("0.00")


@pytest.mark.asyncio
async def test_03_idempotency_replay_protection():
    """
    Test 3: Verify exact replay protection on duplicate idempotency_key.
    Second call returns is_replayed=True with identical amounts and lines.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        idem_key = f"TEST-IDEM-REPLAY-{uuid.uuid4().hex[:8]}"
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                idempotency_key=idem_key,
                source_channel="POS_RETAIL",
            ),
            items=[
                CanonicalPostingLineItem(
                    code="PROD-CANON-01",
                    product_id="prod_canon_01",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("500.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="UPI", amount=Decimal("500.00"))
            ],
        )

        # 1st Post
        res1 = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res1.is_replayed is False

        # 2nd Post with identical key
        res2 = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res2.is_replayed is True
        assert res2.invoice_id == res1.invoice_id
        assert res2.invoice_no == res1.invoice_no
        assert res2.net_amount == res1.net_amount
        assert len(res2.lines) == len(res1.lines)


@pytest.mark.asyncio
async def test_04_credit_limit_enforcement_and_supervisor_override():
    """
    Test 4: Customer has credit limit 5000.00.
    Attempting 6000.00 credit sale without override code raises 400.
    Attempting with supervisor override succeeds.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Exceed credit limit without override
        req_blocked = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                idempotency_key=f"TEST-IDEM-CREDIT-BLOCK-{uuid.uuid4().hex[:6]}",
                source_channel="B2B_WHOLESALE",
            ),
            customer_id="cust_canonical_test_01",
            items=[
                CanonicalPostingLineItem(
                    code="PROD-CANON-01",
                    product_id="prod_canon_01",
                    quantity=Decimal("6.0000"),
                    unit_price=Decimal("1000.00"),
                    gst_rate=Decimal("0.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("6000.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req_blocked, commit=False)
        assert exc_info.value.status_code == 400
        assert "credit limit exceeded" in exc_info.value.detail.lower()

        # Retry with supervisor override code
        req_allowed = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                idempotency_key=f"TEST-IDEM-CREDIT-ALLOW-{uuid.uuid4().hex[:6]}",
                source_channel="B2B_WHOLESALE",
                supervisor_override_code="SUPER-OVERRIDE-99",
            ),
            customer_id="cust_canonical_test_01",
            items=[
                CanonicalPostingLineItem(
                    code="PROD-CANON-01",
                    product_id="prod_canon_01",
                    quantity=Decimal("6.0000"),
                    unit_price=Decimal("1000.00"),
                    gst_rate=Decimal("0.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("6000.00"))
            ],
        )

        res_ok = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req_allowed, commit=True)
        assert res_ok.success is True
        assert res_ok.net_amount == Decimal("6000.00")

        # Verify Customer outstanding incremented
        cust = (await session.execute(select(Customer).where(Customer.id == "cust_canonical_test_01"))).scalar_one()
        assert cust.outstanding == Decimal("6000.00")

        # Verify Credit Ledger Debit entry
        c_entry = (await session.execute(
            select(CustomerCreditLedgerEntry).where(CustomerCreditLedgerEntry.reference_id == res_ok.invoice_id)
        )).scalar_one_or_none()
        assert c_entry is not None
        assert c_entry.amount == Decimal("6000.00")
        assert c_entry.entry_type == "DEBIT"


@pytest.mark.asyncio
async def test_05_caller_controlled_session_rollback():
    """
    Test 5: Caller controls transaction boundary (no auto-commit).
    If caller does session.rollback(), invoice must not exist in DB.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        idem_key = f"TEST-IDEM-ROLLBACK-{uuid.uuid4().hex[:8]}"
        inv_no = f"TEST-CANON-ROLLBACK-{uuid.uuid4().hex[:6].upper()}"
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                idempotency_key=idem_key,
                client_invoice_no=inv_no,
                source_channel="POS_RETAIL",
            ),
            items=[
                CanonicalPostingLineItem(
                    code="PROD-CANON-01",
                    product_id="prod_canon_01",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("0.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("100.00"))
            ],
        )

        # Call with commit=False
        result = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=False)
        assert result.success is True

        # Explicitly roll back the caller session
        await session.rollback()

    # In a fresh session, verify the invoice was rolled back
    async with session_factory() as session2:
        check_inv = (await session2.execute(select(SalesInvoice).where(SalesInvoice.invoice_no == inv_no))).scalar_one_or_none()
        assert check_inv is None, "Invoice should NOT have been committed after caller rollback."
