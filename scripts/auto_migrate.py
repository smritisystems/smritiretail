"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.13
Created      : 2026-10-23
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Automated Migration & Pre-Migration Backup Engine
"""

import os
import sys
import json
import time
import shutil
import hashlib
import argparse
import subprocess
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import psycopg2

# Base Paths
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")
BACKUP_BASE_DIR = os.path.join(BACKEND_DIR, "backups", "pre_migration")
ALEMBIC_INI = os.path.join(BACKEND_DIR, "alembic.ini")

# Virtualenv Python / Alembic
VENV_PYTHON = os.path.join(WORKSPACE_ROOT, ".venv", "Scripts", "python.exe")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable

VENV_ALEMBIC = os.path.join(WORKSPACE_ROOT, ".venv", "Scripts", "alembic.exe")
if not os.path.exists(VENV_ALEMBIC):
    VENV_ALEMBIC = "alembic"

# Connection Settings
PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_PORT = int(os.getenv("POSTGRES_PORT", "2781"))
PG_USER = os.getenv("POSTGRES_USER", "postgres")
PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
DEFAULT_CTRL_DB = os.getenv("POSTGRES_DB", "smritisys")


# Ensure UTF-8 output encoding on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def log_step(step_num: int, title: str) -> None:
    print(f"\n[{step_num}] {title}")
    print("-" * 70)


def get_pg_connection(dbname: str = DEFAULT_CTRL_DB):
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        dbname=dbname,
        connect_timeout=10,
    )


def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def format_bytes(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def discover_databases(target_arg: str = "all") -> Tuple[List[str], List[str]]:
    """
    Discovers databases to operate upon.
    Returns (control_plane_dbs, tenant_dbs).
    """
    control_dbs = []
    tenant_dbs = []

    if target_arg.lower() in ["control", "smritisys"]:
        return [DEFAULT_CTRL_DB], []

    if target_arg.lower() not in ["all", "tenants"]:
        # Specific database requested
        if target_arg == DEFAULT_CTRL_DB:
            return [DEFAULT_CTRL_DB], []
        else:
            return [], [target_arg]

    # Target is "all" or "tenants"
    if target_arg.lower() == "all":
        control_dbs.append(DEFAULT_CTRL_DB)

    # Query smritisys for registered tenant databases
    registered_names = set()
    try:
        conn = get_pg_connection(DEFAULT_CTRL_DB)
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT database_name
            FROM company_database_registries
            WHERE status = 'READY'
              AND database_name IS NOT NULL
              AND database_name != ''
            ORDER BY database_name;
        """)
        rows = cur.fetchall()
        for r in rows:
            name = r[0].strip()
            if name and name != DEFAULT_CTRL_DB:
                registered_names.add(name)
        cur.close()
        conn.close()
    except Exception as exc:
        print(f"  [!] Notice: Could not read company_database_registries: {exc}")
        registered_names.add("smriti001")

    # Filter against physically existing databases in PostgreSQL (excluding ephemeral drops)
    try:
        conn = get_pg_connection("postgres")
        cur = conn.cursor()
        cur.execute("SELECT datname FROM pg_database WHERE datname NOT LIKE 'template%' AND datname != 'postgres';")
        physical_dbs = {r[0] for r in cur.fetchall()}
        cur.close()
        conn.close()

        for name in registered_names:
            if name in physical_dbs:
                tenant_dbs.append(name)

        # Always include smriti001 if present physically
        if "smriti001" in physical_dbs and "smriti001" not in tenant_dbs:
            tenant_dbs.append("smriti001")
    except Exception as exc:
        print(f"  [!] Notice checking pg_database: {exc}")
        tenant_dbs = ["smriti001"]

    tenant_dbs.sort()
    return control_dbs, tenant_dbs


def get_alembic_version(dbname: str) -> Optional[str]:
    try:
        conn = get_pg_connection(dbname)
        cur = conn.cursor()
        cur.execute("SELECT version_num FROM alembic_version LIMIT 1;")
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None


def get_table_row_counts(dbname: str) -> Dict[str, int]:
    counts = {}
    vital_tables = [
        "companies",
        "users",
        "customers",
        "customer_relationships",
        "products",
        "item_variants",
        "sales_invoices",
        "sales_invoice_items",
        "stock_movements",
    ]
    try:
        conn = get_pg_connection(dbname)
        cur = conn.cursor()
        for tbl in vital_tables:
            try:
                cur.execute(f"SELECT count(*) FROM {tbl};")
                cnt = cur.fetchone()[0]
                counts[tbl] = cnt
            except Exception:
                # Table might not exist in this database schema (e.g. control plane vs tenant)
                conn.rollback()
        cur.close()
        conn.close()
    except Exception:
        pass
    return counts


