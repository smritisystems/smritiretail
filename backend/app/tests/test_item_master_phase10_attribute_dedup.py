"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.5
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Verification Test Suite:
Item Master Phase 10 — Variant-Level Attribute Deduplication
"""

import uuid
import pytest
from decimal import Decimal
from sqlalchemy import select

from app.models.item_master import Item, ItemVariant
from app.models.tenant import Company, Branch
from app.services.item.item_attribute_sync_svc import ItemAttributeSyncService


@pytest.mark.asyncio
async def test_variant_inherits_item_color_and_size(db_session):
    """
    Verifies that a variant missing color and size inherits from parent item.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-AT1-{s}"
    br_id = f"BR-AT1-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CAT1{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BAT1-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_at1_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-AT1-{s}",
        style_code=f"ITM-AT1-{s}",
        item_name=f"Attribute Test Item 1 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        color="NAVY",
        size="42",
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_at1_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_id=item.id,
        variant_sku=f"SKU-AT1-{s}",
        variant_name=f"Variant 1 {s}",
        color=None,
        size=None,
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ItemAttributeSyncService.backfill_missing_variant_attributes(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["variant_color_inherited"] >= 1
    assert res["variant_size_inherited"] >= 1

    await db_session.refresh(variant)
    assert variant.color == "NAVY"
    assert variant.size == "42"


@pytest.mark.asyncio
async def test_variant_preserves_existing_attributes(db_session):
    """
    Verifies that existing variant-specific color and size are NOT overwritten by item attributes.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-AT2-{s}"
    br_id = f"BR-AT2-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CAT2{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BAT2-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_at2_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-AT2-{s}",
        style_code=f"ITM-AT2-{s}",
        item_name=f"Attribute Test Item 2 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        color="NAVY",
        size="42",
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_at2_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_id=item.id,
        variant_sku=f"SKU-AT2-{s}",
        variant_name=f"Variant 2 {s}",
        color="BLACK",
        size="38",
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ItemAttributeSyncService.backfill_missing_variant_attributes(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["variant_color_inherited"] == 0
    assert res["variant_size_inherited"] == 0

    await db_session.refresh(variant)
    assert variant.color == "BLACK"
    assert variant.size == "38"


@pytest.mark.asyncio
async def test_parse_structured_sku_attributes(db_session):
    """
    Verifies that recognized color and size tokens in SKU strings are parsed into variant attributes.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-AT3-{s}"
    br_id = f"BR-AT3-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CAT3{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BAT3-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_at3_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-AT3-{s}",
        style_code=f"ITM-AT3-{s}",
        item_name=f"Attribute Test Item 3 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        color=None,
        size=None,
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_at3_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_id=item.id,
        variant_sku=f"STYLE-A1-BLK-40",
        variant_name=f"Style A1 Black 40",
        color=None,
        size=None,
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ItemAttributeSyncService.parse_structured_sku_attributes(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["variant_color_parsed"] >= 1
    assert res["variant_size_parsed"] >= 1

    await db_session.refresh(variant)
    assert variant.color == "BLACK"
    assert variant.size == "40"


@pytest.mark.asyncio
async def test_retire_style_level_attributes(db_session):
    """
    Verifies that retire_style_level_attributes clears color and size on items to NULL.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-AT4-{s}"
    br_id = f"BR-AT4-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CAT4{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BAT4-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_at4_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-AT4-{s}",
        style_code=f"ITM-AT4-{s}",
        item_name=f"Attribute Test Item 4 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        color="RED",
        size="XL",
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.commit()

    res = await ItemAttributeSyncService.retire_style_level_attributes(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["style_attributes_retired"] >= 1

    await db_session.refresh(item)
    assert item.color is None
    assert item.size is None
