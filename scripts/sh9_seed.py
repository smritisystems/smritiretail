"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Sprint 2 -- Legacy Menu Map Seed Script

Reads: docs/legacy/shoper/SH9_MAP_MATRIX.csv  (265 rows, Sprint 1 output)
Upserts: smriti_legacy_menu_map table

Idempotent: re-running updates existing rows (no duplicates).
Use this script after:
  1. Running alembic upgrade head (v1371 must be applied first)
  2. Any update to SH9_MAP_MATRIX.csv (e.g. after re-running sh9_map.py)

Usage:
  python scripts/sh9_seed.py [--dry-run] [--db-url postgresql://...]

If --db-url is not provided, reads DATABASE_URL from backend/.env
"""

import sys
import os
import csv
import uuid
import argparse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

MAP_CSV = ROOT / "docs" / "legacy" / "shoper" / "SH9_MAP_MATRIX.csv"

VALID_STATUSES = {"MAPPED","MERGED","REPLACED","DEPRECATED","NOT_APPLIC","PENDING"}
MAP_VERSION = "1.0"


def load_env_db_url() -> str:
    """Read DATABASE_URL from backend/.env"""
    env_path = ROOT / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise ValueError(
        "DATABASE_URL not found in backend/.env. "
        "Pass --db-url explicitly or set DATABASE_URL."
    )


def csv_to_int(val: str, default: int = 0) -> int:
    try:
        return int(val.strip()) if val.strip() else default
    except (ValueError, TypeError):
        return default


def build_row(r: dict) -> dict:
    status = r.get("MigrationStatus", "PENDING").strip()
    if status not in VALID_STATUSES:
        status = "PENDING"
    return {
        "id":              f"lmm-{r['MnuNo']}-{r['MenuOpt']}",
        "uuid":            str(uuid.uuid4()),
        "company_id":      None,
        "branch_id":       None,
        "created_at":      datetime.now(timezone.utc),
        "modified_at":     datetime.now(timezone.utc),
        "created_by":      "sprint2_seed",
        "updated_by":      "sprint2_seed",
        "is_active":       True,
        "is_deleted":      False,
        "deleted_at":      None,
        "deleted_by":      None,
        "version":         1,
        "sh9_mnu_no":      csv_to_int(r["MnuNo"]),
        "sh9_menu_opt":    csv_to_int(r["MenuOpt"]),
        "sh9_mnu_name":    r.get("MnuName","")[:120],
        "sh9_mnu_cap":     r.get("MnuCap","")[:200],
        "sh9_exe_name":    r.get("ExeName","")[:60],
        "sh9_pgm_opt":     csv_to_int(r.get("pgmopt","0")),
        "sh9_allow_closed":csv_to_int(r.get("AllowWhenTrnClosed","0")),
        "sh9_multi_inst":  csv_to_int(r.get("MultiInstance","0")),
        "smriti_menu_id":  r.get("SmritiMenuId","")[:80] or None,
        "smriti_workspace":r.get("SmritiWorkspace","")[:120] or None,
        "smriti_module":   r.get("SmritiModule","")[:50] or None,
        "smriti_action":   r.get("SmritiAction","")[:60] or None,
        "document_type":   r.get("DocumentType","")[:60] or None,
        "migration_status":status,
        "migration_notes": r.get("Notes",""),
        "source_file":     r.get("SourceFile","")[:120] or None,
        "map_version":     MAP_VERSION,
    }


def run(db_url: str, dry_run: bool) -> None:
    try:
        import sqlalchemy as sa
        from sqlalchemy import text
    except ImportError:
        print("ERROR: sqlalchemy not installed. Run: pip install sqlalchemy psycopg2-binary")
        sys.exit(1)

    if not MAP_CSV.exists():
        print(f"ERROR: {MAP_CSV} not found. Run scripts/sh9_map.py first.")
        sys.exit(1)

    rows = []
    with open(MAP_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(build_row(r))

    print(f"Loaded {len(rows)} rows from {MAP_CSV.name}")

    if dry_run:
        print("\n[DRY RUN] Sample rows (first 3):")
        for r in rows[:3]:
            print(f"  id={r['id']:<20} sh9=({r['sh9_mnu_no']},{r['sh9_menu_opt']}) "
                  f"ws={r['smriti_workspace']} status={r['migration_status']}")
        print(f"\n[DRY RUN] Would upsert {len(rows)} rows. No DB changes made.")
        return

    engine = sa.create_engine(db_url, echo=False)
    TABLE = "smriti_legacy_menu_map"

    inserted = 0
    updated  = 0
    errors   = 0

    with engine.begin() as conn:
        # Check table exists
        tbl_check = conn.execute(text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:tn"
        ), {"tn": TABLE}).fetchone()
        if not tbl_check:
            print(f"ERROR: Table '{TABLE}' not found. Run: alembic upgrade head")
            sys.exit(1)

        for r in rows:
            try:
                existing = conn.execute(
                    text(f"SELECT id FROM {TABLE} WHERE sh9_mnu_no=:mno AND sh9_menu_opt=:mopt"),
                    {"mno": r["sh9_mnu_no"], "mopt": r["sh9_menu_opt"]}
                ).fetchone()

                if existing:
                    conn.execute(text(f"""
                        UPDATE {TABLE} SET
                            sh9_mnu_name    = :sh9_mnu_name,
                            sh9_mnu_cap     = :sh9_mnu_cap,
                            sh9_exe_name    = :sh9_exe_name,
                            sh9_pgm_opt     = :sh9_pgm_opt,
                            sh9_allow_closed= :sh9_allow_closed,
                            sh9_multi_inst  = :sh9_multi_inst,
                            smriti_menu_id  = :smriti_menu_id,
                            smriti_workspace= :smriti_workspace,
                            smriti_module   = :smriti_module,
                            smriti_action   = :smriti_action,
                            document_type   = :document_type,
                            migration_status= :migration_status,
                            migration_notes = :migration_notes,
                            source_file     = :source_file,
                            map_version     = :map_version,
                            modified_at     = :modified_at,
                            updated_by      = :updated_by,
                            version         = version + 1
                        WHERE sh9_mnu_no=:sh9_mnu_no AND sh9_menu_opt=:sh9_menu_opt
                    """), r)
                    updated += 1
                else:
                    conn.execute(text(f"""
                        INSERT INTO {TABLE} (
                            id, uuid, company_id, branch_id,
                            created_at, modified_at, created_by, updated_by,
                            is_active, is_deleted, deleted_at, deleted_by, version,
                            sh9_mnu_no, sh9_menu_opt, sh9_mnu_name, sh9_mnu_cap,
                            sh9_exe_name, sh9_pgm_opt, sh9_allow_closed, sh9_multi_inst,
                            smriti_menu_id, smriti_workspace, smriti_module,
                            smriti_action, document_type,
                            migration_status, migration_notes, source_file, map_version
                        ) VALUES (
                            :id, :uuid, :company_id, :branch_id,
                            :created_at, :modified_at, :created_by, :updated_by,
                            :is_active, :is_deleted, :deleted_at, :deleted_by, :version,
                            :sh9_mnu_no, :sh9_menu_opt, :sh9_mnu_name, :sh9_mnu_cap,
                            :sh9_exe_name, :sh9_pgm_opt, :sh9_allow_closed, :sh9_multi_inst,
                            :smriti_menu_id, :smriti_workspace, :smriti_module,
                            :smriti_action, :document_type,
                            :migration_status, :migration_notes, :source_file, :map_version
                        )
                    """), r)
                    inserted += 1

            except Exception as e:
                print(f"  ERROR row ({r['sh9_mnu_no']},{r['sh9_menu_opt']}): {e}")
                errors += 1

    print(f"\n{'='*55}")
    print(f"SPRINT 2 SEED COMPLETE")
    print(f"{'='*55}")
    print(f"Inserted : {inserted}")
    print(f"Updated  : {updated}")
    print(f"Errors   : {errors}")
    print(f"Total    : {inserted + updated + errors} / {len(rows)}")

    if errors:
        print(f"\nWARNING: {errors} rows failed. Review errors above.")
        sys.exit(1)
    else:
        print("\nAll rows seeded successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed smriti_legacy_menu_map from SH9_MAP_MATRIX.csv"
    )
    parser.add_argument("--db-url", default=None,
                        help="PostgreSQL DSN (default: reads from backend/.env)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse CSV and show sample rows without touching the DB")
    args = parser.parse_args()

    db_url = args.db_url
    if not db_url and not args.dry_run:
        db_url = load_env_db_url()

    run(db_url=db_url or "", dry_run=args.dry_run)


if __name__ == "__main__":
    main()
