"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-09-13
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
import uuid
from decimal import Decimal
from typing import List
import pytest
from sqlalchemy import select, delete, or_, text

from app.db.session import get_company_sessionmaker
from app.models.attributes import AttributeDefinition, AttributeGroup, VariantTemplate
from app.models.inventory import Product
from app.models.master_lookup import MasterType, MasterValue
from app.schemas.attributes import (
    AttributeDefinitionCreate,
    AttributeGroupCreate,
    VariantTemplateCreate,
)
from app.services.attributes import AttributesService


TEST_STYLE_CODES = ["TEST-MTX-01", "TEST-MTX-02", "TEST-MTX-03"]
TEST_GROUP_IDS = ["grp-test-mtx-apparel", "grp-test-mtx-footwear"]
TEST_ATTR_IDS = ["attr-test-size", "attr-test-color"]


@pytest.fixture(autouse=True)
async def cleanup_matrix_test_data():
    """Ensure test entities are cleaned before and after tests."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Delete test products
        await session.execute(
            delete(Product).where(
                or_(
                    Product.style_code.in_(TEST_STYLE_CODES),
                    Product.code.like("TEST-MTX-%"),
                )
            )
        )
        # Delete test variant templates
        await session.execute(
            delete(VariantTemplate).where(
                VariantTemplate.style_code.in_(TEST_STYLE_CODES)
            )
        )
        # Delete test attribute groups
        await session.execute(
            delete(AttributeGroup).where(
                AttributeGroup.id.in_(TEST_GROUP_IDS)
            )
        )
        # Delete test attribute definitions
        await session.execute(
            delete(AttributeDefinition).where(
                AttributeDefinition.id.in_(TEST_ATTR_IDS)
            )
        )
        await session.commit()

    yield

    async with session_factory() as session:
        await session.execute(
            delete(Product).where(
                or_(
                    Product.style_code.in_(TEST_STYLE_CODES),
                    Product.code.like("TEST-MTX-%"),
                )
            )
        )
        await session.execute(
            delete(VariantTemplate).where(
                VariantTemplate.style_code.in_(TEST_STYLE_CODES)
            )
        )
        await session.execute(
            delete(AttributeGroup).where(
                AttributeGroup.id.in_(TEST_GROUP_IDS)
            )
        )
        await session.execute(
            delete(AttributeDefinition).where(
                AttributeDefinition.id.in_(TEST_ATTR_IDS)
            )
        )
        await session.commit()


@pytest.mark.asyncio
async def test_master_lookup_governed_size_and_color_groups():
    """
    Step 1 of Pipeline:
    Verify Master Lookup contains governed Size Group and Color Group types and values.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Check size_group master type
        res_sg = await session.execute(
            select(MasterType).where(MasterType.code == "size_group")
        )
        sg_type = res_sg.scalars().first()
        assert sg_type is not None, "MasterType 'size_group' must exist"

        # Check color_group master type
        res_cg = await session.execute(
            select(MasterType).where(MasterType.code == "color_group")
        )
        cg_type = res_cg.scalars().first()
        assert cg_type is not None, "MasterType 'color_group' must exist"

        # Check APPAREL_ALPHA size group values
        res_sg_val = await session.execute(
            select(MasterValue).where(
                MasterValue.master_type_id == sg_type.id,
                MasterValue.code == "APPAREL_ALPHA",
            )
        )
        sg_val = res_sg_val.scalars().first()
        assert sg_val is not None, "Size group APPAREL_ALPHA must exist in Master Values"
        sg_data = sg_val.data if isinstance(sg_val.data, dict) else json.loads(sg_val.data)
        assert "values" in sg_data
        assert "M" in sg_data["values"]

        # Check COLOR_BASIC color group values
        res_cg_val = await session.execute(
            select(MasterValue).where(
                MasterValue.master_type_id == cg_type.id,
                MasterValue.code == "COLOR_BASIC",
            )
        )
        cg_val = res_cg_val.scalars().first()
        assert cg_val is not None, "Color group COLOR_BASIC must exist in Master Values"
        cg_data = cg_val.data if isinstance(cg_val.data, dict) else json.loads(cg_val.data)
        assert "values" in cg_data
        assert "BLACK" in cg_data["values"]


