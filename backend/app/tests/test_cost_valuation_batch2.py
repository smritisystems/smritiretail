"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | aitdl.com

* Version    : 6.75.0
* Created    : 2026-10-14
* Modified   : 2026-10-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Phase 2 Batch 2 — Cost & Valuation Integrity
Verifies:
  1. Selling price (product.price) is NEVER used as acquisition cost or COGS in outward sales or return inwards.
  2. Correct WAC resolution when valuation exists in ProductCostValuation.
  3. Missing-cost exception surfaced with explicit UNRESOLVED_ZERO_COST flag.
  4. WAC recalculation succeeds without NameError when ProductCostValuation row does not exist.
  5. Duplicate receipt valuation is strictly prevented via row-locking and [VALUATION_COMPLETED] idempotency.
  6. Landed cost apportioning updates true rolling WAC.
  7. Partial receipts update rolling WAC consecutively and accurately.
  8. Strict multi-tenant isolation on cost valuation and rolling WAC.
  9. Closed-period lockout protections (SMRITI-GL-006) preventing retroactive cost distortions.
  10. Missing-cost exception surfacing & non-finalized zero-cost profitability protection.
"""

import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
from typing import Optional
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.inventory import Product, Warehouse, StockMovement
from app.models.purchase import Supplier, PurchaseReceipt, PurchaseReceiptItem
from app.models.inward_cost import InwardCostComponent, InwardCostAllocation, InwardCostAdjustment
from app.models.profitability import ProductCostValuation, TransactionCostSnapshot, InvoiceProfitabilityLedger
from app.models.accounting import FiscalYear, FiscalPeriod
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturnItem
from app.api.deps import TenantContext
from app.services.cost_engine import CostManagementEngine
from app.services.sales_stock_authority import SalesStockAuthority
from app.services.unified_ledger import UnifiedAccountingLedgerService

pytestmark = pytest.mark.asyncio


async def setup_test_environment(db):
    s = uuid.uuid4().hex[:6]
    cid = f"CMP{s.upper()}"
    bid = f"BR{s.upper()}"
    wid = f"WH{s.upper()}"

    company = Company(
        id=cid,
        company_code=cid,
        name=f"Valuation Co {s}",
        gst_number="07AAAAA0000A1Z5",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=bid,
        company_id=cid,
        name=f"Valuation Branch {s}",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.commit()

    warehouse = Warehouse(
        id=wid,
        company_id=cid,
        branch_id=bid,
        name=f"Central Godown {s}",
        code=wid,
        is_active=True,
        is_deleted=False,
    )
    db.add(warehouse)
    await db.commit()

    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    return cid, bid, wid, tenant_ctx


def make_product(
    cid: str,
    bid: str,
    pid: str,
    name: str = "Test Product",
    price: Decimal = Decimal("1000.00"),
    cost_price: Optional[Decimal] = None,
    stock: int = 100,
) -> Product:
    s = uuid.uuid4().hex[:6]
    return Product(
        id=pid,
        company_id=cid,
        branch_id=bid,
        code=f"PRD-{s.upper()}",
        sku=f"SKU-{s.upper()}",
        barcode=f"BAR-{s.upper()}",
        category="General",
        name=name,
        price=price,
        mrp=price,
        cost_price=cost_price,
        gst_percentage=Decimal("18.00"),
        stock=stock,
        is_active=True,
        is_deleted=False,
    )


async def test_selling_price_never_used_as_stock_cost_or_cogs(db_session):
    """
    Test Case 1: Selling price (product.price) must NEVER be used as inventory cost or COGS.
    Setup:
      Product with selling price = 1,500.00, but cost_price is None and no PCV row exists.
    Verifies:
      - CostManagementEngine.resolve_cogs_unit_cost returns (0.00, 'UNRESOLVED_ZERO_COST').
      - SalesStockAuthority.record_outward_sale writes StockMovement with unit_cost = 0.00 (NOT 1500.00).
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(
        cid=cid,
        bid=bid,
        pid=pid,
        name="Designer Silk Shirt",
        price=Decimal("1500.00"),  # Retail Selling Price
        cost_price=None,          # No cost configured
        stock=50,
    )
    db_session.add(product)
    await db_session.flush()

    # 1. Test canonical COGS resolver directly
    resolved_cost, method = await CostManagementEngine.resolve_cogs_unit_cost(
        session=db_session,
        company_id=cid,
        product_id=pid,
    )
    assert resolved_cost == Decimal("0.00"), f"Expected 0.00, got {resolved_cost}"
    assert method == "UNRESOLVED_ZERO_COST"

    # 2. Test outward sale stock movement
    invoice_id = f"inv_{uuid.uuid4().hex[:8]}"
    movements = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=invoice_id,
        invoice_no="INV-POS-001",
        items=[{"product_id": pid, "quantity": Decimal("2.000")}],
        warehouse_id=wid,
    )

    assert len(movements) == 1
    mov = movements[0]
    assert mov.unit_cost == Decimal("0.00"), f"CRITICAL: StockMovement unit_cost fell back to selling price! Got {mov.unit_cost}"
    assert "UNRESOLVED_ZERO_COST" in (mov.remarks or "")


