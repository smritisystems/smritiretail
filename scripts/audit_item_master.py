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

audit_item_master.py
======================================
Read-only discovery audit: inspects all item-master-related tables across
all registered SMRITI databases (smriti001, smriti002, smritisys), reporting
column definitions, row counts, and sample rows. Output is written to
scripts/item_master_db_audit.txt.

Usage:
    python scripts/audit_item_master.py
"""

import psycopg2
import sys

DATABASES = {
    "smriti001": "postgresql://postgres:postgres@localhost:5432/smriti001",
    "smriti002": "postgresql://postgres:postgres@localhost:5432/smriti002",
    "smritisys": "postgresql://postgres:postgres@localhost:5432/smritisys",
}

ITEM_RELATED_TABLES = [
    "products",
    "product_variants",
    "product_attributes",
    "product_categories",
    "product_brands",
    "product_barcodes",
    "item_master",
    "items",
    "inventory_items",
    "stock_items",
    "skus",
    "uoms",
    "units_of_measure",
    "hsn_codes",
    "tax_rates",
    "tax_categories",
    "price_lists",
    "price_list_items",
    "stock_movements",
    "stock_balances",
    "psv_stock_balances",
    "psv_stock_events",
    "warehouses",
    "bins",
    "racks",
    "batch_lots",
    "serial_numbers",
    "purchase_order_items",
    "purchase_receipt_items",
    "sales_invoice_items",
    "sales_return_items",
    "purchase_return_items",
]

OUTPUT_FILE = "scripts/item_master_db_audit.txt"


def get_columns(cur, table_name):
    cur.execute(
        """
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position;
        """,
        (table_name,),
    )
    return cur.fetchall()


def get_row_count(cur, table_name):
    try:
        cur.execute(f"SELECT count(*) FROM {table_name};")
        return cur.fetchone()[0]
    except Exception:
        return -1


def get_sample_rows(cur, table_name, limit=2):
    try:
        cur.execute(f"SELECT * FROM {table_name} LIMIT {limit};")
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        return cols, rows
    except Exception:
        return [], []


def audit_database(db_name, db_url, out):
    out.write(f"\n{'=' * 80}\n")
    out.write(f"DATABASE: {db_name}\n")
    out.write(f"{'=' * 80}\n")

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
    except Exception as err:
        out.write(f"  CONNECTION FAILED: {err}\n")
        return

    cur.execute(
        """
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
        """
    )
    all_tables = [r[0] for r in cur.fetchall()]
    out.write(f"\nAll tables ({len(all_tables)}): {all_tables}\n")

    found_tables = []
    for table in ITEM_RELATED_TABLES:
        if table not in all_tables:
            continue
        found_tables.append(table)

        row_count = get_row_count(cur, table)
        cols = get_columns(cur, table)

        out.write(f"\n--- TABLE: {table} ({row_count} rows) ---\n")
        for col in cols:
            col_name, dtype, max_len, nullable, default = col
            type_str = f"{dtype}({max_len})" if max_len else dtype
            out.write(f"  {col_name:<45} {type_str:<35} nullable={nullable}\n")

        if 0 < row_count <= 5000:
            sample_cols, sample_rows = get_sample_rows(cur, table, 2)
            if sample_rows:
                out.write(f"  SAMPLE COLS: {sample_cols}\n")
                for r in sample_rows[:1]:
                    vals = {
                        sample_cols[i]: str(r[i])[:80]
                        for i in range(min(15, len(sample_cols)))
                    }
                    out.write(f"  SAMPLE ROW: {vals}\n")

    out.write(f"\nItem-related tables found in {db_name}: {found_tables}\n")

    # Detailed audit: sales_invoice_items in smriti001
    if db_name == "smriti001" and "sales_invoice_items" in all_tables:
        out.write(f"\n{'=' * 40}\n")
        out.write("SALES INVOICE ITEMS - Sample Rows\n")
        sample_cols, sample_rows = get_sample_rows(cur, "sales_invoice_items", 5)
        if sample_cols:
            out.write(f"Columns: {sample_cols}\n")
        for r in sample_rows:
            vals = {sample_cols[i]: str(r[i])[:60] for i in range(len(sample_cols))}
            out.write(f"  Row: {vals}\n")

    if db_name == "smriti001" and "products" in all_tables:
        out.write(f"\n{'=' * 40}\n")
        out.write("PRODUCTS - Sample Rows (first 3)\n")
        sample_cols, sample_rows = get_sample_rows(cur, "products", 3)
        if sample_cols:
            out.write(f"Columns: {sample_cols}\n")
        for r in sample_rows:
            vals = {sample_cols[i]: str(r[i])[:60] for i in range(len(sample_cols))}
            out.write(f"  Row: {vals}\n")

    if db_name == "smriti001" and "stock_movements" in all_tables:
        out.write(f"\n{'=' * 40}\n")
        out.write("STOCK MOVEMENTS - Sample Rows\n")
        sample_cols, sample_rows = get_sample_rows(cur, "stock_movements", 3)
        if sample_cols:
            out.write(f"Columns: {sample_cols}\n")
        for r in sample_rows:
            vals = {sample_cols[i]: str(r[i])[:60] for i in range(len(sample_cols))}
            out.write(f"  Row: {vals}\n")

    conn.close()


def main() -> None:
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        for db_name, db_url in DATABASES.items():
            audit_database(db_name, db_url, out)
    print(f"Audit written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
