import psycopg2

conn = psycopg2.connect(
    dbname="smriti_company_tattly_threads",
    user="postgres",
    password="postgres",
    host="localhost",
    port=5432
)
cur = conn.cursor()

print("--- sales_invoice_items columns ---")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='sales_invoice_items';")
for col in cur.fetchall():
    print(f"  {col[0]}: {col[1]}")

print("\n--- products columns ---")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='products';")
for col in cur.fetchall():
    print(f"  {col[0]}: {col[1]}")

cur.execute("SELECT * FROM products LIMIT 1;")
prod = cur.fetchone()
if prod:
    cols = [d[0] for d in cur.description]
    print("\nSample Product:", dict(zip(cols, prod)))

conn.close()
