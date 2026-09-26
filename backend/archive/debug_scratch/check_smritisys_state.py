import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()

# Check if payment_transactions exists
cur.execute("SELECT to_regclass('public.payment_transactions')")
result = cur.fetchone()[0]

if result:
    print("payment_transactions: EXISTS")
    cur.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'payment_transactions'")
    col_count = cur.fetchone()[0]
    print(f"Columns: {col_count}")
else:
    print("payment_transactions: MISSING")

# Check alembic_version
cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1")
version = cur.fetchone()
if version:
    print(f"Alembic HEAD: {version[0]}")

cur.close()
conn.close()
