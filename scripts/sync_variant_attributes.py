"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.5
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

CLI Tool: Variant-Level Attribute Deduplication & SSOT Consolidation
Usage:
    python scripts/sync_variant_attributes.py --dry-run
    python scripts/sync_variant_attributes.py --execute
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
from app.services.item.item_attribute_sync_svc import ItemAttributeSyncService
from sqlalchemy import text


async def run_sync(is_dry_run: bool, company_id: str = None, db_name: str = "smriti001"):
    print("=" * 75)
    print("SMRITI VARIANT ATTRIBUTE DEDUPLICATION ENGINE v6.70.5")
    print(f"Target Database: {db_name}")
    print(f"Company Scope  : {company_id or 'ALL COMPANIES'}")
    print(f"Mode           : {'DRY RUN (READ-ONLY, ZERO DML)' if is_dry_run else 'EXECUTE (LIVE TRANSACTION)'}")
    print("=" * 75)

    session_factory = get_company_sessionmaker(db_name)
    async with session_factory() as session:
        # 1. Inspect current attribute status
        comp_clause_var = f"WHERE company_id = '{company_id}'" if company_id else ""
        comp_clause_item = f"WHERE company_id = '{company_id}'" if company_id else ""

        total_items = (await session.execute(text(f"SELECT count(*) FROM items {comp_clause_item};"))).scalar()
        total_variants = (await session.execute(text(f"SELECT count(*) FROM item_variants {comp_clause_var};"))).scalar()

        item_color_cnt = (await session.execute(text(
            f"SELECT count(*) FROM items WHERE color IS NOT NULL AND color != '' "
            + (f"AND company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        item_size_cnt = (await session.execute(text(
            f"SELECT count(*) FROM items WHERE size IS NOT NULL AND size != '' "
            + (f"AND company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        var_color_cnt = (await session.execute(text(
            f"SELECT count(*) FROM item_variants WHERE color IS NOT NULL AND color != '' "
            + (f"AND company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        var_size_cnt = (await session.execute(text(
            f"SELECT count(*) FROM item_variants WHERE size IS NOT NULL AND size != '' "
            + (f"AND company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        color_mismatches = (await session.execute(text(
            """
            SELECT count(*) 
            FROM item_variants iv
            JOIN items i ON iv.item_id = i.id
            WHERE iv.color IS NOT NULL AND iv.color != ''
              AND i.color IS NOT NULL AND i.color != ''
              AND LOWER(TRIM(iv.color)) != LOWER(TRIM(i.color))
            """ + (f" AND iv.company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        size_mismatches = (await session.execute(text(
            """
            SELECT count(*) 
            FROM item_variants iv
            JOIN items i ON iv.item_id = i.id
            WHERE iv.size IS NOT NULL AND iv.size != ''
              AND i.size IS NOT NULL AND i.size != ''
              AND LOWER(TRIM(iv.size)) != LOWER(TRIM(i.size))
            """ + (f" AND iv.company_id = '{company_id}'" if company_id else "")
        ))).scalar()

        print(f"Catalog Total Items         : {total_items}")
        print(f"Catalog Total Variants      : {total_variants}")
        print(f"Items with Color            : {item_color_cnt}")
        print(f"Items with Size             : {item_size_cnt}")
        print(f"Variants with Color         : {var_color_cnt} / {total_variants}")
        print(f"Variants with Size          : {var_size_cnt} / {total_variants}")
        print(f"Color Mismatches (Item/Var) : {color_mismatches}")
        print(f"Size Mismatches (Item/Var)  : {size_mismatches}")
        print("-" * 75)

        if is_dry_run:
            print("\nDRY RUN AUDIT COMPLETED.")
            print(f"- Items with style-level color/size to be retired : {item_color_cnt + item_size_cnt}")
            print(f"- Style-to-variant conflicts to be eliminated     : {color_mismatches + size_mismatches}")
            print("\nRun with --execute to perform live transactional synchronization.")
            return

        # EXECUTE MODE
        print("\n[STEP 1/3] Backfilling missing variant attributes from item styles...")
        inherit_res = await ItemAttributeSyncService.backfill_missing_variant_attributes(
            session=session, company_id=company_id, auto_commit=False
        )
        print(f"  - Variant color inherited : {inherit_res['variant_color_inherited']}")
        print(f"  - Variant size inherited  : {inherit_res['variant_size_inherited']}")

        print("\n[STEP 2/3] Parsing structured SKU and variant tokens for remaining blanks...")
        parse_res = await ItemAttributeSyncService.parse_structured_sku_attributes(
            session=session, company_id=company_id, auto_commit=False
        )
        print(f"  - Variant color parsed    : {parse_res['variant_color_parsed']}")
        print(f"  - Variant size parsed     : {parse_res['variant_size_parsed']}")

        print("\n[STEP 3/3] Deprecating and clearing style-level attributes on items...")
        retire_res = await ItemAttributeSyncService.retire_style_level_attributes(
            session=session, company_id=company_id, auto_commit=False
        )
        print(f"  - Style-level attributes cleared on {retire_res['style_attributes_retired']} items")

        await session.commit()
        print("\n[SUCCESS] Transaction committed successfully to database!")
        print("=" * 75)


def main():
    parser = argparse.ArgumentParser(description="Consolidate variant attributes and retire style-level fields.")
    parser.add_argument("--execute", action="store_true", help="Execute live deduplication (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run inspection")
    parser.add_argument("--company", type=str, default=None, help="Optional company_id filter")

    args = parser.parse_args()
    is_dry_run = not args.execute or args.dry_run

    asyncio.run(run_sync(is_dry_run=is_dry_run, company_id=args.company))


if __name__ == "__main__":
    main()
