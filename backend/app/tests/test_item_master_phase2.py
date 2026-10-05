"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.0
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Domain Verification Test Suite
"""

import pytest
import uuid
from decimal import Decimal
from sqlalchemy import select, func, text

from app.db.session import get_company_sessionmaker
from app.models.item_master import (
    Item,
    ItemStyle,
    ItemVariant,
    ItemBarcode,
    ItemUOMSetting,
    ItemPrice,
    ItemTaxProfile,
    ItemSupplierSetting,
    ItemSalesSetting,
    ItemInventoryPolicy,
)
from app.models.localization import UnitOfMeasurementRef
from app.models.purchase import Supplier
from app.services.item_domain_svc import ItemDomainService, BusinessLogicError
from app.services.item_readiness_svc import ItemReadinessEngine, ItemReadinessStatus
from app.schemas.item_master import (
    ItemStyleCreateRequest,
    ItemVariantCreateRequest,
)


@pytest.mark.asyncio
async def test_uom_master_prs_and_alias_pair():
    """Phase 1: Footwear statutory UQC PRS and legacy alias PAIR in uoms_ref."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Official footwear statutory UQC
        res_prs = await session.execute(
            select(UnitOfMeasurementRef).where(UnitOfMeasurementRef.code == "PRS")
        )
        prs = res_prs.scalars().first()
        assert prs is not None, "Official footwear UQC PRS must exist in uoms_ref"
        assert prs.decimal_allowed is False, "Footwear UQC PRS must have decimal_allowed=False"
        assert prs.uqc_code == "PRS"

        # 2. Governed legacy alias PAIR
        res_pair = await session.execute(
            select(UnitOfMeasurementRef).where(UnitOfMeasurementRef.code == "PAIR")
        )
        pair = res_pair.scalars().first()
        assert pair is not None, "Legacy footwear alias PAIR must exist in uoms_ref"
        assert pair.decimal_allowed is False

        # 3. UOM resolution helper
        resolved_prs = await ItemDomainService.resolve_uom_id(session, "PRS")
        assert resolved_prs == prs.id

        resolved_pair = await ItemDomainService.resolve_uom_id(session, "PAIR")
        assert resolved_pair == pair.id


@pytest.mark.asyncio
async def test_item_uom_settings_invariants():
    """Phase 2: item_uom_settings table structure, foreign keys, and conversion factor."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = f"COMP-UOM-{uuid.uuid4().hex[:6]}"
    var_id = f"var-uom-{uuid.uuid4().hex[:8]}"

    async with session_factory() as session:
        # Fetch PRS uom
        res_prs = await session.execute(select(UnitOfMeasurementRef).where(UnitOfMeasurementRef.code == "PRS"))
        prs = res_prs.scalars().first()
        assert prs is not None

        # Create dummy style and variant
        style = Item(
            id=f"itm-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"ST-{uuid.uuid4().hex[:6].upper()}",
            item_name="Footwear UOM Test Style",
            primary_uom="PRS",
            status="ACTIVE",
        )
        session.add(style)
        await session.flush()

        variant = ItemVariant(
            id=var_id,
            company_id=company_id,
            item_id=style.id,
            variant_sku=f"SKU-{uuid.uuid4().hex[:6].upper()}",
            variant_name="Variant Test PRS",
            color="BLACK",
            size="8",
            is_active=True,
        )
        session.add(variant)
        await session.flush()

        # Valid UOM setting
        uom_setting = ItemUOMSetting(
            item_variant_id=variant.id,
            company_id=company_id,
            stock_uom_id=prs.id,
            conversion_factor=Decimal("1.0000"),
        )
        session.add(uom_setting)
        await session.flush()

        assert uom_setting.item_variant_id == variant.id
        assert uom_setting.stock_uom_id == prs.id
        assert uom_setting.conversion_factor == Decimal("1.0000")


@pytest.mark.asyncio
async def test_item_prices_invariants_and_historical_zero_price_compatibility():
    """Phase 3: item_prices invariants and historical zero price compatibility."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = f"COMP-PRC-{uuid.uuid4().hex[:6]}"

    async with session_factory() as session:
        # Create style and variant with zero historical price
        style = Item(
            id=f"itm-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"ST-HIST-{uuid.uuid4().hex[:6].upper()}",
            item_name="Historical Style",
            primary_uom="PRS",
            status="ACTIVE",
        )
        session.add(style)
        await session.flush()

        # Historical variant with 0 selling price must succeed in DB without CHECK violation
        hist_var = ItemVariant(
            id=f"var-hist-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_id=style.id,
            variant_sku=f"SKU-HIST-{uuid.uuid4().hex[:6].upper()}",
            variant_name="Historical Zero Price Variant",
            color="BROWN",
            size="9",
            mrp=Decimal("0.00"),
            selling_price=Decimal("0.00"),
            cost_price=Decimal("0.00"),
            is_active=True,
        )
        session.add(hist_var)
        await session.flush()

        # Phase 3 ItemPrice record
        price_record = ItemPrice(
            item_variant_id=hist_var.id,
            company_id=company_id,
            cost_price=Decimal("1200.00"),
            selling_price=Decimal("2499.00"),
            mrp=Decimal("2999.00"),
            dealer_price=Decimal("1800.00"),
            wholesale_price=Decimal("2000.00"),
            minimum_selling_price=Decimal("2200.00"),
            maximum_discount_percent=Decimal("15.00"),
            currency="INR",
            is_active=True,
        )
        session.add(price_record)
        await session.flush()

        assert price_record.selling_price == Decimal("2499.00")
        assert price_record.mrp == Decimal("2999.00")
        assert price_record.minimum_selling_price <= price_record.selling_price
        assert price_record.maximum_discount_percent <= Decimal("100.00")


