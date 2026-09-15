"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 2.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit & Integration Test Suite
"""

import pytest
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.api.deps import TenantContext
from app.schemas.inventory import ProductCreate
from app.services.inventory import InventoryService

@pytest.mark.asyncio
async def test_dual_write_canonical_sync_and_tenant_isolation():
    db_url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001'
    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    
    async with session_factory() as session:
        # 1. Multi-Tenant Isolation Enforcement Test (Blocker 5)
        invalid_tctx = TenantContext(company_id='', branch_id='MAIN')
        invalid_service = InventoryService(session, invalid_tctx)
        
        p_invalid = ProductCreate(
            code='TEST-FAIL-TENANT',
            name='Test Failure Without Tenant Context',
            price=Decimal('100.00'),
            mrp=Decimal('120.00'),
            barcode='8904559999999',
            gst_percentage=Decimal('18.00'),
            hsn_code='6404'
        )
        with pytest.raises(HTTPException) as exc_info:
            await invalid_service.create_product(p_invalid)
        assert exc_info.value.status_code == 400
        assert "Multi-tenant security violation" in exc_info.value.detail

        # 2. Valid Dual-Write & Authoritative PriceBook Synchronization Test
        tctx = TenantContext(company_id='COMP-001', branch_id='MAIN')
        service = InventoryService(session, tctx)
        
        test_code = 'TEST-SKU-99002'
        test_bc = '8904559900025'
        
        # Clean up prior test row if any
        await session.execute(text("DELETE FROM price_book_entries WHERE variant_id IN (SELECT id FROM item_variants WHERE variant_sku = :sku)"), {'sku': test_code})
        await session.execute(text("DELETE FROM legacy_id_mappings WHERE legacy_table = 'products' AND legacy_id LIKE 'PROD-TEST%'"))
        await session.execute(text("DELETE FROM item_barcodes WHERE barcode = :bc"), {'bc': test_bc})
        await session.execute(text("DELETE FROM item_variants WHERE variant_sku = :sku"), {'sku': test_code})
        await session.execute(text("DELETE FROM products WHERE code = :sku"), {'sku': test_code})
        await session.commit()
        
        p_in = ProductCreate(
            code=test_code,
            name='Test Dual Write Linen Shirt V2',
            price=Decimal('1299.00'),
            mrp=Decimal('1499.00'),
            category='Apparel',
            brand='Tattly Threads',
            style_code='STYLE-LINEN-02',
            barcode=test_bc,
            gst_percentage=Decimal('12.00'),
            hsn_code='6205',
            stock=100
        )
        
        created = await service.create_product(p_in)
        assert created.id is not None
        assert created.code == test_code
        
        # Verify Canonical Dual-Sync in item_variants, items, item_barcodes, legacy_id_mappings
        res_var = await session.execute(text("""
            SELECT v.variant_sku, i.item_code, b.barcode, b.barcode_type, m.legacy_id, pbe.selling_price, pbe.mrp
            FROM item_variants v
            JOIN items i ON v.item_id = i.id
            JOIN item_barcodes b ON b.variant_id = v.id
            JOIN legacy_id_mappings m ON m.canonical_id = v.id
            JOIN price_book_entries pbe ON pbe.variant_id = v.id
            WHERE v.variant_sku = :sku
        """), {'sku': test_code})
        
        row = res_var.fetchone()
        assert row is not None
        assert row[0] == test_code
        assert row[1] == 'STYLE-LINEN-02'
        assert row[2] == test_bc
        assert row[4] == created.id
        assert row[5] == Decimal('1299.00')
        assert row[6] == Decimal('1499.00')
        
        # Cleanup test row
        await session.execute(text("DELETE FROM price_book_entries WHERE variant_id IN (SELECT id FROM item_variants WHERE variant_sku = :sku)"), {'sku': test_code})
        await session.execute(text("DELETE FROM legacy_id_mappings WHERE legacy_table = 'products' AND legacy_id = :pid"), {'pid': created.id})
        await session.execute(text("DELETE FROM item_barcodes WHERE barcode = :bc"), {'bc': test_bc})
        await session.execute(text("DELETE FROM item_variants WHERE variant_sku = :sku"), {'sku': test_code})
        await session.execute(text("DELETE FROM products WHERE id = :pid"), {'pid': created.id})
        await session.commit()

    await engine.dispose()
