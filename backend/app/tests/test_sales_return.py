"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_sales_return.py — Integration test suite for Phase 11 (v7.2.0)
Outbound Customer Sales Returns & Credit Note Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.sales import SalesOrder, SalesOrderItem, SalesInvoice, SalesReturn, CreditNote
from app.models.crm import Customer
from app.models.inventory import Product
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.sales.engine.fulfillment_engine import FulfillmentEngine
from app.sales.engine.invoicing_engine import SalesInvoicingEngine
from app.sales.engine.return_engine import SalesReturnEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_ret_tenant(db):
    """Set up an isolated tenant for Sales Return test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-ret-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-ret-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Return Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Return HQ", code=f"RHQ{uuid.uuid4().hex[:8].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_customer(db, company_id, branch_id):
    cust_id = f"cust-ret-{uuid.uuid4().hex[:8]}"
    cust = Customer(
        id=cust_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        code=f"CUST-RET-{uuid.uuid4().hex[:6].upper()}",
        name=f"Return Customer {uuid.uuid4().hex[:4]}",
        mobile=f"98765{uuid.uuid4().hex[:5]}",
        outstanding=Decimal("1000.00")  # Customer has 1000 outstanding credit balance
    )
    db.add(cust)
    await db.flush()
    return cust_id


async def _make_product(db, tenant_ctx, stock=100, price=Decimal("300.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-ret-{uuid.uuid4().hex[:8]}",
        code=f"RETPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"Return Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-RET-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    product.stock = stock
    product.gst_percentage = Decimal("18.00")
    db.add(product)
    await db.flush()
    return product


async def _create_test_invoice(db_session, company_id, branch_id, tenant, cust_id, product, qty=Decimal("10.00")):
    engine_ful = FulfillmentEngine(db_session, tenant)
    o_id = f"so-ret-{uuid.uuid4().hex[:8]}"
    order = SalesOrder(id=o_id, uuid=str(uuid.uuid4()), tenant_id=company_id, company_id=company_id, branch_id=branch_id, order_no=f"SO-RET-{uuid.uuid4().hex[:4].upper()}", customer_id=cust_id, status="Draft")
    db_session.add(order)
    db_session.add(SalesOrderItem(company_id=company_id, order_id=o_id, product_id=product.id, ordered_quantity=qty, reserved_quantity=Decimal("0.00"), unit_price=product.price, line_total=qty * product.price))
    await db_session.flush()
    await engine_ful.confirm_sales_order(o_id)

    engine_inv = SalesInvoicingEngine(db_session, tenant)
    return await engine_inv.generate_invoice_from_order(o_id)


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Create Sales Return for Valid Invoice
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_sales_return_for_valid_invoice(db_session):
    """
    Assertion 1: Creating a draft SalesReturn order linked to a valid SalesInvoice succeeds.
    """
    company_id, branch_id, tenant = await _setup_ret_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=50, price=Decimal("300.00"), code_suffix="A")
    invoice = await _create_test_invoice(db_session, company_id, branch_id, tenant, cust_id, product, qty=Decimal("10.00"))

    engine_ret = SalesReturnEngine(db_session, tenant)
    ret_order = await engine_ret.create_sales_return(
        invoice_id=invoice.id,
        items=[{"product_id": product.id, "quantity": Decimal("2.00"), "condition": "Restockable"}],
        reason="Wrong size delivered"
    )

    assert ret_order is not None
    assert ret_order.status == "Draft"
    assert ret_order.invoice_id == invoice.id
    assert len(ret_order.items) == 1
    assert ret_order.items[0].quantity == Decimal("2.00")

    print("\n[PASS] Assertion 1: Draft sales return created successfully")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Evaluate Return restocks usable inventory into Product stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evaluate_return_restocks_inventory(db_session):
    """
    Assertion 2: Processing a return line marked Restockable increments Product.stock.
    """
    company_id, branch_id, tenant = await _setup_ret_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=45, price=Decimal("200.00"), code_suffix="B")
    invoice = await _create_test_invoice(db_session, company_id, branch_id, tenant, cust_id, product, qty=Decimal("5.00"))

    engine_ret = SalesReturnEngine(db_session, tenant)
    ret_order = await engine_ret.create_sales_return(
        invoice_id=invoice.id,
        items=[{"product_id": product.id, "quantity": Decimal("5.00"), "condition": "Restockable"}]
    )

    # Process evaluation
    result = await engine_ret.evaluate_and_process_return(
        return_id=ret_order.id,
        line_conditions=[{"product_id": product.id, "condition": "Restockable"}]
    )

    assert result["sales_return"].status == "Approved"
    assert result["credit_note"] is not None

    # Check restocked product
    p_stmt = select(Product).where(Product.id == product.id)
    updated_prod = (await db_session.execute(p_stmt)).scalars().first()
    assert updated_prod.stock == 50  # 45 + 5 = 50!

    print("\n[PASS] Assertion 2: Restockable return incremented product stock from 45 to 50")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Damaged return does NOT restock salable inventory
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_damaged_return_does_not_restock(db_session):
    """
    Assertion 3: Processing a return line marked Damaged does NOT increment salable Product.stock.
    """
    company_id, branch_id, tenant = await _setup_ret_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=40, price=Decimal("100.00"), code_suffix="C")
    invoice = await _create_test_invoice(db_session, company_id, branch_id, tenant, cust_id, product, qty=Decimal("5.00"))

    engine_ret = SalesReturnEngine(db_session, tenant)
    ret_order = await engine_ret.create_sales_return(
        invoice_id=invoice.id,
        items=[{"product_id": product.id, "quantity": Decimal("5.00"), "condition": "Damaged"}]
    )

    result = await engine_ret.evaluate_and_process_return(
        return_id=ret_order.id,
        line_conditions=[{"product_id": product.id, "condition": "Damaged"}]
    )

    assert result["sales_return"].status == "Approved"

    p_stmt = select(Product).where(Product.id == product.id)
    updated_prod = (await db_session.execute(p_stmt)).scalars().first()
    assert updated_prod.stock == 40  # Stock remains 40!

    print("\n[PASS] Assertion 3: Damaged return correctly skipped salable product stock increment")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Issue Credit Note reverses GST and reduces Customer outstanding
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_issue_credit_note_reverses_gst(db_session):
    """
    Assertion 4: Credit Note calculates GST tax reversal (CGST + SGST) and reduces Customer.outstanding ledger balance.
    """
    company_id, branch_id, tenant = await _setup_ret_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)  # initial outstanding = 1000.00
    product = await _make_product(db_session, tenant, stock=50, price=Decimal("500.00"), code_suffix="D")
    invoice = await _create_test_invoice(db_session, company_id, branch_id, tenant, cust_id, product, qty=Decimal("2.00"))

    engine_ret = SalesReturnEngine(db_session, tenant)
    ret_order = await engine_ret.create_sales_return(
        invoice_id=invoice.id,
        items=[{"product_id": product.id, "quantity": Decimal("2.00"), "condition": "Restockable"}]
    )

    result = await engine_ret.evaluate_and_process_return(ret_order.id)
    cn = result["credit_note"]

    # Return total = 2 * 500 = 1000 subtotal + 18% GST (90 CGST + 90 SGST) = 1180.00
    assert cn.subtotal == Decimal("1000.00")
    assert cn.cgst_amount == Decimal("90.00")
    assert cn.sgst_amount == Decimal("90.00")
    assert cn.tax_amount == Decimal("180.00")
    assert cn.grand_total == Decimal("1180.00")

    # Customer outstanding balance reduced by 1180.00 (from 1000 to max 0.00)
    cust_stmt = select(Customer).where(Customer.id == cust_id)
    updated_cust = (await db_session.execute(cust_stmt)).scalars().first()
    assert Decimal(str(updated_cust.outstanding)) == Decimal("0.00")

    print("\n[PASS] Assertion 4: Credit Note reversed 18% GST and reduced Customer.outstanding")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Excess return quantity rejected with HTTP 400
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_excess_return_quantity_rejected_with_http_400(db_session):
    """
    Assertion 5: Attempting to return more items than invoiced is rejected with HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_ret_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, stock=20, price=Decimal("100.00"), code_suffix="E")
    invoice = await _create_test_invoice(db_session, company_id, branch_id, tenant, cust_id, product, qty=Decimal("3.00"))

    engine_ret = SalesReturnEngine(db_session, tenant)

    with pytest.raises(HTTPException) as exc_info:
        await engine_ret.create_sales_return(
            invoice_id=invoice.id,
            items=[{"product_id": product.id, "quantity": Decimal("10.00"), "condition": "Restockable"}]
        )

    assert exc_info.value.status_code == 400
    assert "exceeds invoiced quantity" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 5: Excess return quantity correctly rejected with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Sales Returns
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_sales_returns(db_session):
    """
    Assertion 6: Cross-tenant access to SalesReturn or evaluating returns on other tenants' records raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_ret_tenant(db_session)
    cust_id = await _make_customer(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant_a, stock=10, code_suffix="F")
    invoice = await _create_test_invoice(db_session, company_id, branch_id, tenant_a, cust_id, product, qty=Decimal("1.00"))

    engine_ret_a = SalesReturnEngine(db_session, tenant_a)
    ret_a = await engine_ret_a.create_sales_return(
        invoice_id=invoice.id,
        items=[{"product_id": product.id, "quantity": Decimal("1.00"), "condition": "Restockable"}]
    )

    # Tenant B attempts to evaluate Tenant A's return order
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_ret_b = SalesReturnEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_ret_b.evaluate_and_process_return(ret_a.id)

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for Sales Returns")
