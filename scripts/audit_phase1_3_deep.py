"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.37.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Governance & Diagnostic Tooling

Detailed audit of smriti_identity_alias and candidate external integration entities
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASES = [
    ("smritisys", "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"),
    ("smriti001", "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"),
]

async def check():
    for name, url in DATABASES:
        print(f"\n{'='*75}\nINDEX & CONSTRAINT AUDIT FOR: {name}\n{'='*75}")
        engine = create_async_engine(url, echo=False)
        async with engine.connect() as conn:
            # 1. smriti_identity_alias indexes
            idx_q = text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'smriti_identity_alias'
                ORDER BY indexname;
            """)
            idxs = (await conn.execute(idx_q)).fetchall()
            print("smriti_identity_alias indexes:")
            for i in idxs:
                print(f"  - {i[0]}: {i[1]}")
                
            # 2. parties constraints & indexes
            p_idx_q = text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'parties'
                ORDER BY indexname;
            """)
            p_idxs = (await conn.execute(p_idx_q)).fetchall()
            print("\nparties indexes:")
            for i in p_idxs:
                print(f"  - {i[0]}: {i[1]}")

            # 3. payment_transactions constraints & indexes
            pt_idx_q = text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'payment_transactions'
                ORDER BY indexname;
            """)
            pt_idxs = (await conn.execute(pt_idx_q)).fetchall()
            print("\npayment_transactions indexes:")
            for i in pt_idxs:
                print(f"  - {i[0]}: {i[1]}")

            # 4. eway_bills constraints & indexes
            ewb_idx_q = text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'eway_bills'
                ORDER BY indexname;
            """)
            ewb_idxs = (await conn.execute(ewb_idx_q)).fetchall()
            print("\neway_bills indexes:")
            for i in ewb_idxs:
                print(f"  - {i[0]}: {i[1]}")

        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
