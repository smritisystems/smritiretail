"""
Read-Only Check for E-Way Bills and E-Commerce Tables
"""
import psycopg2

tables = [
    'eway_bills',
    'ecom_channels',
    'ecom_sku_mappings',
    'ecom_order_imports',
    'ecom_stock_sync_logs',
    'ecom_reconciliations'
]

print("=== 1. DATABASE EXISTENCE CHECK ===")
for db in ['smritisys', 'smriti001']:
    conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db}')
    cur = conn.cursor()
    print(f"\nDatabase: {db}")
    for t in tables:
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = %s
            );
        """, (t,))
        exists = cur.fetchone()[0]
        row_cnt = 0
        if exists:
            cur.execute(f'SELECT COUNT(*) FROM public."{t}";')
            row_cnt = cur.fetchone()[0]
        print(f"  • {t:<22} : Exists = {str(exists):<5} | Rows = {row_cnt}")
    conn.close()
