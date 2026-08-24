"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from datetime import date, datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select, func

from app.db.session import get_company_sessionmaker
from app.models.accounting import (
    Account,
    JournalVoucher,
    GeneralLedgerEntry,
    AccountBalanceSnapshot,
)
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, Supplier
from app.models.crm import Customer
from app.models.inventory import Product, StockAudit, StockAuditItem, Warehouse
from app.models.payment_ledger import PaymentTransaction
from app.models.outbox import IntegrationOutboxEvent
from app.services.unified_ledger import UnifiedAccountingLedgerService



@pytest.mark.asyncio
async def test_chart_of_accounts_idempotent_seeding():
    """Verify that seed_default_chart_of_accounts seeds standard COA and is fully idempotent."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # First seeding
        accounts1 = await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
            session=session,
            company_id="COMP-001"
        )
        
        # Query total active accounts for COMP-001
        stmt = select(Account).where(Account.company_id == "COMP-001", Account.is_deleted == False)
        all_accounts = (await session.execute(stmt)).scalars().all()
        codes = {a.account_code for a in all_accounts}

        assert "1010" in codes  # Cash in Hand
        assert "1020" in codes  # Bank Accounts
        assert "1030" in codes  # Debtors
        assert "1040" in codes  # Inventory Asset
        assert "1051" in codes  # Input CGST
        assert "2010" in codes  # Creditors
        assert "2021" in codes  # Output CGST
        assert "4010" in codes  # Sales Revenue
        assert "5010" in codes  # COGS
        assert "5030" in codes  # Roundoff

        # Second seeding should not create duplicates
        accounts2 = await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
            session=session,
            company_id="COMP-001"
        )
        assert len(accounts2) == 0, "Second idempotent seeding run must create 0 duplicate accounts!"


@pytest.mark.asyncio
async def test_manual_journal_voucher_posting_balance_invariant():
    """Verify posting a balanced manual journal voucher (Debit == Credit) and outbox streaming."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")

        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")
        acc_capital = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "3010")

        # Balanced entry: Debit Bank ₹100,000, Credit Owner Capital ₹100,000
        lines = [
            {
                "account_id": acc_bank.id,
                "debit_amount": Decimal("100000.00"),
                "credit_amount": Decimal("0.00"),
                "remarks": "Initial capital deposit into bank"
            },
            {
                "account_id": acc_capital.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": Decimal("100000.00"),
                "remarks": "Capital introduced by founder"
            }
        ]

        voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            branch_id="BR-001",
            voucher_type="JOURNAL",
            voucher_date=date.today(),
            lines=lines,
            narration="Capital infusion test"
        )
        await session.commit()

        assert voucher.id is not None
        assert voucher.total_debit == Decimal("100000.00")
        assert voucher.total_credit == Decimal("100000.00")
        assert voucher.is_posted is True

        # Verify GL entries
        gl_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
        gl_entries = (await session.execute(gl_stmt)).scalars().all()
        assert len(gl_entries) == 2

        # Verify Outbox event staged
        outbox_stmt = select(IntegrationOutboxEvent).where(
            IntegrationOutboxEvent.aggregate_id == voucher.id,
            IntegrationOutboxEvent.event_type == "GL_VOUCHER_POSTED"
        )
        outbox_evt = (await session.execute(outbox_stmt)).scalar_one_or_none()
        assert outbox_evt is not None
        assert outbox_evt.payload_json["total_amount"] == 100000.00


