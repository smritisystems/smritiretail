"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

probe_db_sync.py
=======================================
Development probe: inserts one product row and one sales_invoice row from
smriti001 into smritisys using the common column intersection, in order to
diagnose schema or constraint mismatches preventing cross-database sync.

Usage:
    python scripts/dev/probe_db_sync.py
"""

import psycopg2

CONN_SRC_DSN = "postgresql://postgres:postgres@localhost:5432/smriti001"
CONN_DST_DSN = "postgresql://postgres:postgres@localhost:5432/smritisys"


def _common_columns(cur_src, cur_dst, table: str) -> list:
    cur_src.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name=%s;",
        (table,),
    )
    src_cols = {r[0] for r in cur_src.fetchall()}
    cur_dst.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name=%s;",
        (table,),
    )
    dst_cols = {r[0] for r in cur_dst.fetchall()}
    return [c for c in src_cols if c in dst_cols]


def probe_table(cur_src, cur_dst, table: str, where: str = "", params=()) -> None:
    common = _common_columns(cur_src, cur_dst, table)
    col_str = ", ".join(common)
    placeholders = ", ".join(["%s"] * len(common))

    query = f"SELECT {col_str} FROM {table}"
    if where:
        query += f" WHERE {where}"
    query += " LIMIT 1;"
    cur_src.execute(query, params)
    row = cur_src.fetchone()
    if row is None:
        print(f"{table}: no source row found — skipping")
        return

    try:
        cur_dst.execute(
            f"INSERT INTO {table} ({col_str}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING;",
            row,
        )
        print(f"{table}: insert success")
    except Exception as err:
        print(f"{table}: insert error:", err)


def main() -> None:
    conn_src = psycopg2.connect(CONN_SRC_DSN)
    conn_dst = psycopg2.connect(CONN_DST_DSN)
    conn_dst.autocommit = True
    cur_src = conn_src.cursor()
    cur_dst = conn_dst.cursor()

    probe_table(cur_src, cur_dst, "products")
    probe_table(
        cur_src, cur_dst,
        "sales_invoices",
        where="id=%s",
        params=("inv-60a109a6ab4c",),
    )

    conn_src.close()
    conn_dst.close()


if __name__ == "__main__":
    main()
