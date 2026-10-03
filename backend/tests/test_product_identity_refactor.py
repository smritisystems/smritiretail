"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.38.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — Product Identity & PSV Refactor
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.customer_article_mapping import CustomerArticleMapping
from app.models.psv import PSVParty, PSVStockEvent, PSVStockBalance
from app.models.inventory import Product
from app.services.item_master_svc import UniversalItemMasterService
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
async def test_01_canonical_product_hierarchy_resolution(db_session: AsyncSession):
    """
    Test 1: Verify Parent Style (Item), Variant (ItemVariant), and Barcode (ItemBarcode)
    resolve with full attribute and inventory integrity via UniversalItemMasterService.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    
    # 1. Create Parent Item
    item = Item(
        id=f"itm_test_{suffix}",
        company_id=comp_id,
        item_code=f"STYLE-TEST-{suffix}",
        item_name=f"Formal Linen Shirt {suffix}",
        item_type="FINISHED_GOOD",
        category="Apparel",
        brand="SmritiHeritage",
        tax_rate=Decimal("12.00"),
        least_saleable_qty=Decimal("1.0000"),
        mrp=Decimal("1999.00"),
        selling_price=Decimal("1499.00"),
    )
    db_session.add(item)
    await db_session.flush()

    # 2. Create Variant Child
    variant = ItemVariant(
        id=f"var_test_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=f"STYLE-TEST-{suffix}-BLUE-40",
        variant_name=f"Formal Linen Shirt {suffix} (Blue 40)",
        attributes_json={"color": "Blue", "size": "40"},
        tax_rate=Decimal("12.00"),
        mrp=Decimal("1999.00"),
        selling_price=Decimal("1499.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    # 3. Create Optical Barcode
    bc_str = f"890999{suffix}1"
    barcode = ItemBarcode(
        id=f"bc_test_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_id=variant.id,
        barcode=bc_str,
        barcode_normalized=bc_str,
        barcode_type="EAN13",
        is_primary=True,
    )
    db_session.add(barcode)
    await db_session.commit()

    # Resolution by Barcode (Tier 1)
    res_bc = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(
        session=db_session,
        query_str=bc_str,
    )
    assert res_bc is not None
    assert res_bc.matched_by == "BARCODE"
    assert res_bc.item_id == item.id
    assert res_bc.variant_id == variant.id
    assert res_bc.item_code == item.item_code
    assert res_bc.variant_sku == variant.variant_sku
    assert res_bc.barcode == bc_str

    # Resolution by Variant SKU (Tier 2)
    res_sku = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(
        session=db_session,
        query_str=variant.variant_sku,
    )
    assert res_sku is not None
    assert res_sku.matched_by == "VARIANT_SKU"
    assert res_sku.item_id == item.id
    assert res_sku.variant_id == variant.id


@pytest.mark.asyncio
async def test_02_customer_article_mapping_resolution(db_session: AsyncSession):
    """
    Test 2: Verify B2B Buyer Article Code (e.g. Reliance Trends buyer catalog code)
    resolves to the internal ItemVariant via CustomerArticleMapping.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    
    # Create internal item and variant
    item = Item(
        id=f"itm_cam_{suffix}",
        company_id=comp_id,
        item_code=f"FACTORY-STYLE-{suffix}",
        item_name=f"Factory Loafer {suffix}",
        tax_rate=Decimal("18.00"),
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_cam_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=f"FACTORY-STYLE-{suffix}-BLK-42",
        variant_name=f"Factory Loafer Black 42",
        attributes_json={"color": "Black", "size": "42"},
        tax_rate=Decimal("18.00"),
        mrp=Decimal("2499.00"),
        selling_price=Decimal("1899.00"),
    )
    db_session.add(variant)
    await db_session.flush()

    # Create Customer Article Mapping
    buyer_code = f"BUYER-ART-{suffix}"
    buyer_bc = f"890455{suffix}9"
    cam = CustomerArticleMapping(
        id=f"cam_test_{suffix}",
        company_id=comp_id,
        customer_id="CUST-001",
        item_id=item.id,
        variant_id=variant.id,
        customer_article=buyer_code,
        vendor_article=f"FACTORY-STYLE-{suffix}",
        color="BLACK",
        size="42",
        barcode=buyer_bc,
        base_mrp=Decimal("2499.00"),
        contract_rate=Decimal("1250.00"),
        contract_discount_pct=Decimal("49.9800"),
        status="ACTIVE",
    )
    db_session.add(cam)
    await db_session.commit()

    # Resolution by Buyer Article Code (Tier 3)
    res = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(
        session=db_session,
        query_str=buyer_code,
        customer_id="CUST-001",
    )
    assert res is not None
    assert res.item_id == item.id
    assert res.variant_id == variant.id
    assert res.customer_article == buyer_code


