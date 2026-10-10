"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.18
Created      : 2026-10-07
Modified     : 2026-10-07
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — Phase 2 Global Stock Identity Gate & Dual-Key Write Convergence
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi import HTTPException

from app.models.item_master import Item, ItemVariant, ItemBarcode, LegacyIdMapping
from app.models.inventory import Product, StockMovement, StockAudit, StockAuditItem
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem
from app.services.product_resolution_service import ProductResolutionService
from app.schemas.product_resolution import TransactionLineItemInput
from app.services.inventory import InventoryService
from app.services.stock_acct_svc import StockAccountingBoundaryService, StockMovementRecordRequest
from app.services.purchase import PurchaseService
from app.schemas.purchase import PurchaseReceiptCreate, PurchaseReceiptItemCreate
from app.services.sales import SalesService
from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
from app.services.stock_audit_service import StockAuditService
from app.services.sales_stock_authority import SalesStockAuthority
from app.api.deps import TenantContext


TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_01_valid_canonical_transaction_resolution(db_session: AsyncSession):
    """
    Test 1: Given valid company, item, variant, product bridge, and barcode/SKU,
    resolution yields item_id, variant_id, product_id representing the SAME canonical identity.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    sku = f"SKU_CAN_{suffix}"
    barcode = f"890{suffix}01"

    # 1. Create canonical Item -> Variant -> Barcode
    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"STYLE-{suffix}", item_name=f"Shirt {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=sku, variant_name=f"Shirt {suffix} Size 40",
        selling_price=Decimal("1299.00"), cost_price=Decimal("500.00"), is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    bc = ItemBarcode(
        id=f"bc_{suffix}", company_id=comp_id, item_id=item.id,
        variant_id=variant.id, barcode=barcode, is_active=True
    )
    db_session.add(bc)

    # 2. Create legacy Product bridge linked to canonical hierarchy
    product = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id,
        item_variant_id=variant.id, code=sku, sku=sku, barcode=barcode,
        name=f"Shirt {suffix} Size 40", category="General", price=Decimal("1299.00"), cost_price=Decimal("500.00"),
        stock=10, is_active=True
    )
    db_session.add(product)

    # 3. Create lineage mapping
    mapping = LegacyIdMapping(
        id=f"map_{suffix}",
        migration_run_id=f"MIG_{suffix}",
        legacy_table="products",
        legacy_id=product.id,
        canonical_table="item_variants",
        canonical_id=variant.id,
        disposition="MIGRATED",
    )
    db_session.add(mapping)
    await db_session.commit()

    # 4. Validate via ProductResolutionService
    res = await ProductResolutionService.resolve(session=db_session, company_id=comp_id, identifier=barcode)
    assert res.success is True
    assert res.item_id == item.id
    assert res.variant_id == variant.id
    assert res.product_id == product.id
    assert res.sku == sku


@pytest.mark.asyncio
async def test_02_unknown_sku_rejection(db_session: AsyncSession):
    """
    Test 2: Nonexistent SKU must be rejected. No Product, Item, Variant, or StockMovement created.
    """
    comp_id = "COMP-001"
    bogus_sku = f"NONEXISTENT_SKU_{uuid.uuid4().hex[:8]}"

    res = await ProductResolutionService.resolve(session=db_session, company_id=comp_id, identifier=bogus_sku)
    assert res.success is False
    assert res.code == "PRODUCT_NOT_FOUND"

    # Verify no phantom records exist
    prod_check = (await db_session.execute(select(Product).where(Product.code == bogus_sku))).scalars().first()
    assert prod_check is None


@pytest.mark.asyncio
async def test_03_unknown_barcode_rejection(db_session: AsyncSession):
    """
    Test 3: Nonexistent barcode must be rejected.
    """
    comp_id = "COMP-001"
    bogus_bc = "8909999999999"

    res = await ProductResolutionService.resolve(session=db_session, company_id=comp_id, identifier=bogus_bc)
    assert res.success is False
    assert res.code == "PRODUCT_NOT_FOUND"


@pytest.mark.asyncio
async def test_04_cross_company_identifier_rejection(db_session: AsyncSession):
    """
    Test 4: Cross-company barcode must be rejected. Resolver must strictly remain company-scoped.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_a = "COMP-001"
    comp_b = "COMP-002"
    sku_a = f"SKU_A_{suffix}"

    item_a = Item(id=f"itm_a_{suffix}", company_id=comp_a, item_code=f"CODE_A_{suffix}", item_name="Item A", is_active=True)
    db_session.add(item_a)
    await db_session.flush()

    var_a = ItemVariant(id=f"var_a_{suffix}", company_id=comp_a, item_id=item_a.id, variant_sku=sku_a, variant_name="Var A", is_active=True)
    db_session.add(var_a)
    await db_session.commit()

    # Company B queries Company A's SKU -> MUST FAIL
    res = await ProductResolutionService.resolve(session=db_session, company_id=comp_b, identifier=sku_a)
    assert res.success is False
    assert res.code == "PRODUCT_NOT_FOUND"


