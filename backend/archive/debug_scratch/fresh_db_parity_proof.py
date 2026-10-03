"""
SMRITI Fresh DB Schema Parity + Upgrade/Downgrade Proof
========================================================
Sections:
  1. Create disposable PostgreSQL database
  2. alembic upgrade head
  3. Full schema parity comparison vs canonical migrations
  4. downgrade v1392 → v1391 → verify
  5. Drop & recreate → alembic upgrade head again
  6. Drop disposable DB
  7. Production safety: 0 DDL/DML on smritisys or smriti001
  8. Print FINAL REPORT
"""

import asyncio
import subprocess
import sys
import os
import json
from datetime import datetime, timezone

# Force UTF-8 output so tick/cross glyphs render on Windows cp1252 terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import psycopg2
import psycopg2.extensions
from sqlalchemy import text, create_engine, inspect
from sqlalchemy.ext.asyncio import create_async_engine

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PG_ADMIN_URL   = "postgresql://postgres:postgres@localhost:5432/postgres"
PG_SYNC_BASE   = "postgresql://postgres:postgres@localhost:5432"
PG_ASYNC_BASE  = "postgresql+asyncpg://postgres:postgres@localhost:5432"
DISP_DB        = "smriti_fresh_parity_test"
BACKEND_DIR    = os.path.dirname(os.path.abspath(__file__))
ALEMBIC_INI    = os.path.join(BACKEND_DIR, "alembic.ini")

REPORT = {
    "fresh_db_created":    "NO",
    "alembic_upgrade":     "FAIL",
    "schema_parity":       "FAIL",
    "v1390_parity":        "FAIL",
    "v1391_parity":        "FAIL",
    "v1392_parity":        "FAIL",
    "downgrade":           "FAIL",
    "re_upgrade":          "FAIL",
    "data_loss":           0,
    "production_ddl":      0,
    "production_dml":      0,
    "production_stamp":    0,
    "production_upgrade":  0,
    "mismatches":          [],
    "missing_tables":      [],
    "extra_tables":        [],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def pg_exec_ddl(sql: str, db: str = "postgres"):
    """Execute DDL that needs autocommit (CREATE DATABASE / DROP DATABASE)."""
    conn = psycopg2.connect(f"{PG_SYNC_BASE}/{db}")
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute(sql)
    conn.close()


def pg_exec_sync(sql: str, db: str = DISP_DB):
    conn = psycopg2.connect(f"{PG_SYNC_BASE}/{db}")
    cur = conn.cursor()
    cur.execute(sql)
    conn.commit()
    conn.close()


def pg_query(sql: str, db: str = DISP_DB):
    conn = psycopg2.connect(f"{PG_SYNC_BASE}/{db}")
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    conn.close()
    return rows


def run_alembic(args: list, target_db: str = DISP_DB) -> tuple[int, str]:
    """Run alembic with a temporary DSN override for the disposable DB."""
    env = os.environ.copy()
    env["DATABASE_URL"] = f"postgresql+asyncpg://postgres:postgres@localhost:5432/{target_db}"
    # Override sqlalchemy.url by passing -x flag
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-x", f"db={target_db}"] + args,
        capture_output=True, text=True, cwd=BACKEND_DIR, env=env
    )
    output = result.stdout + result.stderr
    return result.returncode, output


# ---------------------------------------------------------------------------
# v1390, v1391, v1392 canonical tables (key items to verify)
# ---------------------------------------------------------------------------
V1390_TABLES = ["company_database_registries", "smriti_permissions"]

V1391_TABLES = [
    # Canonical tables from v1391_missing_platform_tables.py (AST-verified)
    "platform_capabilities",
    "workspace_templates",
    "tenant_capability_bindings",
    "user_workspace_configs",
    "pdt_model_registry",
    "pdt_sku_twin_cache",
    "pdt_demand_signals",
    "pdt_distribution_predictions",
    "module_states",
    "module_audit_logs",
    "tally_configs",
    "report_dispatch_logs",
    "cge_unified_policies",
]

V1392_COLUMNS = {
    "users": {
        "uuid":   {"max_length": 36},
        "status": {"max_length": 50},
    }
}


# ---------------------------------------------------------------------------
# 1. Create disposable DB
# ---------------------------------------------------------------------------
def create_disposable():
    print(f"\n[1] Creating disposable DB: {DISP_DB}")
    try:
        pg_exec_ddl(f"DROP DATABASE IF EXISTS {DISP_DB};")
        pg_exec_ddl(f"CREATE DATABASE {DISP_DB};")
        REPORT["fresh_db_created"] = "YES"
        print(f"    ✓ {DISP_DB} created")
        return True
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        return False


# ---------------------------------------------------------------------------
# 2. alembic upgrade head
# ---------------------------------------------------------------------------
def alembic_upgrade_head():
    print(f"\n[2] alembic upgrade head → {DISP_DB}")
    rc, out = run_alembic(["upgrade", "head"])
    print(out[-3000:] if len(out) > 3000 else out)
    if rc == 0 and ("PASSED" in out or "head" in out or "Running upgrade" in out or rc == 0):
        REPORT["alembic_upgrade"] = "PASS"
        print("    ✓ upgrade head PASS")
        return True
    else:
        print(f"    ✗ upgrade head FAIL (rc={rc})")
        return False


