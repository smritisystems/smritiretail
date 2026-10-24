"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-09-09
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone, date
from sqlalchemy import select, and_

from app.db.session import get_company_sessionmaker
from app.models.tenant import Company, Branch
from app.models.crm import Customer, CustomerGroup
from app.models.inventory import Product, StockAudit, StockAuditItem
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, Supplier
from app.models.payment_ledger import PaymentTransaction
from app.models.pos import Shift
from app.models.outbox import IntegrationOutboxEvent
from app.models.accounting import JournalVoucher, GeneralLedgerEntry
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.outbox_worker import OutboxQueueWorker
from app.services.outbox_service import OutboxService
from app.services.analytics_daemon import AnalyticsDaemonService


@pytest.fixture(scope="module", autouse=True)
async def setup_integration_master_data():
    """Seed test company, branch, customer, product, supplier, and open shift in smriti001."""
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

        # 2. Customer
        cg = (await session.execute(select(CustomerGroup).where(CustomerGroup.id == "cg_outbox_test"))).scalar_one_or_none()
        if not cg:
            cg = CustomerGroup(
                id="cg_outbox_test",
                company_id="COMP-001",
                name="Outbox Test Group",
                credit_limit=Decimal("50000.00"),
                credit_days=30,
                is_active=True,
                is_deleted=False,
            )
            session.add(cg)

        cust = (await session.execute(select(Customer).where(Customer.id == "cust_outbox_test_01"))).scalar_one_or_none()
        if not cust:
            cust = Customer(
                id="cust_outbox_test_01",
                company_id="COMP-001",
                code="CUST-OBX-01",
                name="Acme Outbox Retail Customer",
                mobile="9820998877",
                gst_number="27AAACA1234Z1Z5",
                customer_group_id="cg_outbox_test",
                outstanding=Decimal("0.00"),
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(cust)

        # 3. Product
        prod = (await session.execute(select(Product).where(Product.code == "PROD-OBX-01"))).scalar_one_or_none()
        if not prod:
            prod = Product(
                id="prod_obx_01",
                company_id="COMP-001",
                code="PROD-OBX-01",
                name="SMRITI Outbox Integration Shirt",
                category="Apparel",
                barcode="8901112228888",
                price=1000.00,
                mrp=1180.00,
                cost_price=600.00,
                stock=100,
                is_active=True,
                is_deleted=False,
            )
            session.add(prod)

        # 4. Supplier
        supp = (await session.execute(select(Supplier).where(Supplier.id == "SUPP-OBX-01"))).scalar_one_or_none()
        if not supp:
            supp = Supplier(
                id="SUPP-OBX-01",
                code="SUPP-OBX-01",
                company_id="COMP-001",
                name="Universal Fabrics Ltd",
                email="fabrics@smritibooks.com",
                gst_number="27AAACS1234S1Z1"
            )
            session.add(supp)

        # 5. CashRegister & Cashier User & Open Shift
        from app.models.pos import CashRegister
        from app.models.auth import User
        reg = (await session.execute(select(CashRegister).where(CashRegister.id == "REG-OBX-01"))).scalar_one_or_none()
        if not reg:
            reg = CashRegister(
                id="REG-OBX-01",
                company_id="COMP-001",
                branch_id="MAIN",
                code="REG-OBX-01",
                name="Outbox Test Register",
                is_active=True,
                is_deleted=False
            )
            session.add(reg)
            await session.flush()

        user_rec = (await session.execute(select(User).where(User.is_active == True, User.is_deleted == False))).scalars().first()
        if not user_rec:
            user_rec = User(
                id="usr_obx_test_01",
                username="cashier_obx",
                email="cashier_obx@smritibooks.com",
                hashed_password="hash",
                role="CASHIER",
                is_active=True,
                is_deleted=False
            )
            session.add(user_rec)
            await session.flush()

        shift = (await session.execute(select(Shift).where(Shift.id == "shift_obx_01"))).scalar_one_or_none()
        if not shift:
            shift = Shift(
                id="shift_obx_01",
                company_id="COMP-001",
                branch_id="MAIN",
                cashier_id=user_rec.id,
                register_id="REG-OBX-01",
                status="OPEN",
                opened_at=datetime.now(timezone.utc),
                opening_balance=Decimal("1000.00"),
                is_deleted=False
            )
            session.add(shift)

        await session.commit()


@pytest.mark.asyncio
async def test_canonical_sales_writer_to_gl_outbox_dispatch():
    """
    Verifies that CanonicalSalesPostingWriter creates a SalesInvoice and records
    an outbox event, which OutboxQueueWorker then successfully dispatches to
    UnifiedAccountingLedgerService, creating a balanced GL JournalVoucher.
    """
    session_factory = get_company_sessionmaker("smriti001")
    idem_key = f"IDEM-OBX-SALE-{uuid.uuid4().hex[:8]}"

    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_obx_01",
                cashier_id="CASHIER-01",
                terminal_id="TERM-01",
                idempotency_key=idem_key,
                client_invoice_no=f"INV-OBX-{uuid.uuid4().hex[:6].upper()}",
                source_channel="POS_RETAIL",
            ),
            items=[
                CanonicalPostingLineItem(
                    code="PROD-OBX-01",
                    name="SMRITI Outbox Integration Shirt",
                    product_id="prod_obx_01",
                    quantity=Decimal("2.0000"),
                    unit_price=Decimal("1180.00"),
                    mrp=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("2360.00"))
            ],
            customer_name="Walk-in Customer",
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert result.success is True
        assert result.outbox_event_id is not None
        invoice_id = result.invoice_id

        # Verify initial outbox event state is PENDING
        stmt_obx = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == result.outbox_event_id)
        obx_evt = (await session.execute(stmt_obx)).scalar_one_or_none()
        assert obx_evt is not None
        assert obx_evt.status == "PENDING"
        assert obx_evt.event_type == "SALES_INVOICE_POSTED"

    # Process outbox events using OutboxQueueWorker wired to UnifiedAccountingLedgerService
    worker_res = await OutboxQueueWorker.process_tenant_database(
        database_name="smriti001",
        dispatcher_callback=UnifiedAccountingLedgerService.dispatch_outbox_event,
        event_type="SALES_INVOICE_POSTED"
    )
    assert worker_res["dispatched_count"] >= 1
    assert result.outbox_event_id in worker_res["dispatched_event_ids"]

    # Verify outbox event is now DISPATCHED
    async with session_factory() as session:
        stmt_obx_after = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == result.outbox_event_id)
        evt_after = (await session.execute(stmt_obx_after)).scalar_one_or_none()
        assert evt_after.status == "DISPATCHED"
        assert evt_after.dispatched_at is not None

        # Verify authoritative JournalVoucher exists
        stmt_jv = select(JournalVoucher).where(
            JournalVoucher.company_id == "COMP-001",
            JournalVoucher.reference_doc_type == "SALES_INVOICE",
            JournalVoucher.reference_doc_id == invoice_id
        )
        jv = (await session.execute(stmt_jv)).scalar_one_or_none()
        assert jv is not None
        assert jv.voucher_type == "SALES_INVOICE"
        assert jv.is_posted is True

        # Verify Strict Double-Entry Balance Invariant: Debit == Credit
        assert jv.total_debit == Decimal("2360.00")
        assert jv.total_credit == Decimal("2360.00")

        # Verify GeneralLedgerEntry line items
        stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
        entries = (await session.execute(stmt_gle)).scalars().all()
        assert len(entries) >= 2

        debit_sum = sum(Decimal(str(e.debit_amount)) for e in entries)
        credit_sum = sum(Decimal(str(e.credit_amount)) for e in entries)
        assert debit_sum == Decimal("2360.00")
        assert credit_sum == Decimal("2360.00")


