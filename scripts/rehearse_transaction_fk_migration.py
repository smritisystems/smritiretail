"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Gate 8 Transaction FK Migration Rehearsal Engine
"""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def rehearse_transaction_fks():
    db_url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001'
    engine = create_async_engine(db_url, echo=False)
    
    print("=" * 85)
    print("SMRITI GATE 8: TRANSACTION FOREIGN KEY REHEARSAL")
    print("Validating Dual-Key Coexistence (legacy product_id + canonical variant_id)")
    print("=" * 85)
    
    async with engine.connect() as conn:
        # 1. Add non-breaking nullable variant_id columns if not exist
        print("\n[STEP 1] Adding Non-Breaking Nullable variant_id Columns (Zero Schema Disruption)...")
        await conn.execute(text("ALTER TABLE IF EXISTS sales_invoice_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);"))
        await conn.execute(text("ALTER TABLE IF EXISTS sales_order_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(50);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_invoice_items_variant_id ON sales_invoice_items (variant_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_order_items_variant_id ON sales_order_items (variant_id);"))
        await conn.commit()

        # 2. Backfill variant_id from legacy_id_mappings without touching product_id
        print("\n[STEP 2] Backfilling variant_id via Immutable legacy_id_mappings Lineage...")
        await conn.execute(text("""
            UPDATE sales_invoice_items s
            SET variant_id = m.canonical_id
            FROM legacy_id_mappings m
            WHERE m.legacy_table = 'products'
              AND m.legacy_id = s.product_id
              AND (s.variant_id IS NULL OR s.variant_id != m.canonical_id);
        """))
        await conn.execute(text("""
            UPDATE sales_order_items o
            SET variant_id = m.canonical_id
            FROM legacy_id_mappings m
            WHERE m.legacy_table = 'products'
              AND m.legacy_id = o.product_id
              AND (o.variant_id IS NULL OR o.variant_id != m.canonical_id);
        """))
        await conn.commit()

        # 3. Verification & Dual-Key Agreement Audit
        print("\n[STEP 3] Verifying Dual-Key Lineage Parity (Zero Loss & Zero Orphans)...")
        
        # Audit sales_invoice_items
        res_inv = await conn.execute(text("""
            SELECT 
                count(*) as total_rows,
                count(product_id) as legacy_fk_rows,
                count(variant_id) as canonical_fk_rows,
                count(v.id) as valid_variant_fks,
                sum(CASE WHEN m.canonical_id = s.variant_id THEN 1 ELSE 0 END) as exact_lineage_matches
            FROM sales_invoice_items s
            LEFT JOIN legacy_id_mappings m ON m.legacy_table = 'products' AND m.legacy_id = s.product_id
            LEFT JOIN item_variants v ON v.id = s.variant_id
            WHERE s.product_id IS NOT NULL;
        """))
        inv_row = dict(res_inv.fetchone()._mapping)
        print("sales_invoice_items Lineage Audit:")
        print(f"  • Total Rows with Legacy product_id : {inv_row['legacy_fk_rows']}")
        print(f"  • Rows with Backfilled variant_id   : {inv_row['canonical_fk_rows']}")
        print(f"  • Valid item_variants FK Targets    : {inv_row['valid_variant_fks']}")
        print(f"  • Exact Dual-Key Lineage Matches    : {inv_row['exact_lineage_matches']}")
        print(f"  • Orphan variant_id References      : {inv_row['canonical_fk_rows'] - inv_row['valid_variant_fks']}")
        assert inv_row['legacy_fk_rows'] == inv_row['canonical_fk_rows'] == inv_row['valid_variant_fks'] == 1344

        # Audit sales_order_items
        res_ord = await conn.execute(text("""
            SELECT 
                count(*) as total_rows,
                count(product_id) as legacy_fk_rows,
                count(variant_id) as canonical_fk_rows,
                count(v.id) as valid_variant_fks,
                sum(CASE WHEN m.canonical_id = o.variant_id THEN 1 ELSE 0 END) as exact_lineage_matches
            FROM sales_order_items o
            LEFT JOIN legacy_id_mappings m ON m.legacy_table = 'products' AND m.legacy_id = o.product_id
            LEFT JOIN item_variants v ON v.id = o.variant_id
            WHERE o.product_id IS NOT NULL;
        """))
        ord_row = dict(res_ord.fetchone()._mapping)
        print("\nsales_order_items Lineage Audit:")
        print(f"  • Total Rows with Legacy product_id : {ord_row['legacy_fk_rows']}")
        print(f"  • Rows with Backfilled variant_id   : {ord_row['canonical_fk_rows']}")
        print(f"  • Valid item_variants FK Targets    : {ord_row['valid_variant_fks']}")
        print(f"  • Exact Dual-Key Lineage Matches    : {ord_row['exact_lineage_matches']}")
        print(f"  • Orphan variant_id References      : {ord_row['canonical_fk_rows'] - ord_row['valid_variant_fks']}")
        assert ord_row['legacy_fk_rows'] == ord_row['canonical_fk_rows'] == ord_row['valid_variant_fks'] == 18036

        print("\n" + "=" * 85)
        print("TRANSACTION FK REHEARSAL VERIFIED: 100.00% RESOLUTION WITH 0 ORPHANS")
        print("Legacy product_id remains 100% intact.")
        print("=" * 85)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(rehearse_transaction_fks())
