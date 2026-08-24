"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def run_migration():
    base_url = settings.DATABASE_URL
    for db_name in ["smritisys", "smriti001", "smriti002"]:
        try:
            url = base_url.rsplit("/", 1)[0] + f"/{db_name}"
            eng = create_async_engine(url, echo=False)
            async with eng.begin() as conn:
                print(f"--- Running Item Master NOT NULL migration on {db_name} ---")
                # 1. Backfill legacy nulls in products
                await conn.execute(text("UPDATE products SET mrp = COALESCE(mrp, price, 0.00) WHERE mrp IS NULL"))
                await conn.execute(text("UPDATE products SET gst_percentage = COALESCE(gst_percentage, 18.00) WHERE gst_percentage IS NULL"))
                await conn.execute(text("UPDATE products SET hsn_code = '64041990' WHERE hsn_code IS NULL OR trim(hsn_code) = ''"))

                # 2. Backfill legacy nulls in items if table exists
                await conn.execute(text("""
                    DO $$ 
                    BEGIN 
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
                            UPDATE items 
                            SET hsn_code = '64041990' 
                            WHERE hsn_code IS NULL OR trim(hsn_code) = '';
                            
                            ALTER TABLE items ALTER COLUMN hsn_code SET NOT NULL;
                        END IF;
                    END $$;
                """))

                # 3. Apply NOT NULL constraints on products
                await conn.execute(text("ALTER TABLE products ALTER COLUMN gst_percentage SET NOT NULL"))
                await conn.execute(text("ALTER TABLE products ALTER COLUMN gst_percentage SET DEFAULT 18.00"))
                await conn.execute(text("ALTER TABLE products ALTER COLUMN mrp SET NOT NULL"))
                await conn.execute(text("ALTER TABLE products ALTER COLUMN mrp SET DEFAULT 0.00"))
                await conn.execute(text("ALTER TABLE products ALTER COLUMN hsn_code SET NOT NULL"))
                await conn.execute(text("ALTER TABLE products ALTER COLUMN hsn_code SET DEFAULT '64041990'"))

                print(f"Successfully migrated {db_name}!")
            await eng.dispose()
        except Exception as e:
            print(f"Migration note for {db_name}: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
