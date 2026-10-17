"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.50
Created      : 2026-10-11
Modified     : 2026-10-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: P0.4 Billing Compatibility & Statutory Compliance Test Suite
"""

import pytest
import uuid
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.inventory import Product, Warehouse, ProductBatchStock
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.auth import User
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


async def _bootstrap_p04_fixtures(session):
    """Creates isolated test fixtures in the ephemeral database."""
    s = uuid.uuid4().hex[:6]
    comp = Company(
        id=f"CMP-P04-{s}",
        name=f"P04 Test Retail Corp {s}",
        gst_number="27ABCDE1234F1Z5",  # Maharashtra Registered (State 27)
        is_active=True,
    )
    session.add(comp)
    await session.flush()

    branch = Branch(
        id=f"BR-P04-{s}",
        company_id=comp.id,
        name=f"P04 Central Store {s}",
        code=f"BR4_{s}".upper()[:16],
        is_active=True,
    )
    session.add(branch)
    await session.flush()

    wh = Warehouse(
        id=f"WH-P04-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        name=f"Main Warehouse {s}",
        code=f"WH_{s}".upper()[:16],
        address="100 Test Blvd",
        city="Mumbai",
        state="Maharashtra",
        pincode="400050",
        is_active=True,
    )
    session.add(wh)
    await session.flush()

    user = User(
        id=f"USR-P04-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        username=f"cashier_{s}",
        email=f"cashier_{s}@smrititest.internal",
        hashed_password="mock_hashed_password_p04",
        is_active=True,
    )
    session.add(user)

    # Physical footwear item
    item = Item(
        id=f"ITM-P04-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        item_code=f"SHOES-{s}",
        item_name=f"Leather Boots {s}",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        is_active=True,
    )
    session.add(item)
    await session.flush()

    variant = ItemVariant(
        id=f"VAR-P04-{s}",
        company_id=comp.id,
        item_id=item.id,
        variant_sku=f"BOOTS-BRN-{s}",
        variant_name=f"Leather Boots Brown 42 {s}",
        is_active=True,
    )
    session.add(variant)
    await session.flush()

    legacy_prod = Product(
        id=f"PRD-P04-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"BOOTS-BRN-{s}",
        barcode=f"89012345{s}",
        category="Footwear",
        name=f"Leather Boots Brown 42 {s}",
        price=Decimal("2999.00"),
        mrp=Decimal("3499.00"),
        gst_percentage=Decimal("18.00"),
        stock=Decimal("100.00"),
        is_active=True,
    )
    session.add(legacy_prod)
    await session.flush()

    barcode = ItemBarcode(
        id=f"BC-P04-{s}",
        company_id=comp.id,
        item_id=item.id,
        variant_id=variant.id,
        barcode=f"89012345{s}",
        is_primary=True,
        is_active=True,
    )
    session.add(barcode)

    # Initial stock in warehouse
    batch_stock = ProductBatchStock(
        id=f"pbs-p04-{s}",
        uuid=f"pbs-p04-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        warehouse_id=wh.id,
        product_id=legacy_prod.id,
        batch_no="DEFAULT",
        quantity=Decimal("100.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("3499.00"),
        sale_rate=Decimal("2999.00"),
    )
    session.add(batch_stock)

    # Second product for free gift / bundle testing
    gift_prod = Product(
        id=f"PRD-GIFT-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"GIFT-SOCKS-{s}",
        barcode=f"89099999{s}",
        category="Accessories",
        name=f"Cotton Socks Pair {s}",
        price=Decimal("199.00"),
        mrp=Decimal("249.00"),
        gst_percentage=Decimal("5.00"),
        stock=Decimal("50.00"),
        is_active=True,
    )
    session.add(gift_prod)
    await session.flush()

    gift_item = Item(
        id=f"ITM-GIFT-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        item_code=f"GIFT-{s}",
        item_name=f"Cotton Socks {s}",
        category="Accessories",
        primary_uom="PRS",
        uom="PRS",
        is_active=True,
    )
    session.add(gift_item)
    await session.flush()

    gift_var = ItemVariant(
        id=f"VAR-GIFT-{s}",
        company_id=comp.id,
        item_id=gift_item.id,
        variant_sku=f"GIFT-SOCKS-{s}",
        variant_name=f"Cotton Socks Pair {s}",
        is_active=True,
    )
    session.add(gift_var)
    await session.flush()
    session.add(ItemBarcode(
        id=f"BC-GIFT-{s}",
        company_id=comp.id,
        item_id=gift_item.id,
        variant_id=gift_var.id,
        barcode=f"89099999{s}",
        is_primary=True,
        is_active=True,
    ))
    session.add(ProductBatchStock(
        id=f"pbs-gift-{s}",
        uuid=f"pbs-gift-{s}",
        company_id=comp.id,
        branch_id=branch.id,
        warehouse_id=wh.id,
        product_id=gift_prod.id,
        batch_no="DEFAULT",
        quantity=Decimal("50.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("249.00"),
        sale_rate=Decimal("199.00"),
    ))

    await session.commit()

    return {
        "company": comp,
        "branch": branch,
        "warehouse": wh,
        "user": user,
        "product": legacy_prod,
        "variant": variant,
        "barcode": barcode,
        "gift_product": gift_prod,
        "gift_variant": gift_var,
        "gift_barcode": f"89099999{s}",
    }


# =========================================================================
# 1. Registered Seller Statutory Tax Invoice (Normal GST Sales)
# =========================================================================
@pytest.mark.asyncio
async def test_p04_registered_seller_intra_state_tax_invoice(session_factory):
    """
    Test 1: Registered seller normal GST sale within same state (Intra-state).
    Asserts 50/50 split between CGST and SGST, 0 IGST, and TAX_INVOICE document type.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p04_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company"].id,
                branch_id=fx["branch"].id,
                warehouse_id=fx["warehouse"].id,
                cashier_id=fx["user"].id,
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-p04-taxinv-{uuid.uuid4().hex[:8]}",
            ),
            place_of_supply="27",  # Maharashtra (same as branch)
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1180.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res.success is True
        assert res.document_id is not None
        assert res.net_amount == Decimal("1180.00")
        assert res.is_interstate is False
        assert res.cgst_amount > Decimal("0.00")
        assert res.sgst_amount > Decimal("0.00")
        assert res.igst_amount == Decimal("0.00")
        assert res.cgst_amount == res.sgst_amount

        # Verify DB invoice document type in rule_snapshots
        inv = await session.scalar(select(SalesInvoice).where(SalesInvoice.id == res.document_id))
        assert inv is not None
        assert inv.rule_snapshots.get("document_type") == "TAX_INVOICE"