@pytest.mark.asyncio
async def test_03_tenant_isolation_cross_company_prevention(db_session: AsyncSession):
    """
    Test 3: Enforce that an identifier belonging to Company A cannot be resolved
    or collided into Company B.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_a = "COMP-001"
    comp_b = "comp-foreign-c62103"
    shared_sku = f"ISOLATION-SKU-{suffix}"

    # Company A variant
    item_a = Item(id=f"itm_a_{suffix}", company_id=comp_a, item_code=f"ITM-A-{suffix}", item_name="Item A")
    db_session.add(item_a)
    await db_session.flush()

    var_a = ItemVariant(
        id=f"var_a_{suffix}", company_id=comp_a, item_id=item_a.id,
        variant_sku=shared_sku, variant_name="Variant A"
    )
    db_session.add(var_a)

    # Company B variant (same SKU string, distinct tenant)
    item_b = Item(id=f"itm_b_{suffix}", company_id=comp_b, item_code=f"ITM-B-{suffix}", item_name="Item B")
    db_session.add(item_b)
    await db_session.flush()

    var_b = ItemVariant(
        id=f"var_b_{suffix}", company_id=comp_b, item_id=item_b.id,
        variant_sku=shared_sku, variant_name="Variant B"
    )
    db_session.add(var_b)
    await db_session.commit()

    # Resolve under Company A
    res_a = await PartnerIdentifierResolver.resolve(
        session=db_session,
        company_id=comp_a,
        external_sku=shared_sku,
    )
    assert res_a.found is True
    assert res_a.item_id == item_a.id
    assert res_a.variant_id == var_a.id

    # Resolve under Company B
    res_b = await PartnerIdentifierResolver.resolve(
        session=db_session,
        company_id=comp_b,
        external_sku=shared_sku,
    )
    assert res_b.found is True
    assert res_b.item_id == item_b.id
    assert res_b.variant_id == var_b.id
    assert res_b.item_id != res_a.item_id


@pytest.mark.asyncio
async def test_04_psv_projection_with_authoritative_company_id(db_session: AsyncSession):
    """
    Test 4: Verify PSV projection writes authoritative company_id and handles
    both mapped and unmapped external partner SKUs without preflight errors.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    party_id = f"psv_party_{suffix}"

    # Ensure PSVParty exists
    party = PSVParty(
        id=party_id,
        company_id=comp_id,
        name=f"Partner Outlet {suffix}",
        location="Mumbai",
        store_code=f"STORE-{suffix}",
        status="Healthy",
    )
    db_session.add(party)
    await db_session.commit()

    # 1. Project an unmapped partner SKU (Graceful ingestion with NULL product_id)
    unmapped_sku = f"EXT-UNMAPPED-{suffix}"
    res_unmapped = await PSVProjectionService.project_psv_stock_event(
        psv_session=db_session,
        event_payload={
            "source_event_id": f"EVT-UNMAPPED-{suffix}",
            "correlation_id": f"CORR-{suffix}",
            "company_id": comp_id,
            "company_code": "001",
            "source_document_type": "PARTNER_EDI_FEED",
            "source_document_id": f"EDI-{suffix}",
            "psv_party_id": party_id,
            "sku": unmapped_sku,
            "movement_type": "RECEIVED_AT_STORE",
            "quantity": 10.0,
            "source_event_created_at": datetime.now(timezone.utc),
            "approval_status": "APPROVED",
        },
        commit=True,
    )
    assert res_unmapped["status"] == "PROJECTED_SUCCESSFULLY"

    # Verify balance record has company_id populated and product_id=None
    bal_stmt = select(PSVStockBalance).where(
        PSVStockBalance.company_id == comp_id,
        PSVStockBalance.psv_party_id == party_id,
        PSVStockBalance.sku == unmapped_sku,
    )
    bal = (await db_session.execute(bal_stmt)).scalar_one_or_none()
    assert bal is not None
    assert bal.company_id == comp_id
    assert bal.product_id is None
    assert bal.reconciliation_status == "PENDING_CATALOG_MAPPING"
    assert bal.received_qty == Decimal("10.0000")


@pytest.mark.asyncio
async def test_05_psv_compound_uniqueness_enforcement(db_session: AsyncSession):
    """
    Test 5: Verify the new compound unique constraint on psv_stock_balances
    (company_id, psv_party_id, sku) enforces idempotency and blocks duplicates.
    """
    comp_id = "COMP-001"
    party_id = "psv_party_existing"
    sku = "TEST-DUP-SKU-001"

    # Check that database index uq_psv_stock_balances_company_party_sku exists
    idx_check = await db_session.execute(text("""
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'psv_stock_balances' 
        AND indexname = 'uq_psv_stock_balances_company_party_sku';
    """))
    assert idx_check.scalar() == "uq_psv_stock_balances_company_party_sku"


