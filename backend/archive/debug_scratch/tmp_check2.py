import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

cur.execute("SELECT id, code FROM products WHERE company_id='COMP-001' AND is_deleted=false ORDER BY id;")
prods = cur.fetchall()
print(f"COMP-001 products: {len(prods)}")
for p in prods[:5]:
    print("  ", p)

cur.execute("SELECT id, code, company_id FROM branches WHERE company_id='COMP-001' LIMIT 10;")
branches = cur.fetchall()
print("Branches COMP-001:", branches)

# Also check stock_movements table has reference_doc_id column
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_movements'
    AND column_name IN ('reference_doc_id','reference_doc_type','company_id','branch_id','is_deleted');
""")
print("stock_movements key cols:", [r[0] for r in cur.fetchall()])

conn.close()
