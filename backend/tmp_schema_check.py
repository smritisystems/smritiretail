import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

for tbl in ('sales_invoices', 'sales_invoice_items'):
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s
        ORDER BY ordinal_position;
    """, (tbl,))
    rows = cur.fetchall()
    print(f"\n=== {tbl} ({len(rows)} cols) ===")
    for r in rows:
        print(f"  {r[0]:45s} {r[1]:25s} nullable={r[2]}  default={r[3]}")

# Also check products for a seeding anchor
cur.execute("""
    SELECT id, code, name, company_id, is_deleted
    FROM products WHERE company_id='COMP-001' AND is_deleted=false LIMIT 5;
""")
rows = cur.fetchall()
print(f"\n=== products (COMP-001, sample) ===")
for r in rows:
    print(r)

conn.close()