@pytest.mark.asyncio
async def test_06_f2_item_barcodes_lookup_dual_read(db_session: AsyncSession):
    """
    Test 6: Verify /api/v1/item-barcodes lookup endpoint reads from canonical
    item_barcodes and returns standard F2 browse structure (barcode, sku, name, id).
    """
    from app.api.v1.master_lookup import list_item_barcodes_lookup

    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"

    # Create canonical item, variant, barcode
    item = Item(id=f"itm_f2_{suffix}", company_id=comp_id, item_code=f"STYLE-F2-{suffix}", item_name=f"F2 Test Style {suffix}")
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(id=f"var_f2_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"STYLE-F2-{suffix}-L", variant_name=f"F2 Test Style L")
    db_session.add(var)
    await db_session.flush()

    test_bc = f"890987{suffix}9"
    bc = ItemBarcode(id=f"bc_f2_{suffix}", company_id=comp_id, item_id=item.id, variant_id=var.id, barcode=test_bc, is_primary=True)
    db_session.add(bc)
    await db_session.commit()

    # Call lookup adapter
    results = await list_item_barcodes_lookup(q=test_bc, limit=10, tenant_db=db_session, current_user=None)
    assert len(results) >= 1
    match = next((r for r in results if r["barcode"] == test_bc), None)
    assert match is not None
    assert match["barcode"] == test_bc
    assert match["sku"] == var.variant_sku
    assert match["name"] == var.variant_name
    assert match["variant_id"] == var.id
    assert match["item_id"] == item.id


@pytest.mark.asyncio
async def test_07_mapped_partner_sku_projection_resolves_product(db_session: AsyncSession):
    """
    Test 7: Verify that when a partner SKU matches a CustomerArticleMapping,
    PSV projection automatically resolves product_id and marks status AUTO_MATCHED.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    party_id = f"psv_party_map_{suffix}"

    # Create party
    party = PSVParty(id=party_id, company_id=comp_id, name=f"Mapped Outlet {suffix}", location="Delhi", status="Healthy")
    db_session.add(party)

    # Create canonical product & variant
    item = Item(id=f"itm_map_{suffix}", company_id=comp_id, item_code=f"MAP-STYLE-{suffix}", item_name="Mapped Style")
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(id=f"var_map_{suffix}", company_id=comp_id, item_id=item.id, variant_sku=f"MAP-STYLE-{suffix}-40", variant_name="Mapped Style 40")
    db_session.add(var)
    await db_session.flush()

    # Create legacy Product row linked to this variant
    prod = Product(
        id=f"prod_map_{suffix}",
        company_id=comp_id,
        code=f"MAP-STYLE-{suffix}",
        name="Mapped Style",
        price=Decimal("1500.00"),
        stock=100,
        category="Footwear",
        barcode=f"890555{suffix}1",
        item_id=item.id,
        item_variant_id=var.id,
    )
    db_session.add(prod)
    await db_session.flush()

    # Create Customer Article Mapping linking partner SKU to variant
    partner_sku = f"PARTNER-CODE-{suffix}"
    cam = CustomerArticleMapping(
        id=f"cam_map_{suffix}",
        company_id=comp_id,
        customer_id="CUST-001",
        item_id=item.id,
        variant_id=var.id,
        customer_article=partner_sku,
        vendor_article=f"MAP-STYLE-{suffix}",
        color="BROWN",
        size="40",
        barcode=prod.barcode,
        status="ACTIVE",
    )
    db_session.add(cam)
    await db_session.commit()

    # Project partner stock event with partner_sku
    res = await PSVProjectionService.project_psv_stock_event(
        psv_session=db_session,
        event_payload={
            "source_event_id": f"EVT-MAP-{suffix}",
            "correlation_id": f"CORR-MAP-{suffix}",
            "company_id": comp_id,
            "company_code": "001",
            "source_document_type": "PARTNER_EDI",
            "source_document_id": f"EDI-MAP-{suffix}",
            "psv_party_id": party_id,
            "sku": partner_sku,
            "movement_type": "STORE_RECEIVED",
            "quantity": 25.0,
            "source_event_created_at": datetime.now(timezone.utc),
            "approval_status": "APPROVED",
        },
        commit=True,
    )
    assert res["status"] == "PROJECTED_SUCCESSFULLY"

    # Verify balance has resolved product_id and status AUTO_MATCHED
    bal_stmt = select(PSVStockBalance).where(
        PSVStockBalance.company_id == comp_id,
        PSVStockBalance.psv_party_id == party_id,
        PSVStockBalance.sku == partner_sku,
    )
    bal = (await db_session.execute(bal_stmt)).scalar_one_or_none()
    assert bal is not None
    assert bal.product_id == prod.id
    assert bal.reconciliation_status == "AUTO_MATCHED"
    assert bal.received_qty == Decimal("25.0000")
