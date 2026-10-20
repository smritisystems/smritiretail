"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-20
Modified     : 2026-10-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Comprehensive Stock Movement Invariant & Reconciliation Automated Test Suite (14 Scenarios)
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select, func
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.inventory import (
    Product, StockMovement, ProductBatchStock, Warehouse,
    StockTransfer, StockTransferItem, TransferStatus
)
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem
from app.models.item_master import Item, ItemVariant
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.services.sales_stock_authority import SalesStockAuthority
from app.services.stock_synchronizer import StockSynchronizer
from app.services.stock_reconciliation_engine import StockReconciliationEngine
from app.services.inventory_wms import InventoryWmsService


async def _make_tenant(db_session, suffix: str):
    comp = Company(
        id=f"COMP-AUDIT-{suffix}",
        name=f"Audit Tenant {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=f"BR-AUDIT-{suffix}",
        code=f"BR-{suffix}",
        name=f"Branch {suffix}",
        company_id=comp.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(comp)
    db_session.add(branch)
    await db_session.commit()

    wh = Warehouse(
        id=f"WH-AUDIT-{suffix}",
        code=f"WH-{suffix}",
        name=f"Main Warehouse {suffix}",
        company_id=comp.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(wh)
    await db_session.commit()
    return comp, branch, wh


async def _make_product(db_session, suffix: str, comp_id: str, br_id: str, stock: int = 100, variant_id: str = None):
    prod = Product(
        id=f"PROD-AUDIT-{suffix}",
        code=f"SKU-{suffix}",
        sku=f"SKU-{suffix}",
        name=f"Audit Test Product {suffix}",
        price=Decimal("200.00"),
        mrp=Decimal("200.00"),
        gst_percentage=Decimal("18.00"),
        category="Apparel",
        barcode=f"BAR-{suffix}",
        stock=stock,
        company_id=comp_id,
        branch_id=br_id,
        item_variant_id=variant_id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()
    return prod


# ==============================================================================
# Scenario 1: Purchase receipt increases stock once
# ==============================================================================
@pytest.mark.asyncio
async def test_01_purchase_receipt_increases_stock_once(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=0)

    # Record Goods Receipt Note inward stock movement
    sm = StockMovement(
        id=f"sm_{uuid.uuid4().hex[:12]}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        sku=prod.sku,
        product_name=prod.name,
        quantity=Decimal("50.00"),
        movement_type="INWARD_GRN",
        reference_doc_type="GOODS_RECEIPT",
        reference_doc_id=f"GRN-{s}",
        unit_cost=Decimal("120.00"),
        user="SYSTEM",
    )
    db_session.add(sm)
    await db_session.flush()

    new_stock = await StockSynchronizer.sync_product_stock_cache(db_session, prod.id, comp.id)
    await db_session.commit()

    assert new_stock == Decimal("50.00")
    await db_session.refresh(prod)
    assert prod.stock == 50

    # Verify only 1 movement exists
    count_stmt = select(func.count(StockMovement.id)).where(
        StockMovement.company_id == comp.id,
        StockMovement.reference_doc_id == f"GRN-{s}",
    )
    cnt = (await db_session.execute(count_stmt)).scalar()
    assert cnt == 1


# ==============================================================================
# Scenario 2: Completed inventory-affecting sale decreases stock once
# ==============================================================================
@pytest.mark.asyncio
async def test_02_completed_sale_decreases_stock_once(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=100)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    movs = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("15.00")}],
    )
    await db_session.commit()

    assert len(movs) == 1
    assert movs[0].movement_type == "OUTWARD_SALE"
    assert Decimal(str(movs[0].quantity)) == Decimal("15.00")

    await db_session.refresh(prod)
    assert prod.stock == 85  # 100 - 15


