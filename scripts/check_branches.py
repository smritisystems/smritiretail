import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

tables = ['sales_invoices', 'products', 'customers', 'customer_groups', 'pos_shifts', 'pos_profiles']
for t in tables:
    try:
        cur.execute(f"SELECT DISTINCT branch_id, company_id FROM {t};")
        print(f"Table {t} distinct (branch_id, company_id):", cur.fetchall())
    except Exception as e:
        conn.rollback()
        print(f"Table {t} error:", e)

conn.close()