@pytest.mark.asyncio
async def test_item_tax_profiles_and_legacy_hsn_detection():
    """Phase 4: item_tax_profiles reuse and legacy 0000 HSN detection."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = f"COMP-TAX-{uuid.uuid4().hex[:6]}"

    async with session_factory() as session:
        style = Item(
            id=f"itm-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"ST-TAX-{uuid.uuid4().hex[:6].upper()}",
            item_name="Tax Profile Style",
            primary_uom="PRS",
            status="ACTIVE",
        )
        session.add(style)
        await session.flush()

        var = ItemVariant(
            id=f"var-tax-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_id=style.id,
            variant_sku=f"SKU-TAX-{uuid.uuid4().hex[:6].upper()}",
            variant_name="Tax Variant",
            color="NAVY",
            size="7",
            is_active=True,
        )
        session.add(var)
        await session.flush()

        # Valid tax profile
        tax_profile = ItemTaxProfile(
            item_variant_id=var.id,
            company_id=company_id,
            hsn_sac_code="64039190",
            tax_category="GOODS",
            gst_rate=Decimal("18.00"),
            tax_inclusive=True,
            tax_exempt=False,
        )
        session.add(tax_profile)
        await session.flush()

        assert tax_profile.hsn_sac_code == "64039190"
        assert tax_profile.gst_rate == Decimal("18.00")
        assert tax_profile.tax_inclusive is True

        # Readiness engine must flag legacy '0000' HSN as blocking reason
        readiness_legacy = ItemReadinessEngine.evaluate({
            "variant_sku": "SKU-LEGACY",
            "variant_name": "Legacy Shoes",
            "color": "BLACK",
            "size": "8",
            "brand": "TATTLY",
            "category": "FOOTWEAR",
            "stock_uom_id": "uom_prs",
            "selling_price": "1999.00",
            "mrp": "2499.00",
            "tax": {"hsn_sac_code": "0000", "gst_rate": "18.00"},
        })
        assert readiness_legacy["status"] == ItemReadinessStatus.INCOMPLETE.value
        assert any(r["field"] == "hsn_sac_code" for r in readiness_legacy["blocking_reasons"])


@pytest.mark.asyncio
async def test_item_supplier_settings_and_purchasing_authority():
    """Phase 5: item_supplier_settings referencing suppliers.id."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Fetch or ensure valid company_id
        res_comp = await session.execute(text("SELECT id FROM companies LIMIT 1"))
        company_id = res_comp.scalar()
        if not company_id:
            company_id = f"COMP-SUP-{uuid.uuid4().hex[:6]}"
            await session.execute(
                text("INSERT INTO companies (id, name, code) VALUES (:id, :name, :code)"),
                {"id": company_id, "name": "Supplier Test Company", "code": company_id[:10]}
            )
            await session.flush()

        # Create supplier
        supp = Supplier(
            id=f"sup-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            name="Apex Footwear Manufacturing Ltd",
            code=f"VEND-{uuid.uuid4().hex[:4].upper()}",
        )
        session.add(supp)
        await session.flush()

        # Create style & variant
        style = Item(
            id=f"itm-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"ST-SUP-{uuid.uuid4().hex[:6].upper()}",
            item_name="Supplier Linked Style",
            primary_uom="PRS",
            status="ACTIVE",
        )
        session.add(style)
        await session.flush()

        var = ItemVariant(
            id=f"var-sup-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_id=style.id,
            variant_sku=f"SKU-SUP-{uuid.uuid4().hex[:6].upper()}",
            variant_name="Supplier Linked Variant",
            color="TAN",
            size="10",
            is_active=True,
        )
        session.add(var)
        await session.flush()

        res_prs = await session.execute(select(UnitOfMeasurementRef).where(UnitOfMeasurementRef.code == "PRS"))
        prs = res_prs.scalars().first()

        supp_setting = ItemSupplierSetting(
            item_variant_id=var.id,
            company_id=company_id,
            preferred_supplier_id=supp.id,
            supplier_item_code="AFM-MOD-101",
            purchase_uom_id=prs.id,
            minimum_purchase_qty=Decimal("12.0000"),
            purchase_cost=Decimal("850.00"),
            purchase_lead_time=14,
            is_active=True,
        )
        session.add(supp_setting)
        await session.flush()

        assert supp_setting.preferred_supplier_id == supp.id
        assert supp_setting.minimum_purchase_qty == Decimal("12.0000")
        assert supp_setting.purchase_lead_time == 14


