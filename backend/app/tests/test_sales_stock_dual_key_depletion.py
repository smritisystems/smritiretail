"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.2
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Dual-Key Sales Stock Depletion Regression Test Suite
"""

import uuid
from decimal import Decimal
import pytest
from sqlalchemy import select, text

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.inventory import Product, Warehouse, ProductBatchStock, StockMovement
from app.models.item_master import Item, ItemVariant
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.canonical_transaction_writer import CanonicalTransactionWriter
from app.services.product_resolution_service import ProductResolutionService
from app.schemas.product_resolution import TransactionLineItemInput


async def _create_test_environment(db_session, suffix: str):
    cid = f"COMP-DK-{suffix}"
    bid = f"BR-DK-{suffix}"
    wid = f"WH-DK-{suffix}"

    comp = Company(
        id=cid,
        name=f"DualKey Co {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"BR-{suffix}",
        name=f"Branch {suffix}",
        company_id=cid,
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([comp, branch])
    await db_session.flush()

    wh = Warehouse(
        id=wid,
        code=f"WH-{suffix}",
        name=f"Main Warehouse {suffix}",
        company_id=cid,
        branch_id=bid,
        pincode="400001",
        state="MAHARASHTRA",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(wh)
    await db_session.flush()

    # Create canonical Item and Variant (NO row in legacy_id_mappings)
    item_id = str(uuid.uuid4())
    variant_id = f"var_{suffix}"
    sku = f"SKU-DK-{suffix}"

    canon_item = Item(
        id=item_id,
        uuid=str(uuid.uuid4()),
        company_id=cid,
        item_code=f"ITEM-{suffix}",
        item_name=f"DualKey Test Item {suffix}",
        status="ACTIVE",
        uom="NOS",
        primary_uom="NOS",
        is_active=True,
        is_deleted=False,
    )
    canon_variant = ItemVariant(
        id=variant_id,
        uuid=str(uuid.uuid4()),
        company_id=cid,
        item_id=item_id,
        variant_sku=sku,
        variant_name=f"DualKey Variant {suffix}",
        selling_price=Decimal("200.00"),
        mrp=Decimal("250.00"),
        cost_price=Decimal("100.00"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([canon_item, canon_variant])
    await db_session.flush()

    # Create Product with matching SKU and item_variant_id
    prod_id = f"prod_{suffix}"
    prod = Product(
        id=prod_id,
        uuid=str(uuid.uuid4()),
        company_id=cid,
        branch_id=bid,
        code=sku,
        sku=sku,
        barcode=f"BAR-{suffix}",
        name=f"DualKey Product {suffix}",
        category="FOOTWEAR",
        price=Decimal("200.00"),
        mrp=Decimal("250.00"),
        stock=100,
        item_id=item_id,
        item_variant_id=variant_id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.flush()

    # Create initial batch stock in warehouse
    pbs = ProductBatchStock(
        id=f"pbs_{suffix}",
        uuid=str(uuid.uuid4()),
        company_id=cid,
        branch_id=bid,
        warehouse_id=wid,
        product_id=prod_id,
        batch_no="DEFAULT",
        quantity=Decimal("100.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add(pbs)
    await db_session.commit()

    return cid, bid, wid, prod_id, variant_id, sku


@pytest.mark.asyncio
async def test_dual_key_fallback_resolution_without_mappings(db_session):
    """Verifies that resolve_dual_key_for_line successfully resolves legacy_product_id from products table when legacy_id_mappings is unpopulated."""
    s = uuid.uuid4().hex[:8]
    cid, bid, wid, prod_id, variant_id, sku = await _create_test_environment(db_session, s)

    # 1. Test resolution by variant_id
    id_by_var = await CanonicalTransactionWriter.resolve_dual_key_for_line(
        session=db_session,
        company_id=cid,
        variant_id=variant_id,
    )
    assert id_by_var.is_valid is True
    assert id_by_var.canonical_variant_id == variant_id
    assert id_by_var.legacy_product_id == prod_id
    assert id_by_var.sku == sku

    # 2. Test resolution by SKU / code
    id_by_sku = await CanonicalTransactionWriter.resolve_dual_key_for_line(
        session=db_session,
        company_id=cid,
        code_or_barcode=sku,
    )
    assert id_by_sku.is_valid is True
    assert id_by_sku.canonical_variant_id == variant_id
    assert id_by_sku.legacy_product_id == prod_id
    assert id_by_sku.sku == sku

    # 3. Test resolution in ProductResolutionService
    res = await ProductResolutionService.resolve_by_sku(
        session=db_session,
        company_id=cid,
        sku=sku,
    )
    assert res.success is True
    assert res.product_id == prod_id
    assert res.variant_id == variant_id


@pytest.mark.asyncio
async def test_sales_posting_deducts_stock_when_billed_by_variant_only(db_session):
    """Verifies that CanonicalSalesPostingWriter deducts stock and records OUTWARD_SALE in StockLedger even when only variant_id and SKU are passed."""
    s = uuid.uuid4().hex[:8]
    cid, bid, wid, prod_id, variant_id, sku = await _create_test_environment(db_session, s)

    ctx = CanonicalPostingContext(
        company_id=cid,
        branch_id=bid,
        warehouse_id=wid,
        idempotency_key=f"IDEMP-SALE-{s}",
        source_channel="B2B_WHOLESALE",
        sales_channel="B2B_WHOLESALE",
    )

    # Post invoice containing only variant_id and code (product_id=None)
    items = [
        CanonicalPostingLineItem(
            code=sku,
            quantity=Decimal("5.00"),
            unit_price=Decimal("200.00"),
            name="Test Sales Item",
            variant_id=variant_id,
            product_id=None,
            gst_rate=Decimal("0.00"),
            hsn_code="64041990",
            mrp=Decimal("250.00"),
        )
    ]

    tenders = [
        CanonicalTenderItem(
            tender_type="CASH",
            amount=Decimal("1000.00"),
        )
    ]

    req = CanonicalPostingRequest(
        context=ctx,
        items=items,
        tenders=tenders,
        customer_name="Cash Customer",
        customer_gstin=None,
        payment_mode="CASH",
    )

    result = await CanonicalSalesPostingWriter.post_sales_transaction(
        session=db_session,
        req=req,
        commit=True,
    )

    assert result.success is True
    assert result.invoice_id is not None

    # Verify that StockMovement (OUTWARD_SALE) was posted to StockLedger
    sm_res = await db_session.execute(
        select(StockMovement).where(
            StockMovement.company_id == cid,
            StockMovement.reference_doc_id == result.invoice_id,
            StockMovement.movement_type == "OUTWARD_SALE",
        )
    )
    movements = sm_res.scalars().all()
    assert len(movements) == 1
    mv = movements[0]
    assert mv.product_id == prod_id
    assert abs(mv.quantity) == Decimal("5.00")
    assert mv.sku == sku

    # Verify that ProductBatchStock quantity was depleted from 100 to 95
    pbs_res = await db_session.execute(
        select(ProductBatchStock).where(
            ProductBatchStock.company_id == cid,
            ProductBatchStock.product_id == prod_id,
            ProductBatchStock.warehouse_id == wid,
        )
    )
    pbs = pbs_res.scalars().first()
    assert pbs is not None
    assert pbs.quantity == Decimal("95.00")
