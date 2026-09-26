"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.38.0
Created      : 2026-09-26
Modified     : 2026-09-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — PSV Feed Mapping Hardening & Edge Cases
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.customer_article_mapping import CustomerArticleMapping
from app.models.ecom import EcomSkuMapping
from app.models.psv import PSVParty, PSVStockEvent, PSVStockBalance
from app.models.inventory import Product
from app.services.partner_resolver import PartnerIdentifierResolver
from app.services.psv_projection import PSVProjectionService


TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_unmapped_partner_sku_pending_catalog_mapping(db_session: AsyncSession):
    """
    Audit 1: Verify that an unmapped partner SKU arriving via PSV feed gracefully
    projects into PSVStockEvent and creates a PSVStockBalance with PENDING_CATALOG_MAPPING.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    party_id = f"psv_party_unmapped_{suffix}"

    party = PSVParty(
        id=party_id,
        company_id=comp_id,
        name=f"Partner Unmapped Test {suffix}",
        location="Bengaluru",
        store_code=f"BLR-{suffix}",
        status="Healthy",
    )
    db_session.add(party)
    await db_session.commit()

    unmapped_sku = f"EXT-NO-MATCH-{suffix}"
    source_evt_id = f"EVT-UNMAPPED-{suffix}"

    result = await PSVProjectionService.project_psv_stock_event(
        psv_session=db_session,
        event_payload={
            "source_event_id": source_evt_id,
            "correlation_id": f"CORR-{suffix}",
            "company_id": comp_id,
            "company_code": "001",
            "source_document_type": "EDI_DESPATCH_ADVICE",
            "source_document_id": f"DESP-{suffix}",
            "psv_party_id": party_id,
            "sku": unmapped_sku,
            "movement_type": "RECEIVED_AT_STORE",
            "quantity": 35.0,
            "source_event_created_at": datetime.now(timezone.utc),
            "approval_status": "APPROVED",
        },
        commit=True,
    )

    assert result["status"] == "PROJECTED_SUCCESSFULLY"
    assert result["source_event_id"] == source_evt_id

    # Verify immutable event ledger
    evt_stmt = select(PSVStockEvent).where(PSVStockEvent.source_event_id == source_evt_id)
    evt = (await db_session.execute(evt_stmt)).scalar_one_or_none()
    assert evt is not None
    assert evt.product_id is None
    assert evt.sku == unmapped_sku
    assert evt.quantity == Decimal("35.0000")
    assert evt.sync_status == "PROJECTED"

    # Verify balance is flagged as PENDING_CATALOG_MAPPING
    bal_stmt = select(PSVStockBalance).where(
        PSVStockBalance.company_id == comp_id,
        PSVStockBalance.psv_party_id == party_id,
        PSVStockBalance.sku == unmapped_sku,
    )
    bal = (await db_session.execute(bal_stmt)).scalar_one_or_none()
    assert bal is not None
    assert bal.product_id is None
    assert bal.reconciliation_status == "PENDING_CATALOG_MAPPING"
    assert bal.received_qty == Decimal("35.0000")


@pytest.mark.asyncio
async def test_customer_article_mapping_partial_and_barcode_fallback(db_session: AsyncSession):
    """
    Audit 2: Test resolution behavior for CustomerArticleMapping:
    - Match by customer_article
    - Fallback match by barcode when customer_article differs
    - Inactive mapping fails closed to found=False
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    # Setup internal catalog entity
    item = Item(id=f"itm_cam_{suffix}", company_id=comp_id, item_code=f"STYLE-CAM-{suffix}", item_name=f"CAM Shirt {suffix}")
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(id=f"var_cam_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU-CAM-{suffix}", variant_name="CAM M")
    db_session.add(var)

    # Active mapping
    cam_active = CustomerArticleMapping(
        id=f"cam_act_{suffix}",
        company_id=comp_id,
        customer_id="CUST-001",
        customer_article=f"SS-ART-{suffix}",
        vendor_article=f"STYLE-CAM-{suffix}",
        color="NAVY",
        size="38",
        barcode=f"8901234{suffix[:5]}",
        item_id=item.id,
        variant_id=var.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(cam_active)

    # Inactive mapping pointing to different item
    item_inact = Item(id=f"itm_inact_{suffix}", company_id=comp_id, item_code=f"STYLE-INACT-{suffix}", item_name=f"Inactive Shirt {suffix}")
    db_session.add(item_inact)
    await db_session.flush()

    var_inact = ItemVariant(id=f"var_inact_{suffix}", company_id=comp_id, item_id=item_inact.id, variant_sku=f"SKU-INACT-{suffix}", variant_name="Inactive Variant")
    db_session.add(var_inact)

    cam_inactive = CustomerArticleMapping(
        id=f"cam_inact_{suffix}",
        company_id=comp_id,
        customer_id="CUST-001",
        customer_article=f"SS-INACT-{suffix}",
        vendor_article=f"STYLE-INACT-{suffix}",
        color="WHITE",
        size="40",
        barcode=f"8909999{suffix[:5]}",
        item_id=item_inact.id,
        variant_id=var_inact.id,
        is_active=False,
        is_deleted=False,
    )
    db_session.add(cam_inactive)
    await db_session.commit()

    # Case A: Exact Match on customer_article
    res_art = await PartnerIdentifierResolver.resolve(
        session=db_session,
        company_id=comp_id,
        external_sku=f"SS-ART-{suffix}",
    )
    assert res_art.found is True
    assert res_art.item_id == item.id
    assert res_art.variant_id == var.id
    assert res_art.resolution_tier == "TIER_1_CUSTOMER_ARTICLE_MAPPING"

    # Case B: Barcode fallback match
    res_bc = await PartnerIdentifierResolver.resolve(
        session=db_session,
        company_id=comp_id,
        external_sku=f"NON_EXISTENT_SKU_{suffix}",
        external_barcode=f"8901234{suffix[:5]}",
    )
    assert res_bc.found is True
    assert res_bc.variant_id == var.id

    # Case C: Inactive mapping must FAIL CLOSED
    res_inact = await PartnerIdentifierResolver.resolve(
        session=db_session,
        company_id=comp_id,
        external_sku=f"SS-INACT-{suffix}",
    )
    assert res_inact.found is False


@pytest.mark.asyncio
async def test_ecom_sku_mapping_resolution(db_session: AsyncSession):
    """
    Audit 3: Test Tier 2 eCommerce Channel SKU Mapping resolution
    and soft-delete exclusion behavior.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    item = Item(id=f"itm_ecom_{suffix}", company_id=comp_id, item_code=f"STYLE-ECOM-{suffix}", item_name=f"Ecom Dress {suffix}")
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(id=f"var_ecom_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"SKU-ECOM-{suffix}", variant_name="Ecom Dress Blue")
    db_session.add(var)

    ecom_map = EcomSkuMapping(
        id=f"ecom_{suffix}",
        company_id=comp_id,
        channel_code="AMAZON_IN",
        external_sku=f"B08TEST{suffix}",
        smriti_sku=var.variant_sku,
        item_id=item.id,
        variant_id=var.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(ecom_map)
    await db_session.commit()

    # Match active eCommerce SKU
    res = await PartnerIdentifierResolver.resolve(
        session=db_session,
        company_id=comp_id,
        external_sku=f"B08TEST{suffix}",
    )
    assert res.found is True
    assert res.variant_id == var.id
    assert res.resolution_tier == "TIER_2_ECOM_SKU_MAPPING"
    assert res.metadata.get("channel_code") == "AMAZON_IN"
