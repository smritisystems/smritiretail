import psycopg2

DBS = ['smritisys', 'smriti001']
TARGETS = ['companies', 'company_database_registries', 'products', 'control_psv_configs', 'sales_returns']

for dbname in DBS:
    print(f'## {dbname}')
    conn = psycopg2.connect(dbname=dbname, user='postgres', password='postgres', host='localhost', port=5432)
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(%s) ORDER BY table_name;", (TARGETS,))
    print('tables_present=', cur.fetchall())
    for tbl in TARGETS:
        cur.execute("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=%s);", (tbl,))
        exists = cur.fetchone()[0]
        if exists:
            cur.execute("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position;", (tbl,))
            print(tbl, cur.fetchall())
    cur.close(); conn.close()
