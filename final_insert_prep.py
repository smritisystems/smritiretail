#!/usr/bin/env python3
import psycopg2
import json

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()

print('=== CUSTOMERS TABLE COLUMNS ===')
cur.execute('SELECT column_name FROM information_schema.columns WHERE table_name = %s ORDER BY ordinal_position', ('customers',))
for row in cur.fetchall():
    print(f'  {row[0]}')

print('\n=== CUSTOMERS WITH RELIANCE ===')
cur.execute('SELECT * FROM customers WHERE customer_name LIKE %s LIMIT 1', ('%Reliance%',))
cols = [desc[0] for desc in cur.description]
row = cur.fetchone()
if row:
    data = dict(zip(cols, row))
    print(json.dumps(data, indent=2, default=str))

print('\n=== COMPANIES ===')
cur.execute('SELECT id, company_code, company_name FROM companies LIMIT 1')
row = cur.fetchone()
if row:
    print(f'ID: {row[0]}, Code: {row[1]}, Name: {row[2]}')

print('\n=== BRANCHES ===')
cur.execute('SELECT id, branch_code, branch_name FROM branches LIMIT 1')
row = cur.fetchone()
if row:
    print(f'ID: {row[0]}, Code: {row[1]}, Name: {row[2]}')

cur.close()
conn.close()
