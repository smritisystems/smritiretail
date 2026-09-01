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
Classification: Gate 11B Investigation Script (1 Unmapped Row & Schema Inspector)
"""

import asyncio
import os
import json
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

os.environ["JWT_SECRET_KEY"] = "smriti-test-secret-key-1234567890"


async def investigate_unmapped_row():
    db_url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001'
    engine = create_async_engine(db_url, echo=False)

    async with engine.connect() as conn:
        print("=" * 85)
        print("INVESTIGATING THE 1 UNMAPPED ROW IN sales_order_items...")
        print("=" * 85)

        res = await conn.execute(text("""
            SELECT *
            FROM sales_order_items
            WHERE variant_id IS NULL;
        """))
        rows = res.fetchall()
        for r in rows:
            print(dict(r._mapping))
            p_id = r._mapping.get("product_id")

            # Check if this product_id exists in legacy_id_mappings
            map_res = await conn.execute(
                text("SELECT * FROM legacy_id_mappings WHERE legacy_table = 'products' AND legacy_id = :pid"),
                {"pid": str(p_id)}
            )
            map_row = map_res.fetchone()
            if map_row:
                print("\nFound in legacy_id_mappings:")
                print(dict(map_row._mapping))
            else:
                print(f"\nProduct ID {p_id} NOT FOUND in legacy_id_mappings. Checking products table:")
                p_res = await conn.execute(
                    text("SELECT id, code, name, barcode FROM products WHERE id = :pid"),
                    {"pid": str(p_id)}
                )
                p_row = p_res.fetchone()
                if p_row:
                    print(dict(p_row._mapping))
                else:
                    print(f"  Product ID {p_id} does not exist in products table.")

        print("\n" + "=" * 85)
        print("INVESTIGATING sales_invoice_lines (3 rows):")
        print("=" * 85)
        res_sil = await conn.execute(text("SELECT * FROM sales_invoice_lines"))
        sil_rows = res_sil.fetchall()
        for r in sil_rows:
            print(dict(r._mapping))

        print("\n" + "=" * 85)
        print("INVESTIGATING product_batch_stocks (16 rows):")
        print("=" * 85)
        res_pbs = await conn.execute(text("SELECT * FROM product_batch_stocks LIMIT 5"))
        pbs_rows = res_pbs.fetchall()
        for r in pbs_rows:
            print(dict(r._mapping))

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(investigate_unmapped_row())