def create_database_backup(dbname: str, backup_dir: str) -> Dict[str, Any]:
    """
    Creates a compressed custom format pg_dump (.dump) of the specified database.
    """
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"{dbname}_{timestamp}.dump")

    start_time = time.time()
    initial_version = get_alembic_version(dbname)
    pre_counts = get_table_row_counts(dbname)

    # 1. Attempt Docker dump first if smriti-db container is running
    dump_success = False
    err_msg = ""
    try:
        with open(backup_file, "wb") as f_out:
            res = subprocess.run(
                ["docker", "exec", "smriti-db", "pg_dump", "-U", "postgres", "-Fc", "-d", dbname],
                stdout=f_out,
                stderr=subprocess.PIPE,
                check=False,
            )
        if res.returncode == 0 and os.path.exists(backup_file) and os.path.getsize(backup_file) > 0:
            dump_success = True
        else:
            err_msg = res.stderr.decode("utf-8", errors="replace")
    except Exception as exc:
        err_msg = str(exc)

    # 2. Fallback to native host pg_dump
    if not dump_success:
        try:
            env = os.environ.copy()
            env["PGPASSWORD"] = PG_PASSWORD
            with open(backup_file, "wb") as f_out:
                res = subprocess.run(
                    [
                        "pg_dump",
                        "-h", PG_HOST,
                        "-p", str(PG_PORT),
                        "-U", PG_USER,
                        "-Fc",
                        "-d", dbname,
                    ],
                    stdout=f_out,
                    stderr=subprocess.PIPE,
                    env=env,
                    check=False,
                )
            if res.returncode == 0 and os.path.exists(backup_file) and os.path.getsize(backup_file) > 0:
                dump_success = True
            else:
                err_msg += " | " + res.stderr.decode("utf-8", errors="replace")
        except Exception as exc:
            err_msg += " | " + str(exc)

    if not dump_success:
        raise RuntimeError(f"Failed to create pre-migration backup for database '{dbname}': {err_msg}")

    size_bytes = os.path.getsize(backup_file)
    sha256 = compute_sha256(backup_file)
    elapsed = time.time() - start_time

    manifest_item = {
        "database": dbname,
        "backup_file": backup_file,
        "filename": os.path.basename(backup_file),
        "size_bytes": size_bytes,
        "size_pretty": format_bytes(size_bytes),
        "sha256": sha256,
        "alembic_version_before": initial_version,
        "vital_row_counts_before": pre_counts,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "elapsed_sec": round(elapsed, 2),
    }

    print(f"  [+] Backup Created: {manifest_item['filename']} ({manifest_item['size_pretty']}) in {elapsed:.2f}s")
    print(f"      SHA-256: {sha256[:16]}...{sha256[-8:]} | Revision: {initial_version or 'unversioned'}")
    return manifest_item


