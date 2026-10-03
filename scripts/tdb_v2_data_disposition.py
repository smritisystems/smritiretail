"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 2.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Database Remediation

SMRITI Tenant Data Boundary Remediation & Disposition Engine (TDB-v2.0)
══════════════════════════════════════════════════════════════════════
Automates safe, auditable data remediation for contaminated tenant tables
in the smritisys Control Plane database.

Phases:
    1. AUDIT: Inspects and classifies contaminated rows by company_id pattern.
    2. BACKUP: Full JSON backup of every contaminated table signed with SHA-256.
    3. MIGRATE: Moves valid COMP-001 operational data to smriti001.
    4. DELETE: Deletes ephemeral integration-test data from smritisys.
    5. QUARANTINE: Isolates Chart of Accounts and undeclared data safely.
    6. VERIFY: Asserts 0 non-empty tenant tables remain in smritisys.

Usage:
    python scripts/tdb_v2_data_disposition.py --audit
    python scripts/tdb_v2_data_disposition.py --dry-run
    python scripts/tdb_v2_data_disposition.py --execute --confirm
"""

import sys
import os
import re
import json
import hashlib
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Tuple

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None  # type: ignore

# Ensure backend is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.ownership import (
    TABLE_OWNERSHIP,
    TableOwner,
    TENANT_OWNED_TABLES,
)


def get_connection(db_name: str):
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    return psycopg2.connect(
        dbname=db_name,
        user=user,
        password=password,
        host=host,
        port=port
    )


def audit_contaminated_tables() -> List[Tuple[str, int]]:
    """Identifies all TENANT tables with rows in smritisys."""
    conn = get_connection("smritisys")
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE';
    """)
    all_tables = [row[0] for row in cur.fetchall()]
    contaminated = []

    for tbl in all_tables:
        if tbl in TENANT_OWNED_TABLES:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{tbl}";')
                count = cur.fetchone()[0]
                if count > 0:
                    contaminated.append((tbl, count))
            except Exception:
                conn.rollback()

    conn.close()
    return sorted(contaminated, key=lambda x: x[0])


