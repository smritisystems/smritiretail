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
#  Classification: Unified SMRITI CLI Fleet Migration Command

import argparse
import os
import sys
from dataclasses import asdict
from typing import Dict, Any

from app.cli.utils import confirm_action, output_result


def register_subparser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "fleet",
        help="Execute controlled, auditable multi-tenant database fleet migrations.",
        description="Inspects and applies Alembic migrations across control plane and tenant databases with advisory locks."
    )
    parser.add_argument(
        "--check",
        "--dry-run",
        action="store_true",
        dest="dry_run",
        help="Perform read-only registry inspection and parity check without executing migrations."
    )
    parser.add_argument(
        "--fleet",
        action="store_true",
        dest="run_fleet",
        help="Migrate all physically existing, READY company databases across the fleet."
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        help="Target a specific company database (e.g. smriti001)."
    )
    parser.add_argument(
        "--company",
        type=str,
        default=None,
        help="Target a specific company ID (e.g. COMP-001)."
    )
    parser.add_argument(
        "--yes",
        "-y",
        action="store_true",
        dest="force_yes",
        help="Bypass interactive confirmation prompt."
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )
    parser.set_defaults(func=run_fleet_cmd)


def run_fleet_cmd(args: argparse.Namespace) -> int:
    # Ensure required environment variables for crypto/auth
    os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
    os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
    os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "dev-test-sgip-vault-master-key-32-chars")

    try:
        from app.db.fleet_migrator import FleetMigrator, format_report_table
    except Exception as exc:
        print(f"Error importing FleetMigrator: {exc}", file=sys.stderr)
        return 1

    dry_run = args.dry_run
    if not dry_run and not (args.run_fleet or args.db or args.company):
        # Default to dry-run check if no mutation target specified
        dry_run = True

    # Safety confirmation on live execution
    if not dry_run:
        target_desc = f"database '{args.db}'" if args.db else f"company '{args.company}'" if args.company else "ENTIRE FLEET"
        if not confirm_action(f"Are you sure you want to execute migrations on {target_desc}?", force=args.force_yes):
            return 1

    migrator = FleetMigrator(dry_run=dry_run)
    try:
        results = migrator.run_fleet(
            specific_db=args.db,
            specific_company=args.company,
        )
    except Exception as exc:
        print(f"Fleet migration encountered error: {exc}", file=sys.stderr)
        return 1

    results_data = [asdict(r) for r in results]
    success_count = sum(1 for r in results if r.status in ("SUCCESS", "ALREADY_UP_TO_DATE", "SKIPPED_DRY_RUN"))
    failure_count = sum(1 for r in results if r.status in ("FAILED", "LOCK_FAILED"))

    payload = {
        "status": "PASS" if failure_count == 0 else "FAIL",
        "dry_run": dry_run,
        "total_targets": len(results),
        "success_count": success_count,
        "failure_count": failure_count,
        "results": results_data,
    }

    def text_formatter(r: Any) -> None:
        print(format_report_table(results))

    output_result(payload, as_json=args.as_json, text_formatter=text_formatter)
    return 0 if failure_count == 0 else 1
