#!/usr/bin/env python3
"""Check for triggers in the database, including product-related triggers."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys")

async def main():
    # Create engine
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # Check for all triggers in the database
        result = await conn.execute(text("""
            SELECT 
                trigger_schema, 
                trigger_name, 
                event_object_table, 
                action_statement,
                action_timing,
                event_manipulation
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table, trigger_name;
        """))
        
        rows = result.fetchall()
        if not rows:
            print("No triggers found in public schema")
        else:
            print(f"Found {len(rows)} triggers:")
            for row in rows:
                schema, name, table, statement, timing, event = row
                print(f"\n  Trigger: {name}")
                print(f"    Table: {table}")
                print(f"    Event: {timing} {event}")
                print(f"    Statement: {statement[:100]}...")
        
        # Specifically check for triggers on products table
        print("\n" + "="*60)
        print("Checking for triggers specifically on products table:")
        result = await conn.execute(text("""
            SELECT 
                trigger_name, 
                action_statement,
                action_timing,
                event_manipulation
            FROM information_schema.triggers
            WHERE event_object_table = 'products'
            AND trigger_schema = 'public';
        """))
        
        rows = result.fetchall()
        if not rows:
            print("No triggers on products table")
        else:
            print(f"Found {len(rows)} triggers on products table:")
            for row in rows:
                name, statement, timing, event = row
                print(f"  {name}: {timing} {event}")
                print(f"    Statement: {statement}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
