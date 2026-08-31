"""
Stamp smriti001 to correct alembic revision.
The schema changes from v1376-v1382 appear to have been applied,
but alembic_version is still at v1375.
"""
import subprocess
import os
import psycopg2
import sys

os.chdir('f:\\SMRITRretailNX\\backend')
os.environ['PYTHONPATH'] = 'f:\\SMRITRretailNX'

# Get current revision for both databases
def get_current_revision(db_name):
    try:
        conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db_name}')
        cur = conn.cursor()
        cur.execute("SELECT version_num FROM alembic_version LIMIT 1;")
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row[0] if row else "NONE"
    except Exception as e:
        return f"ERROR: {e}"

# Check which columns already exist in smriti001
def check_columns_in_smriti001():
    try:
        conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
        cur = conn.cursor()
        
        print("Checking schema in smriti001:")
        print()
        
        # Check for idempotency_key in sales_returns
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='sales_returns' AND column_name='idempotency_key'
            );
        """)
        has_idempo = cur.fetchone()[0]
        print(f"  sales_returns.idempotency_key: {'EXISTS' if has_idempo else 'MISSING'}")
        
        # Check for smriti_menus table (added in v1382)
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='smriti_menus'
            );
        """)
        has_menus = cur.fetchone()[0]
        print(f"  smriti_menus table: {'EXISTS' if has_menus else 'MISSING'}")
        
        # Check for company_code column
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='companies' AND column_name='company_code'
            );
        """)
        has_company_code = cur.fetchone()[0]
        print(f"  companies.company_code: {'EXISTS' if has_company_code else 'MISSING'}")
        
        cur.close()
        conn.close()
        return
    except Exception as e:
        print(f"ERROR checking columns: {e}")

print("=" * 70)
print("CURRENT STATE")
print("=" * 70)
check_columns_in_smriti001()
print()

print("=" * 70)
print("STAMPING smriti001 TO v1382_menu_registry...")
print("=" * 70)
print()

# Stamp the database to v1382_menu_registry
result = subprocess.run(
    [sys.executable, '-m', 'alembic', '-x', 'db=smriti001', 'stamp', 'v1382_menu_registry'],
    cwd='f:\\SMRITRretailNX\\backend',
    capture_output=True,
    text=True
)

print("STDOUT:")
print(result.stdout)
if result.stderr:
    print("STDERR:")
    print(result.stderr)
print(f"Return Code: {result.returncode}")
print()

print("=" * 70)
print("VERIFICATION")
print("=" * 70)

smritisys_after = get_current_revision('smritisys')
smriti001_after = get_current_revision('smriti001')

print(f"smritisys (Control Plane):  {smritisys_after}")
print(f"smriti001 (Operational):    {smriti001_after}")
print()

if smritisys_after == smriti001_after:
    print(f"✓ SUCCESS: Both databases at {smritisys_after}")
else:
    print(f"✗ MISMATCH: smritisys={smritisys_after}, smriti001={smriti001_after}")