# ==============================================================================
# Scenario 3: Purchase Order without a receipt does not increase physical stock
# ==============================================================================
@pytest.mark.asyncio
async def test_03_purchase_order_without_receipt_does_not_affect_stock(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=40)

    # Create Supplier first
    supp = Supplier(
        id=f"SUPP-{s}",
        code=f"SUPP-{s}",
        name=f"Supplier {s}",
        company_id=comp.id,
        branch_id=br.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(supp)
    await db_session.flush()

    # Create a CONFIRMED Purchase Order
    po = PurchaseOrder(
        id=f"po_{s}",
        company_id=comp.id,
        branch_id=br.id,
        order_no=f"PO-{s}",
        supplier_id=supp.id,
        status="CONFIRMED",
        grand_total=Decimal("5000.00"),
        is_deleted=False,
    )
    po_item = PurchaseOrderItem(
        id=f"poi_{s}",
        company_id=comp.id,
        branch_id=br.id,
        order_id=po.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("100.00"),
        cost_price=Decimal("50.00"),
        line_total=Decimal("5000.00"),
        is_deleted=False,
    )
    db_session.add(po)
    db_session.add(po_item)
    await db_session.commit()

    # Verify zero StockMovement entries generated
    sm_count_stmt = select(func.count(StockMovement.id)).where(
        StockMovement.company_id == comp.id,
        StockMovement.reference_doc_id == po.id,
    )
    count = (await db_session.execute(sm_count_stmt)).scalar()
    assert count == 0

    await db_session.refresh(prod)
    assert prod.stock == 40  # Physical stock completely unaffected


# ==============================================================================
# Scenario 4: Sales Order without dispatch does not decrease physical stock
# ==============================================================================
@pytest.mark.asyncio
async def test_04_sales_order_without_dispatch_does_not_decrease_stock(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=75)

    # Create a DRAFT Sales Invoice / Sales Order
    inv = SalesInvoice(
        id=f"so_{s}",
        company_id=comp.id,
        branch_id=br.id,
        invoice_no=f"SO-{s}",
        date=date.today(),
        status="Draft",
        taxable_value=Decimal("1000.00"),
        tax_total=Decimal("180.00"),
        grand_total=Decimal("1180.00"),
        is_deleted=False,
    )
    db_session.add(inv)
    await db_session.commit()

    # Verify zero StockMovement entries
    sm_count = (await db_session.execute(
        select(func.count(StockMovement.id)).where(
            StockMovement.company_id == comp.id,
            StockMovement.reference_doc_id == inv.id,
        )
    )).scalar()
    assert sm_count == 0

    await db_session.refresh(prod)
    assert prod.stock == 75


# ==============================================================================
# Scenario 5: Sales return and purchase return have correct directional effects
# ==============================================================================
@pytest.mark.asyncio
async def test_05_sales_and_purchase_returns_correct_directions(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)

    # 1. Sales Return (customer returns goods -> increases inventory)
    sm_sr = StockMovement(
        id=f"sm_sr_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        sku=prod.sku,
        product_name=prod.name,
        quantity=Decimal("5.00"),
        movement_type="SALES_RETURN",
        reference_doc_type="SALES_RETURN",
        reference_doc_id=f"SR-{s}",
        user="SYSTEM",
    )
    db_session.add(sm_sr)
    await db_session.flush()
    await StockSynchronizer.sync_product_stock_cache(db_session, prod.id, comp.id)
    await db_session.commit()

    await db_session.refresh(prod)
    assert prod.stock == 55  # 50 + 5

    # 2. Purchase Return (debit note to supplier -> decreases inventory)
    sm_pr = StockMovement(
        id=f"sm_pr_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        sku=prod.sku,
        product_name=prod.name,
        quantity=Decimal("10.00"),
        movement_type="RETURN_OUTWARD",
        reference_doc_type="DEBIT_NOTE",
        reference_doc_id=f"DN-{s}",
        user="SYSTEM",
    )
    db_session.add(sm_pr)
    await db_session.flush()
    await StockSynchronizer.sync_product_stock_cache(db_session, prod.id, comp.id)
    await db_session.commit()

    await db_session.refresh(prod)
    assert prod.stock == 45  # 55 - 10


# ==============================================================================
# Scenario 6: Cancelled transactions and reversals restore correct balance
# ==============================================================================
@pytest.mark.asyncio
async def test_06_cancelled_transactions_and_reversals_restore_balance(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=100)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # 1. Post Sale of 20
    await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("20.00")}],
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 80

    # 2. Cancel Sale of 20
    rev_movs = await SalesStockAuthority.record_sales_cancellation_reversal(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
    )
    await db_session.commit()

    assert len(rev_movs) == 1
    assert rev_movs[0].movement_type in ("SALES_CANCEL", "RETURN_INWARD")
    await db_session.refresh(prod)
    assert prod.stock == 100  # Completely restored to 100

    # 3. Repeated cancellation is idempotent and does not double-restore
    idempotent_rev = await SalesStockAuthority.record_sales_cancellation_reversal(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
    )
    await db_session.commit()
    assert len(idempotent_rev) == 1
    await db_session.refresh(prod)
    assert prod.stock == 100  # Unchanged at 100


