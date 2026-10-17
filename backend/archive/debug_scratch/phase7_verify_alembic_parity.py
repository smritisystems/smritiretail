#!/usr/bin/env python3
"""
PHASE 7: Alembic Parity Verification
Requirement: Both smritisys and smriti001 must have same current alembic HEAD
Expected: Both at v1384_company_code_constraint
"""

import asyncio
import subprocess
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def check_alembic_version(db_name: str) -> str:
    """Check the current alembic version in a database."""
    url = f'postgresql+asyncpg://postgres:postgres@localhost:5432/{db_name}'
    try:
        engine = create_async_engine(url)
        async with engine.begin() as conn:
            result = await conn.execute(
                text('SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1')
            )
            version = result.scalar()
            return version or "NO VERSION FOUND"
    except Exception as e:
        return f"ERROR: {str(e)}"
    finally:
        await engine.dispose()

async def main():
    print("=" * 70)
    print("PHASE 7: Alembic Parity Verification")
    print("=" * 70)
    print()
    
    # Check both databases
    print("Checking alembic HEAD version in both databases:")
    print()
    
    smritisys_version = await check_alembic_version('smritisys')
    smriti001_version = await check_alembic_version('smriti001')
    
    print(f"  smritisys: {smritisys_version}")
    print(f"  smriti001: {smriti001_version}")
    print()
    
    # Verify
    expected = "v1384_company_code_constraint"
    
    smritisys_match = smritisys_version == expected
    smriti001_match = smriti001_version == expected
    parity_match = smritisys_version == smriti001_version
    
    print("GATE VERIFICATION:")
    print(f"  ✅ smritisys at {expected}: {smritisys_match}")
    print(f"  ✅ smriti001 at {expected}: {smriti001_match}")
    print(f"  ✅ Both at same HEAD (parity): {parity_match}")
    print()
    
    if smritisys_match and smriti001_match and parity_match:
        print("✅ PHASE 7 PASSED: Both databases at v1384 (PARITY VERIFIED)")
        return 0
    else:
        print("❌ PHASE 7 FAILED: Databases not at same HEAD")
        return 1

if __name__ == '__main__':
    exit_code = asyncio.run(main())
    exit(exit_code)
