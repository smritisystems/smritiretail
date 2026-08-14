import psycopg2

conn = psycopg2.connect(
    dbname="smriti_company_tattly_threads",
    user="postgres",
    password="postgres",
    host="localhost",
    port=5432
)
cur = conn.cursor()

cur.execute("""
    SELECT s.code, s.name, s.unit_price, s.price, p.mrp 
    FROM sales_invoice_items s 
    LEFT JOIN products p ON s.product_id = p.id OR s.code = p.code
    LIMIT 10;
""")
for r in cur.fetchall():
    print(r)

conn.close()