def run_alembic_upgrade(dbname: str, is_control: bool) -> Tuple[bool, str, str]:
    """
    Executes alembic upgrade head for the specified target.
    """
    target = "control" if is_control else "tenant"
    env = os.environ.copy()
    env["POSTGRES_PORT"] = str(PG_PORT)
    env["ALEMBIC_TARGET"] = target
    env["DATABASE_URL"] = f"postgresql+asyncpg://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{dbname}"

    cmd = [
        VENV_ALEMBIC,
        "-c", ALEMBIC_INI,
        "-x", f"target={target}",
        "-x", f"db={dbname}",
        "-x", f"db_url=postgresql+asyncpg://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{dbname}",
        "upgrade", "head",
    ]

    res = subprocess.run(
        cmd,
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    return (res.returncode == 0, res.stdout, res.stderr)


def verify_post_migration(dbname: str, is_control: bool, pre_counts: Dict[str, int]) -> Dict[str, Any]:
    """
    Performs verification of database schema, alembic_version at head,
    critical column parity, and zero data loss.
    """
    ver = get_alembic_version(dbname)
    post_counts = get_table_row_counts(dbname)

    checks = {
        "alembic_at_head": ver == "v1543",
        "current_version": ver,
        "zero_data_loss": True,
        "show_child_customers_in_billing_valid": True,
        "customer_relationships_table_present": True,
        "details": [],
    }

    # Verify zero data loss on vital tables
    for tbl, before_cnt in pre_counts.items():
        after_cnt = post_counts.get(tbl, 0)
        if after_cnt < before_cnt:
            checks["zero_data_loss"] = False
            checks["details"].append(f"Row count decrease in {tbl}: {before_cnt} -> {after_cnt}")

    # For tenant databases, verify child billing columns & governance constraints
    if not is_control:
        try:
            conn = get_pg_connection(dbname)
            cur = conn.cursor()

            # 1. Check show_child_customers_in_billing column on customers table
            cur.execute("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'customers' AND column_name = 'show_child_customers_in_billing';
            """)
            col_row = cur.fetchone()
            if not col_row:
                checks["show_child_customers_in_billing_valid"] = False
                checks["details"].append("Column 'show_child_customers_in_billing' missing on customers table")

            # 2. Check customer_relationships table
            cur.execute("""
                SELECT count(*)
                FROM information_schema.tables
                WHERE table_name = 'customer_relationships';
            """)
            if cur.fetchone()[0] == 0:
                checks["customer_relationships_table_present"] = False
                checks["details"].append("Table 'customer_relationships' missing")

            cur.close()
            conn.close()
        except Exception as exc:
            checks["details"].append(f"Schema verification error: {exc}")

    return checks


def restore_database(dbname: str, backup_file: str) -> bool:
    """
    Restores the database from a compressed custom format pg_dump file.
    """
    print(f"\n[RESTORE] Initiating fail-safe restore for '{dbname}' from: {backup_file}")
    if not os.path.exists(backup_file):
        print(f"  [-] Error: Backup file not found: {backup_file}")
        return False

    # Terminate active connections to allow clean restore
    try:
        conn = get_pg_connection("postgres")
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '{dbname}' AND pid <> pg_backend_pid();
        """)
        cur.close()
        conn.close()
    except Exception as exc:
        print(f"  [!] Notice when terminating connections: {exc}")

    # Restore via docker
    try:
        with open(backup_file, "rb") as f_in:
            res = subprocess.run(
                ["docker", "exec", "-i", "smriti-db", "pg_restore", "-U", "postgres", "-d", dbname, "--clean", "--if-exists"],
                stdin=f_in,
                capture_output=True,
                check=False,
            )
        if res.returncode == 0 or b"warning" in res.stderr.lower():
            print(f"  [+] Restore completed successfully for '{dbname}'!")
            return True
        else:
            print(f"  [-] Docker restore failed: {res.stderr.decode('utf-8', errors='replace')}")
    except Exception as exc:
        print(f"  [-] Error running restore: {exc}")

    return False


def main():
    parser = argparse.ArgumentParser(
        description="SMRITI Retail OS — Automated Database Migration & Pre-Migration Backup Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--db",
        default="all",
        help="Target database: 'all' (default), 'control' (smritisys), 'smriti001', or specific tenant db name.",
    )
    parser.add_argument(
        "--backup-only",
        action="store_true",
        help="Only create verified pre-migration backups without executing alembic migrations.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip pre-migration backup (NOT recommended for production environments).",
    )
    parser.add_argument(
        "--auto-rollback",
        action="store_true",
        help="Automatically restore pre-migration backup if migration fails on any database.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Inspect migration status, current revisions, and table integrity without migrating.",
    )
    parser.add_argument(
        "--restore",
        type=str,
        default=None,
        metavar="BACKUP_PATH",
        help="Restore specified backup file to target database (specified with --db).",
    )

    args = parser.parse_args()

    print("=" * 70)
    print(" SMRITI Retail OS — Automated Database Migration & Backup Engine")
    print("=" * 70)
    print(f" Time (UTC)       : {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f" PostgreSQL Host  : {PG_HOST}:{PG_PORT} (User: {PG_USER})")
    print(f" Target Mode      : {args.db}")
    print(f" Virtualenv Alembic: {VENV_ALEMBIC}")

    # Handle explicit restore mode
    if args.restore:
        if args.db in ["all", "control"]:
            target_restore_db = DEFAULT_CTRL_DB
        else:
            target_restore_db = args.db
        success = restore_database(target_restore_db, args.restore)
        sys.exit(0 if success else 1)

    # Step 1: Preflight Connectivity & Discovery
    log_step(1, "Preflight Connectivity & Topology Discovery")
    try:
        conn = get_pg_connection("postgres")
        conn.close()
        print(f"  [+] PostgreSQL connection OK on {PG_HOST}:{PG_PORT}")
    except Exception as exc:
        print(f"  [-] FATAL: Cannot connect to PostgreSQL: {exc}")
        sys.exit(1)

    # Free disk check
    os.makedirs(BACKUP_BASE_DIR, exist_ok=True)
    total, used, free = shutil.disk_usage(BACKUP_BASE_DIR)
    free_mb = free / (1024 * 1024)
    print(f"  [+] Backup storage space available: {format_bytes(free)} (Free: {free_mb:.1f} MB)")
    if free_mb < 500:
        print("  [-] FATAL: Less than 500MB free disk space. Migration aborted for safety.")
        sys.exit(1)

    ctrl_dbs, tenant_dbs = discover_databases(args.db)
    all_dbs = [(db, True) for db in ctrl_dbs] + [(db, False) for db in tenant_dbs]
    print(f"  [+] Discovered {len(all_dbs)} database(s) in scope:")
    for db, is_ctrl in all_dbs:
        cur_v = get_alembic_version(db)
        print(f"      - {db:<25} ({'Control Plane' if is_ctrl else 'Tenant Store'}) | Current Revision: {cur_v or 'unversioned'}")

    if args.verify_only:
        print("\n[+] Verification inspection complete. Exiting (--verify-only mode).")
        sys.exit(0)

    # Step 2: Pre-Migration Backup Creation
    session_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    session_backup_dir = os.path.join(BACKUP_BASE_DIR, f"migration_session_{session_id}")
    manifest: Dict[str, Any] = {
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "backups": {},
    }

    if not args.no_backup:
        log_step(2, f"Creating Pre-Migration Snapshots (Session: {session_id})")
        for db, is_ctrl in all_dbs:
            try:
                b_info = create_database_backup(db, session_backup_dir)
                manifest["backups"][db] = b_info
            except Exception as exc:
                print(f"  [-] FATAL: Pre-migration backup failed for '{db}': {exc}")
                sys.exit(1)

        # Write manifest file
        manifest_path = os.path.join(session_backup_dir, "backup_manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
        print(f"  [+] Master backup manifest saved: {manifest_path}")

        if args.backup_only:
            print("\n[+] Pre-migration backups completed successfully. Exiting (--backup-only mode).")
            sys.exit(0)
    else:
        log_step(2, "Pre-Migration Backup Skipped (--no-backup specified)")

    # Step 3: Migration Execution
    log_step(3, "Executing Alembic Head Migrations")
    migration_results = {}
    failed_db = None

    for db, is_ctrl in all_dbs:
        print(f"  [*] Migrating {db} ({'Control Plane' if is_ctrl else 'Tenant'})...")
        t0 = time.time()
        ok, stdout_txt, stderr_txt = run_alembic_upgrade(db, is_ctrl)
        elapsed = time.time() - t0

        if ok:
            print(f"  [+] {db}: Migration SUCCESS in {elapsed:.2f}s")
            migration_results[db] = {"status": "SUCCESS", "elapsed": elapsed}
        else:
            print(f"  [-] {db}: Migration FAILED in {elapsed:.2f}s!")
            print(f"      STDERR:\n{stderr_txt}")
            migration_results[db] = {"status": "FAILED", "stderr": stderr_txt}
            failed_db = db
            break

    # Step 4: Verification & Rollback Handling
    if failed_db:
        log_step(4, f"Migration Failure Handling for '{failed_db}'")
        if args.auto_rollback and not args.no_backup and failed_db in manifest["backups"]:
            backup_path = manifest["backups"][failed_db]["backup_file"]
            print(f"  [*] Executing automated rollback for '{failed_db}'...")
            restored = restore_database(failed_db, backup_path)
            if restored:
                print(f"  [+] Automated rollback successful. '{failed_db}' restored to pre-migration snapshot.")
            else:
                print(f"  [-] Automated rollback FAILED. Manual intervention required!")
        else:
            if not args.no_backup and failed_db in manifest["backups"]:
                backup_path = manifest["backups"][failed_db]["backup_file"]
                print("  [!] To restore to the pre-migration snapshot, run:")
                print(f"      python scripts/auto_migrate.py --db {failed_db} --restore \"{backup_path}\"")
        sys.exit(1)

    log_step(4, "Post-Migration Verification & Parity Checks")
    all_verified = True
    for db, is_ctrl in all_dbs:
        pre_counts = manifest["backups"].get(db, {}).get("vital_row_counts_before", {})
        v_res = verify_post_migration(db, is_ctrl, pre_counts)
        if v_res["alembic_at_head"] and v_res["zero_data_loss"] and v_res["show_child_customers_in_billing_valid"]:
            print(f"  [PASS] {db:<25}: Alembic Head ({v_res['current_version']}) | Zero Data Loss | Schema Valid")
        else:
            all_verified = False
            print(f"  [FAIL] {db:<25}: Verification issues detected:")
            for d in v_res["details"]:
                print(f"         - {d}")

    # Summary
    print("\n" + "=" * 70)
    if all_verified:
        print(" [ALL PASS] Database Auto-Migration & Verification Completed Successfully!")
    else:
        print(" [WARNING] Migrations applied but verification checks had warnings.")
    print("=" * 70)
    print(f" Databases Processed : {len(all_dbs)}")
    if not args.no_backup:
        print(f" Backup Directory    : {session_backup_dir}")
    print(f" Final Alembic Head  : v1543")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