@pytest.mark.asyncio
async def test_unbalanced_journal_voucher_rejection_400():
    """Verify that posting an unbalanced journal voucher is rejected with SMRITI-GL-001."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")

        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")
        acc_sales = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "4010")

        # Imbalance: Debit ₹5,000 != Credit ₹4,500
        lines = [
            {
                "account_id": acc_bank.id,
                "debit_amount": Decimal("5000.00"),
                "credit_amount": Decimal("0.00")
            },
            {
                "account_id": acc_sales.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": Decimal("4500.00")
            }
        ]

        with pytest.raises(HTTPException) as exc_info:
            await UnifiedAccountingLedgerService.post_journal_voucher(
                session=session,
                company_id="COMP-001",
                branch_id="BR-001",
                voucher_type="JOURNAL",
                voucher_date=date.today(),
                lines=lines
            )

        assert exc_info.value.status_code == 400
        assert "SMRITI-GL-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_sales_invoice_automated_gl_posting():
    """Verify automated translation of SalesInvoice into balanced multi-tier double-entry GL voucher."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        inv_id = f"inv_gl_{unique_suffix}"
        inv_no = f"INV-GL-{unique_suffix.upper()}"
        cust_id = f"cust_gl_{unique_suffix}"

        # 1. Setup Customer & Existing Product
        cust = Customer(
            id=cust_id,
            company_id="COMP-001",
            branch_id="BR-001",
            code=f"CUST-{unique_suffix.upper()}",
            name=f"GL Test Customer {unique_suffix}"
        )
        session.add(cust)

        res_prod = await session.execute(select(Product).where(Product.company_id == "COMP-001", Product.is_deleted == False).limit(1))
        product = res_prod.scalars().first()
        assert product is not None

        # Invoice: Taxable value = 1000.00, CGST = 90.00, SGST = 90.00, Roundoff = 0.40 -> Grand Total = 1180.40
        inv = SalesInvoice(
            id=inv_id,
            company_id="COMP-001",
            branch_id="BR-001",
            customer_id=cust_id,
            invoice_no=inv_no,
            customer_name=cust.name,
            taxable_value=Decimal("1000.00"),
            tax_total=Decimal("180.00"),
            grand_total=Decimal("1180.40"),
            date=date.today(),
            status="Confirmed"
        )
        session.add(inv)

        item = SalesInvoiceItem(
            invoice_id=inv_id,
            product_id=product.id,
            code=product.code,
            name="GL Test SKU",
            quantity=Decimal("2.00"),
            price=Decimal("500.00"),
            taxable_value=Decimal("1000.00"),
            gst_rate=Decimal("18.00"),
            cgst_amount=Decimal("90.00"),
            sgst_amount=Decimal("90.00"),
            igst_amount=Decimal("0.00"),
            tax_amount=Decimal("180.00"),
            total_amount=Decimal("1180.00")
        )
        session.add(item)
        await session.commit()

        # 2. Automated GL posting
        voucher = await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(
            session=session,
            company_id="COMP-001",
            invoice_id=inv_id
        )
        await session.commit()

        assert voucher.voucher_type == "SALES_INVOICE"
        assert voucher.reference_doc_id == inv_id
        assert voucher.total_debit == Decimal("1180.40")
        assert voucher.total_credit == Decimal("1180.40")

        # Verify entry lines: Debtors (1180.40 Dr), Sales (1000.00 Cr), CGST (90.00 Cr), SGST (90.00 Cr), Roundoff (0.40 Cr)
        gl_entries = (await session.execute(
            select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
        )).scalars().all()

        assert len(gl_entries) == 5
        debit_sum = sum(e.debit_amount for e in gl_entries)
        credit_sum = sum(e.credit_amount for e in gl_entries)
        assert debit_sum == Decimal("1180.40")
        assert credit_sum == Decimal("1180.40")


@pytest.mark.asyncio
async def test_purchase_receipt_automated_gl_posting():
    """Verify automated translation of PurchaseReceipt into balanced double-entry GL voucher."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        pr_id = f"pr_gl_{unique_suffix}"
        pr_no = f"GRN-GL-{unique_suffix.upper()}"

        res_supp = await session.execute(select(Supplier).where(Supplier.company_id == "COMP-001", Supplier.is_deleted == False).limit(1))
        supplier = res_supp.scalars().first()
        assert supplier is not None

        # Purchase: Subtotal = 2000.00, Tax = 360.00 (CGST 180, SGST 180), Total = 2360.00
        pr = PurchaseReceipt(
            id=pr_id,
            company_id="COMP-001",
            branch_id="BR-001",
            supplier_id=supplier.id,
            receipt_no=pr_no,
            subtotal=Decimal("2000.00"),
            tax_total=Decimal("360.00"),
            grand_total=Decimal("2360.00"),
            status="RECEIVED"
        )
        session.add(pr)
        await session.commit()

        # Automated GL posting
        voucher = await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
            session=session,
            company_id="COMP-001",
            receipt_id=pr_id
        )
        await session.commit()

        assert voucher.voucher_type == "PURCHASE_RECEIPT"
        assert voucher.total_debit == Decimal("2360.00")
        assert voucher.total_credit == Decimal("2360.00")


@pytest.mark.asyncio
async def test_trial_balance_equality_guarantee():
    """Verify that get_trial_balance aggregates all postings and strictly enforces Total Debits == Total Credits."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        tb = await UnifiedAccountingLedgerService.get_trial_balance(
            session=session,
            company_id="COMP-001"
        )

        assert tb["company_id"] == "COMP-001"
        assert tb["is_balanced"] is True
        assert tb["grand_total_debit"] == tb["grand_total_credit"]
        assert tb["grand_total_debit"] > 0.00
        assert len(tb["accounts"]) > 0