@pytest.mark.asyncio
async def test_05_unlinked_product_blocked_for_new_stock(db_session: AsyncSession):
    """
    Test 5: Product exists but item_id=NULL and item_variant_id=NULL.
    NON-NEGOTIABLE RULE: Must be BLOCKED for new stock transactions.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    unlinked_sku = f"UNLINKED_PRD_{suffix}"

    product = Product(
        id=f"prd_unl_{suffix}", company_id=comp_id, item_id=None, item_variant_id=None,
        code=unlinked_sku, sku=unlinked_sku, barcode=f"BC_{suffix}", name=f"Unlinked Product {suffix}", category="General",
        price=Decimal("100.00"), cost_price=Decimal("80.00"), stock=5, is_active=True
    )
    db_session.add(product)
    await db_session.commit()

    # Attempting to record a stock movement via InventoryService for unlinked product must raise validation error
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")
    inv_svc = InventoryService(db_session, tenant_ctx)

    with pytest.raises(HTTPException) as exc_info:
        await inv_svc.record_movement(
            product_id=product.id,
            quantity=10,
            movement_type="IN",
            reference_doc_type="OPENING_STOCK",
            reference_doc_id=f"REF-{suffix}",
        )
    assert exc_info.value.status_code == 422
    assert "UNLINKED_PRODUCT_NOT_ALLOWED" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_06_product_item_mismatch_rejection(db_session: AsyncSession):
    """
    Test 6: Validating transaction line with product_id belonging to Item A but item_id set to Item B.
    Must be rejected with PRODUCT_CANONICAL_MISMATCH or validation error.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    item_a = Item(id=f"itm_a_{suffix}", company_id=comp_id, item_code=f"ITEM_A_{suffix}", item_name="Item A", is_active=True)
    item_b = Item(id=f"itm_b_{suffix}", company_id=comp_id, item_code=f"ITEM_B_{suffix}", item_name="Item B", is_active=True)
    db_session.add_all([item_a, item_b])
    await db_session.flush()

    var_a = ItemVariant(id=f"var_a_{suffix}", company_id=comp_id, item_id=item_a.id, variant_sku=f"SKU_A_{suffix}", variant_name=f"Var A {suffix}", is_active=True)
    db_session.add(var_a)
    await db_session.flush()

    prod_a = Product(id=f"prd_a_{suffix}", company_id=comp_id, item_id=item_a.id, item_variant_id=var_a.id, code=var_a.variant_sku, name=f"Prod A {suffix}", barcode=f"BC_{suffix}", category="General", is_active=True)
    db_session.add(prod_a)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")
    inv_svc = InventoryService(db_session, tenant_ctx)
    with pytest.raises(HTTPException) as exc_info:
        await inv_svc.record_movement(
            product_id=prod_a.id,
            item_id=item_b.id,  # MISMATCH: Item B instead of Item A
            quantity=10,
            movement_type="IN",
            reference_doc_type="OPENING_STOCK",
            reference_doc_id=f"REF-{suffix}",
        )
    assert exc_info.value.status_code == 422
    assert "PRODUCT_CANONICAL_MISMATCH" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_07_product_variant_mismatch_rejection(db_session: AsyncSession):
    """
    Test 7: Transaction line with product_id for Variant A but variant_id set to Variant B.
    Must be rejected with 422 PRODUCT_CANONICAL_MISMATCH.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name="Item", is_active=True)
    db_session.add(item)
    await db_session.flush()

    var_a = ItemVariant(id=f"var_a_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_A_{suffix}", variant_name=f"Var A {suffix}", is_active=True)
    var_b = ItemVariant(id=f"var_b_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_B_{suffix}", variant_name=f"Var B {suffix}", is_active=True)
    db_session.add_all([var_a, var_b])
    await db_session.flush()

    prod_a = Product(id=f"prd_a_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=var_a.id, code=var_a.variant_sku, name=f"Prod A {suffix}", barcode=f"BC_{suffix}", category="General", is_active=True)
    db_session.add(prod_a)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")
    inv_svc = InventoryService(db_session, tenant_ctx)
    with pytest.raises(HTTPException) as exc_info:
        await inv_svc.record_movement(
            product_id=prod_a.id,
            variant_id=var_b.id,  # MISMATCH: Variant B instead of Variant A
            quantity=10,
            movement_type="IN",
            reference_doc_type="OPENING_STOCK",
            reference_doc_id=f"REF-{suffix}",
        )
    assert exc_info.value.status_code == 422
    assert "PRODUCT_CANONICAL_MISMATCH" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_08_valid_legacy_product_with_canonical_bridge(db_session: AsyncSession):
    """
    Test 8: Legacy Product having item_id and item_variant_id resolves successfully
    and enables stock movement creation with all three keys.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Bridged Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Bridged Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, branch_id="MAIN", item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Bridged Product {suffix}", category="General", stock=50, is_active=True
    )
    db_session.add(prod)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")
    inv_svc = InventoryService(db_session, tenant_ctx)

    # Stock adjustment must write all three keys to StockMovement
    mov = await inv_svc.adjust_stock(product_id=prod.id, new_quantity=60.0, reason="Test adjustment")
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_09_historical_record_compatibility(db_session: AsyncSession):
    """
    Test 9: Historical transactions with product_id only must remain queryable
    without forcing backfill or failing queries.
    """
    res = await db_session.execute(text("SELECT COUNT(*) FROM sales_invoice_items WHERE item_id IS NULL;"))
    count_missing = res.scalar()
    assert count_missing >= 0


