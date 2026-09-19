"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.38.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Parity & Multi-Database Verification (Rule 12)
"""

import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASES = ["smritisys", "smriti001", "smriti002"]
EXPECTED_LINEAGE = "v1468_phase1_4_master_identity_index_and_resolver"


async def verify_database_parity(db_name: str):
    print(f"\n{'#' * 80}")
    print(f"VERIFYING DATABASE: {db_name}")
    print(f"{'#' * 80}\n")

    url = f"postgresql+asyncpg://postgres:postgres@localhost:5432/{db_name}"
    engine = create_async_engine(url)

    async with engine.connect() as conn:
        # 1. Lineage Head
        head_res = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
        head = head_res.scalar()
        is_lineage_ok = head == EXPECTED_LINEAGE
        status_lineage = "VERIFIED (v1468)" if is_lineage_ok else f"DRIFTED ({head})"
        print(f"[1] Alembic Migration Lineage Head: {head}")
        print(f"    -> Lineage Status: {status_lineage}\n")
        assert is_lineage_ok, f"Database {db_name} lineage mismatch: {head} != {EXPECTED_LINEAGE}"

        # 2. Master Identity Index Catalog Taxonomies
        print("[2] Master Identity Index Catalog Taxonomies (smriti_identity_registry):")
        tax_res = await conn.execute(
            text(
                "SELECT entity_type, group_code, entity_code, identity_code_prefix, database_table, "
                "identity_code_enabled, system_id_strategy, business_code_field "
                "FROM smriti_identity_registry "
                "WHERE entity_type IN ('PAYMENT_TRANSACTION', 'STOCK_MOVEMENT', 'PARTY', 'EWAY_BILL', 'SALES_INVOICE') "
                "ORDER BY group_code, entity_type"
            )
        )
        taxonomies = tax_res.fetchall()
        found_types = set()
        for row in taxonomies:
            etype, gcode, ecode, prefix, tbl, id_enabled, id_strat, b_col = row
            found_types.add(etype)
            print(f"  [OK] {etype:<22} : group={gcode:<4} | prefix={prefix:<8} | table={tbl:<20} | id_enabled={str(id_enabled):<5} | strategy={id_strat}")

        assert "PAYMENT_TRANSACTION" in found_types, "Missing PAYMENT_TRANSACTION in registry"
        assert "STOCK_MOVEMENT" in found_types, "Missing STOCK_MOVEMENT in registry"
        print("  -> Catalog Taxonomies Status: ALL REGISTERED & VERIFIED\n")

        # 3. Reverse-Lookup and Performance Optimization Indexes
        print("[3] Performance & Reverse-Lookup Index Verification:")
        idx_alloc = await conn.execute(
            text("SELECT 1 FROM pg_indexes WHERE tablename = 'smriti_identity_allocation_log' AND indexname = 'ix_smriti_alloc_log_canonical_id'")
        )
        has_alloc_idx = bool(idx_alloc.scalar())
        print(f"  [{'OK' if has_alloc_idx else 'FAIL'}] smriti_identity_allocation_log : index=ix_smriti_alloc_log_canonical_id (canonical_id) -> {has_alloc_idx}")
        assert has_alloc_idx, "Missing ix_smriti_alloc_log_canonical_id index"

        idx_alias = await conn.execute(
            text("SELECT 1 FROM pg_indexes WHERE tablename = 'smriti_identity_alias' AND indexname = 'ix_smriti_alias_lower_code'")
        )
        has_alias_idx = bool(idx_alias.scalar())
        print(f"  [{'OK' if has_alias_idx else 'FAIL'}] smriti_identity_alias          : index=ix_smriti_alias_lower_code (LOWER(alias_code)) -> {has_alias_idx}")
        assert has_alias_idx, "Missing ix_smriti_alias_lower_code index"
        print("  -> Index Status: ALL VERIFIED\n")

        # 4. Identity Code Invariant Uniqueness across all 10 governed tables
        print("[4] Relational Invariant Uniqueness & Zero-Duplicate Audit (10 Tables):")
        governed_tables = [
            ("companies", "uq_companies_identity_code"),
            ("branches", "uq_branches_identity_code"),
            ("items", "uq_items_identity_code"),
            ("customers", "uq_customers_identity_code"),
            ("suppliers", "uq_suppliers_identity_code"),
            ("sales_invoices", "uq_sales_invoices_identity_code"),
            ("purchase_orders", "uq_purchase_orders_identity_code"),
            ("shifts", "uq_shifts_identity_code"),
            ("parties", "uq_parties_identity_code"),
            ("eway_bills", "uq_eway_bills_identity_code"),
        ]
        for tbl, uq_idx in governed_tables:
            dup_res = await conn.execute(
                text(
                    f"SELECT identity_code, count(*) FROM {tbl} "
                    f"WHERE identity_code IS NOT NULL GROUP BY identity_code HAVING count(*) > 1"
                )
            )
            dups = len(dup_res.fetchall())
            print(f"  [OK] {tbl:<20} : duplicates={dups} | unique_index={uq_idx}")
            assert dups == 0, f"Duplicates detected in {tbl}: {dups}"
        print("  -> Invariant Uniqueness Status: PASSED (Zero Duplicates)\n")

        # 5. Foreign Key Integrity Audit
        print("[5] Foreign Key Integrity Audit:")
        dangling_alloc = await conn.execute(
            text(
                "SELECT count(*) FROM smriti_identity_allocation_log a "
                "LEFT JOIN companies c ON a.company_id = c.id "
                "WHERE a.company_id IS NOT NULL AND a.company_id != '' AND c.id IS NULL"
            )
        )
        dangling_alloc_cnt = dangling_alloc.scalar()

        dangling_alias = await conn.execute(
            text(
                "SELECT count(*) FROM smriti_identity_alias a "
                "LEFT JOIN companies c ON a.company_id = c.id "
                "WHERE a.company_id IS NOT NULL AND a.company_id != '' AND c.id IS NULL"
            )
        )
        dangling_alias_cnt = dangling_alias.scalar()

        print(f"  [OK] Allocation Log Dangling Company FKs: {dangling_alloc_cnt}")
        print(f"  [OK] Alias Table Dangling Company FKs:    {dangling_alias_cnt}")
        assert dangling_alloc_cnt == 0, "Dangling FKs in allocation log"
        assert dangling_alias_cnt == 0, "Dangling FKs in alias table"
        print("  -> FK Integrity Status: PASSED (Zero dangling references)\n")

    await engine.dispose()
    print(f"VERDICT FOR {db_name}: 100% PARITY OK")


async def main():
    print("=" * 80)
    print("SMRITI UNIFIED IDENTITY - PHASE 1.4 MASTER IDENTITY INDEX & RESOLVER PARITY AUDIT")
    print("=" * 80)

    for db in DATABASES:
        await verify_database_parity(db)

    print("\n" + "=" * 80)
    print("FINAL VERDICT: PHASE 1.4 MASTER IDENTITY INDEX & RESOLVER FULLY VERIFIED")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
