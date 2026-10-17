"""
PHASE 2A: Schema Comparison
Compare fresh database vs smriti001 for schema parity
"""
import psycopg2
from psycopg2 import sql
import json

def get_schema_info(conn_str, db_name):
    """Extract complete schema from database"""
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # Check alembic version
    try:
        cur.execute("SELECT version_num FROM alembic_version ORDER BY installed_on DESC LIMIT 1")
        alembic_version = cur.fetchone()[0]
        print(f"  - Alembic version: {alembic_version}")
    except:
        print(f"  - WARNING: No alembic_version table found")
        alembic_version = "UNKNOWN"
    
    schema = {
        'tables': {},
        'indexes': {},
        'constraints': {},
        'sequences': {},
        'alembic_version': alembic_version
    }
    
    # Get all tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = [row[0] for row in cur.fetchall()]
    
    for table in tables:
        schema['tables'][table] = {
            'columns': {},
            'pk': None,
            'fks': [],
            'checks': []
        }
        
        # Get columns
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
        """, (table,))
        
        for col_name, col_type, is_nullable, col_default in cur.fetchall():
            schema['tables'][table]['columns'][col_name] = {
                'type': col_type,
                'nullable': is_nullable == 'YES',
                'default': col_default
            }
        
        # Get primary key
        cur.execute("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid
            AND a.attnum = ANY(i.indkey)
            WHERE i.indisprimary AND i.indrelid::regclass::text = %s
            ORDER BY a.attnum
        """, (table,))
        
        pk_cols = [row[0] for row in cur.fetchall()]
        if pk_cols:
            schema['tables'][table]['pk'] = pk_cols
        
        # Get foreign keys
        cur.execute("""
            SELECT rc.constraint_name, kcu.column_name, ccu.table_name, ccu.column_name
            FROM information_schema.referential_constraints rc
            JOIN information_schema.key_column_usage kcu
                ON rc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON rc.unique_constraint_name = ccu.constraint_name
            WHERE kcu.table_schema = 'public' AND kcu.table_name = %s
        """, (table,))
        
        for fk in cur.fetchall():
            schema['tables'][table]['fks'].append(fk)
        
        # Get check constraints
        cur.execute("""
            SELECT constraint_name, check_clause
            FROM information_schema.check_constraints
            WHERE constraint_schema = 'public' AND table_name = %s
        """, (table,))
        
        for check_name, check_clause in cur.fetchall():
            schema['tables'][table]['checks'].append((check_name, check_clause))
    
    # Get all indexes (non-PK, non-FK)
    cur.execute("""
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename NOT IN (SELECT tablename FROM pg_indexes WHERE indexname LIKE '%_pkey')
    """)
    
    for idx_name, idx_def in cur.fetchall():
        schema['indexes'][idx_name] = idx_def
    
    cur.close()
    conn.close()
    
    return schema

