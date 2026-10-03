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
Classification: Gate 11A Transaction Schema Audit Engine
"""

import asyncio
import os
import json
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

os.environ["JWT_SECRET_KEY"] = "smriti-test-secret-key-1234567890"


async def audit_transaction_schema():
    db_url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001'
    engine = create_async_engine(db_url, echo=False)

    print("=" * 85)
    print("SMRITI GATE 11A: TRANSACTION SCHEMA & IDENTITY INVENTORY AUDIT")
    print("=" * 85)

    async with engine.connect() as conn:
        # Find all tables with product_id, variant_id, or item_id columns
        res = await conn.execute(text("""
            SELECT 
                c.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default
            FROM information_schema.columns c
            JOIN information_schema.tables t ON c.table_name = t.table_name
            WHERE t.table_schema = 'public'
              AND c.column_name IN ('product_id', 'variant_id', 'item_id')
            ORDER BY c.table_name, c.column_name;
        """))
        rows = res.fetchall()

        table_cols = {}
        for r in rows:
            tname, cname, dtype, is_null, cdef = r
            if tname not in table_cols:
                table_cols[tname] = {}
            table_cols[tname][cname] = {
                "dtype": dtype,
                "is_nullable": is_null,
                "default": cdef
            }

        # Query row counts and population stats for each identified table
        table_stats = []
        for tname, cols in sorted(table_cols.items()):
            try:
                cnt_res = await conn.execute(text(f"SELECT COUNT(*) FROM {tname}"))
                total_rows = cnt_res.scalar()

                has_pid = 'product_id' in cols
                has_vid = 'variant_id' in cols
                has_iid = 'item_id' in cols

                pid_pop = 0
                vid_pop = 0
                iid_pop = 0

                if has_pid:
                    pid_res = await conn.execute(text(f"SELECT COUNT(*) FROM {tname} WHERE product_id IS NOT NULL"))
                    pid_pop = pid_res.scalar()

                if has_vid:
                    vid_res = await conn.execute(text(f"SELECT COUNT(*) FROM {tname} WHERE variant_id IS NOT NULL"))
                    vid_pop = vid_res.scalar()

                if has_iid:
                    iid_res = await conn.execute(text(f"SELECT COUNT(*) FROM {tname} WHERE item_id IS NOT NULL"))
                    iid_pop = iid_res.scalar()

                table_stats.append({
                    "table_name": tname,
                    "total_rows": total_rows,
                    "cols": cols,
                    "product_id_pop": pid_pop,
                    "variant_id_pop": vid_pop,
                    "item_id_pop": iid_pop
                })
            except Exception as e:
                table_stats.append({
                    "table_name": tname,
                    "error": str(e)
                })

        print(f"Total Identified Tables with Product/Variant/Item Reference: {len(table_stats)}")
        print("-" * 85)
        print(f"{'Table Name':<30} | {'Total Rows':<10} | {'product_id':<12} | {'variant_id':<12} | {'item_id':<12}")
        print("-" * 85)
        for ts in table_stats:
            if "error" in ts:
                print(f"{ts['table_name']:<30} | ERROR: {ts['error']}")
            else:
                p_str = f"{ts['product_id_pop']}/{ts['total_rows']}" if 'product_id' in ts['cols'] else "N/A"
                v_str = f"{ts['variant_id_pop']}/{ts['total_rows']}" if 'variant_id' in ts['cols'] else "N/A"
                i_str = f"{ts['item_id_pop']}/{ts['total_rows']}" if 'item_id' in ts['cols'] else "N/A"
                print(f"{ts['table_name']:<30} | {ts['total_rows']:<10} | {p_str:<12} | {v_str:<12} | {i_str:<12}")

        print("=" * 85)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(audit_transaction_schema())