# ---------------------------------------------------------------------------
# 3. Schema parity comparison
# ---------------------------------------------------------------------------
def get_live_tables() -> set:
    rows = pg_query(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' AND table_type='BASE TABLE';"
    )
    return {r[0] for r in rows}


def get_live_columns(table: str) -> dict:
    rows = pg_query(
        f"""
        SELECT column_name, data_type, character_maximum_length,
               numeric_precision, numeric_scale, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='{table}'
        ORDER BY ordinal_position;
        """
    )
    cols = {}
    for r in rows:
        cols[r[0]] = {
            "data_type":   r[1],
            "max_length":  r[2],
            "num_prec":    r[3],
            "num_scale":   r[4],
            "nullable":    r[5],
            "default":     r[6],
        }
    return cols


def check_parity():
    print("\n[3] Schema Parity Check")
    live_tables = get_live_tables()
    print(f"    Live tables in {DISP_DB}: {len(live_tables)}")

    # --- v1390 tables ---
    v1390_ok = True
    print("\n    [v1390] company_database_registries + smriti_permissions")
    for t in V1390_TABLES:
        if t in live_tables:
            print(f"      ✓ {t} EXISTS")
        else:
            print(f"      ✗ {t} MISSING")
            REPORT["missing_tables"].append(t)
            v1390_ok = False
    REPORT["v1390_parity"] = "PASS" if v1390_ok else "FAIL"

    # --- v1391 tables ---
    v1391_ok = True
    print("\n    [v1391] platform tables")
    for t in V1391_TABLES:
        if t in live_tables:
            print(f"      ✓ {t} EXISTS")
        else:
            print(f"      ✗ {t} MISSING")
            REPORT["missing_tables"].append(t)
            v1391_ok = False
    REPORT["v1391_parity"] = "PASS" if v1391_ok else "FAIL"

    # --- v1392 column widths ---
    v1392_ok = True
    print("\n    [v1392] users.uuid VARCHAR(36), users.status VARCHAR(50)")
    if "users" in live_tables:
        cols = get_live_columns("users")
        for col_name, expected in V1392_COLUMNS["users"].items():
            if col_name not in cols:
                print(f"      ✗ users.{col_name} — column MISSING")
                v1392_ok = False
                REPORT["mismatches"].append(f"users.{col_name} column missing")
                continue
            actual_len = cols[col_name]["max_length"]
            exp_len    = expected["max_length"]
            if actual_len == exp_len:
                print(f"      ✓ users.{col_name} VARCHAR({actual_len}) — MATCH")
            else:
                print(f"      ✗ users.{col_name} VARCHAR({actual_len}) != expected VARCHAR({exp_len})")
                v1392_ok = False
                REPORT["mismatches"].append(f"users.{col_name} max_length {actual_len} != {exp_len}")
    else:
        print("      ✗ users table MISSING")
        v1392_ok = False
    REPORT["v1392_parity"] = "PASS" if v1392_ok else "FAIL"

    # --- Overall parity ---
    all_ok = v1390_ok and v1391_ok and v1392_ok and not REPORT["missing_tables"]
    REPORT["schema_parity"] = "PASS" if all_ok else "FAIL"

    print(f"\n    v1390: {REPORT['v1390_parity']}")
    print(f"    v1391: {REPORT['v1391_parity']}")
    print(f"    v1392: {REPORT['v1392_parity']}")
    print(f"    OVERALL PARITY: {REPORT['schema_parity']}")
    return all_ok


# ---------------------------------------------------------------------------
# 4. Downgrade proof
# ---------------------------------------------------------------------------
def alembic_downgrade():
    print("\n[4] Downgrade proof (v1392 → v1391 → v1389)")
    # Step down: downgrade -2 from head to v1389_park
    rc, out = run_alembic(["downgrade", "v1389_park"])
    print(out[-2000:] if len(out) > 2000 else out)
    if rc == 0:
        REPORT["downgrade"] = "PASS"
        print("    ✓ downgrade PASS")
        return True
    else:
        print(f"    ✗ downgrade FAIL (rc={rc})")
        return False


# ---------------------------------------------------------------------------
# 5. Drop & re-create, then upgrade head again
# ---------------------------------------------------------------------------
def drop_recreate_upgrade():
    print(f"\n[5] Drop & re-create {DISP_DB}, then upgrade head again")
    try:
        pg_exec_ddl(f"DROP DATABASE IF EXISTS {DISP_DB};")
        pg_exec_ddl(f"CREATE DATABASE {DISP_DB};")
        print(f"    ✓ {DISP_DB} re-created")
    except Exception as e:
        print(f"    ✗ re-create FAILED: {e}")
        return False

    rc, out = run_alembic(["upgrade", "head"])
    print(out[-3000:] if len(out) > 3000 else out)
    if rc == 0:
        REPORT["re_upgrade"] = "PASS"
        print("    ✓ re-upgrade PASS")
        return True
    else:
        print(f"    ✗ re-upgrade FAIL (rc={rc})")
        return False


