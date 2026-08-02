import uuid
from decimal import Decimal

import pytest
from sqlalchemy.future import select

from app.api.deps import TenantContext
from app.models.accounting import JournalLedgerEntryModel, JournalVoucherModel
from app.models.crm import Customer
from app.models.inventory import Product
from app.models.sales import SalesInvoice
from app.models.tenant import Company, Branch
from app.schemas.crm import CustomerCreate, CustomerGroupCreate
from app.schemas.inventory import ProductCreate
from app.tests.conftest import clear_db
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate, SalesInvoicePaymentCreate
from app.services.crm import CrmService
from app.services.inventory import InventoryService
from app.services.receivables import ReceivablesService
from app.services.sales import SalesService

pytestmark = pytest.mark.asyncio


async def _make_ar_customer(db_session, suffix: str, tenant_ctx: TenantContext):
    crm_serv = CrmService(db_session, tenant_ctx)
    await crm_serv.create_customer_group(
        CustomerGroupCreate(
            id=f"cg-ar-{suffix}",
            name=f"AR Group {suffix}",
            credit_limit=Decimal("1000.00"),
            auto_block_sales=True,
        )
    )
    return await crm_serv.create_customer(
        CustomerCreate(
            id=f"cust-ar-{suffix}",
            customer_group_id=f"cg-ar-{suffix}",
            name="AR Customer",
            outstanding=Decimal("0.00"),
        )
    )


async def _make_ar_product(db_session, suffix: str, tenant_ctx: TenantContext):
    inv_serv = InventoryService(db_session, tenant_ctx)
    return await inv_serv.create_product(
        ProductCreate(
            id=f"prod-ar-{suffix}",
            code=f"ARPRD{suffix}",
            name="AR Product",
            price=Decimal("100.00"),
            category="General",
            barcode=f"ARBAR{suffix}",
            stock=10,
        )
    )


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)
    yield
    try:
        await clear_db(db_session)
    except Exception:
        pass


