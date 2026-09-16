import psycopg2
import os
os.environ['POSTGRES_PASSWORD'] = 'postgres'
os.environ['POSTGRES_USER'] = 'postgres'

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

# Check sales_orders columns
cur.execute("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_orders'
ORDER BY ordinal_position
""")

print("=== sales_orders TABLE SCHEMA ===")
cols = cur.fetchall()
for col_name, col_type, nullable in cols:
    null_str = "NULL" if nullable == "YES" else "NOT NULL"
    print(f"  {col_name:30} {col_type:20} {null_str}")

print(f"\nTotal columns: {len(cols)}")

# Check if po_number exists
has_po = any(c[0] == 'po_number' for c in cols)
print(f"Has po_number: {'✅ YES' if has_po else '❌ NO'}")

conn.close()
