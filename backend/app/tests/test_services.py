"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from decimal import Decimal
import pytest
from fastapi import HTTPException
from app.models.crm import Customer
from app.models.inventory import Product
from app.models.tenant import Company, Branch
from app.schemas.crm import CustomerCreate, CustomerGroupCreate
from app.schemas.inventory import ProductCreate
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate, SalesInvoicePaymentCreate
from app.services.crm import CrmService
from app.services.inventory import InventoryService
from app.services.sales import SalesService
from app.api.deps import TenantContext

pytestmark = pytest.mark.asyncio

async def test_crm_and_inventory_services(db_session):
    suffix = uuid.uuid4().hex[:8]
    company = Company(id=f"comp-{suffix}", name="Test Company", is_active=True)
    branch = Branch(id=f"br-{suffix}", company_id=company.id, name="Test Branch", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=company.id, branch_id=branch.id)
    crm_serv = CrmService(db_session, tenant_ctx)
    inv_serv = InventoryService(db_session, tenant_ctx)

    # 1. Create customer group
    group = await crm_serv.create_customer_group(
        CustomerGroupCreate(
            id=f"cg-{suffix}",
            name=f"Standard Group {suffix}",
            credit_limit=Decimal("500.00"),
            auto_block_sales=True
        )
    )
    assert group.name == f"Standard Group {suffix}"

    # Try duplicate group name
    with pytest.raises(HTTPException) as exc:
        await crm_serv.create_customer_group(
            CustomerGroupCreate(
                id=f"cg-{suffix}-dup",
                name=f"Standard Group {suffix}"
            )
        )
    assert exc.value.status_code == 400

    # 2. Create customer
    mobile_num = "".join(filter(str.isdigit, suffix))[:10].zfill(10)
    customer = await crm_serv.create_customer(
        CustomerCreate(
            id=f"cust-{suffix}",
            customer_group_id=f"cg-{suffix}",
            name="Test Customer",
            mobile=mobile_num
        )
    )
    assert customer.name == "Test Customer"

    # Try duplicate mobile
    with pytest.raises(HTTPException) as exc:
        await crm_serv.create_customer(
            CustomerCreate(
                id=f"cust-{suffix}-dup",
                customer_group_id=f"cg-{suffix}",
                name="Test Duplicate",
                mobile=mobile_num
            )
        )
    assert exc.value.status_code == 400

    # 3. Create product
    product = await inv_serv.create_product(
        ProductCreate(
            id=f"prod-{suffix}",
            code=f"CODE{suffix}",
            name="Test Product",
            price=Decimal("100.00"),
            category="General",
            barcode=f"BC{suffix}",
            stock=10
        )
    )
    assert product.code == f"CODE{suffix}"
    assert product.stock == 10

    # Test stock availability checks
    assert await inv_serv.check_stock_availability(f"prod-{suffix}", 5) is True
    assert await inv_serv.check_stock_availability(f"prod-{suffix}", 15) is False


