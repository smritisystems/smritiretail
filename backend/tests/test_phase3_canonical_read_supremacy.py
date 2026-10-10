"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.20
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — Phase 3 Canonical Transaction Supremacy (Read-Path Convergence)
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem, SalesOrder, SalesOrderItem
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem
from app.services.reports import ReportsService
from app.services.purchase import PurchaseService
from app.schemas.purchase import PurchaseReceiptCreate, PurchaseReceiptItemCreate
from app.services.stock_synchronizer import StockSynchronizer
from app.services.pdt_analytics import PdtAnalyticsService
from app.api.deps import TenantContext


TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"
COMP_ID = "COMP-001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_01_stock_valuation_reports_canonical_keys(db_session: AsyncSession):
    """
    Test 1: Stock valuation report surfaces canonical item_id and variant_id
    for canonical-linked products, and returns None for unlinked legacy products.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    # 1. Canonical product
    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITM-{suffix}", item_name=f"Shoe {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"SKU-V-{suffix}", variant_name=f"Shoe {suffix} Black 42",
        selling_price=Decimal("1999.00"), cost_price=Decimal("800.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    prod_canon = Product(
        id=f"prd_c_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=f"CODE-C-{suffix}", sku=variant.variant_sku, barcode=f"890{suffix}01",
        name=variant.variant_name, category="Footwear", price=Decimal("1999.00"), cost_price=Decimal("800.00"),
        stock=15, is_active=True
    )
    db_session.add(prod_canon)

    # 2. Legacy unlinked product
    prod_legacy = Product(
        id=f"prd_l_{suffix}", company_id=comp_id, item_id=None, item_variant_id=None,
        code=f"CODE-L-{suffix}", sku=f"SKU-L-{suffix}", barcode=f"890{suffix}02",
        name=f"Legacy Socks {suffix}", category="Accessories", price=Decimal("199.00"), cost_price=Decimal("80.00"),
        stock=50, is_active=True
    )
    db_session.add(prod_legacy)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    reports_svc = ReportsService(db=db_session, tenant=tenant)
    report = await reports_svc.stock_valuation()

    assert report.total_items >= 2
    c_line = next(l for l in report.lines if l.product_id == prod_canon.id)
    l_line = next(l for l in report.lines if l.product_id == prod_legacy.id)

    assert c_line.item_id == item.id
    assert c_line.variant_id == variant.id
    assert c_line.stock == Decimal("15")

    assert l_line.item_id is None
    assert l_line.variant_id is None
    assert l_line.stock == Decimal("50")


@pytest.mark.asyncio
async def test_02_item_wise_sales_groups_by_canonical_variant(db_session: AsyncSession):
    """
    Test 2: Item-wise sales aggregates by canonical variant_id, surfaces canonical
    variant_sku, item_name, barcode, and populates item_id/variant_id on output.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"STYLE-{suffix}", item_name=f"Canonical T-Shirt {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"TSHIRT-CANON-{suffix}", variant_name=f"Canonical T-Shirt Red L {suffix}",
        selling_price=Decimal("899.00"), cost_price=Decimal("400.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=f"LEGACY-CODE-{suffix}", sku=f"LEGACY-SKU-{suffix}", barcode=f"888{suffix}01",
        name=f"Legacy Product Name {suffix}", category="Apparel", price=Decimal("899.00"), cost_price=Decimal("400.00"),
        stock=20, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    invoice = SalesInvoice(
        id=f"inv_{suffix}", company_id=comp_id, invoice_no=f"INV-{suffix}",
        date=date.today(), status="COMPLETED", grand_total=Decimal("1798.00"),
        net_amount=Decimal("1798.00"), is_deleted=False
    )
    db_session.add(invoice)
    await db_session.flush()

    inv_item = SalesInvoiceItem(
        invoice_id=invoice.id, product_id=product.id, item_id=item.id, variant_id=variant.id,
        code=product.code, name=product.name, quantity=Decimal("2.0000"),
        price=Decimal("899.00"), total_amount=Decimal("1798.00"),
        tax_amount=Decimal("0.00"), is_deleted=False
    )
    db_session.add(inv_item)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    reports_svc = ReportsService(db=db_session, tenant=tenant)
    report = await reports_svc.item_wise_sales(from_date=date.today(), to_date=date.today())

    target_line = next((l for l in report.lines if l.variant_id == variant.id or l.product_id == product.id), None)
    assert target_line is not None
    # Canonical supremacy verified: uses variant_sku and item_name rather than legacy product fields
    assert target_line.variant_id == variant.id
    assert target_line.item_id == item.id
    assert target_line.sku_code == variant.variant_sku
    assert target_line.product_name == item.item_name
    assert target_line.barcode == product.barcode
    assert target_line.qty_sold == Decimal("2.0000")
    assert target_line.net_amount == Decimal("1798.00")


@pytest.mark.asyncio
async def test_03_bill_wise_items_surfaces_canonical_metadata(db_session: AsyncSession):
    """
    Test 3: Bill-wise items detail report outerjoins ItemVariant and Item,
    surfacing canonical SKU, barcode, name, and keys.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITM-B-{suffix}", item_name=f"Denim Jacket {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"JKT-VAR-{suffix}", variant_name=f"Denim Jacket Blue M {suffix}",
        selling_price=Decimal("2999.00"), cost_price=Decimal("1200.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=f"PROD-JKT-{suffix}", sku=f"PROD-JKT-{suffix}", barcode=f"666{suffix}01",
        name=f"Old Jacket Name {suffix}", category="Outerwear", price=Decimal("2999.00"), cost_price=Decimal("1200.00"),
        stock=10, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    invoice = SalesInvoice(
        id=f"inv_{suffix}", company_id=comp_id, invoice_no=f"INV-B-{suffix}",
        date=date.today(), status="COMPLETED", grand_total=Decimal("2999.00"),
        net_amount=Decimal("2999.00"), is_deleted=False
    )
    db_session.add(invoice)
    await db_session.flush()

    inv_item = SalesInvoiceItem(
        invoice_id=invoice.id, line_no=1, product_id=product.id, item_id=item.id, variant_id=variant.id,
        code=product.code, name=product.name, quantity=Decimal("1.0000"),
        price=Decimal("2999.00"), total_amount=Decimal("2999.00"),
        tax_amount=Decimal("0.00"), gst_rate=Decimal("18.00"), is_deleted=False
    )
    db_session.add(inv_item)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    reports_svc = ReportsService(db=db_session, tenant=tenant)
    report = await reports_svc.bill_wise_items(from_date=date.today(), to_date=date.today())

    target_line = next((l for l in report.lines if l.invoice_number == invoice.invoice_no), None)
    assert target_line is not None
    assert target_line.variant_id == variant.id
    assert target_line.item_id == item.id
    assert target_line.sku_code == variant.variant_sku
    assert target_line.product_name == item.item_name
    assert target_line.barcode == product.barcode


@pytest.mark.asyncio
async def test_04_item_wise_returns_reports_canonical_supremacy(db_session: AsyncSession):
    """
    Test 4: Item-wise returns report outerjoins canonical tables, populating
    canonical SKU, name, item_id, and variant_id.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITM-R-{suffix}", item_name=f"Running Shoe {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"RUN-VAR-{suffix}", variant_name=f"Running Shoe Size 9 {suffix}",
        selling_price=Decimal("3499.00"), cost_price=Decimal("1500.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=f"PROD-R-{suffix}", sku=f"PROD-R-{suffix}", barcode=f"555{suffix}01",
        name=f"Old Shoe Name {suffix}", category="Footwear", price=Decimal("3499.00"), cost_price=Decimal("1500.00"),
        stock=10, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    invoice = SalesInvoice(
        id=f"inv_ret_{suffix}", company_id=comp_id, invoice_no=f"INV-RET-{suffix}",
        date=date.today(), status="COMPLETED", grand_total=Decimal("3499.00"),
        net_amount=Decimal("3499.00"), is_deleted=False
    )
    db_session.add(invoice)
    await db_session.flush()

    s_return = SalesReturn(
        id=f"ret_{suffix}", company_id=comp_id, return_no=f"RET-{suffix}",
        original_invoice_id=invoice.id,
        date=date.today(), status="CONFIRMED", grand_total=Decimal("3499.00"),
        is_deleted=False
    )
    db_session.add(s_return)
    await db_session.flush()

    ret_item = SalesReturnItem(
        return_id=s_return.id, product_id=product.id, item_id=item.id, variant_id=variant.id,
        code=product.code, name=product.name, quantity=Decimal("1.0000"),
        price=Decimal("3499.00"), total_amount=Decimal("3499.00"), is_deleted=False
    )
    db_session.add(ret_item)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    reports_svc = ReportsService(db=db_session, tenant=tenant)
    report = await reports_svc.item_wise_returns(from_date=date.today(), to_date=date.today())

    target_line = next((l for l in report.lines if l.return_number == s_return.return_no), None)
    assert target_line is not None
    assert target_line.variant_id == variant.id
    assert target_line.item_id == item.id
    assert target_line.product_code == variant.variant_sku
    assert target_line.product_name == item.item_name


@pytest.mark.asyncio
async def test_05_article_color_size_matrix_extracts_variant_dimensions(db_session: AsyncSession):
    """
    Test 5: Article color size matrix extracts color and size directly from
    ItemVariant without resorting to regex string parsing.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ART-{suffix}", item_name=f"Formal Trouser {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"TRS-NAVY-38-{suffix}", variant_name=f"Formal Trouser Navy 38",
        color="NAVY", size="38", selling_price=Decimal("1499.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=f"RAW-CODE-{suffix}", sku=f"SKU-M-{suffix}", barcode=f"BAR-M-{suffix}",
        name=f"Raw Name Without Pattern", category="Trouser",
        price=Decimal("1499.00"), stock=10, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    invoice = SalesInvoice(
        id=f"inv_{suffix}", company_id=comp_id, invoice_no=f"INV-M-{suffix}",
        date=date.today(), status="COMPLETED", grand_total=Decimal("1499.00"),
        net_amount=Decimal("1499.00"), is_deleted=False
    )
    db_session.add(invoice)
    await db_session.flush()

    inv_item = SalesInvoiceItem(
        invoice_id=invoice.id, product_id=product.id, item_id=item.id, variant_id=variant.id,
        code=product.code, name=product.name, quantity=Decimal("3.0000"),
        price=Decimal("1499.00"), total_amount=Decimal("4497.00"), taxable_value=Decimal("4497.00"),
        tax_amount=Decimal("224.85"), is_deleted=False
    )
    db_session.add(inv_item)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    reports_svc = ReportsService(db=db_session, tenant=tenant)
    report = await reports_svc.article_color_size_matrix(from_date=date.today(), to_date=date.today())

    target_row = next((r for r in report.rows if r.color == "NAVY" and suffix in r.article), None)
    assert target_row is not None
    assert target_row.article == item.item_name
    assert target_row.size_38 == Decimal("3.0000")
    assert target_row.total_units == Decimal("3.0000")


@pytest.mark.asyncio
async def test_06_product_wise_ordered_qty_filters_by_canonical_variant(db_session: AsyncSession):
    """
    Test 6: Product-wise ordered quantity report matches filter by variant_id
    and populates canonical item_id and variant_id in result lines.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"O-ITM-{suffix}", item_name=f"Order Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"O-SKU-{suffix}", variant_name=f"Order Variant {suffix}",
        selling_price=Decimal("1000.00"), cost_price=Decimal("500.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=f"CODE-{suffix}", sku=f"SKU-O-{suffix}", barcode=f"BAR-O-{suffix}",
        name=f"Ordered Item {suffix}", category="Apparel", price=Decimal("1000.00"), stock=10, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    so = SalesOrder(
        id=f"so_{suffix}", company_id=comp_id, order_no=f"SO-{suffix}",
        customer_name="Retail Buyer", grand_total=Decimal("5000.00"),
        total_qty=Decimal("5.0000"), is_deleted=False
    )
    db_session.add(so)
    await db_session.flush()

    so_item = SalesOrderItem(
        order_id=so.id, product_id=product.id, item_id=item.id, variant_id=variant.id,
        code=product.code, name=product.name, quantity=Decimal("5.0000"),
        price=Decimal("1000.00"), total_amount=Decimal("5000.00")
    )
    db_session.add(so_item)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    reports_svc = ReportsService(db=db_session, tenant=tenant)
    # Query using variant_id as product_id filter
    report = await reports_svc.product_wise_ordered_qty(product_id=variant.id)

    target_line = next((l for l in report.lines if l.variant_id == variant.id), None)
    assert target_line is not None
    assert target_line.variant_id == variant.id
    assert target_line.item_id == item.id
    assert target_line.ordered_qty == Decimal("5.0000")


@pytest.mark.asyncio
async def test_07_purchase_receipt_matches_po_line_by_canonical_variant(db_session: AsyncSession):
    """
    Test 7: PurchaseService.create_purchase_receipt correctly matches target PO
    line and enforces over-receipt limits using canonical variant_id.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID
    supplier_id = f"SUP-{suffix}"

    # Setup supplier, canonical item, variant, product
    supplier = Supplier(id=supplier_id, company_id=comp_id, code=f"SUP-{suffix}", name=f"Supplier {suffix}", is_active=True)
    db_session.add(supplier)

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"PO-ITM-{suffix}", item_name=f"PO Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"PO-SKU-{suffix}", variant_name=f"PO Item Variant {suffix}",
        selling_price=Decimal("1500.00"), cost_price=Decimal("700.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, sku=variant.variant_sku, barcode=f"444{suffix}01",
        name=variant.variant_name, category="Hardware", price=Decimal("1500.00"), cost_price=Decimal("700.00"),
        stock=0, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    po = PurchaseOrder(
        id=f"po_{suffix}", company_id=comp_id, order_no=f"PO-NUM-{suffix}",
        supplier_id=supplier_id, status="APPROVED", subtotal=Decimal("7000.00"),
        grand_total=Decimal("8260.00"), is_deleted=False
    )
    db_session.add(po)
    await db_session.flush()

    po_line = PurchaseOrderItem(
        id=f"poi_{suffix}",
        order_id=po.id, product_id=product.id, item_id=item.id, variant_id=variant.id,
        code=product.code, name=product.name, quantity=Decimal("10.00"),
        cost_price=Decimal("700.00"), gst_rate=Decimal("18.00"), line_total=Decimal("8260.00")
    )
    db_session.add(po_line)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    purchase_svc = PurchaseService(db=db_session, tenant=tenant)

    grn_req = PurchaseReceiptCreate(
        receipt_no=f"GRN-TEST-{suffix}",
        supplier_id=supplier_id,
        order_id=po.id,
        items=[
            PurchaseReceiptItemCreate(
                product_id=product.id,
                variant_id=variant.id,
                quantity_received=Decimal("6.00"),
                cost_price=Decimal("700.00"),
                gst_rate=Decimal("18.00"),
            )
        ]
    )
    receipt = await purchase_svc.create_purchase_receipt(grn_req)
    assert receipt.receipt_no == f"GRN-TEST-{suffix}"
    rcpt_items_res = await db_session.execute(
        select(PurchaseReceiptItem).where(PurchaseReceiptItem.receipt_id == receipt.id)
    )
    receipt_items = rcpt_items_res.scalars().all()
    assert len(receipt_items) == 1
    assert receipt_items[0].variant_id == variant.id
    assert receipt_items[0].item_id == item.id


@pytest.mark.asyncio
async def test_08_purchase_default_rate_prioritizes_canonical_variant(db_session: AsyncSession):
    """
    Test 8: get_supplier_default_rate retrieves rate from last GRN matching
    canonical variant_id.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID
    supplier_id = f"SUP-RATE-{suffix}"

    supplier = Supplier(id=supplier_id, company_id=comp_id, code=f"SUP-R-{suffix}", name=f"Rate Supplier {suffix}", is_active=True)
    db_session.add(supplier)

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"R-ITM-{suffix}", item_name=f"Rate Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"R-SKU-{suffix}", variant_name=f"Rate Variant {suffix}",
        cost_price=Decimal("450.00"), selling_price=Decimal("900.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, sku=variant.variant_sku, barcode=f"333{suffix}01",
        name=variant.variant_name, category="Supplies", price=Decimal("900.00"), cost_price=Decimal("400.00"),
        stock=5, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    receipt = PurchaseReceipt(
        id=f"rcpt_{suffix}", company_id=comp_id, receipt_no=f"RCPT-{suffix}",
        supplier_id=supplier_id, status="RECEIVED", is_deleted=False
    )
    db_session.add(receipt)
    await db_session.flush()

    rcpt_item = PurchaseReceiptItem(
        id=f"pri_{suffix}",
        receipt_id=receipt.id, product_id=product.id, item_id=item.id, variant_id=variant.id,
        code=product.code, name=product.name, quantity_received=Decimal("10.00"), cost_price=Decimal("475.50"),
        line_total=Decimal("4755.00"),
        is_deleted=False
    )
    db_session.add(rcpt_item)
    await db_session.commit()

    tenant = TenantContext(company_id=comp_id, branch_id=None)
    purchase_svc = PurchaseService(db=db_session, tenant=tenant)
    rate_res = await purchase_svc.get_supplier_default_rate(supplier_id=supplier_id, product_id=product.id)

    assert rate_res["supplier_id"] == supplier_id
    assert rate_res["default_rate"] == 475.50
    assert rate_res["source"] == "last_grn"


@pytest.mark.asyncio
async def test_09_stock_synchronizer_aggregates_canonical_variant_movements(db_session: AsyncSession):
    """
    Test 9: StockSynchronizer aggregates StockMovement records that carry
    variant_id matching the product's item_variant_id.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"S-ITM-{suffix}", item_name=f"Sync Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"S-SKU-{suffix}", variant_name=f"Sync Variant {suffix}",
        selling_price=Decimal("1200.00"), cost_price=Decimal("600.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, sku=variant.variant_sku, barcode=f"222{suffix}01",
        name=variant.variant_name, category="Parts", price=Decimal("1200.00"), cost_price=Decimal("600.00"),
        stock=0, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    # Movement recorded under variant_id
    sm_in = StockMovement(
        id=f"sm_in_{suffix}", company_id=comp_id, product_id=product.id,
        item_id=item.id, variant_id=variant.id, product_name=product.name,
        sku=product.sku, quantity=Decimal("25.00"), movement_type="INWARD_GRN",
        is_deleted=False
    )
    db_session.add(sm_in)

    sm_out = StockMovement(
        id=f"sm_out_{suffix}", company_id=comp_id, product_id=product.id,
        item_id=item.id, variant_id=variant.id, product_name=product.name,
        sku=product.sku, quantity=Decimal("7.00"), movement_type="OUTWARD_SALE",
        is_deleted=False
    )
    db_session.add(sm_out)
    await db_session.commit()

    synced_stock = await StockSynchronizer.sync_product_stock_cache(
        session=db_session,
        product_id=product.id,
        company_id=comp_id,
    )

    assert synced_stock == Decimal("18.00")
    # Also verify direct variant synchronizer
    var_synced = await StockSynchronizer.sync_variant_stock_cache(
        session=db_session,
        variant_id=variant.id,
        company_id=comp_id,
    )
    assert var_synced == Decimal("18.00")


@pytest.mark.asyncio
async def test_10_pdt_analytics_supports_canonical_variant_query(db_session: AsyncSession):
    """
    Test 10: PdtAnalyticsService calculate_sku_velocity_and_cover accepts
    canonical variant_id and accurately computes sales velocity and cover.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = COMP_ID

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"P-ITM-{suffix}", item_name=f"PDT Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"P-SKU-{suffix}", variant_name=f"PDT Variant {suffix}",
        selling_price=Decimal("500.00"), cost_price=Decimal("250.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, sku=variant.variant_sku, barcode=f"111{suffix}01",
        name=variant.variant_name, category="General", price=Decimal("500.00"), cost_price=Decimal("250.00"),
        stock=30, is_active=True
    )
    db_session.add(product)
    await db_session.flush()

    # Outward sales movements with variant_id
    sm_sale = StockMovement(
        id=f"sm_pdt_{suffix}", company_id=comp_id, product_id=product.id,
        item_id=item.id, variant_id=variant.id, product_name=product.name,
        sku=product.sku, quantity=Decimal("60.00"), movement_type="OUTWARD_SALE",
        created_at=datetime.now(timezone.utc), is_deleted=False
    )
    db_session.add(sm_sale)
    await db_session.commit()

    # Query velocity using canonical variant ID
    res = await PdtAnalyticsService.calculate_sku_velocity_and_cover(
        session=db_session,
        company_id=comp_id,
        sku=variant.id,  # Query by variant_id
        lookback_days=30,
        lead_time_days=7,
        safety_stock=Decimal("5.00"),
    )

    assert res["total_units_sold"] == 60.0
    assert res["avg_daily_velocity"] == 2.0  # 60 units / 30 days = 2.0 units/day
    assert res["current_stock_on_hand"] == 30.0
    assert res["days_of_cover"] == 15.0  # 30 stock / 2.0 velocity = 15 days