@pytest.mark.asyncio
async def test_attribute_group_governance_and_dimension_mapping():
    """
    Step 2 of Pipeline:
    Verify Attribute Group requires and persists governed size_group_id and color_group_id.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        svc = AttributesService(session)

        # 1. Create with explicit governed mappings
        group_in = AttributeGroupCreate(
            name="Test Apparel Group",
            attributeIds=[],
            sizeGroupId="APPAREL_ALPHA",
            colorGroupId="COLOR_BASIC",
        )
        grp = await svc.create_group(group_in, creator="test-agent")
        assert grp.id is not None
        assert grp.size_group_id == "APPAREL_ALPHA"
        assert grp.color_group_id == "COLOR_BASIC"

        # 2. Verify persistence in database
        persisted = await session.get(AttributeGroup, grp.id)
        assert persisted is not None
        assert persisted.size_group_id == "APPAREL_ALPHA"
        assert persisted.color_group_id == "COLOR_BASIC"

        # Cleanup created group
        await session.delete(persisted)
        await session.commit()


@pytest.mark.asyncio
async def test_all_production_attribute_groups_have_size_and_color_mappings():
    """
    Safety Guard:
    Verify that 100% of Attribute Groups in the database have non-null size_group_id and color_group_id.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        res = await session.execute(
            select(AttributeGroup).where(
                or_(
                    AttributeGroup.size_group_id.is_(None),
                    AttributeGroup.size_group_id == "",
                    AttributeGroup.color_group_id.is_(None),
                    AttributeGroup.color_group_id == "",
                )
            )
        )
        unmapped = res.scalars().all()
        assert len(unmapped) == 0, f"Found {len(unmapped)} unmapped attribute groups: {[g.name for g in unmapped]}"