# =========================================================================
# 2. Interstate Tax Invoice (IGST)
# =========================================================================
@pytest.mark.asyncio
async def test_p04_registered_seller_interstate_tax_invoice(session_factory):
    """
    Test 2: Registered seller interstate sale (Branch in 27, POS in 29 Karnataka).
    Asserts 100% IGST, 0 CGST, 0 SGST, and is_interstate=True.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p04_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company"].id,
                branch_id=fx["branch"].id,
                warehouse_id=fx["warehouse"].id,
                cashier_id=fx["user"].id,
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-p04-interstate-{uuid.uuid4().hex[:8]}",
            ),
            place_of_supply="29",  # Karnataka (different from branch state 27)
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CARD", amount=Decimal("1180.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res.success is True
        assert res.is_interstate is True
        assert res.igst_amount > Decimal("0.00")
        assert res.cgst_amount == Decimal("0.00")
        assert res.sgst_amount == Decimal("0.00")


# =========================================================================
# 3. Unregistered Seller: Retail Receipt Permitted vs Tax Invoice Blocked
# =========================================================================
@pytest.mark.asyncio
async def test_p04_unregistered_seller_retail_receipt_allowed(session_factory):
    """
    Test 3A: Unregistered seller issuing retail receipt (0% tax, no customer GSTIN).
    Asserts checkout succeeds without seller GSTIN, document_type is RETAIL_RECEIPT.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p04_fixtures(session)

        # Create unregistered seller company (no GSTIN)
        s = uuid.uuid4().hex[:6]
        unreg_comp = Company(
            id=f"CMP-UNREG-{s}",
            name=f"Small Corner Shop {s}",
            gst_number=None,
            is_active=True,
        )
        session.add(unreg_comp)
        await session.flush()

        unreg_branch = Branch(
            id=f"BR-UNREG-{s}",
            company_id=unreg_comp.id,
            name=f"Corner Shop Branch {s}",
            code=f"BR_UN_{s}".upper()[:16],
            is_active=True,
        )
        session.add(unreg_branch)
        await session.flush()

        unreg_wh = Warehouse(
            id=f"WH-UNREG-{s}",
            company_id=unreg_comp.id,
            branch_id=unreg_branch.id,
            name=f"Store Godown {s}",
            code=f"WH_UN_{s}".upper()[:16],
            address="12 Bazaar Street",
            city="Mumbai",
            state="Maharashtra",
            pincode="400001",
            is_active=True,
        )
        session.add(unreg_wh)
        await session.flush()

        # Products belonging to unregistered company
        unreg_prod = Product(
            id=f"PRD-UNREG-{s}",
            company_id=unreg_comp.id,
            branch_id=unreg_branch.id,
            code=f"SNACK-{s}",
            barcode=f"89055555{s}",
            category="Confectionery",
            name=f"Packaged Snacks {s}",
            price=Decimal("50.00"),
            mrp=Decimal("50.00"),
            gst_percentage=Decimal("0.00"),
            stock=Decimal("100.00"),
            is_active=True,
        )
        session.add(unreg_prod)
        await session.flush()

        session.add(ProductBatchStock(
            id=f"pbs-unreg-{s}",
            uuid=f"pbs-unreg-{s}",
            company_id=unreg_comp.id,
            branch_id=unreg_branch.id,
            warehouse_id=unreg_wh.id,
            product_id=unreg_prod.id,
            batch_no="DEFAULT",
            quantity=Decimal("100.00"),
            reserved_quantity=Decimal("0.00"),
            damaged_quantity=Decimal("0.00"),
            mrp=Decimal("50.00"),
            sale_rate=Decimal("50.00"),
        ))
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=unreg_comp.id,
                branch_id=unreg_branch.id,
                warehouse_id=unreg_wh.id,
                cashier_id=fx["user"].id,
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-p04-unreg-{uuid.uuid4().hex[:8]}",
            ),
            items=[
                CanonicalPostingLineItem(
                    product_id=unreg_prod.id,
                    code=unreg_prod.code,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("50.00"),
                    gst_rate=Decimal("0.00"),  # No GST charged by unregistered seller
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("100.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res.success is True
        assert res.net_amount == Decimal("100.00")
        assert res.tax_total == Decimal("0.00")

        # Verify DB invoice document_type is RETAIL_RECEIPT
        inv = await session.scalar(select(SalesInvoice).where(SalesInvoice.id == res.document_id))
        assert inv is not None
        assert inv.rule_snapshots.get("document_type") == "RETAIL_RECEIPT"


@pytest.mark.asyncio
async def test_p04_unregistered_seller_charging_gst_blocked(session_factory):
    """
    Test 3B: Unregistered seller attempting to charge GST is strictly blocked (SMRITI-TAX-002).
    """
    async with session_factory() as session:
        fx = await _bootstrap_p04_fixtures(session)

        s = uuid.uuid4().hex[:6]
        unreg_comp = Company(
            id=f"CMP-UNREG2-{s}",
            name=f"Unregistered Seller {s}",
            gst_number=None,
            is_active=True,
        )
        session.add(unreg_comp)
        await session.flush()

        unreg_branch = Branch(
            id=f"BR-UNREG2-{s}",
            company_id=unreg_comp.id,
            name=f"Branch {s}",
            code=f"BR_UN2_{s}".upper()[:16],
            is_active=True,
        )
        session.add(unreg_branch)
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=unreg_comp.id,
                branch_id=unreg_branch.id,
                warehouse_id=fx["warehouse"].id,
                cashier_id=fx["user"].id,
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-p04-unreg-gst-{uuid.uuid4().hex[:8]}",
            ),
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    gst_rate=Decimal("18.00"),  # Illegal for unregistered seller!
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1180.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert exc.value.status_code == 400
        assert "SMRITI-TAX-002" in str(exc.value.detail)


# =========================================================================
# 4. Free / Promotional Items & 100% Discounts
# =========================================================================
@pytest.mark.asyncio
async def test_p04_free_promotional_item_zero_price_allowed(session_factory):
    """
    Test 4: Free promotional item (unit_price=0.00, is_free_item=True) with paid item.
    Asserts SMRITI-PRICE-002 does NOT block free promotional item, physical stock is deducted.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p04_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company"].id,
                branch_id=fx["branch"].id,
                warehouse_id=fx["warehouse"].id,
                cashier_id=fx["user"].id,
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-p04-gift-{uuid.uuid4().hex[:8]}",
            ),
            items=[
                # Paid boots
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2000.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                ),
                # Free promotional socks
                CanonicalPostingLineItem(
                    product_id=fx["gift_product"].id,
                    code=fx["gift_product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("0.00"),
                    is_free_item=True,
                ),
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("2000.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res.success is True
        assert res.net_amount == Decimal("2000.00")
        assert len(res.lines) == 2

        # Verify free gift line is ₹0.00
        gift_line = next(l for l in res.lines if l.product_id == fx["gift_product"].id)
        assert gift_line.unit_price == Decimal("0.00")
        assert gift_line.total_amount == Decimal("0.00")

        # Verify gift inventory stock decremented by 1.00 (from 50 to 49)
        gift_stock = await session.scalar(
            select(ProductBatchStock.quantity).where(
                ProductBatchStock.company_id == fx["company"].id,
                ProductBatchStock.warehouse_id == fx["warehouse"].id,
                ProductBatchStock.product_id == fx["gift_product"].id,
            )
        )
        assert gift_stock == Decimal("49.00")


@pytest.mark.asyncio
async def test_p04_100_percent_discount_cart_checkout(session_factory):
    """
    Test 5: 100% discount on line item (disc_pct=100.00).
    Asserts net payable is ₹0.00, zero payment tender succeeds without error.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p04_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company"].id,
                branch_id=fx["branch"].id,
                warehouse_id=fx["warehouse"].id,
                cashier_id=fx["user"].id,
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-p04-100disc-{uuid.uuid4().hex[:8]}",
            ),
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    disc_pct=Decimal("100.00"),  # 100% discount
                    gst_rate=Decimal("18.00"),
                ),
            ],
            tenders=[],  # Zero payable cart: no tender required
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res.success is True
        assert res.net_amount == Decimal("0.00")
        assert res.tax_total == Decimal("0.00")

        # Verify DB invoice has grand_total=0.00, paid_amount=0.00, balance_amount=0.00
        inv = await session.scalar(select(SalesInvoice).where(SalesInvoice.id == res.document_id))
        assert inv is not None
        assert inv.grand_total == Decimal("0.00")
        assert inv.paid_amount == Decimal("0.00")
        assert inv.balance_amount == Decimal("0.00")


