"""
Forensic Investigation of alembic_version and Table Origins in smritisys and smriti001
"""
import psycopg2

tables_to_check = [
    'eway_bills',
    'ecom_channels',
    'ecom_sku_mappings',
    'ecom_order_imports',
    'ecom_stock_sync_logs',
    'ecom_reconciliations'
]

for db in ['smritisys', 'smriti001']:
    conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db}')
    cur = conn.cursor()
    print(f"\n========================================================")
    print(f" DATABASE: {db}")
    print(f"========================================================")

    # 1. Check alembic_version
    try:
        cur.execute("SELECT version_num FROM alembic_version;")
        versions = [r[0] for r in cur.fetchall()]
        print(f"alembic_version: {versions}")
    except Exception as e:
        print(f"alembic_version error: {e}")
        conn.rollback()

    # 2. Check table details from pg_class
    print("\nTable Details from pg_class:")
    for t in tables_to_check:
        cur.execute("""
            SELECT c.relname, c.relfilenode, c.reltuples, n.nspname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = %s;
        """, (t,))
        row = cur.fetchone()
        if row:
            print(f"  • {t:<22} : PRESENT in {row[3]} (relfilenode={row[1]}, tuples={row[2]})")
        else:
            print(f"  • {t:<22} : NOT PRESENT")

    conn.close()
