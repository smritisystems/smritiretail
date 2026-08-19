import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='sales_invoices';")
print("Columns:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT id, invoice_no, total_amount, grand_total, customer_name FROM sales_invoices LIMIT 5;")
for r in cur.fetchall():
    print("Sample invoice:", r)
conn.close()