@pytest.mark.asyncio
async def test_outbox_gl_dispatcher_strict_idempotency():
    """
    Verifies that calling dispatch_outbox_event multiple times on the same
    event returns the existing JournalVoucher without duplicating entries.
    """
    session_factory = get_company_sessionmaker("smriti001")
    idem_key = f"IDEM-OBX-IDEMP-{uuid.uuid4().hex[:8]}"

    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_obx_01",
                cashier_id="CASHIER-01",
                terminal_id="TERM-01",
                idempotency_key=idem_key,
                client_invoice_no=f"INV-IDEMP-{uuid.uuid4().hex[:6].upper()}",
                source_channel="POS_RETAIL",
            ),
            items=[
                CanonicalPostingLineItem(
                    code="PROD-OBX-01",
                    name="SMRITI Outbox Integration Shirt",
                    product_id="prod_obx_01",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1180.00"),
                    mrp=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1180.00"))
            ],
            customer_name="Walk-in Customer",
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        obx_stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == result.outbox_event_id)
        evt = (await session.execute(obx_stmt)).scalar_one()

        # First dispatch
        v1 = await UnifiedAccountingLedgerService.dispatch_outbox_event(evt, session=session)
        assert v1 is not None

        # Second dispatch (idempotent replay)
        v2 = await UnifiedAccountingLedgerService.dispatch_outbox_event(evt, session=session)
        assert v2 is not None
        assert v1.id == v2.id

        # Verify only 1 voucher exists in the database
        count_stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == "COMP-001",
            JournalVoucher.reference_doc_type == "SALES_INVOICE",
            JournalVoucher.reference_doc_id == result.invoice_id
        )
        vouchers = (await session.execute(count_stmt)).scalars().all()
        assert len(vouchers) == 1


