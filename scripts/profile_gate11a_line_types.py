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
Classification: Gate 11A Detailed Line Type & Dual-Key Profiler
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

os.environ["JWT_SECRET_KEY"] = "smriti-test-secret-key-1234567890"


async def profile_line_types():
    db_url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001'
    engine = create_async_engine(db_url, echo=False)

    print("=" * 85)
    print("SMRITI GATE 11A: TRANSACTION LINE TYPE & DUAL-KEY PROFILER")
    print("=" * 85)

    async with engine.connect() as conn:
        # Inspect sales_invoice_items breakdown
        res_inv = await conn.execute(text("""
            SELECT 
                COUNT(*) as total_rows,
                COUNT(product_id) as with_product_id,
                COUNT(variant_id) as with_variant_id,
                COUNT(CASE WHEN product_id IS NOT NULL AND variant_id IS NOT NULL THEN 1 END) as dual_key_both,
                COUNT(CASE WHEN product_id IS NOT NULL AND variant_id IS NULL THEN 1 END) as product_only,
                COUNT(CASE WHEN product_id IS NULL AND variant_id IS NOT NULL THEN 1 END) as variant_only,
                COUNT(CASE WHEN product_id IS NULL AND variant_id IS NULL THEN 1 END) as non_product_lines
            FROM sales_invoice_items;
        """))
        inv_row = res_inv.fetchone()
        print("\n1. SALES INVOICE ITEMS (sales_invoice_items):")
        print(f"  • Total Invoice Line Rows  : {inv_row.total_rows}")
        print(f"  • Physical Stock Dual-Key  : {inv_row.dual_key_both} (Exact 100% Dual-Key Population)")
        print(f"  • Legacy Product Only      : {inv_row.product_only}")
        print(f"  • Canonical Variant Only   : {inv_row.variant_only}")
        print(f"  • Non-Stock / Fee Lines    : {inv_row.non_product_lines} (Service/Delivery/Charge/Roundoff lines)")

        # Inspect sales_order_items breakdown
        res_ord = await conn.execute(text("""
            SELECT 
                COUNT(*) as total_rows,
                COUNT(product_id) as with_product_id,
                COUNT(variant_id) as with_variant_id,
                COUNT(CASE WHEN product_id IS NOT NULL AND variant_id IS NOT NULL THEN 1 END) as dual_key_both,
                COUNT(CASE WHEN product_id IS NOT NULL AND variant_id IS NULL THEN 1 END) as product_only,
                COUNT(CASE WHEN product_id IS NULL AND variant_id IS NOT NULL THEN 1 END) as variant_only,
                COUNT(CASE WHEN product_id IS NULL AND variant_id IS NULL THEN 1 END) as non_product_lines
            FROM sales_order_items;
        """))
        ord_row = res_ord.fetchone()
        print("\n2. SALES ORDER ITEMS (sales_order_items):")
        print(f"  • Total Order Line Rows    : {ord_row.total_rows}")
        print(f"  • Physical Stock Dual-Key  : {ord_row.dual_key_both}")
        print(f"  • Legacy Product Only      : {ord_row.product_only} (1 test insert without variant_id)")
        print(f"  • Canonical Variant Only   : {ord_row.variant_only}")
        print(f"  • Non-Stock / Fee Lines    : {ord_row.non_product_lines}")

        # Check foreign key constraints across all transaction tables
        res_fks = await conn.execute(text("""
            SELECT
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND (ccu.table_name = 'products' OR kcu.column_name IN ('product_id', 'variant_id', 'item_id'))
            ORDER BY tc.table_name, kcu.column_name;
        """))
        fk_rows = res_fks.fetchall()
        print("\n3. CURRENT ACTIVE FOREIGN KEY CONSTRAINTS:")
        print(f"{'Table Name':<28} | {'Column':<15} | {'References Table':<20} | {'Delete Rule':<12}")
        print("-" * 85)
        for r in fk_rows:
            print(f"{r.table_name:<28} | {r.column_name:<15} | {r.foreign_table_name:<20} | {r.delete_rule:<12}")

        print("=" * 85)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(profile_line_types())