@pytest.mark.asyncio
async def test_profit_and_loss_calculation():
    """Verify that get_profit_and_loss accurately computes Revenue, Expenses, and Net Profit."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        pnl = await UnifiedAccountingLedgerService.get_profit_and_loss(
            session=session,
            company_id="COMP-001"
        )

        assert pnl["company_id"] == "COMP-001"
        assert isinstance(pnl["total_revenue"], (int, float))
        assert isinstance(pnl["total_expense"], (int, float))
        assert isinstance(pnl["net_profit"], (int, float))
        # Invariant: Net profit = Total revenue - Total expense
        assert round(pnl["net_profit"], 2) == round(pnl["total_revenue"] - pnl["total_expense"], 2)


@pytest.mark.asyncio
async def test_accounting_tenant_isolation():
    """Verify that accounts, vouchers, and GL entries in smriti001 are strictly isolated from smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    # 1. Post a distinctive voucher in smriti001
    async with session_001() as s1:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(s1, "COMP-001")
        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(s1, "COMP-001", "1020")
        acc_sales = await UnifiedAccountingLedgerService.get_account_by_code(s1, "COMP-001", "4010")

        v1 = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=s1,
            company_id="COMP-001",
            branch_id="BR-001",
            voucher_type="JOURNAL",
            voucher_date=date.today(),
            lines=[
                {"account_id": acc_bank.id, "debit_amount": Decimal("7777.00"), "credit_amount": Decimal("0.00")},
                {"account_id": acc_sales.id, "debit_amount": Decimal("0.00"), "credit_amount": Decimal("7777.00")}
            ],
            narration="Secret Isolation Voucher 7777"
        )
        await s1.commit()
        voucher_id = v1.id

    # 2. Assert smriti002 cannot find this voucher or its GL entries
    async with session_002() as s2:
        stmt_v = select(JournalVoucher).where(JournalVoucher.id == voucher_id)
        leaked_voucher = (await s2.execute(stmt_v)).scalar_one_or_none()
        assert leaked_voucher is None, "JournalVoucher from smriti001 must not leak into smriti002!"

        stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher_id)
        leaked_entries = (await s2.execute(stmt_gle)).scalars().all()
        assert len(leaked_entries) == 0, "GeneralLedgerEntry from smriti001 must not leak into smriti002!"


@pytest.mark.asyncio
async def test_payment_transaction_cash_automated_gl_posting():
    """Verify automated translation of Cash PaymentTransaction into balanced GL voucher."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        pay_id = f"pay_cash_{unique_suffix}"
        tx_no = f"TX-CASH-{unique_suffix.upper()}"
        inv_id = f"inv_ref_{unique_suffix}"

        pay = PaymentTransaction(
            id=pay_id,
            company_id="COMP-001",
            branch_id="BR-001",
            transaction_no=tx_no,
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=inv_id,
            party_id="CUST-001",
            tender_type="CASH",
            amount=Decimal("1500.00"),
            currency="INR",
            idempotency_key=f"idemp_pay_{unique_suffix}",
            status="SUCCESS",
            captured_at=datetime.now(timezone.utc)
        )
        session.add(pay)
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.post_payment_transaction_to_gl(
            session=session,
            company_id="COMP-001",
            payment_id=pay_id
        )
        await session.commit()

        assert voucher.voucher_type == "PAYMENT_RECEIPT"
        assert voucher.reference_doc_id == pay_id
        assert voucher.total_debit == Decimal("1500.00")
        assert voucher.total_credit == Decimal("1500.00")

        # Verify entry: Debit Cash in Hand (1010), Credit Debtors (1030)
        gl_entries = (await session.execute(
            select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
        )).scalars().all()
        assert len(gl_entries) == 2


@pytest.mark.asyncio
async def test_payment_transaction_upi_bank_automated_gl_posting():
    """Verify automated translation of UPI PaymentTransaction into Bank Debit GL voucher."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        pay_id = f"pay_upi_{unique_suffix}"
        tx_no = f"TX-UPI-{unique_suffix.upper()}"
        inv_id = f"inv_ref_{unique_suffix}"

        pay = PaymentTransaction(
            id=pay_id,
            company_id="COMP-001",
            branch_id="BR-001",
            transaction_no=tx_no,
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=inv_id,
            party_id="CUST-001",
            tender_type="UPI",
            amount=Decimal("3200.00"),
            currency="INR",
            idempotency_key=f"idemp_upi_{unique_suffix}",
            status="SUCCESS",
            captured_at=datetime.now(timezone.utc)
        )
        session.add(pay)
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.post_payment_transaction_to_gl(
            session=session,
            company_id="COMP-001",
            payment_id=pay_id
        )
        await session.commit()

        assert voucher.voucher_type == "PAYMENT_RECEIPT"
        assert voucher.total_debit == Decimal("3200.00")
        assert voucher.total_credit == Decimal("3200.00")


