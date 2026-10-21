"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 0 Characterization Tests for Stock Synchronizer Side-Effects
"""

import uuid
from decimal import Decimal
import pytest
from sqlalchemy import select, update

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement, Warehouse
from app.services.sales_stock_authority import SalesStockAuthority
from app.services.stock_synchronizer import StockSynchronizer

pytestmark = pytest.mark.asyncio


async def _setup_char_env(db_session, suffix: str):
    comp = Company(
        id=f"comp-char-{suffix}",
        name=f"Char Co {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-char-{suffix}",
        company_id=comp.id,
        name=f"Branch {suffix}",
        code=f"BR-{suffix}",
        is_active=True,
    )
    db_session.add_all([comp, branch])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh-char-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"WH-{suffix}",
        name=f"Warehouse {suffix}",
        is_active=True,
    )
    db_session.add(warehouse)
    await db_session.flush()

    tenant_ctx = TenantContext(
        company_id=comp.id,
        branch_id=branch.id,
        role="admin",
    )
    return comp, branch, warehouse, tenant_ctx


async def test_characterization_case_a_unledgered_stock_then_sale(db_session):
    """
    Phase 0 D.1(a): A product with products.stock=10 and no ledger rows,
    then a sale of 4 through SalesStockAuthority:
    Show the final ledger balance and products.stock, and report whether they are correct.
    """
    suffix = uuid.uuid4().hex[:6]
    comp, branch, warehouse, tenant_ctx = await _setup_char_env(db_session, suffix)

    # 1. Product initialized with stock=10 but ZERO StockMovement rows
    prod = Product(
        id=f"prod-char-a-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"SKU-A-{suffix}",
        barcode=f"BAR-A-{suffix}",
        name=f"Product A {suffix}",
        category="General",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        cost_price=Decimal("60.00"),
        stock=10,  # Legacy or direct setting
        tracking_mode="Normal",
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()

    # Pre-condition check: zero movement rows
    pre_moves = (
        await db_session.execute(
            select(StockMovement).where(StockMovement.product_id == prod.id)
        )
    ).scalars().all()
    assert len(pre_moves) == 0, "Pre-condition failed: expected 0 ledger rows"

    # 2. Record sale of 4 through SalesStockAuthority
    items = [
        {
            "product_id": prod.id,
            "quantity": 4,
            "unit_price": 100.0,
            "discount_amount": 0.0,
            "tax_amount": 0.0,
        }
    ]
    inv_id = f"inv-{suffix}"
    inv_no = f"INV-{suffix}"

    movements = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=inv_id,
        invoice_no=inv_no,
        items=items,
        warehouse_id=warehouse.id,
        user_id="U-CHAR",
        allow_negative_stock=True,
    )
    await db_session.commit()

    # 3. Inspect movements and product stock
    all_moves = (
        await db_session.execute(
            select(StockMovement)
            .where(StockMovement.product_id == prod.id)
            .order_by(StockMovement.created_at.asc(), StockMovement.id.asc())
        )
    ).scalars().all()

    fresh_prod = (
        await db_session.execute(
            select(Product).where(Product.id == prod.id)
        )
    ).scalar_one()

    print("\n--- CHARACTERIZATION CASE A RESULTS ---")
    print(f"Product Stock: {fresh_prod.stock}")
    print(f"Movement Count: {len(all_moves)}")
    for m in all_moves:
        print(f"  Movement ID={m.id}, Type={m.movement_type}, Qty={m.quantity}, RefDoc={m.reference_doc_type}:{m.reference_doc_id}")

    # Calculations - Phase 1 Decoupling: Pure synchronizer does NOT synthesize OPENING_STOCK
    opening_moves = [m for m in all_moves if m.movement_type == "OPENING_STOCK"]
    sale_moves = [m for m in all_moves if m.movement_type == "OUTWARD_SALE"]

    assert len(opening_moves) == 0, "Phase 1 verification: Pure StockSynchronizer does NOT create OPENING_STOCK"
    assert len(sale_moves) == 1
    assert abs(sale_moves[0].quantity) == Decimal("4")
    assert fresh_prod.stock == -4

    ledger_balance = Decimal(str(fresh_prod.stock))
    assert ledger_balance == Decimal("-4")


async def test_characterization_case_b_hand_drift_copies_to_ledger(db_session):
    """
    Phase 0 D.1(b): A product whose cache was drifted upward by hand and has no inward movement:
    Show that a refresh copies the drifted value into the ledger as OPENING_STOCK.
    """
    suffix = uuid.uuid4().hex[:6]
    comp, branch, warehouse, tenant_ctx = await _setup_char_env(db_session, suffix)

    # 1. Product created with stock=0 and NO ledger rows
    prod = Product(
        id=f"prod-char-b-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"SKU-B-{suffix}",
        barcode=f"BAR-B-{suffix}",
        name=f"Product B {suffix}",
        category="General",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        cost_price=Decimal("60.00"),
        stock=0,
        tracking_mode="Normal",
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()

    # 2. Hand drift upward: directly update products.stock to 50 without any ledger entry
    await db_session.execute(
        update(Product)
        .where(Product.id == prod.id)
        .values(stock=50)
    )
    await db_session.commit()

    # Pre-condition check: zero movement rows, stock=50
    pre_moves = (
        await db_session.execute(
            select(StockMovement).where(StockMovement.product_id == prod.id)
        )
    ).scalars().all()
    assert len(pre_moves) == 0, "Pre-condition failed: expected 0 ledger rows"

    fresh_prod_pre = (
        await db_session.execute(
            select(Product).where(Product.id == prod.id)
        )
    ).scalar_one()
    assert fresh_prod_pre.stock == 50

    # 3. Call StockSynchronizer.sync_product_stock_cache
    sync_result = await StockSynchronizer.sync_product_stock_cache(
        session=db_session,
        product_id=prod.id,
        company_id=comp.id,
    )
    await db_session.commit()

    # 4. Inspect movements created
    all_moves = (
        await db_session.execute(
            select(StockMovement)
            .where(StockMovement.product_id == prod.id)
        )
    ).scalars().all()

    fresh_prod_post = (
        await db_session.execute(
            select(Product).where(Product.id == prod.id)
        )
    ).scalar_one()

    print("\n--- CHARACTERIZATION CASE B RESULTS ---")
    print(f"Product Stock before sync: 50, after sync: {fresh_prod_post.stock}")
    print(f"Sync Result: {sync_result}")
    print(f"Movement Count: {len(all_moves)}")
    for m in all_moves:
        print(f"  Movement ID={m.id}, Type={m.movement_type}, Qty={m.quantity}, RefDoc={m.reference_doc_type}:{m.reference_doc_id}, Remarks={m.remarks}")

    # Phase 1 Decoupling Verification:
    assert len(all_moves) == 0, "Phase 1: Pure synchronizer does NOT synthesize movements for drifted cache"
    assert fresh_prod_post.stock == 0, "Phase 1: Pure synchronizer resets drifted cache to authoritative ledger truth (0)"
