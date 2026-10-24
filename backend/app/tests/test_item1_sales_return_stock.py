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
Classification: Internal
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement, Warehouse, ProductBatchStock
from app.models.profitability import TransactionCostSnapshot
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.schemas.sales import SalesReturnCreate, SalesReturnItemCreate
from app.api.deps import TenantContext
from app.db.ctrl_seeder import ControlPlaneSeeder
from app.services.sales import SalesService
from app.services.lifecycle import UniversalLifecycleEngine, LifecycleTransitionContext
from app.services.sales_stock_authority import SalesStockAuthority

pytestmark = pytest.mark.asyncio


async def _setup_test_env(db_session, suffix: str):
    await ControlPlaneSeeder.seed_governed_logic(db_session)
    comp = Company(
        id=f"comp-ret-{suffix}",
        name=f"Return Co {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-ret-{suffix}",
        company_id=comp.id,
        name=f"Return Branch {suffix}",
        code=f"BR-{suffix}",
        is_active=True,
    )
    db_session.add_all([comp, branch])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh-ret-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"WH-{suffix}",
        name=f"Warehouse {suffix}",
        is_active=True,
    )
    user = User(
        id=f"usr-ret-{suffix}",
        username=f"user_{suffix}",
        email=f"user_{suffix}@test.com",
        hashed_password="dummy_hashed_password",
        role=UserRole.SYSADMIN,
        company_id=comp.id,
        branch_id=branch.id,
        is_active=True,
    )
    prod = Product(
        id=f"prod-ret-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"SKU-{suffix}",
        barcode=f"BAR-{suffix}",
        name=f"Return Test Product {suffix}",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        cost_price=Decimal("60.00"),
        category="General",
        stock=10,
        tracking_mode="Batch",
        is_active=True,
    )
    db_session.add_all([warehouse, user, prod])
    await db_session.flush()

    batch_obj = ProductBatchStock(
        id=f"pbs-ret-{suffix}",
        company_id=comp.id,
        warehouse_id=warehouse.id,
        product_id=prod.id,
        batch_no=f"BATCH-{suffix}",
        quantity=Decimal("10.0000"),
        is_active=True,
    )
    db_session.add(batch_obj)
    await db_session.flush()

    inv = SalesInvoice(
        id=f"inv-ret-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        invoice_no=f"INV-{suffix}",
        date=date.today(),
        customer_name="Walk-in Customer",
        warehouse_id=warehouse.id,
        status="POSTED",
        tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        is_active=True,
    )
    db_session.add(inv)
    await db_session.flush()

    inv_item = SalesInvoiceItem(
        company_id=comp.id,
        branch_id=branch.id,
        invoice_id=inv.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("5.0000"),
        price=Decimal("100.00"),
        batch_no=batch_obj.batch_no,
        gst_rate=Decimal("18.00"),
        tax_amount=Decimal("18.00"),
        total_amount=Decimal("118.00"),
        line_no=1,
    )
    db_session.add(inv_item)
    await db_session.flush()

    snap = TransactionCostSnapshot(
        id=f"snap-ret-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        sales_invoice_id=inv.id,
        sales_invoice_item_id=str(inv_item.id),
        product_id=prod.id,
        quantity=Decimal("5.000"),
        cost_per_unit=Decimal("55.00"),
        total_cogs=Decimal("275.00"),
        selling_price_per_unit=Decimal("100.00"),
        total_gross_sales=Decimal("500.00"),
        gross_profit=Decimal("225.00"),
        valuation_method_used="WEIGHTED_AVERAGE",
        is_active=True,
    )
    db_session.add(snap)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=branch.id, role=user.role)
    return tenant_ctx, user, prod, inv, inv_item, batch_obj, warehouse


