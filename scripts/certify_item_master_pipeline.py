"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.7
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Enterprise Operational Certification Runner:
SMRITI Item Master Multi-Phase Transformation Pipeline
"""

import sys
import os
import asyncio
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.db.session import get_company_sessionmaker
from sqlalchemy import text


async def run_pipeline_certification(db_name: str = "smriti001"):
    print("=" * 80)
    print("SMRITI ITEM MASTER MULTI-PHASE TRANSFORMATION PIPELINE CERTIFICATION")
    print(f"Target Database : {db_name}")
    print(f"Engine Version  : 6.70.7")
    print("=" * 80)

    session_factory = get_company_sessionmaker(db_name)
    failures = []

    async with session_factory() as session:
        # 1. Alembic Migration Head Certification
        print("\n[GATE 1] Alembic Migration Lineage Verification...")
        alembic_head = (await session.execute(text("SELECT version_num FROM alembic_version;"))).scalar()
        expected_head = "v1522_item_master_phase11_tracking_mode_harmonization"
        print(f"  Current DB Revision: {alembic_head}")
        if alembic_head == expected_head:
            print("  -> [PASS] Migration head matches canonical Phase 11/12 target.")
        else:
            failures.append(f"Alembic migration head is {alembic_head}, expected {expected_head}")
            print(f"  -> [FAIL] Expected {expected_head}")

        # 2. Multi-Tenant Scope Hardening Certification (Phase 8)
        print("\n[GATE 2] Multi-Tenant Scope Hardening (company_id NOT NULL)...")
        child_tables = [
            "item_variants",
            "item_barcodes",
            "item_batches",
            "item_serials",
            "item_warehouse_locations",
        ]
        for tbl in child_tables:
            null_cnt = (await session.execute(text(f"SELECT count(*) FROM {tbl} WHERE company_id IS NULL;"))).scalar()
            total_cnt = (await session.execute(text(f"SELECT count(*) FROM {tbl};"))).scalar()
            print(f"  {tbl:<28}: {total_cnt} total rows | {null_cnt} NULL company_id")
            if null_cnt > 0:
                failures.append(f"{tbl} contains {null_cnt} NULL company_id records")

        if not any("NULL company_id" in f for f in failures):
            print("  -> [PASS] 0 NULL company_id across all 5 child catalog tables.")

        # 3. Legacy Products Reconciliation Certification (Phase 7)
        print("\n[GATE 3] Legacy Products Bridge Reconciliation...")
        total_prods = (await session.execute(text("SELECT count(*) FROM products;"))).scalar()
        unlinked_active = (await session.execute(text(
            "SELECT count(*) FROM products WHERE item_id IS NULL AND is_active = TRUE AND is_deleted IS NOT TRUE;"
        ))).scalar()
        print(f"  Total Legacy Products      : {total_prods}")
        print(f"  Unlinked Active Products   : {unlinked_active}")
        if unlinked_active == 0:
            print("  -> [PASS] 100% of active legacy products linked to canonical Item Master.")
        else:
            failures.append(f"{unlinked_active} active legacy products remain unlinked")
            print(f"  -> [FAIL] {unlinked_active} unlinked active legacy products")

        # 4. Commercial Pricing & Price Book Coverage (Phase 9)
        print("\n[GATE 4] Commercial Pricing & Default Price Book Synchronization...")
        total_pbe = (await session.execute(text("SELECT count(*) FROM price_book_entries;"))).scalar()
        orphan_items = (await session.execute(text("""
            SELECT count(*) FROM items i
            WHERE i.is_active = TRUE AND i.is_deleted = FALSE AND NOT EXISTS (
                SELECT 1 FROM price_book_entries pbe
                WHERE pbe.item_id = i.id AND pbe.company_id = i.company_id
            );
        """))).scalar()
        print(f"  Total Price Book Entries   : {total_pbe}")
        print(f"  Orphan Items w/o PBE       : {orphan_items}")
        if orphan_items == 0:
            print("  -> [PASS] 100% of catalog items mapped to company price book entries.")
        else:
            failures.append(f"{orphan_items} items lack company price book entries")
            print(f"  -> [FAIL] {orphan_items} items lack company price book entries")

        # 5. Variant Attribute Deduplication Certification (Phase 10)
        print("\n[GATE 5] Variant-Level Attribute Deduplication & SSOT Alignment...")
        color_conflicts = (await session.execute(text("""
            SELECT count(*) FROM items i
            JOIN item_variants iv ON iv.item_id = i.id
            WHERE i.color IS NOT NULL AND iv.color IS NOT NULL AND LOWER(TRIM(i.color)) != LOWER(TRIM(iv.color));
        """))).scalar()
        size_conflicts = (await session.execute(text("""
            SELECT count(*) FROM items i
            JOIN item_variants iv ON iv.item_id = i.id
            WHERE i.size IS NOT NULL AND iv.size IS NOT NULL AND LOWER(TRIM(i.size)) != LOWER(TRIM(iv.size));
        """))).scalar()
        print(f"  Color Conflicts (Item vs Var): {color_conflicts}")
        print(f"  Size Conflicts (Item vs Var) : {size_conflicts}")
        if color_conflicts == 0 and size_conflicts == 0:
            print("  -> [PASS] 0 attribute conflicts between items and variants.")
        else:
            failures.append(f"Attribute conflicts detected: {color_conflicts} color, {size_conflicts} size")
            print("  -> [FAIL] Conflicts present")

        # 6. Physical Tracking Mode & DB Check Constraints (Phase 11)
        print("\n[GATE 6] Physical Tracking Modes & Database Constraint Enactment...")
        dual_tracking = (await session.execute(text(
            "SELECT count(*) FROM items WHERE is_batch_tracked = TRUE AND is_serial_tracked = TRUE;"
        ))).scalar()
        tracking_divergence = (await session.execute(text("""
            SELECT count(*) FROM items
            WHERE (is_batch_tracked = TRUE AND (tracking_mode != 'BATCH' OR tracking_type != 'BATCH'))
               OR (is_serial_tracked = TRUE AND (tracking_mode != 'SERIAL' OR tracking_type != 'SERIAL'))
               OR (is_batch_tracked = FALSE AND is_serial_tracked = FALSE AND (tracking_mode != 'NONE' OR tracking_type != 'NONE'));
        """))).scalar()
        constraints = (await session.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'items' AND constraint_type = 'CHECK'
            ORDER BY constraint_name;
        """))).scalars().all()

        has_chk_dual = any("chk_no_dual_tracking" in c.lower() for c in constraints)
        has_chk_flags = any("chk_tracking_mode_matches_flags" in c.lower() for c in constraints)

        print(f"  Dual-Tracking Violations     : {dual_tracking}")
        print(f"  Tracking Mode Discrepancies  : {tracking_divergence}")
        print(f"  chk_no_dual_tracking         : {'ENFORCED' if has_chk_dual else 'MISSING'}")
        print(f"  chk_tracking_mode_matches    : {'ENFORCED' if has_chk_flags else 'MISSING'}")

        if dual_tracking == 0 and tracking_divergence == 0 and has_chk_dual and has_chk_flags:
            print("  -> [PASS] Physical tracking fully harmonized and DB constraints active.")
        else:
            failures.append("Tracking integrity check failed")
            print("  -> [FAIL] Tracking integrity check failed")

    print("\n" + "=" * 80)
    if not failures:
        print(">>> ALL 6 TRANSFORMATION QUALITY GATES PASSED! <<<")
        print(">>> SMRITI ITEM MASTER CERTIFIED FOR PRODUCTION READINESS <<<")
    else:
        print(f">>> CERTIFICATION FAILED WITH {len(failures)} DEFECTS <<<")
        for f in failures:
            print(f"  - {f}")
    print("=" * 80)
    return len(failures) == 0


def main():
    success = asyncio.run(run_pipeline_certification())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