async def test_sales_invoice_service(db_session):
    suffix = uuid.uuid4().hex[:8]
    company = Company(id=f"comp-{suffix}", name="Sales Company", is_active=True)
    branch = Branch(id=f"br-{suffix}", company_id=company.id, name="Sales Branch", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=company.id, branch_id=branch.id)
    crm_serv = CrmService(db_session, tenant_ctx)
    inv_serv = InventoryService(db_session, tenant_ctx)
    sales_serv = SalesService(db_session, tenant_ctx)

    # Setup customer and product
    await crm_serv.create_customer_group(
        CustomerGroupCreate(
            id=f"cg-s-{suffix}",
            name=f"Sales Group {suffix}",
            credit_limit=Decimal("500.00"),
            auto_block_sales=True
        )
    )
    await crm_serv.create_customer(
        CustomerCreate(
            id=f"cust-s-{suffix}",
            customer_group_id=f"cg-s-{suffix}",
            name="Sales Customer",
            outstanding=Decimal("0.00")
        )
    )
    await inv_serv.create_product(
        ProductCreate(
            id=f"prod-s-{suffix}",
            code=f"CODES{suffix}",
            name="Sales Product",
            price=Decimal("100.00"),
            category="General",
            barcode=f"BCS{suffix}",
            stock=5
        )
    )

    # 1. Successful invoice creation
    invoice_in = SalesInvoiceCreate(
        id=f"inv-{suffix}",
        invoice_no=f"INVS{suffix}",
        customer_id=f"cust-s-{suffix}",
        items=[
            SalesInvoiceItemCreate(
                product_id=f"prod-s-{suffix}",
                code=f"CODES{suffix}",
                name="Sales Product",
                quantity=Decimal("2.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("236.00")
            )
        ]
    )
    
    invoice = await sales_serv.create_sales_invoice(invoice_in)
    assert invoice.tax_total == Decimal("36.00")
    assert invoice.grand_total == Decimal("236.00")

    # Check product stock deduction (5 - 2 = 3)
    product_after = await db_session.get(Product, f"prod-s-{suffix}")
    assert product_after.stock == 3

    # 2. Exceed Credit Limit (Outstanding is still checked during invoice creation)
    invoice_in_fail = SalesInvoiceCreate(
        id=f"inv-f-{suffix}",
        invoice_no=f"INVF{suffix}",
        customer_id=f"cust-s-{suffix}",
        items=[
            SalesInvoiceItemCreate(
                product_id=f"prod-s-{suffix}",
                code=f"CODES{suffix}",
                name="Sales Product",
                quantity=Decimal("3.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("354.00")
            )
        ]
    )
    
    # Update customer outstanding to mimic outstanding check (since it checks customer.outstanding + new_amount)
    customer_db = await db_session.get(Customer, f"cust-s-{suffix}")
    customer_db.outstanding = Decimal("236.00")
    await db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await sales_serv.create_sales_invoice(invoice_in_fail)
    assert exc.value.status_code == 400
    assert "Credit limit exceeded" in exc.value.detail


async def test_sales_invoice_payment_number_is_generated(db_session):
    suffix = uuid.uuid4().hex[:8]
    company = Company(id=f"comp-pay-{suffix}", name="Payment Company", is_active=True)
    branch = Branch(id=f"br-pay-{suffix}", company_id=company.id, name="Payment Branch", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=company.id, branch_id=branch.id)
    crm_serv = CrmService(db_session, tenant_ctx)
    inv_serv = InventoryService(db_session, tenant_ctx)
    sales_serv = SalesService(db_session, tenant_ctx)

    await crm_serv.create_customer_group(
        CustomerGroupCreate(
            id=f"cg-pay-{suffix}",
            name=f"Payment Group {suffix}",
            credit_limit=Decimal("1000.00"),
            auto_block_sales=True,
        )
    )
    await crm_serv.create_customer(
        CustomerCreate(
            id=f"cust-pay-{suffix}",
            customer_group_id=f"cg-pay-{suffix}",
            name="Payment Customer",
            outstanding=Decimal("0.00"),
        )
    )
    await inv_serv.create_product(
        ProductCreate(
            id=f"prod-pay-{suffix}",
            code=f"PAYCODE{suffix}",
            name="Payment Product",
            price=Decimal("100.00"),
            category="General",
            barcode=f"BAR{suffix}",
            stock=10,
        )
    )

    invoice_in = SalesInvoiceCreate(
        id=f"inv-pay-{suffix}",
        invoice_no=f"INV-PAY-{suffix}",
        customer_id=f"cust-pay-{suffix}",
        items=[
            SalesInvoiceItemCreate(
                product_id=f"prod-pay-{suffix}",
                code=f"PAYCODE{suffix}",
                name="Payment Product",
                quantity=Decimal("1.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("118.00"),
            )
        ],
        payments=[
            SalesInvoicePaymentCreate(
                payment_mode="CASH",
                amount=Decimal("118.00"),
                transaction_no=f"TX-{suffix}",
            )
        ],
    )

    invoice = await sales_serv.create_sales_invoice(invoice_in)
    assert invoice.payments
    assert invoice.payments[0].payment_no
    assert invoice.payments[0].payment_no.startswith("PAY-")


async def test_sales_invoice_posts_accounting_journal_in_advanced_mode(db_session, monkeypatch):
    suffix = uuid.uuid4().hex[:8]
    monkeypatch.setattr("app.core.config.settings.ACCOUNTING_MODE", "ADVANCED")
    company = Company(id=f"comp-jv-{suffix}", name="Journal Company", is_active=True)
    branch = Branch(id=f"br-jv-{suffix}", company_id=company.id, name="Journal Branch", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=company.id, branch_id=branch.id)
    crm_serv = CrmService(db_session, tenant_ctx)
    inv_serv = InventoryService(db_session, tenant_ctx)
    sales_serv = SalesService(db_session, tenant_ctx)

    await crm_serv.create_customer_group(
        CustomerGroupCreate(
            id=f"cg-jv-{suffix}",
            name=f"Journal Group {suffix}",
            credit_limit=Decimal("1000.00"),
            auto_block_sales=True,
        )
    )
    await crm_serv.create_customer(
        CustomerCreate(
            id=f"cust-jv-{suffix}",
            customer_group_id=f"cg-jv-{suffix}",
            name="Journal Customer",
            outstanding=Decimal("0.00"),
        )
    )
    await inv_serv.create_product(
        ProductCreate(
            id=f"prod-jv-{suffix}",
            code=f"JVCODE{suffix}",
            name="Journal Product",
            price=Decimal("100.00"),
            category="General",
            barcode=f"JVBAR{suffix}",
            stock=10,
        )
    )

    invoice_in = SalesInvoiceCreate(
        id=f"inv-jv-{suffix}",
        invoice_no=f"INV-JV-{suffix}",
        customer_id=f"cust-jv-{suffix}",
        items=[
            SalesInvoiceItemCreate(
                product_id=f"prod-jv-{suffix}",
                code=f"JVCODE{suffix}",
                name="Journal Product",
                quantity=Decimal("1.00"),
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("118.00"),
            )
        ],
        payments=[
            SalesInvoicePaymentCreate(
                payment_mode="CASH",
                amount=Decimal("118.00"),
                transaction_no=f"TX-{suffix}",
            )
        ],
    )

    from app.services import sales_orchestrator as sales_orch_module

    with pytest.MonkeyPatch.context() as mp:
        called = {}

        async def fake_post_journal(self, voucher):
            called["no"] = voucher.ref_document_no
            called["entries"] = len(voucher.entries)
            return "JV-TEST"

        mp.setattr(sales_orch_module.AccountingService, "post_journal", fake_post_journal)
        invoice = await sales_serv.create_sales_invoice(invoice_in)

    assert invoice.invoice_no == invoice_in.invoice_no
    assert called["no"] == invoice_in.invoice_no
    assert called["entries"] >= 2
