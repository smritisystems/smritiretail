#!/usr/bin/env python3
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
from datetime import datetime

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=== SALES_ORDERS TABLE SCHEMA ===")
cur.execute("""
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'sales_orders'
ORDER BY ordinal_position
""")
columns = cur.fetchall()
for col in columns:
    print(f"{col['column_name']:30} {col['data_type']:20} nullable={col['is_nullable']:5} default={col['column_default']}")

print("\n=== SAMPLE RECORD FROM DB ===")
cur.execute("SELECT * FROM sales_orders LIMIT 1")
sample = cur.fetchone()
if sample:
    for k, v in sample.items():
        print(f"{k:30} = {v}")
        
print("\n=== CHECKING COMPANY AND BRANCH ===")
cur.execute("SELECT company_id, name FROM companies LIMIT 1")
company = cur.fetchone()
if company:
    print(f"Company: {company}")
    
cur.execute("SELECT branch_id, name FROM branches LIMIT 1") 
branch = cur.fetchone()
if branch:
    print(f"Branch: {branch}")

cur.execute("SELECT customer_id, customer_code, customer_name FROM customers WHERE customer_name LIKE '%Reliance%' LIMIT 1")
customer = cur.fetchone()
if customer:
    print(f"Customer: {customer}")

cur.close()
conn.close()
