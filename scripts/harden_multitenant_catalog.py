"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.3
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

CLI Tool: Multi-Tenant Catalog Hardening & Review Triage
Usage:
    python scripts/harden_multitenant_catalog.py --dry-run
    python scripts/harden_multitenant_catalog.py --execute
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
from app.services.item.item_review_triage_svc import ItemReviewTriageService
from app.models.item_master import Item
from sqlalchemy import select, func, text


async def run_hardening(is_dry_run: bool, db_name: str = "smriti001"):
    print("=" * 70)
    print(f"SMRITI MULTI-TENANT CATALOG HARDENING ENGINE v6.70.3")
    print(f"Target Database: {db_name}")
    print(f"Mode: {'DRY RUN (READ-ONLY, ZERO DML)' if is_dry_run else 'EXECUTE (LIVE TRANSACTIONAL MIGRATION)'}")
    print("=" * 70)

    session_factory = get_company_sessionmaker(db_name)
    async with session_factory() as session:
        # 1. Inspect initial NULL company_id counts
        tables = [
            'item_variants', 'item_barcodes', 'item_batches',
            'item_serials', 'item_warehouse_locations'
        ]
        null_counts = {}
        total_counts = {}
        for t in tables:
            nc = (await session.execute(text(f"SELECT count(*) FROM {t} WHERE company_id IS NULL;"))).scalar()
            tc = (await session.execute(text(f"SELECT count(*) FROM {t};"))).scalar()
            null_counts[t] = nc
            total_counts[t] = tc
            print(f"  {t:25}: {nc} null / {tc} total")

        # 2. Inspect review status distribution
        review_total = (await session.execute(
            select(func.count()).select_from(Item).where(Item.status == 'REQUIRES_REVIEW')
        )).scalar()
        active_total = (await session.execute(
            select(func.count()).select_from(Item).where(Item.status == 'ACTIVE')
        )).scalar()

        print("-" * 70)
        print(f"  Items in REQUIRES_REVIEW : {review_total}")
        print(f"  Items in ACTIVE          : {active_total}")
        print("-" * 70)

        total_orphaned = sum(null_counts.values())

        if is_dry_run:
            print(f"\nDRY RUN: Found {total_orphaned} orphaned child records requiring company_id backfill.")
            print(f"DRY RUN: Found {review_total} items in REQUIRES_REVIEW requiring triage.")
            
            # Sample triage candidates
            sample_unassigned = (await session.execute(
                select(Item.id, Item.item_code, Item.item_name, Item.category)
                .where(Item.status == 'REQUIRES_REVIEW', Item.item_code.like('ITM-UNASSIGNED-%'))
                .limit(5)
            )).fetchall()
            print("\nSample Unassigned Items to be Activated:")
            for r in sample_unassigned:
                print(f"  [{r[1]}] {r[2]} (Category: {r[3]}) -> Will set primary_uom & status='ACTIVE'")

            sample_quar = (await session.execute(
                select(Item.id, Item.item_code, Item.item_name)
                .where(Item.status == 'REQUIRES_REVIEW', Item.item_code.like('QUAR-%'))
                .limit(5)
            )).fetchall()
            print("\nSample Quarantined Items to be Preserved in Quarantine:")
            for r in sample_quar:
                print(f"  [{r[1]}] {r[2]} -> Preserved as REQUIRES_REVIEW")

            print("\nRun with --execute to perform transactional backfill and triage.")
            return

        # LIVE EXECUTION
        print("\n[STEP 1/2] Backfilling company_id across all 5 child tables...")
        backfill_res = await ItemReviewTriageService.backfill_child_company_ids(session=session, auto_commit=False)
        for tbl, count in backfill_res.items():
            if tbl != "total_backfilled":
                print(f"  - {tbl}: {count} rows updated")

        print("\n[STEP 2/2] Triaging REQUIRES_REVIEW catalog items...")
        triage_res = await ItemReviewTriageService.triage_requires_review_items(session=session, auto_commit=False)
        print(f"  - Total items evaluated : {triage_res['total_evaluated']}")
        print(f"  - Activated items        : {triage_res['activated']}")
        print(f"  - Preserved quarantine   : {triage_res['preserved_quarantine']}")

        await session.commit()
        print("\n[SUCCESS] Transaction committed successfully!")
        print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Multi-tenant catalog hardening and review triage.")
    parser.add_argument("--execute", action="store_true", help="Execute live migration (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Force dry run (read-only)")

    args = parser.parse_args()
    is_dry_run = not args.execute or args.dry_run

    asyncio.run(run_hardening(is_dry_run=is_dry_run))


if __name__ == "__main__":
    main()
