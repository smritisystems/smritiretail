"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.item_master_service import UniversalItemMasterService
from app.models.item_master import Item, ItemVariant, ItemBarcode


@pytest.fixture(autouse=True)
async def cleanup_test_items():
    """Clean up test items before and after each test."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(Item).where(Item.item_code.like("SKU-%")))
            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(Item).where(Item.item_code.like("SKU-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_create_and_fetch_universal_item_with_variants():
    """Verify creating a canonical Item with variants and unique barcodes."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        item = await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code="SKU-POLO-NAVY",
            item_name="Premium Pique Polo Shirt",
            category="Apparel",
            brand="SMRITI Luxe",
            hsn_code="61051000",
            tax_rate=12.00,
            mrp=1499.00,
            selling_price=1299.00,
            cost_price=650.00,
            primary_barcode="8901234567890",
            variants_data=[
                {
                    "variant_sku": "SKU-POLO-NAVY-M",
                    "variant_name": "Polo Navy Size M",
                    "attributes_json": {"size": "M", "color": "Navy"},
                    "barcode": "8901234567891",
                    "mrp": 1499.00,
                    "selling_price": 1299.00
                },
                {
                    "variant_sku": "SKU-POLO-NAVY-L",
                    "variant_name": "Polo Navy Size L",
                    "attributes_json": {"size": "L", "color": "Navy"},
                    "barcode": "8901234567892",
                    "mrp": 1599.00,
                    "selling_price": 1399.00
                }
            ]
        )

        assert item is not None
        assert item.item_code == "SKU-POLO-NAVY"
        assert item.category == "Apparel"
        assert float(item.tax_rate) == 12.00
        assert len(item.variants) == 2
        assert len(item.barcodes) >= 2


@pytest.mark.asyncio
async def test_lookup_by_barcode_canonical_item():
    """Verify fast scanner resolution via canonical ItemBarcode registry."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code="SKU-SCAN-ITEM-01",
            item_name="Scanner Test Item",
            category="Accessories",
            tax_rate=18.00,
            mrp=999.00,
            selling_price=899.00,
            cost_price=450.00,
            variants_data=[
                {
                    "variant_sku": "SKU-SCAN-ITEM-01-V1",
                    "variant_name": "Scanner Test Item V1",
                    "barcode": "8909988776655",
                    "mrp": 999.00,
                    "selling_price": 899.00
                }
            ]
        )
        res = await UniversalItemMasterService.lookup_by_barcode(session, "8909988776655")
        assert res is not None
        assert res["item_code"] == "SKU-SCAN-ITEM-01"
        assert res["variant_sku"] == "SKU-SCAN-ITEM-01-V1"
        assert res["mrp"] == 999.00
        assert res["selling_price"] == 899.00
        assert res["tax_rate"] == 18.00


@pytest.mark.asyncio
async def test_item_tenant_isolation():
    """Verify item created in smriti001 does not leak into smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        await UniversalItemMasterService.create_item(
            session=s1,
            company_id="COMP-001",
            item_code="SKU-ISO-TEST-01",
            item_name="Isolated Item Tenant Master",
            category="Hardware"
        )
        i1 = await UniversalItemMasterService.get_item_by_code(s1, "SKU-ISO-TEST-01")
        assert i1 is not None

    async with session_002() as s2:
        i2 = await UniversalItemMasterService.get_item_by_code(s2, "SKU-ISO-TEST-01")
        assert i2 is None, "Expected item from smriti001 not to exist in smriti002!"
