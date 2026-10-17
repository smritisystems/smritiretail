#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-17
#  Modified     : 2026-10-17
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Database Command

import argparse
import sys
from typing import Dict, Any, List

from app.cli.utils import output_result


def register_subparser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "db",
        help="Database administration, control plane guard, and topology inspection.",
        description="Inspects database schemas, runs TDB-v2.0 positive ownership verification, and checks table statistics."
    )
    db_sub = parser.add_subparsers(dest="db_action", required=True)

    # guard sub-action
    guard_parser = db_sub.add_parser(
        "guard",
        help="Run TDB-v2.0 control plane isolation guard (cp_guard)."
    )
    guard_parser.add_argument(
        "--fail-on-non-empty",
        action="store_true",
        help="Exit with error code 1 if any tenant table in smritisys contains non-zero rows."
    )
    guard_parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )

    # stats sub-action
    stats_parser = db_sub.add_parser(
        "stats",
        help="Inspect physical database connectivity and summary statistics."
    )
    stats_parser.add_argument(
        "--db",
        default="smriti001",
        help="Target database name (default: smriti001)"
    )
    stats_parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )

    parser.set_defaults(func=run_db_cmd)


def run_db_guard(args: argparse.Namespace) -> int:
    try:
        from app.db.cp_guard import inspect_control_plane
        result = inspect_control_plane()
    except Exception as exc:
        print(f"Error running control plane guard: {exc}", file=sys.stderr)
        return 1

    as_json = getattr(args, "as_json", False)
    fail_on_non_empty = getattr(args, "fail_on_non_empty", False)

    # Count violations from report dict
    all_existing = result.get("all_existing_tables", [])
    non_empty = dict(result.get("non_empty_violations", []))
    unexpected = result.get("unexpected_tables", [])
    empty_violations = result.get("empty_violations", [])
    templates = dict(result.get("template_tables_present", []))

    non_empty_count = len(non_empty)
    undeclared_count = len(unexpected)
    empty_count = len(empty_violations)

    data = {
        "status": "PASS" if (undeclared_count == 0 and (not fail_on_non_empty or non_empty_count == 0)) else "VIOLATIONS_DETECTED",
        "database": "smritisys",
        "total_tables": len(all_existing),
        "undeclared_tables": unexpected,
        "non_empty_tenant_tables": non_empty,
        "empty_tenant_tables_count": empty_count,
        "platform_template_tables": templates,
    }

    def format_text(d: Dict[str, Any]) -> None:
        print("========================================================================")
        print(" SMRITI Control Plane Isolation Guard (TDB-v2.0)")
        print("========================================================================")
        print(f" Database Checked           : {d['database']}")
        print(f" Total Physical Tables      : {d['total_tables']}")
        print(f" Undeclared Tables          : {len(d['undeclared_tables'])}")
        print(f" Non-Empty Tenant Tables    : {len(d['non_empty_tenant_tables'])}")
        print(f" Empty Tenant Tables (Debt) : {d['empty_tenant_tables_count']}")
        print("------------------------------------------------------------------------")
        if d["undeclared_tables"]:
            print(" [!] Undeclared Tables (Architecture Non-Compliance):")
            for t in d["undeclared_tables"]:
                print(f"     - {t}")
        else:
            print(" [OK] Zero undeclared tables. 100% positive table ownership declared.")

        if d["non_empty_tenant_tables"]:
            print(f" [!] Non-Empty Tenant Tables in {d['database']}:")
            for t, count in d["non_empty_tenant_tables"].items():
                print(f"     - {t:<35}: {count} rows")
        print("========================================================================")

    output_result(data, as_json=as_json, text_formatter=format_text)
    
    if undeclared_count > 0:
        return 1
    if fail_on_non_empty and non_empty_count > 0:
        return 1
    return 0


def run_db_stats(args: argparse.Namespace) -> int:
    import psycopg2
    from app.core.config import settings

    db_name = getattr(args, "db", "smriti001")
    as_json = getattr(args, "as_json", False)

    from urllib.parse import urlparse
    parsed = urlparse(settings.DATABASE_URL.replace("+asyncpg", ""))
    host = parsed.hostname or "localhost"
    port = parsed.port or 2781
    user = parsed.username or "postgres"
    password = parsed.password or "postgres"

    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=db_name,
        )
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
        total_tables = cur.fetchone()[0]

        # Top 10 largest tables by row estimate
        cur.execute("""
            SELECT relname, n_live_tup
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 10;
        """)
        top_tables = [{"table": r[0], "estimated_rows": r[1]} for r in cur.fetchall()]
        cur.close()
        conn.close()

        data = {
            "status": "PASS",
            "database": db_name,
            "total_public_tables": total_tables,
            "top_tables_by_rows": top_tables,
        }

        def format_text(d: Dict[str, Any]) -> None:
            print(f"Database: {d['database']} | Total Public Tables: {d['total_public_tables']}")
            print("Top Tables by Row Count:")
            for item in d["top_tables_by_rows"]:
                print(f"  - {item['table']:<30}: {item['estimated_rows']} rows")

        output_result(data, as_json=as_json, text_formatter=format_text)
        return 0
    except Exception as exc:
        err_data = {"status": "FAIL", "database": db_name, "error": str(exc)}
        output_result(err_data, as_json=as_json, text_formatter=lambda d: print(f"Error inspecting {db_name}: {exc}"))
        return 1


def run_db_cmd(args: argparse.Namespace) -> int:
    if args.db_action == "guard":
        return run_db_guard(args)
    elif args.db_action == "stats":
        return run_db_stats(args)
    else:
        print(f"Unknown action: {args.db_action}", file=sys.stderr)
        return 1