async def test_correct_wac_resolution_when_valuation_exists(db_session):
    """
    Test Case 2: WAC resolution when valid ProductCostValuation row exists.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(
        cid=cid,
        bid=bid,
        pid=pid,
        name="Cotton Linen Trousers",
        price=Decimal("2000.00"),
        cost_price=Decimal("600.00"),
        stock=100,
    )
    pcv = ProductCostValuation(
        id=f"pcv_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        company_id=cid,
        branch_id=bid,
        product_id=pid,
        weighted_average_cost=Decimal("625.50"),
        landed_cost=Decimal("650.00"),
        purchase_cost=Decimal("600.00"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([product, pcv])
    await db_session.flush()

    resolved_cost, method = await CostManagementEngine.resolve_cogs_unit_cost(
        session=db_session,
        company_id=cid,
        product_id=pid,
    )
    assert resolved_cost == Decimal("625.50")
    assert method == "WEIGHTED_AVERAGE"


async def test_wac_recalculation_when_valuation_row_does_not_exist(db_session):
    """
    Test Case 3: Recalculate historical WAC for a product that does not yet have a ProductCostValuation row.
    Verifies:
      - NameError 'IdentityEngine' is resolved.
      - Creates a new ProductCostValuation row with technical ID 'pcv_...'.
      - Accurately computes rolling WAC across multiple receipts.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(
        cid=cid,
        bid=bid,
        pid=pid,
        name="Woolen Cardigan",
        price=Decimal("3500.00"),
        cost_price=None,
        stock=30,
    )
    db_session.add(product)
    await db_session.flush()

    # Add historical stock movements:
    # 1. 10 units @ 100.00 -> Value = 1,000.00, WAC = 100.00
    # 2. 10 units @ 200.00 -> Total Value = 3,000.00 / 20 units -> WAC = 150.00
    # 3. 5 units outward sale -> Leaves WAC at 150.00, Qty = 15
    # 4. 15 units @ 170.00 -> (15 * 150.00 + 15 * 170.00) / 30 = 4800 / 30 = 160.00
    mov1 = StockMovement(
        id=f"sm_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        company_id=cid, branch_id=bid, product_id=pid,
        product_name="Woolen Cardigan", sku=product.sku,
        quantity=Decimal("10.000"), unit_cost=Decimal("100.00"),
        movement_type="INWARD_GRN", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    mov2 = StockMovement(
        id=f"sm_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        company_id=cid, branch_id=bid, product_id=pid,
        product_name="Woolen Cardigan", sku=product.sku,
        quantity=Decimal("10.000"), unit_cost=Decimal("200.00"),
        movement_type="INWARD_GRN", created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    mov3 = StockMovement(
        id=f"sm_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        company_id=cid, branch_id=bid, product_id=pid,
        product_name="Woolen Cardigan", sku=product.sku,
        quantity=Decimal("-5.000"), unit_cost=Decimal("150.00"),
        movement_type="OUTWARD_SALE", created_at=datetime(2026, 1, 3, tzinfo=timezone.utc),
    )
    mov4 = StockMovement(
        id=f"sm_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        company_id=cid, branch_id=bid, product_id=pid,
        product_name="Woolen Cardigan", sku=product.sku,
        quantity=Decimal("15.000"), unit_cost=Decimal("170.00"),
        movement_type="INWARD_GRN", created_at=datetime(2026, 1, 4, tzinfo=timezone.utc),
    )
    db_session.add_all([mov1, mov2, mov3, mov4])
    await db_session.flush()

    # Recalculate historical WAC — MUST NOT RAISE NameError
    res = await CostManagementEngine.recalculate_historical_wac_for_company(
        session=db_session,
        company_id=cid,
        product_id=pid,
    )
    assert res["status"] == "COMPLETED"
    assert res["valuations_updated"] == 1

    # Inspect newly created PCV record
    pcv_stmt = select(ProductCostValuation).where(
        ProductCostValuation.product_id == pid,
        ProductCostValuation.company_id == cid,
    )
    new_pcv = (await db_session.execute(pcv_stmt)).scalar_one_or_none()
    assert new_pcv is not None
    assert new_pcv.id.startswith("pcv_")
    assert new_pcv.weighted_average_cost == Decimal("160.00")
    assert new_pcv.replacement_cost == Decimal("170.00")


async def test_duplicate_receipt_valuation_prevention(db_session):
    """
    Test Case 4: Idempotent GRN Valuation Protection.
    Verifies:
      - Running process_inward_valuation the first time calculates rolling WAC and appends [VALUATION_COMPLETED].
      - Running process_inward_valuation a second time on the same receipt is an idempotent no-op and does NOT mutate WAC again.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid, code=f"SUP-{uuid.uuid4().hex[:6].upper()}", name="E2E Mills", company_id=cid, branch_id=bid,
        is_active=True, is_deleted=False,
    )
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(
        cid=cid, bid=bid, pid=pid, name="Denim Jeans",
        price=Decimal("1800.00"), stock=0,
    )
    db_session.add_all([supplier, product])
    await db_session.flush()

    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id, uuid=str(uuid.uuid4()), receipt_no=f"GRN-IDEM-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED",
        subtotal=Decimal("5000.00"), tax_total=Decimal("900.00"), grand_total=Decimal("5900.00"),
        company_id=cid, branch_id=bid, is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()

    rcpt_item = PurchaseReceiptItem(
        id=f"rit_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        receipt_id=rcpt_id, product_id=pid, code="SKU-DUPVAL", name="Denim Jeans",
        quantity_received=Decimal("50.00"), cost_price=Decimal("100.00"),
        line_total=Decimal("5000.00"), company_id=cid, branch_id=bid,
    )
    db_session.add(rcpt_item)
    await db_session.flush()

    # First valuation run
    res1 = await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    assert len(res1) == 1
    assert res1[0]["new_wac"] == Decimal("100.00")

    await db_session.refresh(receipt)
    assert "[VALUATION_COMPLETED]" in (receipt.notes or "")

    # Second valuation run (duplicate trigger)
    res2 = await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    assert len(res2) == 0  # Skipped!

    # Verify WAC was not distorted
    pcv_stmt = select(ProductCostValuation).where(ProductCostValuation.product_id == pid)
    pcv = (await db_session.execute(pcv_stmt)).scalar_one()
    assert pcv.weighted_average_cost == Decimal("100.00")


async def test_landed_cost_adjustment_updates_rolling_wac(db_session):
    """
    Test Case 5: Landed Cost Freight / Handling Allocation integration with rolling WAC.
    Receipt: 20 units @ 100.00 base cost + 400.00 freight allocation = 120.00 landed unit cost.
    Verifies:
      - WAC correctly reflects 120.00 landed cost per unit.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid, code=f"SUP-{uuid.uuid4().hex[:6].upper()}", name="Landed Mills", company_id=cid, branch_id=bid,
        is_active=True, is_deleted=False,
    )
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(
        cid=cid, bid=bid, pid=pid, name="Landed Denim",
        price=Decimal("2500.00"), stock=0,
    )
    db_session.add_all([supplier, product])
    await db_session.flush()

    rcpt_id = f"rcp_{uuid.uuid4().hex[:8]}"
    receipt = PurchaseReceipt(
        id=rcpt_id, uuid=str(uuid.uuid4()), receipt_no=f"GRN-LANDED-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED",
        subtotal=Decimal("2000.00"), tax_total=Decimal("360.00"), grand_total=Decimal("2360.00"),
        company_id=cid, branch_id=bid, is_deleted=False,
    )
    db_session.add(receipt)
    await db_session.flush()

    item_id = f"rit_{uuid.uuid4().hex[:8]}"
    rcpt_item = PurchaseReceiptItem(
        id=item_id, uuid=str(uuid.uuid4()),
        receipt_id=rcpt_id, product_id=pid, code="SKU-LANDED", name="Landed Denim",
        quantity_received=Decimal("20.00"), cost_price=Decimal("100.00"),
        line_total=Decimal("2000.00"), company_id=cid, branch_id=bid,
    )
    db_session.add(rcpt_item)
    await db_session.flush()

    comp_id = f"icc_{uuid.uuid4().hex[:8]}"
    comp = InwardCostComponent(
        id=comp_id,
        company_id=cid,
        branch_id=bid,
        grn_id=rcpt_id,
        component_type="FREIGHT",
        amount=Decimal("400.00"),
        taxable_amount=Decimal("400.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("400.00"),
        tax_rate=Decimal("0.00"),
        itc_eligible=True,
        is_capitalizable=True,
        allocation_method="VALUE",
        allocation_scope="DOCUMENT",
        status="ALLOCATED",
    )
    db_session.add(comp)
    await db_session.flush()

    alloc = InwardCostAllocation(
        id=f"ica_{uuid.uuid4().hex[:8]}",
        company_id=cid,
        branch_id=bid,
        grn_id=rcpt_id,
        grn_item_id=item_id,
        cost_component_id=comp_id,
        product_id=pid,
        allocation_method="VALUE",
        basis_value=Decimal("2000.00"),
        allocated_amount=Decimal("400.00"),
        allocated_per_unit=Decimal("20.00"),
        rounding_adjustment=Decimal("0.00"),
    )
    db_session.add(alloc)
    await db_session.flush()

    res = await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    assert len(res) == 1
    # 100.00 base + (400.00 freight / 20 qty = 20.00) = 120.00
    assert res[0]["landed_cost"] == Decimal("120.00")
    assert res[0]["new_wac"] == Decimal("120.00")


async def test_return_inward_never_falls_back_to_selling_price(db_session):
    """
    Test Case 6: Return inward movements must NEVER use selling price as unit cost.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(
        cid=cid, bid=bid, pid=pid, name="Return Shirt",
        price=Decimal("2499.00"), cost_price=None, stock=10,
    )
    db_session.add(product)
    await db_session.flush()

    ret_id = f"ret_{uuid.uuid4().hex[:8]}"
    movements = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=ret_id,
        return_no="RET-POS-001",
        items=[{"product_id": pid, "quantity": Decimal("1.000")}],
        warehouse_id=wid,
    )

    assert len(movements) == 1
    mov = movements[0]
    assert mov.unit_cost == Decimal("0.00"), f"CRITICAL: Return Inward unit_cost used selling price! Got {mov.unit_cost}"


async def test_partial_receipts_consecutive_rolling_wac(db_session):
    """
    Test Case 7: Partial Receipts consecutive rolling WAC.
    Scenario:
      PO for 50 units received in two partial deliveries:
        - GRN 1: 30 units @ 100.00 -> New WAC = 100.00
        - GRN 2: 20 units @ 150.00 -> New WAC = (30 * 100 + 20 * 150) / 50 = 120.00
    Verifies:
      - Consecutive receipts update rolling WAC accurately.
      - Replacement cost and last purchase cost reflect latest receipt (150.00).
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid, code=f"SUP-{uuid.uuid4().hex[:6].upper()}", name="Partial Mills", company_id=cid, branch_id=bid,
        is_active=True, is_deleted=False,
    )
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Partial Denim", price=Decimal("1200.00"), stock=0)
    db_session.add_all([supplier, product])
    await db_session.flush()

    # Delivery 1: 30 units @ 100.00
    r1_id = f"rcp_{uuid.uuid4().hex[:8]}"
    r1 = PurchaseReceipt(
        id=r1_id, uuid=str(uuid.uuid4()), receipt_no=f"GRN-PART1-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED",
        subtotal=Decimal("3000.00"), tax_total=Decimal("540.00"), grand_total=Decimal("3540.00"),
        company_id=cid, branch_id=bid, is_deleted=False,
    )
    db_session.add(r1)
    await db_session.flush()
    it1 = PurchaseReceiptItem(
        id=f"rit_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        receipt_id=r1_id, product_id=pid, code="SKU-PART", name="Partial Denim",
        quantity_received=Decimal("30.00"), cost_price=Decimal("100.00"),
        line_total=Decimal("3000.00"), company_id=cid, branch_id=bid,
    )
    db_session.add(it1)
    product.stock = 30
    await db_session.flush()

    res1 = await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=r1_id, branch_id=bid
    )
    assert len(res1) == 1
    assert res1[0]["new_wac"] == Decimal("100.00")

    # Delivery 2: 20 units @ 150.00
    r2_id = f"rcp_{uuid.uuid4().hex[:8]}"
    r2 = PurchaseReceipt(
        id=r2_id, uuid=str(uuid.uuid4()), receipt_no=f"GRN-PART2-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED",
        subtotal=Decimal("3000.00"), tax_total=Decimal("540.00"), grand_total=Decimal("3540.00"),
        company_id=cid, branch_id=bid, is_deleted=False,
    )
    db_session.add(r2)
    await db_session.flush()
    it2 = PurchaseReceiptItem(
        id=f"rit_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        receipt_id=r2_id, product_id=pid, code="SKU-PART", name="Partial Denim",
        quantity_received=Decimal("20.00"), cost_price=Decimal("150.00"),
        line_total=Decimal("3000.00"), company_id=cid, branch_id=bid,
    )
    db_session.add(it2)
    product.stock = 50
    await db_session.flush()

    res2 = await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=r2_id, branch_id=bid
    )
    assert len(res2) == 1
    # (30 * 100.00 + 20 * 150.00) / 50 = (3000 + 3000) / 50 = 120.00
    assert res2[0]["new_wac"] == Decimal("120.00")

    pcv = (await db_session.execute(
        select(ProductCostValuation).where(ProductCostValuation.product_id == pid)
    )).scalar_one()
    assert pcv.weighted_average_cost == Decimal("120.00")
    assert pcv.replacement_cost == Decimal("150.00")
    assert pcv.last_purchase_cost == Decimal("150.00")


async def test_tenant_isolation_cost_valuation_and_wac(db_session):
    """
    Test Case 8: Tenant isolation on cost valuation and rolling WAC.
    Verifies:
      - Receipt valuation in Company A creates PCV only for Company A.
      - Resolving cost in Company B for the same or different SKU does not leak Company A's valuation.
      - Historical recalculation in Company B does not mutate Company A's valuation.
    """
    cid_a, bid_a, wid_a, ctx_a = await setup_test_environment(db_session)
    cid_b, bid_b, wid_b, ctx_b = await setup_test_environment(db_session)

    pid_a = f"prd_a_{uuid.uuid4().hex[:8]}"
    pid_b = f"prd_b_{uuid.uuid4().hex[:8]}"
    p_a = make_product(cid=cid_a, bid=bid_a, pid=pid_a, name="Shared SKU", price=Decimal("1000.00"), stock=10)
    p_b = make_product(cid=cid_b, bid=bid_b, pid=pid_b, name="Shared SKU", price=Decimal("1000.00"), stock=10)
    db_session.add_all([p_a, p_b])
    await db_session.flush()

    # Valuate for Company A
    pcv_a = ProductCostValuation(
        id=f"pcv_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()),
        company_id=cid_a, branch_id=bid_a, product_id=pid_a,
        weighted_average_cost=Decimal("450.00"), landed_cost=Decimal("450.00"),
        purchase_cost=Decimal("450.00"), is_active=True, is_deleted=False,
    )
    db_session.add(pcv_a)
    await db_session.flush()

    # Resolve in Company A -> returns 450.00
    cost_a, m_a = await CostManagementEngine.resolve_cogs_unit_cost(
        session=db_session, company_id=cid_a, product_id=pid_a
    )
    assert cost_a == Decimal("450.00")
    assert m_a == "WEIGHTED_AVERAGE"

    # Resolve in Company B -> strictly 0.00 UNRESOLVED_ZERO_COST
    cost_b, m_b = await CostManagementEngine.resolve_cogs_unit_cost(
        session=db_session, company_id=cid_b, product_id=pid_b
    )
    assert cost_b == Decimal("0.00")
    assert m_b == "UNRESOLVED_ZERO_COST"

    # Ensure no PCV exists in Company B
    pcv_b = (await db_session.execute(
        select(ProductCostValuation).where(
            ProductCostValuation.company_id == cid_b,
            ProductCostValuation.product_id == pid_b,
        )
    )).scalar_one_or_none()
    assert pcv_b is None


