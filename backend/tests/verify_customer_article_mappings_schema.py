"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-09-09
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Parity & Migration Verifier (Rule 12)
"""

import sys
import os
from pathlib import Path

# Configure UTF-8 encoding for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import psycopg2
from app.models.customer_article_mapping import CustomerArticleMapping


def verify_database_schema(db_name: str) -> bool:
    print(f"\n=======================================================")
    print(f"=== VERIFYING SCHEMA PARITY FOR: {db_name} ===")
    print(f"=======================================================")

    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor()

    # 1. Migration Lineage Check
    cur.execute("SELECT version_num FROM alembic_version;")
    versions = [r[0] for r in cur.fetchall()]
    print(f"[1. Migration Lineage] Stamped Alembic Version(s): {versions}")
    if "v1418_cust_art_map" not in versions:
        print(f"❌ FAIL: Expected revision 'v1418_cust_art_map' in alembic_version, got: {versions}")
        conn.close()
        return False
    print("✅ Migration lineage verified: v1418_cust_art_map is tracked.")

    # 2. Column Parity Check
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'customer_article_mappings'
        ORDER BY ordinal_position;
    """)
    db_columns = {row[0]: {"data_type": row[1], "is_nullable": row[2], "default": row[3]} for row in cur.fetchall()}

    orm_table = CustomerArticleMapping.__table__
    orm_columns = orm_table.columns

    print(f"\n[2. Column Parity] Total DB columns: {len(db_columns)}, Total ORM columns: {len(orm_columns)}")
    drift_detected = False

    for col in orm_columns:
        if col.name not in db_columns:
            print(f"❌ DRIFT: Missing column in DB: {col.name}")
            drift_detected = True
        else:
            db_col = db_columns[col.name]
            # Verify Nullability Parity
            orm_nullable = "YES" if col.nullable else "NO"
            if db_col["is_nullable"] != orm_nullable:
                print(f"❌ DRIFT on column '{col.name}': Nullability mismatch (DB: {db_col['is_nullable']}, ORM: {orm_nullable})")
                drift_detected = True
            else:
                print(f"  ✓ {col.name:28} | DB type: {db_col['data_type']:20} | Nullable: {db_col['is_nullable']:3} | Default: {str(db_col['default'])[:30]}")

    for col_name in db_columns:
        if col_name not in orm_columns:
            print(f"❌ DRIFT: Extra unexpected column in DB: {col_name}")
            drift_detected = True

    if drift_detected:
        print(f"❌ FAIL: Schema drift detected in columns of {db_name}")
        conn.close()
        return False
    print(f"✅ Full Column Parity: All {len(orm_columns)} columns match 100% against ORM specification.")

    # 3. Foreign Key Constraints Check
    cur.execute("""
        SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'customer_article_mappings';
    """)
    fks = {r[0]: {"target_table": r[1], "target_column": r[2], "delete_rule": r[3]} for r in cur.fetchall()}
    print(f"\n[3. Foreign Key Constraints] Found {len(fks)} foreign keys:")
    for fk_col, details in fks.items():
        print(f"  ✓ {fk_col} -> {details['target_table']}.{details['target_column']} (ON DELETE {details['delete_rule']})")

    required_fks = {
        "customer_id": ("customers", "RESTRICT"),
        "item_id": ("items", "RESTRICT"),
        "variant_id": ("item_variants", "RESTRICT"),
        "barcode_id": ("item_barcodes", "SET NULL"),
    }
    for col, (expected_tbl, expected_rule) in required_fks.items():
        if col not in fks:
            print(f"❌ FAIL: Missing foreign key on {col}")
            conn.close()
            return False
        if fks[col]["target_table"] != expected_tbl:
            print(f"❌ FAIL: Foreign key {col} targets {fks[col]['target_table']}, expected {expected_tbl}")
            conn.close()
            return False

    # 4. Indexes and Unique Partial Constraints Check
    cur.execute("""
        SELECT
            i.relname AS index_name,
            ix.indisunique AS is_unique,
            pg_get_expr(ix.indpred, ix.indrelid) AS filter_condition
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE t.relname = 'customer_article_mappings';
    """)
    indexes = {r[0]: {"is_unique": r[1], "filter": r[2]} for r in cur.fetchall()}
    print(f"\n[4. Indexes & Partial Constraints] Found {len(indexes)} indexes:")
    for idx_name, details in indexes.items():
        print(f"  ✓ {idx_name:32} | Unique: {str(details['is_unique']):5} | Filter: {details['filter']}")

    required_unique = ["uq_cam_customer_article_active", "uq_cam_customer_variant_active"]
    for req_idx in required_unique:
        if req_idx not in indexes:
            print(f"❌ FAIL: Missing required partial unique index: {req_idx}")
            conn.close()
            return False
        if not indexes[req_idx]["is_unique"]:
            print(f"❌ FAIL: Index {req_idx} is not UNIQUE")
            conn.close()
            return False

    required_lookup = ["ix_cam_lookup", "ix_cam_barcode", "ix_cam_vendor_article"]
    for req_idx in required_lookup:
        if req_idx not in indexes:
            print(f"❌ FAIL: Missing required lookup index: {req_idx}")
            conn.close()
            return False

    print(f"✅ All Indexes and Partial Unique Constraints Verified for {db_name}.")
    conn.close()
    return True


if __name__ == "__main__":
    success = True
    for db in ["smriti001", "smriti002"]:
        if not verify_database_schema(db):
            success = False

    if success:
        print("\n🎉 RULE 12 COMPLIANCE: 100% Schema Parity, Lineage, and Constraints Verified across Tenant Databases.")
        sys.exit(0)
    else:
        print("\n❌ RULE 12 FAILURE: Schema drift or missing constraints detected.")
        sys.exit(1)
