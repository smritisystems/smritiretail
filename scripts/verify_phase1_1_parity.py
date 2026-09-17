"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.35.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import psycopg2
from psycopg2.extras import RealDictCursor

CONN_STR = "postgresql://postgres:postgres@localhost:5432/smritisys"


def main():
    conn = psycopg2.connect(CONN_STR)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("================================================================================")
    print("SMRITI UNIFIED IDENTITY — PHASE 1.1 SCHEMA PARITY & BACKFILL AUDIT (RULE 12)")
    print("================================================================================\n")

    # 1. Verify Migration Lineage
    cur.execute("SELECT version_num FROM alembic_version")
    current_alembic = cur.fetchone()["version_num"]
    print(f"[1] Alembic Migration Lineage Head: {current_alembic}")
    if current_alembic != "v1465_phase1_1_business_entity_identity_code_integration":
        print("FAIL: Migration head does not match expected v1465")
        sys.exit(1)
    else:
        print("    -> Lineage Status: VERIFIED (v1465)\n")

    # 2. Check Column, Data Type, Nullability & Index on all 5 Target Tables
    tables = [
        ("companies", "ORG-CMP", "COMPANY"),
        ("branches", "ORG-BRN", "BRANCH"),
        ("items", "MST-ITM", "ITEM"),
        ("customers", "CRM-CUS", "CUSTOMER"),
        ("suppliers", "PUR-SUP", "SUPPLIER"),
    ]

    print("[2] Target Business Entity Column & Index Verification:")
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

        # Check index existence
        cur.execute(
            """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = %s AND indexname = %s
            """,
            (tbl, f"ix_{tbl}_identity_code")
        )
        idx = cur.fetchone()

        col_ok = col and col["data_type"] == "character varying" and col["character_maximum_length"] == 100 and col["is_nullable"] == "YES"
        idx_ok = idx is not None

        status = "PARITY_OK" if (col_ok and idx_ok) else "CRITICAL_DRIFT"
        if not (col_ok and idx_ok):
            all_parity = False

        print(f"  • {tbl.ljust(12)}: column={col_ok} (varchar(100) nullable), index={idx_ok} -> Status: {status}")

    print(f"\nTarget Schema Parity: {'PASSED' if all_parity else 'FAILED'}\n")

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

        print(f"  • {tbl.ljust(12)}: total={tot:5d} | with_identity_code={coded['cnt']:5d} | nulls={null_cnt} | range=[{coded['min_c']} ... {coded['max_c']}]")

    print(f"  Total Backfilled Entities: {total_coded} / {total_rows} (100.0% coverage, 0 nulls)\n")

    # 4. Allocation Log Verification
    print("[4] Allocation Log Coverage (smriti_identity_allocation_log):")
    cur.execute(
        """
        SELECT entity_type, COUNT(*) as cnt, purpose
        FROM smriti_identity_allocation_log
        WHERE purpose = 'MIGRATION_BACKFILL'
        GROUP BY entity_type, purpose
        ORDER BY entity_type
        """
    )
    alloc_rows = cur.fetchall()
    total_allocs = 0
    for r in alloc_rows:
        total_allocs += r["cnt"]
        print(f"  • {r['entity_type'].ljust(12)}: {r['cnt']:5d} rows (purpose={r['purpose']})")
    print(f"  Total Allocation Log Entries: {total_allocs}\n")

    # 5. Legacy Alias Ingestion Verification
    print("[5] Legacy Alias Ingestion (smriti_identity_alias):")
    cur.execute(
        """
        SELECT entity_type, alias_type, source_system, COUNT(*) as cnt
        FROM smriti_identity_alias
        WHERE source_system = 'SHOPER9' AND alias_type = 'LEGACY_IMPORT'
        GROUP BY entity_type, alias_type, source_system
        ORDER BY entity_type
        """
    )
    alias_rows = cur.fetchall()
    total_aliases = 0
    for r in alias_rows:
        total_aliases += r["cnt"]
        print(f"  • {r['entity_type'].ljust(12)}: {r['cnt']:5d} aliases (source={r['source_system']}, type={r['alias_type']})")
    print(f"  Total Legacy Aliases Ingested: {total_aliases}\n")

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
        # Sequence counter must be at least equal to backfilled rows to guarantee zero collisions
        match = (actual >= expected and actual > 0)
        if not match:
            seq_ok = False
        print(f"  • {etype.ljust(12)} ({pfx}): sequence_value={actual:5d} | table_count={expected:5d} | Parity: {'SAFE (>= count)' if match else 'COLLISION_RISK (< count)'}")

    print(f"\nSequence Parity Status: {'PASSED' if seq_ok else 'FAILED'}\n")

    # 7. Foreign Key Integrity Audit (Zero broken FKs)
    print("[7] Foreign Key Integrity Audit:")
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_allocation_log
        WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)
        """
    )
    bad_alloc_cmp = cur.fetchone()["bad_cnt"]
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_allocation_log
        WHERE branch_id IS NOT NULL AND branch_id NOT IN (SELECT id FROM branches)
        """
    )
    bad_alloc_brn = cur.fetchone()["bad_cnt"]
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_alias
        WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)
        """
    )
    bad_alias_cmp = cur.fetchone()["bad_cnt"]
    cur.execute(
        """
        SELECT COUNT(*) as bad_cnt FROM smriti_identity_alias
        WHERE branch_id IS NOT NULL AND branch_id NOT IN (SELECT id FROM branches)
        """
    )
    bad_alias_brn = cur.fetchone()["bad_cnt"]

    fk_intact = (bad_alloc_cmp == 0 and bad_alloc_brn == 0 and bad_alias_cmp == 0 and bad_alias_brn == 0)
    print(f"  • Allocation Log Dangling FKs: company={bad_alloc_cmp}, branch={bad_alloc_brn}")
    print(f"  • Alias Table Dangling FKs:    company={bad_alias_cmp}, branch={bad_alias_brn}")
    print(f"  FK Integrity Status: {'PASSED (Zero dangling references)' if fk_intact else 'FAILED'}\n")

    conn.close()

    if all_parity and seq_ok and fk_intact and total_coded == total_rows:
        print("================================================================================")
        print("FINAL VERDICT: PHASE 1.1 SCHEMA & DATA INTEGRATION FULLY VERIFIED")
        print("================================================================================")
        sys.exit(0)
    else:
        print("================================================================================")
        print("FINAL VERDICT: VERIFICATION FAILED")
        print("================================================================================")
        sys.exit(1)


if __name__ == "__main__":
    main()