@pytest.mark.asyncio
async def test_purchase_receipt_outbox_to_gl_dispatch():
    """
    Verifies that PURCHASE_RECEIPT_POSTED outbox events are dispatched into
    authoritative double-entry vouchers (Inventory Asset Dr, Creditors Cr, GST Dr).
    """
    session_factory = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    receipt_id = f"rcpt_obx_{unique_suffix}"
    receipt_no = f"PR-OBX-{unique_suffix.upper()}"

    async with session_factory() as session:
        rcpt = PurchaseReceipt(
            id=receipt_id,
            company_id="COMP-001",
            branch_id="MAIN",
            receipt_no=receipt_no,
            supplier_id="SUPP-OBX-01",
            subtotal=Decimal("5000.00"),
            tax_total=Decimal("900.00"),
            grand_total=Decimal("5900.00"),
            status="RECEIVED"
        )
        session.add(rcpt)
        await session.commit()

        # Record outbox event for the purchase receipt
        outbox_event = await OutboxService.record_event(
            session=session,
            target_channel="ACCOUNTING",
            payload={
                "event_type": "PURCHASE_RECEIPT_POSTED",
                "receipt_id": receipt_id,
                "receipt_no": receipt_no,
                "company_id": "COMP-001",
                "branch_id": "MAIN",
                "grand_total": "5900.00"
            },
            event_type="PURCHASE_RECEIPT_POSTED",
            aggregate_type="PURCHASE_RECEIPT",
            aggregate_id=receipt_id,
            company_id="COMP-001"
        )
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.dispatch_outbox_event(outbox_event, session=session)
        assert voucher is not None
        assert voucher.voucher_type == "PURCHASE_RECEIPT"
        assert voucher.total_debit == Decimal("5900.00")
        assert voucher.total_credit == Decimal("5900.00")


@pytest.mark.asyncio
async def test_payment_transaction_outbox_to_gl_dispatch():
    """
    Verifies that PAYMENT_TRANSACTION_POSTED outbox events are dispatched into
    authoritative double-entry vouchers (Cash/Bank Dr, Debtors Cr).
    """
    session_factory = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    pay_id = f"pay_obx_{unique_suffix}"
    tx_no = f"TX-OBX-{unique_suffix.upper()}"

    async with session_factory() as session:
        pay = PaymentTransaction(
            id=pay_id,
            company_id="COMP-001",
            branch_id="MAIN",
            transaction_no=tx_no,
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=f"inv_ref_{unique_suffix}",
            party_id="cust_outbox_test_01",
            tender_type="CASH",
            amount=Decimal("1750.00"),
            currency="INR",
            idempotency_key=f"idemp_pay_obx_{unique_suffix}",
            status="SUCCESS",
            captured_at=datetime.now(timezone.utc)
        )
        session.add(pay)
        await session.commit()

        outbox_event = await OutboxService.record_event(
            session=session,
            target_channel="ACCOUNTING",
            payload={
                "event_type": "PAYMENT_TRANSACTION_POSTED",
                "payment_id": pay_id,
                "company_id": "COMP-001",
                "branch_id": "MAIN",
                "amount": "1750.00"
            },
            event_type="PAYMENT_TRANSACTION_POSTED",
            aggregate_type="PAYMENT_TRANSACTION",
            aggregate_id=pay_id,
            company_id="COMP-001"
        )
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.dispatch_outbox_event(outbox_event, session=session)
        assert voucher is not None
        assert voucher.voucher_type == "PAYMENT_RECEIPT"
        assert voucher.total_debit == Decimal("1750.00")
        assert voucher.total_credit == Decimal("1750.00")


@pytest.mark.asyncio
async def test_analytics_daemon_accounting_outbox_cycle():
    """
    Verifies AnalyticsDaemonService.run_accounting_outbox_cycle executing
    tenant batch outbox processing across registered tenant databases.
    """
    res = await AnalyticsDaemonService.run_accounting_outbox_cycle(
        tenants=[{"db_name": "smriti001", "company_id": "COMP-001"}]
    )
    assert res["tenants_processed"] == 1
    assert "smriti001" in res["outbox_results"]
    assert "dispatched_count" in res["outbox_results"]["smriti001"]
    assert "failed_count" in res["outbox_results"]["smriti001"]
