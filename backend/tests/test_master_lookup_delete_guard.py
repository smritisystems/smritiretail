"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-30
Modified     : 2026-10-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.master_lookup import MasterValue, MasterType
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.inventory import Product
from app.models.attributes import VariantTemplate, AttributeGroup
from app.models.size_groups import SizeGroup, SizeGroupValue
from app.services.master_delete_guard import MasterValueDeleteGuard
from app.api.v1 import master_lookup


class _MockResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class _MockSession:
    def __init__(self, query_responses=None):
        self._responses = list(query_responses or [])
        self.commit = AsyncMock()
        self.refresh = AsyncMock()
        self.rollback = AsyncMock()

    async def execute(self, statement):
        if self._responses:
            return self._responses.pop(0)
        return _MockResult([])

    async def scalar(self, statement):
        res = await self.execute(statement)
        if hasattr(res, "scalar_one_or_none"):
            return res.scalar_one_or_none()
        rows = res.all()
        return rows[0] if rows else None


@pytest.mark.asyncio
async def test_guard_permits_delete_when_no_active_references_exist():
    """When a master lookup value has 0 references anywhere, check_references returns None."""
    val = MasterValue(
        id=uuid.uuid4(),
        code="UNLINKED_BRAND",
        name="Unlinked Brand Name",
    )
    # Mock session returns empty result for all queries
    db = _MockSession([_MockResult([]) for _ in range(15)])

    result = await MasterValueDeleteGuard.check_references(db, val, "brand")
    assert result is None


@pytest.mark.asyncio
async def test_guard_blocks_delete_when_item_master_references_brand():
    """Item referencing a brand blocks deletion with HTTP 409 and linked_records."""
    val_id = uuid.uuid4()
    val = MasterValue(
        id=val_id,
        code="NIKE",
        name="Nike Sports",
    )
    # Query order:
    # 1. child master values -> empty
    # 2. variant templates -> empty
    # 3. item master -> returns matching Item
    item_row = SimpleNamespace(
        id="item-001",
        item_code="NK-AIR-01",
        item_name="Nike Air Max",
        company_id="COMP-01",
    )

    db = _MockSession([
        _MockResult([]),        # child
        _MockResult([]),        # templates
        _MockResult([item_row]), # items
        _MockResult([]),        # variants
        _MockResult([]),        # products
    ])

    result = await MasterValueDeleteGuard.check_references(db, val, "brand")

    assert result is not None
    assert result["can_delete"] is False
    assert result["code"] == "SMRITI-VAL-003"
    assert "Cannot delete Brand" in result["message"]
    assert "NK-AIR-01" in result["message"] or result["total_references"] == 1
    assert len(result["linked_records"]) == 1
    assert result["linked_records"][0]["entity_type"] == "Item Master"
    assert result["linked_records"][0]["identifier"] == "NK-AIR-01"
    assert result["linked_records"][0]["field"] == "brand"


@pytest.mark.asyncio
async def test_guard_blocks_delete_when_item_variant_references_color():
    """ItemVariant referencing color blocks deletion with structured SKU details."""
    val_id = uuid.uuid4()
    val = MasterValue(
        id=val_id,
        code="CRIMSON_RED",
        name="Crimson Red",
    )
    variant_row = SimpleNamespace(
        id="var-001",
        variant_sku="NK-AIR-01-CRIM-42",
        variant_name="Nike Air Max Crimson Red EU 42",
        company_id="COMP-01",
    )

    db = _MockSession([
        _MockResult([]),           # child
        _MockResult([]),           # templates
        _MockResult([]),           # items
        _MockResult([variant_row]), # variants
        _MockResult([]),           # products
    ])

    result = await MasterValueDeleteGuard.check_references(db, val, "color")

    assert result is not None
    assert result["can_delete"] is False
    assert result["code"] == "SMRITI-VAL-003"
    assert result["total_references"] == 1
    assert result["linked_records"][0]["entity_type"] == "Item Variant (SKU)"
    assert result["linked_records"][0]["identifier"] == "NK-AIR-01-CRIM-42"
    assert result["linked_records"][0]["field"] == "color"


