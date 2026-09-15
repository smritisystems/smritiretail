"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-09-09
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Alembic Migration Engine Lifecycle Execution Verifier (Downgrade + Upgrade)
"""

import sys
import os
import subprocess
from pathlib import Path

# Configure UTF-8 encoding for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import psycopg2


def check_db_state(db_name: str = "smriti002"):
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor()
    cur.execute("SELECT version_num FROM alembic_version;")
    versions = [r[0] for r in cur.fetchall()]
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'customer_article_mappings'
        );
    """)
    table_exists = cur.fetchone()[0]
    cur.close()
    conn.close()
    return versions, table_exists


def run_alembic_lifecycle(db_name: str = "smriti002") -> bool:
    print("================================================================================")
    print(f"=== ALEMBIC MIGRATION ENGINE LIFECYCLE EXECUTION VERIFICATION: {db_name} ===")
    print("================================================================================")

    # Step 1: Verify Initial State
    versions, exists = check_db_state(db_name)
    print(f"\n[Step 1: Baseline State Before Downgrade]")
    print(f"  • Tracked Alembic Revisions: {versions}")
    print(f"  • Physical Table customer_article_mappings present: {exists}")
    assert "v1418_cust_art_map" in versions, "Baseline must be at head revision v1418_cust_art_map"
    assert exists is True, "Table customer_article_mappings must exist initially"

    # Step 2: Execute Alembic Downgrade (-1)
    print(f"\n[Step 2: Executing Alembic Downgrade (-1) via Alembic Engine]")
    cmd_down = [sys.executable, "-m", "alembic", "-x", f"db={db_name}", "downgrade", "-1"]
    res_down = subprocess.run(cmd_down, cwd=str(backend_dir), capture_output=True, text=True)
    print(f"  Command: {' '.join(cmd_down)}")
    print(f"  Return Code: {res_down.returncode}")
    print(f"  Stdout:\n{res_down.stdout.strip()}")
    if res_down.stderr.strip():
        print(f"  Stderr:\n{res_down.stderr.strip()}")
    assert res_down.returncode == 0, f"Alembic downgrade failed with code {res_down.returncode}"

    # Step 3: Verify Physical Table Dropped & Version Reverted
    versions_after_down, exists_after_down = check_db_state(db_name)
    print(f"\n[Step 3: Verifying Database State Post-Downgrade]")
    print(f"  • Tracked Alembic Revisions: {versions_after_down}")
    print(f"  • Physical Table customer_article_mappings present: {exists_after_down}")
    assert "v1417_so_po_compat" in versions_after_down, "Expected version v1417_so_po_compat post-downgrade"
    assert "v1418_cust_art_map" not in versions_after_down, "v1418_cust_art_map must not be present"
    assert exists_after_down is False, "Alembic downgrade must physically DROP customer_article_mappings table"
    print("  ✅ Proved: Alembic engine physically executed downgrade and dropped table.")

    # Step 4: Execute Alembic Upgrade (head)
    print(f"\n[Step 4: Executing Alembic Upgrade (head) via Alembic Engine]")
    cmd_up = [sys.executable, "-m", "alembic", "-x", f"db={db_name}", "upgrade", "head"]
    res_up = subprocess.run(cmd_up, cwd=str(backend_dir), capture_output=True, text=True)
    print(f"  Command: {' '.join(cmd_up)}")
    print(f"  Return Code: {res_up.returncode}")
    print(f"  Stdout:\n{res_up.stdout.strip()}")
    if res_up.stderr.strip():
        print(f"  Stderr:\n{res_up.stderr.strip()}")
    assert res_up.returncode == 0, f"Alembic upgrade failed with code {res_up.returncode}"

    # Step 5: Verify Physical Table Re-created & Version Advanced
    versions_after_up, exists_after_up = check_db_state(db_name)
    print(f"\n[Step 5: Verifying Database State Post-Upgrade]")
    print(f"  • Tracked Alembic Revisions: {versions_after_up}")
    print(f"  • Physical Table customer_article_mappings present: {exists_after_up}")
    assert "v1418_cust_art_map" in versions_after_up, "Expected version v1418_cust_art_map post-upgrade"
    assert exists_after_up is True, "Alembic upgrade must physically CREATE customer_article_mappings table"
    print("  ✅ Proved: Alembic engine physically executed upgrade and created table.")

    # Step 6: Verify Column Count and Constraints
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM information_schema.columns WHERE table_name = 'customer_article_mappings';")
    col_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM pg_indexes WHERE tablename = 'customer_article_mappings';")
    idx_count = cur.fetchone()[0]
    cur.close()
    conn.close()
    print(f"\n[Step 6: Schema Verification Post-Rebuild]")
    print(f"  • Re-created Columns : {col_count} (Expected 38)")
    print(f"  • Re-created Indexes : {idx_count} (Expected >= 5)")
    assert col_count == 38, f"Expected 38 columns, got {col_count}"
    assert idx_count >= 5, f"Expected >= 5 indexes, got {idx_count}"

    print("--------------------------------------------------------------------------------")
    print("✅ DEFINITIVE PROOF: Alembic engine autonomously executed both DOWNGRADE and UPGRADE.")
    print("   No manual DDL, stamping, or table tampering occurred.")
    print("================================================================================")
    return True


if __name__ == "__main__":
    success = run_alembic_lifecycle("smriti002")
    sys.exit(0 if success else 1)
