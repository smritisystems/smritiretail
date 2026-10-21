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
Classification: Item 3 Stock Transfer Sign & Warehouse Verification Suite
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
async def test_item3_transfer_stock_sign_bug_reproduction(db_session: AsyncSession):
    """
    ITEM 3 DEFECT REPRODUCTION:
    1. Product has initial ledger stock of 20.
    2. Calling transfer_stock(quantity=5) must post TRANSFER_OUT and TRANSFER_IN pair.
    3. Net effect on product.stock must be ZERO (remains 20).
    4. StockSynchronizer.sync_product_stock_cache must return 20.
    5. Insufficient stock at source warehouse must be rejected.
    """
    comp_id = "COMP-001"
    tenant_ctx = TenantContext(company_id=comp_id, branch_id="MAIN", role=UserRole.SYSADMIN)

    comp_obj = (await db_session.execute(select(Company).where(Company.id == comp_id))).scalar_one_or_none()
    if not comp_obj:
        db_session.add(Company(id=comp_id, name="Transfer Test Co", company_code="001"))
    br_obj = (await db_session.execute(select(Branch).where(Branch.id == "MAIN", Branch.company_id == comp_id))).scalar_one_or_none()
    if not br_obj:
        db_session.add(Branch(id="MAIN", company_id=comp_id, name="Main Branch", code="MAIN"))
    await db_session.flush()

    # Setup Warehouses
    wh_source = Warehouse(
        id=f"wh_src_{uuid.uuid4().hex[:6]}",
        company_id=comp_id,
        code="WH-SRC",
        name="Source Warehouse"
    )
    wh_dest = Warehouse(
        id=f"wh_dst_{uuid.uuid4().hex[:6]}",
        company_id=comp_id,
        code="WH-DST",
        name="Destination Warehouse"
    )
    db_session.add(wh_source)
    db_session.add(wh_dest)
    await db_session.flush()

    # Setup Canonical Item and Variant
    suffix = uuid.uuid4().hex[:6]
    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"ITEM_{suffix}",
        item_name=f"Trans Item {suffix}",
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
        variant_name=f"Trans Variant {suffix}",
        is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    # Setup Product with initial stock of 20
    prod_id = f"prd_{suffix}"
    product = Product(
        id=prod_id,
        company_id=comp_id,
        branch_id="MAIN",
        item_id=item.id,
        item_variant_id=variant.id,
        code=variant.variant_sku,
        name="Transfer Test Widget",
        barcode=f"BC_{suffix}",
        category="General",
        stock=20,
        tracking_mode="Standard",
        is_active=True
    )
    db_session.add(product)

    # Initial Opening Inward movement of 20 units into wh_source
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
        warehouse_id=wh_source.id,
        warehouse=wh_source.code,
        reference_doc_type="OPENING_BALANCE",
        reference_doc_id=prod_id,
    )
    db_session.add(init_mov)
    await db_session.commit()

    # Pre-transfer stock cache sync
    synced_stock = await StockSynchronizer.sync_product_stock_cache(db_session, prod_id, comp_id)
    assert synced_stock == Decimal("20.00")

    inv_svc = InventoryService(db_session, tenant_ctx)

    # Execute stock transfer of 5 units from wh_source to wh_dest
    await inv_svc.transfer_stock(
        product_id=prod_id,
        from_warehouse=wh_source.id,
        to_warehouse=wh_dest.id,
        quantity=5.0,
        remarks="Test transfer 5 units"
    )

    # Verify that products.stock remains 20 and not 25!
    await db_session.refresh(product)
    synced_after = await StockSynchronizer.sync_product_stock_cache(db_session, prod_id, comp_id)

    # Fetch movements created for this transfer
    moves_res = await db_session.execute(
        select(StockMovement).where(
            StockMovement.company_id == comp_id,
            StockMovement.product_id == prod_id,
            StockMovement.movement_type.in_(["TRANSFER", "TRANSFER_OUT", "TRANSFER_IN"])
        )
    )
    transfer_moves = moves_res.scalars().all()

    # DEFECT REPRODUCTION ASSERTIONS:
    # 1. Exactly 2 movements (TRANSFER_OUT and TRANSFER_IN), not a single signed "TRANSFER"
    assert len(transfer_moves) == 2, (
        f"Defect: expected 2 movements (TRANSFER_OUT + TRANSFER_IN), found {len(transfer_moves)}: "
        f"{[m.movement_type for m in transfer_moves]}"
    )
    types = {m.movement_type for m in transfer_moves}
    assert types == {"TRANSFER_OUT", "TRANSFER_IN"}

    # 2. Net stock effect is ZERO: product.stock must be 20, synced_after must be 20
    assert product.stock == 20, f"Defect: transfer mutated product.stock to {product.stock} (expected 20)"
    assert synced_after == Decimal("20.00"), f"Defect: synchronizer computed {synced_after} (expected 20.00)"

    # 3. Insufficient source stock validation
    with pytest.raises(HTTPException) as exc_info:
        await inv_svc.transfer_stock(
            product_id=prod_id,
            from_warehouse=wh_source.id,
            to_warehouse=wh_dest.id,
            quantity=100.0,  # Wh source only has 15 remaining
            remarks="Exceeding transfer"
        )
    assert exc_info.value.status_code in (400, 422)
