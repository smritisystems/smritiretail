"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI DataBridge Phase 2 Catalog Adapters
"""

import uuid
from decimal import Decimal
from typing import Dict, Any
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.security import create_access_token
from app.models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    ItemUOMSetting,
    ItemPrice,
)
from app.models.pricing import PriceBook, PriceBookEntry
from app.models.capability_template import TenantCapabilityBinding
from app.api.v1.databridge import require_databridge_entitlement
from app.services.databridge.service import DataBridgeService
from app.services.databridge.models import (
    DataBridgeClassification,
    DataBridgeEntityType,
    DataBridgePreviewRequest,
    DataBridgeCommitRequest,
)
from app.services.databridge.exceptions import (
    DataBridgeTenantIsolationError,
    DataBridgeCommitConfirmationError,
    DataBridgeStalePreviewError,
    DataBridgeAtomicRollbackError,
    DataBridgeValidationError,
)

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        # Set session info to emulate tenant resolution
        session.info["resolved_database_name"] = "smriti001"
        yield session
    await engine.dispose()


def _get_auth_headers(
    role: str = "SYSADMIN",
    company_id: str = "COMP-001",
    branch_id: str = "BR-001",
    tenant_id: str = "smriti001",
):
    token = create_access_token(
        data={
            "sub": "usr-test-runner",
            "role": role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": tenant_id,
            "db_name": tenant_id,
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
        "X-Branch-ID": branch_id,
    }


# ==============================================================================
# TC-CAT-001: New Item Master
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_001_new_item_master(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    item_code = f"ART-NEW-{suffix}"
    rows = [
        {
            "item_code": item_code,
            "item_name": f"New Style {suffix}",
            "brand": "SMRITI",
            "category": "Footwear",
            "department": "FOOTWEAR",
            "primary_uom": "Pair",
            "tax_rate": 18.0,
            "mrp": 2999.00,
            "selling_price": 2499.00,
            "cost_price": 1200.00,
        }
    ]

    # Preview
    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.create_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.CREATE

    # Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert commit_res.status == "COMMITTED"
    assert commit_res.committed_count == 1

    # Verify DB persistence
    saved_item = (await db_session.execute(
        select(Item).where(Item.company_id == comp_id, Item.item_code == item_code)
    )).scalars().first()
    assert saved_item is not None
    assert saved_item.item_name == f"New Style {suffix}"


# ==============================================================================
# TC-CAT-002: Existing Item No-Op
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_002_existing_item_no_op(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    item_code = f"ART-EX-{suffix}"
    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=item_code,
        item_name=f"Existing Style {suffix}",
        brand="SMRITI",
        category="Footwear",
        department="FOOTWEAR",
        primary_uom="Pair",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    rows = [
        {
            "item_code": item_code,
            "item_name": f"Existing Style {suffix}",
            "brand": "SMRITI",
            "category": "Footwear",
            "department": "FOOTWEAR",
            "primary_uom": "Pair",
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.no_change_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.NO_CHANGE
    assert len(prev_res.items[0].diff.fields) == 0


# ==============================================================================
# TC-CAT-003: Existing Item Metadata Update
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_003_existing_item_metadata_update(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    item_code = f"ART-UPD-{suffix}"
    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=item_code,
        item_name=f"Style Old Name {suffix}",
        brand="GENERIC",
        category="Apparel",
        department="APPAREL",
        primary_uom="Pcs",
        collection_type="BASIC",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    rows = [
        {
            "item_code": item_code,
            "item_name": f"Style New Name {suffix}",
            "brand": "GENERIC",
            "category": "Apparel",
            "department": "APPAREL",
            "primary_uom": "Pcs",
            "collection_type": "CASUAL",
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.update_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.UPDATE
    assert "item_name" in prev_res.items[0].diff.fields
    assert "collection_type" in prev_res.items[0].diff.fields

    # Commit update
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert commit_res.committed_count == 1
    assert item.item_name == f"Style New Name {suffix}"
    assert item.collection_type == "CASUAL"


# ==============================================================================
# TC-CAT-004: New Variant Expansion
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_004_new_variant_expansion(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    # Seed parent item
    parent_code = f"ART-PAR-{suffix}"
    parent = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=parent_code,
        item_name=f"Parent Style {suffix}",
        brand="SMRITI",
        category="Footwear",
        department="FOOTWEAR",
        primary_uom="Pair",
        tax_rate=Decimal("18.00"),
        is_active=True,
    )
    db_session.add(parent)
    await db_session.flush()

    variant_sku = f"{parent_code}-BLK-38"
    rows = [
        {
            "item_code": parent_code,
            "variant_sku": variant_sku,
            "color": "BLACK",
            "size": "38",
            "primary_uom": "Pair",
            "mrp": 1999.00,
            "selling_price": 1699.00,
            "cost_price": 800.00,
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.VARIANT, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.create_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.CREATE

    # Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.VARIANT,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert commit_res.committed_count == 1

    # Check child policies created
    saved_var = (await db_session.execute(
        select(ItemVariant).where(ItemVariant.company_id == comp_id, ItemVariant.variant_sku == variant_sku)
    )).scalars().first()
    assert saved_var is not None
    assert saved_var.color == "BLACK"
    assert saved_var.size == "38"
    assert saved_var.variant_name is not None

    saved_uom = (await db_session.execute(
        select(ItemUOMSetting).where(ItemUOMSetting.item_variant_id == saved_var.id)
    )).scalars().first()
    assert saved_uom is not None

    saved_price = (await db_session.execute(
        select(ItemPrice).where(ItemPrice.item_variant_id == saved_var.id)
    )).scalars().first()
    assert saved_price is not None
    assert saved_price.mrp == Decimal("1999.00")


# ==============================================================================
# TC-CAT-005: Existing Variant Replay
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_005_existing_variant_replay(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    parent = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"ART-{suffix}",
        item_name=f"Parent {suffix}",
        brand="SMRITI",
        category="Footwear",
        department="FOOTWEAR",
        primary_uom="Pair",
        is_active=True,
    )
    variant = ItemVariant(
        id=f"var_{suffix}",
        company_id=comp_id,
        item_id=parent.id,
        variant_sku=f"ART-{suffix}-BLU-38",
        variant_name=f"Parent {suffix} (BLUE 38)",
        color="BLUE",
        size="38",
        mrp=Decimal("1500.00"),
        selling_price=Decimal("1200.00"),
        is_active=True,
    )
    db_session.add_all([parent, variant])
    await db_session.flush()

    rows = [
        {
            "item_code": parent.item_code,
            "variant_sku": variant.variant_sku,
            "color": "BLUE",
            "size": "38",
            "primary_uom": "Pair",
            "mrp": 1500.00,
            "selling_price": 1200.00,
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.VARIANT, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.no_change_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.NO_CHANGE


# ==============================================================================
# TC-CAT-006: Idempotent Barcode Replay (Rule 1)
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_006_idempotent_barcode_replay(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    parent = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ART-{suffix}", item_name=f"P {suffix}", is_active=True)
    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=parent.id, variant_sku=f"SKU-{suffix}", variant_name=f"V {suffix}", is_active=True)
    barcode = ItemBarcode(
        id=f"ibc_{suffix}",
        company_id=comp_id,
        item_id=parent.id,
        variant_id=variant.id,
        barcode=f"8901{suffix}",
        is_primary=True,
        is_active=True,
    )
    db_session.add_all([parent, variant, barcode])
    await db_session.flush()

    rows = [
        {
            "barcode": f"8901{suffix}",
            "variant_sku": f"SKU-{suffix}",
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.BARCODE, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.no_change_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.NO_CHANGE


# ==============================================================================
# TC-CAT-007: Barcode Cross-SKU Clash (Rule 2 — Hard Block)
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_007_barcode_cross_sku_clash(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    parent = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ART-{suffix}", item_name=f"P {suffix}", is_active=True)
    var1 = ItemVariant(id=f"var_{suffix}_1", company_id=comp_id, item_id=parent.id, variant_sku=f"SKU-ORIGINAL-{suffix}", variant_name=f"V1 {suffix}", is_active=True)
    var2 = ItemVariant(id=f"var_{suffix}_2", company_id=comp_id, item_id=parent.id, variant_sku=f"SKU-OTHER-{suffix}", variant_name=f"V2 {suffix}", is_active=True)
    shared_barcode = f"8909{suffix}"
    barcode = ItemBarcode(
        id=f"ibc_{suffix}",
        company_id=comp_id,
        item_id=parent.id,
        variant_id=var1.id,
        barcode=shared_barcode,
        is_primary=True,
        is_active=True,
    )
    db_session.add_all([parent, var1, var2, barcode])
    await db_session.flush()

    # Attempt to assign existing barcode to different SKU
    rows = [
        {
            "barcode": shared_barcode,
            "variant_sku": f"SKU-OTHER-{suffix}",
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.BARCODE, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is False
    assert prev_res.summary.conflict_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.EXISTING_CONFLICT
    assert any("already bound" in reason for reason in prev_res.blocking_reasons)


# ==============================================================================
# TC-CAT-008: Missing Mandatory Lookup
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_008_missing_mandatory_lookup(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    rows = [
        {
            "item_code": f"ART-UNSEEDED-{suffix}",
            "item_name": "Test Item",
            "gender": "UNSEEDED_GENDER_VALUE",  # Mandatory controlled field without master lookup
            "category": "Footwear",
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is False
    assert prev_res.summary.validation_error_count >= 1
    assert prev_res.items[0].classification == DataBridgeClassification.VALIDATION_ERROR


# ==============================================================================
# TC-CAT-009: In-File Duplicate Row
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_009_in_file_duplicate_row(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    duplicate_code = f"ART-DUP-{suffix}"
    rows = [
        {"item_code": duplicate_code, "item_name": "Row 1", "category": "Footwear", "brand": "SMRITI", "primary_uom": "Pair"},
        {"item_code": duplicate_code, "item_name": "Row 2", "category": "Footwear", "brand": "SMRITI", "primary_uom": "Pair"},
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is False
    assert prev_res.items[1].classification == DataBridgeClassification.VALIDATION_ERROR
    assert any("Duplicate item code" in c.message for c in prev_res.items[1].conflicts)


# ==============================================================================
# TC-CAT-010: PriceBook Entry Creation
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_010_pricebook_entry_creation(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    parent = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ART-{suffix}", item_name=f"P {suffix}", is_active=True)
    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=parent.id, variant_sku=f"SKU-{suffix}", variant_name=f"V {suffix}", is_active=True)
    db_session.add_all([parent, variant])
    await db_session.flush()

    rows = [
        {
            "variant_sku": variant.variant_sku,
            "min_quantity": 1.0,
            "mrp": 2500.00,
            "selling_price": 2200.00,
            "cost_price": 1100.00,
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.PRICEBOOK, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.create_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.CREATE

    # Commit
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.PRICEBOOK,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert commit_res.committed_count == 1

    saved_pbe = (await db_session.execute(
        select(PriceBookEntry).where(PriceBookEntry.company_id == comp_id, PriceBookEntry.variant_id == variant.id)
    )).scalars().first()
    assert saved_pbe is not None
    assert saved_pbe.selling_price == Decimal("2200.00")


# ==============================================================================
# TC-CAT-011: PriceBook Entry Update
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_011_pricebook_entry_update(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    pb = PriceBook(id=f"pb_{suffix}", company_id=comp_id, code=f"DEFAULT-{comp_id}", name="Retail", is_default=True, is_active=True)
    parent = Item(id=f"itm_{suffix}", company_id=comp_id, item_code=f"ART-{suffix}", item_name=f"P {suffix}", is_active=True)
    variant = ItemVariant(id=f"var_{suffix}", company_id=comp_id, item_id=parent.id, variant_sku=f"SKU-{suffix}", variant_name=f"V {suffix}", is_active=True)
    pbe = PriceBookEntry(
        id=f"pbe_{suffix}",
        company_id=comp_id,
        price_book_id=pb.id,
        item_id=parent.id,
        variant_id=variant.id,
        min_quantity=Decimal("1.0"),
        mrp=Decimal("2000.00"),
        selling_price=Decimal("1700.00"),
        is_active=True,
    )
    db_session.add_all([pb, parent, variant, pbe])
    await db_session.flush()

    # Update rate to 1800
    rows = [
        {
            "variant_sku": variant.variant_sku,
            "min_quantity": 1.0,
            "mrp": 2000.00,
            "selling_price": 1800.00,
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.PRICEBOOK, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is True, f"Blocking reasons: {prev_res.blocking_reasons}"
    assert prev_res.summary.update_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.UPDATE
    assert "selling_price" in prev_res.items[0].diff.fields

    # Commit update
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.PRICEBOOK,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
    )
    commit_res = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert commit_res.committed_count == 1
    assert pbe.selling_price == Decimal("1800.00")


# ==============================================================================
# TC-CAT-012: Invalid Pricing Invariant (sp > mrp)
# ==============================================================================
@pytest.mark.asyncio
async def test_tc_cat_012_invalid_pricing_invariant(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    rows = [
        {
            "variant_sku": f"SKU-{suffix}",
            "mrp": 1000.00,
            "selling_price": 1500.00,  # Invalid: SP > MRP
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.PRICEBOOK, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is False
    assert prev_res.summary.validation_error_count == 1
    assert prev_res.items[0].classification == DataBridgeClassification.VALIDATION_ERROR
    assert any("cannot exceed MRP" in c.message for c in prev_res.items[0].conflicts)


# ==============================================================================
# SECURITY & ATOMICITY TESTS
# ==============================================================================
@pytest.mark.asyncio
async def test_databridge_commit_requires_user_confirmation(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    rows = [{"item_code": f"ART-{suffix}", "item_name": "Test", "brand": "SMRITI", "category": "Footwear", "primary_uom": "Pair"}]
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows),
    )

    # Calling commit with confirmed=False must fail
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        preview_token=prev_res.preview_token,
        confirmed=False,
        rows=rows,
    )
    with pytest.raises(DataBridgeCommitConfirmationError):
        await DataBridgeService.execute_commit(
            company_db=db_session,
            tenant_id="smriti001",
            company_id=comp_id,
            branch_id="BR-001",
            actor_id="usr-test",
            actor_role="ADMIN",
            req=commit_req,
        )


@pytest.mark.asyncio
async def test_databridge_stale_preview_tamper_detection(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    rows = [{"item_code": f"ART-{suffix}", "item_name": "Original Name", "brand": "SMRITI", "category": "Footwear", "primary_uom": "Pair"}]
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows),
    )

    # Tampered payload submitted with original preview token
    tampered_rows = [{"item_code": f"ART-{suffix}", "item_name": "TAMPERED NAME", "brand": "SMRITI", "category": "Footwear", "primary_uom": "Pair"}]
    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=tampered_rows,
    )
    with pytest.raises(DataBridgeStalePreviewError):
        await DataBridgeService.execute_commit(
            company_db=db_session,
            tenant_id="smriti001",
            company_id=comp_id,
            branch_id="BR-001",
            actor_id="usr-test",
            actor_role="ADMIN",
            req=commit_req,
        )


@pytest.mark.asyncio
async def test_databridge_idempotent_replay(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    rows = [{"item_code": f"ART-IDEMP-{suffix}", "item_name": "Idemp Test", "brand": "SMRITI", "category": "Footwear", "primary_uom": "Pair"}]
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=DataBridgePreviewRequest(entity_type=DataBridgeEntityType.ITEM, rows=rows),
    )

    commit_req = DataBridgeCommitRequest(
        entity_type=DataBridgeEntityType.ITEM,
        preview_token=prev_res.preview_token,
        confirmed=True,
        rows=rows,
        idempotency_key=f"idemp_{suffix}",
    )
    # First execution
    res1 = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert res1.idempotent_replay is False

    # Second execution replay
    res2 = await DataBridgeService.execute_commit(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=commit_req,
    )
    assert res2.idempotent_replay is True
    assert res2.committed_count == res1.committed_count


@pytest.mark.asyncio
async def test_databridge_variant_missing_parent_dependency(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TEST_{suffix}"
    db_session.info["company_id"] = comp_id

    rows = [
        {
            "item_code": f"NONEXISTENT-PARENT-{suffix}",
            "variant_sku": f"NONEXISTENT-BLK-38-{suffix}",
            "color": "BLACK",
            "size": "38",
            "primary_uom": "Pair",
            "mrp": 1000.00,
            "selling_price": 900.00,
        }
    ]

    prev_req = DataBridgePreviewRequest(entity_type=DataBridgeEntityType.VARIANT, rows=rows)
    prev_res = await DataBridgeService.execute_preview(
        company_db=db_session,
        tenant_id="smriti001",
        company_id=comp_id,
        branch_id="BR-001",
        actor_id="usr-test",
        actor_role="ADMIN",
        req=prev_req,
    )
    assert prev_res.can_commit is False
    assert prev_res.items[0].classification == DataBridgeClassification.DEPENDENCY_ERROR
    assert any("does not exist in catalog" in reason for reason in prev_res.blocking_reasons)
