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
from sqlalchemy import text
from backend.app.db.session import async_session

async def check_references():
    async with async_session() as session:
        for tbl, col in [
            ("companies", "id"),
            ("branches", "company_id"),
            ("user_company_assignments", "company_id"),
            ("audit_logs", "company_id"),
        ]:
            try:
                res = await session.execute(text(f"SELECT count(*) FROM {tbl} WHERE {col} LIKE 'comp-pending-%'"))
                count = res.scalar()
                print(f"Table '{tbl}'.'{col}' has {count} references to comp-pending-%")
            except Exception as e:
                print(f"Table '{tbl}' check error: {e}")

if __name__ == "__main__":
    asyncio.run(check_references())
