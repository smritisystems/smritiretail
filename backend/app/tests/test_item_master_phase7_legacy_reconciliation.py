"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.2
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Suite: Item Master Phase 7 — Legacy Products Reconciliation & Transactional Backfill
Verifies:
1. Idempotent single-product reconciliation into Item, ItemVariant, and ItemBarcode.
2. Graceful linking to pre-existing canonical Items and Variants without duplicate collisions.
3. Automatic transactional backfill across SalesInvoiceItem, StockMovement, and PurchaseReceiptItem.
"""

import uuid
import pytest
from decimal import Decimal
from sqlalchemy import select, text

from app.models.inventory import Product, StockMovement, Warehouse
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, Supplier
from app.models.tenant import Company, Branch
from app.services.item.legacy_reconciliation_svc import LegacyProductReconciliationService


@pytest.mark.asyncio
async def test_reconcile_single_product_creates_canonical_entities(db_session):
    """
    Verifies that an unlinked Product is cleanly and idempotently transformed
    into canonical Item, ItemVariant, and ItemBarcode, and linked via item_id.
    """
    s = uuid.uuid4().hex[:6].upper()
    company_id = f"COMP-P7-{s}"
    branch_id = f"BR-P7-{s}"

    comp = Company(id=company_id, company_code=f"CP7{s}", name=f"Company {s}", is_active=True)
    br = Branch(id=branch_id, company_id=company_id, code=f"B7-{s}", name=f"Branch {s}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.flush()

    prod = Product(
        id=f"prod_test_{s}",
        code=f"PRD-CODE-{s}",
        sku=f"PRD-SKU-{s}",
        style_code=f"STYLE-{s}",
        barcode=f"890{s.upper()}001",
        name=f"Legacy Running Shoe {s}",
        brand="FootwearPro",
        category="FOOTWEAR",
        mrp=Decimal("1999.00"),
        price=Decimal("1499.00"),
        cost_price=Decimal("800.00"),
        gst_percentage=Decimal("18.00"),
        stock=10,
        reserved_stock=0,
        color="BLACK",
        size="42",
        company_id=company_id,
        branch_id=branch_id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()

    # 1. Execute reconciliation
    res = await LegacyProductReconciliationService.reconcile_single_product(
        session=db_session,
        product=prod,
        auto_commit=True,
    )

    assert res["product_id"] == prod.id
    assert res["item_id"] is not None
    assert res["item_variant_id"] is not None
    assert prod.item_id == res["item_id"]
    assert prod.item_variant_id == res["item_variant_id"]

    # 2. Verify Item in database
    item = (await db_session.execute(select(Item).where(Item.id == res["item_id"]))).scalars().first()
    assert item is not None
    assert item.company_id == company_id
    assert item.primary_uom == "PRS"  # Footwear category maps to PRS
    assert item.uom == "PRS"
    assert item.tracking_type == "NONE"
    assert item.status == "ACTIVE"

    # 3. Verify ItemVariant in database
    var = (await db_session.execute(select(ItemVariant).where(ItemVariant.id == res["item_variant_id"]))).scalars().first()
    assert var is not None
    assert var.company_id == company_id
    assert var.item_id == item.id
    assert var.variant_sku == prod.sku
    assert var.mrp == prod.mrp
    assert var.selling_price == prod.price
    assert var.color == "BLACK"
    assert var.size == "42"

    # 4. Verify ItemBarcode in database
    bc = (await db_session.execute(select(ItemBarcode).where(ItemBarcode.variant_id == var.id))).scalars().first()
    assert bc is not None
    assert bc.barcode == prod.barcode
    assert bc.company_id == company_id
    assert bc.is_primary is True

    # 5. Idempotency check: Re-reconciling same product returns identical IDs
    res2 = await LegacyProductReconciliationService.reconcile_single_product(
        session=db_session,
        product=prod,
        auto_commit=True,
    )
    assert res2["item_id"] == res["item_id"]
    assert res2["item_variant_id"] == res["item_variant_id"]


@pytest.mark.asyncio
async def test_reconcile_product_links_to_existing_item_and_variant(db_session):
    """
    Verifies that if an Item and ItemVariant already exist with matching codes,
    reconciliation binds the Product to them without raising unique constraint errors.
    """
    s = uuid.uuid4().hex[:6].upper()
    company_id = f"COMP-EX-{s}"
    branch_id = f"BR-EX-{s}"

    comp = Company(id=company_id, company_code=f"CEX{s}", name=f"Company {s}", is_active=True)
    br = Branch(id=branch_id, company_id=company_id, code=f"BEX-{s}", name=f"Branch {s}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.flush()

    existing_item = Item(
        id=f"itm_pre_{s}",
        company_id=company_id,
        branch_id=branch_id,
        item_code=f"SHARED-STYLE-{s}",
        style_code=f"SHARED-STYLE-{s}",
        item_name=f"Existing Style {s}",
        item_type="FINISHED_GOOD",
        category="Apparel",
        primary_uom="PCS",
        uom="PCS",
        tracking_type="NONE",
        status="ACTIVE",
    )
    existing_var = ItemVariant(
        id=f"var_pre_{s}",
        company_id=company_id,
        branch_id=branch_id,
        item_id=existing_item.id,
        variant_sku=f"SHARED-SKU-{s}",
        variant_name=f"Existing Variant {s}",
        mrp=Decimal("500.00"),
        selling_price=Decimal("450.00"),
        is_active=True,
    )
    db_session.add_all([existing_item, existing_var])
    await db_session.commit()

    prod = Product(
        id=f"prod_link_{s}",
        code=f"SHARED-SKU-{s}",
        sku=f"SHARED-SKU-{s}",
        style_code=f"SHARED-STYLE-{s}",
        barcode=f"BAR-LNK-{s}",
        category="Apparel",
        name=f"Legacy Product {s}",
        company_id=company_id,
        branch_id=branch_id,
        mrp=Decimal("500.00"),
        price=Decimal("450.00"),
        stock=5,
        reserved_stock=0,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()

    res = await LegacyProductReconciliationService.reconcile_single_product(
        session=db_session,
        product=prod,
        auto_commit=True,
    )

    assert res["item_id"] == existing_item.id
    assert res["item_variant_id"] == existing_var.id
    assert prod.item_id == existing_item.id
    assert prod.item_variant_id == existing_var.id


@pytest.mark.asyncio
async def test_backfill_transaction_lines(db_session):
    """
    Verifies that backfill_transaction_lines stamps item_id and item_variant_id
    onto historical SalesInvoiceItem, StockMovement, and PurchaseReceiptItem lines.
    """
    s = uuid.uuid4().hex[:6].upper()
    company_id = f"COMP-TX-{s}"
    branch_id = f"BR-TX-{s}"

    comp = Company(id=company_id, company_code=f"CTX{s}", name=f"Company {s}", is_active=True)
    br = Branch(id=branch_id, company_id=company_id, code=f"BTX-{s}", name=f"Branch {s}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.flush()

    prod = Product(
        id=f"prod_tx_{s}",
        code=f"TX-CODE-{s}",
        sku=f"TX-SKU-{s}",
        barcode=f"BAR-TX-{s}",
        category="General",
        name=f"Transaction Test Prod {s}",
        company_id=company_id,
        branch_id=branch_id,
        mrp=Decimal("100.00"),
        price=Decimal("100.00"),
        stock=20,
        reserved_stock=0,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.flush()

    # 1. Sales Invoice and Item with NULL item_id
    inv = SalesInvoice(
        id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        customer_name="Walk-in",
        grand_total=Decimal("100.00"),
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(inv)
    await db_session.flush()

    sii = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        item_id=None,
        variant_id=None,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("1.00"),
        price=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        company_id=company_id,
    )

    # 2. Stock Movement with NULL item_id
    sm = StockMovement(
        id=f"sm-{s}",
        product_id=prod.id,
        item_id=None,
        variant_id=None,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="INWARD_INITIAL",
        quantity=Decimal("20.00"),
        company_id=company_id,
        branch_id=branch_id,
    )

    # 3. Purchase Receipt Item with NULL item_id
    sup = Supplier(id=f"sup-{s}", name="Supplier A", code=f"SUP-{s}", company_id=company_id, branch_id=branch_id)
    db_session.add(sup)
    await db_session.flush()

    wh = Warehouse(
        id=f"wh-{s}",
        company_id=company_id,
        branch_id=branch_id,
        code=f"WH-{s}",
        name=f"Warehouse {s}",
        is_active=True,
    )
    db_session.add(wh)
    await db_session.flush()

    rcpt = PurchaseReceipt(
        id=f"rcpt-{s}",
        receipt_no=f"RCPT-{s}",
        supplier_id=sup.id,
        warehouse_id=wh.id,
        company_id=company_id,
        branch_id=branch_id,
    )
    db_session.add(rcpt)
    await db_session.flush()

    pri = PurchaseReceiptItem(
        id=f"pri-{s}",
        receipt_id=rcpt.id,
        product_id=prod.id,
        item_id=None,
        variant_id=None,
        code=prod.code,
        name=prod.name,
        quantity_received=Decimal("20.00"),
        cost_price=Decimal("50.00"),
        line_total=Decimal("1000.00"),
        company_id=company_id,
    )
    db_session.add_all([sii, sm, pri])
    await db_session.commit()

    # Reconcile product first
    await LegacyProductReconciliationService.reconcile_single_product(
        session=db_session,
        product=prod,
        auto_commit=True,
    )

    # Run transactional backfill
    stats = await LegacyProductReconciliationService.backfill_transaction_lines(
        session=db_session,
        auto_commit=True,
    )

    assert stats["sales_invoice_items"] >= 1
    assert stats["stock_movements"] >= 1
    assert stats["purchase_receipt_items"] >= 1

    # Directly verify database rows via SQL to bypass ORM identity map caching
    row_sii = (await db_session.execute(text(
        f"SELECT item_id, variant_id FROM sales_invoice_items WHERE invoice_id = '{inv.id}';"
    ))).first()
    assert row_sii is not None
    assert row_sii[0] == prod.item_id
    assert row_sii[1] == prod.item_variant_id

    row_sm = (await db_session.execute(text(
        f"SELECT item_id, variant_id FROM stock_movements WHERE id = '{sm.id}';"
    ))).first()
    assert row_sm is not None
    assert row_sm[0] == prod.item_id
    assert row_sm[1] == prod.item_variant_id

    row_pri = (await db_session.execute(text(
        f"SELECT item_id, variant_id FROM purchase_receipt_items WHERE id = '{pri.id}';"
    ))).first()
    assert row_pri is not None
    assert row_pri[0] == prod.item_id
    assert row_pri[1] == prod.item_variant_id
