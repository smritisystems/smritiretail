"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import argparse
import json
import os
import sys
from dataclasses import asdict

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Ensure required environment variables for crypto/auth
os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "dev-test-sgip-vault-master-key-32-chars")

from app.db.fleet_migrator import FleetMigrator, format_report_table


def main():
    parser = argparse.ArgumentParser(
        description="SMRITI Controlled & Auditable Multi-Tenant Fleet Migration CLI"
    )
    parser.add_argument(
        "--check",
        "--dry-run",
        action="store_true",
        dest="dry_run",
        help="Perform read-only registry inspection and parity check without executing migrations.",
    )
    parser.add_argument(
        "--fleet",
        action="store_true",
        help="Migrate all physically existing, READY company databases across the fleet.",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        help="Target a specific company database (e.g. smriti001).",
    )
    parser.add_argument(
        "--company",
        type=str,
        default=None,
        help="Target a specific company ID (e.g. COMP-001).",
    )
    parser.add_argument(
        "--target-rev",
        type=str,
        default="head",
        help="Target Alembic revision (defaults to 'head').",
    )
    parser.add_argument(
        "--json-output",
        type=str,
        default=None,
        help="Path to write structured JSON migration results.",
    )

    args = parser.parse_args()

    if not args.fleet and not args.db and not args.company and not args.dry_run:
        parser.error("Specify --fleet, --db, --company, or --check / --dry-run.")

    migrator = FleetMigrator(
        target_revision=args.target_rev,
        dry_run=args.dry_run,
    )

    print("================================================================================")
    print("SMRITI MULTI-TENANT FLEET MIGRATION RUNNER")
    print("================================================================================")
    mode_str = "INSPECTION / DRY-RUN" if args.dry_run else "EXECUTE UPGRADE"
    print(f"Mode            : {mode_str}")
    print(f"Target Revision : {args.target_rev}")
    if args.db:
        print(f"Target DB       : {args.db}")
    if args.company:
        print(f"Target Company  : {args.company}")
    print("--------------------------------------------------------------------------------")

    results = migrator.run_fleet(
        specific_db=args.db,
        specific_company=args.company,
    )

    print(format_report_table(results))
    print("--------------------------------------------------------------------------------")

    succeeded = sum(1 for r in results if r.status in ("SUCCESS", "ALREADY_UP_TO_DATE"))
    skipped = sum(1 for r in results if r.status.startswith("SKIPPED"))
    failed = sum(1 for r in results if r.status in ("FAILED", "LOCK_FAILED"))

    print(f"Summary: Total: {len(results)} | Succeeded/Up-to-Date: {succeeded} | Skipped: {skipped} | Failed: {failed}")

    if args.json_output:
        with open(args.json_output, "w", encoding="utf-8") as f:
            json.dump([asdict(r) for r in results], f, indent=2)
        print(f"Results written to: {args.json_output}")

    if failed > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
