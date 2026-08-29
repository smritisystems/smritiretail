"""
PHASE 2A: Schema Comparison (Corrected)
Compare fresh database vs smriti001 for schema parity
"""
import psycopg2
import json

def get_table_list(conn_str):
    """Get list of tables in public schema"""
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return tables

def get_table_columns(conn_str, table_name):
    """Get columns for a specific table"""
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    columns = {}
    for col_name, col_type, is_nullable, col_default in cur.fetchall():
        columns[col_name] = {
            'type': col_type,
            'nullable': is_nullable == 'YES',
            'default': col_default
        }
    cur.close()
    conn.close()
    return columns

def main():
    fresh_conn = 'postgresql://postgres:postgres@localhost:5432/smriti_diag_fresh'
    smriti001_conn = 'postgresql://postgres:postgres@localhost:5432/smriti001'
    
    print("[PHASE 2A] Comparing table lists...")
    fresh_tables = set(get_table_list(fresh_conn))
    smriti001_tables = set(get_table_list(smriti001_conn))
    
    print(f"  - Fresh DB tables: {len(fresh_tables)}")
    print(f"  - smriti001 tables: {len(smriti001_tables)}")
    
    # Identify differences
    only_in_fresh = fresh_tables - smriti001_tables
    only_in_smriti001 = smriti001_tables - fresh_tables
    common_tables = fresh_tables & smriti001_tables
    
    print("\n" + "="*70)
    print("TABLE COMPARISON")
    print("="*70)
    
    if only_in_fresh:
        print(f"\n⚠ Tables ONLY in fresh database ({len(only_in_fresh)}):")
        for table in sorted(only_in_fresh):
            print(f"  - {table}")
    
    if only_in_smriti001:
        print(f"\n⚠ Tables ONLY in smriti001 ({len(only_in_smriti001)}):")
        for table in sorted(only_in_smriti001):
            print(f"  - {table}")
    
    # Check for column differences in common tables
    print(f"\n[PHASE 2A] Checking columns in {len(common_tables)} common tables...")
    column_diffs = {}
    
    for i, table in enumerate(sorted(common_tables)):
        if (i+1) % 50 == 0:
            print(f"  - Processed {i+1}/{len(common_tables)} tables...")
        
        fresh_cols = get_table_columns(fresh_conn, table)
        smriti001_cols = get_table_columns(smriti001_conn, table)
        
        fresh_col_names = set(fresh_cols.keys())
        smriti001_col_names = set(smriti001_cols.keys())
        
        if fresh_col_names != smriti001_col_names:
            column_diffs[table] = {
                'fresh_only': sorted(fresh_col_names - smriti001_col_names),
                'smriti001_only': sorted(smriti001_col_names - fresh_col_names)
            }
    
    if column_diffs:
        print(f"\n⚠ Column differences in {len(column_diffs)} tables:")
        for table, diffs in sorted(column_diffs.items()):
            print(f"  {table}:")
            if diffs['fresh_only']:
                print(f"    - Fresh only: {diffs['fresh_only']}")
            if diffs['smriti001_only']:
                print(f"    - smriti001 only: {diffs['smriti001_only']}")
    
    # Final verdict
    print("\n" + "="*70)
    print("SCHEMA PARITY VERDICT")
    print("="*70)
    
    if not (only_in_fresh or only_in_smriti001 or column_diffs):
        print("\n✓ SCHEMA PARITY VERIFIED")
        print("  Fresh database and smriti001 are IDENTICAL")
        return True
    else:
        print("\n✗ SCHEMA DIVERGENCE DETECTED")
        print(f"  - Tables only in fresh: {len(only_in_fresh)}")
        print(f"  - Tables only in smriti001: {len(only_in_smriti001)}")
        print(f"  - Tables with column differences: {len(column_diffs)}")
        return False

if __name__ == '__main__':
    success = main()
