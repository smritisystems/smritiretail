"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.4
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Verification Test Suite:
Item Master Phase 9 — Price Discrepancy & Price Book Synchronization
"""

import uuid
import pytest
from decimal import Decimal
from sqlalchemy import select

from app.models.item_master import Item, ItemVariant, ItemSalesSetting
from app.models.pricing import PriceBook, PriceBookEntry
from app.models.tenant import Company, Branch
from app.services.item.item_pricing_sync_svc import ItemPricingSyncService


@pytest.mark.asyncio
async def test_reconcile_prices_inherits_parent_when_variant_zero(db_session):
    """
    Verifies that a variant with 0 selling_price inherits parent item price.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-PR1-{s}"
    br_id = f"BR-PR1-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CPR1{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BPR1-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_pr1_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-PR1-{s}",
        style_code=f"ITM-PR1-{s}",
        item_name=f"Price Test Item 1 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        selling_price=Decimal("1500.00"),
        mrp=Decimal("1800.00"),
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_pr1_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_id=item.id,
        variant_sku=f"SKU-PR1-{s}",
        variant_name=f"Variant 1 {s}",
        selling_price=Decimal("0.00"),
        mrp=Decimal("0.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ItemPricingSyncService.harmonize_catalog_prices(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["variants_inherited_from_item"] >= 1

    await db_session.refresh(variant)
    assert variant.selling_price == Decimal("1500.00")
    assert variant.mrp == Decimal("1800.00")


@pytest.mark.asyncio
async def test_reconcile_prices_inherits_variant_when_item_zero(db_session):
    """
    Verifies that a parent item with 0 selling_price inherits representative variant price.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-PR2-{s}"
    br_id = f"BR-PR2-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CPR2{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BPR2-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_pr2_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-PR2-{s}",
        style_code=f"ITM-PR2-{s}",
        item_name=f"Price Test Item 2 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        selling_price=Decimal("0.00"),
        mrp=Decimal("0.00"),
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_pr2_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_id=item.id,
        variant_sku=f"SKU-PR2-{s}",
        variant_name=f"Variant 2 {s}",
        selling_price=Decimal("999.00"),
        mrp=Decimal("1299.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ItemPricingSyncService.harmonize_catalog_prices(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["items_inherited_from_variant"] >= 1

    await db_session.refresh(item)
    assert item.selling_price == Decimal("999.00")
    assert item.mrp == Decimal("1299.00")


@pytest.mark.asyncio
async def test_sync_price_book_entries_creates_entries(db_session):
    """
    Verifies that sync_default_price_book_entries provisions PriceBookEntry
    for unlinked variants in the default company price book.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-PR3-{s}"
    br_id = f"BR-PR3-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CPR3{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BPR3-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_pr3_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-PR3-{s}",
        style_code=f"ITM-PR3-{s}",
        item_name=f"Price Test Item 3 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        selling_price=Decimal("799.00"),
        mrp=Decimal("999.00"),
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_pr3_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_id=item.id,
        variant_sku=f"SKU-PR3-{s}",
        variant_name=f"Variant 3 {s}",
        selling_price=Decimal("799.00"),
        mrp=Decimal("999.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ItemPricingSyncService.sync_default_price_book_entries(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["entries_created"] >= 1

    # Verify PBE existence
    pbe_stmt = select(PriceBookEntry).where(
        PriceBookEntry.company_id == comp_id,
        PriceBookEntry.variant_id == variant.id,
    )
    pbe = (await db_session.execute(pbe_stmt)).scalar_one_or_none()
    assert pbe is not None
    assert pbe.selling_price == Decimal("799.00")
    assert pbe.mrp == Decimal("999.00")


@pytest.mark.asyncio
async def test_sync_sales_settings_upserts_correctly(db_session):
    """
    Verifies that sync_item_sales_settings populates ItemSalesSetting.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-PR4-{s}"
    br_id = f"BR-PR4-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CPR4{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BPR4-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    item = Item(
        id=f"itm_pr4_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-PR4-{s}",
        style_code=f"ITM-PR4-{s}",
        item_name=f"Price Test Item 4 {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        selling_price=Decimal("1299.00"),
        mrp=Decimal("1599.00"),
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_pr4_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_id=item.id,
        variant_sku=f"SKU-PR4-{s}",
        variant_name=f"Variant 4 {s}",
        selling_price=Decimal("1299.00"),
        mrp=Decimal("1599.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ItemPricingSyncService.sync_item_sales_settings(
        session=db_session, company_id=comp_id, auto_commit=True
    )
    assert res["sales_settings_created"] >= 1

    # Verify ItemSalesSetting record
    ss_stmt = select(ItemSalesSetting).where(ItemSalesSetting.item_variant_id == variant.id)
    ss = (await db_session.execute(ss_stmt)).scalar_one_or_none()
    assert ss is not None
    assert ss.selling_price == Decimal("1299.00")
    assert ss.mrp == Decimal("1599.00")
    assert ss.allow_discount is True
    assert ss.billable is True
