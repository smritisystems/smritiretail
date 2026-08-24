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

async def run_pricing_migration():
    base_url = settings.DATABASE_URL
    for db_name in ["smritisys", "smriti001", "smriti002"]:
        try:
            url = base_url.rsplit("/", 1)[0] + f"/{db_name}"
            eng = create_async_engine(url, echo=False)
            async with eng.begin() as conn:
                print(f"--- Migrating pricing constraints on {db_name} ---")
                # 1. Add buying_price column to products
                await conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS buying_price NUMERIC(15, 2)"))

                # 2. Backfill buying_price and cost_price on products
                await conn.execute(text("""
                    UPDATE products 
                    SET 
                        cost_price = CASE 
                            WHEN cost_price IS NULL OR cost_price <= 0 THEN COALESCE(price, mrp, 100.00) 
                            ELSE cost_price 
                        END,
                        buying_price = CASE 
                            WHEN buying_price IS NULL OR buying_price <= 0 THEN COALESCE(cost_price, price, mrp, 100.00) 
                            ELSE buying_price 
                        END
                    WHERE tracking_mode != 'No-stock' OR tracking_mode IS NULL;
                """))

                # 3. Ensure cost_price <= buying_price on legacy records
                await conn.execute(text("""
                    UPDATE products 
                    SET buying_price = cost_price 
                    WHERE buying_price < cost_price AND (tracking_mode != 'No-stock' OR tracking_mode IS NULL);
                """))

                # 4. Ensure mrp >= price on legacy records
                await conn.execute(text("""
                    UPDATE products 
                    SET mrp = price 
                    WHERE mrp < price;
                """))

                # 5. Check items table
                await conn.execute(text("""
                    DO $$ 
                    BEGIN 
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
                            ALTER TABLE items ADD COLUMN IF NOT EXISTS buying_price NUMERIC(15, 2);
                            UPDATE items 
                            SET 
                                cost_price = CASE 
                                    WHEN cost_price IS NULL OR cost_price <= 0 THEN COALESCE(selling_price, mrp, 100.00) 
                                    ELSE cost_price 
                                END,
                                buying_price = CASE 
                                    WHEN buying_price IS NULL OR buying_price <= 0 THEN COALESCE(cost_price, selling_price, mrp, 100.00) 
                                    ELSE buying_price 
                                END
                            WHERE item_type NOT IN ('SERVICE', 'PROMOTION', 'SAMPLE', 'NON_STOCK', 'FREE');

                            UPDATE items 
                            SET buying_price = cost_price 
                            WHERE buying_price < cost_price;

                            UPDATE items 
                            SET mrp = selling_price 
                            WHERE mrp < selling_price;
                        END IF;
                    END $$;
                """))

                print(f"Successfully applied pricing constraints to {db_name}!")
            await eng.dispose()
        except Exception as e:
            print(f"Pricing migration note for {db_name}: {e}")

if __name__ == "__main__":
    asyncio.run(run_pricing_migration())