@pytest.mark.asyncio
async def test_guard_blocks_delete_when_barcode_references_value():
    """ItemBarcode referencing value blocks deletion."""
    val_id = uuid.uuid4()
    val = MasterValue(
        id=val_id,
        code="8901234567890",
        name="8901234567890",
    )
    barcode_row = SimpleNamespace(
        id="bc-001",
        barcode="8901234567890",
        item_id="item-001",
        company_id="COMP-01",
    )

    db = _MockSession([
        _MockResult([]),            # child
        _MockResult([]),            # templates
        _MockResult([]),            # items
        _MockResult([]),            # variants
        _MockResult([barcode_row]),  # barcodes
        _MockResult([]),            # products
    ])

    result = await MasterValueDeleteGuard.check_references(db, val, "barcode")

    assert result is not None
    assert result["can_delete"] is False
    assert result["linked_records"][0]["entity_type"] == "Item Barcode"
    assert result["linked_records"][0]["identifier"] == "8901234567890"


@pytest.mark.asyncio
async def test_guard_blocks_delete_when_variant_template_references_style():
    """VariantTemplate referencing style blocks deletion."""
    val_id = uuid.uuid4()
    val = MasterValue(
        id=val_id,
        code="STYLE-101",
        name="Oxford Classic",
    )
    tmpl_row = SimpleNamespace(
        id="tmpl-001",
        style_code="STYLE-101",
        name="Oxford Classic Template",
        brand="SMRITI",
        category="FOOTWEAR",
    )

    db = _MockSession([
        _MockResult([]),         # child
        _MockResult([tmpl_row]), # templates
        _MockResult([]),         # items
        _MockResult([]),         # variants
    ])

    result = await MasterValueDeleteGuard.check_references(db, val, "style_article")

    assert result is not None
    assert result["can_delete"] is False
    assert result["linked_records"][0]["entity_type"] == "Variant Template"
    assert result["linked_records"][0]["identifier"] == "STYLE-101"


@pytest.mark.asyncio
async def test_guard_blocks_delete_when_child_master_values_exist():
    """Child lookup value referencing parent blocks deletion."""
    parent_id = uuid.uuid4()
    parent = MasterValue(
        id=parent_id,
        code="FOOTWEAR",
        name="Footwear Category",
    )
    child_row = SimpleNamespace(
        id=uuid.uuid4(),
        code="CASUAL_SHOES",
        name="Casual Shoes",
        company_id=None,
    )

    db = _MockSession([
        _MockResult([child_row]), # child values found!
    ])

    result = await MasterValueDeleteGuard.check_references(db, parent, "category")

    assert result is not None
    assert result["can_delete"] is False
    assert result["linked_records"][0]["entity_type"] == "Child Master Value"
    assert result["linked_records"][0]["identifier"] == "CASUAL_SHOES"


@pytest.mark.asyncio
async def test_size_group_guard_blocks_delete_when_referenced_by_sku():
    """Size group whose values are referenced by ItemVariant blocks deletion."""
    group_id = "grp-size-eu-footwear"
    var_row = SimpleNamespace(
        id="var-002",
        variant_sku="SHOE-EU42-BLK",
        variant_name="Classic Shoe EU 42",
        company_id="COMP-01",
    )

    db = _MockSession([
        _MockResult([]),        # attr groups
        _MockResult([var_row]), # item variants
        _MockResult([]),        # items
        _MockResult([]),        # products
    ])

    result = await MasterValueDeleteGuard.check_size_group_references(
        db,
        group_id=group_id,
        group_code="EU_SIZES",
        group_name="European Shoe Sizes",
        group_values=["40", "41", "42", "43"],
    )

    assert result is not None
    assert result["can_delete"] is False
    assert result["code"] == "SMRITI-VAL-003"
    assert "European Shoe Sizes" in result["message"]
    assert result["linked_records"][0]["entity_type"] == "Item Variant (SKU)"
    assert result["linked_records"][0]["identifier"] == "SHOE-EU42-BLK"