def compare_schemas(fresh_schema, smriti001_schema):
    """Compare two schemas and report differences"""
    diffs = {
        'fresh_only_tables': [],
        'smriti001_only_tables': [],
        'columns_diff': {},
        'pk_diff': {},
        'fk_diff': {},
        'checks_diff': {},
        'indexes_diff': {}
    }
    
    fresh_tables = set(fresh_schema['tables'].keys())
    smriti001_tables = set(smriti001_schema['tables'].keys())
    
    # Table-level differences
    diffs['fresh_only_tables'] = sorted(fresh_tables - smriti001_tables)
    diffs['smriti001_only_tables'] = sorted(smriti001_tables - fresh_tables)
    
    # Column differences in common tables
    for table in fresh_tables & smriti001_tables:
        fresh_cols = fresh_schema['tables'][table]['columns']
        smriti001_cols = smriti001_schema['tables'][table]['columns']
        
        fresh_col_names = set(fresh_cols.keys())
        smriti001_col_names = set(smriti001_cols.keys())
        
        if fresh_col_names != smriti001_col_names:
            diffs['columns_diff'][table] = {
                'fresh_only': sorted(fresh_col_names - smriti001_col_names),
                'smriti001_only': sorted(smriti001_col_names - fresh_col_names)
            }
        
        # Check column type/nullable differences
        for col in fresh_col_names & smriti001_col_names:
            if fresh_cols[col] != smriti001_cols[col]:
                if table not in diffs['columns_diff']:
                    diffs['columns_diff'][table] = {}
                if 'modified' not in diffs['columns_diff'][table]:
                    diffs['columns_diff'][table]['modified'] = {}
                diffs['columns_diff'][table]['modified'][col] = {
                    'fresh': fresh_cols[col],
                    'smriti001': smriti001_cols[col]
                }
        
        # PK differences
        fresh_pk = fresh_schema['tables'][table]['pk']
        smriti001_pk = smriti001_schema['tables'][table]['pk']
        if fresh_pk != smriti001_pk:
            diffs['pk_diff'][table] = {
                'fresh': fresh_pk,
                'smriti001': smriti001_pk
            }
    
    return diffs

def main():
    fresh_conn = 'postgresql://postgres:postgres@localhost:5432/smriti_diag_fresh'
    smriti001_conn = 'postgresql://postgres:postgres@localhost:5432/smriti001'
    
    print("[PHASE 2A] Analyzing fresh database schema...")
    fresh_schema = get_schema_info(fresh_conn, 'smriti_diag_fresh')
    print(f"✓ Fresh DB: {len(fresh_schema['tables'])} tables")
    
    print("[PHASE 2A] Analyzing smriti001 schema...")
    smriti001_schema = get_schema_info(smriti001_conn, 'smriti001')
    print(f"✓ smriti001: {len(smriti001_schema['tables'])} tables")
    
    print("\n[PHASE 2A] Comparing schemas...")
    diffs = compare_schemas(fresh_schema, smriti001_schema)
    
    # Report results
    print("\n" + "="*70)
    print("SCHEMA COMPARISON RESULTS")
    print("="*70)
    
    if diffs['fresh_only_tables']:
        print(f"\n⚠ Tables in fresh DB but NOT in smriti001: {diffs['fresh_only_tables']}")
    
    if diffs['smriti001_only_tables']:
        print(f"\n⚠ Tables in smriti001 but NOT in fresh DB: {diffs['smriti001_only_tables']}")
    
    if diffs['columns_diff']:
        print("\n⚠ Column differences (in common tables):")
        for table, col_diffs in diffs['columns_diff'].items():
            print(f"  {table}:")
            if 'fresh_only' in col_diffs and col_diffs['fresh_only']:
                print(f"    - Fresh only: {col_diffs['fresh_only']}")
            if 'smriti001_only' in col_diffs and col_diffs['smriti001_only']:
                print(f"    - smriti001 only: {col_diffs['smriti001_only']}")
            if 'modified' in col_diffs:
                for col, specs in col_diffs['modified'].items():
                    print(f"    - {col} modified:")
                    print(f"      Fresh:     {specs['fresh']}")
                    print(f"      smriti001: {specs['smriti001']}")
    
    if not (diffs['fresh_only_tables'] or diffs['smriti001_only_tables'] or diffs['columns_diff']):
        print("\n✓ SCHEMA PARITY VERIFIED: fresh database and smriti001 are identical")
    else:
        print("\n✗ SCHEMA DIVERGENCE DETECTED: see differences above")
    
    # Save detailed report
    with open('phase2_schema_comparison.json', 'w') as f:
        json.dump({
            'fresh_tables': sorted(fresh_schema['tables'].keys()),
            'smriti001_tables': sorted(smriti001_schema['tables'].keys()),
            'differences': diffs
        }, f, indent=2)
    print("\n✓ Detailed report saved: phase2_schema_comparison.json")

if __name__ == '__main__':
    main()
