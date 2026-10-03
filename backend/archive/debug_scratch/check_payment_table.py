import psycopg2

databases_to_check = ['smritisys', 'smriti001']

for db_name in databases_to_check:
    try:
        conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db_name}')
        cur = conn.cursor()
        
        # Check if payment_transactions exists
        cur.execute("SELECT to_regclass('public.payment_transactions')")
        result = cur.fetchone()[0]
        
        if result:
            print(f'{db_name}: EXISTS')
            # Get column count
            cur.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'payment_transactions'")
            col_count = cur.fetchone()[0]
            print(f'  Columns: {col_count}')
        else:
            print(f'{db_name}: MISSING')
        
        # Check alembic_version
        cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1")
        version = cur.fetchone()
        if version:
            print(f'  Alembic HEAD: {version[0]}')
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f'{db_name}: ERROR - {str(e)[:80]}')