# ==============================================================================
# Scenario 7: Warehouse transfers balance across both locations
# ==============================================================================
@pytest.mark.asyncio
async def test_07_warehouse_transfers_balance_across_locations(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh1 = await _make_tenant(db_session, s)
    
    # Create second destination warehouse
    wh2 = Warehouse(
        id=f"WH-DEST-{s}",
        code=f"WHD-{s}",
        name=f"Dest Warehouse {s}",
        company_id=comp.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(wh2)
    await db_session.commit()

    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    batch_no = f"BATCH-{s}"
    
    # Initialize batch in WH1 with 50 units
    b1 = ProductBatchStock(
        id=f"pbs1_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh1.id,
        product_id=prod.id,
        batch_no=batch_no,
        quantity=Decimal("50.00"),
        is_deleted=False,
    )
    db_session.add(b1)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    wms = InventoryWmsService(db_session, tenant_ctx)

    # Create transfer order of 20 units from WH1 -> WH2
    transfer = await wms.create_stock_transfer(
        source_warehouse_id=wh1.id,
        dest_warehouse_id=wh2.id,
        items_in=[{"product_id": prod.id, "batch_no": batch_no, "quantity": 20.0}],
    )
    await db_session.commit()

    # Dispatch transfer: WH1 stock decreases by 20
    await wms.dispatch_stock_transfer(transfer.id)
    await db_session.commit()

    await db_session.refresh(b1)
    assert b1.quantity == Decimal("30.00")

    # Receive transfer at WH2: WH2 stock increases by 20
    transfer_items = transfer.items
    rec_details = [{
        "item_id": transfer_items[0].id,
        "quantity_received": 20.0,
        "quantity_shortage": 0.0,
        "quantity_damaged": 0.0,
    }]
    await wms.receive_stock_transfer(transfer.id, rec_details)
    await db_session.commit()

    # Check WH2 batch stock
    b2_res = await db_session.execute(
        select(ProductBatchStock).where(
            ProductBatchStock.company_id == comp.id,
            ProductBatchStock.warehouse_id == wh2.id,
            ProductBatchStock.product_id == prod.id,
            ProductBatchStock.batch_no == batch_no,
        )
    )
    b2 = b2_res.scalars().first()
    assert b2 is not None
    assert b2.quantity == Decimal("20.00")

    # Net company physical stock = 30 + 20 = 50 (Zero drift across tenant boundary)
    await db_session.refresh(prod)
    assert prod.stock == 50


# ==============================================================================
# Scenario 8: Duplicate API requests and concurrent retries do not duplicate movements
# ==============================================================================
@pytest.mark.asyncio
async def test_08_duplicate_api_requests_do_not_duplicate_movements(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=100)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    inv_id = f"inv-dup-{s}"
    items = [{"product_id": prod.id, "quantity": Decimal("10.00")}]

    # Request 1
    movs1 = await SalesStockAuthority.record_outward_sale(
        session=db_session, tenant_ctx=tenant_ctx, invoice_id=inv_id, invoice_no=f"INV-{s}", items=items
    )
    await db_session.commit()

    # Request 2 (simulated network retry with identical idempotency token/invoice_id)
    movs2 = await SalesStockAuthority.record_outward_sale(
        session=db_session, tenant_ctx=tenant_ctx, invoice_id=inv_id, invoice_no=f"INV-{s}", items=items
    )
    await db_session.commit()

    # IDs returned should match exactly; no new rows inserted
    assert [m.id for m in movs1] == [m.id for m in movs2]
    await db_session.refresh(prod)
    assert prod.stock == 90  # Deducted only once


# ==============================================================================
# Scenario 9: Article/color/size variants cannot affect the wrong item
# ==============================================================================
@pytest.mark.asyncio
async def test_09_variants_cannot_affect_wrong_item(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)

    # Create parent Item and two variant entities
    item = Item(
        id=f"ITEM-{s}",
        company_id=comp.id,
        branch_id=br.id,
        item_code=f"ITM-{s}",
        item_name=f"Style Item {s}",
        uom="PCS",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(item)
    await db_session.flush()

    var1 = ItemVariant(
        id=f"VAR-RED-M-{s}",
        company_id=comp.id,
        branch_id=br.id,
        item_id=item.id,
        variant_sku=f"SKU-RED-M-{s}",
        variant_name="Red M",
        color="Red",
        size="M",
        is_active=True,
        is_deleted=False,
    )
    var2 = ItemVariant(
        id=f"VAR-BLUE-L-{s}",
        company_id=comp.id,
        branch_id=br.id,
        item_id=item.id,
        variant_sku=f"SKU-BLUE-L-{s}",
        variant_name="Blue L",
        color="Blue",
        size="L",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(var1)
    db_session.add(var2)
    await db_session.flush()

    prod1 = await _make_product(db_session, f"{s}_1", comp.id, br.id, stock=30, variant_id=var1.id)
    prod2 = await _make_product(db_session, f"{s}_2", comp.id, br.id, stock=30, variant_id=var2.id)

    # Post movement for variant 1 only
    sm1 = StockMovement(
        id=f"sm_v1_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod1.id,
        variant_id=var1.id,
        sku=prod1.sku,
        product_name=prod1.name,
        quantity=Decimal("5.00"),
        movement_type="OUTWARD_SALE",
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=f"INV-V1-{s}",
        user="SYSTEM",
    )
    db_session.add(sm1)
    await db_session.flush()

    await StockSynchronizer.sync_product_stock_cache(db_session, prod1.id, comp.id)
    await StockSynchronizer.sync_product_stock_cache(db_session, prod2.id, comp.id)
    await db_session.commit()

    await db_session.refresh(prod1)
    await db_session.refresh(prod2)

    assert prod1.stock == 25  # Variant 1 deducted by 5
    assert prod2.stock == 30  # Variant 2 completely unaffected


# ==============================================================================
# Scenario 10: Cross-company and cross-warehouse isolation is enforced
# ==============================================================================
@pytest.mark.asyncio
async def test_10_cross_company_and_warehouse_isolation(db_session):
    s1 = uuid.uuid4().hex[:8]
    s2 = uuid.uuid4().hex[:8]

    comp1, br1, wh1 = await _make_tenant(db_session, s1)
    comp2, br2, wh2 = await _make_tenant(db_session, s2)

    prod1 = await _make_product(db_session, s1, comp1.id, br1.id, stock=50)
    prod2 = await _make_product(db_session, s2, comp2.id, br2.id, stock=80)

    # Movement in Company 1
    sm = StockMovement(
        id=f"sm_c1_{s1}",
        company_id=comp1.id,
        branch_id=br1.id,
        warehouse_id=wh1.id,
        product_id=prod1.id,
        sku=prod1.sku,
        product_name=prod1.name,
        quantity=Decimal("20.00"),
        movement_type="OUTWARD_SALE",
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=f"INV-C1-{s1}",
        user="SYSTEM",
    )
    db_session.add(sm)
    await db_session.flush()
    await StockSynchronizer.sync_product_stock_cache(db_session, prod1.id, comp1.id)
    await db_session.commit()

    # Run audit report strictly for Company 2
    report2 = await StockReconciliationEngine.run_reconciliation_audit(
        session=db_session,
        company_id=comp2.id,
    )

    # Prod1 movement must NEVER appear in Company 2 report
    assert all(d.company_id == comp2.id for d in report2.discrepancies)
    assert not any(d.product_id == prod1.id for d in report2.discrepancies)


# ==============================================================================
# Scenario 11: Opening stock and adjustments reconcile correctly
# ==============================================================================
@pytest.mark.asyncio
async def test_11_opening_stock_and_adjustments_reconciliation(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=0)

    # 1. Opening stock: 100
    sm_open = StockMovement(
        id=f"sm_op_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        sku=prod.sku,
        product_name=prod.name,
        quantity=Decimal("100.00"),
        movement_type="OPENING_STOCK",
        reference_doc_type="OPENING_BALANCE",
        reference_doc_id=prod.id,
        user="SYSTEM",
    )
    # 2. Positive adjustment: +15
    sm_adj_in = StockMovement(
        id=f"sm_ai_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        sku=prod.sku,
        product_name=prod.name,
        quantity=Decimal("15.00"),
        movement_type="ADJUSTMENT_IN",
        reference_doc_type="STOCK_ADJUSTMENT",
        reference_doc_id=f"ADJ-{s}",
        user="SYSTEM",
    )
    # 3. Negative adjustment: -5
    sm_adj_out = StockMovement(
        id=f"sm_ao_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        sku=prod.sku,
        product_name=prod.name,
        quantity=Decimal("5.00"),
        movement_type="ADJUSTMENT_OUT",
        reference_doc_type="STOCK_ADJUSTMENT",
        reference_doc_id=f"ADJ-{s}",
        user="SYSTEM",
    )
    db_session.add_all([sm_open, sm_adj_in, sm_adj_out])
    await db_session.flush()

    new_stock = await StockSynchronizer.sync_product_stock_cache(db_session, prod.id, comp.id)
    await db_session.commit()

    # 100 + 15 - 5 = 110
    assert new_stock == Decimal("110.00")
    await db_session.refresh(prod)
    assert prod.stock == 110


# ==============================================================================
# Scenario 12: Negative stock follows configured business policy
# ==============================================================================
@pytest.mark.asyncio
async def test_12_negative_stock_policy_enforcement(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=5)

    b = ProductBatchStock(
        id=f"pbs_neg_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        batch_no=f"BATCH-NEG-{s}",
        quantity=Decimal("5.00"),
        is_deleted=False,
    )
    db_session.add(b)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    wms = InventoryWmsService(db_session, tenant_ctx)

    # Attempting to allocate 10 units when only 5 exist must raise HTTPException(400)
    with pytest.raises(HTTPException) as exc_info:
        await wms.allocate_stock_fefo(
            product_id=prod.id,
            warehouse_id=wh.id,
            requested_qty=Decimal("10.00"),
        )
    assert exc_info.value.status_code == 400
    assert "SMRITI-STOCK-001" in exc_info.value.detail


# ==============================================================================
# Scenario 13: Ledger, cached balance and stock reports reconcile
# ==============================================================================
@pytest.mark.asyncio
async def test_13_ledger_cached_balance_and_report_reconcile(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)

    # 1. Clean state check
    report = await StockReconciliationEngine.run_reconciliation_audit(
        session=db_session,
        company_id=comp.id,
        product_id=prod.id,
    )
    assert report.total_products_audited == 1
    # Prod was initialized with stock 50 without movements -> detected as MISSING_MOVEMENT
    assert report.discrepancy_count == 1
    assert report.discrepancies[0].discrepancy_category == "MISSING_MOVEMENT"

    # 2. Add authoritative opening stock movement to reconcile
    sm = StockMovement(
        id=f"sm_rec_{s}",
        company_id=comp.id,
        branch_id=br.id,
        warehouse_id=wh.id,
        product_id=prod.id,
        sku=prod.sku,
        product_name=prod.name,
        quantity=Decimal("50.00"),
        movement_type="OPENING_STOCK",
        reference_doc_type="OPENING_BALANCE",
        reference_doc_id=prod.id,
        user="SYSTEM",
    )
    db_session.add(sm)
    await db_session.commit()

    # Re-run audit -> now clean and balanced!
    clean_report = await StockReconciliationEngine.run_reconciliation_audit(
        session=db_session,
        company_id=comp.id,
        product_id=prod.id,
    )
    assert clean_report.discrepancy_count == 0
    assert clean_report.balanced_products_count == 1


# ==============================================================================
# Scenario 14: Failed transactions roll back atomically without partial updates
# ==============================================================================
@pytest.mark.asyncio
async def test_14_failed_transactions_rollback_atomically(db_session):
    s = uuid.uuid4().hex[:8]
    comp, br, wh = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    try:
        # Pass non-existent product in multi-item batch to force transaction failure
        await SalesStockAuthority.record_outward_sale(
            session=db_session,
            tenant_ctx=tenant_ctx,
            invoice_id=f"inv-fail-{s}",
            invoice_no=f"INV-FAIL-{s}",
            items=[
                {"product_id": prod.id, "quantity": Decimal("10.00")},
                {"product_id": f"NONEXISTENT-{s}", "quantity": Decimal("10.00")},
            ],
        )
    except Exception:
        await db_session.rollback()

    # Verify zero movements created for this invoice
    check_stmt = select(func.count(StockMovement.id)).where(
        StockMovement.reference_doc_id == f"inv-fail-{s}"
    )
    count = (await db_session.execute(check_stmt)).scalar()
    assert count == 0

    await db_session.refresh(prod)
    assert prod.stock == 50  # Unmodified
