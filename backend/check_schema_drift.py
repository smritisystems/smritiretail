#!/usr/bin/env python3
"""Check for schema drift in smritisys."""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def check_drift():
    """Check for schema drift between alembic_version and actual schema."""
    url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys'
    engine = create_async_engine(url)
    
    try:
        async with engine.begin() as conn:
            # Get alembic version
            result = await conn.execute(
                text('SELECT version_num FROM alembic_version ORDER BY version_num DESC')
            )
            versions = result.fetchall()
            print("Alembic versions recorded (last 5):")
            for v in versions[-5:]:
                print(f"  - {v[0]}")
            
            # Check for communicator tables
            result = await conn.execute(
                text("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name LIKE 'communicator%'
                """)
            )
            tables = result.fetchall()
            print("\nCommunicator tables in schema:")
            for t in tables:
                print(f"  - {t[0]}")
            
            # Check for tax_invoice tables
            result = await conn.execute(
                text("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name LIKE 'tax_invoice%'
                """)
            )
            tables = result.fetchall()
            print("\nTax invoice tables in schema:")
            for t in tables:
                print(f"  - {t[0]}")
            
            # Check for sales_order_invoice_allocations
            result = await conn.execute(
                text("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'sales_order_invoice_allocations'
                """)
            )
            tables = result.fetchall()
            print("\nSales order invoice allocation table:")
            if tables:
                print(f"  - {tables[0][0]}")
            else:
                print("  - NOT FOUND")
    finally:
        await engine.dispose()

asyncio.run(check_drift())
