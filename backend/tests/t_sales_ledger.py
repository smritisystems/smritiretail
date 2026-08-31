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

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from decimal import Decimal
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.sales_ledger_svc import UnifiedSalesLedgerService
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.inventory import Product, StockMovement, ProductBatchStock


from app.models.crm import Customer, CustomerGroup


@pytest.fixture(autouse=True)
async def cleanup_and_setup_test_sales():
    """Clean up and set up test customer and test sales invoices."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(StockMovement).where(StockMovement.remarks.like("%TEST-INV%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("TEST-INV-%")))
            
            # Ensure test customer exists
            cust_stmt = select(Customer).where(Customer.id == "cust_sales_test_01")
            cust = (await session.execute(cust_stmt)).scalar_one_or_none()
            if not cust:
                cust = Customer(
                    id="cust_sales_test_01",
                    company_id="COMP-001",
                    code="CUST-TEST-01",
                    name="Apex Retail Traders Pvt Ltd",
                    mobile="9820011223",
                    gst_number="27AAACA1234A1Z5",
                    status="Active",
                    is_active=True,
                    is_deleted=False
                )
                session.add(cust)
            
            # Ensure test product exists
            prod_stmt = select(Product).where(Product.code == "PROD-SALES-TEST-01")
            prod = (await session.execute(prod_stmt)).scalar_one_or_none()
            if not prod:
                prod = Product(
                    id="prod_sales_test_01",
                    company_id="COMP-001",
                    code="PROD-SALES-TEST-01",
                    name="SMRITI Cotton Oxford Shirt",
                    category="Apparel",
                    barcode="8901112223334",
                    price=1000.00,
                    mrp=1200.00,
                    cost_price=500.00,
                    stock=50,
                    is_active=True,
                    is_deleted=False
                )
                session.add(prod)

            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(StockMovement).where(StockMovement.remarks.like("%TEST-INV%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("TEST-INV-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_b2b_sales_invoice_posting_and_stock_debit():
    """Verify B2B sales invoice creates immutable tax snapshots and posts outward stock movements."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        prod_stmt = select(Product).where(Product.code == "PROD-SALES-TEST-01")
        prod = (await session.execute(prod_stmt)).scalar_one()

        invoice = await UnifiedSalesLedgerService.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no="TEST-INV-B2B-01",
            customer_id="cust_sales_test_01",
            customer_name="Maharashtra Retailers Association",
            customer_gstin="27AAACA1234A1Z5",
            is_interstate=False,
            payment_mode="CREDIT",
            items_data=[
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity": 5.0,
                    "price": 1000.00,
                    "mrp": 1200.00,
                    "disc_pct": 10.0,  # 10% disc -> Rate = 900.00
                    "gst_rate": 18.0,
                    "hsn_code": "620520"
                }
            ]
        )

        assert invoice is not None
        assert invoice.invoice_no == "TEST-INV-B2B-01"
        assert invoice.status == "Confirmed"
        assert len(invoice.items) == 1

        item = invoice.items[0]
        # 5 * 1000 * 0.90 = 4500.00 taxable
        assert float(item.taxable_value) == 4500.00
        # 4500 * 9% = 405.00 CGST and SGST
        assert float(item.cgst_amount) == 405.00
        assert float(item.sgst_amount) == 405.00
        assert float(item.igst_amount) == 0.00
        assert float(item.total_amount) == 5310.00

        # Verify stock movement ledger entry
        smv_stmt = select(StockMovement).where(
            StockMovement.reference_doc_id == invoice.id,
            StockMovement.movement_type == "OUTWARD_SALE"
        )
        smv = (await session.execute(smv_stmt)).scalar_one_or_none()
        assert smv is not None
        assert float(smv.quantity) == -5.0
        assert smv.product_id == "prod_sales_test_01"


@pytest.mark.asyncio
async def test_interstate_sales_invoice_igst_calculation():
    """Verify inter-state invoice correctly calculates and snapshots IGST."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        prod_stmt = select(Product).where(Product.code == "PROD-SALES-TEST-01")
        prod = (await session.execute(prod_stmt)).scalar_one_or_none()

        invoice = await UnifiedSalesLedgerService.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no="TEST-INV-IGST-02",
            customer_id="cust_sales_test_01",
            customer_name="Gujarat Distribution Hub",
            customer_gstin="24AAACA9876B1Z2",
            is_interstate=True,
            items_data=[
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity": 2.0,
                    "price": 2000.00,
                    "disc_pct": 0.0,
                    "gst_rate": 18.0
                }
            ]
        )

        assert invoice is not None
        assert invoice.is_interstate is True
        item = invoice.items[0]
        # 2 * 2000 = 4000.00 taxable
        assert float(item.taxable_value) == 4000.00
        assert float(item.cgst_amount) == 0.00
        assert float(item.sgst_amount) == 0.00
        assert float(item.igst_amount) == 720.00
        assert float(item.total_amount) == 4720.00


@pytest.mark.asyncio
async def test_invoice_cancellation_and_stock_reversal():
    """Verify cancelling an invoice creates RETURN_INWARD movements and restores stock."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        prod_stmt = select(Product).where(Product.code == "PROD-SALES-TEST-01")
        prod = (await session.execute(prod_stmt)).scalar_one_or_none()

        # 1. Post invoice
        invoice = await UnifiedSalesLedgerService.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no="TEST-INV-CANCEL-03",
            customer_id="cust_sales_test_01",
            items_data=[
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity": 3.0,
                    "price": 500.00,
                    "gst_rate": 12.0
                }
            ]
        )
        assert invoice.status == "Confirmed"
        inv_id = invoice.id

        # 2. Cancel invoice
        cancelled = await UnifiedSalesLedgerService.cancel_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no="TEST-INV-CANCEL-03",
            reason="Customer Order Cancelled"
        )
        assert cancelled.status == "Cancelled"

        # 3. Verify RETURN_INWARD movement exists
        rev_stmt = select(StockMovement).where(
            StockMovement.reference_doc_id == inv_id,
            StockMovement.movement_type == "RETURN_INWARD"
        )
        rev_smv = (await session.execute(rev_stmt)).scalar_one_or_none()
        assert rev_smv is not None
        assert float(rev_smv.quantity) == 3.0


@pytest.mark.asyncio
async def test_sales_invoice_tenant_isolation():
    """Verify invoice posted in smriti001 is completely absent in smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        stmt1 = select(SalesInvoice).where(SalesInvoice.invoice_no == "TEST-INV-IGST-02")
        inv1 = (await s1.execute(stmt1)).scalar_one_or_none()
        # May be None if not run after test 2, so create a specific isolation invoice
        prod_stmt = select(Product).where(Product.code == "PROD-SALES-TEST-01")
        prod = (await s1.execute(prod_stmt)).scalar_one_or_none()
        inv_iso = await UnifiedSalesLedgerService.post_sales_invoice(
            session=s1,
            company_id="COMP-001",
            invoice_no="TEST-INV-ISO-04",
            customer_id="cust_sales_test_01",
            items_data=[
                {"product_id": prod.id, "code": prod.code, "name": prod.name, "quantity": 1.0, "price": 100.0, "gst_rate": 18.0}
            ]
        )
        assert inv_iso is not None

    async with session_002() as s2:
        stmt2 = select(SalesInvoice).where(SalesInvoice.invoice_no == "TEST-INV-ISO-04")
        inv2 = (await s2.execute(stmt2)).scalar_one_or_none()
        assert inv2 is None, "Invoice from smriti001 must not leak into smriti002!"