@pytest.mark.asyncio
async def test_size_group_guard_blocks_delete_when_referenced_by_attribute_group():
    """Size group linked to AttributeGroup blocks deletion."""
    group_id = "grp-size-eu-footwear"
    ag_row = SimpleNamespace(
        id="ag-001",
        name="Footwear Attributes",
    )

    db = _MockSession([
        _MockResult([ag_row]), # attr groups found
    ])

    result = await MasterValueDeleteGuard.check_size_group_references(
        db,
        group_id=group_id,
        group_code="EU_SIZES",
        group_name="European Shoe Sizes",
        group_values=["40", "41", "42"],
    )

    assert result is not None
    assert result["can_delete"] is False
    assert result["linked_records"][0]["entity_type"] == "Attribute Group"
    assert result["linked_records"][0]["identifier"] == "ag-001"


@pytest.mark.asyncio
async def test_api_endpoint_raises_409_with_structured_guard_payload():
    """delete_lookup_value endpoint raises HTTP 409 with full guard payload when references exist."""
    type_id = uuid.uuid4()
    val_id = uuid.uuid4()
    master_type = MasterType(id=type_id, code="brand", label="Brand")
    item = MasterValue(id=val_id, master_type_id=type_id, code="ADIDAS", name="Adidas")

    user = SimpleNamespace(username="admin", role="sysadmin", company_id="COMP-01")

    item_row = SimpleNamespace(
        id="item-002",
        item_code="ADI-BOOST-01",
        item_name="Adidas Ultraboost",
        company_id="COMP-01",
    )

    db = _MockSession([
        _MockResult([master_type]), # MasterType lookup
        _MockResult([item]),        # MasterValue lookup
        _MockResult([]),            # child
        _MockResult([]),            # templates
        _MockResult([item_row]),    # items
    ])

    with pytest.raises(HTTPException) as exc_info:
        await master_lookup.delete_lookup_value(
            type_code="brand",
            id=val_id,
            db=db,
            current_user=user,
        )

    assert exc_info.value.status_code == 409
    detail = exc_info.value.detail
    assert isinstance(detail, dict)
    assert detail["code"] == "SMRITI-VAL-003"
    assert detail["can_delete"] is False
    assert "ADI-BOOST-01" in detail["linked_records"][0]["identifier"]


@pytest.mark.asyncio
async def test_variant_template_delete_guard_blocks_when_linked_to_item():
    """Deleting a VariantTemplate raises 409 if active Item records share the style_code."""
    from app.services.attributes import AttributesService

    template = VariantTemplate(
        id="tpl-001",
        style_code="STYLE-TPL-01",
        name="Template Style",
        attribute_group_id="grp-01",
    )
    template.is_deleted = False

    class _MockAttrSession:
        def __init__(self):
            self.commit = AsyncMock()

        async def get(self, model, ident):
            return template

        async def scalar(self, stmt):
            # 1st query: Product.id -> None
            # 2nd query: Item.id -> returns 'item-tpl-001'
            if not hasattr(self, "_step"):
                self._step = 0
            self._step += 1
            if self._step == 1:
                return None
            return "item-tpl-001"

    db = _MockAttrSession()
    service = AttributesService(db)

    with pytest.raises(HTTPException) as exc_info:
        await service.delete_template("tpl-001", "admin")

    assert exc_info.value.status_code == 409
    assert "in use by Item Master records" in exc_info.value.detail


@pytest.mark.asyncio
async def test_warehouse_delete_guard_blocks_when_positive_stock_exists():
    """delete_master for warehouse raises 409 if positive stock quantity exists."""
    from app.api.v1.masters import delete_master
    from app.models.inventory import Warehouse

    user = SimpleNamespace(username="admin", role="sysadmin", company_id="COMP-01")
    wh = Warehouse(
        id="wh-001",
        name="Central Warehouse",
        code="WH-CENTRAL",
        company_id="COMP-01",
        is_deleted=False,
    )

    db = _MockSession([
        _MockResult([wh]),          # _scoped_entity Warehouse
        _MockResult(["stock-001"]), # ProductBatchStock positive stock ref
    ])

    with pytest.raises(HTTPException) as exc_info:
        await delete_master("warehouse", "wh-001", db, user)

    assert exc_info.value.status_code == 409
    assert "positive stock quantity exists" in exc_info.value.detail