@pytest.mark.asyncio
async def test_10_stock_movement_ledger_dual_key_population(db_session: AsyncSession):
    """
    Test 10: StockAccountingBoundaryService.record_stock_movement must write item_id,
    variant_id, and product_id onto StockMovement.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Ledger Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Ledger Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Ledger Product {suffix}", category="General", stock=10, is_active=True
    )
    db_session.add(prod)
    await db_session.commit()

    req = StockMovementRecordRequest(
        product_id=prod.id,
        quantity=5.0,
        movement_type="INWARD_GRN",
        reference_doc_type="PURCHASE_RECEIPT",
        reference_doc_id=f"GRN-{suffix}",
    )
    mov = await StockAccountingBoundaryService.record_stock_movement(
        session=db_session,
        company_id=comp_id,
        req=req,
        user_id="SYSTEM",
        commit=True,
    )
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_11_grn_receipt_creation_blocks_unknown_item(db_session: AsyncSession):
    """
    Test 11: Attempting to create a GRN receipt with an unknown item must be rejected
    with ITEM_NOT_FOUND (404/422).
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")
    purch_svc = PurchaseService(db_session, tenant_ctx)

    bogus_item = PurchaseReceiptItemCreate(
        product_id="BOGUS_UNKNOWN_ID",
        code="9940551000016",
        name="Unknown New Inward SKU",
        quantity_received=Decimal("5.0"),
        cost_price=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
    )
    grn_req = PurchaseReceiptCreate(
        supplier_id="sup_a928a21b04",
        warehouse_id="wh-central-001",
        items=[bogus_item],
    )

    with pytest.raises(HTTPException) as exc_info:
        await purch_svc.create_purchase_receipt(grn_req)
    assert exc_info.value.status_code in (404, 422)
    assert "ITEM_NOT_FOUND" in str(exc_info.value.detail) or "not found" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_12_sales_return_preserves_canonical_keys(db_session: AsyncSession):
    """
    Test 12: Creating a sales return from a dual-keyed invoice copies item_id
    and variant_id onto SalesReturnItem.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Return Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Return Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Return Product {suffix}", category="General", stock=20, is_active=True
    )
    db_session.add(prod)
    await db_session.flush()

    inv = SalesInvoice(
        id=f"inv_{suffix}", invoice_no=f"INV-{suffix}", company_id=comp_id, branch_id="MAIN",
        grand_total=Decimal("100.00"), status="PAID"
    )
    db_session.add(inv)
    await db_session.flush()

    sii = SalesInvoiceItem(
        invoice_id=inv.id, company_id=comp_id, branch_id="MAIN",
        product_id=prod.id, item_id=item.id, variant_id=variant.id,
        code=prod.code, name=prod.name, quantity=Decimal("2.0"), price=Decimal("50.00"),
        total_amount=Decimal("100.00")
    )
    db_session.add(sii)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")
    sales_svc = SalesService(db_session, tenant_ctx)

    sr_in = SalesReturnCreate(
        id=f"ret_{suffix}",
        return_no=f"RET-{suffix}",
        original_invoice_id=inv.id,
        reason="Customer Return",
        items=[
            SalesReturnItemCreate(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                quantity=Decimal("1.0"),
                price=Decimal("50.00"),
                total_amount=Decimal("50.00"),
            )
        ]
    )
    ret = await sales_svc.create_sales_return(sr_in)
    assert len(ret.items) == 1
    ret_item = ret.items[0]
    assert ret_item.product_id == prod.id
    assert ret_item.item_id == item.id
    assert ret_item.variant_id == variant.id


@pytest.mark.asyncio
async def test_13_grn_valid_item_succeeds_and_populates_movement_keys(db_session: AsyncSession):
    """
    Test 13: Creating a valid GRN receipt creates StockMovement with all three canonical IDs
    (product_id, item_id, variant_id).
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"GRN Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"GRN Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"GRN Product {suffix}", category="General", stock=0, is_active=True
    )
    db_session.add(prod)
    await db_session.commit()

    purch_svc = PurchaseService(db_session, tenant_ctx)
    grn_req = PurchaseReceiptCreate(
        receipt_no=f"GRN-{suffix}",
        supplier_id="sup_a928a21b04",
        warehouse_id="wh-central-001",
        items=[
            PurchaseReceiptItemCreate(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                quantity_received=Decimal("10.0"),
                cost_price=Decimal("120.00"),
                gst_rate=Decimal("18.00"),
            )
        ],
    )
    receipt = await purch_svc.create_purchase_receipt(grn_req)
    assert receipt is not None
    assert receipt.status == "RECEIVED"

    # Verify StockMovement generated by GRN carries all three keys
    mov_stmt = select(StockMovement).where(
        StockMovement.product_id == prod.id,
        StockMovement.movement_type == "INWARD_GRN",
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert mov is not None
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_14_grn_unknown_item_does_not_create_product_implicitly(db_session: AsyncSession):
    """
    Test 14: Verifies that when a GRN receipt with an unknown SKU/barcode fails,
    no Product, Item, or Variant is implicitly created in the database.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")
    purch_svc = PurchaseService(db_session, tenant_ctx)

    unknown_code = f"NONEXISTENT_{suffix}"
    grn_req = PurchaseReceiptCreate(
        receipt_no=f"GRN-FAIL-{suffix}",
        supplier_id="sup_a928a21b04",
        warehouse_id="wh-central-001",
        items=[
            PurchaseReceiptItemCreate(
                product_id=unknown_code,
                code=unknown_code,
                name="Should Not Create Product",
                quantity_received=Decimal("5.0"),
                cost_price=Decimal("50.00"),
            )
        ],
    )

    with pytest.raises(HTTPException):
        await purch_svc.create_purchase_receipt(grn_req)

    # Verify no product or item was created
    p_check = (await db_session.execute(select(Product).where(Product.code == unknown_code))).scalars().first()
    assert p_check is None
    i_check = (await db_session.execute(select(Item).where(Item.item_code == unknown_code))).scalars().first()
    assert i_check is None


@pytest.mark.asyncio
async def test_15_stock_adjustment_populates_dual_keys(db_session: AsyncSession):
    """
    Test 15: Stock adjustment via InventoryService.adjust_stock populates dual keys
    (product_id, item_id, variant_id) on the created StockMovement.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Adj Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Adj Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Adj Product {suffix}", category="General", stock=10, is_active=True
    )
    db_session.add(prod)
    await db_session.commit()

    inv_svc = InventoryService(db_session, tenant_ctx)
    mov = await inv_svc.adjust_stock(
        product_id=prod.id,
        new_quantity=15,
        reason="Physical count surplus",
    )
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_16_stock_transfer_populates_dual_keys(db_session: AsyncSession):
    """
    Test 16: Stock transfer via InventoryService.transfer_stock populates dual keys
    (product_id, item_id, variant_id) on the created StockMovement rows.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Trans Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Trans Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Trans Product {suffix}", category="General", stock=20, is_active=True
    )
    db_session.add(prod)
    await db_session.commit()

    inv_svc = InventoryService(db_session, tenant_ctx)
    mov = await inv_svc.transfer_stock(
        product_id=prod.id,
        from_warehouse="wh-central-001",
        to_warehouse="wh-branch-001",
        quantity=5,
    )
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_17_stock_audit_discrepancy_reconciliation_dual_keys(db_session: AsyncSession):
    """
    Test 17: Discrepancy reconciliation via StockAuditService.reconcile_and_post_discrepancies
    populates dual keys on the discrepancy StockMovement rows.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Audit Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Audit Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Audit Product {suffix}", category="General", stock=50, is_active=True
    )
    db_session.add(prod)
    await db_session.commit()

    audit_svc = StockAuditService(db_session, tenant_ctx)
    audit = StockAudit(
        id=f"aud_{suffix}",
        uuid=str(uuid.uuid4()),
        company_id=comp_id,
        branch_id="MAIN",
        audit_no=f"AUD-{suffix}",
        warehouse_id="wh-central-001",
        audit_date=datetime.now(timezone.utc),
        status="IN_PROGRESS",
    )
    db_session.add(audit)
    await db_session.flush()

    audit_item = StockAuditItem(
        id=f"audi_{suffix}",
        uuid=str(uuid.uuid4()),
        company_id=comp_id,
        branch_id="MAIN",
        audit_id=audit.id,
        product_id=prod.id,
        batch_no="BATCH-001",
        system_qty=50.0,
        counted_qty=45.0,
        variance_qty=-5.0,
        unit_cost=100.0,
        discrepancy_reason="DEFICIT_UNSPECIFIED",
        is_reconciled=False,
    )
    db_session.add(audit_item)
    await db_session.commit()

    reconciled = await audit_svc.reconcile_and_post_discrepancies(
        audit_id=audit.id,
        user_identifier="AUDITOR_01",
    )
    assert reconciled.status == "COMPLETED"

    # Verify StockMovement generated carries canonical identity
    mov_stmt = select(StockMovement).where(
        StockMovement.product_id == prod.id,
        StockMovement.movement_type == "OUTWARD_LOSS",
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert mov is not None
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_18_sales_stock_deduction_dual_keys(db_session: AsyncSession):
    """
    Test 18: Physical stock deduction on a sales invoice via InventoryService.record_movement
    populates dual keys on the outward StockMovement.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Sale Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Sale Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Sale Product {suffix}", category="General", stock=20, is_active=True
    )
    db_session.add(prod)
    await db_session.commit()

    inv_svc = InventoryService(db_session, tenant_ctx)
    mov = await inv_svc.record_movement(
        product_id=prod.id,
        movement_type="OUT",
        quantity=2,
        reference_doc_type="Sales Invoice",
        reference_doc_id=f"INV-{suffix}",
    )
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_19_sales_invoice_cancellation_restores_stock_with_dual_keys(db_session: AsyncSession):
    """
    Test 19: Cancelling a sales invoice restores stock via atomic_mutate_batch_stock,
    preserving canonical item_id and variant_id on the reversal movement.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN")

    item = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ITEM_{suffix}", item_name=f"Cancel Item {suffix}", is_active=True)
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU_{suffix}", variant_name=f"Cancel Variant {suffix}", is_active=True)
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd_{suffix}", company_id=comp_id, item_id=item.id, item_variant_id=variant.id,
        code=variant.variant_sku, barcode=f"BC_{suffix}", name=f"Cancel Product {suffix}", category="General", stock=20, is_active=True
    )
    db_session.add(prod)
    await db_session.flush()

    inv = SalesInvoice(
        id=f"inv_{suffix}", invoice_no=f"INV-{suffix}", company_id=comp_id, branch_id="MAIN",
        warehouse_id="wh-central-001", grand_total=Decimal("100.00"), status="PAID", is_deleted=False
    )
    db_session.add(inv)
    await db_session.flush()

    sii = SalesInvoiceItem(
        invoice_id=inv.id, company_id=comp_id, branch_id="MAIN",
        product_id=prod.id, item_id=item.id, variant_id=variant.id,
        code=prod.code, name=prod.name, quantity=Decimal("2.0"), price=Decimal("50.00"),
        total_amount=Decimal("100.00"), is_deleted=False
    )
    db_session.add(sii)
    await db_session.commit()

    sales_svc = SalesService(db_session, tenant_ctx)
    cancelled_inv = await sales_svc.cancel_sales_invoice(inv.id)
    assert cancelled_inv.status == "Cancelled"

    # Verify restoration movement exists with dual keys
    mov_stmt = select(StockMovement).where(
        StockMovement.product_id == prod.id,
        StockMovement.movement_type == "SALES_CANCEL",
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert mov is not None
    assert mov.product_id == prod.id
    assert mov.item_id == item.id
    assert mov.variant_id == variant.id


@pytest.mark.asyncio
async def test_20_databridge_grn_adapter_blocks_unknown_sku(db_session: AsyncSession):
    """
    Test 20: DataBridge GRN adapter strictly blocks unknown SKU auto-provisioning
    and raises ITEM_NOT_FOUND (422).
    """
    from app.services.databridge.adapters.grn_adapter import DataBridgeGrnAdapter
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    adapter = DataBridgeGrnAdapter()

    row = {
        "receipt_no": f"GRN-DB-{suffix}",
        "supplier_code": "sup_a928a21b04",
        "warehouse_code": "wh-central-001",
        "item_code": f"UNKNOWN_DB_{suffix}",
        "item_name": "Bogus Product",
        "quantity_received": 10,
        "cost_price": 100.0,
        "gst_rate": 18.0,
    }

    with pytest.raises(HTTPException) as exc_info:
        await adapter.commit([row], db_session, comp_id, branch_id="MAIN")
    assert exc_info.value.status_code == 422
    assert "ITEM_NOT_FOUND" in str(exc_info.value.detail) or "not found" in str(exc_info.value.detail).lower()

