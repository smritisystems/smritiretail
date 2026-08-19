import psycopg2

conn_src = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
conn_dst = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
conn_dst.autocommit = True
cur_src = conn_src.cursor()
cur_dst = conn_dst.cursor()

# Try syncing 1 product with detailed error
cur_src.execute("SELECT column_name FROM information_schema.columns WHERE table_name='products';")
scols = set(r[0] for r in cur_src.fetchall())
cur_dst.execute("SELECT column_name FROM information_schema.columns WHERE table_name='products';")
dcols = set(r[0] for r in cur_dst.fetchall())
common_cols = [c for c in scols if c in dcols]

col_names_str = ", ".join(common_cols)
placeholders = ", ".join(["%s"] * len(common_cols))

cur_src.execute(f"SELECT {col_names_str} FROM products LIMIT 1;")
row = cur_src.fetchone()
try:
    insert_stmt = f"INSERT INTO products ({col_names_str}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING;"
    cur_dst.execute(insert_stmt, row)
    print("Product insert success!")
except Exception as e:
    print("Product insert error:", e)

# Try syncing 1 sales_invoice
cur_src.execute("SELECT column_name FROM information_schema.columns WHERE table_name='sales_invoices';")
scols = set(r[0] for r in cur_src.fetchall())
cur_dst.execute("SELECT column_name FROM information_schema.columns WHERE table_name='sales_invoices';")
dcols = set(r[0] for r in cur_dst.fetchall())
common_cols = [c for c in scols if c in dcols]
col_names_str = ", ".join(common_cols)
placeholders = ", ".join(["%s"] * len(common_cols))

cur_src.execute(f"SELECT {col_names_str} FROM sales_invoices WHERE id='inv-60a109a6ab4c';")
row = cur_src.fetchone()
try:
    insert_stmt = f"INSERT INTO sales_invoices ({col_names_str}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING;"
    cur_dst.execute(insert_stmt, row)
    print("Invoice insert success!")
except Exception as e:
    print("Invoice insert error:", e)

conn_src.close()
conn_dst.close()
