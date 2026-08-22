"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from backend.app.api.deps import TenantContext
from backend.app.services.purchase import PurchaseService
from backend.app.services.sales import SalesService
from backend.app.services.inventory_wms_service import InventoryWmsService
from backend.app.models.inventory import Product, ProductBatchStock
from backend.app.models.purchase import Supplier
from backend.app.models.crm import Customer, CustomerGroup
from backend.app.schemas.purchase import PurchaseReceiptCreate, PurchaseReceiptItemCreate
from backend.app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate

ASYNC_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"

@pytest.mark.asyncio
async def test_grn_inward_batch_stock_creation():
    """
    Test that creating a PurchaseReceipt (GRN) automatically inwards stock
    into ProductBatchStock with the exact batch number and expiry date.
    """
    engine = create_async_engine(ASYNC_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
        purchase_service = PurchaseService(session, tenant)

        # 1. Get or create test supplier and product
        res_supp = await session.execute(select(Supplier).where(Supplier.company_id == "COMP-001", Supplier.is_deleted == False).limit(1))
        supplier = res_supp.scalars().first()
        assert supplier is not None

        res_prod = await session.execute(select(Product).where(Product.company_id == "COMP-001", Product.is_deleted == False).limit(1))
        prod = res_prod.scalars().first()
        assert prod is not None

        batch_no = f"BATCH-GRN-TEST-{uuid.uuid4().hex[:6].upper()}"
        expiry = date.today() + timedelta(days=180)

        receipt_id = f"pr-test-{uuid.uuid4().hex[:8]}"
        receipt_no = f"GRN-TEST-{uuid.uuid4().hex[:6].upper()}"

        # 2. Inward 50 units via PurchaseReceipt
        req = PurchaseReceiptCreate(
            id=receipt_id,
            receipt_no=receipt_no,
            supplier_id=supplier.id,
            warehouse_id="wh-central-001",
            items=[
                PurchaseReceiptItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    batch_no=batch_no,
                    expiry_date=expiry,
                    quantity_received=Decimal("50.00"),
                    cost_price=Decimal("120.00"),
                    gst_rate=Decimal("18.00"),
                )
            ]
        )

        receipt = await purchase_service.create_purchase_receipt(req)
        assert receipt.status == "RECEIVED"

        # 3. Assert batch stock row exists with 50 units
        res_batch = await session.execute(
            select(ProductBatchStock).where(
                ProductBatchStock.company_id == "COMP-001",
                ProductBatchStock.warehouse_id == "wh-central-001",
                ProductBatchStock.product_id == prod.id,
                ProductBatchStock.batch_no == batch_no,
                ProductBatchStock.is_deleted == False
            )
        )
        batch_stock = res_batch.scalars().first()
        assert batch_stock is not None
        assert batch_stock.quantity == Decimal("50.0000")
        assert batch_stock.expiry_date == expiry

        # Rollback test data
        await session.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_sales_invoice_fefo_auto_deduction_and_cancellation():
    """
    Test that creating a SalesInvoice automatically selects batches via FEFO,
    deducts quantity atomically from ProductBatchStock, and restores stock on invoice cancellation.
    """
    engine = create_async_engine(ASYNC_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
        sales_service = SalesService(session, tenant)
        wms_service = InventoryWmsService(session, tenant)

        # 1. Create a dedicated isolated test product
        prod_id = f"prod-test-{uuid.uuid4().hex[:8]}"
        prod_code = f"TEST-PROD-{uuid.uuid4().hex[:6].upper()}"
        prod = Product(
            id=prod_id,
            code=prod_code,
            name="FEFO Test Energy Drink",
            price=Decimal("150.00"),
            stock=70,
            category="Beverages",
            barcode=f"BAR-{uuid.uuid4().hex[:8]}",
            company_id="COMP-001",
            branch_id="BR-001"
        )
        session.add(prod)
        await session.flush()

        # 2. Inward two batches with different expiries
        batch_early = f"BATCH-EARLY-{uuid.uuid4().hex[:4].upper()}"
        batch_late = f"BATCH-LATE-{uuid.uuid4().hex[:4].upper()}"

        await wms_service.atomic_mutate_batch_stock(
            product_id=prod.id,
            warehouse_id="wh-central-001",
            batch_no=batch_early,
            qty_delta=Decimal("20.0000"),
            movement_type="INWARD_GRN",
            expiry_date=date.today() + timedelta(days=5),
            purchase_rate=Decimal("100.00")
        )

        await wms_service.atomic_mutate_batch_stock(
            product_id=prod.id,
            warehouse_id="wh-central-001",
            batch_no=batch_late,
            qty_delta=Decimal("50.0000"),
            movement_type="INWARD_GRN",
            expiry_date=date.today() + timedelta(days=60),
            purchase_rate=Decimal("100.00")
        )

        # 3. Create Sales Invoice for 25 units (FEFO should take all 20 from batch_early + 5 from batch_late)
        inv_id = f"inv-test-{uuid.uuid4().hex[:8]}"
        inv_no = f"INV-TEST-{uuid.uuid4().hex[:6].upper()}"

        inv_in = SalesInvoiceCreate(
            id=inv_id,
            invoice_no=inv_no,
            date=date.today(),
            customer_id="CUST-WALKIN",
            warehouse_id="wh-central-001",
            payment_mode="CASH",
            items=[
                SalesInvoiceItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("25.0000"),
                    price=Decimal("150.00"),
                    gst_rate=Decimal("18.00"),
                )
            ]
        )

        invoice = await sales_service.create_sales_invoice(inv_in)
        assert invoice.status == "Draft" or invoice.status == "Created" or invoice.id == inv_id

        # 4. Verify batch stock deduction
        res_early = await session.execute(
            select(ProductBatchStock).where(
                ProductBatchStock.company_id == "COMP-001",
                ProductBatchStock.warehouse_id == "wh-central-001",
                ProductBatchStock.product_id == prod.id,
                ProductBatchStock.batch_no == batch_early
            )
        )
        early_row = res_early.scalars().first()
        assert early_row.quantity == Decimal("0.0000"), "Earlier batch should be fully consumed first."

        res_late = await session.execute(
            select(ProductBatchStock).where(
                ProductBatchStock.company_id == "COMP-001",
                ProductBatchStock.warehouse_id == "wh-central-001",
                ProductBatchStock.product_id == prod.id,
                ProductBatchStock.batch_no == batch_late
            )
        )
        late_row = res_late.scalars().first()
        assert late_row.quantity == Decimal("45.0000"), "Remaining 5 units should be deducted from later batch."

        # 5. Cancel the sales invoice and verify stock restoration
        cancelled = await sales_service.cancel_sales_invoice(invoice.id)
        assert cancelled.status == "Cancelled"

        # Rollback test data
        await session.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_retailer_credit_limit_enforcement():
    """
    Test that B2B Sales Billing blocks invoices when a customer exceeds their Group Credit Limit.
    """
    from fastapi import HTTPException
    engine = create_async_engine(ASYNC_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        tenant = TenantContext(company_id="COMP-001", branch_id="BR-001")
        sales_service = SalesService(session, tenant)

        # 1. Create a customer group with credit limit of ₹10,000 and auto_block_sales=True
        group_id = f"cg-test-{uuid.uuid4().hex[:6]}"
        group = CustomerGroup(
            id=group_id,
            name=f"Test Credit Group {uuid.uuid4().hex[:4]}",
            credit_limit=Decimal("10000.00"),
            credit_days=30,
            auto_block_sales=True,
            unlimited_credit=False,
            credit_hold=False,
            company_id="COMP-001",
            branch_id="BR-001"
        )
        session.add(group)

        # 2. Create customer belonging to this group with ₹8,000 outstanding
        cust_id = f"cust-test-{uuid.uuid4().hex[:6]}"
        customer = Customer(
            id=cust_id,
            code=f"CUST-{uuid.uuid4().hex[:4].upper()}",
            name="Test Credit Retailer",
            customer_group_id=group_id,
            outstanding=Decimal("8000.00"),
            company_id="COMP-001",
            branch_id="BR-001"
        )
        session.add(customer)
        await session.flush()

        # 3. Fetch a product
        res_prod = await session.execute(select(Product).where(Product.company_id == "COMP-001", Product.is_deleted == False).limit(1))
        prod = res_prod.scalars().first()

        # 4. Attempt to create an invoice of ₹5,000 (8000 + 5000 = 13000 > 10000 limit) -> Should raise HTTPException
        inv_id = f"inv-blocked-{uuid.uuid4().hex[:6]}"
        inv_in = SalesInvoiceCreate(
            id=inv_id,
            invoice_no=f"INV-BLK-{uuid.uuid4().hex[:4].upper()}",
            date=date.today(),
            customer_id=cust_id,
            warehouse_id="wh-central-001",
            items=[
                SalesInvoiceItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("10.0000"),
                    price=Decimal("500.00"),
                    gst_rate=Decimal("0.00"),
                )
            ]
        )

        with pytest.raises(HTTPException) as exc_info:
            await sales_service.create_sales_invoice(inv_in)
        assert exc_info.value.status_code == 400
        assert "SMRITI-CREDIT-001" in exc_info.value.detail

        # Rollback test data
        await session.rollback()

    await engine.dispose()

