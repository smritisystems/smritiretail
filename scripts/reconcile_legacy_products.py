"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.2
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

CLI Tool: Reconcile Legacy Products & Backfill Transaction Lines
Usage:
    python scripts/reconcile_legacy_products.py --dry-run
    python scripts/reconcile_legacy_products.py --execute
    python scripts/reconcile_legacy_products.py --execute --limit 100
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
from app.services.item.legacy_reconciliation_svc import LegacyProductReconciliationService
from app.models.inventory import Product
from sqlalchemy import select, func, text


async def run_reconciliation(is_dry_run: bool, limit: int = None, batch_size: int = 100, db_name: str = "smriti001"):
    print("=" * 70)
    print(f"SMRITI LEGACY PRODUCT RECONCILIATION ENGINE v6.70.2")
    print(f"Target Database: {db_name}")
    print(f"Mode: {'DRY RUN (READ-ONLY, ZERO DML)' if is_dry_run else 'EXECUTE (LIVE TRANSACTIONAL MIGRATION)'}")
    print("=" * 70)

    session_factory = get_company_sessionmaker(db_name)
    async with session_factory() as session:
        # 1. Inspect initial counts
        total_p = (await session.execute(select(func.count()).select_from(Product))).scalar()
        unlinked_p = (await session.execute(
            select(func.count()).select_from(Product).where(Product.item_id.is_(None), Product.is_deleted.isnot(True), Product.is_active.isnot(False))
        )).scalar()
        linked_p = (await session.execute(
            select(func.count()).select_from(Product).where(Product.item_id.is_not(None))
        )).scalar()

        print(f"Total Products in database     : {total_p}")
        print(f"Already Linked Products        : {linked_p}")
        print(f"Unlinked Active Products       : {unlinked_p}")

        # Check transactions needing backfill
        sii_unlinked = (await session.execute(text(
            "SELECT count(*) FROM sales_invoice_items WHERE item_id IS NULL;"
        ))).scalar()
        sm_unlinked = (await session.execute(text(
            "SELECT count(*) FROM stock_movements WHERE item_id IS NULL;"
        ))).scalar()
        pri_unlinked = (await session.execute(text(
            "SELECT count(*) FROM purchase_receipt_items WHERE item_id IS NULL;"
        ))).scalar()

        print(f"Sales Lines with item_id=NULL  : {sii_unlinked}")
        print(f"Stock Movements item_id=NULL   : {sm_unlinked}")
        print(f"Purchase Lines with item_id=NULL: {pri_unlinked}")
        print("-" * 70)

        if unlinked_p == 0:
            print("All active products are already linked to Item Master! Nothing to reconcile.")
            return

        if is_dry_run:
            q = select(Product).where(Product.item_id.is_(None), Product.is_deleted.isnot(True), Product.is_active.isnot(False)).order_by(Product.id)
            if limit:
                q = q.limit(limit)
            sample = (await session.execute(q.limit(10))).scalars().all()
            print(f"DRY RUN: Evaluated {unlinked_p} products. Sample candidate transformations:")
            for p in sample:
                cid = p.company_id or "COMP-001"
                bid = p.barcode or p.sku or p.code
                print(f"  [Product {p.id}] Code: {p.code} | Style: {p.style_code} | Barcode: {bid} | Tenant: {cid}")
            print("\nRun with --execute to perform transactional reconciliation.")
            return

        # LIVE EXECUTION
        print(f"Starting reconciliation of unlinked products (batch_size={batch_size})...")
        res = await LegacyProductReconciliationService.reconcile_all_unlinked_products(
            session=session,
            limit=limit,
            batch_size=batch_size,
            auto_commit=True,
        )

        print("\n" + "=" * 70)
        print("RECONCILIATION SUMMARY:")
        print(f"  Products processed : {res['reconciled_products']} / {res['total_found']}")
        print(f"  Transactions Backfilled:")
        for tbl, count in res["transactions_backfilled"].items():
            print(f"    - {tbl}: {count} rows updated")
        print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Reconcile legacy products into canonical Item Master.")
    parser.add_argument("--execute", action="store_true", help="Execute live migration (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Force dry run (read-only)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of products to process")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for commits")

    args = parser.parse_args()
    is_dry_run = not args.execute or args.dry_run

    asyncio.run(run_reconciliation(is_dry_run=is_dry_run, limit=args.limit, batch_size=args.batch_size))


if __name__ == "__main__":
    main()
