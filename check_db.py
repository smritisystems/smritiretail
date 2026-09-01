#!/usr/bin/env python3
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

# Connect to PostgreSQL
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=== CHECKING TABLES ===")
cur.execute("""
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name
""")
tables = [row['table_name'] for row in cur.fetchall()]
print(f"Available tables ({len(tables)}): {tables[:15]}")

if 'sales_orders' in tables:
    print("\n=== CHECKING sales_orders TABLE ===")
    cur.execute("SELECT COUNT(*) as cnt FROM sales_orders")
    count = cur.fetchone()['cnt']
    print(f"Total records: {count}")
    
    if count > 0:
        cur.execute("""
        SELECT order_no, customer_name, grand_total, date 
        FROM sales_orders 
        ORDER BY date DESC 
        LIMIT 5
        """)
        print("\nLast 5 orders:")
        for row in cur.fetchall():
            print(f"  {row}")
    
    # Check if our order exists
    cur.execute("SELECT * FROM sales_orders WHERE order_no = 'SO-2026-0001'")
    result = cur.fetchone()
    if result:
        print(f"\n✓ FOUND SO-2026-0001: {json.dumps(dict(result), indent=2, default=str)[:500]}")
    else:
        print(f"\n✗ SO-2026-0001 NOT FOUND - need to insert it")
else:
    print("✗ sales_orders table NOT FOUND in database")
    print("\n=== TABLE STRUCTURE ===")
    for table in tables[:10]:
        print(f"\n{table}:")
        cur.execute(f"""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '{table}'
        LIMIT 10
        """)
        for col in cur.fetchall():
            print(f"  - {col['column_name']}: {col['data_type']}")

cur.close()
conn.close()
