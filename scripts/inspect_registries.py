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

async def inspect():
    async with async_session() as session:
        res = await session.execute(text(
            "SELECT company_id, database_id, database_name, status, provisioning_status, created_at "
            "FROM company_database_registries "
            "WHERE company_id LIKE 'comp-pending-%' OR status != 'READY' "
            "ORDER BY created_at;"
        ))
        rows = list(res.mappings())
        print(f"Total matching registries: {len(rows)}")
        for r in rows:
            print("Registry:", dict(r))
            db_name = r['database_name']
            # Check if database physically exists in Postgres
            try:
                conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
                cur = conn.cursor()
                cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
                count = cur.fetchone()[0]
                cur.close()
                conn.close()
                print(f"  -> Physical Database '{db_name}' EXISTS with {count} public tables.")
            except Exception as e:
                print(f"  -> Physical Database '{db_name}' DOES NOT EXIST or cannot connect: {e}")

if __name__ == "__main__":
    asyncio.run(inspect())
