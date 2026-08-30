#!/usr/bin/env python3
"""Check the function fn_reconcile_inventory_state."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys")

async def main():
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # Get the function definition
        result = await conn.execute(text("""
            SELECT routine_definition
            FROM information_schema.routines
            WHERE routine_name = 'fn_reconcile_inventory_state'
            AND routine_schema = 'public';
        """))
        
        row = result.fetchone()
        if row:
            print("Function fn_reconcile_inventory_state:")
            print("="*60)
            print(row[0])
        else:
            print("Function not found")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