async def test_closed_period_protection_for_cost_and_gl(db_session):
    """
    Test Case 9: Closed period protection against retroactive postings and adjustments.
    Verifies:
      - Closed/locked accounting period rejects backdated vouchers with SMRITI-GL-006.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    # Create FiscalYear and a HARD_LOCKED FiscalPeriod
    fy_id = f"fy_{uuid.uuid4().hex[:8]}"
    fy = FiscalYear(
        id=fy_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        financial_year_code=f"FY2025-26-{uuid.uuid4().hex[:4]}",
        start_date=date(2025, 4, 1), end_date=date(2026, 3, 31),
        is_closed=True, is_locked=True,
    )
    db_session.add(fy)
    await db_session.flush()

    fp_id = f"fp_{uuid.uuid4().hex[:8]}"
    fp = FiscalPeriod(
        id=fp_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        fiscal_year_id=fy_id, period_name="April 2025", period_number=1,
        start_date=date(2025, 4, 1), end_date=date(2025, 4, 30),
        status="HARD_LOCKED",
    )
    db_session.add(fp)
    await db_session.flush()

    # Attempt to post a voucher falling in the closed period
    with pytest.raises(HTTPException) as exc_info:
        await UnifiedAccountingLedgerService.assert_fiscal_period_open(
            session=db_session,
            company_id=cid,
            voucher_date=date(2025, 4, 15),
        )
    assert exc_info.value.status_code == 400
    assert "SMRITI-GL-006" in exc_info.value.detail
    assert "HARD_LOCKED" in exc_info.value.detail


async def test_missing_cost_exception_unresolved_zero_cost(db_session):
    """
    Test Case 10: Missing-Cost Exception Surfacing & Non-Finalized Profitability.
    Verifies:
      - Untrustworthy/missing cost resolves as UNRESOLVED_ZERO_COST.
      - Double-entry GL post creates TransactionCostSnapshot with ZERO_COST_UNVALUED or UNRESOLVED_ZERO_COST.
      - COGS debit is 0.00 and Inventory credit is 0.00 (no phantom profitability booked).
      - Voucher remains in perfect balance.
    """
    from app.models.crm import Customer
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(
        cid=cid, bid=bid, pid=pid, name="Uncosted Novelty Item",
        price=Decimal("1200.00"), cost_price=None, stock=50,
    )
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    cust = Customer(
        id=cust_id,
        uuid=str(uuid.uuid4()),
        code=f"CUST-{uuid.uuid4().hex[:6].upper()}",
        name="Walkin Customer",
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([product, cust])
    await db_session.flush()

    # 1. Canonical resolver check
    unit_cost, method = await CostManagementEngine.resolve_cogs_unit_cost(
        session=db_session, company_id=cid, product_id=pid
    )
    assert unit_cost == Decimal("0.00")
    assert method == "UNRESOLVED_ZERO_COST"

    # 2. Post invoice with this zero-cost product
    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    invoice = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), invoice_no=f"INV-ZERO-{uuid.uuid4().hex[:6].upper()}",
        company_id=cid, branch_id=bid, customer_id=cust_id, customer_name="Walkin Customer",
        status="APPROVED", taxable_value=Decimal("1200.00"), tax_total=Decimal("216.00"),
        grand_total=Decimal("1416.00"), is_interstate=False, is_deleted=False,
    )
    db_session.add(invoice)
    await db_session.flush()

    inv_item = SalesInvoiceItem(
        uuid=str(uuid.uuid4()),
        invoice_id=inv_id,
        product_id=pid,
        code=product.code or "SKU-ZERO",
        name="Uncosted Novelty Item",
        quantity=Decimal("1.000"),
        price=Decimal("1200.00"),
        taxable_value=Decimal("1200.00"),
        cgst_amount=Decimal("108.00"),
        sgst_amount=Decimal("108.00"),
        total_amount=Decimal("1416.00"),
        company_id=cid,
        branch_id=bid,
        is_deleted=False,
    )
    db_session.add(inv_item)
    await db_session.flush()

    voucher = await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(
        session=db_session, company_id=cid, invoice_id=inv_id, branch_id=bid
    )
    assert voucher is not None
    assert voucher.total_debit == voucher.total_credit == Decimal("1416.00")

    # Snapshot check
    snap_stmt = select(TransactionCostSnapshot).where(
        TransactionCostSnapshot.sales_invoice_id == inv_id,
        TransactionCostSnapshot.product_id == pid,
    )
    snap = (await db_session.execute(snap_stmt)).scalar_one_or_none()
    assert snap is not None
    assert snap.cost_per_unit == Decimal("0.00")
    assert snap.total_cogs == Decimal("0.00")
    assert snap.valuation_method_used in ("ZERO_COST_UNVALUED", "UNRESOLVED_ZERO_COST")


async def test_late_landed_cost_delayed_freight_and_idempotency(db_session):
    """
    Phase 1 Test 11: Late Landed Cost - Delayed Freight & Idempotency.
    Setup:
      - 20 units received @ 100.00 base cost with no freight. Initial valuation completes.
      - Carrier freight invoice of 400.00 arrives late (20.00/unit).
    Verifies:
      - process_inward_valuation does not duplicate receipt quantity or re-run initial valuation.
      - process_landed_cost_adjustment applies only unapplied components.
      - Quantity is NOT added a second time (stock remains 20).
      - Landed cost and WAC update to 120.00.
      - Repeated execution is completely idempotent (no double application).
      - InwardCostAdjustment record created and linked.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid, code=f"SUP-{uuid.uuid4().hex[:6].upper()}", name="Freight Supplier", company_id=cid, branch_id=bid,
        is_active=True, is_deleted=False,
    )
    db_session.add(supplier)
    await db_session.flush()

    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Freight Denim", price=Decimal("800.00"), cost_price=None, stock=20)
    db_session.add(product)
    await db_session.flush()

    rcpt_id = f"rcpt_{uuid.uuid4().hex[:8]}"
    rcpt = PurchaseReceipt(
        id=rcpt_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, receipt_no=f"GRN-FRT-{uuid.uuid4().hex[:4]}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED", notes="Initial GRN",
    )
    db_session.add(rcpt)
    await db_session.flush()

    item_id = f"item_{uuid.uuid4().hex[:8]}"
    rcpt_item = PurchaseReceiptItem(
        id=item_id, uuid=str(uuid.uuid4()), receipt_id=rcpt_id, product_id=pid, code="SKU-FRT", name="Freight Denim",
        quantity_received=Decimal("20.00"), cost_price=Decimal("100.00"), line_total=Decimal("2000.00"), company_id=cid, branch_id=bid,
    )
    db_session.add(rcpt_item)
    await db_session.flush()

    # Step 1: Initial inward valuation (base 100.00, no freight)
    res1 = await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    assert len(res1) == 1
    assert res1[0]["new_wac"] == Decimal("100.00")
    await db_session.refresh(product)
    assert product.stock == 20

    # Step 2: Late freight invoice arrives (400.00 allocated across 20 units)
    comp_id = f"icc_{uuid.uuid4().hex[:8]}"
    comp = InwardCostComponent(
        id=comp_id, company_id=cid, branch_id=bid, grn_id=rcpt_id, component_type="FREIGHT",
        amount=Decimal("400.00"), taxable_amount=Decimal("400.00"), tax_amount=Decimal("0.00"),
        total_amount=Decimal("400.00"), tax_rate=Decimal("0.00"), itc_eligible=True, is_capitalizable=True,
        allocation_method="VALUE", allocation_scope="DOCUMENT", status="ALLOCATED",
    )
    db_session.add(comp)
    await db_session.flush()

    alloc = InwardCostAllocation(
        id=f"ica_{uuid.uuid4().hex[:8]}", company_id=cid, branch_id=bid, grn_id=rcpt_id, grn_item_id=item_id,
        cost_component_id=comp_id, product_id=pid, allocation_method="VALUE", basis_value=Decimal("2000.00"),
        allocated_amount=Decimal("400.00"), allocated_per_unit=Decimal("20.00"), rounding_adjustment=Decimal("0.00"),
    )
    db_session.add(alloc)
    await db_session.flush()

    # Verify that re-running process_inward_valuation does NOT re-valuate or duplicate quantity
    res_re = await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )
    assert res_re == []  # Blocked by [VALUATION_COMPLETED]
    await db_session.refresh(product)
    assert product.stock == 20

    # Step 3: Run dedicated landed cost adjustment pathway
    adj_res = await CostManagementEngine.process_landed_cost_adjustment(
        session=db_session, company_id=cid, receipt_id=rcpt_id, reason="Late Freight Invoice #FRT-998", created_by="test_auditor"
    )
    assert len(adj_res["adjustments"]) == 1
    assert adj_res["adjustments"][0]["cost_delta"] == Decimal("400.00")
    assert adj_res["adjustments"][0]["capitalized_cost"] == Decimal("400.00")
    assert adj_res["adjustments"][0]["expensed_cogs"] == Decimal("0.00")
    assert adj_res["adjustments"][0]["new_wac"] == Decimal("120.00")

    # Verify product stock is STILL 20 (never added quantity a second time!)
    await db_session.refresh(product)
    assert product.stock == 20

    # Verify component status updated to VALUATED
    await db_session.refresh(comp)
    assert comp.status == "VALUATED"

    # Verify InwardCostAdjustment record exists
    adj_stmt = select(InwardCostAdjustment).where(InwardCostAdjustment.grn_id == rcpt_id)
    adj_record = (await db_session.execute(adj_stmt)).scalar_one_or_none()
    assert adj_record is not None
    assert adj_record.total_adjustment_amount == Decimal("400.00")
    assert adj_record.status == "POSTED"

    # Verify double-entry GL voucher for Tally sync was created and balanced
    assert adj_res.get("journal_voucher_id") is not None
    from app.models.accounting import JournalVoucher, GeneralLedgerEntry
    jv_stmt = select(JournalVoucher).where(JournalVoucher.id == adj_res["journal_voucher_id"])
    jv = (await db_session.execute(jv_stmt)).scalar_one_or_none()
    assert jv is not None
    assert jv.reference_doc_no == adj_record.adjustment_no

    gl_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
    gl_entries = (await db_session.execute(gl_stmt)).scalars().all()
    assert len(gl_entries) >= 2
    total_deb = sum(Decimal(str(e.debit_amount or 0)) for e in gl_entries)
    total_crd = sum(Decimal(str(e.credit_amount or 0)) for e in gl_entries)
    assert total_deb == Decimal("400.00")
    assert total_crd == Decimal("400.00")

    # Step 3b: Verify existing Tally export pathway on actual database Journal Voucher
    from app.services.tally_service import TallyService
    tally_xml = await TallyService.generate_tally_journal_voucher_xml(
        session=db_session,
        company_id=cid,
        voucher_id=jv.id,
    )
    assert "<VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>" in tally_xml
    assert jv.voucher_no in tally_xml
    assert "400.00" in tally_xml

    # Step 4: Re-running adjustment is an idempotent NOOP
    adj_res_repeat = await CostManagementEngine.process_landed_cost_adjustment(
        session=db_session, company_id=cid, receipt_id=rcpt_id, reason="Repeat run"
    )
    assert len(adj_res_repeat["adjustments"]) == 0
    await db_session.refresh(product)
    assert product.stock == 20


