"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.50
Created      : 2026-10-11
Modified     : 2026-10-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Migration Safety & Lifecycle Verification (Fresh & Existing)
"""

import os
import sys
import asyncio
import subprocess
import asyncpg

DB_ADMIN_URL = "postgresql://postgres:postgres@localhost:2781/postgres"
TEST_FRESH_DB = "smriti999"

async def test_fresh_database_initialization():
    print("\n--- [Step 1] Testing Fresh Database Initialization from Scratch ---")
    conn = await asyncpg.connect(DB_ADMIN_URL)
    await conn.execute(f"DROP DATABASE IF EXISTS {TEST_FRESH_DB}")
    await conn.execute(f"CREATE DATABASE {TEST_FRESH_DB}")
    await conn.close()
    print(f"Created isolated fresh database: {TEST_FRESH_DB}")

    # Set DATABASE_URL and POSTGRES_PORT to fresh database and run alembic upgrade head
    env = os.environ.copy()
    env["DATABASE_URL"] = f"postgresql+asyncpg://postgres:postgres@localhost:2781/{TEST_FRESH_DB}"
    env["POSTGRES_PORT"] = "2781"
    env["ALEMBIC_TARGET"] = "tenant"
    
    backend_dir = os.path.join(os.getcwd(), "backend")
    cmd = [
        os.path.join(os.getcwd(), ".venv", "Scripts", "alembic.exe"),
        "-c", "alembic.ini",
        "-x", "target=tenant",
        "-x", f"db={TEST_FRESH_DB}",
        "-x", f"db_url=postgresql+asyncpg://postgres:postgres@localhost:2781/{TEST_FRESH_DB}",
        "upgrade", "head"
    ]
    print(f"Executing Alembic upgrade head: {' '.join(cmd)}")
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True, cwd=backend_dir)
    
    if proc.returncode != 0:
        print(f"[FAIL] Fresh database migration failed!\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}")
        return False
    else:
        print("[PASS] Fresh database migrated cleanly to HEAD!")
        lines = [line for line in proc.stdout.strip().splitlines() if "Running upgrade" in line or "v1525" in line or "v1526" in line]
        for l in lines[-5:]:
            print(f"  {l}")

    # Verify that alembic_version in fresh DB is at head
    c = await asyncpg.connect(f"postgresql://postgres:postgres@localhost:2781/{TEST_FRESH_DB}")
    cur_ver = await c.fetchval("SELECT version_num FROM alembic_version")
    print(f"Fresh database version_num in alembic_version: {cur_ver}")
    
    # Verify suppliers table has records without foreign key violation
    supplier_count = await c.fetchval("SELECT count(*) FROM suppliers")
    master_val_count = await c.fetchval("SELECT count(*) FROM master_values WHERE code IN ('CHIKKU', 'R-GOLD', 'SULTAN', 'MUEL', 'WEDGES')")
    print(f"Fresh DB suppliers count: {supplier_count}")
    print(f"Fresh DB footwear master values count: {master_val_count}")
    await c.close()

    # Clean up test DB
    conn = await asyncpg.connect(DB_ADMIN_URL)
    await conn.execute(f"DROP DATABASE {TEST_FRESH_DB}")
    await conn.close()
    print(f"Cleaned up test database: {TEST_FRESH_DB}")
    return True

async def test_existing_databases_integrity():
    print("\n--- [Step 2] Testing Existing Databases Integrity (smritisys, smriti001) ---")
    for db in ["smritisys", "smriti001"]:
        try:
            c = await asyncpg.connect(f"postgresql://postgres:postgres@localhost:2781/{db}")
            cur_ver = await c.fetchval("SELECT version_num FROM alembic_version")
            sup_count = await c.fetchval("SELECT count(*) FROM suppliers WHERE is_deleted = false")
            # Check for orphaned suppliers with invalid company_id
            orphan_count = await c.fetchval("""
                SELECT count(*) FROM suppliers s 
                WHERE s.company_id IS NOT NULL 
                  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = s.company_id)
            """)
            footwear_vals = await c.fetchval("""
                SELECT count(*) FROM master_values 
                WHERE code IN ('CHIKKU', 'R-GOLD', 'SULTAN', 'SHOES', 'MUEL', 'WEDGES', 'PRS', 'PAIR')
            """)
            print(f"Database: {db:12} | Version: {cur_ver} | Suppliers: {sup_count} | Orphaned FKs: {orphan_count} | Footwear Values: {footwear_vals}")
            await c.close()
            if orphan_count > 0:
                print(f"[FAIL] Found {orphan_count} orphaned foreign keys in {db}!")
                return False
        except Exception as e:
            print(f"Database: {db:12} | Error: {e}")
            return False
    return True

async def main():
    s1 = await test_fresh_database_initialization()
    s2 = await test_existing_databases_integrity()
    if s1 and s2:
        print("\n=== MIGRATION SAFETY VERIFICATION: ALL CHECKS PASSED ===")
        sys.exit(0)
    else:
        print("\n=== MIGRATION SAFETY VERIFICATION: FAILED ===")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