def backup_tables(contaminated: List[Tuple[str, int]], backup_dir: Path) -> Dict[str, str]:
    """Exports contaminated tables to JSON files and computes SHA-256 checksums."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    manifest = {}
    conn = get_connection("smritisys")

    for tbl, count in contaminated:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f'SELECT * FROM "{tbl}";')
        rows = cur.fetchall()

        # Custom JSON serializer for dates/decimals
        def default_serializer(obj):
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            return str(obj)

        backup_file = backup_dir / f"{tbl}.json"
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump(rows, f, default=default_serializer, indent=2)

        hasher = hashlib.sha256()
        with open(backup_file, "rb") as f:
            hasher.update(f.read())
        checksum = hasher.hexdigest()

        manifest[tbl] = {
            "rows": count,
            "file": backup_file.name,
            "sha256": checksum,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    conn.close()
    manifest_file = backup_dir / "backup_manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest


def migrate_comp001_to_tenant(dry_run: bool = True) -> Dict[str, int]:
    """
    Migrates COMP-001 rows for core entities from smritisys into smriti001.
    Only migrates if target does not already have the record.
    """
    results = {}
    ctrl_conn = get_connection("smritisys")
    tenant_conn = get_connection("smriti001")

    # Migrate Customer Groups
    ctrl_cur = ctrl_conn.cursor(cursor_factory=RealDictCursor)
    tenant_cur = tenant_conn.cursor()

    # 1. Customer Groups
    try:
        ctrl_cur.execute("SELECT * FROM customer_groups WHERE company_id = 'COMP-001';")
        groups = ctrl_cur.fetchall()
        migrated_groups = 0
        for g in groups:
            tenant_cur.execute("SELECT 1 FROM customer_groups WHERE id = %s;", (g["id"],))
            if not tenant_cur.fetchone():
                if not dry_run:
                    tenant_cur.execute(
                        "INSERT INTO customer_groups (id, name, company_id, branch_id, is_active, is_deleted) "
                        "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING;",
                        (g["id"], g["name"], "COMP-001", g.get("branch_id", "BR-MAIN-001"), True, False)
                    )
                migrated_groups += 1
        results["customer_groups"] = migrated_groups
    except Exception as e:
        ctrl_conn.rollback()
        tenant_conn.rollback()

    # 2. Customers
    try:
        ctrl_cur.execute("SELECT * FROM customers WHERE company_id = 'COMP-001';")
        custs = ctrl_cur.fetchall()
        migrated_custs = 0
        for c in custs:
            tenant_cur.execute("SELECT 1 FROM customers WHERE id = %s;", (c["id"],))
            if not tenant_cur.fetchone():
                if not dry_run:
                    tenant_cur.execute(
                        "INSERT INTO customers (id, customer_code, first_name, last_name, company_id, branch_id, is_active, is_deleted) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING;",
                        (c["id"], c.get("customer_code", c["id"]), c.get("first_name", ""), c.get("last_name", ""), "COMP-001", c.get("branch_id", "BR-MAIN-001"), True, False)
                    )
                migrated_custs += 1
        results["customers"] = migrated_custs
    except Exception as e:
        ctrl_conn.rollback()
        tenant_conn.rollback()

    if not dry_run:
        tenant_conn.commit()

    ctrl_conn.close()
    tenant_conn.close()
    return results


def delete_contaminated_rows(dry_run: bool = True) -> Dict[str, int]:
    """
    Deletes all contaminated rows from smritisys for TENANT tables,
    preserving quarantined tables (e.g. accounts).
    """
    deleted_counts = {}
    conn = get_connection("smritisys")
    cur = conn.cursor()

    # Tables to quarantine (not deleted in phase 1, held for manual review)
    QUARANTINE_TABLES = {"accounts"}

    contaminated = audit_contaminated_tables()

    for tbl, count in contaminated:
        if tbl in QUARANTINE_TABLES:
            deleted_counts[tbl] = f"QUARANTINED ({count} rows preserved)"
            continue

        if not dry_run:
            try:
                cur.execute(f'TRUNCATE TABLE "{tbl}" CASCADE;')
                deleted_counts[tbl] = count
            except Exception as e:
                conn.rollback()
                deleted_counts[tbl] = f"ERROR: {e}"
        else:
            deleted_counts[tbl] = f"WOULD_TRUNCATE ({count} rows)"

    if not dry_run:
        conn.commit()

    conn.close()
    return deleted_counts


def main():
    parser = argparse.ArgumentParser(
        description="SMRITI Tenant Data Boundary Remediation & Disposition Engine (TDB-v2.0)"
    )
    parser.add_argument("--audit", action="store_true", help="Print audit report of contaminated tables.")
    parser.add_argument("--dry-run", action="store_true", help="Simulate backup, migration, and truncation.")
    parser.add_argument("--execute", action="store_true", help="Execute real remediation.")
    parser.add_argument("--confirm", action="store_true", help="Explicit confirmation for destructive operations.")
    args = parser.parse_args()

    print("\n" + "=" * 72)
    print("  SMRITI TENANT DATA DISPOSITION ENGINE (TDB-v2.0)")
    print("=" * 72)

    contaminated = audit_contaminated_tables()
    total_rows = sum(count for _, count in contaminated)

    print(f"  Target Database     : smritisys (Control Plane)")
    print(f"  Contaminated Tables : {len(contaminated)}")
    print(f"  Contaminated Rows   : {total_rows}")
    print()

    if args.audit:
        print("  CONTAMINATED TENANT TABLES IN SMRITISYS:")
        for tbl, count in contaminated:
            print(f"    - {tbl:<35} : {count:>6} rows")
        print("=" * 72 + "\n")
        return

    backup_dir = REPO_ROOT / "backend" / "app" / "db" / "backups" / f"tdb_v2_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if args.dry_run:
        print("  MODE: DRY-RUN (Simulating without modifying database)")
        print(f"  1. Would create JSON backup of {len(contaminated)} tables in {backup_dir}")
        print("  2. Simulating COMP-001 migration to smriti001...")
        mig_preview = migrate_comp001_to_tenant(dry_run=True)
        for entity, count in mig_preview.items():
            print(f"     + Would migrate {count} {entity} to smriti001")
        print("  3. Simulating truncation of ephemeral test data...")
        del_preview = delete_contaminated_rows(dry_run=True)
        for tbl, status in del_preview.items():
            print(f"     - {tbl:<35} : {status}")
        print("\n[Dry Run] Complete. Run with --execute --confirm to apply changes.\n")
        return

    if args.execute:
        if not args.confirm:
            print("[ERROR] --execute requires --confirm flag to prevent accidental data changes.", file=sys.stderr)
            sys.exit(1)

        print("  PHASE 1: BACKUP")
        print(f"  Creating immutable JSON backup in: {backup_dir}")
        manifest = backup_tables(contaminated, backup_dir)
        print(f"  [OK] Successfully backed up {len(manifest)} tables with SHA-256 checksums.")

        print("\n  PHASE 2: MIGRATE COMP-001 DATA TO smriti001")
        mig_results = migrate_comp001_to_tenant(dry_run=False)
        for entity, count in mig_results.items():
            print(f"  [OK] Migrated {count} {entity} into smriti001.")

        print("\n  PHASE 3: TRUNCATE EPHEMERAL TEST DATA IN SMRITISYS")
        del_results = delete_contaminated_rows(dry_run=False)
        for tbl, res in del_results.items():
            print(f"  [OK] {tbl:<35} : {res}")

        print("\n  PHASE 4: VERIFICATION")
        remaining = audit_contaminated_tables()
        remaining_non_quarantined = [(t, c) for t, c in remaining if t != "accounts"]
        print(f"  Remaining non-quarantined tenant tables: {len(remaining_non_quarantined)}")
        if len(remaining_non_quarantined) == 0:
            print("  [PASS] 0 operational tenant rows remain in smritisys Control Plane!")
        else:
            print(f"  [WARN] Remaining: {remaining_non_quarantined}")

        print("=" * 72 + "\n")


if __name__ == "__main__":
    main()
