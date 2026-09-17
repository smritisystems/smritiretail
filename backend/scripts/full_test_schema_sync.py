"""
Comprehensive schema sync: apply all missing columns from smriti001 -> smriti_test_phase2c
to eliminate test DB drift that causes test failures.

Run from: F:\SMRITRretailNX\backend
Command: python scripts/full_test_schema_sync.py
"""
import psycopg2

# Only the dbs that are reachable and need syncing
TARGET_DBS = ["smriti_test_phase2c", "smriti_test_empty"]

# Column additions (table, column, definition) — only columns that are
# MISSING in test DBs and needed for tests to run.
# Ordered so that nullable / defaulted columns come first (safe to add).
COLUMN_PATCHES = [
    # sales_invoices — needed by test_customer_identity_duplicate.py
    ("sales_invoices", "dispatch_from_location_id", "VARCHAR(50)"),
    ("sales_invoices", "dispatch_from_snapshot",    "JSONB"),
    # customers
    ("customers", "price_tier_id", "VARCHAR(50)"),
    ("customers", "pricing_basis", "VARCHAR(20) DEFAULT 'MRP'"),
    ("customers", "allow_promotions_on_rate", "BOOLEAN DEFAULT FALSE"),
    # customer_groups
    ("customer_groups", "pricing_basis", "VARCHAR(20) DEFAULT 'MRP'"),
    ("customer_groups", "allow_promotions_on_rate", "BOOLEAN DEFAULT FALSE"),
    # sales_invoice_items
    ("sales_invoice_items", "salesperson_id", "VARCHAR(50)"),
    ("sales_invoice_items", "salesperson_name", "VARCHAR(100)"),
    # items & barcodes
    ("items", "least_saleable_qty", "NUMERIC DEFAULT 1.0"),
    ("item_barcodes", "least_saleable_qty", "NUMERIC DEFAULT NULL"),
    # customer_price_tiers
    ("customer_price_tiers", "is_tax_inclusive", "BOOLEAN"),
    # cash_registers
    ("cash_registers", "warehouse_id", "VARCHAR(50)"),
    # document_series
    ("document_series", "terminal_id",              "VARCHAR(50)"),
    ("document_series", "is_common_across_terminals", "BOOLEAN DEFAULT TRUE"),
    ("document_series", "transaction_group",        "VARCHAR(50)"),
    ("document_series", "start_number",             "INTEGER DEFAULT 1"),
    ("document_series", "is_void_unified",          "BOOLEAN DEFAULT FALSE"),
    ("document_series", "number_format",            "VARCHAR(30) DEFAULT 'PREFIX_NUM_SUFFIX'"),
    # items (dimension columns)
    ("items", "color",       "VARCHAR(100)"),
    ("items", "department",  "VARCHAR(100)"),
    ("items", "size",        "VARCHAR(100)"),
    ("items", "style_code",  "VARCHAR(100)"),
    ("items", "vendor_code", "VARCHAR(100)"),
    # item_barcodes lifecycle columns
    ("item_barcodes", "status",            "VARCHAR(30) DEFAULT 'ACTIVE'"),
    ("item_barcodes", "barcode_normalized", "VARCHAR(100)"),
    ("item_barcodes", "barcode_purpose",   "VARCHAR(50) DEFAULT 'RETAIL_SALE'"),
    ("item_barcodes", "encoding_standard", "VARCHAR(20) DEFAULT 'EAN13'"),
    ("item_barcodes", "source",            "VARCHAR(50) DEFAULT 'MANUAL'"),
    ("item_barcodes", "source_reference",  "VARCHAR(100)"),
    ("item_barcodes", "assigned_at",       "TIMESTAMPTZ"),
    ("item_barcodes", "assigned_by",       "VARCHAR(50)"),
    ("item_barcodes", "retired_at",        "TIMESTAMPTZ"),
    ("item_barcodes", "retirement_reason", "TEXT"),
    # invoice_document_artifacts
    ("invoice_document_artifacts", "artifact_subtype", "VARCHAR(50)"),
    ("invoice_document_artifacts", "import_batch_id",  "VARCHAR(100)"),
    ("invoice_document_artifacts", "source_file",      "VARCHAR(255)"),
    ("invoice_document_artifacts", "source_type",      "VARCHAR(50)"),
    # tax_invoice_template_versions
    ("tax_invoice_template_versions", "version_num", "INTEGER DEFAULT 1"),
    # party_contacts
    ("party_contacts", "contact_category", "VARCHAR(50)"),
    # supplier_profiles
    ("supplier_profiles", "commercial_classification", "VARCHAR(50)"),
    ("supplier_profiles", "msme_category",             "VARCHAR(50)"),
    ("supplier_profiles", "tds_rate",                  "NUMERIC(5,2)"),
    ("supplier_profiles", "tds_section",               "VARCHAR(20)"),
    ("supplier_profiles", "verification_flags",        "JSONB"),
]


def col_exists(cur, table, col):
    cur.execute("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
    """, (table, col))
    return cur.fetchone() is not None


def table_exists(cur, table):
    cur.execute("""
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = %s
    """, (table,))
    return cur.fetchone() is not None


def sync_db(db_name):
    print(f"\n=== {db_name} ===")
    try:
        conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
        conn.autocommit = True
        cur = conn.cursor()
        added = 0
        for table, col, coldef in COLUMN_PATCHES:
            if not table_exists(cur, table):
                continue
            if not col_exists(cur, table, col):
                cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {coldef}")
                print(f"  ADDED {table}.{col} {coldef}")
                added += 1
        print(f"  Total added: {added} columns")
        cur.close()
        conn.close()
    except psycopg2.OperationalError as e:
        print(f"  SKIP: {e}")


for db in TARGET_DBS:
    sync_db(db)

print("\nDone.")
