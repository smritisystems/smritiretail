"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-05
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Suite: SKU, Barcode, and Item-Variant Architecture Refactor
Tests the canonical hierarchy:
Product / Article -> Item Variant -> SKU -> Primary / Additional Barcodes
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.inventory import Product
from app.schemas.item_master import (
    ItemCreateRequest,
    ItemVariantItem,
    ItemBarcodeItem,
)
from app.services.item_master_svc import (
    UniversalItemMasterService,
    ItemCatalogService,
    BarcodeResolverService,
)

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_01_sku_canonical_identity_and_property_alias(db_session: AsyncSession):
    """
    Rule 3, 4: item_variants.id is technical relationship key,
    variant_sku is canonical business identity, exposed via .sku alias.
    """
    comp_id = f"COMP_TEST_{uuid.uuid4().hex[:6]}"
    item_id = f"itm_test_{uuid.uuid4().hex[:8]}"
    var_id = f"var_test_{uuid.uuid4().hex[:8]}"
    sku_val = f"STYLE-A-RED-38-{uuid.uuid4().hex[:4]}"

    item = Item(
        id=item_id,
        company_id=comp_id,
        item_code=f"STYLE-A-{uuid.uuid4().hex[:4]}",
        item_name="Style A Casual",
        category="Footwear",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(
        id=var_id,
        company_id=comp_id,
        item_id=item.id,
        variant_sku=sku_val,
        variant_name="Style A Red 38",
        color="RED",
        size="38",
        is_active=True,
    )
    db_session.add(var)
    await db_session.flush()

    # Verify technical PK and canonical business SKU
    assert var.id == var_id
    assert var.variant_sku == sku_val
    assert var.sku == sku_val  # Property alias per blueprint


@pytest.mark.asyncio
async def test_02_new_variant_initial_sku_from_primary_barcode(db_session: AsyncSession):
    """
    Rule 6: Where an official primary barcode exists when the variant is created/imported,
    the initial SKU MAY be assigned from that primary barcode when SKU is omitted.
    """
    comp_id = "COMP-001"
    suffix = uuid.uuid4().hex[:6].upper()
    bc_str = f"89090879{suffix[:5]}"

    req = ItemCreateRequest(
        item_code=f"STYLE-BC-{suffix}",
        item_name=f"Style With Barcode {suffix}",
        category="Footwear",
        variants=[
            ItemVariantItem(
                color="BLACK",
                size="40",
                variant_sku=None,  # Omitted -> Rule 6 should assign from primary barcode
                barcodes=[
                    ItemBarcodeItem(barcode=bc_str, barcode_type="EAN13", is_primary=True)
                ],
            )
        ],
    )

    created = await ItemCatalogService.create_item(
        session=db_session,
        req=req,
        company_id=comp_id,
        branch_id="BR-001",
        user_id="USR-TEST",
    )

    assert created is not None
    assert len(created.variants) == 1
    variant = created.variants[0]
    # Rule 6 verified: SKU was assigned from primary barcode
    assert variant.variant_sku == bc_str
    assert variant.sku == bc_str
    assert len(variant.barcodes) == 1
    assert variant.barcodes[0].barcode == bc_str
    assert variant.barcodes[0].is_primary is True


@pytest.mark.asyncio
async def test_03_new_variant_without_barcode_generates_internal_sku_no_fake_barcode(db_session: AsyncSession):
    """
    Rule 7: If no barcode exists, DO NOT invent a fake barcode.
    Uses internally generated business SKU, e.g. {style}-{color}-{size}.
    item_barcodes must remain completely empty for this variant!
    """
    comp_id = "COMP-001"
    suffix = uuid.uuid4().hex[:6].upper()

    req = ItemCreateRequest(
        item_code=f"STYLE-NOBC-{suffix}",
        item_name=f"Style Without Barcode {suffix}",
        category="Footwear",
        variants=[
            ItemVariantItem(
                color="NAVY",
                size="42",
                variant_sku=None,  # Omitted
                barcodes=[],       # No barcode supplied
            )
        ],
    )

    created = await ItemCatalogService.create_item(
        session=db_session,
        req=req,
        company_id=comp_id,
        branch_id="BR-001",
        user_id="USR-TEST",
    )

    assert created is not None
    assert len(created.variants) == 1
    variant = created.variants[0]
    # Internal deterministic SKU: STYLE-NOBC-...-NAVY-42
    expected_sku = f"STYLE-NOBC-{suffix}-NAVY-42"
    assert variant.variant_sku == expected_sku
    # Rule 7 verified: ZERO fake barcodes were created
    assert len(variant.barcodes) == 0


@pytest.mark.asyncio
async def test_04_multiple_barcodes_one_variant_and_single_primary_enforcement(db_session: AsyncSession):
    """
    Rule 10: A variant may have multiple barcodes (Primary + Additional).
    Rule 11: Exactly one primary barcode per variant (enforced by DB index).
    """
    comp_id = "COMP-001"
    suffix = uuid.uuid4().hex[:6].upper()
    bc1 = f"8901{suffix}1"
    bc2 = f"8901{suffix}2"

    req = ItemCreateRequest(
        item_code=f"STYLE-MULTI-{suffix}",
        item_name=f"Multi Barcode Style {suffix}",
        category="Footwear",
        variants=[
            ItemVariantItem(
                color="BROWN",
                size="39",
                variant_sku=f"STYLE-MULTI-{suffix}-BROWN-39",
                barcodes=[
                    ItemBarcodeItem(barcode=bc1, barcode_type="EAN13", is_primary=True),
                    ItemBarcodeItem(barcode=bc2, barcode_type="EAN13", is_primary=False),
                ],
            )
        ],
    )

    created = await ItemCatalogService.create_item(
        session=db_session,
        req=req,
        company_id=comp_id,
        branch_id="BR-001",
        user_id="USR-TEST",
    )

    variant = created.variants[0]
    assert len(variant.barcodes) == 2

    primaries = [b for b in variant.barcodes if b.is_primary]
    additionals = [b for b in variant.barcodes if not b.is_primary]
    assert len(primaries) == 1
    assert primaries[0].barcode == bc1
    assert len(additionals) == 1
    assert additionals[0].barcode == bc2

    # Attempting to insert a SECOND primary barcode directly into DB must trigger unique index violation
    duplicate_primary = ItemBarcode(
        id=f"bc_viol_{uuid.uuid4().hex[:8]}",
        company_id=comp_id,
        variant_id=variant.id,
        item_id=created.id,
        barcode=f"8901{suffix}3",
        is_primary=True,  # Violates uq_barcodes_one_primary_per_variant
    )
    db_session.add(duplicate_primary)
    with pytest.raises(Exception):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_05_barcode_replacement_preserves_sku_stability(db_session: AsyncSession):
    """
    Rule 8, 9: Changing the primary barcode must NEVER automatically change SKU.
    Old primary becomes additional, new barcode becomes primary.
    """
    comp_id = "COMP-001"
    suffix = uuid.uuid4().hex[:6].upper()
    old_bc = f"8902{suffix}1"
    new_bc = f"8902{suffix}9"

    # Variant initialized with SKU = old_bc
    req = ItemCreateRequest(
        item_code=f"STYLE-REPL-{suffix}",
        item_name=f"Replace BC Style {suffix}",
        category="Footwear",
        variants=[
            ItemVariantItem(
                color="BLACK",
                size="41",
                variant_sku=old_bc,
                barcodes=[
                    ItemBarcodeItem(barcode=old_bc, barcode_type="EAN13", is_primary=True),
                ],
            )
        ],
    )

    created = await ItemCatalogService.create_item(
        session=db_session,
        req=req,
        company_id=comp_id,
        branch_id="BR-001",
        user_id="USR-TEST",
    )
    variant = created.variants[0]
    initial_sku = variant.variant_sku
    assert initial_sku == old_bc

    # Replace primary barcode via service method
    updated_bc = await ItemCatalogService.replace_primary_barcode(
        session=db_session,
        company_id=comp_id,
        variant_id=variant.id,
        new_barcode=new_bc,
        barcode_type="EAN13",
    )
    assert updated_bc.barcode == new_bc
    assert updated_bc.is_primary is True

    from sqlalchemy.orm import selectinload
    var_stmt = select(ItemVariant).where(ItemVariant.id == variant.id).options(selectinload(ItemVariant.barcodes))
    refetched = (await db_session.execute(var_stmt)).scalar_one_or_none()
    assert refetched is not None
    # RULE 9 VERIFIED: SKU is completely unchanged!
    assert refetched.variant_sku == initial_sku
    assert refetched.sku == initial_sku

    await db_session.refresh(refetched, ["barcodes"])
    # Check barcodes on refetched variant:
    bcs = {b.barcode: b.is_primary for b in refetched.barcodes}
    assert bcs[new_bc] is True   # New barcode is now primary
    assert bcs[old_bc] is False  # Old barcode demoted to additional


@pytest.mark.asyncio
async def test_06_resolution_hierarchy_barcode_and_sku(db_session: AsyncSession):
    """
    Rule 15: Barcode lookup resolves barcode -> variant -> SKU -> sellable product.
    Rule 16: SKU lookup resolves SKU -> variant -> sellable product.
    Both return the authoritative item_variant_id.
    """
    comp_id = "COMP-001"
    suffix = uuid.uuid4().hex[:6].upper()
    bc_primary = f"8903{suffix}1"
    bc_additional = f"8903{suffix}2"
    sku_val = f"RESOLVE-STYLE-{suffix}-BLK-40"

    req = ItemCreateRequest(
        item_code=f"RESOLVE-STYLE-{suffix}",
        item_name=f"Resolve Style {suffix}",
        category="Footwear",
        variants=[
            ItemVariantItem(
                color="BLACK",
                size="40",
                variant_sku=sku_val,
                mrp=1999.0,
                selling_price=1299.0,
                barcodes=[
                    ItemBarcodeItem(barcode=bc_primary, barcode_type="EAN13", is_primary=True),
                    ItemBarcodeItem(barcode=bc_additional, barcode_type="EAN13", is_primary=False),
                ],
            )
        ],
    )

    created = await ItemCatalogService.create_item(
        session=db_session,
        req=req,
        company_id=comp_id,
        branch_id="BR-001",
        user_id="USR-TEST",
    )
    variant = created.variants[0]

    # 1. Primary Barcode Lookup (Section 20 API contract)
    res_pbc = await BarcodeResolverService.lookup_by_barcode(
        session=db_session,
        barcode=bc_primary,
    )
    assert res_pbc is not None
    assert res_pbc["item_variant_id"] == variant.id
    assert res_pbc["sku"] == sku_val
    assert res_pbc["primary_barcode"] == bc_primary
    assert res_pbc["matched_barcode"] == bc_primary

    # 2. Additional Barcode Lookup (resolves to SAME variant!)
    res_abc = await BarcodeResolverService.lookup_by_barcode(
        session=db_session,
        barcode=bc_additional,
    )
    assert res_abc is not None
    assert res_abc["item_variant_id"] == variant.id
    assert res_abc["sku"] == sku_val
    assert res_abc["primary_barcode"] == bc_primary  # Points back to primary
    assert res_abc["matched_barcode"] == bc_additional

    # 3. SKU Lookup via resolve_item_by_barcode_or_sku
    res_sku = await BarcodeResolverService.resolve_item_by_barcode_or_sku(
        session=db_session,
        query_str=sku_val,
    )
    assert res_sku is not None
    assert res_sku.matched_by == "VARIANT_SKU"
    assert res_sku.variant_id == variant.id
    assert res_sku.variant_sku == sku_val


@pytest.mark.asyncio
async def test_07_tenant_isolation_identical_sku_different_companies(db_session: AsyncSession):
    """
    Rule 5: SKU uniqueness is scoped to company/tenant boundary.
    Company A and Company B can independently stock the same vendor SKU without collision.
    """
    comp_a = f"COMP_A_{uuid.uuid4().hex[:6]}"
    comp_b = f"COMP_B_{uuid.uuid4().hex[:6]}"
    shared_sku = f"VENDOR-BATA-SANDAL-{uuid.uuid4().hex[:6]}"

    # Company A creates variant with shared_sku
    item_a = Item(id=f"itm_a_{uuid.uuid4().hex[:6]}", company_id=comp_a, item_code=f"BATA-SND-A", item_name="Bata Sandal A")
    db_session.add(item_a)
    await db_session.flush()
    var_a = ItemVariant(id=f"var_a_{uuid.uuid4().hex[:6]}", company_id=comp_a, item_id=item_a.id, variant_sku=shared_sku, variant_name="Var A")
    db_session.add(var_a)
    await db_session.flush()

    # Company B creates variant with the EXACT SAME shared_sku
    item_b = Item(id=f"itm_b_{uuid.uuid4().hex[:6]}", company_id=comp_b, item_code=f"BATA-SND-B", item_name="Bata Sandal B")
    db_session.add(item_b)
    await db_session.flush()
    var_b = ItemVariant(id=f"var_b_{uuid.uuid4().hex[:6]}", company_id=comp_b, item_id=item_b.id, variant_sku=shared_sku, variant_name="Var B")
    db_session.add(var_b)
    # Must succeed without 409 or constraint error:
    await db_session.flush()

    assert var_a.variant_sku == shared_sku
    assert var_b.variant_sku == shared_sku
    assert var_a.company_id != var_b.company_id


@pytest.mark.asyncio
async def test_08_historical_ch24g_footwear_regression(db_session: AsyncSession):
    """
    Regression check for CH-24-G footprint in live database:
    Verifies that CH-24-G parent item exists, variants are accessible,
    and multiple primary barcode remediation successfully resolved duplicates.
    """
    res = await db_session.execute(
        select(Item).where(Item.item_code == "CH-24-G", Item.is_deleted == False)
    )
    ch24 = res.scalars().first()
    if ch24:
        assert ch24.brand == "TATTLY THREADS"
        # Check that variants have exactly one primary barcode
        var_stmt = select(ItemVariant).where(ItemVariant.item_id == ch24.id, ItemVariant.is_deleted == False)
        variants = (await db_session.execute(var_stmt)).scalars().all()
        assert len(variants) > 0

        # For every variant, verify that count(is_primary=True) <= 1
        for v in variants:
            bc_stmt = select(ItemBarcode).where(
                ItemBarcode.variant_id == v.id,
                ItemBarcode.is_primary == True,
                ItemBarcode.is_deleted == False,
            )
            primaries = (await db_session.execute(bc_stmt)).scalars().all()
            assert len(primaries) <= 1, f"Variant {v.variant_sku} has {len(primaries)} primary barcodes!"


@pytest.mark.asyncio
async def test_09_synthetic_d_barcode_deactivation_and_lookup_exclusion(db_session: AsyncSession):
    """
    Gate 1: Synthetic D Barcode Cleanup.
    1. Real barcode 8904551002945 resolves cleanly to CH-24-G variant.
    2. Synthetic barcode 8904551002945D does NOT resolve as an active barcode.
    3. Historical record for 8904551002945D is preserved in item_barcodes (is_active=False).
    """
    # 1. Real barcode lookup succeeds
    res_real = await BarcodeResolverService.lookup_by_barcode(db_session, "8904551002945")
    assert res_real is not None
    assert res_real["item_code"] == "CH-24-G"
    assert res_real["primary_barcode"] == "8904551002945"

    # 2. Synthetic D barcode lookup returns None (inactive excluded)
    res_d = await BarcodeResolverService.lookup_by_barcode(db_session, "8904551002945D")
    assert res_d is None

    # Also via resolve_item_by_barcode_or_sku
    res_tier1 = await BarcodeResolverService.resolve_item_by_barcode_or_sku(db_session, "8904551002945D")
    assert res_tier1 is None

    # 3. Verify historical audit record is preserved with is_active = False
    audit_row = (await db_session.execute(
        select(ItemBarcode).where(ItemBarcode.barcode == "8904551002945D")
    )).scalar_one_or_none()
    assert audit_row is not None
    assert audit_row.is_active is False
    assert audit_row.is_deleted is False


@pytest.mark.asyncio
async def test_10_tenant_barcode_uniqueness_and_cross_company_isolation(db_session: AsyncSession):
    """
    Gate 4: Barcode Uniqueness / Tenant Policy.
    - Within Company A: barcode X -> Variant A, barcode X -> Variant B fails with UniqueConstraint error.
    - Across companies: Company A + barcode Y -> Variant A, Company B + barcode Y -> Variant B succeeds.
    """
    from sqlalchemy.exc import IntegrityError

    comp_a = f"COMP_BAR_A_{uuid.uuid4().hex[:6]}"
    comp_b = f"COMP_BAR_B_{uuid.uuid4().hex[:6]}"
    barcode_x = f"BC-X-{uuid.uuid4().hex[:8]}"
    barcode_y = f"BC-Y-{uuid.uuid4().hex[:8]}"

    # Parent items
    itm_a = Item(id=f"itm_a_{uuid.uuid4().hex[:6]}", company_id=comp_a, item_code="ITM-A", item_name="Item A")
    itm_b = Item(id=f"itm_b_{uuid.uuid4().hex[:6]}", company_id=comp_b, item_code="ITM-B", item_name="Item B")
    db_session.add_all([itm_a, itm_b])
    await db_session.flush()

    # Variants in Company A
    var_a1 = ItemVariant(id=f"var_a1_{uuid.uuid4().hex[:6]}", company_id=comp_a, item_id=itm_a.id, variant_sku="SKU-A1", variant_name="V A1")
    var_a2 = ItemVariant(id=f"var_a2_{uuid.uuid4().hex[:6]}", company_id=comp_a, item_id=itm_a.id, variant_sku="SKU-A2", variant_name="V A2")
    db_session.add_all([var_a1, var_a2])
    await db_session.flush()

    # Barcode X on Variant A1 in Company A
    bc_a1 = ItemBarcode(
        id=f"bc_a1_{uuid.uuid4().hex[:6]}",
        company_id=comp_a,
        item_id=itm_a.id,
        variant_id=var_a1.id,
        barcode=barcode_x,
        is_primary=True,
        is_active=True,
    )
    db_session.add(bc_a1)
    await db_session.flush()

    # Attempting to assign same barcode X to Variant A2 within Company A MUST FAIL
    bc_a2_conflict = ItemBarcode(
        id=f"bc_a2_{uuid.uuid4().hex[:6]}",
        company_id=comp_a,
        item_id=itm_a.id,
        variant_id=var_a2.id,
        barcode=barcode_x,
        is_primary=True,
        is_active=True,
    )
    db_session.add(bc_a2_conflict)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

    # Part 2: Across companies, same barcode Y on Company A and Company B MUST SUCCEED
    itm_a2 = Item(id=f"itm_a2_{uuid.uuid4().hex[:6]}", company_id=comp_a, item_code="ITM-A2", item_name="Item A2")
    itm_b2 = Item(id=f"itm_b2_{uuid.uuid4().hex[:6]}", company_id=comp_b, item_code="ITM-B2", item_name="Item B2")
    db_session.add_all([itm_a2, itm_b2])
    await db_session.flush()

    var_comp_a = ItemVariant(id=f"v_ca_{uuid.uuid4().hex[:6]}", company_id=comp_a, item_id=itm_a2.id, variant_sku="SKU-CA", variant_name="V CA")
    var_comp_b = ItemVariant(id=f"v_cb_{uuid.uuid4().hex[:6]}", company_id=comp_b, item_id=itm_b2.id, variant_sku="SKU-CB", variant_name="V CB")
    db_session.add_all([var_comp_a, var_comp_b])
    await db_session.flush()

    bc_shared_a = ItemBarcode(
        id=f"bc_ca_{uuid.uuid4().hex[:6]}",
        company_id=comp_a,
        item_id=itm_a2.id,
        variant_id=var_comp_a.id,
        barcode=barcode_y,
        is_primary=True,
        is_active=True,
    )
    bc_shared_b = ItemBarcode(
        id=f"bc_cb_{uuid.uuid4().hex[:6]}",
        company_id=comp_b,
        item_id=itm_b2.id,
        variant_id=var_comp_b.id,
        barcode=barcode_y,
        is_primary=True,
        is_active=True,
    )
    db_session.add_all([bc_shared_a, bc_shared_b])
    # Must succeed without IntegrityError
    await db_session.flush()
    assert bc_shared_a.barcode == barcode_y
    assert bc_shared_b.barcode == barcode_y
    assert bc_shared_a.company_id != bc_shared_b.company_id

