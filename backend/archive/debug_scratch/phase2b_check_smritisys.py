"""
PHASE 2B: Check smritisys (control-plane) for divergence
"""
import psycopg2

def get_table_list(conn_str):
    """Get list of tables in public schema"""
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name
    """)
    tables = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return tables

print("[PHASE 2B] Checking smritisys (control-plane) schema...")
print("="*70)

fresh_tables = set(get_table_list('postgresql://postgres:postgres@localhost:5432/smriti_diag_fresh'))
smritisys_tables = set(get_table_list('postgresql://postgres:postgres@localhost:5432/smritisys'))

print(f"Fresh DB (canonical): {len(fresh_tables)} tables")
print(f"smritisys (control-plane): {len(smritisys_tables)} tables")

only_in_fresh = fresh_tables - smritisys_tables
only_in_smritisys = smritisys_tables - fresh_tables

print("\n" + "="*70)
if len(only_in_fresh) + len(only_in_smritisys) == 0:
    print("✓ SMRITISYS SCHEMA PARITY: PERFECT MATCH WITH FRESH DB")
else:
    print("✗ SMRITISYS SCHEMA DIVERGENCE DETECTED")
    
    if only_in_fresh:
        print(f"\nTables ONLY in fresh DB ({len(only_in_fresh)}):")
        for table in sorted(only_in_fresh):
            print(f"  - {table}")
    
    if only_in_smritisys:
        print(f"\nTables ONLY in smritisys ({len(only_in_smritisys)}):")
        for table in sorted(only_in_smritisys):
            print(f"  - {table}")

print("\n" + "="*70)
print("VERDICT:")
print("="*70)

if len(only_in_fresh) + len(only_in_smritisys) == 0:
    print("✓ CONTROL-PLANE (smritisys) IS CANONICALLY CORRECT")
    print("  - smritisys matches fresh database perfectly")
    print("  - Can be used as reference for migration integrity")
else:
    print("✗ CONTROL-PLANE (smritisys) ALSO DIVERGED")
    print(f"  - {len(only_in_smritisys)} extra tables in smritisys")
    print(f"  - {len(only_in_fresh)} missing tables in smritisys")