@pytest.mark.asyncio
async def test_item_sales_settings_commercial_policy():
    """Phase 6: item_sales_settings commercial authority."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = f"COMP-SALES-{uuid.uuid4().hex[:6]}"

    async with session_factory() as session:
        style = Item(
            id=f"itm-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"ST-SAL-{uuid.uuid4().hex[:6].upper()}",
            item_name="Sales Settings Style",
            primary_uom="PRS",
            status="ACTIVE",
        )
        session.add(style)
        await session.flush()

        var = ItemVariant(
            id=f"var-sal-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_id=style.id,
            variant_sku=f"SKU-SAL-{uuid.uuid4().hex[:6].upper()}",
            variant_name="Sales Variant",
            color="RED",
            size="6",
            is_active=True,
        )
        session.add(var)
        await session.flush()

        sales_setting = ItemSalesSetting(
            item_variant_id=var.id,
            company_id=company_id,
            selling_price=Decimal("1999.00"),
            mrp=Decimal("2499.00"),
            wholesale_price=Decimal("1600.00"),
            minimum_selling_price=Decimal("1799.00"),
            maximum_discount_percent=Decimal("10.00"),
            allow_discount=True,
            billable=True,
        )
        session.add(sales_setting)
        await session.flush()

        assert sales_setting.selling_price == Decimal("1999.00")
        assert sales_setting.billable is True
        assert sales_setting.allow_discount is True


@pytest.mark.asyncio
async def test_item_inventory_policy_strict_policy_only():
    """Phase 7: item_inventory_policies stores strictly replenishment policy, zero physical stock."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = f"COMP-POL-{uuid.uuid4().hex[:6]}"

    async with session_factory() as session:
        # Check column names on ItemInventoryPolicy: STRICTLY ZERO physical stock
        column_names = [c.name for c in ItemInventoryPolicy.__table__.columns]
        prohibited_fields = ["current_stock", "available_stock", "reserved_stock", "warehouse_stock", "sold_qty", "physical_stock"]
        for p in prohibited_fields:
            assert p not in column_names, f"Physical stock field '{p}' must NEVER exist in ItemInventoryPolicy!"

        style = Item(
            id=f"itm-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"ST-POL-{uuid.uuid4().hex[:6].upper()}",
            item_name="Policy Style",
            primary_uom="PRS",
            status="ACTIVE",
        )
        session.add(style)
        await session.flush()

        var = ItemVariant(
            id=f"var-pol-{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_id=style.id,
            variant_sku=f"SKU-POL-{uuid.uuid4().hex[:6].upper()}",
            variant_name="Policy Variant",
            color="WHITE",
            size="11",
            is_active=True,
        )
        session.add(var)
        await session.flush()

        policy = ItemInventoryPolicy(
            item_variant_id=var.id,
            company_id=company_id,
            minimum_stock=Decimal("10.0000"),
            reorder_level=Decimal("20.0000"),
            reorder_quantity=Decimal("50.0000"),
            maximum_stock=Decimal("100.0000"),
            safety_stock=Decimal("5.0000"),
            lead_time=7,
        )
        session.add(policy)
        await session.flush()

        assert policy.reorder_level <= policy.maximum_stock
        assert policy.minimum_stock >= Decimal("0.0000")


