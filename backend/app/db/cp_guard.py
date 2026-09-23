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
Classification: Internal — Security Guard

SMRITI Control Plane Database Guard (cp_guard.py — TDB-v2.0)
═════════════════════════════════════════════════════════════
Inspects the smritisys Control Plane database and detects forbidden
tenant operational tables and row-level violations.

Architecture Rule (TDB-v2.0 Positive Ownership Model):
    Every table has a canonical owner declared in app.db.ownership.
    smritisys = CONTROL_PLANE + PLATFORM_TEMPLATE + SHARED_REFERENCE.
    TENANT_OWNED_TABLES MUST NOT exist or contain rows in smritisys.
    This guard derives all forbidden & allowed sets directly from
    the canonical TABLE_OWNERSHIP registry.

Usage:
    python -m app.db.cp_guard
    python -m app.db.cp_guard --fail-on-non-empty
    python -m app.db.cp_guard --fail-on-violations
"""

import sys
import argparse
import os
import logging
from typing import Dict, List, Tuple, Any

try:
    import psycopg2
except ImportError:
    psycopg2 = None  # type: ignore

from app.db.ownership import (
    TABLE_OWNERSHIP,
    TableOwner,
    CONTROL_PLANE_TABLES,
    TENANT_OWNED_TABLES,
    SHARED_REFERENCE_TABLES,
    PLATFORM_TEMPLATE_TABLES,
    PERMITTED_IN_CONTROL_PLANE,
    is_tenant_table,
    is_permitted_in_smritisys,
)

logger = logging.getLogger("smriti.cp_guard")

# Derived dynamically from canonical TABLE_OWNERSHIP registry
FORBIDDEN_TENANT_TABLES = sorted(TENANT_OWNED_TABLES)
CONTROL_PLANE_ALLOWED_TABLES = PERMITTED_IN_CONTROL_PLANE


def run_guard(db_url: str | None = None) -> Dict[str, Any]:
    """Authoritative runner that raises RuntimeError if connected to non-smritisys DB."""
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required to run the Control Plane guard.")
    target_url = db_url or get_default_db_url()
    conn = psycopg2.connect(target_url, connect_timeout=5)
    cur = conn.cursor()
    cur.execute("SELECT current_database();")
    curr_db = cur.fetchone()[0]
    conn.close()
    if str(curr_db).strip().lower() != "smritisys":
        raise RuntimeError(
            f"CP Guard must connect to smritisys, but connected to '{curr_db}'."
        )
    return inspect_control_plane(db_url)


def get_default_db_url() -> str:
    """Resolve database URL for smritisys."""
    url = os.getenv("CONTROL_PLANE_DATABASE_URL")
    if url:
        return url
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    return f"postgresql://{user}:{password}@{host}:{port}/smritisys"


def inspect_control_plane(db_url: str | None = None) -> Dict[str, Any]:
    """
    Connect to smritisys and inspect all public tables against TABLE_OWNERSHIP registry.
    Returns:
        {
            "database": str,
            "connected": bool,
            "all_existing_tables": List[str],
            "forbidden_tables_present": List[str],
            "non_empty_violations": List[Tuple[str, int]],
            "empty_violations": List[str],
            "template_tables_present": List[Tuple[str, int]],
            "unexpected_tables": List[str],
            "clean": bool,
        }
    """
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is required to run the Control Plane guard.")

    target_url = db_url or get_default_db_url()
    result: Dict[str, Any] = {
        "database": "smritisys",
        "db_url": target_url.split("@")[-1] if "@" in target_url else target_url,
        "connected": False,
        "all_existing_tables": [],
        "forbidden_tables_present": [],
        "non_empty_violations": [],
        "empty_violations": [],
        "template_tables_present": [],
        "unexpected_tables": [],
        "clean": False,
        "error": None,
    }

    try:
        conn = psycopg2.connect(target_url, connect_timeout=5)
        cur = conn.cursor()
        result["connected"] = True

        cur.execute("SELECT current_database();")
        curr_db = cur.fetchone()[0]
        if str(curr_db).strip().lower() != "smritisys":
            conn.close()
            raise RuntimeError(
                f"CP Guard must connect to smritisys, but connected to '{curr_db}'."
            )

        # Fetch all public tables in smritisys
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        existing_tables = [row[0] for row in cur.fetchall()]
        result["all_existing_tables"] = existing_tables

        for table in existing_tables:
            owner = TABLE_OWNERSHIP.get(table)

            if owner == TableOwner.TENANT:
                result["forbidden_tables_present"].append(table)
                # Count rows
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{table}";')  # nosec
                    count = cur.fetchone()[0]
                    if count > 0:
                        result["non_empty_violations"].append((table, count))
                    else:
                        result["empty_violations"].append(table)
                except Exception as row_exc:
                    result["non_empty_violations"].append((table, -1))
                    conn.rollback()

            elif owner == TableOwner.PLATFORM_TEMPLATE:
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{table}";')  # nosec
                    count = cur.fetchone()[0]
                    result["template_tables_present"].append((table, count))
                except Exception:
                    conn.rollback()

            elif owner in (TableOwner.CONTROL_PLANE, TableOwner.SHARED_REFERENCE) or table == "alembic_version":
                pass  # Authorized

            else:
                # Table exists in smritisys but is NOT registered in TABLE_OWNERSHIP
                result["unexpected_tables"].append(table)

        conn.close()
        result["clean"] = (
            len(result["forbidden_tables_present"]) == 0
            and len(result["unexpected_tables"]) == 0
        )

    except Exception as exc:
        result["error"] = str(exc)

    return result


def run_startup_check(db_url: str | None = None) -> Dict[str, Any]:
    """
    Called from FastAPI lifespan during application startup.
    Fails closed in strict mode or logs warnings on contamination.
    """
    report = inspect_control_plane(db_url)
    if not report["connected"]:
        logger.warning("[CP Guard] Could not connect to smritisys for startup boundary check: %s", report.get("error"))
        return report

    non_empty_count = len(report["non_empty_violations"])
    if non_empty_count > 0:
        logger.critical(
            "[CP Guard] CRITICAL TENANT DATA BOUNDARY VIOLATION: "
            "Found %d non-empty tenant tables in smritisys: %s",
            non_empty_count, report["non_empty_violations"]
        )
    elif len(report["forbidden_tables_present"]) > 0:
        logger.warning(
            "[CP Guard] WARNING: Found %d empty forbidden tenant table schemas in smritisys.",
            len(report["forbidden_tables_present"])
        )
    else:
        logger.info("[CP Guard] Startup boundary check PASSED: smritisys Control Plane is clean.")

    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SMRITI Control Plane Database Guard (TDB-v2.0) — Positive Ownership Enforcement"
    )
    parser.add_argument(
        "--db-url",
        type=str,
        default=None,
        help="Database URL for smritisys."
    )
    parser.add_argument(
        "--fail-on-violations",
        action="store_true",
        help="Exit with code 1 if any tenant table exists in smritisys (even if empty)."
    )
    parser.add_argument(
        "--fail-on-non-empty",
        action="store_true",
        help="Exit with code 1 if any tenant table in smritisys contains rows."
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Display all existing Control Plane tables."
    )
    args = parser.parse_args()

    print("\n" + "=" * 72)
    print("  SMRITI CONTROL PLANE DATABASE GUARD (TDB-v2.0)")
    print("=" * 72)

    report = inspect_control_plane(args.db_url)

    if not report["connected"]:
        print(f"  [ERROR] Could not connect to smritisys: {report.get('error')}")
        sys.exit(1)

    print(f"  Database           : smritisys ({report['db_url']})")
    print(f"  Total Tables Found : {len(report['all_existing_tables'])}")
    print(f"  Ownership Model    : Positive Registry (app.db.ownership)")
    print()

    # Section 1: Non-empty violations
    if report["non_empty_violations"]:
        print("  [CRITICAL VIOLATION] NON-EMPTY TENANT TABLES IN SMRITISYS:")
        for tbl, count in report["non_empty_violations"]:
            print(f"    - {tbl:<35} : {count:>6} rows")
        print()
    else:
        print("  [PASS] 0 non-empty tenant tables found in smritisys.")

    # Section 2: Empty forbidden tables
    if report["empty_violations"]:
        print(f"  [SCHEMA VIOLATION] {len(report['empty_violations'])} empty tenant tables present in smritisys:")
        for tbl in report["empty_violations"]:
            print(f"    - {tbl}")
        print()
    else:
        print("  [PASS] 0 empty tenant table structures present in smritisys.")

    # Section 3: Template tables (allowed in CP as bootstrap templates)
    if report["template_tables_present"]:
        print(f"  [INFO] {len(report['template_tables_present'])} platform template tables in smritisys:")
        for tbl, count in report["template_tables_present"]:
            print(f"    - {tbl:<35} : {count:>6} template rows")
        print()

    # Section 4: Unexpected tables
    if report["unexpected_tables"]:
        print(f"  [WARNING] {len(report['unexpected_tables'])} tables without declared ownership:")
        for tbl in report["unexpected_tables"]:
            print(f"    - {tbl}")
        print()

    print("=" * 72)
    has_non_empty = len(report["non_empty_violations"]) > 0
    has_any = len(report["forbidden_tables_present"]) > 0 or len(report["unexpected_tables"]) > 0

    if args.fail_on_non_empty and has_non_empty:
        print("[CP Guard] FAILED — Non-empty tenant operational data found in smritisys.\n", file=sys.stderr)
        sys.exit(1)

    if args.fail_on_violations and has_any:
        print("[CP Guard] FAILED — Boundary violations detected in smritisys.\n", file=sys.stderr)
        sys.exit(1)

    print("[CP Guard] Inspection complete.\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
