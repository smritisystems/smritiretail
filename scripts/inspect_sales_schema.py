import psycopg2

for db_name in ['smriti001', 'smriti002', 'smritisys']:
    try:
        conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db_name}')
        cur = conn.cursor()
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='sales_invoices' ORDER BY ordinal_position;")
        cols = cur.fetchall()
        print(f"=== {db_name}.sales_invoices ({len(cols)} columns) ===")
        for name, dtype in cols:
            print(f"  {name}: {dtype}")
        conn.close()
    except Exception as e:
        print(f"Error checking {db_name}: {e}")
