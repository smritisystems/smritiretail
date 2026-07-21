"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_sales_invoicing.py — Integration test suite for Phase 10 (v7.1.0)
Outbound Customer Sales Invoicing & Multi-Channel Payment Settlement Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.sales import SalesOrder, SalesOrderItem, SalesInvoice, SalesPayment
from app.models.crm import Customer
from app.models.inventory import Product
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.sales.engine.fulfillment_engine import FulfillmentEngine
from app.sales.engine.invoicing_engine import SalesInvoicingEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_inv_tenant(db):
    """Set up an isolated tenant for Sales Invoicing test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-inv-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-inv-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Invoice Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Invoice HQ", code=f"IHQ{uuid.uuid4().hex[:4].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_customer(db, company_id, branch_id):
    cust_id = f"cust-inv-{uuid.uuid4().hex[:8]}"
    cust = Customer(
        id=cust_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        code=f"CUST-INV-{uuid.uuid4().hex[:6].upper()}",
        name=f"Invoice Customer {uuid.uuid4().hex[:4]}",
        mobile=f"98765{uuid.uuid4().hex[:5]}",
        outstanding=Decimal("0.00")
    )
    db.add(cust)
    await db.flush()
    return cust_id


async def _make_product(db, tenant_ctx, stock=100, price=Decimal("300.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-inv-{uuid.uuid4().hex[:8]}",
        code=f"INVPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"Invoice Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-INV-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    product.stock = stock
    product.gst_percentage = Decimal("18.00")
    db.add(product)
    await db.flush()
    return product


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Generate Invoice from Sales Order calculates GST breakdown
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_invoice_from_sales_order_calculates_gst(db_session):
    """
    Assertion 1: Generating an invoice from a SalesOrder computes subtotal, CGST, SGST, tax total, and grand total.
    """
    company_id, branch_id, tenant = await _setup_inv_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=50, price=Decimal("300.00"), code_suffix="A")

    # Create & confirm SO
    order_id = f"so-inv-{uuid.uuid4().hex[:8]}"
    order = SalesOrder(id=order_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-INV-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(order)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=order_id, product_id=product.id, ordered_quantity=Decimal("10.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("300.00"), line_total=Decimal("3000.00")))
    await db_session.flush()

    ful_engine = FulfillmentEngine(db_session, tenant)
    await ful_engine.confirm_sales_order(order_id)

    inv_engine = SalesInvoicingEngine(db_session, tenant)
    invoice = await inv_engine.generate_invoice_from_order(order_id, is_interstate=False)

    assert invoice is not None
    assert invoice.subtotal == Decimal("3000.00")
    assert invoice.cgst_amount == Decimal("270.00")  # 3000 * 9%
    assert invoice.sgst_amount == Decimal("270.00")  # 3000 * 9%
    assert invoice.tax_total == Decimal("540.00")
    assert invoice.grand_total == Decimal("3540.00")
    assert invoice.balance_due == Decimal("3540.00")
    assert invoice.status == "Unpaid"
    assert len(invoice.items) == 1

    print("\n[PASS] Assertion 1: Invoice generated from SO with correct 18% intra-state GST breakdown")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Record Cash Payment reduces invoice balance to 0 and marks Paid
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_record_cash_payment_reduces_invoice_balance(db_session):
    """
    Assertion 2: Recording full cash payment settles invoice balance_due to 0 and updates status to Paid.
    """
    company_id, branch_id, tenant = await _setup_inv_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=20, price=Decimal("100.00"), code_suffix="B")

    order_id = f"so-inv-b-{uuid.uuid4().hex[:8]}"
    order = SalesOrder(id=order_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-INVB-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(order)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=order_id, product_id=product.id, ordered_quantity=Decimal("5.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("100.00"), line_total=Decimal("500.00")))
    await db_session.flush()

    ful_engine = FulfillmentEngine(db_session, tenant)
    await ful_engine.confirm_sales_order(order_id)

    inv_engine = SalesInvoicingEngine(db_session, tenant)
    invoice = await inv_engine.generate_invoice_from_order(order_id)

    payment = await inv_engine.record_payment(
        invoice_id=invoice.id,
        amount=invoice.grand_total,
        payment_mode="CASH",
        reference_no="CASH-REC-001"
    )

    assert payment is not None
    assert payment.payment_mode == "CASH"
    assert payment.amount == invoice.grand_total

    inv_stmt = select(SalesInvoice).where(SalesInvoice.id == invoice.id)
    updated_inv = (await db_session.execute(inv_stmt)).scalars().first()
    assert updated_inv.paid_amount == updated_inv.grand_total
    assert updated_inv.balance_due == Decimal("0.00")
    assert updated_inv.status == "Paid"

    print("\n[PASS] Assertion 2: Cash payment settled invoice balance to 0 and marked status Paid")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Partial payment updates invoice status to Partial
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_partial_payment_updates_status_to_partial(db_session):
    """
    Assertion 3: Partial payment updates paid_amount and balance_due while keeping status Partial.
    """
    company_id, branch_id, tenant = await _setup_inv_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=100, price=Decimal("1000.00"), code_suffix="C")

    order_id = f"so-inv-c-{uuid.uuid4().hex[:8]}"
    order = SalesOrder(id=order_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-INVC-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(order)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=order_id, product_id=product.id, ordered_quantity=Decimal("1.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("1000.00"), line_total=Decimal("1000.00")))
    await db_session.flush()

    ful_engine = FulfillmentEngine(db_session, tenant)
    await ful_engine.confirm_sales_order(order_id)

    inv_engine = SalesInvoicingEngine(db_session, tenant)
    invoice = await inv_engine.generate_invoice_from_order(order_id)  # grand_total = 1180.00

    # Pay 500 UPI
    payment = await inv_engine.record_payment(invoice.id, amount=Decimal("500.00"), payment_mode="UPI", reference_no="UPI-998877")

    inv_stmt = select(SalesInvoice).where(SalesInvoice.id == invoice.id)
    updated_inv = (await db_session.execute(inv_stmt)).scalars().first()
    assert updated_inv.paid_amount == Decimal("500.00")
    assert updated_inv.balance_due == Decimal("680.00")
    assert updated_inv.status == "Partial"

    print("\n[PASS] Assertion 3: Partial payment recorded correctly with status Partial")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Credit sale increases customer outstanding balance
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_credit_sale_increases_customer_outstanding(db_session):
    """
    Assertion 4: Settlement via CREDIT mode increases Customer.outstanding ledger balance.
    """
    company_id, branch_id, tenant = await _setup_inv_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=10, price=Decimal("200.00"), code_suffix="D")

    order_id = f"so-inv-d-{uuid.uuid4().hex[:8]}"
    order = SalesOrder(id=order_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-INVD-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(order)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=order_id, product_id=product.id, ordered_quantity=Decimal("1.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("200.00"), line_total=Decimal("200.00")))
    await db_session.flush()

    ful_engine = FulfillmentEngine(db_session, tenant)
    await ful_engine.confirm_sales_order(order_id)

    inv_engine = SalesInvoicingEngine(db_session, tenant)
    invoice = await inv_engine.generate_invoice_from_order(order_id)  # grand_total = 236.00

    # Settle on credit
    await inv_engine.record_payment(invoice.id, amount=Decimal("236.00"), payment_mode="CREDIT")

    cust_stmt = select(Customer).where(Customer.id == cust_id)
    updated_cust = (await db_session.execute(cust_stmt)).scalars().first()
    assert Decimal(str(updated_cust.outstanding)) == Decimal("236.00")

    print("\n[PASS] Assertion 4: Credit sale increased Customer.outstanding to 236.00")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Overpayment rejected with HTTP 400
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_overpayment_rejected_with_http_400(db_session):
    """
    Assertion 5: Attempting to record a payment exceeding the invoice balance_due raises HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_inv_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=10, price=Decimal("100.00"), code_suffix="E")

    order_id = f"so-inv-e-{uuid.uuid4().hex[:8]}"
    order = SalesOrder(id=order_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-INVE-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(order)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=order_id, product_id=product.id, ordered_quantity=Decimal("1.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("100.00"), line_total=Decimal("100.00")))
    await db_session.flush()

    ful_engine = FulfillmentEngine(db_session, tenant)
    await ful_engine.confirm_sales_order(order_id)

    inv_engine = SalesInvoicingEngine(db_session, tenant)
    invoice = await inv_engine.generate_invoice_from_order(order_id)  # balance_due = 118.00

    # Overpay 500.00
    with pytest.raises(HTTPException) as exc_info:
        await inv_engine.record_payment(invoice.id, amount=Decimal("500.00"), payment_mode="CASH")

    assert exc_info.value.status_code == 400
    assert "exceeds remaining invoice balance due" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 5: Overpayment attempt correctly rejected with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Sales Invoicing
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_sales_invoicing(db_session):
    """
    Assertion 6: Cross-tenant access to SalesInvoices or recording payments on other tenants' invoices raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_inv_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant_a, stock=10, code_suffix="F")

    order_id = f"so-inv-f-{uuid.uuid4().hex[:8]}"
    order = SalesOrder(id=order_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-INVF-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(order)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=order_id, product_id=product.id, ordered_quantity=Decimal("1.00"), reserved_quantity=Decimal("0.00"), unit_price=Decimal("100.00"), line_total=Decimal("100.00")))
    await db_session.flush()

    ful_engine_a = FulfillmentEngine(db_session, tenant_a)
    await ful_engine_a.confirm_sales_order(order_id)

    inv_engine_a = SalesInvoicingEngine(db_session, tenant_a)
    invoice_a = await inv_engine_a.generate_invoice_from_order(order_id)

    # Tenant B tries to record payment on Tenant A's invoice
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    inv_engine_b = SalesInvoicingEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await inv_engine_b.record_payment(invoice_a.id, amount=Decimal("10.00"), payment_mode="CASH")

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for Sales Invoices and Payments")