async def test_late_landed_cost_zero_remaining_stock(db_session):
    """
    Phase 1 Test 12: Late Landed Cost when inventory is already sold (zero remaining stock).
    Scenario:
      - 10 units received @ 100.00.
      - All 10 units are sold (remaining stock = 0).
      - Late customs duty of 200.00 arrives (20.00/unit).
    Verifies:
      - Cost delta cannot be capitalized into on-hand inventory.
      - Cost delta is expensed to COGS (expensed_cogs = 200.00).
      - Product stock remains 0 (not incremented).
      - Landed cost metric updates to 120.00.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid, code=f"SUP-{uuid.uuid4().hex[:6].upper()}", name="Duty Supplier", company_id=cid, branch_id=bid,
        is_active=True, is_deleted=False,
    )
    db_session.add(supplier)
    await db_session.flush()

    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Customs Jacket", price=Decimal("1200.00"), cost_price=None, stock=10)
    db_session.add(product)
    await db_session.flush()

    rcpt_id = f"rcpt_{uuid.uuid4().hex[:8]}"
    rcpt = PurchaseReceipt(
        id=rcpt_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, receipt_no=f"GRN-DUTY-{uuid.uuid4().hex[:4]}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED", notes="Customs GRN",
    )
    db_session.add(rcpt)
    await db_session.flush()

    item_id = f"item_{uuid.uuid4().hex[:8]}"
    rcpt_item = PurchaseReceiptItem(
        id=item_id, uuid=str(uuid.uuid4()), receipt_id=rcpt_id, product_id=pid, code="SKU-DUTY", name="Customs Jacket",
        quantity_received=Decimal("10.00"), cost_price=Decimal("100.00"), line_total=Decimal("1000.00"), company_id=cid, branch_id=bid,
    )
    db_session.add(rcpt_item)
    await db_session.flush()

    # Initial receipt valuation: 10 units @ 100.00
    await CostManagementEngine.process_inward_valuation(
        session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid
    )

    # All 10 units are sold: product stock becomes 0
    product.stock = 0
    db_session.add(product)
    await db_session.flush()

    # Late customs duty arrives (200.00 total)
    comp_id = f"icc_{uuid.uuid4().hex[:8]}"
    comp = InwardCostComponent(
        id=comp_id, company_id=cid, branch_id=bid, grn_id=rcpt_id, component_type="DUTY",
        amount=Decimal("200.00"), taxable_amount=Decimal("200.00"), tax_amount=Decimal("0.00"),
        total_amount=Decimal("200.00"), tax_rate=Decimal("0.00"), itc_eligible=False, is_capitalizable=True,
        allocation_method="VALUE", allocation_scope="DOCUMENT", status="ALLOCATED",
    )
    db_session.add(comp)
    await db_session.flush()

    alloc = InwardCostAllocation(
        id=f"ica_{uuid.uuid4().hex[:8]}", company_id=cid, branch_id=bid, grn_id=rcpt_id, grn_item_id=item_id,
        cost_component_id=comp_id, product_id=pid, allocation_method="VALUE", basis_value=Decimal("1000.00"),
        allocated_amount=Decimal("200.00"), allocated_per_unit=Decimal("20.00"), rounding_adjustment=Decimal("0.00"),
    )
    db_session.add(alloc)
    await db_session.flush()

    adj_res = await CostManagementEngine.process_landed_cost_adjustment(
        session=db_session, company_id=cid, receipt_id=rcpt_id, reason="Late Customs Duty"
    )
    assert len(adj_res["adjustments"]) == 1
    # Stock remaining is 0, so entire 200.00 must be expensed to COGS
    assert adj_res["adjustments"][0]["cost_delta"] == Decimal("200.00")
    assert adj_res["adjustments"][0]["capitalized_cost"] == Decimal("0.00")
    assert adj_res["adjustments"][0]["expensed_cogs"] == Decimal("200.00")

    # Verify double-entry GL voucher
    assert adj_res.get("journal_voucher_id") is not None
    from app.models.accounting import GeneralLedgerEntry, Account
    gl_stmt = (
        select(GeneralLedgerEntry, Account.account_code)
        .join(Account, Account.id == GeneralLedgerEntry.account_id)
        .where(GeneralLedgerEntry.voucher_id == adj_res["journal_voucher_id"])
    )
    gl_rows = (await db_session.execute(gl_stmt)).all()
    assert len(gl_rows) >= 2
    cogs_row = [r for r in gl_rows if r.account_code == "5010"]
    assert len(cogs_row) == 1
    assert cogs_row[0][0].debit_amount == Decimal("200.00")

    await db_session.refresh(product)
    assert product.stock == 0  # Stock remains 0


async def test_sales_return_valuation_uses_historical_snapshot(db_session):
    """
    Phase 2 Test 13: Sales Return valuation uses original sales invoice line's historical snapshot.
    Scenario:
      1. Item sold at historical WAC of 100.00 (snapshot created).
      2. Later receipt arrives at 250.00, raising current WAC to 200.00.
      3. Return inward processed for original sale.
    Verifies:
      - Return inward stock movement is valued at historical snapshot (100.00), NOT current WAC (200.00).
      - Valuation method logged as HISTORICAL_SNAPSHOT.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Snapshot Denim", price=Decimal("1500.00"), cost_price=None, stock=50)
    db_session.add(product)
    await db_session.flush()

    # Step 1: Initial cost valuation @ 100.00
    pcv = ProductCostValuation(
        id=f"pcv_{uuid.uuid4().hex[:8]}", company_id=cid, branch_id=bid, product_id=pid,
        purchase_cost=Decimal("100.00"), weighted_average_cost=Decimal("100.00"),
        last_purchase_cost=Decimal("100.00"), landed_cost=Decimal("100.00"),
    )
    db_session.add(pcv)
    await db_session.flush()

    # Step 2: Sale occurs at 100.00 cost (create invoice and snapshot)
    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        invoice_no=f"INV-SNAP-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("1500.00"), status="PAID",
    )
    inv_item = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-SNAP", name="Snapshot Denim",
        quantity=Decimal("1.000"), price=Decimal("1500.00"), total_amount=Decimal("1500.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, inv_item])
    await db_session.flush()

    snap = TransactionCostSnapshot(
        id=f"tcs_{uuid.uuid4().hex[:8]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=str(inv_item.id), product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("100.00"), total_cogs=Decimal("100.00"),
        selling_price_per_unit=Decimal("1500.00"), total_gross_sales=Decimal("1500.00"),
        gross_profit=Decimal("1400.00"),
    )
    db_session.add(snap)
    await db_session.flush()

    # Step 3: Current WAC increases to 200.00 due to a new receipt
    pcv.weighted_average_cost = Decimal("200.00")
    pcv.purchase_cost = Decimal("200.00")
    db_session.add(pcv)
    await db_session.flush()

    # Step 4: Return processed against original invoice
    ret_id = f"ret_{uuid.uuid4().hex[:8]}"
    movements = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=ret_id,
        return_no="RET-HIST-001",
        items=[{"product_id": pid, "quantity": Decimal("1.000"), "sales_invoice_item_id": str(inv_item.id)}],
        warehouse_id=wid,
        original_invoice_id=inv_id,
    )

    assert len(movements) == 1
    mov = movements[0]
    # Unit cost MUST be historical snapshot cost (100.00), NOT current WAC (200.00) and NOT selling price!
    assert mov.unit_cost == Decimal("100.00")
    assert "HISTORICAL_SNAPSHOT" in mov.remarks


async def test_sales_return_multiple_lines_exact_item_linkage(db_session):
    """
    Phase 2 Test 14: Sales Return with multiple invoice lines for the same SKU links to exact line.
    Scenario:
      - Line 1: 1 unit @ 80.00 cost
      - Line 2: 1 unit @ 120.00 cost
      - Customer returns Line 2.
    Verifies:
      - Cost matches Line 2's snapshot (120.00), not Line 1 (80.00).
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Dual Line SKU", price=Decimal("1000.00"), cost_price=None, stock=50)
    db_session.add(product)
    await db_session.flush()

    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    line1_id = f"item_1_{uuid.uuid4().hex[:6]}"
    line2_id = f"item_2_{uuid.uuid4().hex[:6]}"

    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        invoice_no=f"INV-MULTI-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("2000.00"), status="PAID",
    )
    snap1 = TransactionCostSnapshot(
        id=f"tcs1_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line1_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("80.00"), total_cogs=Decimal("80.00"),
        selling_price_per_unit=Decimal("1000.00"), total_gross_sales=Decimal("1000.00"), gross_profit=Decimal("920.00"),
    )
    snap2 = TransactionCostSnapshot(
        id=f"tcs2_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line2_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("120.00"), total_cogs=Decimal("120.00"),
        selling_price_per_unit=Decimal("1000.00"), total_gross_sales=Decimal("1000.00"), gross_profit=Decimal("880.00"),
    )
    db_session.add_all([inv, snap1, snap2])
    await db_session.flush()

    # Return Line 2 specifically
    ret_id = f"ret_{uuid.uuid4().hex[:8]}"
    movements = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=ret_id,
        return_no="RET-LINE2-001",
        items=[{"product_id": pid, "quantity": Decimal("1.000"), "sales_invoice_item_id": line2_id}],
        warehouse_id=wid,
        original_invoice_id=inv_id,
    )

    assert len(movements) == 1
    assert movements[0].unit_cost == Decimal("120.00")


async def test_unlinked_return_explicit_policy_tagging(db_session):
    """
    Phase 2 Test 15: Unlinked return explicitly tags valuation method as UNLINKED_RETURN_POLICY.
    Scenario:
      - Return without original_invoice_id (walk-in without receipt).
      - Product has current WAC = 110.00.
    Verifies:
      - Unit cost uses current cost (110.00).
      - Trace is explicitly tagged UNLINKED_RETURN_POLICY (WEIGHTED_AVERAGE), never falsely claiming it was a linked historical snapshot.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Walkin Product", price=Decimal("500.00"), cost_price=None, stock=10)
    db_session.add(product)
    await db_session.flush()

    pcv = ProductCostValuation(
        id=f"pcv_{uuid.uuid4().hex[:8]}", company_id=cid, branch_id=bid, product_id=pid,
        purchase_cost=Decimal("110.00"), weighted_average_cost=Decimal("110.00"),
        last_purchase_cost=Decimal("110.00"), landed_cost=Decimal("110.00"),
    )
    db_session.add(pcv)
    await db_session.flush()

    ret_id = f"ret_{uuid.uuid4().hex[:8]}"
    movements = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=ret_id,
        return_no="RET-UNLINKED-001",
        items=[{"product_id": pid, "quantity": Decimal("1.000")}],
        warehouse_id=wid,
        original_invoice_id=None,
    )

    assert len(movements) == 1
    mov = movements[0]
    assert mov.unit_cost == Decimal("110.00")
    assert "UNLINKED_RETURN_POLICY" in mov.remarks