@pytest.mark.asyncio
async def test_item_readiness_engine_lifecycle_and_blocking_reasons():
    """Phase 8: ItemReadinessEngine evaluates lifecycle and returns structured blocking reasons."""
    # 1. Incomplete variant: Missing selling price, HSN, Stock UOM
    incomplete_eval = ItemReadinessEngine.evaluate({
        "variant_sku": "SKU-TEST-001",
        "variant_name": "Test Incomplete Shoes",
        "brand": "SMRITI",
        "category": "FOOTWEAR",
        "color": "BLACK",
        "size": "8",
        "selling_price": "0.00",
        "mrp": "0.00",
    })
    assert incomplete_eval["status"] == ItemReadinessStatus.INCOMPLETE.value
    assert incomplete_eval["ready_for_sale"] is False
    assert len(incomplete_eval["blocking_reasons"]) >= 3
    fields = [r["field"] for r in incomplete_eval["blocking_reasons"]]
    assert "selling_price" in fields
    assert "hsn_sac_code" in fields
    assert "stock_uom" in fields

    # 2. Complete variant: Ready for sale
    complete_eval = ItemReadinessEngine.evaluate({
        "variant_sku": "SKU-READY-001",
        "variant_name": "Test Sale Ready Shoes",
        "brand": "SMRITI",
        "category": "FOOTWEAR",
        "color": "BLACK",
        "size": "8",
        "stock_uom_id": "uom_prs",
        "selling_price": "2499.00",
        "mrp": "2999.00",
        "tax": {
            "hsn_sac_code": "64039190",
            "gst_rate": "18.00",
        },
        "status": "ACTIVE",
    })
    assert complete_eval["status"] == ItemReadinessStatus.ACTIVE.value
    assert complete_eval["ready_for_sale"] is True
    assert len(complete_eval["blocking_reasons"]) == 0

    # 3. Draft variant: Preserves DRAFT status without breaking
    draft_eval = ItemReadinessEngine.evaluate({
        "variant_sku": "SKU-DRAFT-001",
        "variant_name": "In-Progress Draft Shoes",
        "status": "DRAFT",
    })
    assert draft_eval["status"] == ItemReadinessStatus.DRAFT.value
    assert draft_eval["ready_for_sale"] is False


@pytest.mark.asyncio
async def test_item_master_phase2_e2e_persistence_and_relationships():
    """Phase 13: End-to-end variant creation with full Phase 2 domains via ItemDomainService."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = f"COMP-E2E-{uuid.uuid4().hex[:6]}"

    async with session_factory() as session:
        # Create Style
        style_code = f"ST-{uuid.uuid4().hex[:6].upper()}"
        style_req = ItemStyleCreateRequest(
            style_code=style_code,
            style_name="E2E Phase 2 Oxford Shoe",
            brand="TATTLY THREADS",
            category="FORMAL",
            primary_uom="PRS",
            hsn_code="64039190",
            tax_rate=18.0,
        )
        style = await ItemDomainService.create_style(session, style_req, company_id=company_id)
        assert style.id is not None

        # Create Variant with full Phase 2 domain configuration
        var_sku = f"{style_code}-BLK-9"
        var_req = ItemVariantCreateRequest(
            style_id=style.id,
            color="BLACK",
            size="9",
            variant_sku=var_sku,
            variant_name="E2E Phase 2 Oxford Shoe (Black/9)",
            primary_barcode="8901234567890",
            uom={
                "stock_uom_id": "PRS",
                "sales_uom_id": "PRS",
                "conversion_factor": 1.0,
            },
            pricing={
                "mrp": 3499.00,
                "selling_price": 2999.00,
                "cost_price": 1800.00,
                "minimum_selling_price": 2799.00,
                "maximum_discount_percent": 10.0,
            },
            tax={
                "hsn_sac_code": "64039190",
                "gst_rate": 18.0,
                "tax_inclusive": True,
            },
            inventory_policy={
                "minimum_stock": 5.0,
                "reorder_level": 15.0,
                "reorder_quantity": 30.0,
                "maximum_stock": 60.0,
                "safety_stock": 5.0,
                "lead_time": 10,
            },
        )

        variant, pbe, barcode = await ItemDomainService.create_variant(
            session=session,
            req=var_req,
            company_id=company_id,
        )
        assert variant.id is not None

        # Reload variant with all Phase 2 relationships
        loaded = await ItemDomainService.get_variant(session, variant.id, company_id=company_id)
        assert loaded is not None

        # Verify child domain records
        assert loaded.uom_setting is not None
        assert loaded.uom_setting.stock_uom_id == "uom_prs"

        assert loaded.price_setting is not None
        assert loaded.price_setting.selling_price == Decimal("2999.00")
        assert loaded.price_setting.mrp == Decimal("3499.00")

        assert loaded.tax_profile is not None
        assert loaded.tax_profile.hsn_sac_code == "64039190"
        assert loaded.tax_profile.gst_rate == Decimal("18.00")

        assert loaded.inventory_policy is not None
        assert loaded.inventory_policy.reorder_level == Decimal("15.0000")
        assert loaded.inventory_policy.maximum_stock == Decimal("60.0000")

        # Verify readiness evaluation
        readiness = ItemReadinessEngine.evaluate_orm_variant(loaded)
        assert readiness["ready_for_sale"] is True
        assert len(readiness["blocking_reasons"]) == 0

        # Verify SKU and Barcode invariants
        assert loaded.id == variant.id  # technical PK unchanged
        assert loaded.variant_sku == var_sku  # canonical business identity
        assert len(loaded.barcodes) == 1
        assert loaded.barcodes[0].barcode == "8901234567890"
        assert loaded.barcodes[0].is_primary is True
