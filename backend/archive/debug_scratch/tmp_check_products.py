import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()
cur.execute("SELECT id, code, company_id, tracking_mode FROM products WHERE is_deleted=false ORDER BY created_at DESC LIMIT 10;")
for r in cur.fetchall():
    print(r)
conn.close()