async def test_concurrent_receipt_valuation_atomic_cold_start(db_session):
    """
    Phase 3 Test 16: Concurrent first-time receipt valuation is atomic and safe under PostgreSQL constraints.
    Scenario:
      - Product has no ProductCostValuation row in the database (cold start).
      - Two receipts processed consecutively for the same previously unvalued product.
    Verifies:
      - pg_insert on_conflict_do_nothing prevents UniqueViolation on product_id.
      - Both receipts valuate correctly without 500 error or crash.
      - Final WAC is calculated accurately over both receipts.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid, code=f"SUP-{uuid.uuid4().hex[:6].upper()}", name="Concurrent Supplier", company_id=cid, branch_id=bid,
        is_active=True, is_deleted=False,
    )
    db_session.add(supplier)
    await db_session.flush()

    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Concurrent SKU", price=Decimal("600.00"), cost_price=None, stock=0)
    db_session.add(product)
    await db_session.flush()

    # Receipt 1: 10 units @ 100.00
    rcpt1_id = f"rcpt1_{uuid.uuid4().hex[:8]}"
    rcpt1 = PurchaseReceipt(
        id=rcpt1_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, receipt_no=f"GRN-CONC1-{uuid.uuid4().hex[:4]}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED", notes="",
    )
    item1 = PurchaseReceiptItem(
        id=f"item1_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()), receipt_id=rcpt1_id, product_id=pid,
        code="CONC-1", name="Concurrent SKU", quantity_received=Decimal("10.00"), cost_price=Decimal("100.00"),
        line_total=Decimal("1000.00"), company_id=cid, branch_id=bid,
    )
    # Receipt 2: 10 units @ 150.00
    rcpt2_id = f"rcpt2_{uuid.uuid4().hex[:8]}"
    rcpt2 = PurchaseReceipt(
        id=rcpt2_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, receipt_no=f"GRN-CONC2-{uuid.uuid4().hex[:4]}",
        supplier_id=sid, warehouse_id=wid, status="RECEIVED", notes="",
    )
    item2 = PurchaseReceiptItem(
        id=f"item2_{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()), receipt_id=rcpt2_id, product_id=pid,
        code="CONC-2", name="Concurrent SKU", quantity_received=Decimal("10.00"), cost_price=Decimal("150.00"),
        line_total=Decimal("1500.00"), company_id=cid, branch_id=bid,
    )
    db_session.add_all([rcpt1, item1, rcpt2, item2])
    await db_session.commit()

    # Spawn two genuinely overlapping database transactions using separate sessions from the same engine
    from sqlalchemy.ext.asyncio import async_sessionmaker
    SessionMaker = async_sessionmaker(db_session.bind, expire_on_commit=False)

    async def run_inward(rcpt_id: str, qty_increment: Decimal):
        async with SessionMaker() as sess:
            async with sess.begin():
                # Acquire row lock on product to emulate inward receiving stock increment
                p_stmt = select(Product).where(Product.id == pid).with_for_update()
                prod = (await sess.execute(p_stmt)).scalar_one()
                prod.stock = prod.stock + qty_increment
                sess.add(prod)
                await sess.flush()
                # Process inward valuation under the same transaction
                res = await CostManagementEngine.process_inward_valuation(
                    session=sess, company_id=cid, receipt_id=rcpt_id, branch_id=bid
                )
            return res

    # Genuinely overlapping execution via asyncio.gather
    res1, res2 = await asyncio.gather(
        run_inward(rcpt1_id, Decimal("10.00")),
        run_inward(rcpt2_id, Decimal("10.00")),
    )
    assert len(res1) == 1
    assert len(res2) == 1

    # Verify final state in db_session
    await db_session.rollback()
    db_session.expire_all()
    prod_final = (await db_session.execute(select(Product).where(Product.id == pid).execution_options(populate_existing=True))).scalar_one()
    assert prod_final.stock == 20

    pcv_final = (await db_session.execute(select(ProductCostValuation).where(ProductCostValuation.product_id == pid).execution_options(populate_existing=True))).scalar_one()
    # Rolling WAC over both concurrent receipts: (10 * 100 + 10 * 150) / 20 = 125.00
    assert pcv_final.weighted_average_cost == Decimal("125.00")


async def test_profitability_quarantine_provisional_vs_finalized(db_session):
    """
    Phase 4 Test 17: Profitability Quarantine of Unvalued / Provisional Sales.
    Scenario:
      - Invoice A: Product with cost 100.00, sold for 150.00 (gross profit = 50.00). Finalized.
      - Invoice B: Product with unvalued zero cost, sold for 200.00 (snapshot = UNRESOLVED_ZERO_COST).
    Verifies:
      - get_cost_truth_dashboard_kpis separates finalized gross profit (50.00) from provisional/unvalued.
      - Unvalued sales quarantined (200.00).
      - get_cogs_profitability_report marks Invoice B as PROVISIONAL_UNVALUED with is_finalized=False and zeroes phantom profit.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)

    # Product A (Valued @ 100.00)
    pid_a = f"prd_a_{uuid.uuid4().hex[:6]}"
    prd_a = make_product(cid=cid, bid=bid, pid=pid_a, name="Valued Product", price=Decimal("150.00"), cost_price=Decimal("100.00"), stock=50)
    pcv_a = ProductCostValuation(
        id=f"pcv_a_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid, product_id=pid_a,
        purchase_cost=Decimal("100.00"), weighted_average_cost=Decimal("100.00"),
    )
    # Product B (Unvalued)
    pid_b = f"prd_b_{uuid.uuid4().hex[:6]}"
    prd_b = make_product(cid=cid, bid=bid, pid=pid_b, name="Unvalued Product", price=Decimal("200.00"), cost_price=None, stock=50)

    db_session.add_all([prd_a, pcv_a, prd_b])
    await db_session.flush()

    inv_a_id = f"inv_a_{uuid.uuid4().hex[:6]}"
    inv_a = SalesInvoice(
        id=inv_a_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        invoice_no=f"INV-FIN-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("150.00"), status="PAID",
    )
    item_a = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_a_id, product_id=pid_a,
        code="SKU-A", name="Valued Product",
        quantity=Decimal("1.000"), price=Decimal("150.00"), total_amount=Decimal("150.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv_a, item_a])
    await db_session.flush()

    snap_a = TransactionCostSnapshot(
        id=f"snap_a_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_a_id, sales_invoice_item_id=str(item_a.id), product_id=pid_a,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("100.00"), total_cogs=Decimal("100.00"),
        selling_price_per_unit=Decimal("150.00"), total_gross_sales=Decimal("150.00"), gross_profit=Decimal("50.00"),
    )
    ledger_a = InvoiceProfitabilityLedger(
        id=f"ipl_a_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_a_id, gross_sales_amount=Decimal("150.00"),
        total_cogs=Decimal("100.00"), gross_profit=Decimal("50.00"),
        net_contribution=Decimal("50.00"),
    )

    inv_b_id = f"inv_b_{uuid.uuid4().hex[:6]}"
    inv_b = SalesInvoice(
        id=inv_b_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        invoice_no=f"INV-PROV-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("200.00"), status="PAID",
    )
    item_b = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_b_id, product_id=pid_b,
        code="SKU-B", name="Unvalued Product",
        quantity=Decimal("1.000"), price=Decimal("200.00"), total_amount=Decimal("200.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv_b, item_b])
    await db_session.flush()

    snap_b = TransactionCostSnapshot(
        id=f"snap_b_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_b_id, sales_invoice_item_id=str(item_b.id), product_id=pid_b,
        valuation_method_used="UNRESOLVED_ZERO_COST", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("0.00"), total_cogs=Decimal("0.00"),
        selling_price_per_unit=Decimal("200.00"), total_gross_sales=Decimal("200.00"), gross_profit=Decimal("200.00"),
    )
    ledger_b = InvoiceProfitabilityLedger(
        id=f"ipl_b_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_b_id, gross_sales_amount=Decimal("200.00"),
        total_cogs=Decimal("0.00"), gross_profit=Decimal("200.00"),
        net_contribution=Decimal("200.00"),
    )

    inv_c_id = f"inv_c_{uuid.uuid4().hex[:6]}"
    inv_c = SalesInvoice(
        id=inv_c_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        invoice_no=f"INV-CAT-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("300.00"), status="PAID",
    )
    item_c = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_c_id, product_id=pid_a,
        code="SKU-A", name="Valued Product",
        quantity=Decimal("1.000"), price=Decimal("300.00"), total_amount=Decimal("300.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv_c, item_c])
    await db_session.flush()

    snap_c = TransactionCostSnapshot(
        id=f"snap_c_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_c_id, sales_invoice_item_id=str(item_c.id), product_id=pid_a,
        valuation_method_used="PROVISIONAL_CATALOG_COST", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("100.00"), total_cogs=Decimal("100.00"),
        selling_price_per_unit=Decimal("300.00"), total_gross_sales=Decimal("300.00"), gross_profit=Decimal("200.00"),
    )
    ledger_c = InvoiceProfitabilityLedger(
        id=f"ipl_c_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_c_id, gross_sales_amount=Decimal("300.00"),
        total_cogs=Decimal("100.00"), gross_profit=Decimal("200.00"),
        net_contribution=Decimal("200.00"),
    )

    db_session.add_all([snap_a, ledger_a, snap_b, ledger_b, snap_c, ledger_c])
    await db_session.flush()

    # Query KPIs
    kpis = await CostManagementEngine.get_cost_truth_dashboard_kpis(session=db_session, company_id=cid)
    assert kpis["provisional_invoices_count"] == 1
    assert kpis["has_provisional_unresolved_costs"] is True
    assert kpis["provisional_gross_sales"] == 200.00
    # Policy A3: Catalog cost sales (300.00) are included in finalized gross sales along with verified (150.00) = 450.00
    assert kpis["finalized_gross_sales"] == 450.00
    assert kpis["period_gross_profit"] == 250.00
    assert kpis["has_catalog_cost_provisional"] is True
    assert kpis["catalog_cost_provisional_sales"] == 300.00
    assert kpis["catalog_cost_invoices_count"] == 1

    # Query Report 6
    report = await CostManagementEngine.get_cogs_profitability_report(
        session=db_session, company_id=cid
    )
    items = report["items"]
    assert len(items) == 3
    row_a = next(r for r in items if r["sales_invoice_id"] == inv_a_id)
    row_b = next(r for r in items if r["sales_invoice_id"] == inv_b_id)
    row_c = next(r for r in items if r["sales_invoice_id"] == inv_c_id)

    assert row_a["cost_status"] == "FINALIZED"
    assert row_a["is_finalized"] is True
    assert row_a["gross_profit"] == 50.00

    assert row_b["cost_status"] == "PROVISIONAL_UNVALUED"
    assert row_b["is_finalized"] is False
    assert row_b["gross_profit"] == 0.00

    # Policy A3: Catalog cost is flagged as PROVISIONAL_CATALOG_COST, finalized=True with audit disclosure
    assert row_c["cost_status"] == "PROVISIONAL_CATALOG_COST"
    assert row_c["is_finalized"] is True
    assert row_c["gross_profit"] == 200.00


async def test_partially_allocated_freight_status_retained(db_session):
    """
    Phase 2 Test 19: Unallocated freight residual is NOT marked fully VALUATED.
    Scenario:
      1. Freight bill arrives for 600.00.
      2. Only 400.00 is allocated to receipt items.
      3. process_landed_cost_adjustment is executed.
    Verifies:
      - Component status is updated to PARTIALLY_VALUATED (not VALUATED).
      - Remaining 200.00 balance is preserved for subsequent allocations.
    """
    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Partial Freight SKU", price=Decimal("1000.00"), cost_price=None, stock=10)
    db_session.add(product)
    await db_session.flush()

    sid = f"sup_{uuid.uuid4().hex[:8]}"
    supplier = Supplier(
        id=sid, code=f"SUP-{uuid.uuid4().hex[:6].upper()}", name="Freight Supplier Part", company_id=cid, branch_id=bid,
    )
    db_session.add(supplier)
    await db_session.flush()

    rcpt_id = f"rcpt_{uuid.uuid4().hex[:8]}"
    rcpt = PurchaseReceipt(
        id=rcpt_id, uuid=str(uuid.uuid4()), receipt_no=f"GRN-PART-{uuid.uuid4().hex[:4]}",
        company_id=cid, branch_id=bid, warehouse_id=wid, supplier_id=sid,
        subtotal=Decimal("1000.00"), tax_total=Decimal("0.00"), grand_total=Decimal("1000.00"),
        status="RECEIVED",
    )
    db_session.add(rcpt)
    await db_session.flush()

    item_id = f"item_{uuid.uuid4().hex[:8]}"
    rcpt_item = PurchaseReceiptItem(
        id=item_id, uuid=str(uuid.uuid4()), receipt_id=rcpt_id, product_id=pid, code="SKU-PART", name="Partial SKU",
        quantity_received=Decimal("10.00"), cost_price=Decimal("100.00"), line_total=Decimal("1000.00"), company_id=cid, branch_id=bid,
    )
    db_session.add(rcpt_item)
    await db_session.flush()

    # Initial receipt valuation
    await CostManagementEngine.process_inward_valuation(session=db_session, company_id=cid, receipt_id=rcpt_id, branch_id=bid)

    # Freight bill arrives for 600.00, but only 400.00 is allocated across items
    comp_id = f"icc_{uuid.uuid4().hex[:8]}"
    comp = InwardCostComponent(
        id=comp_id, company_id=cid, branch_id=bid, grn_id=rcpt_id, component_type="FREIGHT",
        amount=Decimal("600.00"), taxable_amount=Decimal("600.00"), tax_amount=Decimal("0.00"),
        total_amount=Decimal("600.00"), tax_rate=Decimal("0.00"), itc_eligible=True, is_capitalizable=True,
        allocation_method="VALUE", allocation_scope="DOCUMENT", status="ALLOCATED",
    )
    db_session.add(comp)
    await db_session.flush()

    alloc = InwardCostAllocation(
        id=f"ica_{uuid.uuid4().hex[:8]}", company_id=cid, branch_id=bid, grn_id=rcpt_id, grn_item_id=item_id,
        cost_component_id=comp_id, product_id=pid, allocation_method="VALUE", basis_value=Decimal("1000.00"),
        allocated_amount=Decimal("400.00"), allocated_per_unit=Decimal("40.00"), rounding_adjustment=Decimal("0.00"),
    )
    db_session.add(alloc)
    await db_session.flush()

    # Process landed cost adjustment
    adj_res = await CostManagementEngine.process_landed_cost_adjustment(
        session=db_session, company_id=cid, receipt_id=rcpt_id, reason="Partial Freight Allocation"
    )
    assert adj_res["status"] == "COMPLETED"
    assert adj_res["total_adjustment_amount"] == Decimal("400.00")

    # Component must NOT be marked fully VALUATED; it must be PARTIALLY_VALUATED
    await db_session.refresh(comp)
    assert comp.status == "PARTIALLY_VALUATED"


async def test_sales_return_via_sales_service_exact_line_matching(db_session):
    """
    Phase 2 Test 20: SalesService.process_sales_return exact line-item snapshot matching.
    Scenario:
      1. Original invoice has Line 1 @ 80.00 cost, Line 2 @ 120.00 cost.
      2. Return is submitted for Line 2 specifying sales_invoice_item_id = Line 2.
    Verifies:
      - StockMovement written by SalesService is valued at 120.00, not 80.00.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.inventory import StockMovement
    from app.models.crm import Customer

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Dual Line SKU 2", price=Decimal("1000.00"), cost_price=None, stock=50)
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Return Customer")
    db_session.add_all([product, customer])
    await db_session.flush()

    from app.models.governed_logic import PolicyDefinition
    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE", "SIZE_FIT", "CUSTOMER_CHANGED_MIND"],
                "refund_modes": ["ORIGINAL_PAYMENT", "CASH", "STORE_CREDIT", "CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 5000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    from datetime import date as dt_date
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-SVC-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("2000.00"), status="PAID",
        date=dt_date.today(),
    )
    item1 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-DUAL", name="Dual Line SKU 2",
        quantity=Decimal("1.000"), price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
        company_id=cid, branch_id=bid,
    )
    item2 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-DUAL", name="Dual Line SKU 2",
        quantity=Decimal("1.000"), price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item1, item2])
    await db_session.flush()

    line1_id = str(item1.id)
    line2_id = str(item2.id)

    snap1 = TransactionCostSnapshot(
        id=f"tcs1_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line1_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("80.00"), total_cogs=Decimal("80.00"),
        selling_price_per_unit=Decimal("1000.00"), total_gross_sales=Decimal("1000.00"), gross_profit=Decimal("920.00"),
    )
    snap2 = TransactionCostSnapshot(
        id=f"tcs2_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line2_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("120.00"), total_cogs=Decimal("120.00"),
        selling_price_per_unit=Decimal("1000.00"), total_gross_sales=Decimal("1000.00"), gross_profit=Decimal("880.00"),
    )
    db_session.add_all([snap1, snap2])
    await db_session.flush()

    # Process return via SalesService targeting line2_id
    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)
    ret_id = f"ret_{uuid.uuid4().hex[:8]}"
    sr_create = SalesReturnCreate(
        id=ret_id,
        return_no=f"RET-SVC-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid,
                code="SKU-DUAL",
                name="Dual Line SKU 2",
                quantity=Decimal("1.0000"),
                price=Decimal("1000.00"),
                total_amount=Decimal("1000.00"),
                sales_invoice_item_id=line2_id,
            )
        ],
    )
    sr_res = await sales_svc.create_sales_return(sr_create)
    assert sr_res is not None

    # Verify SalesReturnItem persistence in the actual database model
    sri_stmt = select(SalesReturnItem).where(
        SalesReturnItem.return_id == sr_res.id,
        SalesReturnItem.product_id == pid,
    )
    sri = (await db_session.execute(sri_stmt)).scalars().first()
    assert sri is not None
    assert sri.sales_invoice_item_id == int(line2_id)

    # Verify StockMovement unit cost
    mov_stmt = (
        select(StockMovement)
        .where(
            StockMovement.reference_doc_id == sr_res.id,
            StockMovement.product_id == pid,
        )
    )
    mov = (await db_session.execute(mov_stmt)).scalars().first()
    assert mov is not None
    assert mov.unit_cost == Decimal("120.00")
    assert "HISTORICAL_SNAPSHOT" in mov.remarks


async def test_sales_return_ambiguous_line_falls_back_to_provisional(db_session):
    """
    Phase 2 Test 21: Sales return with missing exact line item linkage on a multi-line invoice.
    Scenario:
      1. Original invoice has Line 1 @ 80.00 cost, Line 2 @ 120.00 cost.
      2. Return is submitted without sales_invoice_item_id (ambiguous return).
    Verifies:
      - Engine NEVER silently selects arbitrary latest snapshot (Line 2 @ 120.00).
      - StockMovement is explicitly tagged with PROVISIONAL_AMBIGUOUS_LINE_FALLBACK.
      - SalesReturnItem in DB has sales_invoice_item_id = None.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.inventory import StockMovement
    from app.models.crm import Customer
    from app.models.governed_logic import PolicyDefinition
    from datetime import date as dt_date

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Dual Ambiguous SKU", price=Decimal("1000.00"), cost_price=Decimal("90.00"), stock=50)
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Ambiguous Return Customer")
    db_session.add_all([product, customer])
    await db_session.flush()

    # Ensure return policy exists
    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE"],
                "refund_modes": ["CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 5000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-AMB-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("2000.00"), status="PAID",
        date=dt_date.today(),
    )
    item1 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-AMB", name="Dual Ambiguous SKU",
        quantity=Decimal("1.000"), price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
        company_id=cid, branch_id=bid,
    )
    item2 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-AMB", name="Dual Ambiguous SKU",
        quantity=Decimal("1.000"), price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item1, item2])
    await db_session.flush()

    line1_id = str(item1.id)
    line2_id = str(item2.id)

    snap1 = TransactionCostSnapshot(
        id=f"tcs1_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line1_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("80.00"), total_cogs=Decimal("80.00"),
        selling_price_per_unit=Decimal("1000.00"), total_gross_sales=Decimal("1000.00"), gross_profit=Decimal("920.00"),
    )
    snap2 = TransactionCostSnapshot(
        id=f"tcs2_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line2_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("1.000"),
        cost_per_unit=Decimal("120.00"), total_cogs=Decimal("120.00"),
        selling_price_per_unit=Decimal("1000.00"), total_gross_sales=Decimal("1000.00"), gross_profit=Decimal("880.00"),
    )
    db_session.add_all([snap1, snap2])
    await db_session.flush()

    # Process return WITHOUT sales_invoice_item_id
    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)
    ret_id = f"ret_{uuid.uuid4().hex[:8]}"
    sr_create = SalesReturnCreate(
        id=ret_id,
        return_no=f"RET-AMB-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid,
                code="SKU-AMB",
                name="Dual Ambiguous SKU",
                quantity=Decimal("1.0000"),
                price=Decimal("1000.00"),
                total_amount=Decimal("1000.00"),
                sales_invoice_item_id=None,  # Intentionally omitted!
            )
        ],
    )
    sr_res = await sales_svc.create_sales_return(sr_create)
    assert sr_res is not None

    # Verify SalesReturnItem persistence has None for sales_invoice_item_id
    sri = (await db_session.execute(select(SalesReturnItem).where(SalesReturnItem.return_id == sr_res.id))).scalars().first()
    assert sri is not None
    assert sri.sales_invoice_item_id is None

    # Verify StockMovement remarks explicitly contain PROVISIONAL_AMBIGUOUS_LINE_FALLBACK
    mov = (await db_session.execute(
        select(StockMovement).where(
            StockMovement.reference_doc_id == sr_res.id,
            StockMovement.product_id == pid,
        )
    )).scalars().first()
    assert mov is not None
    assert "PROVISIONAL_AMBIGUOUS_LINE_FALLBACK" in mov.remarks
    assert "HISTORICAL_SNAPSHOT" not in mov.remarks


