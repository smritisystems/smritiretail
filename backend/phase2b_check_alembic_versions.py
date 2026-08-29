"""
PHASE 2B: Check alembic versions in all databases
"""
import psycopg2

def check_db_version(db_name):
    """Check current alembic version for a database"""
    try:
        conn = psycopg2.connect(
            host='localhost', port=5432, user='postgres', password='postgres', database=db_name
        )
        cur = conn.cursor()
        cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1")
        row = cur.fetchone()
        version = row[0] if row else "NO_VERSION_FOUND"
        cur.close()
        conn.close()
        return version
    except Exception as e:
        return f"ERROR: {str(e)[:80]}"

print("[PHASE 2B] Checking alembic_version in all databases...")
print("="*70)

databases = ['smriti_diag_fresh', 'smriti001', 'smritisys']
for db_name in databases:
    version = check_db_version(db_name)
    print(f"{db_name:25s}: {version}")

print("="*70)
print("\nINTERPRETATION:")
print("  - If smriti001 is at an OLD version, it means migrations were NOT applied")
print("  - If smriti001 is at v1382_menu_registry, schema divergence is REAL problem")
print("  - If smritisys is at different version, control-plane may be out of sync")