@pytest.mark.asyncio
async def test_stock_audit_deficit_gl_posting():
    """Verify that physical stock deficit (OUTWARD_LOSS) debits Inventory Loss (5040) and credits Inventory Asset (1040)."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        audit_id = f"audit_def_{unique_suffix}"
        audit_no = f"AUD-DEF-{unique_suffix.upper()}"

        res_wh = await session.execute(select(Warehouse).where(Warehouse.company_id == "COMP-001", Warehouse.is_deleted == False).limit(1))
        wh = res_wh.scalars().first()
        assert wh is not None

        res_prod = await session.execute(select(Product).where(Product.company_id == "COMP-001", Product.is_deleted == False).limit(1))
        product = res_prod.scalars().first()
        assert product is not None

        audit = StockAudit(
            id=audit_id,
            company_id="COMP-001",
            branch_id="BR-001",
            audit_no=audit_no,
            warehouse_id=wh.id,
            status="COMPLETED",
            reconciled_at=datetime.now(timezone.utc)
        )
        session.add(audit)

        # Deficit item: System = 10, Counted = 8 -> Variance = -2 @ ₹150 = -₹300 loss
        item = StockAuditItem(
            id=f"item_aud_{unique_suffix}",
            company_id="COMP-001",
            branch_id="BR-001",
            audit_id=audit_id,
            product_id=product.id,
            batch_no=f"BATCH-DEF-{unique_suffix.upper()}",
            system_qty=Decimal("10.00"),
            counted_qty=Decimal("8.00"),
            variance_qty=Decimal("-2.00"),
            unit_cost=Decimal("150.00"),
            variance_value=Decimal("-300.00"),
            is_reconciled=True
        )
        session.add(item)
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.post_stock_audit_reconciliation_to_gl(
            session=session,
            company_id="COMP-001",
            audit_id=audit_id
        )
        await session.commit()

        assert voucher is not None
        assert voucher.voucher_type == "STOCK_ADJUSTMENT"
        assert voucher.total_debit == Decimal("300.00")
        assert voucher.total_credit == Decimal("300.00")

        # Verify entry: Debit 5040 (Loss), Credit 1040 (Inventory)
        gl_entries = (await session.execute(
            select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
        )).scalars().all()
        assert len(gl_entries) == 2


@pytest.mark.asyncio
async def test_stock_audit_surplus_gl_posting():
    """Verify that physical stock surplus (INWARD_SURPLUS) debits Inventory Asset (1040) and credits Other Income (4020)."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        audit_id = f"audit_sur_{unique_suffix}"
        audit_no = f"AUD-SUR-{unique_suffix.upper()}"

        res_wh = await session.execute(select(Warehouse).where(Warehouse.company_id == "COMP-001", Warehouse.is_deleted == False).limit(1))
        wh = res_wh.scalars().first()
        assert wh is not None

        res_prod = await session.execute(select(Product).where(Product.company_id == "COMP-001", Product.is_deleted == False).limit(1))
        product = res_prod.scalars().first()
        assert product is not None

        audit = StockAudit(
            id=audit_id,
            company_id="COMP-001",
            branch_id="BR-001",
            audit_no=audit_no,
            warehouse_id=wh.id,
            status="COMPLETED",
            reconciled_at=datetime.now(timezone.utc)
        )
        session.add(audit)

        # Surplus item: System = 5, Counted = 8 -> Variance = +3 @ ₹100 = +₹300 surplus
        item = StockAuditItem(
            id=f"item_sur_{unique_suffix}",
            company_id="COMP-001",
            branch_id="BR-001",
            audit_id=audit_id,
            product_id=product.id,
            batch_no=f"BATCH-SUR-{unique_suffix.upper()}",
            system_qty=Decimal("5.00"),
            counted_qty=Decimal("8.00"),
            variance_qty=Decimal("3.00"),
            unit_cost=Decimal("100.00"),
            variance_value=Decimal("300.00"),
            is_reconciled=True
        )
        session.add(item)
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.post_stock_audit_reconciliation_to_gl(
            session=session,
            company_id="COMP-001",
            audit_id=audit_id
        )
        await session.commit()

        assert voucher is not None
        assert voucher.voucher_type == "STOCK_ADJUSTMENT"
        assert voucher.total_debit == Decimal("300.00")
        assert voucher.total_credit == Decimal("300.00")


@pytest.mark.asyncio
async def test_account_period_balance_snapshotting():
    """Verify generate_period_balance_snapshot calculates closing balances for all active accounts."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        snapshots = await UnifiedAccountingLedgerService.generate_period_balance_snapshot(
            session=session,
            company_id="COMP-001",
            period_date=date.today()
        )
        await session.commit()

        assert len(snapshots) > 0
        for s in snapshots:
            assert s.period_date == date.today()
            assert s.closing_debit >= Decimal("0.00")
            assert s.closing_credit >= Decimal("0.00")
            # Invariant: Net balance = closing_debit - closing_credit
            assert s.net_balance == (s.closing_debit - s.closing_credit)

