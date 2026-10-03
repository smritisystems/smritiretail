"""
Script to apply v1455 + v1456 schema migrations to all test databases
that are missing the is_tax_inclusive columns.

Run from: F:\SMRITRretailNX\backend
Command:  python scripts/apply_test_db_schema_sync.py
"""
import psycopg2

TEST_DATABASES = [
    "smriti_test_phase2c",
    "smriti_test_empty",
    "smriti002",
    "Smritibus_A",
    "Smritibus_B",
    "Smritibus_C",
    "Smritibus_COMPA",
    "Smritibus_COMPB",
    "Smritibus_COMPC",
    "Smritibus_TATTLY",
]

# Columns to add per table — mirrors v1456 migration
SCHEMA_PATCHES = {
    "customer_groups": [
        ("is_tax_inclusive", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ],
    "customers": [
        ("is_tax_inclusive", "BOOLEAN"),
    ],
    "item_barcodes": [
        ("is_tax_inclusive", "BOOLEAN"),
    ],
    "sales_invoice_items": [
        ("is_tax_inclusive", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ],
}

# v1455 patches: is_tax_inclusive was ADDED then removed from products/items/item_variants
# v1456 removed them from catalog and moved to barcodes/customer_groups/customers/sii
# So for test DBs, we just need to make sure the final state matches v1456 HEAD:
# - products, items, item_variants: NO is_tax_inclusive (dropped by v1456)
# - item_barcodes: has is_tax_inclusive
# - customer_groups: has is_tax_inclusive
# - customers: has is_tax_inclusive
# - sales_invoice_items: has is_tax_inclusive

CATALOG_COLUMNS_TO_DROP = {
    "products": "is_tax_inclusive",
    "items": "is_tax_inclusive", 
    "item_variants": "is_tax_inclusive",
}


def col_exists(cur, table, col):
    cur.execute("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = %s 
          AND column_name = %s
    """, (table, col))
    return cur.fetchone() is not None


def table_exists(cur, table):
    cur.execute("""
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = %s
    """, (table,))
    return cur.fetchone() is not None


def apply_to_db(db_name):
    print(f"\n--- {db_name} ---")
    try:
        conn = psycopg2.connect(
            f"postgresql://postgres:postgres@localhost:5432/{db_name}"
        )
        conn.autocommit = True
        cur = conn.cursor()

        # 1. Drop is_tax_inclusive from catalog masters if present (v1456 removed these)
        for table, col in CATALOG_COLUMNS_TO_DROP.items():
            if table_exists(cur, table) and col_exists(cur, table, col):
                cur.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {col}")
                print(f"  DROPPED  {table}.{col}")
            else:
                print(f"  OK (already absent)  {table}.{col}")

        # 2. Add missing columns per SCHEMA_PATCHES
        for table, columns in SCHEMA_PATCHES.items():
            if not table_exists(cur, table):
                print(f"  SKIP (table does not exist): {table}")
                continue
            for col, coldef in columns:
                if not col_exists(cur, table, col):
                    cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {coldef}")
                    # Sync customer_groups.is_tax_inclusive from tax_inclusive if present
                    if table == "customer_groups" and col == "is_tax_inclusive":
                        if col_exists(cur, "customer_groups", "tax_inclusive"):
                            cur.execute("""
                                UPDATE customer_groups 
                                SET is_tax_inclusive = COALESCE(tax_inclusive, true)
                                WHERE is_tax_inclusive IS NULL OR is_tax_inclusive != COALESCE(tax_inclusive, true)
                            """)
                    print(f"  ADDED    {table}.{col} {coldef}")
                else:
                    print(f"  OK (exists) {table}.{col}")

        cur.close()
        conn.close()
        print(f"  DONE: {db_name}")
        return True
    except psycopg2.OperationalError as e:
        if "does not exist" in str(e) or "Connection refused" in str(e):
            print(f"  SKIP (DB does not exist or not reachable): {e}")
            return False
        raise


results = {}
for db in TEST_DATABASES:
    results[db] = apply_to_db(db)

print("\n\n=== SUMMARY ===")
for db, ok in results.items():
    status = "PATCHED" if ok else "SKIPPED (DB not available)"
    print(f"  {db}: {status}")