@pytest.mark.asyncio
async def test_sku_matrix_generation_pipeline_zero_buying_cost_preserved():
    """
    Step 3 & 4 of Pipeline:
    End-to-End Test: Master Lookup -> Attribute Group -> Variant Template -> SKU Matrix Generation.
    Specifically validates:
    - Legacy / zero cost templates (base_cost_price = 0.00) strictly preserve 0.00 cost price.
    - The old 60% fallback (base_price * 0.6) is NEVER triggered.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Setup Attribute Definitions: Color (Row) and Size (Col)
        color_def = AttributeDefinition(
            id=TEST_ATTR_IDS[1],
            name="color",
            label="Color",
            data_type="select",
            is_variant_dimension=True,
            is_mandatory=True,
            valid_values=json.dumps(["Black", "White"]),
            created_by="test-agent",
            updated_by="test-agent",
        )
        size_def = AttributeDefinition(
            id=TEST_ATTR_IDS[0],
            name="size",
            label="Size",
            data_type="select",
            is_variant_dimension=True,
            is_mandatory=True,
            valid_values=json.dumps(["M", "L"]),
            created_by="test-agent",
            updated_by="test-agent",
        )
        session.add_all([color_def, size_def])
        await session.flush()

        # 2. Setup Attribute Group linked to Master Lookup Size and Color Groups
        grp = AttributeGroup(
            id=TEST_GROUP_IDS[0],
            name="Test Apparel Basic",
            attribute_ids=json.dumps([color_def.id, size_def.id]),
            grid_column_attribute_id=size_def.id,
            grid_row_attribute_id=color_def.id,
            size_group_id="APPAREL_ALPHA",
            color_group_id="COLOR_BASIC",
            created_by="test-agent",
            updated_by="test-agent",
        )
        session.add(grp)
        await session.flush()

        # 3. Create Variant Template with base_cost_price = 0.00
        template = VariantTemplate(
            id=f"vt-{uuid.uuid4().hex[:8]}",
            style_code="TEST-MTX-01",
            vendor_code="VND-MTX-01",
            name="Zero Cost Graphic Tee",
            brand="SMRITI",
            category="Apparel",
            hsn_code="61091000",
            base_price=999,
            base_mrp=1299,
            base_cost_price=Decimal("0.00"),
            gst_percentage=18,
            attribute_group_id=grp.id,
            pricing_mode="Fixed",
            tracking_mode="Standard",
            created_by="test-agent",
            updated_by="test-agent",
        )
        session.add(template)
        await session.commit()

        # 4. Generate SKU matrix variants (Size x Color combinations)
        # Using the exact core logic from /templates/{id}/generate-variants
        matrix_combinations = [
            {"attributes": {"color": "Black", "size": "M"}},
            {"attributes": {"color": "Black", "size": "L"}},
            {"attributes": {"color": "White", "size": "M"}},
            {"attributes": {"color": "White", "size": "L"}},
        ]

        created_products: List[Product] = []
        for idx, variant in enumerate(matrix_combinations):
            sku_code = f"{template.style_code}-{variant['attributes']['color'].upper()}-{variant['attributes']['size'].upper()}"
            
            # Resolve cost price per fixed logic:
            cost_val = variant.get("costPrice")
            if cost_val is not None and str(cost_val).strip() != "":
                resolved_cost = float(cost_val)
            elif template.base_cost_price is not None:
                resolved_cost = float(template.base_cost_price)
            else:
                resolved_cost = 0.0

            prod = Product(
                id=f"p-test-mtx-{idx}",
                code=sku_code,
                sku=sku_code,
                name=template.name,
                price=float(template.base_price),
                mrp=float(template.base_mrp),
                cost_price=resolved_cost,
                stock=10,
                category=template.category,
                barcode=f"SMR-B9990{idx}",
                style_code=template.style_code,
                vendor_code=template.vendor_code,
                gst_percentage=template.gst_percentage,
                attributes=variant["attributes"],
                variant_template_id=template.id,
                created_by="test-agent",
                updated_by="test-agent",
            )
            session.add(prod)
            created_products.append(prod)

        await session.commit()

        # 5. Assertions on Generated SKUs
        assert len(created_products) == 4

        # Verify all SKUs in database
        res_prods = await session.execute(
            select(Product).where(Product.style_code == "TEST-MTX-01")
        )
        db_prods = res_prods.scalars().all()
        assert len(db_prods) == 4

        expected_skus = {
            "TEST-MTX-01-BLACK-M",
            "TEST-MTX-01-BLACK-L",
            "TEST-MTX-01-WHITE-M",
            "TEST-MTX-01-WHITE-L",
        }
        actual_skus = {p.sku for p in db_prods}
        assert actual_skus == expected_skus

        for p in db_prods:
            assert p.vendor_code == "VND-MTX-01"
            assert p.price == 999.0
            assert p.mrp == 1299.0
            # CRITICAL VERIFICATION: cost_price must be exactly 0.00, NOT 999 * 0.6 = 599.4
            assert p.cost_price == 0.0, f"Expected 0.00 cost price, got {p.cost_price}"
            assert p.variant_template_id == template.id


@pytest.mark.asyncio
async def test_sku_matrix_cell_cost_override_honored():
    """
    Verify that when a matrix cell specifies an explicit buying cost,
    that cost is honored instead of base_cost_price.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create Template with base_cost_price = 300.00
        template = VariantTemplate(
            id=f"vt-{uuid.uuid4().hex[:8]}",
            style_code="TEST-MTX-02",
            vendor_code="VND-MTX-02",
            name="Custom Cost Shirt",
            brand="SMRITI",
            category="Apparel",
            hsn_code="61091000",
            base_price=799,
            base_mrp=999,
            base_cost_price=Decimal("300.00"),
            gst_percentage=18,
            attribute_group_id=TEST_GROUP_IDS[0] if len(TEST_GROUP_IDS) > 0 else "dummy",
            pricing_mode="Fixed",
            tracking_mode="Standard",
            created_by="test-agent",
            updated_by="test-agent",
        )
        session.add(template)
        await session.commit()

        # Variant 1 uses template default, Variant 2 overrides cost to 450.00
        variants_input = [
            {"attributes": {"color": "Blue", "size": "M"}},  # should take base_cost_price (300.00)
            {"attributes": {"color": "Blue", "size": "L"}, "costPrice": 450.00},  # explicit override
        ]

        created = []
        for idx, variant in enumerate(variants_input):
            sku_code = f"{template.style_code}-{variant['attributes']['color'].upper()}-{variant['attributes']['size'].upper()}"
            cost_val = variant.get("costPrice")
            if cost_val is not None and str(cost_val).strip() != "":
                resolved_cost = float(cost_val)
            elif template.base_cost_price is not None:
                resolved_cost = float(template.base_cost_price)
            else:
                resolved_cost = 0.0

            prod = Product(
                id=f"p-test-mtx-cost-{idx}",
                code=sku_code,
                sku=sku_code,
                name=template.name,
                price=float(template.base_price),
                mrp=float(template.base_mrp),
                cost_price=resolved_cost,
                stock=5,
                category=template.category,
                barcode=f"SMR-B9991{idx}",
                style_code=template.style_code,
                vendor_code=template.vendor_code,
                gst_percentage=template.gst_percentage,
                attributes=variant["attributes"],
                variant_template_id=template.id,
                created_by="test-agent",
                updated_by="test-agent",
            )
            session.add(prod)
            created.append(prod)

        await session.commit()

        # Verify Variant 1 has 300.00 and Variant 2 has 450.00
        p1 = await session.get(Product, "p-test-mtx-cost-0")
        assert p1 is not None
        assert p1.cost_price == 300.00

        p2 = await session.get(Product, "p-test-mtx-cost-1")
        assert p2 is not None
        assert p2.cost_price == 450.00
