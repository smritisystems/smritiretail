#!/usr/bin/env python3
import psycopg2
import uuid
from datetime import datetime

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()

print('=== SALES_ORDERS COLUMNS ===')
cur.execute('''
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sales_orders'
ORDER BY ordinal_position
''')
for row in cur.fetchall():
    print(f'{row[0]:35} {row[1]:20} nullable={row[2]}')

print('\n=== SAMPLE SALES_ORDER ===')
cur.execute('SELECT id, order_no, customer_name, grand_total, date FROM sales_orders LIMIT 1')
row = cur.fetchone()
if row:
    print(f'ID: {row[0]}')
    print(f'Order No: {row[1]}')
    print(f'Customer: {row[2]}')
    print(f'Grand Total: {row[3]}')
    print(f'Date: {row[4]}')

print('\n=== CHECKING FOR RELIANCE CUSTOMER ===')
cur.execute('SELECT customer_id, customer_code, customer_name FROM customers WHERE customer_name LIKE %s LIMIT 3', 
('%Reliance%',))
for row in cur.fetchall():
    print(f'Customer ID={row[0]}, Code={row[1]}, Name={row[2]}')

print('\n=== CHECKING COMPANIES/BRANCHES ===')
cur.execute('SELECT company_code, company_name FROM companies LIMIT 1')
comp = cur.fetchone()
if comp:
    print(f'Company: {comp}')
    
cur.execute('SELECT branch_code, branch_name FROM branches LIMIT 1')
br = cur.fetchone()
if br:
    print(f'Branch: {br}')

cur.close()
conn.close()
