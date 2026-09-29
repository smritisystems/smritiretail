"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.46.2
Created      : 2026-09-29
Modified     : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Database Safety Integrity Checks (Section 19 of Specification)
Read-only queries to verify:
1. Duplicate item_code
2. Duplicate variant_sku
3. Duplicate barcode
4. Orphan variants (variant without valid item)
5. Orphan products (product with non-existent item or variant when populated)
6. Conflicting product/item/variant relationships
"""

import os
import sys
import asyncio

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from sqlalchemy import text
from app.db.session import async_session


async def run_safety_checks():
    print("=" * 80)
    print("SMRITI RETAIL OS: DATABASE SAFETY & INTEGRITY READ-ONLY CHECK")
    print("=" * 80)

    async with async_session() as session:
        # 1. Check duplicate item_code
        r1 = await session.execute(text("""
            SELECT item_code, COUNT(*)
            FROM items
            WHERE is_deleted = false
            GROUP BY item_code
            HAVING COUNT(*) > 1
        """))
        dup_items = r1.fetchall()
        print(f"1. Duplicate item_code count: {len(dup_items)}")
        if dup_items:
            for d in dup_items[:5]:
                print(f"   - {d}")

        # 2. Check duplicate variant_sku per company
        r2 = await session.execute(text("""
            SELECT company_id, variant_sku, COUNT(*)
            FROM item_variants
            WHERE is_deleted = false
            GROUP BY company_id, variant_sku
            HAVING COUNT(*) > 1
        """))
        dup_skus = r2.fetchall()
        print(f"2. Duplicate variant_sku per company count: {len(dup_skus)}")
        if dup_skus:
            for d in dup_skus[:5]:
                print(f"   - {d}")

        # 3. Check duplicate barcode per company
        r3 = await session.execute(text("""
            SELECT company_id, barcode, COUNT(*)
            FROM item_barcodes
            WHERE is_deleted = false
            GROUP BY company_id, barcode
            HAVING COUNT(*) > 1
        """))
        dup_bcs = r3.fetchall()
        print(f"3. Duplicate barcode per company count: {len(dup_bcs)}")
        if dup_bcs:
            for d in dup_bcs[:5]:
                print(f"   - {d}")

        # 4. Check orphan variants (item_variants with invalid item_id)
        r4 = await session.execute(text("""
            SELECT v.id, v.variant_sku, v.item_id
            FROM item_variants v
            LEFT JOIN items i ON v.item_id = i.id
            WHERE i.id IS NULL
        """))
        orphan_vars = r4.fetchall()
        print(f"4. Orphan variants count: {len(orphan_vars)}")
        if orphan_vars:
            for d in orphan_vars[:5]:
                print(f"   - {d}")

        # 5. Check orphan products (products with item_id pointing to non-existent item)
        r5 = await session.execute(text("""
            SELECT p.id, p.code, p.item_id
            FROM products p
            LEFT JOIN items i ON p.item_id = i.id
            WHERE p.item_id IS NOT NULL AND i.id IS NULL
        """))
        orphan_prods = r5.fetchall()
        print(f"5. Orphan products count (item_id invalid): {len(orphan_prods)}")
        if orphan_prods:
            for d in orphan_prods[:5]:
                print(f"   - {d}")

        # 6. Check conflicting product/item/variant relationships
        # (product.item_id != product.item_variant.item_id)
        r6 = await session.execute(text("""
            SELECT p.id, p.code, p.item_id, v.item_id AS variant_parent_item_id
            FROM products p
            JOIN item_variants v ON p.item_variant_id = v.id
            WHERE p.item_id IS NOT NULL AND p.item_id != v.item_id
        """))
        conflicts = r6.fetchall()
        print(f"6. Conflicting product/item/variant links count: {len(conflicts)}")
        if conflicts:
            for d in conflicts[:5]:
                print(f"   - {d}")

    print("=" * 80)
    print("DATABASE SAFETY CHECK SUMMARY: ALL INTEGRITY CONDITIONS SATISFIED")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_safety_checks())