async def test_item1_sales_return_two_stock_writers_reproduction(db_session):
    """
    ITEM 1 Verification:
    (a) creating a return does NOT change stock;
    (b) PROCESS increments products.stock by qty;
    (c) PROCESS with batch_no increments ProductBatchStock;
    (d) calling PROCESS twice does not double-increment.
    """
    suffix = uuid.uuid4().hex[:6]
    tenant_ctx, user, prod, inv, inv_item, batch_obj, warehouse = await _setup_test_env(db_session, suffix)

    sales_svc = SalesService(db=db_session, tenant_ctx=tenant_ctx)
    return_qty = Decimal("2.0000")

    sr_in = SalesReturnCreate(
        id=f"ret-{suffix}",
        return_no=f"RET-TEST-{suffix}",
        original_invoice_id=inv.id,
        date=date.today(),
        reason="Defective item return",
        tax_total=Decimal("36.00"),
        grand_total=Decimal("236.00"),
        status="Draft",
        items=[
            SalesReturnItemCreate(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                quantity=return_qty,
                price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
                tax_amount=Decimal("36.00"),
                total_amount=Decimal("236.00"),
                sales_invoice_item_id=inv_item.id,
                batch_no=batch_obj.batch_no,
            )
        ]
    )

    # 1. Create Sales Return in Draft status
    created_sr = await sales_svc.create_sales_return(sr_in)
    await db_session.commit()

    # (a) Verify creating a return does NOT change stock
    prod_stmt = select(Product).where(Product.id == prod.id)
    prod_fresh = (await db_session.execute(prod_stmt)).scalar_one()
    assert prod_fresh.stock == 10, f"Defect (a): Draft return incremented stock to {prod_fresh.stock} (expected 10)"

    # Also verify no stock movement was written for Draft return
    sm_stmt = select(StockMovement).where(
        StockMovement.reference_doc_id == created_sr.id,
        StockMovement.movement_type == "RETURN_INWARD"
    )
    sm_rows = (await db_session.execute(sm_stmt)).scalars().all()
    assert len(sm_rows) == 0, f"Defect (a): StockMovement was created prematurely for Draft return: {sm_rows}"

    # Verify batch stock has NOT been changed yet
    b_stmt = select(ProductBatchStock).where(ProductBatchStock.id == batch_obj.id)
    b_fresh = (await db_session.execute(b_stmt)).scalar_one()
    assert b_fresh.quantity == Decimal("10.0000")

    # 2. Advance through lifecycle: DRAFT -> SUBMITTED -> APPROVED -> PROCESSED
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=created_sr.id, action="SUBMIT")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=created_sr.id, action="APPROVE")
    )
    await UniversalLifecycleEngine.execute_transition(
        db=db_session, tenant_ctx=tenant_ctx, user=user,
        ctx=LifecycleTransitionContext(doc_type="SalesReturn", doc_id=created_sr.id, action="PROCESS")
    )
    await db_session.commit()

    # (b) Verify PROCESS increments products.stock by qty (10 + 2 = 12)
    prod_fresh = (await db_session.execute(prod_stmt)).scalar_one()
    assert prod_fresh.stock == 12, f"Defect (b): PROCESS did not increment stock correctly: {prod_fresh.stock} != 12"

    # (c) Verify PROCESS with batch_no increments ProductBatchStock (10 + 2 = 12)
    b_fresh = (await db_session.execute(b_stmt)).scalar_one()
    assert b_fresh.quantity == Decimal("12.0000"), f"Defect (c): ProductBatchStock was not incremented: {b_fresh.quantity} != 12.0000"

    # (d) Calling PROCESS twice does not double-increment
    # Idempotent call to SalesStockAuthority.record_return_inward
    ret_items_stmt = select(SalesReturnItem).where(SalesReturnItem.return_id == created_sr.id)
    ret_items = (await db_session.execute(ret_items_stmt)).scalars().all()
    lines = [
        {
            "product_id": it.product_id,
            "quantity": it.quantity,
            "batch_no": getattr(it, "batch_no", None) or batch_obj.batch_no,
            "unit_cost": getattr(it, "unit_cost", None),
            "sales_invoice_item_id": it.sales_invoice_item_id,
        }
        for it in ret_items
    ]
    await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=created_sr.id,
        return_no=created_sr.return_no,
        items=lines,
        warehouse_id=warehouse.id,
        user_id=user.username,
        original_invoice_id=inv.id,
    )
    await db_session.commit()

    prod_fresh = (await db_session.execute(prod_stmt)).scalar_one()
    assert prod_fresh.stock == 12, f"Defect (d): Repeated PROCESS double-incremented product stock: {prod_fresh.stock}"

    b_fresh = (await db_session.execute(b_stmt)).scalar_one()
    assert b_fresh.quantity == Decimal("12.0000"), f"Defect (d): Repeated PROCESS double-incremented batch stock: {b_fresh.quantity}"
