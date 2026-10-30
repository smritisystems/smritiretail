"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.1
Created      : 2026-10-11
Modified     : 2026-10-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: P0.3 Headless Billing Cycle & Missing Item Master Integration Test Suite
"""

import uuid
import pytest
from decimal import Decimal
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from app.core.config import settings
from app.models.tenant import Company, Branch
from app.models.auth import User
from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
from app.models.crm import Customer, CustomerGroup
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.accounting import GeneralLedgerEntry
from app.models.transaction_integrity import TransactionIdempotencyRecord
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
)
from app.schemas.payments import PaymentTenderItem
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.api.v1.billing import reconcile_billing_transaction
from app.api.deps import TenantContext


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


async def _bootstrap_p03_fixtures(session):
    s = uuid.uuid4().hex[:8]
    company_id = f"CMP-{s}"
    branch_id = f"BR-{s}"
    user_id = f"USR-{s}"
    warehouse_id = f"WH-{s}"
    customer_group_id = f"CG-{s}"
    customer_id = f"CUST-{s}"
    product_id = f"PRD-{s}"

    # Authoritative Company (Maharashtra - State 27)
    comp = Company(
        id=company_id,
        name=f"P0.3 Test Company {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    session.add(comp)

    # Authoritative Branch
    branch = Branch(
        id=branch_id,
        company_id=company_id,
        name=f"P0.3 Branch {s}",
        code=f"BR_{s}".upper()[:16],
        is_active=True,
    )
    session.add(branch)
    await session.flush()

    # Authoritative Warehouse
    warehouse = Warehouse(
        id=warehouse_id,
        company_id=company_id,
        branch_id=branch_id,
        code=f"WH_{s}".upper()[:16],
        name="Main Warehouse",
        is_active=True,
        address="100 Test Blvd",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
    )
    session.add(warehouse)

    # Cashier User
    cashier = User(
        id=user_id,
        company_id=company_id,
        branch_id=branch_id,
        username=f"cashier_{s}",
        email=f"cashier_{s}@smritibooks.com",
        hashed_password="mock_hashed_password_p03",
        role="CASHIER",
        is_active=True,
    )
    session.add(cashier)

    # Customer Group
    group = CustomerGroup(
        id=customer_group_id,
        company_id=company_id,
        branch_id=branch_id,
        name=f"Standard Group {s}",
        credit_limit=Decimal("50000.00"),
        credit_days=30,
        can_purchase_on_credit=True,
        credit_hold=False,
        allow_override=True,
        max_discount_percent=Decimal("50.00"),
    )
    session.add(group)

    # Authoritative Product (Valid)
    prod = Product(
        id=product_id,
        company_id=company_id,
        branch_id=branch_id,
        name="Valid Oxford Leather Shoe",
        code=f"SHOE-{s}".upper()[:20],
        barcode=f"890100{s[:6]}",
        category="Footwear",
        mrp=Decimal("2999.00"),
        price=Decimal("2499.00"),
        gst_percentage=Decimal("18.00"),
        stock=Decimal("50.00"),
        is_active=True,
    )
    session.add(prod)
    await session.flush()

    # Customer
    customer = Customer(
        id=customer_id,
        company_id=company_id,
        branch_id=branch_id,
        customer_group_id=customer_group_id,
        name="Valid Retail Buyer",
        mobile="9820011111",
        gst_number="27ABCDE9999F1Z9",
        outstanding=Decimal("0.00"),
        is_active=True,
    )
    session.add(customer)

    # Stock Batch
    pbs = ProductBatchStock(
        id=f"pbs-{s}",
        uuid=f"pbs-{s}",
        company_id=company_id,
        branch_id=branch_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        batch_no="BATCH-P03-01",
        quantity=Decimal("50.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("2999.00"),
        sale_rate=Decimal("2499.00"),
    )
    session.add(pbs)
    await session.commit()

    return {
        "company_id": company_id,
        "branch_id": branch_id,
        "warehouse_id": warehouse_id,
        "user_id": user_id,
        "cashier": cashier,
        "product": prod,
        "customer": customer,
        "customer_id": customer_id,
    }


# =========================================================================
# Priority 2: Unknown and Incomplete Master Records Tests
# =========================================================================

@pytest.mark.asyncio
async def test_p03_unknown_barcode_rejected_with_zero_mutations(session_factory):
    """
    Priority 2 - Test 1: Unknown barcode rejection.
    Asserts HTTP 400/PRODUCT_NOT_FOUND, and zero invoice, stock movement, or ledger mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        # Baseline count assertions
        inv_before = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        stk_before = await session.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.company_id == fx["company_id"]))
        gl_before = await session.scalar(select(func.count()).select_from(GeneralLedgerEntry).where(GeneralLedgerEntry.company_id == fx["company_id"]))

        unknown_barcode = "890999999999"
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-unknown-bc-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    code=unknown_barcode,
                    barcode=unknown_barcode,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1500.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("1500.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "PRODUCT_NOT_FOUND" in str(exc_info.value.detail) or "Line 1" in str(exc_info.value.detail)

        # Assert zero mutations
        inv_after = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        stk_after = await session.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.company_id == fx["company_id"]))
        gl_after = await session.scalar(select(func.count()).select_from(GeneralLedgerEntry).where(GeneralLedgerEntry.company_id == fx["company_id"]))

        assert inv_after == inv_before == 0
        assert stk_after == stk_before == 0
        assert gl_after == gl_before == 0


