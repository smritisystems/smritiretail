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
Classification: Item 6 Movement Types Vocabulary & Drift Audit Suite
"""

import ast
import re
import uuid
from pathlib import Path
from decimal import Decimal
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Company, Branch
from app.models.item_master import Item, ItemVariant
from app.models.inventory import Product, StockMovement, Warehouse
from app.services.stock_movement_types import (
    ALL_MOVEMENT_TYPES,
    INFLOW_MOVEMENT_TYPES,
    OUTFLOW_MOVEMENT_TYPES,
    SIGNED_MOVEMENT_TYPES,
)
from app.services.stock_synchronizer import StockSynchronizer


def test_item6_all_codebase_movement_types_are_classified():
    """
    ITEM 6 (b): Grep/collect every movement_type literal written under backend/app
    and assert each is classified in ALL_MOVEMENT_TYPES.
    """
    backend_app_dir = Path(__file__).resolve().parent.parent
    collected_literals = set()

    # Regex patterns matching movement_type assignments and kwargs
    pattern = re.compile(r'movement_type\s*[:=]\s*["\']([A-Za-z0-9_]+)["\']')

    for py_file in backend_app_dir.rglob("*.py"):
        try:
            content = py_file.read_text(encoding="utf-8")
        except Exception:
            continue
        for match in pattern.finditer(content):
            literal = match.group(1).upper()
            # Ignore test dummy names
            if literal in ("BOGUS_UNKNOWN_TYPE", "UNKNOWN_TYPE"):
                continue
            collected_literals.add(literal)

    assert len(collected_literals) > 0, "No movement_type literals discovered!"

    unclassified = collected_literals - ALL_MOVEMENT_TYPES
    assert not unclassified, (
        f"Found unclassified movement_type literals in backend/app: {unclassified}. "
        f"Every movement type must be classified in INFLOW, OUTFLOW, or SIGNED."
    )


@pytest.mark.asyncio
async def test_item6_unknown_movement_type_raises_in_synchronizer(db_session: AsyncSession):
    """
    ITEM 6 (b): Unknown types must raise ValueError in the synchronizer,
    not be silently ignored.
    """
    comp_id = "COMP-001"
    suffix = uuid.uuid4().hex[:6]

    comp_obj = (await db_session.execute(select(Company).where(Company.id == comp_id))).scalar_one_or_none()
    if not comp_obj:
        db_session.add(Company(id=comp_id, name="Vocab Test Co", company_code="001"))
    br_obj = (await db_session.execute(select(Branch).where(Branch.id == "MAIN", Branch.company_id == comp_id))).scalar_one_or_none()
    if not br_obj:
        db_session.add(Branch(id="MAIN", company_id=comp_id, name="Main Branch", code="MAIN"))
    await db_session.flush()

    # Setup Canonical Item and Variant
    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"ITEM_{suffix}",
        item_name=f"Vocab Item {suffix}",
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
        variant_name=f"Vocab Variant {suffix}",
        is_active=True
    )
    db_session.add(variant)
    await db_session.flush()

    prod_id = f"prd_{suffix}"
    product = Product(
        id=prod_id,
        company_id=comp_id,
        branch_id="MAIN",
        item_id=item.id,
        item_variant_id=variant.id,
        code=variant.variant_sku,
        name="Vocab Test Widget",
        barcode=f"BC_{suffix}",
        category="General",
        stock=10,
        tracking_mode="Standard",
        is_active=True
    )
    db_session.add(product)

    # Insert a stock movement with an UNKNOWN movement_type
    dummy_alien_type = "ALIEN_TYPE"
    bogus_mov = StockMovement(
        id=f"sm_bogus_{suffix}",
        company_id=comp_id,
        branch_id="MAIN",
        product_id=prod_id,
        item_id=item.id,
        variant_id=variant.id,
        product_name=product.name,
        sku=product.code,
        quantity=Decimal("5.00"),
        movement_type=dummy_alien_type,
        reference_doc_type="TEST",
        reference_doc_id="TEST-001",
    )
    db_session.add(bogus_mov)
    await db_session.commit()

    # Defect assertion: sync_product_stock_cache must raise ValueError on unclassified type!
    with pytest.raises(ValueError) as exc_info:
        await StockSynchronizer.sync_product_stock_cache(db_session, prod_id, comp_id)
    assert "Unclassified movement_type" in str(exc_info.value)
