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
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement, Warehouse, ProductBatchStock
from app.models.crm import Customer
from app.models.sales import SalesInvoice
from app.services.sales_ledger_svc import UnifiedSalesLedgerService
from app.db.ctrl_seeder import ControlPlaneSeeder

pytestmark = pytest.mark.asyncio


async def _setup_item2_env(db_session, suffix: str):
    await ControlPlaneSeeder.seed_governed_logic(db_session)
    comp = Company(
        id=f"comp-l2-{suffix}",
        name=f"Ledger Co {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-l2-{suffix}",
        company_id=comp.id,
        name=f"Branch {suffix}",
        code=f"BR-{suffix}",
        is_active=True,
    )
    db_session.add_all([comp, branch])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh-l2-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"WH-{suffix}",
        name=f"Warehouse {suffix}",
        is_active=True,
    )
    cust = Customer(
        id=f"cust-l2-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        name=f"Customer {suffix}",
        code=f"CUST-{suffix}",
        is_active=True,
    )
    prod = Product(
        id=f"prod-l2-{suffix}",
        company_id=comp.id,
        branch_id=branch.id,
        code=f"SKU-{suffix}",
        barcode=f"BAR-{suffix}",
        name=f"Ledger Test Product {suffix}",
        price=Decimal("100.00"),  # Selling price
        mrp=Decimal("100.00"),
        cost_price=Decimal("60.00"),  # Cost price
        category="General",
        stock=10,
        tracking_mode="Batch",
        is_active=True,
    )
    db_session.add_all([warehouse, cust, prod])
    await db_session.flush()

    batch = ProductBatchStock(
        id=f"pbs-l2-{suffix}",
        company_id=comp.id,
        warehouse_id=warehouse.id,
        product_id=prod.id,
        batch_no=f"BATCH-{suffix}",
        quantity=Decimal("10.0000"),
        is_active=True,
    )
    db_session.add(batch)
    await db_session.flush()

    res = {
        "comp_id": comp.id,
        "branch_id": branch.id,
        "wh_id": warehouse.id,
        "cust_id": cust.id,
        "prod_id": prod.id,
        "prod_code": prod.code,
        "prod_name": prod.name,
        "batch_id": batch.id,
        "batch_no": batch.batch_no,
    }
    await db_session.commit()
    return res


async def test_item2_unit_cost_not_selling_price_and_oversell_rejection(db_session):
    """
    ITEM 2 Verification:
    1. unit_cost != selling price (resolved from cost engine / cost_price).
    2. oversell is rejected when negative stock is not allowed.
    3. posting the same invoice twice creates one movement per line.
    4. cancel restores stock and batch exactly once.
    """
    suffix = uuid.uuid4().hex[:6]
    env = await _setup_item2_env(db_session, suffix)

    inv_no = f"INV-L2-{suffix}"
    items_data = [
        {
            "product_id": env["prod_id"],
            "code": env["prod_code"],
            "name": env["prod_name"],
            "quantity": 2.0,
            "price": 100.0,  # Selling price
            "batch_no": env["batch_no"],
        }
    ]

    # 1. Post sales invoice
    inv = await UnifiedSalesLedgerService.post_sales_invoice(
        session=db_session,
        company_id=env["comp_id"],
        invoice_no=inv_no,
        customer_id=env["cust_id"],
        items_data=items_data,
        branch_id=env["branch_id"],
        warehouse_id=env["wh_id"],
    )
    saved_inv_id = inv.id
    await db_session.commit()

    # Verify unit_cost != selling price
    sm_stmt = select(StockMovement).where(
        StockMovement.company_id == env["comp_id"],
        StockMovement.reference_doc_id == saved_inv_id,
        StockMovement.movement_type == "OUTWARD_SALE",
    )
    sm = (await db_session.execute(sm_stmt)).scalar_one()

    # Defect: previously unit_cost was assigned as `price` (100.00)
    assert sm.unit_cost != Decimal("100.00"), f"Defect: unit_cost was set to selling price {sm.unit_cost}"
    assert sm.unit_cost == Decimal("60.00"), f"Expected unit_cost to be 60.00, got {sm.unit_cost}"

    # Verify stock reduction
    prod_stmt = select(Product).where(Product.id == env["prod_id"])
    prod_fresh = (await db_session.execute(prod_stmt)).scalar_one()
    batch_stmt = select(ProductBatchStock).where(ProductBatchStock.id == env["batch_id"])
    batch_fresh = (await db_session.execute(batch_stmt)).scalar_one()
    assert prod_fresh.stock == 8
    assert batch_fresh.quantity == Decimal("8.0000")

    # 2. Posting the same invoice twice is idempotent and does not create duplicate movements
    inv_repost = await UnifiedSalesLedgerService.post_sales_invoice(
        session=db_session,
        company_id=env["comp_id"],
        invoice_no=inv_no,
        customer_id=env["cust_id"],
        items_data=items_data,
        branch_id=env["branch_id"],
        warehouse_id=env["wh_id"],
    )
    await db_session.commit()

    all_sms = (await db_session.execute(sm_stmt)).scalars().all()
    assert len(all_sms) == 1, f"Expected 1 stock movement for invoice, found {len(all_sms)}"

    # 3. Oversell is rejected when negative stock is not allowed
    oversell_inv_no = f"INV-OVER-{suffix}"
    oversell_items = [
        {
            "product_id": env["prod_id"],
            "code": env["prod_code"],
            "name": env["prod_name"],
            "quantity": 50.0,  # Available is 8
            "price": 100.0,
            "batch_no": env["batch_no"],
        }
    ]
    with pytest.raises((HTTPException, ValueError)) as excinfo:
        await UnifiedSalesLedgerService.post_sales_invoice(
            session=db_session,
            company_id=env["comp_id"],
            invoice_no=oversell_inv_no,
            customer_id=env["cust_id"],
            items_data=oversell_items,
            branch_id=env["branch_id"],
            warehouse_id=env["wh_id"],
        )
    await db_session.rollback()

    # 4. Cancel restores stock and batch exactly once
    await UnifiedSalesLedgerService.cancel_sales_invoice(
        session=db_session,
        company_id=env["comp_id"],
        invoice_no=inv_no,
        reason="Customer cancellation",
        branch_id=env["branch_id"],
    )
    await db_session.commit()

    prod_after_cancel = (await db_session.execute(prod_stmt)).scalar_one()
    batch_after_cancel = (await db_session.execute(batch_stmt)).scalar_one()
    assert prod_after_cancel.stock == 10, f"Expected product stock restored to 10, got {prod_after_cancel.stock}"
    assert batch_after_cancel.quantity == Decimal("10.0000"), f"Expected batch stock restored to 10.0000, got {batch_after_cancel.quantity}"

    # Calling cancel a second time does not double restore
    await UnifiedSalesLedgerService.cancel_sales_invoice(
        session=db_session,
        company_id=env["comp_id"],
        invoice_no=inv_no,
        reason="Duplicate cancellation call",
        branch_id=env["branch_id"],
    )
    await db_session.commit()

    prod_after_cancel2 = (await db_session.execute(prod_stmt)).scalar_one()
    batch_after_cancel2 = (await db_session.execute(batch_stmt)).scalar_one()
    assert prod_after_cancel2.stock == 10, f"Repeated cancel double-restored product stock to {prod_after_cancel2.stock}"
    assert batch_after_cancel2.quantity == Decimal("10.0000"), f"Repeated cancel double-restored batch stock to {batch_after_cancel2.quantity}"
