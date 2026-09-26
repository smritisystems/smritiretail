"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-02
Modified     : 2026-09-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 2A Row Mapping Audit Engine
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import json

async def audit_mappings():
    eng = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    async with eng.connect() as conn:
        print("=" * 110)
        print("PHASE 2A ROW-BY-ROW DETERMINISTIC MAPPING AUDIT")
        print("=" * 110)

        # 1. Inspect sales_order_items (1 row)
        print("\n--- 1. SALES_ORDER_ITEMS (1 Row) ---")
        so_res = await conn.execute(text("""
            SELECT soi.id, soi.order_id, soi.product_id, soi.code, soi.name, soi.quantity,
                   lim.canonical_table, lim.canonical_id, lim.disposition
            FROM sales_order_items soi
            LEFT JOIN legacy_id_mappings lim ON lim.legacy_id = soi.product_id AND lim.legacy_table = 'products'
            WHERE soi.variant_id IS NULL;
        """))
        for r in so_res.fetchall():
            print(f"Row ID: {r.id} | Order: {r.order_id} | Product: {r.product_id} | Code: {r.code} | Name: {r.name}")
            print(f"  -> Canonical Table: {r.canonical_table} | Canonical ID: {r.canonical_id} | Disposition: {r.disposition}")

        # 2. Inspect sales_invoice_lines (3 rows)
        print("\n--- 2. SALES_INVOICE_LINES (3 Rows) ---")
        sil_res = await conn.execute(text("""
            SELECT sil.id, sil.invoice_id, sil.product_id, sil.sku, sil.product_name, sil.quantity, sil.unit_price, sil.taxable_value,
                   lim.canonical_table, lim.canonical_id, lim.disposition
            FROM sales_invoice_lines sil
            LEFT JOIN legacy_id_mappings lim ON lim.legacy_id = sil.product_id AND lim.legacy_table = 'products';
        """))
        for r in sil_res.fetchall():
            print(f"Row ID: {r.id} | Invoice: {r.invoice_id} | Product: {r.product_id} | SKU: {r.sku} | Name: {r.product_name}")
            print(f"  -> Canonical Table: {r.canonical_table} | Canonical ID: {r.canonical_id} | Disposition: {r.disposition}")

        # 3. Inspect product_batch_stocks (16 rows)
        print("\n--- 3. PRODUCT_BATCH_STOCKS (16 Rows) ---")
        pbs_res = await conn.execute(text("""
            SELECT pbs.id, pbs.company_id, pbs.branch_id, pbs.product_id, pbs.batch_no, pbs.quantity, pbs.purchase_rate,
                   p.code as legacy_code, p.name as legacy_name,
                   lim.canonical_table, lim.canonical_id, lim.disposition,
                   v.variant_sku, i.item_code, i.item_name
            FROM product_batch_stocks pbs
            LEFT JOIN products p ON pbs.product_id = p.id
            LEFT JOIN legacy_id_mappings lim ON lim.legacy_id = pbs.product_id AND lim.legacy_table = 'products'
            LEFT JOIN item_variants v ON lim.canonical_id = v.id
            LEFT JOIN items i ON v.item_id = i.id;
        """))
        for r in pbs_res.fetchall():
            print(f"Row ID: {r.id} | Company: {r.company_id} | Branch: {r.branch_id} | Product: {r.product_id} | Batch: {r.batch_no} | Qty: {r.quantity}")
            print(f"  Legacy Product: {r.legacy_code} ({r.legacy_name})")
            print(f"  -> Canonical ID: {r.canonical_id} | Disposition: {r.disposition} | Variant SKU: {r.variant_sku} | Item: {r.item_code} ({r.item_name})")
            print("-" * 80)

    await eng.dispose()

if __name__ == "__main__":
    asyncio.run(audit_mappings())
