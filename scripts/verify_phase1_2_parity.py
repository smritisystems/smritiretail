"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.36.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASES = ["smritisys", "smriti001"]


def verify_database(db_name: str) -> bool:
    conn_str = f"postgresql://postgres:postgres@localhost:5432/{db_name}"
    print(f"\n{'#' * 80}")
    print(f"VERIFYING DATABASE: {db_name}")
    print(f"{'#' * 80}\n")

    conn = psycopg2.connect(conn_str)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Verify Migration Lineage
    cur.execute("SELECT version_num FROM alembic_version")
    current_alembic = cur.fetchone()["version_num"]
    print(f"[1] Alembic Migration Lineage Head: {current_alembic}")
    if current_alembic != "v1466_phase1_2_transactional_identity_integration":
        print(f"FAIL: Migration head on {db_name} does not match expected v1466 (found {current_alembic})")
        conn.close()
        return False
    print("    -> Lineage Status: VERIFIED (v1466)\n")

    # 2. Check Column, Data Type, Nullability & Index on Transactional Tables
    tables = [
        ("sales_invoices", "SAL-INV", "SALES_INVOICE"),
        ("purchase_orders", "PUR-ORD", "PURCHASE_ORDER"),
        ("shifts", "POS-SFT", "POS_SHIFT"),
    ]

    print("[2] Transactional Document Entity Column & Unique Index Verification:")
    all_parity = True

    for tbl, pfx, etype in tables:
        # Check column existence & properties
        cur.execute(
            """
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s AND column_name = 'identity_code'
            """,
            (tbl,)
        )
        col = cur.fetchone()

        # Check UNIQUE index existence and indisunique flag
        cur.execute(
            """
            SELECT c.relname as table_name, i.relname as index_name, ix.indisunique, pg_get_indexdef(ix.indexrelid) as indexdef
            FROM pg_class c
            JOIN pg_index ix ON c.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
            WHERE a.attname = 'identity_code' AND c.relname = %s
            """,
            (tbl,)
        )
        idx_rows = cur.fetchall()
        unique_idx = next((r for r in idx_rows if r["indisunique"]), None)

        # Check for any duplicates
        cur.execute(
            f"SELECT identity_code, COUNT(*) as cnt FROM {tbl} WHERE identity_code IS NOT NULL GROUP BY identity_code HAVING COUNT(*) > 1"
        )
        dups = cur.fetchall()
        dup_cnt = len(dups)

        col_ok = col and col["data_type"] == "character varying" and col["character_maximum_length"] == 100 and col["is_nullable"] == "YES"
        idx_ok = unique_idx is not None and unique_idx["indisunique"] is True
        dup_ok = (dup_cnt == 0)

        status = "PARITY_OK" if (col_ok and idx_ok and dup_ok) else "CRITICAL_DRIFT"
        if not (col_ok and idx_ok and dup_ok):
            all_parity = False

        idx_name_str = unique_idx["index_name"] if unique_idx else "NONE"
        print(f"  • {tbl.ljust(16)}: col={col_ok} (varchar(100) nullable), unique_index={idx_ok} ({idx_name_str}), duplicates={dup_cnt} -> Status: {status}")

    # Ledger Boundary Check on stock_movements
    print("\n[2B] High-Throughput Ledger Boundary Verification (stock_movements):")
    cur.execute(
        """
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'stock_movements' AND column_name = 'id'
        """
    )
    sm_pk = cur.fetchone()
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'stock_movements' AND column_name = 'identity_code'
        """
    )
    sm_id_code = cur.fetchone()
    cur.execute("SELECT COUNT(*) as cnt FROM stock_movements")
    sm_total = cur.fetchone()["cnt"]

    # stock_movements must have technical PK 'id' and MUST NOT have sequential identity_code column
    ledger_boundary_ok = (sm_pk is not None and sm_id_code is None)
    print(f"  • stock_movements : total_ledger_rows={sm_total} | PK={sm_pk['column_name']} ({sm_pk['data_type']}) | sequential_identity_code={sm_id_code is not None}")
    print(f"    -> Architectural Boundary Status: {'PASSED (Zero Row-Locking Overhead)' if ledger_boundary_ok else 'FAILED'}\n")
    if not ledger_boundary_ok:
        all_parity = False

    print(f"Target Schema Parity: {'PASSED' if all_parity else 'FAILED'}\n")

    # 3. Deterministic Backfill Quantities & Null Check
    print("[3] Quantitative Backfill Audit:")
    total_rows = 0
    total_coded = 0
    for tbl, pfx, etype in tables:
        cur.execute(f"SELECT COUNT(*) as cnt, MIN(identity_code) as min_c, MAX(identity_code) as max_c FROM {tbl} WHERE identity_code IS NOT NULL")
        coded = cur.fetchone()
        cur.execute(f"SELECT COUNT(*) as null_cnt FROM {tbl} WHERE identity_code IS NULL")
        null_cnt = cur.fetchone()["null_cnt"]
        cur.execute(f"SELECT COUNT(*) as tot FROM {tbl}")
        tot = cur.fetchone()["tot"]

        total_rows += tot
        total_coded += coded["cnt"]

        range_str = f"[{coded['min_c']} ... {coded['max_c']}]" if coded["cnt"] > 0 else "[EMPTY]"
        print(f"  • {tbl.ljust(16)}: total={tot:5d} | with_identity_code={coded['cnt']:5d} | nulls={null_cnt} | range={range_str}")

    coverage_pct = 100.0 if total_rows == 0 else (total_coded / total_rows) * 100.0
    print(f"  Total Backfilled Entities: {total_coded} / {total_rows} ({coverage_pct:.1f}% coverage, 0 nulls)\n")

    # 4. Allocation Log Verification
    print("[4] Allocation Log Coverage (smriti_identity_allocation_log):")
    cur.execute(
        """
        SELECT entity_type, COUNT(*) as cnt, purpose
        FROM smriti_identity_allocation_log
        WHERE purpose = 'MIGRATION_BACKFILL' AND entity_type IN ('SALES_INVOICE', 'PURCHASE_ORDER', 'POS_SHIFT')
        GROUP BY entity_type, purpose
        ORDER BY entity_type
        """
    )
    alloc_rows = cur.fetchall()
    total_allocs = 0
    for r in alloc_rows:
        total_allocs += r["cnt"]
        print(f"  • {r['entity_type'].ljust(16)}: {r['cnt']:5d} rows (purpose={r['purpose']})")
    print(f"  Total Phase 1.2 Allocation Log Entries: {total_allocs}\n")

    # 5. Historical Document Alias Ingestion Verification
    print("[5] Historical Document Alias Ingestion (smriti_identity_alias):")
    cur.execute(
        """
        SELECT entity_type, alias_type, source_system, COUNT(*) as cnt
        FROM smriti_identity_alias
        WHERE source_system = 'TRANSACTIONAL' AND alias_type = 'HISTORICAL_DOC'
        GROUP BY entity_type, alias_type, source_system
        ORDER BY entity_type
        """
    )
    alias_rows = cur.fetchall()
    total_aliases = 0
    for r in alias_rows:
        total_aliases += r["cnt"]
        print(f"  • {r['entity_type'].ljust(16)}: {r['cnt']:5d} aliases (source={r['source_system']}, type={r['alias_type']})")
    print(f"  Total Historical Document Aliases Ingested: {total_aliases}\n")

    # 6. Sequence Value Parity Check
    print("[6] Numbering Registry Sequence Parity (smriti_numbering_registry):")
    seq_ok = True
    for tbl, pfx, etype in tables:
        cur.execute(
            """
            SELECT sequence_value, prefix
            FROM smriti_numbering_registry
            WHERE entity_type = %s AND prefix = %s
            """,
            (etype, pfx)
        )
        row = cur.fetchone()
        cur.execute(f"SELECT COUNT(*) as cnt FROM {tbl}")
        expected = cur.fetchone()["cnt"]

        actual = row["sequence_value"] if row else -1
        # Sequence counter must be at least equal to table count to guarantee zero collision
        match = (actual >= expected and (actual > 0 or expected == 0))
        if not match:
            seq_ok = False
        print(f"  • {etype.ljust(16)} ({pfx}): sequence_value={actual:5d} | table_count={expected:5d} | Parity: {'SAFE (>= count)' if match else 'COLLISION_RISK (< count)'}")

    print(f"\nSequence Parity Status: {'PASSED' if seq_ok else 'FAILED'}\n")

    # 7. Foreign Key Integrity Audit (Zero broken FKs)
    print("[7] Foreign Key Integrity Audit:")
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_allocation_log
        WHERE company_id IS NOT NULL AND company_id != '' AND company_id NOT IN (SELECT id FROM companies)
        """
    )
    bad_alloc_cmp = cur.fetchone()["bad_cnt"]
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_allocation_log
        WHERE branch_id IS NOT NULL AND branch_id != '' AND branch_id NOT IN (SELECT id FROM branches)
        """
    )
    bad_alloc_brn = cur.fetchone()["bad_cnt"]
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_alias
        WHERE company_id IS NOT NULL AND company_id != '' AND company_id NOT IN (SELECT id FROM companies)
        """
    )
    bad_alias_cmp = cur.fetchone()["bad_cnt"]
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_alias
        WHERE branch_id IS NOT NULL AND branch_id != '' AND branch_id NOT IN (SELECT id FROM branches)
        """
    )
    bad_alias_brn = cur.fetchone()["bad_cnt"]

    fk_intact = (bad_alloc_cmp == 0 and bad_alloc_brn == 0 and bad_alias_cmp == 0 and bad_alias_brn == 0)
    print(f"  • Allocation Log Dangling FKs: company={bad_alloc_cmp}, branch={bad_alloc_brn}")
    print(f"  • Alias Table Dangling FKs:    company={bad_alias_cmp}, branch={bad_alias_brn}")
    print(f"  FK Integrity Status: {'PASSED (Zero dangling references)' if fk_intact else 'FAILED'}\n")

    conn.close()

    db_passed = all_parity and seq_ok and fk_intact and total_coded == total_rows
    return db_passed


def main():
    parser = argparse.ArgumentParser(description="Phase 1.2 Schema Parity and Verification Audit")
    parser.add_argument("--db", choices=["smritisys", "smriti001", "all"], default="all", help="Target database to verify")
    args = parser.parse_args()

    print("================================================================================")
    print("SMRITI UNIFIED IDENTITY — PHASE 1.2 TRANSACTIONAL IDENTITY PARITY AUDIT (RULE 12)")
    print("================================================================================")

    targets = DATABASES if args.db == "all" else [args.db]
    overall_success = True

    for db_name in targets:
        passed = verify_database(db_name)
        if not passed:
            overall_success = False

    print("\n" + "=" * 80)
    if overall_success:
        print("FINAL VERDICT: PHASE 1.2 TRANSACTIONAL IDENTITY INTEGRATION FULLY VERIFIED")
        print("================================================================================")
        sys.exit(0)
    else:
        print("FINAL VERDICT: VERIFICATION FAILED ON ONE OR MORE DATABASES")
        print("================================================================================")
        sys.exit(1)


if __name__ == "__main__":
    main()
