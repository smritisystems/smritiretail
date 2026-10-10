"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.6
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Verification Test Suite:
Item Master Phase 11 — Tracking Mode Harmonization & Database Constraint Enactment
"""

import uuid
import pytest
from sqlalchemy.exc import IntegrityError

from app.models.item_master import Item
from app.models.tenant import Company, Branch
from app.services.item.item_tracking_sync_svc import ItemTrackingSyncService


@pytest.mark.asyncio
async def test_chk_no_dual_tracking_constraint_rejection(db_session):
    """
    Verifies that the database rejects any attempt to insert an item
    with both is_batch_tracked=True and is_serial_tracked=True.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-TM1-{s}"
    br_id = f"BR-TM1-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CTM1{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BTM1-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    invalid_item = Item(
        id=f"itm_tm1_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-TM1-{s}",
        style_code=f"ITM-TM1-{s}",
        item_name=f"Dual Tracking Invalid Item {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_mode="BATCH",
        tracking_type="BATCH",
        is_batch_tracked=True,
        is_serial_tracked=True,  # VIOLATION: Both cannot be True!
        status="ACTIVE",
    )
    db_session.add(invalid_item)

    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()

    await db_session.rollback()
    assert "chk_no_dual_tracking" in str(exc_info.value).lower() or "dual_tracking" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_chk_tracking_mode_matches_flags_constraint_rejection(db_session):
    """
    Verifies that the database rejects an item where tracking_mode does not
    match the boolean tracking flags (e.g. mode is BATCH but is_batch_tracked=False).
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-TM2-{s}"
    br_id = f"BR-TM2-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CTM2{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BTM2-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    mismatched_item = Item(
        id=f"itm_tm2_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-TM2-{s}",
        style_code=f"ITM-TM2-{s}",
        item_name=f"Mismatched Tracking Item {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_mode="BATCH",    # Declared BATCH mode
        tracking_type="BATCH",
        is_batch_tracked=False,   # VIOLATION: Flag is False!
        is_serial_tracked=False,
        status="ACTIVE",
    )
    db_session.add(mismatched_item)

    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()

    await db_session.rollback()
    assert "chk_tracking_mode_matches_flags" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_valid_tracking_configurations_accepted(db_session):
    """
    Verifies that valid BATCH, SERIAL, and NONE configurations are accepted by the database.
    """
    s = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-TM3-{s}"
    br_id = f"BR-TM3-{s}"

    db_session.add(Company(id=comp_id, company_code=f"CTM3{s}", name=f"Company {s}", is_active=True))
    db_session.add(Branch(id=br_id, company_id=comp_id, code=f"BTM3-{s}", name=f"Branch {s}", is_active=True))
    await db_session.flush()

    batch_item = Item(
        id=f"itm_batch_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-BATCH-{s}",
        style_code=f"ITM-BATCH-{s}",
        item_name=f"Valid Batch Item {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_mode="BATCH",
        tracking_type="BATCH",
        is_batch_tracked=True,
        is_serial_tracked=False,
        status="ACTIVE",
    )
    serial_item = Item(
        id=f"itm_serial_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-SERIAL-{s}",
        style_code=f"ITM-SERIAL-{s}",
        item_name=f"Valid Serial Item {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_mode="SERIAL",
        tracking_type="SERIAL",
        is_batch_tracked=False,
        is_serial_tracked=True,
        status="ACTIVE",
    )
    none_item = Item(
        id=f"itm_none_{s}",
        company_id=comp_id,
        branch_id=br_id,
        item_code=f"ITM-NONE-{s}",
        style_code=f"ITM-NONE-{s}",
        item_name=f"Valid Standard Item {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_mode="NONE",
        tracking_type="NONE",
        is_batch_tracked=False,
        is_serial_tracked=False,
        status="ACTIVE",
    )

    db_session.add_all([batch_item, serial_item, none_item])
    await db_session.commit()

    await db_session.refresh(batch_item)
    await db_session.refresh(serial_item)
    await db_session.refresh(none_item)

    assert batch_item.tracking_mode == "BATCH" and batch_item.is_batch_tracked is True
    assert serial_item.tracking_mode == "SERIAL" and serial_item.is_serial_tracked is True
    assert none_item.tracking_mode == "NONE" and none_item.is_batch_tracked is False


@pytest.mark.asyncio
async def test_item_tracking_sync_service_idempotence(db_session):
    """
    Verifies that ItemTrackingSyncService runs cleanly and idempotently across the catalog.
    """
    res = await ItemTrackingSyncService.harmonize_tracking_modes(
        session=db_session, auto_commit=True
    )
    assert "batch_items_harmonized" in res
    assert "serial_items_harmonized" in res
    assert "none_items_aligned" in res
    assert res["dual_conflicts_resolved"] == 0