async def test_customer_ledger_entries_follow_invoice_payment_and_cancel(db_session):
    suffix = uuid.uuid4().hex[:8]
    company = Company(id=f"comp-ar-{suffix}", name="AR Company", is_active=True)
    branch = Branch(id=f"br-ar-{suffix}", company_id=company.id, name="AR Branch", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=company.id, branch_id=branch.id)
    sales_serv = SalesService(db_session, tenant_ctx)
    customer = await _make_ar_customer(db_session, suffix, tenant_ctx)
    await _make_ar_product(db_session, suffix, tenant_ctx)

    invoice_in = SalesInvoiceCreate(
        id=f"inv-ar-{suffix}",
        invoice_no=f"INV-AR-{suffix}",
        customer_id=customer.id,
        items=[
            SalesInvoiceItemCreate(
                product_id=f"prod-ar-{suffix}",
                code=f"ARPRD{suffix}",
                name="AR Product",
                quantity=Decimal("1.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("118.00"),
            )
        ],
        payments=[
            SalesInvoicePaymentCreate(
                payment_mode="CASH",
                amount=Decimal("50.00"),
                transaction_no=f"TX-{suffix}",
            )
        ],
    )

    invoice = await sales_serv.create_sales_invoice(invoice_in)
    assert invoice.balance_due == Decimal("68.00")

    vouchers = (await db_session.execute(
        select(JournalVoucherModel).where(JournalVoucherModel.ref_document_no == invoice.invoice_no)
    )).scalars().all()
    assert len(vouchers) == 1

    ledger_entries = (await db_session.execute(
        select(JournalLedgerEntryModel).where(JournalLedgerEntryModel.voucher_id == vouchers[0].id)
    )).scalars().all()
    assert any(entry.account_code == "1200-AR" and entry.debit == Decimal("118.00") for entry in ledger_entries)

    receivables = ReceivablesService(db_session, tenant_ctx)
    statement = await receivables.get_customer_statement(customer.id)
    assert Decimal(str(statement["total_due"])) == Decimal("68.00")
    assert Decimal(str(statement["current_outstanding"])) == Decimal("68.00")

    aging = await receivables.get_ageing(customer.id)
    assert Decimal(str(aging["buckets"]["0_30"]["amount"])) == Decimal("68.00")

    reconciliation = await receivables.reconcile_invoice(invoice.id)
    assert reconciliation["reconciled"] is True

    await sales_serv.cancel_sales_invoice(invoice.id)
    customer_after_cancel = await db_session.get(Customer, customer.id)
    assert Decimal(str(customer_after_cancel.outstanding)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_receivables_service_apply_payment_and_outstanding(db_session):
    suffix = uuid.uuid4().hex[:8]
    company = Company(id=f"comp-ar2-{suffix}", name="AR Company 2", is_active=True)
    branch = Branch(id=f"br-ar2-{suffix}", company_id=company.id, name="AR Branch 2", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=company.id, branch_id=branch.id)
    sales_serv = SalesService(db_session, tenant_ctx)
    customer = await _make_ar_customer(db_session, suffix, tenant_ctx)
    await _make_ar_product(db_session, suffix, tenant_ctx)

    invoice_in = SalesInvoiceCreate(
        id=f"inv-ar2-{suffix}",
        invoice_no=f"INV-AR2-{suffix}",
        customer_id=customer.id,
        items=[
            SalesInvoiceItemCreate(
                product_id=f"prod-ar-{suffix}",
                code=f"ARPRD{suffix}",
                name="AR Product",
                quantity=Decimal("1.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("118.00"),
            )
        ],
    )

    invoice = await sales_serv.create_sales_invoice(invoice_in)
    assert invoice.balance_due == Decimal("118.00")

    receivables = ReceivablesService(db_session, tenant_ctx)
    payment = await receivables.apply_payment(
        invoice_id=invoice.id,
        amount=Decimal("50.00"),
        payment_mode="CASH",
        reference_no=f"TX-{suffix}",
    )

    assert payment.amount == Decimal("50.00")

    updated_invoice = (await db_session.execute(
        select(SalesInvoice).where(SalesInvoice.id == invoice.id)
    )).scalars().first()
    assert updated_invoice.paid_amount == Decimal("50.00")
    assert updated_invoice.balance_due == Decimal("68.00")
    assert updated_invoice.status == "Partial"

    statement = await receivables.get_customer_statement(customer.id)
    assert Decimal(str(statement["total_due"])) == Decimal("68.00")
    assert Decimal(str(statement["total_paid"])) == Decimal("50.00")
    assert Decimal(str(statement["current_outstanding"])) == Decimal("68.00")

    outstanding = await receivables.calculate_outstanding(customer.id)
    assert outstanding == Decimal("68.00")

    open_invoices = await receivables.get_open_invoices(customer.id)
    assert len(open_invoices) == 1

    summary = await receivables.reconcile_customer(customer.id)
    assert summary["customer_id"] == customer.id
    assert len(summary["open_invoice_reconciliations"]) == 1


@pytest.mark.asyncio
async def test_receivables_service_reverse_invoice(db_session):
    suffix = uuid.uuid4().hex[:8]
    company = Company(id=f"comp-ar3-{suffix}", name="AR Company 3", is_active=True)
    branch = Branch(id=f"br-ar3-{suffix}", company_id=company.id, name="AR Branch 3", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=company.id, branch_id=branch.id)
    sales_serv = SalesService(db_session, tenant_ctx)
    customer = await _make_ar_customer(db_session, suffix, tenant_ctx)
    await _make_ar_product(db_session, suffix, tenant_ctx)

    invoice_in = SalesInvoiceCreate(
        id=f"inv-ar3-{suffix}",
        invoice_no=f"INV-AR3-{suffix}",
        customer_id=customer.id,
        items=[
            SalesInvoiceItemCreate(
                product_id=f"prod-ar-{suffix}",
                code=f"ARPRD{suffix}",
                name="AR Product",
                quantity=Decimal("1.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("118.00"),
            )
        ],
    )

    invoice = await sales_serv.create_sales_invoice(invoice_in)
    assert invoice.balance_due == Decimal("118.00")

    receivables = ReceivablesService(db_session, tenant_ctx)
    cancelled = await receivables.reverse_invoice(invoice.id)

    assert cancelled.status == "Cancelled"
    assert cancelled.is_deleted is True

    statement = await receivables.get_customer_statement(customer.id)
    assert Decimal(str(statement["total_due"])) == Decimal("0.00")
    assert Decimal(str(statement["current_outstanding"])) == Decimal("0.00")
