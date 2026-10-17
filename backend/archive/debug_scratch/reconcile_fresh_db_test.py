#!/usr/bin/env python3
"""
FRESH DATABASE REPRODUCIBILITY TEST
Rule: ONLY alembic upgrade head
NO manual SQL, NO stamp, NO manual INSERT
"""

import subprocess
import asyncio
from sqlalchemy import text, create_engine
from sqlalchemy.ext.asyncio import create_async_engine
import os

async def verify():
    url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti_diag_fresh_test'
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            # Count tables
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            table_count = result.scalar()
            
            # Get alembic version
            result = await conn.execute(text("""
                SELECT version_num FROM alembic_version 
                ORDER BY version_num DESC LIMIT 1
            """))
            version = result.scalar()
            
            # Check for recovery tables
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('communicator_templates', 'communicator_logs', 
                                   'tax_invoice_templates', 'invoice_document_artifacts',
                                   'sales_order_invoice_allocations', 'tax_invoice_template_versions')
            """))
            recovery_tables = result.scalar()
            
            # Check company_code constraint
            result = await conn.execute(text("""
                SELECT constraint_name FROM information_schema.constraint_column_usage
                WHERE table_name = 'companies' AND constraint_name LIKE '%company_code%'
            """))
            constraints = result.fetchall()
            
            return {
                'tables': table_count,
                'version': version,
                'recovery_tables': recovery_tables,
                'constraints': len(constraints)
            }
    finally:
        await engine.dispose()

async def main():
    print("=" * 70)
    print("FRESH DATABASE REPRODUCIBILITY TEST - RECONCILIATION")
    print("=" * 70)
    print()
    
    # Use synchronous connection for database management
    from sqlalchemy.pool import NullPool
    
    # Step 1: Drop old
    print("1. Dropping old diagnostic database...")
    try:
        admin_url = 'postgresql://postgres:postgres@localhost:5432/postgres'
        engine = create_engine(admin_url, poolclass=NullPool, isolation_level='AUTOCOMMIT')
        with engine.connect() as conn:
            # Terminate existing connections
            conn.execute(text("""
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = 'smriti_diag_fresh_test'
                AND pid <> pg_backend_pid();
            """))
            # Drop database
            conn.execute(text('DROP DATABASE IF EXISTS smriti_diag_fresh_test;'))
        print(f"   Status: dropped")
    except Exception as e:
        print(f"   Note: {str(e)[:50]}")
    
    # Step 2: Create new
    print("2. Creating brand-new empty database (smriti_diag_fresh_test)...")
    try:
        admin_url = 'postgresql://postgres:postgres@localhost:5432/postgres'
        engine = create_engine(admin_url, poolclass=NullPool, isolation_level='AUTOCOMMIT')
        with engine.connect() as conn:
            conn.execute(text('CREATE DATABASE smriti_diag_fresh_test;'))
        print(f"   Status: created")
    except Exception as e:
        print(f"   ERROR: {str(e)[:100]}")
    
    # Step 3: Run ONLY alembic upgrade head
    print("3. Running: alembic upgrade head")
    print("   (NO MANUAL SQL, NO STAMP, NO DATA INSERT)")
    print()
    
    os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti_diag_fresh_test'
    result = subprocess.run(['alembic', 'upgrade', 'head'], 
                           capture_output=True, text=True)
    
    print(f"   Exit code: {result.returncode}")
    if result.returncode != 0:
        print(f"   ERROR: {result.stderr[:300]}")
        print()
        print("❌ FRESH DATABASE TEST: FAILED")
        return 1
    
    # Step 4: Verify
    print()
    print("4. Verifying schema...")
    
    verify_result = await verify()
    print(f"   Tables created: {verify_result['tables']}")
    print(f"   Alembic HEAD: {verify_result['version']}")
    print(f"   Recovery tables (v1383): {verify_result['recovery_tables']}/6")
    print(f"   Company-code constraints: {verify_result['constraints']}")
    
    print()
    print("=" * 70)
    if verify_result['version'] == 'v1384_company_code_constraint' and verify_result['tables'] >= 180:
        print("✅ FRESH DATABASE TEST: PASS")
        print("   Reproducible with alembic upgrade head only")
        return 0
    else:
        print("❌ FRESH DATABASE TEST: FAIL")
        print(f"   Expected v1384, got {verify_result['version']}")
        return 1

if __name__ == '__main__':
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
