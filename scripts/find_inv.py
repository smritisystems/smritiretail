import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()
cur.execute("SELECT id, invoice_no, company_id, branch_id FROM sales_invoices WHERE id LIKE '%60a109a6ab4c%' OR invoice_no LIKE '%60a109a6ab4c%';")
print("Found matching:", cur.fetchall())

cur.execute("SELECT id, invoice_no, company_id, branch_id FROM sales_invoices LIMIT 5;")
print("Sample 5 invoices:", cur.fetchall())
conn.close()
