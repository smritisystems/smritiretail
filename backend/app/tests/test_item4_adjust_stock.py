"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Item 4 Stock Adjustment Integrity & Cache Independence Suite
"""

import uuid
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Company, Branch
from app.models.item_master import Item, ItemVariant
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.auth import UserRole
from app.api.deps import TenantContext
from app.services.inventory import InventoryService
from app.services.stock_synchronizer import StockSynchronizer


@pytest.mark.asyncio
async def test_item4_adjust_stock_cache_dependence_and_fractional_defect(db_session: AsyncSession):
    """
    ITEM 4 DEFECT REPRODUCTION:
    1. Product has initial authoritative ledger balance of 20.
    2. Stale cache simulation: product.stock is artificially desynced to 5.
    3. Calling adjust_stock(new_quantity=25) must compute delta from ledger (20),
       creating an ADJUSTMENT movement of +5, making final ledger balance 25.
       (In buggy code: delta = 25 - 5 = +20, making final ledger balance 40).
    4. Calling adjust_stock with fractional quantity (e.g. 15.5) must raise HTTP 422
       because products.stock is an integer column.
    """
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN", role=UserRole.SYSADMIN)

    # Ensure company and branch exist
    comp_obj = (await db_session.execute(select(Company).where(Company.id == comp_id))).scalar_one_or_none()
    if not comp_obj:
        db_session.add(Company(id=comp_id, name="Adjust Test Co", company_code="001"))
    br_obj = (await db_session.execute(select(Branch).where(Branch.id == "MAIN", Branch.company_id == comp_id))).scalar_one_or_none()
    if not br_obj:
        db_session.add(Branch(id="MAIN", company_id=comp_id, name="Main Branch", code="MAIN"))
    await db_session.flush()

    # Setup Warehouse
    wh = Warehouse(
        id=f"wh_adj_{uuid.uuid4().hex[:6]}",
        company_id=comp_id,
        code="WH-ADJ",
        name="Adjustment Warehouse"
    )
    db_session.add(wh)
    await db_session.flush()

    # Setup Canonical Item and Variant
    suffix = uuid.uuid4().hex[:6]
    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"ITEM_{suffix}",
        item_name=f"Adjust Item {suffix}",
        uom="PCS",
        is_active=True
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=f"SKU_{suffix}",
        variant_name=f"Adjust Variant {suffix}",
        is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    # Setup Product with initial authoritative ledger balance 20
    prod_id = f"prd_{suffix}"
    product = Product(
        id=prod_id,
        company_id=comp_id,
        branch_id="MAIN",
        item_id=item.id,
        item_variant_id=variant.id,
        code=variant.variant_sku,
        name="Adjustment Test Widget",
        barcode=f"BC_{suffix}",
        category="General",
        stock=20,
        tracking_mode="Standard",
        is_active=True
    )
    db_session.add(product)

    # Initial Opening Inward movement of 20 units
    init_mov = StockMovement(
        id=f"sm_init_{uuid.uuid4().hex[:6]}",
        company_id=comp_id,
        branch_id="MAIN",
        product_id=prod_id,
        item_id=item.id,
        variant_id=variant.id,
        product_name=product.name,
        sku=product.code,
        quantity=Decimal("20.00"),
        movement_type="INWARD_INITIAL",
        warehouse_id=wh.id,
        warehouse=wh.code,
        reference_doc_type="OPENING_BALANCE",
        reference_doc_id=prod_id,
    )
    db_session.add(init_mov)
    await db_session.commit()

    # 1. Test fractional quantity rejection (HTTP 422)
    inv_svc = InventoryService(db_session, tenant_ctx)
    with pytest.raises(HTTPException) as exc_info:
        await inv_svc.adjust_stock(
            product_id=prod_id,
            new_quantity=15.5,
            reason="Fractional adjustment attempt"
        )
    assert exc_info.value.status_code == 422, (
        f"Defect: fractional stock adjustment did not raise 422, got {exc_info.value.status_code}"
    )

    # 2. Simulate stale cache: artificially set product.stock = 5 (desynced from ledger which has 20)
    await db_session.execute(
        select(Product).where(Product.id == prod_id)
    )
    product.stock = 5
    await db_session.commit()

    # 3. Adjust stock to target 25.
    # Since ledger is 20, adjustment delta must be +5 (25 - 20).
    # Buggy code does delta = 25 - product.stock (5) = +20!
    mov = await inv_svc.adjust_stock(
        product_id=prod_id,
        new_quantity=25.0,
        reason="Physical audit adjustment"
    )

    # Defect Assertion: movement quantity must be exactly 5.0 (25 - 20), not 20.0
    assert Decimal(str(mov.quantity)) == Decimal("5.00"), (
        f"Defect: adjust_stock computed delta from stale cache: mov.quantity == {mov.quantity} (expected 5.00)"
    )

    # Verify final ledger stock is 25, not 40
    final_authoritative = await StockSynchronizer.sync_product_stock_cache(db_session, prod_id, comp_id)
    assert final_authoritative == Decimal("25.00"), (
        f"Defect: authoritative ledger balance is {final_authoritative} (expected 25.00)"
    )
    await db_session.refresh(product)
    assert product.stock == 25, f"Product cached stock is {product.stock} (expected 25)"