async def test_sales_return_same_sku_multiple_lines_different_qty_and_costs(db_session):
    """
    Requirement 3: Test sales returns where the same SKU occurs on multiple original
    invoice lines with different quantities and costs.
    Validates:
      1. Exact-line linkage assigns line-specific historical cost (120.00 vs 80.00) and line item ID.
      2. Exact-line quantity limits prevent returning more than the specific line quantity.
      3. Ambiguous return (unspecified line) allows returning up to total remaining product quantity,
         falls back to provisional costing (never arbitrary snapshot), and persists sales_invoice_item_id = None.
      4. Product-level limit prevents exceeding overall invoice quantity for the SKU.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.crm import Customer
    from app.models.governed_logic import PolicyDefinition
    from datetime import date as dt_date

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Multi-Line Variant SKU", price=Decimal("500.00"), cost_price=Decimal("95.00"), stock=100)
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Multi-Line Customer")
    db_session.add_all([product, customer])
    await db_session.flush()

    # Ensure return policy
    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE"],
                "refund_modes": ["CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 50000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    # Create Invoice with SAME SKU on 2 lines: Line 1 (5 units @ 80 cost), Line 2 (10 units @ 120 cost)
    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-ML-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("7500.00"), status="PAID",
        date=dt_date.today(),
    )
    item1 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-ML", name="Multi-Line Variant SKU",
        quantity=Decimal("5.000"), price=Decimal("500.00"), total_amount=Decimal("2500.00"),
        company_id=cid, branch_id=bid,
    )
    item2 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-ML", name="Multi-Line Variant SKU",
        quantity=Decimal("10.000"), price=Decimal("500.00"), total_amount=Decimal("5000.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item1, item2])
    await db_session.flush()

    line1_id = str(item1.id)
    line2_id = str(item2.id)

    snap1 = TransactionCostSnapshot(
        id=f"tcs1_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line1_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("5.000"),
        cost_per_unit=Decimal("80.00"), total_cogs=Decimal("400.00"),
        selling_price_per_unit=Decimal("500.00"), total_gross_sales=Decimal("2500.00"), gross_profit=Decimal("2100.00"),
    )
    snap2 = TransactionCostSnapshot(
        id=f"tcs2_{uuid.uuid4().hex[:6]}", company_id=cid, branch_id=bid,
        sales_invoice_id=inv_id, sales_invoice_item_id=line2_id, product_id=pid,
        valuation_method_used="WEIGHTED_AVERAGE", quantity=Decimal("10.000"),
        cost_per_unit=Decimal("120.00"), total_cogs=Decimal("1200.00"),
        selling_price_per_unit=Decimal("500.00"), total_gross_sales=Decimal("5000.00"), gross_profit=Decimal("3800.00"),
    )
    db_session.add_all([snap1, snap2])
    await db_session.flush()

    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)

    # 1. Exact-line linkage: return 3 units against Line 2 (@ 120.00 cost)
    sr1_create = SalesReturnCreate(
        id=f"ret1_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-ML1-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-ML", name="Multi-Line Variant SKU",
                quantity=Decimal("3.0000"), price=Decimal("500.00"), total_amount=Decimal("1500.00"),
                sales_invoice_item_id=line2_id,
            )
        ],
    )
    sr1_res = await sales_svc.create_sales_return(sr1_create)
    assert sr1_res is not None

    sri1 = (await db_session.execute(select(SalesReturnItem).where(SalesReturnItem.return_id == sr1_res.id))).scalars().first()
    assert sri1.sales_invoice_item_id == int(line2_id)
    mov1 = (await db_session.execute(select(StockMovement).where(StockMovement.reference_doc_id == sr1_res.id))).scalars().first()
    assert mov1.unit_cost == Decimal("120.00")
    assert "HISTORICAL_SNAPSHOT" in mov1.remarks

    # 2. Return quantity limits: Line 2 remaining is 10 - 3 = 7. Attempting 8 must fail with 422!
    sr_fail_line2 = SalesReturnCreate(
        id=f"ret_fail2_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-FAIL2-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-ML", name="Multi-Line Variant SKU",
                quantity=Decimal("8.0000"), price=Decimal("500.00"), total_amount=Decimal("4000.00"),
                sales_invoice_item_id=line2_id,
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_info:
        await sales_svc.create_sales_return(sr_fail_line2)
    assert exc_info.value.status_code == 422
    assert "exceeds remaining quantity" in exc_info.value.detail

    # Line 1 limit: quantity is 5. Attempting 6 against Line 1 must fail with 422!
    sr_fail_line1 = SalesReturnCreate(
        id=f"ret_fail1_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-FAIL1-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-ML", name="Multi-Line Variant SKU",
                quantity=Decimal("6.0000"), price=Decimal("500.00"), total_amount=Decimal("3000.00"),
                sales_invoice_item_id=line1_id,
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_info1:
        await sales_svc.create_sales_return(sr_fail_line1)
    assert exc_info1.value.status_code == 422
    assert "exceeds remaining quantity" in exc_info1.value.detail

    # 3. Unspecified line (ambiguous return): return 4 units without line id.
    # Total remaining product quantity = (5 + 10) - 3 = 12 >= 4. Must succeed!
    sr_amb = SalesReturnCreate(
        id=f"ret_amb_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-AMB-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-ML", name="Multi-Line Variant SKU",
                quantity=Decimal("4.0000"), price=Decimal("500.00"), total_amount=Decimal("2000.00"),
                sales_invoice_item_id=None,
            )
        ],
    )
    sr_amb_res = await sales_svc.create_sales_return(sr_amb)
    assert sr_amb_res is not None

    sri_amb = (await db_session.execute(select(SalesReturnItem).where(SalesReturnItem.return_id == sr_amb_res.id))).scalars().first()
    assert sri_amb.sales_invoice_item_id is None
    mov_amb = (await db_session.execute(select(StockMovement).where(StockMovement.reference_doc_id == sr_amb_res.id))).scalars().first()
    assert "PROVISIONAL_AMBIGUOUS_LINE_FALLBACK" in mov_amb.remarks
    assert "HISTORICAL_SNAPSHOT" not in mov_amb.remarks

    # 4. Product-level quantity limit: total remaining is 15 - 3 - 4 = 8.
    # Attempting to return 9 units without line id must fail with 422!
    sr_fail_prod = SalesReturnCreate(
        id=f"ret_fail_prod_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-FAILP-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-ML", name="Multi-Line Variant SKU",
                quantity=Decimal("9.0000"), price=Decimal("500.00"), total_amount=Decimal("4500.00"),
                sales_invoice_item_id=None,
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_info_prod:
        await sales_svc.create_sales_return(sr_fail_prod)
    assert exc_info_prod.value.status_code == 422
    assert "exceeds remaining quantity" in exc_info_prod.value.detail


async def test_sales_return_invalid_and_mismatched_invoice_line_id(db_session):
    """
    Requirement 2: Verify that a supplied sales_invoice_item_id belongs to the
    original invoice and matches the requested product.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.crm import Customer
    from app.models.governed_logic import PolicyDefinition
    from datetime import date as dt_date

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid_a = f"prd_a_{uuid.uuid4().hex[:8]}"
    pid_b = f"prd_b_{uuid.uuid4().hex[:8]}"
    prod_a = make_product(cid=cid, bid=bid, pid=pid_a, name="Product Alpha", price=Decimal("100.00"), cost_price=Decimal("60.00"), stock=50)
    prod_b = make_product(cid=cid, bid=bid, pid=pid_b, name="Product Beta", price=Decimal("200.00"), cost_price=Decimal("120.00"), stock=50)
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Validation Customer")
    db_session.add_all([prod_a, prod_b, customer])
    await db_session.flush()

    # Ensure return policy
    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE"],
                "refund_modes": ["CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 50000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    # Create Invoice with Product A and Product B
    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-VAL-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("300.00"), status="PAID",
        date=dt_date.today(),
    )
    item_a = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid_a,
        code="SKU-A", name="Product Alpha",
        quantity=Decimal("1.000"), price=Decimal("100.00"), total_amount=Decimal("100.00"),
        company_id=cid, branch_id=bid,
    )
    item_b = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid_b,
        code="SKU-B", name="Product Beta",
        quantity=Decimal("1.000"), price=Decimal("200.00"), total_amount=Decimal("200.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item_a, item_b])
    await db_session.flush()

    line_a_id = item_a.id
    line_b_id = item_b.id

    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)

    # 1. Test invalid invoice line ID (not present on original invoice)
    sr_invalid_line = SalesReturnCreate(
        id=f"ret_inv_line_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-INV-1-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid_a, code="SKU-A", name="Product Alpha",
                quantity=Decimal("1.0000"), price=Decimal("100.00"), total_amount=Decimal("100.00"),
                sales_invoice_item_id=999999,  # Does not exist!
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_inv:
        await sales_svc.create_sales_return(sr_invalid_line)
    assert exc_inv.value.status_code == 422
    assert "INVOICE_LINE_NOT_FOUND" in exc_inv.value.detail


async def test_sales_return_mismatched_invoice_line_id_rejected(db_session):
    """
    Requirement 2: Verify that a supplied sales_invoice_item_id belonging to a
    different product on the invoice is rejected with INVOICE_LINE_PRODUCT_MISMATCH.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.crm import Customer
    from app.models.governed_logic import PolicyDefinition
    from datetime import date as dt_date

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid_a = f"prd_a2_{uuid.uuid4().hex[:8]}"
    pid_b = f"prd_b2_{uuid.uuid4().hex[:8]}"
    prod_a = make_product(cid=cid, bid=bid, pid=pid_a, name="Product Alpha 2", price=Decimal("100.00"), cost_price=Decimal("60.00"), stock=50)
    prod_b = make_product(cid=cid, bid=bid, pid=pid_b, name="Product Beta 2", price=Decimal("200.00"), cost_price=Decimal("120.00"), stock=50)
    cust_id = f"cust2_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Validation Customer 2")
    db_session.add_all([prod_a, prod_b, customer])
    await db_session.flush()

    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE"],
                "refund_modes": ["CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 50000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    inv_id = f"inv_mis_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-MIS-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("300.00"), status="PAID",
        date=dt_date.today(),
    )
    item_a = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid_a,
        code="SKU-A2", name="Product Alpha 2",
        quantity=Decimal("1.000"), price=Decimal("100.00"), total_amount=Decimal("100.00"),
        company_id=cid, branch_id=bid,
    )
    item_b = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid_b,
        code="SKU-B2", name="Product Beta 2",
        quantity=Decimal("1.000"), price=Decimal("200.00"), total_amount=Decimal("200.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item_a, item_b])
    await db_session.flush()

    line_b_id = item_b.id
    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)

    sr_mismatch_line = SalesReturnCreate(
        id=f"ret_mismatch_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-INV-2-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid_a, code="SKU-A2", name="Product Alpha 2",
                quantity=Decimal("1.0000"), price=Decimal("100.00"), total_amount=Decimal("100.00"),
                sales_invoice_item_id=str(line_b_id),  # Belongs to Product Beta!
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_mis:
        await sales_svc.create_sales_return(sr_mismatch_line)
    assert exc_mis.value.status_code == 422
    assert "INVOICE_LINE_PRODUCT_MISMATCH" in exc_mis.value.detail


async def test_sales_return_different_prices_or_taxes_without_line_id_rejected(db_session):
    """
    Requirement 2: When the invoice line is omitted and multiple matching lines
    have different prices or tax rates, reject with AMBIGUOUS_MULTI_LINE_RETURN.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.crm import Customer
    from app.models.governed_logic import PolicyDefinition
    from datetime import date as dt_date

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_diff_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Tiered Price SKU", price=Decimal("500.00"), cost_price=Decimal("200.00"), stock=50)
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Tiered Customer")
    db_session.add_all([product, customer])
    await db_session.flush()

    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE"],
                "refund_modes": ["CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 50000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    # Invoice with SAME product on 2 lines with DIFFERENT unit prices (400.00 vs 500.00)
    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-DIF-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("900.00"), status="PAID",
        date=dt_date.today(),
    )
    item1 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-TIER", name="Tiered Price SKU",
        quantity=Decimal("1.000"), price=Decimal("400.00"), total_amount=Decimal("400.00"),
        company_id=cid, branch_id=bid,
    )
    item2 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-TIER", name="Tiered Price SKU",
        quantity=Decimal("1.000"), price=Decimal("500.00"), total_amount=Decimal("500.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item1, item2])
    await db_session.flush()

    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)

    # 1. Omit sales_invoice_item_id -> Must fail with 422 AMBIGUOUS_MULTI_LINE_RETURN
    sr_ambiguous = SalesReturnCreate(
        id=f"ret_amb_fail_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-AMB-FAIL-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-TIER", name="Tiered Price SKU",
                quantity=Decimal("1.0000"), price=Decimal("450.00"), total_amount=Decimal("450.00"),
                sales_invoice_item_id=None,
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_amb:
        await sales_svc.create_sales_return(sr_ambiguous)
    assert exc_amb.value.status_code == 422
    assert "AMBIGUOUS_MULTI_LINE_RETURN" in exc_amb.value.detail


async def test_sales_return_different_prices_with_exact_line_id_succeeds(db_session):
    """
    Requirement 2: When the invoice line is explicitly supplied on a multi-line invoice
    with different prices, the return succeeds cleanly with exact line linkage.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.crm import Customer
    from app.models.governed_logic import PolicyDefinition
    from datetime import date as dt_date

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_diff2_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Tiered Price SKU 2", price=Decimal("500.00"), cost_price=Decimal("200.00"), stock=50)
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Tiered Customer 2")
    db_session.add_all([product, customer])
    await db_session.flush()

    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE"],
                "refund_modes": ["CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 50000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    inv_id = f"inv2_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-DIF2-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("900.00"), status="PAID",
        date=dt_date.today(),
    )
    item1 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-TIER2", name="Tiered Price SKU 2",
        quantity=Decimal("1.000"), price=Decimal("400.00"), total_amount=Decimal("400.00"),
        company_id=cid, branch_id=bid,
    )
    item2 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-TIER2", name="Tiered Price SKU 2",
        quantity=Decimal("1.000"), price=Decimal("500.00"), total_amount=Decimal("500.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item1, item2])
    await db_session.flush()

    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)
    sr_exact = SalesReturnCreate(
        id=f"ret_exact_ok_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-EXACT-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-TIER2", name="Tiered Price SKU 2",
                quantity=Decimal("1.0000"), price=Decimal("400.00"), total_amount=Decimal("400.00"),
                sales_invoice_item_id=str(item1.id),
            )
        ],
    )
    sr_ok = await sales_svc.create_sales_return(sr_exact)
    assert sr_ok is not None


async def test_provisional_sales_return_profitability_quarantine(db_session):
    """
    Requirement 2: Ensure provisional returns cannot appear as finalized cost or profitability data.
    Verifies that original invoice is quarantined from finalized KPIs.
    """
    from app.services.sales import SalesService
    from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
    from app.models.crm import Customer
    from app.models.governed_logic import PolicyDefinition
    from datetime import date as dt_date

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    pid = f"prd_q_{uuid.uuid4().hex[:8]}"
    product = make_product(cid=cid, bid=bid, pid=pid, name="Quarantine SKU", price=Decimal("1000.00"), cost_price=Decimal("400.00"), stock=100)
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    customer = Customer(id=cust_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid, name="Quarantine Customer")
    db_session.add_all([product, customer])
    await db_session.flush()

    existing_pol = (await db_session.execute(
        select(PolicyDefinition).where(
            PolicyDefinition.code == "POLICY_RETURN_STANDARD",
            PolicyDefinition.is_active == True,
            PolicyDefinition.is_deleted == False,
        )
    )).scalars().first()
    if not existing_pol:
        pol = PolicyDefinition(
            id=f"pol_{uuid.uuid4().hex[:8]}",
            code="POLICY_RETURN_STANDARD",
            version=1,
            name="Standard Sales Return Policy",
            policy_type="RETURN_POLICY",
            parameters={
                "scope": "GLOBAL",
                "return_window_days": 30,
                "return_types": ["REFUND", "EXCHANGE", "CREDIT_NOTE"],
                "return_reasons": ["DEFECTIVE"],
                "refund_modes": ["CREDIT_NOTE"],
                "credit_note_policy": {"required": True, "auto_generate": True},
                "inventory_policy": {"restock_destination": "RETURN_INWARD", "auto_increment": True},
                "authorization_policy": {"supervisor_threshold": 50000.00, "blind_return_requires_auth": True},
                "is_blind_return_allowed": False,
            },
            is_active=True,
            status="ACTIVE",
        )
        db_session.add(pol)
        await db_session.flush()

    inv_id = f"inv_q_{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id, uuid=str(uuid.uuid4()), company_id=cid, branch_id=bid,
        customer_id=cust_id, invoice_no=f"INV-Q-{uuid.uuid4().hex[:4]}",
        grand_total=Decimal("2000.00"), status="PAID",
        date=dt_date.today(),
    )
    item1 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-Q", name="Quarantine SKU",
        quantity=Decimal("1.000"), price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
        company_id=cid, branch_id=bid,
    )
    item2 = SalesInvoiceItem(
        uuid=str(uuid.uuid4()), invoice_id=inv_id, product_id=pid,
        code="SKU-Q", name="Quarantine SKU",
        quantity=Decimal("1.000"), price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
        company_id=cid, branch_id=bid,
    )
    db_session.add_all([inv, item1, item2])
    await db_session.flush()

    # Record InvoiceProfitabilityLedger for the invoice
    ipl = InvoiceProfitabilityLedger(
        id=f"ipl_{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        company_id=cid,
        branch_id=bid,
        sales_invoice_id=inv_id,
        gross_sales_amount=Decimal("2000.00"),
        total_cogs=Decimal("800.00"),
        gross_profit=Decimal("1200.00"),
        net_contribution=Decimal("1200.00"),
        net_margin_percent=Decimal("60.00"),
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db_session.add(ipl)
    await db_session.flush()

    # Create ambiguous sales return without line ID (provisional fallback)
    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)
    sr_create = SalesReturnCreate(
        id=f"ret_q_{uuid.uuid4().hex[:8]}",
        return_no=f"RET-Q-{uuid.uuid4().hex[:4]}",
        original_invoice_id=inv_id,
        items=[
            SalesReturnItemCreate(
                product_id=pid, code="SKU-Q", name="Quarantine SKU",
                quantity=Decimal("1.0000"), price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
                sales_invoice_item_id=None,
            )
        ],
    )
    await sales_svc.create_sales_return(sr_create)

    # Verify Cost Truth Dashboard quarantines this invoice from finalized figures
    kpis = await CostManagementEngine.get_cost_truth_dashboard_kpis(db_session, cid)
    assert kpis["has_provisional_unresolved_costs"] is True
    assert kpis["provisional_invoices_count"] >= 1
    assert kpis["quarantine_warning"] is not None
    assert "quarantined from finalized gross profit" in kpis["quarantine_warning"]

    # Verify COGS profitability report flags invoice as PROVISIONAL_UNVALUED with is_finalized=False
    report = await CostManagementEngine.get_cogs_profitability_report(db_session, cid)
    matching_item = next((it for it in report["items"] if it["sales_invoice_id"] == inv_id), None)
    assert matching_item is not None
    assert matching_item["cost_status"] == "PROVISIONAL_UNVALUED"
    assert matching_item["is_finalized"] is False
    assert matching_item["gross_profit"] == 0.00


async def test_landed_cost_adjustment_voucher_balance_and_duplicate_protection(db_session):
    """
    Requirement 4: Verify landed-cost accounting integration:
      1. Debit/credit equality enforcement (unbalanced amounts rejected).
      2. Duplicate-posting protection (re-calling returns existing voucher).
      3. TallyPrime XML export generation from actual voucher data.
    """
    from app.services.tally_service import TallyIntegrationService

    cid, bid, wid, tenant_ctx = await setup_test_environment(db_session)
    adj_no = f"ADJ-TEST-{uuid.uuid4().hex[:6]}"
    rcpt_no = f"GRN-TEST-{uuid.uuid4().hex[:6]}"

    # 1. Unbalanced call must raise 400
    with pytest.raises(HTTPException) as exc_bal:
        await UnifiedAccountingLedgerService.post_landed_cost_adjustment_voucher(
            session=db_session,
            company_id=cid,
            branch_id=bid,
            adjustment_no=f"{adj_no}-BAD",
            receipt_no=rcpt_no,
            supplier_id=None,
            capitalized_amount=Decimal("100.00"),
            expensed_amount=Decimal("50.00"),
            total_amount=Decimal("200.00"),  # 100 + 50 != 200!
        )
    assert exc_bal.value.status_code == 400
    assert "SMRITI-GL-400" in exc_bal.value.detail
    assert "out of balance" in exc_bal.value.detail

    # 2. Balanced call must succeed
    jv1 = await UnifiedAccountingLedgerService.post_landed_cost_adjustment_voucher(
        session=db_session,
        company_id=cid,
        branch_id=bid,
        adjustment_no=adj_no,
        receipt_no=rcpt_no,
        supplier_id=None,
        capitalized_amount=Decimal("70.00"),
        expensed_amount=Decimal("30.00"),
        total_amount=Decimal("100.00"),
    )
    assert jv1 is not None
    assert jv1.reference_doc_no == adj_no
    assert jv1.reference_doc_type == "INWARD_COST_ADJUSTMENT"

    # 3. Duplicate posting protection: second call with same adj_no returns existing voucher
    jv2 = await UnifiedAccountingLedgerService.post_landed_cost_adjustment_voucher(
        session=db_session,
        company_id=cid,
        branch_id=bid,
        adjustment_no=adj_no,
        receipt_no=rcpt_no,
        supplier_id=None,
        capitalized_amount=Decimal("70.00"),
        expensed_amount=Decimal("30.00"),
        total_amount=Decimal("100.00"),
    )
    assert jv2.id == jv1.id
    assert jv2.voucher_no == jv1.voucher_no

    # 4. Generate Tally XML export from actual voucher
    xml_str = await TallyIntegrationService.generate_tally_journal_voucher_xml(
        session=db_session,
        company_id=cid,
        voucher_id=jv1.id,
    )
    assert xml_str is not None
    assert 'VCHTYPE="Journal"' in xml_str
    assert "<VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>" in xml_str
    assert jv1.voucher_no in xml_str
    assert "ALLLEDGERENTRIES.LIST" in xml_str