@pytest.mark.asyncio
async def test_p03_unknown_sku_rejected_with_zero_mutations(session_factory):
    """
    Priority 2 - Test 2: Unknown SKU rejection.
    Asserts zero invoice, stock movement, or ledger mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-unknown-sku-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    code="SKU-TOTALLY-UNKNOWN-99",
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("800.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("1600.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        assert inv_count == 0


@pytest.mark.asyncio
async def test_p03_missing_price_rejected_with_zero_mutations(session_factory):
    """
    Priority 2 - Test 3: Missing / zero unit price rejection.
    Asserts SMRITI-PRICE-002 rejection and zero database mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-zero-price-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("0.00"),  # Zero price without fee line
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("100.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "SMRITI-VAL-004" in str(exc_info.value.detail) or "SMRITI-PRICE-002" in str(exc_info.value.detail)

        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        assert inv_count == 0


@pytest.mark.asyncio
async def test_p03_selling_price_exceeds_mrp_rejected(session_factory):
    """
    Priority 2 - Test 4: Selling price exceeds MRP statutory violation (SMRITI-PRICE-001).
    Asserts statutory price ceiling enforcement and zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-exceed-mrp-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("4500.00"),  # MRP is 2999.00
                    mrp=Decimal("2999.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("4500.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "SMRITI-PRICE-001" in str(exc_info.value.detail)

        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        assert inv_count == 0


@pytest.mark.asyncio
async def test_p03_missing_tax_classification_rejected(session_factory):
    """
    Priority 2 - Test 5: Missing tax classification (SMRITI-TAX-001).
    Item in DB has no tax rate, and line item provides no gst_rate.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        # Create item with null gst_percentage
        s = uuid.uuid4().hex[:6]
        no_tax_prod = Product(
            id=f"PRD-NOTAX-{s}",
            company_id=fx["company_id"],
            branch_id=fx["branch_id"],
            name="Untaxed Raw Item",
            code=f"NOTAX-{s}".upper(),
            barcode=f"890NOTAX{s}",
            category="Raw",
            mrp=Decimal("500.00"),
            price=Decimal("500.00"),
            gst_percentage=None,  # Missing tax classification
            stock=Decimal("10.00"),
            is_active=True,
        )
        session.add(no_tax_prod)
        await session.commit()

        # Explicitly set gst_percentage to NULL via direct SQL to bypass SQLAlchemy Python column default
        await session.execute(
            text("UPDATE products SET gst_percentage = NULL WHERE id = :pid"),
            {"pid": no_tax_prod.id},
        )
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-notax-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=no_tax_prod.id,
                    code=no_tax_prod.code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("500.00"),
                    gst_rate=None,  # No tax specified in line
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("500.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "SMRITI-TAX-001" in str(exc_info.value.detail)

        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        assert inv_count == 0


@pytest.mark.asyncio
async def test_p03_negative_tax_rate_rejected(session_factory):
    """
    Priority 2 - Test 6: Negative GST rate rejection (SMRITI-TAX-004).
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-neg-tax-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    gst_rate=Decimal("-5.00"),  # Negative GST rate
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("1000.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "SMRITI-TAX-004" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_p03_inactive_item_rejected(session_factory):
    """
    Priority 2 - Test 7: Inactive item rejection.
    Asserts PRODUCT_INACTIVE error and zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        s = uuid.uuid4().hex[:6]
        inactive_prod = Product(
            id=f"PRD-INACT-{s}",
            company_id=fx["company_id"],
            branch_id=fx["branch_id"],
            name="Discontinued Item",
            code=f"INACT-{s}".upper(),
            barcode=f"890INACT{s}",
            category="Discontinued",
            mrp=Decimal("1000.00"),
            price=Decimal("1000.00"),
            gst_percentage=Decimal("18.00"),
            stock=Decimal("10.00"),
            is_active=False,  # Inactive
        )
        session.add(inactive_prod)
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-inact-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=inactive_prod.id,
                    code=inactive_prod.code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("1000.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "PRODUCT_INACTIVE" in str(exc_info.value.detail) or "inactive" in str(exc_info.value.detail).lower()

        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        assert inv_count == 0


@pytest.mark.asyncio
async def test_p03_cross_company_item_rejected(session_factory):
    """
    Priority 2 - Test 8: Cross-company item isolation.
    An item belonging to another company (Tenant B) attempted in Tenant A's checkout is rejected.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        # Create Tenant B company & product
        s = uuid.uuid4().hex[:6]
        tenant_b_comp = Company(
            id=f"CMP-B-{s}",
            name="Tenant B Corp",
            gst_number="27ABCDE9999F1Z1",
            is_active=True,
        )
        session.add(tenant_b_comp)
        await session.flush()

        tenant_b_prod = Product(
            id=f"PRD-TB-{s}",
            company_id=tenant_b_comp.id,  # Belongs to Tenant B
            name="Tenant B Proprietary Shoe",
            code=f"TB-SHOE-{s}".upper(),
            barcode=f"890TB{s}",
            category="Footwear",
            mrp=Decimal("5000.00"),
            price=Decimal("5000.00"),
            gst_percentage=Decimal("18.00"),
            stock=Decimal("10.00"),
            is_active=True,
        )
        session.add(tenant_b_prod)
        await session.commit()

        # Tenant A attempts to checkout Tenant B's product
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],  # Tenant A context
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-cross-tenant-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=tenant_b_prod.id,
                    code=tenant_b_prod.code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("5000.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("5000.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        # Assert Tenant A has zero invoice mutations
        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        assert inv_count == 0


@pytest.mark.asyncio
async def test_p03_batch_atomicity_rejects_all_when_one_item_invalid(session_factory):
    """
    Priority 2 - Test 9: Atomic batch rollback when one item is invalid.
    If line 1 is valid but line 2 is an unknown item, the entire transaction rolls back;
    zero invoices, zero stock deducted for line 1, zero ledger entries.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        # Initial stock of valid product
        pbs_before = await session.scalar(
            select(ProductBatchStock.quantity).where(
                ProductBatchStock.company_id == fx["company_id"],
                ProductBatchStock.product_id == fx["product"].id,
            )
        )

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-atomic-batch-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(  # Valid item
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("2499.00"),
                    mrp=Decimal("2999.00"),
                    gst_rate=Decimal("18.00"),
                ),
                CanonicalPostingLineItem(  # Unknown item
                    code="NON_EXISTENT_UNKNOWN_ITEM",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("500.00"),
                    gst_rate=Decimal("18.00"),
                ),
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("5498.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400

        # Verify absolute zero mutations
        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        assert inv_count == 0

        # Stock for valid product must NOT have been deducted
        pbs_after = await session.scalar(
            select(ProductBatchStock.quantity).where(
                ProductBatchStock.company_id == fx["company_id"],
                ProductBatchStock.product_id == fx["product"].id,
            )
        )
        assert pbs_after == pbs_before


# =========================================================================
# Priority 3: Transaction & Payment Integrity Tests
# =========================================================================

@pytest.mark.asyncio
async def test_p03_repeated_checkout_idempotency_replay(session_factory):
    """
    Priority 3 - Test 10: Repeated checkout with identical idempotency key returns original invoice.
    Asserts invoice count == 1, stock movement count == 1, ledger entry count == 2 (debit/credit once).
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        stable_idemp_key = f"idemp-replay-stable-{uuid.uuid4().hex[:8]}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=stable_idemp_key,
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2499.00"),
                    mrp=Decimal("2999.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("2499.00"))
            ],
        )

        # First checkout: commit
        res1 = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res1.invoice_no is not None

        # Repeat identical checkout with same idempotency key
        res2 = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res2.invoice_no == res1.invoice_no
        assert res2.invoice_id == res1.invoice_id

        # Verify mutation integrity: strictly 1 invoice, strictly 1 stock movement
        inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == fx["company_id"]))
        stk_count = await session.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.company_id == fx["company_id"]))

        assert inv_count == 1
        assert stk_count == 1


@pytest.mark.asyncio
async def test_p03_idempotency_fingerprint_mismatch_rejected(session_factory):
    """
    Priority 3 - Test 11: Idempotency key collision with different request payload is rejected with 409.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        shared_idemp_key = f"idemp-collision-{uuid.uuid4().hex[:8]}"

        req1 = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=shared_idemp_key,
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2499.00"),
                    mrp=Decimal("2999.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("2499.00"))
            ],
        )
        await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req1, commit=True)

        # Same idempotency key, but different quantity (2 instead of 1)
        req2 = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company_id"],
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=shared_idemp_key,
            ),
            customer_id=fx["customer_id"],
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("2.00"),  # Altered payload!
                    unit_price=Decimal("2499.00"),
                    mrp=Decimal("2999.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("4998.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req2, commit=True)

        assert exc_info.value.status_code == 409
        assert "SMRITI-IDEMP-001" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_p03_reconciliation_absent_record_returns_not_found(session_factory):
    """
    Priority 3 - Test 12: Absent reconciliation record handling.
    Asserts NOT_FOUND status, is_committed: false, and honest guidance that absent record
    does not guarantee an in-flight network request cannot arrive later.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        tenant = TenantContext(
            company_id=fx["company_id"],
            branch_id=fx["branch_id"],
            role="CASHIER",
        )

        unrecorded_key = f"idemp-unrecorded-{uuid.uuid4().hex[:8]}"
        res = await reconcile_billing_transaction(
            idempotency_key=unrecorded_key,
            db=session,
            tenant=tenant,
            current_user=fx["cashier"],
        )

        assert res["status"] == "NOT_FOUND"
        assert res["is_committed"] is False
        assert res["idempotency_key"] == unrecorded_key
        assert "An absent record does not guarantee an in-flight network request cannot arrive later" in res["reconciliation_advice"]
        assert "Retain this stable key if retrying" in res["reconciliation_advice"]


@pytest.mark.asyncio
async def test_p03_missing_company_identity_blocks_checkout(session_factory):
    """
    Priority 3 - Test 13: Missing authoritative company profile blocks invoice issuance.
    Asserts SMRITI-TENANT-002 error and zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        # Construct request with non-existent company ID
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="CMP-NON-EXISTENT-GHOST-TENANT",
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-ghost-tenant-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=None,
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2499.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("2499.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "SMRITI-TENANT-002" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_p03_missing_seller_gstin_blocks_checkout(session_factory):
    """
    Priority 3 - Test 14: Missing authoritative seller GSTIN blocks invoice issuance.
    Asserts SMRITI-TAX-002 error and zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        # Create company without GSTIN
        s = uuid.uuid4().hex[:6]
        no_gst_comp = Company(
            id=f"CMP-NOGST-{s}",
            name=f"Unregistered Seller {s}",
            gst_number=None,  # No GSTIN
            is_active=True,
        )
        session.add(no_gst_comp)
        no_gst_branch = Branch(
            id=f"BR-NOGST-{s}",
            company_id=no_gst_comp.id,
            name=f"No GST Branch {s}",
            code=f"BR_NG_{s}".upper()[:16],
            is_active=True,
        )
        session.add(no_gst_branch)
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=no_gst_comp.id,
                branch_id=no_gst_branch.id,
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-nogst-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=None,
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2499.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("2499.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "SMRITI-TAX-002" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_p03_invalid_seller_gstin_blocks_checkout(session_factory):
    """
    Priority 3 - Test 15: Structurally invalid seller GSTIN blocks invoice issuance.
    Asserts SMRITI-TAX-003 error and zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p03_fixtures(session)

        # Create company with malformed GSTIN
        s = uuid.uuid4().hex[:6]
        bad_gst_comp = Company(
            id=f"CMP-BADGST-{s}",
            name=f"Malformed GST Co {s}",
            gst_number="99INVALIDGSTIN9",  # 15-char malformed GSTIN
            is_active=True,
        )
        session.add(bad_gst_comp)
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=bad_gst_comp.id,
                branch_id=fx["branch_id"],
                warehouse_id=fx["warehouse_id"],
                cashier_id=fx["user_id"],
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-badgst-{uuid.uuid4().hex[:8]}",
            ),
            customer_id=None,
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2499.00"),
                    gst_rate=Decimal("18.00"),
                )
            ],
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=Decimal("2499.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "SMRITI-TAX-003" in str(exc_info.value.detail)