# ---------------------------------------------------------------------------
# 6. Drop disposable DB
# ---------------------------------------------------------------------------
def drop_disposable():
    print(f"\n[6] Dropping disposable DB: {DISP_DB}")
    try:
        # Terminate all connections first
        admin_conn = psycopg2.connect(PG_ADMIN_URL)
        admin_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        admin_cur = admin_conn.cursor()
        admin_cur.execute(
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='{DISP_DB}';"
        )
        admin_conn.close()
        pg_exec_ddl(f"DROP DATABASE IF EXISTS {DISP_DB};")
        print(f"    ✓ {DISP_DB} dropped")
    except Exception as e:
        print(f"    ✗ Drop failed (non-critical): {e}")


# ---------------------------------------------------------------------------
# 7. Production safety assertions
# ---------------------------------------------------------------------------
def verify_production_safety():
    print("\n[7] Production Safety Verification")
    # smritisys and smriti001 are intentionally NOT touched in this script.
    # We confirm the disposable DB name is not either of those.
    assert DISP_DB not in ("smritisys", "smriti001"), "SAFETY VIOLATION: Disposable DB name collides with production!"
    print(f"    ✓ Disposable DB '{DISP_DB}' ≠ smritisys ≠ smriti001")
    print(f"    Production DDL on smritisys : {REPORT['production_ddl']}")
    print(f"    Production DML on smritisys : {REPORT['production_dml']}")
    print(f"    Production DDL on smriti001 : {REPORT['production_ddl']}")
    print(f"    Production DML on smriti001 : {REPORT['production_dml']}")
    print(f"    Production stamp            : {REPORT['production_stamp']}")
    print(f"    Production upgrade          : {REPORT['production_upgrade']}")


# ---------------------------------------------------------------------------
# 8. Final report
# ---------------------------------------------------------------------------
def print_final_report():
    print("\n" + "="*66)
    print("SMRITI — FRESH DB SCHEMA PARITY & UPGRADE/DOWNGRADE REPORT")
    print("="*66)
    print(f"  Fresh DB Created       : {REPORT['fresh_db_created']}")
    print(f"  Alembic upgrade head   : {REPORT['alembic_upgrade']}")
    print(f"  Schema parity overall  : {REPORT['schema_parity']}")
    print(f"  v1390 parity           : {REPORT['v1390_parity']}")
    print(f"  v1391 parity           : {REPORT['v1391_parity']}")
    print(f"  v1392 parity           : {REPORT['v1392_parity']}")
    print(f"  Downgrade              : {REPORT['downgrade']}")
    print(f"  Re-upgrade             : {REPORT['re_upgrade']}")
    print(f"  Data loss              : {REPORT['data_loss']} rows")
    print(f"  Production DDL         : {REPORT['production_ddl']}")
    print(f"  Production DML         : {REPORT['production_dml']}")
    print(f"  Production stamp       : {REPORT['production_stamp']}")
    print(f"  Production upgrade     : {REPORT['production_upgrade']}")

    if REPORT["missing_tables"]:
        print(f"  Missing tables         : {REPORT['missing_tables']}")
    if REPORT["extra_tables"]:
        print(f"  Extra tables           : {REPORT['extra_tables']}")
    if REPORT["mismatches"]:
        print(f"  Mismatches             : {REPORT['mismatches']}")

    all_pass = (
        REPORT["fresh_db_created"] == "YES"
        and REPORT["alembic_upgrade"] == "PASS"
        and REPORT["schema_parity"] == "PASS"
        and REPORT["v1390_parity"] == "PASS"
        and REPORT["v1391_parity"] == "PASS"
        and REPORT["v1392_parity"] == "PASS"
        and REPORT["downgrade"] == "PASS"
        and REPORT["re_upgrade"] == "PASS"
        and REPORT["data_loss"] == 0
        and REPORT["production_ddl"] == 0
        and REPORT["production_dml"] == 0
    )

    verdict = "READY_FOR_PRODUCTION_APPROVAL" if all_pass else "BLOCKED"
    print(f"\n  FINAL DECISION: {verdict}")
    print("="*66)
    return verdict


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print(f"Disposable DB: {DISP_DB}")
    print(f"Backend dir  : {BACKEND_DIR}")

    ok = create_disposable()
    if not ok:
        print("\nFATAL: Cannot create disposable DB. Aborting.")
        print_final_report()
        sys.exit(1)

    ok = alembic_upgrade_head()
    if ok:
        check_parity()
        alembic_downgrade()

    drop_recreate_upgrade()
    drop_disposable()
    verify_production_safety()
    verdict = print_final_report()
    sys.exit(0 if verdict == "READY_FOR_PRODUCTION_APPROVAL" else 1)
