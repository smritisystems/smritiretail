"""
SMRITI Item Master Database Audit Script
Phase 1 - Read Only Discovery
"""
import psycopg2
import json

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


def get_columns(cur, table_name):
    cur.execute("""
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position;
    """, (table_name,))
    return cur.fetchall()


def get_row_count(cur, table_name):
    try:
        cur.execute(f"SELECT count(*) FROM {table_name};")
        return cur.fetchone()[0]
    except Exception:
        return -1


def get_sample_rows(cur, table_name, limit=3):
    try:
        cur.execute(f"SELECT * FROM {table_name} LIMIT %s;", (limit,))
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        return cols, rows
    except Exception as e:
        return [], []


def audit_database(db_name, db_url):
    print(f"\n{'='*80}")
    print(f"DATABASE: {db_name}")
    print(f"{'='*80}")

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
    except Exception as e:
        print(f"  CONNECTION FAILED: {e}")
        return

    # List all tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    all_tables = [r[0] for r in cur.fetchall()]
    print(f"\nAll tables ({len(all_tables)}): {all_tables}")

    # For each item-related table, report schema
    for table in ITEM_RELATED_TABLES:
        if table not in all_tables:
            continue

        row_count = get_row_count(cur, table)
        cols = get_columns(cur, table)

        print(f"\n--- TABLE: {table} ({row_count} rows) ---")
        for col in cols:
            col_name, dtype, max_len, nullable, default = col
            type_str = f"{dtype}({max_len})" if max_len else dtype
            print(f"  {col_name:<40} {type_str:<30} nullable={nullable} default={default}")

        if row_count > 0:
            sample_cols, sample_rows = get_sample_rows(cur, table, 2)
            if sample_rows:
                print(f"  [Sample row keys: {sample_cols[:10]}]")
                for r in sample_rows[:1]:
                    vals = {sample_cols[i]: str(r[i])[:60] for i in range(min(10, len(sample_cols)))}
                    print(f"  [Sample: {vals}]")

    # Special: Sales Invoice Items columns
    if "sales_invoice_items" in all_tables:
        print(f"\n{'='*40}")
        print("SALES INVOICE ITEMS - Full Column Audit")
        cols = get_columns(cur, "sales_invoice_items")
        for col in cols:
            print(f"  {col[0]:<40} {col[1]}")

    # Special: products columns all
    if "products" in all_tables:
        print(f"\n{'='*40}")
        print("PRODUCTS TABLE - Full Column Audit")
        cols = get_columns(cur, "products")
        for col in cols:
            print(f"  {col[0]:<40} {col[1]}")

    conn.close()


def main():
    for db_name, db_url in DATABASES.items():
        audit_database(db_name, db_url)


if __name__ == "__main__":
    main()
