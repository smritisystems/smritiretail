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
    SELECT DISTINCT 
        s.code, 
        s.name, 
        s.unit_price, 
        p.mrp
    FROM sales_invoice_items s 
    LEFT JOIN products p ON s.product_id = p.id OR s.code = p.code
    ORDER BY s.unit_price DESC;
""")

rows = cur.fetchall()
print(f"Total distinct code/price pairs: {len(rows)}")
for r in rows:
    code, name, unit_price, mrp = r
    unit_p = float(unit_price) if unit_price else 0
    mrp_v = float(mrp) if mrp else (1899 if unit_p == 1068 else (2199 if unit_p == 1236.72 else round(unit_p * 1.778)))
    disc = mrp_v - unit_p
    print(f"Code: {code:20s} | UnitPrice (Rate): {unit_p:8.2f} | MRP: {mrp_v:8.2f} | Disc: {disc:8.2f}")

conn.close()
