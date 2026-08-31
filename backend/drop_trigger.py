#!/usr/bin/env python3
"""Drop the inventory reconciliation trigger and function that causes double-incrementing."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys")

async def main():
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # Drop the trigger first
        print("Dropping trigger trg_inventory_state_reconciliation...")
        await conn.execute(text("""
            DROP TRIGGER IF EXISTS trg_inventory_state_reconciliation ON stock_movements CASCADE;
        """))
        print("✓ Trigger dropped")
        
        # Drop the function
        print("Dropping function fn_reconcile_inventory_state...")
        await conn.execute(text("""
            DROP FUNCTION IF EXISTS fn_reconcile_inventory_state() CASCADE;
        """))
        print("✓ Function dropped")
        
        # Verify
        print("\nVerifying triggers are gone...")
        result = await conn.execute(text("""
            SELECT trigger_name
            FROM information_schema.triggers
            WHERE trigger_schema = 'public' AND event_object_table = 'stock_movements';
        """))
        rows = result.fetchall()
        if not rows:
            print("✓ No triggers found on stock_movements")
        else:
            print("✗ Triggers still exist:")
            for row in rows:
                print(f"  - {row[0]}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
