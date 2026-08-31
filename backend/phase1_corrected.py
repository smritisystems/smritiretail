"""
PHASE 1 CORRECTED: Fresh Database with Proper Alembic Configuration
"""
import psycopg2
import subprocess
import sys
import os
from pathlib import Path
import tempfile
import shutil

def main():
    target_db = 'smriti_diag_fresh'
    
    # Step 1: Create fresh database
    print("[PHASE 1] Creating fresh database...")
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            user='postgres',
            password='postgres',
            database='postgres'
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        # Drop if exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
        if cur.fetchone():
            cur.execute(f"DROP DATABASE IF EXISTS {target_db}")
            print(f"  ✓ Dropped existing {target_db}")
        
        # Create fresh
        cur.execute(f"CREATE DATABASE {target_db}")
        print(f"  ✓ Created fresh {target_db}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False
    
    # Step 2: Create temporary alembic.ini with correct database URL
    print(f"\n[PHASE 1] Running alembic with -x db={target_db}...")
    try:
        # Use -x db argument instead of modifying alembic.ini
        result = subprocess.run(
            ['alembic', '-x', f'db={target_db}', 'upgrade', 'head'],
            capture_output=True,
            text=True,
            cwd=os.getcwd()
        )
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        if result.returncode != 0:
            print(f"  ✗ Alembic upgrade failed with exit code {result.returncode}")
            return False
        
        print(f"  ✓ Alembic upgrade completed (exit code 0)")
        
    except Exception as e:
        print(f"  ✗ Error running alembic: {e}")
        return False
    
    # Step 4: Verify schema was created
    print(f"\n[PHASE 1] Verifying {target_db} schema...")
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            user='postgres',
            password='postgres',
            database=target_db
        )
        cur = conn.cursor()
        
        # Check alembic_version (should now include v1384)
        cur.execute("SELECT version_num FROM alembic_version LIMIT 1")
        row = cur.fetchone()
        if row:
            alembic_version = row[0]
            print(f"  ✓ Alembic version: {alembic_version}")
            if alembic_version not in ["v1383_invoice_communicator", "v1384_company_code_constraint"]:
                print(f"  ⚠ WARNING: Expected v1383 or v1384, got {alembic_version}")
        else:
            print(f"  ✗ No alembic_version found")
            return False
        
        # Check table count
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        table_count = cur.fetchone()[0]
        print(f"  ✓ Tables created: {table_count}")
        
        if table_count == 0:
            print(f"  ✗ ERROR: No tables were created!")
            return False
        
        cur.close()
        conn.close()
        
        print(f"\n[PHASE 1] ✓ OUTCOME A: Fresh database {target_db} successfully reached HEAD")
        print(f"     Alembic version: {alembic_version}")
        print(f"     Table count: {table_count}")
        return True
        
    except Exception as e:
        print(f"  ✗ Error verifying schema: {e}")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
