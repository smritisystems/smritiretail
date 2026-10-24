"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.3
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Verification Suite: Item Master Phase 8 Multi-Tenant Scope Hardening & Triage
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    ItemBatch,
    ItemSerial,
    ItemWarehouseLocation,
)
from app.models.tenant import Company, Branch
from app.models.inventory import Warehouse
from app.services.item.item_review_triage_svc import ItemReviewTriageService


@pytest.mark.asyncio
async def test_company_id_not_null_enforced_on_item_variants(db_session):
    """
    Verifies that the database schema enforces NOT NULL on item_variants.company_id,
    preventing any unassigned or cross-tenant orphaned variant creation.
    """
    s = uuid.uuid4().hex[:6].upper()
    company_id = f"COMP-NN-{s}"
    branch_id = f"BR-NN-{s}"

    comp = Company(id=company_id, company_code=f"CNN{s}", name=f"Company {s}", is_active=True)
    db_session.add(comp)
    await db_session.flush()

    br = Branch(id=branch_id, company_id=company_id, code=f"BNN-{s}", name=f"Branch {s}", is_active=True)
    db_session.add(br)
    await db_session.flush()

    item = Item(
        id=f"itm_nn_{s}",
        company_id=company_id,
        branch_id=branch_id,
        item_code=f"NN-ITEM-{s}",
        style_code=f"NN-ITEM-{s}",
        item_name=f"NN Item {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        tracking_type="NONE",
        status="ACTIVE",
    )
    db_session.add(item)
    await db_session.flush()

    # Attempt to insert ItemVariant with company_id=None -> MUST RAISE IntegrityError
    var_orphan = ItemVariant(
        id=f"var_nn_{s}",
        company_id=None,
        branch_id=branch_id,
        item_id=item.id,
        variant_sku=f"NN-SKU-{s}",
        variant_name=f"Orphan SKU {s}",
        mrp=Decimal("1000.00"),
        selling_price=Decimal("900.00"),
        is_active=True,
    )
    db_session.add(var_orphan)
    with pytest.raises(IntegrityError):
        await db_session.commit()

    await db_session.rollback()


@pytest.mark.asyncio
async def test_backfill_child_company_ids_idempotent_execution(db_session):
    """
    Verifies that backfill_child_company_ids executes cleanly across all 5 child tables
    without errors and returns a valid backfill statistics report.
    """
    stats = await ItemReviewTriageService.backfill_child_company_ids(session=db_session, auto_commit=True)
    assert "item_variants" in stats
    assert "item_barcodes" in stats
    assert "item_batches" in stats
    assert "item_serials" in stats
    assert "item_warehouse_locations" in stats
    assert "total_backfilled" in stats
    assert stats["total_backfilled"] >= 0


@pytest.mark.asyncio
async def test_triage_activates_unassigned_items_with_statutory_uom(db_session):
    """
    Verifies that triage_requires_review_items resolves missing UOM
    and transitions ITM-UNASSIGNED-* items from REQUIRES_REVIEW to ACTIVE.
    """
    s = uuid.uuid4().hex[:6].upper()
    company_id = f"COMP-TRI-{s}"
    branch_id = f"BR-TRI-{s}"

    comp = Company(id=company_id, company_code=f"CTRI{s}", name=f"Company {s}", is_active=True)
    db_session.add(comp)
    await db_session.flush()

    br = Branch(id=branch_id, company_id=company_id, code=f"BTRI-{s}", name=f"Branch {s}", is_active=True)
    db_session.add(br)
    await db_session.flush()

    item_fw = Item(
        id=f"itm_unass_fw_{s}",
        company_id=company_id,
        branch_id=branch_id,
        item_code=f"ITM-UNASSIGNED-FW-{s}",
        style_code=f"ITM-UNASSIGNED-FW-{s}",
        item_name=f"Unassigned Shoe {s}",
        item_type="FINISHED_GOOD",
        category="Footwear",
        primary_uom=None,
        uom="EACH",
        tracking_type="NONE",
        status="REQUIRES_REVIEW",
    )
    item_gen = Item(
        id=f"itm_unass_gen_{s}",
        company_id=company_id,
        branch_id=branch_id,
        item_code=f"ITM-UNASSIGNED-GEN-{s}",
        style_code=f"ITM-UNASSIGNED-GEN-{s}",
        item_name=f"Unassigned Rice {s}",
        item_type="FINISHED_GOOD",
        category="General",
        primary_uom=None,
        uom="EACH",
        tracking_type="NONE",
        status="REQUIRES_REVIEW",
    )
    db_session.add_all([item_fw, item_gen])
    await db_session.commit()

    res = await ItemReviewTriageService.triage_requires_review_items(session=db_session, auto_commit=True)
    assert res["activated"] >= 2

    # Verify Footwear item
    await db_session.refresh(item_fw)
    assert item_fw.status == "ACTIVE"
    assert item_fw.primary_uom == "PRS"
    assert item_fw.uom == "PRS"

    # Verify General item
    await db_session.refresh(item_gen)
    assert item_gen.status == "ACTIVE"
    assert item_gen.primary_uom == "PCS"
    assert item_gen.uom == "PCS"


@pytest.mark.asyncio
async def test_triage_preserves_quarantined_items(db_session):
    """
    Verifies that triage_requires_review_items strictly preserves QUAR-*
    items in REQUIRES_REVIEW status without auto-activation.
    """
    s = uuid.uuid4().hex[:6].upper()
    company_id = f"COMP-QUR-{s}"
    branch_id = f"BR-QUR-{s}"

    comp = Company(id=company_id, company_code=f"CQUR{s}", name=f"Company {s}", is_active=True)
    db_session.add(comp)
    await db_session.flush()

    br = Branch(id=branch_id, company_id=company_id, code=f"BQUR-{s}", name=f"Branch {s}", is_active=True)
    db_session.add(br)
    await db_session.flush()

    quar_item = Item(
        id=f"itm_quar_{s}",
        company_id=company_id,
        branch_id=branch_id,
        item_code=f"QUAR-TEST-{s}",
        style_code=f"QUAR-TEST-{s}",
        item_name=f"Quarantined Item {s}",
        item_type="FINISHED_GOOD",
        category="Quarantine",
        primary_uom="PCS",
        uom="PCS",
        tracking_type="NONE",
        status="REQUIRES_REVIEW",
    )
    db_session.add(quar_item)
    await db_session.commit()

    res = await ItemReviewTriageService.triage_requires_review_items(session=db_session, auto_commit=True)
    assert res["preserved_quarantine"] >= 1

    await db_session.refresh(quar_item)
    assert quar_item.status == "REQUIRES_REVIEW"
