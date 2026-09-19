"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Safe Architecture Rollback Runner
"""

import os
import sys
import json
import psycopg2
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.join(REPO_ROOT, "backend", "app", "db", "backups")
DB_CONN = "postgresql://postgres:postgres@localhost:5432/smritisys"

GOVERNANCE_TABLES = [
    "architecture_certificates",
    "architecture_decisions",
    "architecture_apis",
    "architecture_files",
    "architecture_capabilities",
    "architecture_entities",
    "architecture_domains",
]


def inspect_foreign_key_dependencies(cur) -> list:
    """
    Checks if any external non-governance business tables reference governance tables.
    """
    query = """
        SELECT
            tc.table_name AS dependent_table,
            kcu.column_name AS dependent_column,
            ccu.table_name AS referenced_table
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name LIKE 'architecture_%'
          AND tc.table_name NOT LIKE 'architecture_%';
    """
    cur.execute(query)
    return cur.fetchall()


def export_governance_snapshot(cur) -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    snapshot = {}
    for tbl in GOVERNANCE_TABLES:
        try:
            cur.execute(f"SELECT * FROM {tbl};")
            cols = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            snapshot[tbl] = [dict(zip(cols, [str(v) if isinstance(v, (datetime,)) else v for v in row])) for row in rows]
        except Exception:
            snapshot[tbl] = []

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_DIR, f"governance_snapshot_{timestamp}.json")
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)
    return backup_file


def execute_safe_rollback(dry_run: bool = True):
    print("================================================================================")
    print(" SMRITI ARCHITECTURE GOVERNANCE — SAFE DEPENDENCY-AWARE ROLLBACK RUNNER")
    print("================================================================================")
    print(f" Mode: {'DRY RUN (Verification only)' if dry_run else 'EXECUTE (Irreversible)'}")

    conn = psycopg2.connect(DB_CONN)
    conn.autocommit = False
    cur = conn.cursor()

    # 1. Dependency Graph Audit
    print("\n[STEP 1] Auditing external foreign key dependencies...")
    unexpected_deps = inspect_foreign_key_dependencies(cur)
    if unexpected_deps:
        print("  ❌ FATAL ERROR: External business tables reference architecture governance tables!")
        for dep in unexpected_deps:
            print(f"     -> Table '{dep[0]}' (col: '{dep[1]}') references '{dep[2]}'")
        print("  Rollback aborted. No CASCADE drops permitted.")
        conn.rollback()
        conn.close()
        sys.exit(1)
    print("  [OK] Zero external business foreign keys depend on architecture tables.")

    # 2. Export Snapshot
    print("\n[STEP 2] Creating pre-rollback snapshot...")
    backup_path = export_governance_snapshot(cur)
    print(f"  [OK] Snapshot safely archived at: {backup_path}")

    # 3. Clean Drop (Strictly without CASCADE)
    if not dry_run:
        print("\n[STEP 3] Dropping governance tables in topological order (NO CASCADE)...")
        for tbl in GOVERNANCE_TABLES:
            cur.execute(f"DROP TABLE IF EXISTS {tbl};")
            print(f"  [OK] Dropped table '{tbl}'.")

        print("\n[STEP 4] Reverting additive extension columns...")
        cur.execute("""
            ALTER TABLE screen_definitions
                DROP COLUMN IF EXISTS screen_key,
                DROP COLUMN IF EXISTS entity_key,
                DROP COLUMN IF EXISTS canonical_route,
                DROP COLUMN IF EXISTS canonical_component;
        """)
        cur.execute("""
            ALTER TABLE field_definitions
                DROP COLUMN IF EXISTS entity_key,
                DROP COLUMN IF EXISTS canonical_table,
                DROP COLUMN IF EXISTS canonical_column,
                DROP COLUMN IF EXISTS api_alias,
                DROP COLUMN IF EXISTS ui_aliases,
                DROP COLUMN IF EXISTS semantic_definition;
        """)
        cur.execute("UPDATE alembic_version SET version_num = 'v1393_canonical_item_master_migration';")
        conn.commit()
        print("  [OK] Rollback executed successfully. Database returned to v1393.")
    else:
        print("\n[STEP 3 & 4] Dry-run complete. All dependency and safety gates passed.")
        conn.rollback()

    conn.close()
    print("================================================================================")


if __name__ == "__main__":
    is_live = "--execute" in sys.argv
    execute_safe_rollback(dry_run=not is_live)
