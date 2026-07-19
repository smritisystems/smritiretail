"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.14.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import uuid
import sys
sys.path.insert(0, ".")
from app.core.config import settings

async def backfill_tenant_ids():
    """
    Backfills company_id and branch_id for any legacy rows in the database
    that have null values for these fields.
    """
    import asyncpg
    url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
    conn = await asyncpg.connect(url)
    
    # 1. Fetch or create a default company/branch to use for backfilling
    companies = await conn.fetch("SELECT id FROM companies LIMIT 1")
    if companies:
        default_company_id = companies[0]["id"]
        branches = await conn.fetch("SELECT id FROM branches WHERE company_id = $1 LIMIT 1", default_company_id)
        if branches:
            default_branch_id = branches[0]["id"]
        else:
            default_branch_id = "br-default"
            await conn.execute(
                "INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at) "
                "VALUES ($1, $2, $3, 'Default Branch', 'BR-DFT', true, false, now(), now())",
                default_branch_id, str(uuid.uuid4()), default_company_id
            )
    else:
        default_company_id = "comp-default"
        default_branch_id = "br-default"
        await conn.execute(
            "INSERT INTO companies (id, uuid, name, gst_number, is_active, is_deleted, created_at, modified_at) "
            "VALUES ($1, $2, 'Default Company', '27ABCDE1234F1Z5', true, false, now(), now())",
            default_company_id, str(uuid.uuid4())
        )
        await conn.execute(
            "INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at) "
            "VALUES ($1, $2, $3, 'Default Branch', 'BR-DFT', true, false, now(), now())",
            default_branch_id, str(uuid.uuid4()), default_company_id
        )

    print(f"Using Default Company ID: {default_company_id}, Branch ID: {default_branch_id}")

    # 2. Get all tables that contain company_id and branch_id
    rows = await conn.fetch("""
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE column_name IN ('company_id', 'branch_id') 
          AND table_schema = 'public'
    """)
    
    table_cols = {}
    for r in rows:
        table_cols.setdefault(r['table_name'], []).append(r['column_name'])

    # 3. Update null rows in each table
    for table, cols in table_cols.items():
        if len(cols) == 2:
            # Check count of null rows
            cnt = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE company_id IS NULL OR branch_id IS NULL")
            if cnt > 0:
                print(f"Backfilling {cnt} null rows in table '{table}'...")
                await conn.execute(
                    f"UPDATE {table} SET company_id = $1, branch_id = $2 WHERE company_id IS NULL OR branch_id IS NULL",
                    default_company_id, default_branch_id
                )
                print(f"Finished backfilling table '{table}'.")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(backfill_tenant_ids())
