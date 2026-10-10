import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE invoice_no LIKE 'HIST-TEST-%');")
print('Deleted test items:', cur.rowcount)

cur.execute("DELETE FROM sales_invoices WHERE invoice_no LIKE 'HIST-TEST-%';")
print('Deleted test invoices:', cur.rowcount)

conn.commit()
conn.close()
