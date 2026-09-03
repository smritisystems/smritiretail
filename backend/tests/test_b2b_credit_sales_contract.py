"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
import pytest
from pathlib import Path
from decimal import Decimal
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.api.deps import TenantContext
from app.models.crm import Customer, CustomerGroup
from app.models.inventory import Product
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
from app.services.sales import SalesService


def _get_tenant_context() -> TenantContext:
    return TenantContext(
        company_id="COMP-001",
        branch_id="MAIN"
    )


@pytest.fixture
async def credit_test_env():
    """Setup isolated test customer, corporate customer group, and product in smriti001."""
    suffix = uuid.uuid4().hex[:6]
    cg_id = f"cg-corp-{suffix}"
    cust_id = f"cust-corp-{suffix}"
    prod_id = f"prod-test-{suffix}"
    prod_code = f"SKU-{suffix}"

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create Corporate CustomerGroup
        cg = CustomerGroup(
            id=cg_id,
            company_id="COMP-001",
            name=f"Corporate Group {suffix}",
            credit_limit=Decimal("500000.00"),
            unlimited_credit=False,
            credit_days=60,
            grace_days=0,
            credit_hold=False,
            auto_block_sales=True,
            can_purchase_on_credit=True,
            is_active=True,
            is_deleted=False
        )
        session.add(cg)

        # Create Corporate Customer with 0 initial outstanding
        cust = Customer(
            id=cust_id,
            company_id="COMP-001",
            customer_group_id=cg_id,
            code=f"CUST-{suffix}",
            name=f"Apex Logistics {suffix} Ltd",
            mobile="9820099887",
            gst_number="27AAACA9999A1Z5",
            outstanding=Decimal("0.00"),
            status="Active",
            tags=["Corporate", "B2B"],
            is_active=True,
            is_deleted=False
        )
        session.add(cust)

        # Create Test Product
        prod = Product(
            id=prod_id,
            company_id="COMP-001",
            code=prod_code,
            name=f"B2B Test Widget {suffix}",
            price=Decimal("100.00"),
            mrp=Decimal("120.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="8471",
            category="Industrial",
            barcode=f"BAR-{suffix}",
            stock=500,
            is_active=True,
            is_deleted=False
        )
        session.add(prod)
        await session.commit()

    yield {
        "suffix": suffix,
        "cg_id": cg_id,
        "cust_id": cust_id,
        "prod_id": prod_id,
        "prod_code": prod_code,
    }

    # Cleanup
    async with session_factory() as session:
        await session.execute(delete(SalesInvoiceItem).where(SalesInvoiceItem.product_id == prod_id))
        await session.execute(delete(SalesInvoice).where(SalesInvoice.customer_id == cust_id))
        await session.execute(delete(Product).where(Product.id == prod_id))
        await session.execute(delete(Customer).where(Customer.id == cust_id))
        await session.execute(delete(CustomerGroup).where(CustomerGroup.id == cg_id))
        await session.commit()


@pytest.mark.asyncio
async def test_credit_invoice_payment_mode_is_credit(credit_test_env):
    """Scenario 1: Credit invoice asserts payment_mode == 'CREDIT'."""
    env = credit_test_env
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv = await sales_svc.create_sales_invoice(
            SalesInvoiceCreate(
                customer_id=env["cust_id"],
                status="Completed",
                payment_mode="CREDIT",
                items=[
                    SalesInvoiceItemCreate(
                        product_id=env["prod_id"],
                        code=env["prod_code"],
                        name="Widget",
                        quantity=Decimal("1.00"),
                        price=Decimal("100.00"),
                        gst_rate=Decimal("18.00"),
                        is_tax_inclusive=False,
                        total_amount=Decimal("118.00")
                    )
                ]
            )
        )
        assert inv.payment_mode == "CREDIT"


@pytest.mark.asyncio
async def test_credit_invoice_paid_amount_is_zero(credit_test_env):
    """Scenario 2: Credit invoice asserts paid_amount == 0.00."""
    env = credit_test_env
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv = await sales_svc.create_sales_invoice(
            SalesInvoiceCreate(
                customer_id=env["cust_id"],
                status="Completed",
                payment_mode="CREDIT",
                items=[
                    SalesInvoiceItemCreate(
                        product_id=env["prod_id"],
                        code=env["prod_code"],
                        name="Widget",
                        quantity=Decimal("1.00"),
                        price=Decimal("100.00"),
                        gst_rate=Decimal("18.00"),
                        is_tax_inclusive=False,
                        total_amount=Decimal("118.00")
                    )
                ]
            )
        )
        assert Decimal(str(inv.paid_amount)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_credit_invoice_balance_amount_equals_grand_total(credit_test_env):
    """Scenario 3: Credit invoice asserts balance_amount == grand_total."""
    env = credit_test_env
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv = await sales_svc.create_sales_invoice(
            SalesInvoiceCreate(
                customer_id=env["cust_id"],
                status="Completed",
                payment_mode="CREDIT",
                items=[
                    SalesInvoiceItemCreate(
                        product_id=env["prod_id"],
                        code=env["prod_code"],
                        name="Widget",
                        quantity=Decimal("2.00"),
                        price=Decimal("100.00"),
                        gst_rate=Decimal("18.00"),
                        is_tax_inclusive=False,
                        total_amount=Decimal("236.00")
                    )
                ]
            )
        )
        assert Decimal(str(inv.balance_amount)) == Decimal("236.00")
        assert Decimal(str(inv.balance_amount)) == Decimal(str(inv.grand_total))


@pytest.mark.asyncio
async def test_credit_invoice_nonzero_opening_outstanding_delta(credit_test_env):
    """
    Scenario 4 (Contract Requirement 4):
    Verify exact delta calculation with non-zero opening outstanding.
    Opening outstanding: ₹50,000.00
    New Credit Invoice : ₹1,180.00
    Expected New Balance: ₹51,180.00
    Assert: new_outstanding == previous_outstanding + grand_total
    """
    env = credit_test_env
    cust_id = env["cust_id"]
    session_factory = get_company_sessionmaker("smriti001")
    
    # 1. Set customer opening balance to ₹50,000.00
    async with session_factory() as session:
        cust = (await session.execute(select(Customer).where(Customer.id == cust_id))).scalars().first()
        cust.outstanding = Decimal("50000.00")
        await session.commit()

    # 2. Execute Credit Sale
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv = await sales_svc.create_sales_invoice(
            SalesInvoiceCreate(
                customer_id=cust_id,
                status="Completed",
                payment_mode="CREDIT",
                items=[
                    SalesInvoiceItemCreate(
                        product_id=env["prod_id"],
                        code=env["prod_code"],
                        name="Widget",
                        quantity=Decimal("10.00"),
                        price=Decimal("100.00"),
                        gst_rate=Decimal("18.00"),
                        is_tax_inclusive=False,
                        total_amount=Decimal("1180.00")
                    )
                ]
            )
        )
        assert Decimal(str(inv.grand_total)) == Decimal("1180.00")
        assert Decimal(str(inv.paid_amount)) == Decimal("0.00")
        assert Decimal(str(inv.balance_amount)) == Decimal("1180.00")

        # 3. Assert PostgreSQL Customer record has exact new delta
        cust_after = (await session.execute(select(Customer).where(Customer.id == cust_id))).scalars().first()
        previous_outstanding = Decimal("50000.00")
        grand_total = Decimal("1180.00")
        expected_new_outstanding = Decimal("51180.00")
        
        assert Decimal(str(cust_after.outstanding)) == expected_new_outstanding
        assert Decimal(str(cust_after.outstanding)) == previous_outstanding + grand_total

        # Rule snapshots verification
        credit_terms = inv.rule_snapshots.get("credit_terms", {})
        assert Decimal(str(credit_terms.get("previous_outstanding"))) == Decimal("50000.0")
        assert Decimal(str(credit_terms.get("projected_outstanding"))) == Decimal("51180.0")


@pytest.mark.asyncio
async def test_credit_control_fails_closed_on_unexpected_crm_error(credit_test_env):
    """
    Scenario 5 (Contract Requirement 3):
    Credit control must strictly FAIL CLOSED.
    If an unexpected infrastructure/CRM error occurs during credit checking,
    the exception MUST NOT be swallowed, and no credit invoice must be completed.
    """
    env = credit_test_env
    cust_id = env["cust_id"]
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        
        # Inject an unexpected CRM service error
        sales_svc.crm_service.check_credit_limit = AsyncMock(
            side_effect=RuntimeError("CRM Engine Connection Timeout")
        )

        inv_payload = SalesInvoiceCreate(
            customer_id=cust_id,
            status="Completed",
            payment_mode="CREDIT",
            items=[
                SalesInvoiceItemCreate(
                    product_id=env["prod_id"],
                    code=env["prod_code"],
                    name="Widget",
                    quantity=Decimal("1.00"),
                    price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    total_amount=Decimal("118.00")
                )
            ]
        )

        # Must raise RuntimeError and NOT succeed
        with pytest.raises(RuntimeError) as exc_info:
            await sales_svc.create_sales_invoice(inv_payload)
        
        assert "CRM Engine Connection Timeout" in str(exc_info.value)

    # Verify that the invoice was NOT created and customer outstanding was NOT altered
    async with session_factory() as session:
        cust_check = (await session.execute(select(Customer).where(Customer.id == cust_id))).scalars().first()
        assert Decimal(str(cust_check.outstanding)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_cash_sale_preserves_existing_behavior(credit_test_env):
    """
    Scenario 6:
    CASH invoice preserves existing behavior:
    paid_amount == grand_total, balance_amount == 0, customer outstanding unchanged.
    """
    env = credit_test_env
    cust_id = env["cust_id"]
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv = await sales_svc.create_sales_invoice(
            SalesInvoiceCreate(
                customer_id=cust_id,
                status="Completed",
                payment_mode="CASH",
                paid_amount=Decimal("118.00"),
                balance_amount=Decimal("0.00"),
                items=[
                    SalesInvoiceItemCreate(
                        product_id=env["prod_id"],
                        code=env["prod_code"],
                        name="Widget",
                        quantity=Decimal("1.00"),
                        price=Decimal("100.00"),
                        gst_rate=Decimal("18.00"),
                        is_tax_inclusive=False,
                        total_amount=Decimal("118.00")
                    )
                ]
            )
        )
        assert inv.payment_mode == "CASH"
        assert Decimal(str(inv.paid_amount)) == Decimal("118.00")
        assert Decimal(str(inv.balance_amount)) == Decimal("0.00")

        cust_check = (await session.execute(select(Customer).where(Customer.id == cust_id))).scalars().first()
        assert Decimal(str(cust_check.outstanding)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_credit_limit_exceeded_raises_400(credit_test_env):
    """
    Scenario 7:
    Customer exceeding sanctioned credit limit raises SMRITI-CREDIT-001 (HTTP 400).
    """
    env = credit_test_env
    cust_id = env["cust_id"]
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Set customer outstanding close to 500,000 limit
        cust = (await session.execute(select(Customer).where(Customer.id == cust_id))).scalars().first()
        cust.outstanding = Decimal("499500.00")
        await session.commit()

    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv_payload = SalesInvoiceCreate(
            customer_id=cust_id,
            status="Completed",
            payment_mode="CREDIT",
            items=[
                SalesInvoiceItemCreate(
                    product_id=env["prod_id"],
                    code=env["prod_code"],
                    name="Widget",
                    quantity=Decimal("10.00"),
                    price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    total_amount=Decimal("1180.00")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await sales_svc.create_sales_invoice(inv_payload)

        assert exc_info.value.status_code == 400
        assert "SMRITI-CREDIT-001" in exc_info.value.detail or "credit limit" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_credit_hold_raises_400(credit_test_env):
    """
    Scenario 8:
    Customer account on credit hold raises SMRITI-CREDIT-002 (HTTP 400).
    """
    env = credit_test_env
    cg_id = env["cg_id"]
    cust_id = env["cust_id"]
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        cg = (await session.execute(select(CustomerGroup).where(CustomerGroup.id == cg_id))).scalars().first()
        cg.credit_hold = True
        await session.commit()

    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv_payload = SalesInvoiceCreate(
            customer_id=cust_id,
            status="Completed",
            payment_mode="CREDIT",
            items=[
                SalesInvoiceItemCreate(
                    product_id=env["prod_id"],
                    code=env["prod_code"],
                    name="Widget",
                    quantity=Decimal("1.00"),
                    price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    total_amount=Decimal("118.00")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await sales_svc.create_sales_invoice(inv_payload)

        assert exc_info.value.status_code == 400
        assert "SMRITI-CREDIT-002" in exc_info.value.detail or "credit hold" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_idempotency_safe_retry_same_key(credit_test_env):
    """
    Scenario 9:
    Submitting the same invoice with identical idempotency_key safely re-returns existing invoice.
    """
    env = credit_test_env
    cust_id = env["cust_id"]
    idemp_key = f"idemp-{uuid.uuid4().hex}"
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv_payload = SalesInvoiceCreate(
            customer_id=cust_id,
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=env["prod_id"],
                    code=env["prod_code"],
                    name="Widget",
                    quantity=Decimal("1.00"),
                    price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    total_amount=Decimal("118.00")
                )
            ]
        )
        inv_first = await sales_svc.create_sales_invoice(inv_payload, idempotency_key=idemp_key)
        inv_retry = await sales_svc.create_sales_invoice(inv_payload, idempotency_key=idemp_key)

        assert inv_first.id == inv_retry.id
        assert inv_first.invoice_no == inv_retry.invoice_no


@pytest.mark.asyncio
async def test_duplicate_invoice_number_raises_409(credit_test_env):
    """
    Scenario 10:
    Submitting an existing invoice_no with a DIFFERENT idempotency key raises HTTP 409 Conflict.
    """
    env = credit_test_env
    cust_id = env["cust_id"]
    custom_inv_no = f"INV-SPEC-{env['suffix']}"
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        # First creation succeeds
        await sales_svc.create_sales_invoice(
            SalesInvoiceCreate(
                invoice_no=custom_inv_no,
                customer_id=cust_id,
                status="Draft",
                items=[
                    SalesInvoiceItemCreate(
                        product_id=env["prod_id"],
                        code=env["prod_code"],
                        name="Widget",
                        quantity=Decimal("1.00"),
                        price=Decimal("100.00"),
                        gst_rate=Decimal("18.00"),
                        is_tax_inclusive=False,
                        total_amount=Decimal("118.00")
                    )
                ]
            ),
            idempotency_key=f"idemp-1-{uuid.uuid4().hex}"
        )

        # Second creation with same invoice_no but different idempotency key must raise 409
        with pytest.raises(HTTPException) as exc_info:
            await sales_svc.create_sales_invoice(
                SalesInvoiceCreate(
                    invoice_no=custom_inv_no,
                    customer_id=cust_id,
                    status="Draft",
                    items=[]
                ),
                idempotency_key=f"idemp-2-{uuid.uuid4().hex}"
            )
        assert exc_info.value.status_code == 409
        assert "duplicate" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_canonical_document_series_allocation(credit_test_env):
    """
    Scenario 11:
    Omitting invoice_no triggers canonical document series allocation from DocumentsEngine.
    """
    env = credit_test_env
    cust_id = env["cust_id"]
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        sales_svc = SalesService(session, _get_tenant_context())
        inv = await sales_svc.create_sales_invoice(
            SalesInvoiceCreate(
                customer_id=cust_id,
                status="Draft",
                items=[
                    SalesInvoiceItemCreate(
                        product_id=env["prod_id"],
                        code=env["prod_code"],
                        name="Widget",
                        quantity=Decimal("1.00"),
                        price=Decimal("100.00"),
                        gst_rate=Decimal("18.00"),
                        is_tax_inclusive=False,
                        total_amount=Decimal("118.00")
                    )
                ]
            )
        )
        assert inv.invoice_no is not None
        assert inv.invoice_no != "D1DS13-1"
        assert len(inv.invoice_no) >= 4
