"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.6
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

CLI Tool: Inventory Tracking Mode Harmonization & Database Integrity Audit
Usage:
    python scripts/harmonize_tracking_modes.py --dry-run
    python scripts/harmonize_tracking_modes.py --execute
"""

import sys
import os
import asyncio
import argparse
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.db.session import get_company_sessionmaker
from app.services.item.item_tracking_sync_svc import ItemTrackingSyncService
from sqlalchemy import text


async def run_audit_and_sync(is_dry_run: bool, company_id: str = None, db_name: str = "smriti001"):
    print("=" * 75)
    print("SMRITI INVENTORY TRACKING HARMONIZATION ENGINE v6.70.6")
    print(f"Target Database: {db_name}")
    print(f"Company Scope  : {company_id or 'ALL COMPANIES'}")
    print(f"Mode           : {'DRY RUN (READ-ONLY, ZERO DML)' if is_dry_run else 'EXECUTE (LIVE TRANSACTION)'}")
    print("=" * 75)

    session_factory = get_company_sessionmaker(db_name)
    async with session_factory() as session:
        comp_clause = f"WHERE company_id = '{company_id}'" if company_id else ""
        total_items = (await session.execute(text(f"SELECT count(*) FROM items {comp_clause};"))).scalar()

        # Check dual tracking (both flags True)
        dual_clause = f"AND company_id = '{company_id}'" if company_id else ""
        dual_tracked = (await session.execute(text(
            f"SELECT count(*) FROM items WHERE is_batch_tracked = TRUE AND is_serial_tracked = TRUE {dual_clause};"
        ))).scalar()

        # Check tracking divergence
        div_clause = f"AND company_id = '{company_id}'" if company_id else ""
        divergence_cnt = (await session.execute(text(f"""
            SELECT count(*) FROM items
            WHERE (is_batch_tracked = TRUE AND (tracking_mode != 'BATCH' OR tracking_type != 'BATCH'))
               OR (is_serial_tracked = TRUE AND (tracking_mode != 'SERIAL' OR tracking_type != 'SERIAL'))
               OR (is_batch_tracked = FALSE AND is_serial_tracked = FALSE AND (tracking_mode != 'NONE' OR tracking_type != 'NONE'))
               {div_clause};
        """))).scalar()

        # Distributions
        batch_cnt = (await session.execute(text(
            f"SELECT count(*) FROM items WHERE is_batch_tracked = TRUE {dual_clause};"
        ))).scalar()
        serial_cnt = (await session.execute(text(
            f"SELECT count(*) FROM items WHERE is_serial_tracked = TRUE {dual_clause};"
        ))).scalar()
        none_cnt = (await session.execute(text(
            f"SELECT count(*) FROM items WHERE is_batch_tracked = FALSE AND is_serial_tracked = FALSE {dual_clause};"
        ))).scalar()

        print(f"Catalog Total Items         : {total_items}")
        print(f"Batch Tracked Items         : {batch_cnt}")
        print(f"Serial Tracked Items        : {serial_cnt}")
        print(f"Standard (None) Items       : {none_cnt}")
        print(f"Dual Tracked Violations     : {dual_tracked}")
        print(f"Tracking Discrepancies      : {divergence_cnt}")
        print("-" * 75)

        # Check DB constraints in information_schema
        constraints = (await session.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'items' AND constraint_type = 'CHECK'
            ORDER BY constraint_name;
        """))).scalars().all()
        print("Active Check Constraints on 'items':")
        for c in constraints:
            if "tracking" in c.lower():
                print(f"  [ENFORCED] {c}")

        print("-" * 75)

        if is_dry_run:
            print("\nDRY RUN AUDIT COMPLETED.")
            print(f"- Discrepancies to harmonize : {divergence_cnt}")
            print(f"- Dual tracking violations   : {dual_tracked}")
            print("\nRun with --execute to perform live transactional synchronization.")
            return

        print("\nExecuting transactional tracking mode harmonization...")
        res = await ItemTrackingSyncService.harmonize_tracking_modes(
            session=session, company_id=company_id, auto_commit=True
        )
        print(f"  - Batch items harmonized   : {res['batch_items_harmonized']}")
        print(f"  - Serial items harmonized  : {res['serial_items_harmonized']}")
        print(f"  - Dual conflicts resolved  : {res['dual_conflicts_resolved']}")
        print(f"  - Non-tracked items aligned: {res['none_items_aligned']}")
        print(f"  - Total items processed    : {res['total_items_processed']}")

        print("\n[SUCCESS] Transaction committed successfully to database!")
        print("=" * 75)


def main():
    parser = argparse.ArgumentParser(description="Harmonize item inventory tracking modes.")
    parser.add_argument("--execute", action="store_true", help="Execute live harmonization (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run inspection")
    parser.add_argument("--company", type=str, default=None, help="Optional company_id filter")

    args = parser.parse_args()
    is_dry_run = not args.execute or args.dry_run

    asyncio.run(run_audit_and_sync(is_dry_run=is_dry_run, company_id=args.company))


if __name__ == "__main__":
    main()