# =========================================================================
# 5. Split Tenders (Cash + UPI)
# =========================================================================
@pytest.mark.asyncio
async def test_p04_split_tenders_cash_and_upi(session_factory):
    """
    Test 6: Split tender transaction (₹1000.00 Cash + ₹1499.00 UPI for ₹2499.00 bill).
    Asserts payment_mode is SPLIT, paid_amount matches total, both tenders recorded.
    """
    async with session_factory() as session:
        fx = await _bootstrap_p04_fixtures(session)

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=fx["company"].id,
                branch_id=fx["branch"].id,
                warehouse_id=fx["warehouse"].id,
                cashier_id=fx["user"].id,
                source_channel="POS_RETAIL",
                idempotency_key=f"idemp-p04-split-{uuid.uuid4().hex[:8]}",
            ),
            items=[
                CanonicalPostingLineItem(
                    product_id=fx["product"].id,
                    code=fx["product"].code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("2499.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1000.00")),
                CanonicalTenderItem(tender_type="UPI", amount=Decimal("1499.00"), reference_no="UPI-REF-123456"),
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res.success is True
        assert res.net_amount == Decimal("2499.00")

        inv = await session.scalar(select(SalesInvoice).where(SalesInvoice.id == res.document_id))
        assert inv is not None
        assert inv.payment_mode == "SPLIT"
        assert inv.paid_amount == Decimal("2499.00")
        assert inv.balance_amount == Decimal("0.00")
