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
Classification: Item 5 POST /inventory/stock-movements Validation Suite
"""

import uuid
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Company, Branch
from app.models.item_master import Item, ItemVariant
from app.models.inventory import Product, StockMovement, Warehouse, ProductBatchStock
from app.schemas.inventory import StockMovementCreate
from app.api.v1.inventory import create_stock_movement


@pytest.mark.asyncio
async def test_item5_post_movements_validation_and_idempotency(db_session: AsyncSession):
    """
    ITEM 5 DEFECT REPRODUCTION:
    1. Unknown movement_type must be rejected with 422.
    2. Missing reference_doc_type or reference_doc_id must be rejected with 422.
    3. Duplicate post must be idempotent (return existing movement, single row in DB).
    4. ProductBatchStock must be updated when batch is supplied.
    5. Stock cache (products.stock) must match authoritative ledger after post.
    """
    comp_id = "COMP-001"

    # Setup Company and Branch
    comp_obj = (await db_session.execute(select(Company).where(Company.id == comp_id))).scalar_one_or_none()
    if not comp_obj:
        db_session.add(Company(id=comp_id, name="Movement Test Co", company_code="001"))
    br_obj = (await db_session.execute(select(Branch).where(Branch.id == "MAIN", Branch.company_id == comp_id))).scalar_one_or_none()
    if not br_obj:
        db_session.add(Branch(id="MAIN", company_id=comp_id, name="Main Branch", code="MAIN"))
    await db_session.flush()

    # Setup Warehouse
    wh = Warehouse(
        id=f"wh_mv_{uuid.uuid4().hex[:6]}",
        company_id=comp_id,
        code="WH-MV",
        name="Movement Warehouse"
    )
    db_session.add(wh)
    await db_session.flush()

    # Setup Canonical Item and Variant
    suffix = uuid.uuid4().hex[:6]
    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"ITEM_{suffix}",
        item_name=f"Move Item {suffix}",
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
        variant_name=f"Move Variant {suffix}",
        is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    # Setup Product with initial cache = 0
    prod_id = f"prd_{suffix}"
    product = Product(
        id=prod_id,
        company_id=comp_id,
        branch_id="MAIN",
        item_id=item.id,
        item_variant_id=variant.id,
        code=variant.variant_sku,
        name="Movement Test Widget",
        barcode=f"BC_{suffix}",
        category="General",
        stock=0,
        tracking_mode="Standard",
        is_active=True
    )
    db_session.add(product)
    await db_session.commit()

    # 1. Defect test: Unknown movement_type -> must raise 422
    invalid_mov_in = StockMovementCreate(
        product_id=prod_id,
        product_name=product.name,
        sku=product.code,
        quantity=Decimal("10.00"),
        movement_type="BOGUS_UNKNOWN_TYPE",
        reference_doc_type="GRN",
        reference_doc_id="GRN-001",
    )
    with pytest.raises(HTTPException) as exc_info:
        await create_stock_movement(movement_in=invalid_mov_in, db=db_session)
    assert exc_info.value.status_code == 422, (
        f"Defect: Unknown movement_type did not raise 422, got {exc_info.value.status_code}"
    )

    # 2. Defect test: Missing reference_doc_type -> must raise 422
    missing_ref_in = StockMovementCreate(
        product_id=prod_id,
        product_name=product.name,
        sku=product.code,
        quantity=Decimal("10.00"),
        movement_type="INWARD_GRN",
        reference_doc_type=None,
        reference_doc_id="GRN-001",
    )
    with pytest.raises(HTTPException) as exc_info:
        await create_stock_movement(movement_in=missing_ref_in, db=db_session)
    assert exc_info.value.status_code == 422

    # 3. Valid movement creation with batch
    batch_no = f"BATCH_{suffix}"
    valid_mov_in = StockMovementCreate(
        product_id=prod_id,
        product_name=product.name,
        sku=product.code,
        quantity=Decimal("15.00"),
        movement_type="INWARD_GRN",
        reference_doc_type="GRN",
        reference_doc_id=f"GRN_{suffix}",
        warehouse=wh.id,
        batch=batch_no,
    )
    created_mov = await create_stock_movement(movement_in=valid_mov_in, db=db_session)
    assert created_mov is not None

    # 4. Idempotency test: duplicate post must return existing row and not insert duplicate
    duplicate_mov = await create_stock_movement(movement_in=valid_mov_in, db=db_session)
    assert duplicate_mov.id == created_mov.id

    rows_res = await db_session.execute(
        select(StockMovement).where(
            StockMovement.company_id == comp_id,
            StockMovement.reference_doc_type == "GRN",
            StockMovement.reference_doc_id == f"GRN_{suffix}",
            StockMovement.product_id == prod_id,
            StockMovement.movement_type == "INWARD_GRN",
        )
    )
    assert len(rows_res.scalars().all()) == 1, "Defect: duplicate post created multiple rows!"

    # 5. Verify batch stock was updated
    batch_res = await db_session.execute(
        select(ProductBatchStock).where(
            ProductBatchStock.company_id == comp_id,
            ProductBatchStock.product_id == prod_id,
            ProductBatchStock.batch_no == batch_no,
        )
    )
    batch_obj = batch_res.scalar_one_or_none()
    assert batch_obj is not None, "Defect: ProductBatchStock was not created/updated for supplied batch"
    assert Decimal(str(batch_obj.quantity)) == Decimal("15.00")

    # 6. Verify cache matches authoritative ledger
    await db_session.refresh(product)
    assert product.stock == 15, f"Defect: products.stock ({product.stock}) was not synced to ledger (15)"
