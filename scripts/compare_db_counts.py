import psycopg2

conn_sys = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
cur_sys = conn_sys.cursor()
cur_sys.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
print("smritisys table count:", cur_sys.fetchone()[0])
try:
    cur_sys.execute("SELECT count(*) FROM sales_invoices;")
    print("smritisys sales_invoices count:", cur_sys.fetchone()[0])
except Exception as e:
    print("smritisys sales_invoices error:", e)
conn_sys.close()

conn_001 = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur_001 = conn_001.cursor()
cur_001.execute("SELECT count(*) FROM sales_invoices;")
print("smriti001 sales_invoices count:", cur_001.fetchone()[0])
conn_001.close()
