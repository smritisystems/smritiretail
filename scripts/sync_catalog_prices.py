"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.4
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

CLI Tool: Catalog Pricing Discrepancy & Price Book Synchronization
Usage:
    python scripts/sync_catalog_prices.py --dry-run
    python scripts/sync_catalog_prices.py --execute
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
from app.services.item.item_pricing_sync_svc import ItemPricingSyncService
from sqlalchemy import text


async def run_sync(is_dry_run: bool, company_id: str = None, db_name: str = "smriti001"):
    print("=" * 75)
    print("SMRITI CATALOG PRICING SYNCHRONIZATION ENGINE v6.70.4")
    print(f"Target Database: {db_name}")
    print(f"Company Scope  : {company_id or 'ALL COMPANIES'}")
    print(f"Mode           : {'DRY RUN (READ-ONLY, ZERO DML)' if is_dry_run else 'EXECUTE (LIVE TRANSACTION)'}")
    print("=" * 75)

    session_factory = get_company_sessionmaker(db_name)
    async with session_factory() as session:
        # 1. Inspect current pricing status
        comp_clause_var = f"WHERE company_id = '{company_id}'" if company_id else ""
        comp_clause_item = f"WHERE company_id = '{company_id}'" if company_id else ""

        total_items = (await session.execute(text(f"SELECT count(*) FROM items {comp_clause_item};"))).scalar()
        total_variants = (await session.execute(text(f"SELECT count(*) FROM item_variants {comp_clause_var};"))).scalar()

        null_var_sp = (await session.execute(text(
            f"SELECT count(*) FROM item_variants WHERE (selling_price IS NULL OR selling_price = 0) "
            + (f"AND company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        null_item_sp = (await session.execute(text(
            f"SELECT count(*) FROM items WHERE (selling_price IS NULL OR selling_price = 0) "
            + (f"AND company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        sp_mismatch = (await session.execute(text(
            "SELECT count(*) FROM item_variants iv JOIN items i ON iv.item_id = i.id "
            "WHERE iv.selling_price IS DISTINCT FROM i.selling_price "
            + (f"AND iv.company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        mrp_mismatch = (await session.execute(text(
            "SELECT count(*) FROM item_variants iv JOIN items i ON iv.item_id = i.id "
            "WHERE iv.mrp IS DISTINCT FROM i.mrp "
            + (f"AND iv.company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        missing_pbe = (await session.execute(text(
            "SELECT count(*) FROM item_variants iv "
            "WHERE NOT EXISTS (SELECT 1 FROM price_book_entries pbe WHERE pbe.variant_id = iv.id) "
            + (f"AND iv.company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        total_ss = (await session.execute(text(
            f"SELECT count(*) FROM item_sales_settings {comp_clause_var};"
        ))).scalar()

        print(f"Catalog Total Items         : {total_items}")
        print(f"Catalog Total Variants      : {total_variants}")
        print(f"Variants with 0/NULL SP     : {null_var_sp}")
        print(f"Items with 0/NULL SP        : {null_item_sp}")
        print(f"Selling Price Discrepancies : {sp_mismatch}")
        print(f"MRP Discrepancies           : {mrp_mismatch}")
        print(f"Variants without PriceBook  : {missing_pbe}")
        print(f"Existing ItemSalesSettings  : {total_ss} / {total_variants}")
        print("-" * 75)

        if is_dry_run:
            print("\nDRY RUN AUDIT COMPLETED.")
            print(f"- Variants that can inherit price from parent item : {null_var_sp}")
            print(f"- Items that can inherit price from child variants  : {null_item_sp}")
            print(f"- Price Book entries to be synchronized             : {missing_pbe}")
            print(f"- ItemSalesSettings to be created/updated           : {total_variants - total_ss} missing")
            print("\nRun with --execute to perform live transactional synchronization.")
            return

        # EXECUTE MODE
        print("\n[STEP 1/3] Harmonizing catalog prices between items and variants...")
        harmonize_res = await ItemPricingSyncService.harmonize_catalog_prices(
            session=session, company_id=company_id, auto_commit=False
        )
        print(f"  - Variants inherited from parent items: {harmonize_res['variants_inherited_from_item']}")
        print(f"  - Items inherited from child variants  : {harmonize_res['items_inherited_from_variant']}")

        print("\n[STEP 2/3] Synchronizing default price book entries...")
        pbe_res = await ItemPricingSyncService.sync_default_price_book_entries(
            session=session, company_id=company_id, auto_commit=False
        )
        print(f"  - Price books ensured  : {pbe_res['price_books_ensured']}")
        print(f"  - PBE records created  : {pbe_res['entries_created']}")
        print(f"  - PBE records updated  : {pbe_res['entries_updated']}")

        print("\n[STEP 3/3] Synchronizing variant item_sales_settings...")
        ss_res = await ItemPricingSyncService.sync_item_sales_settings(
            session=session, company_id=company_id, auto_commit=False
        )
        print(f"  - Sales settings created: {ss_res['sales_settings_created']}")
        print(f"  - Sales settings updated: {ss_res['sales_settings_updated']}")

        await session.commit()
        print("\n[SUCCESS] Transaction committed successfully to database!")
        print("=" * 75)


def main():
    parser = argparse.ArgumentParser(description="Synchronize catalog prices and price book entries.")
    parser.add_argument("--execute", action="store_true", help="Execute live synchronization (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run inspection")
    parser.add_argument("--company", type=str, default=None, help="Optional company_id filter")

    args = parser.parse_args()
    is_dry_run = not args.execute or args.dry_run

    asyncio.run(run_sync(is_dry_run=is_dry_run, company_id=args.company))


if __name__ == "__main__":
    main()
