"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import psycopg2
from sqlalchemy import text
from backend.app.db.session import async_session

async def archive_pending_registries():
    print("=================================================================")
    print("SMRITI Controlled Database Registry Lifecycle & Archive Protocol")
    print("=================================================================")
    async with async_session() as session:
        # 1. Discover pending/ephemeral records
        res = await session.execute(text(
            "SELECT company_id, database_id, database_name, status, provisioning_status, created_at "
            "FROM company_database_registries "
            "WHERE company_id LIKE 'comp-pending-%' "
            "ORDER BY created_at;"
        ))
        records = list(res.mappings())
        print(f"Found {len(records)} 'comp-pending-*' records in company_database_registries.")

        if not records:
            print("No pending records to process.")
            return

        archived_count = 0
        for r in records:
            cid = r["company_id"]
            dbname = r["database_name"]
            print(f"\n[Verifying] company_id='{cid}', db='{dbname}'...")

            # A. Verify physical database existence
            db_exists = False
            try:
                conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{dbname}")
                cur = conn.cursor()
                cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
                count = cur.fetchone()[0]
                cur.close()
                conn.close()
                db_exists = True
                print(f"  -> Physical Database '{dbname}' EXISTS with {count} tables.")
            except Exception:
                print(f"  -> Physical Database '{dbname}' DOES NOT EXIST.")

            # B. Verify audit log / foreign key references
            ref_res = await session.execute(text(
                "SELECT count(*) FROM smriti_audit_log WHERE changed_record_id = :cid OR changed_table = :cid"
            ), {"cid": cid})
            audit_refs = ref_res.scalar()
            print(f"  -> smriti_audit_log references: {audit_refs}")

            # C. Transition lifecycle status to ARCHIVED with note
            if not db_exists and audit_refs == 0:
                print(f"  -> Safe to transition {cid} to status='ARCHIVED', provisioning_status='DECOMMISSIONED'.")
                await session.execute(text(
                    "UPDATE company_database_registries "
                    "SET status = 'ARCHIVED', provisioning_status = 'DECOMMISSIONED', updated_at = NOW() "
                    "WHERE company_id = :cid"
                ), {"cid": cid})
                archived_count += 1

        await session.commit()
        print(f"\nSuccessfully updated {archived_count} ephemeral records to ARCHIVED state.")

if __name__ == "__main__":
    asyncio.run(archive_pending_registries())
