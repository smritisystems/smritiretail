#!/usr/bin/env python3
"""
Compare items vs products table to see where barcodes should be
"""
import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

print("=" * 80)
print("COMPARING items vs products TABLE")
print("=" * 80)

# Check items table structure
cur.execute('''
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'items'
    ORDER BY ordinal_position
''')

print("\nITEMS table columns:")
print("-" * 80)
items_cols = cur.fetchall()
for row in items_cols:
    print(f"  {row[0]:30} ({row[1]})")

# Check products table structure
cur.execute('''
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products'
    ORDER BY ordinal_position
''')

print("\nPRODUCTS table columns:")
print("-" * 80)
products_cols = cur.fetchall()
for row in products_cols:
    print(f"  {row[0]:30} ({row[1]})")

# Count records in both
cur.execute('SELECT COUNT(*) FROM items WHERE is_deleted = FALSE')
items_count = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM products WHERE is_deleted = FALSE')
products_count = cur.fetchone()[0]

print(f"\nRECORD COUNTS:")
print("-" * 80)
print(f"  items (active):     {items_count}")
print(f"  products (active):  {products_count}")

# Check if items table has barcode column
cur.execute('''
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_name = 'items' 
    AND column_name = 'barcode'
''')
has_barcode_items = cur.fetchone()[0] > 0

cur.execute('''
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'barcode'
''')
has_barcode_products = cur.fetchone()[0] > 0

print(f"\nBARCODE COLUMN:")
print("-" * 80)
print(f"  items has barcode:     {'YES' if has_barcode_items else 'NO'}")
print(f"  products has barcode:  {'YES' if has_barcode_products else 'NO'}")

# Show sample data
print(f"\nSAMPLE DATA - PRODUCTS table (with barcodes):")
print("-" * 80)
cur.execute('''
    SELECT id, code, name, barcode 
    FROM products 
    WHERE barcode LIKE '890%'
    LIMIT 3
''')
for row in cur.fetchall():
    print(f"  ID: {row[0]}, Code: {row[1]}, Name: {row[2]}, Barcode: {row[3]}")

print(f"\nSAMPLE DATA - ITEMS table:")
print("-" * 80)
cur.execute('''
    SELECT id, item_code, item_name 
    FROM items 
    WHERE is_deleted = FALSE
    LIMIT 3
''')
for row in cur.fetchall():
    print(f"  ID: {row[0]}, Item Code: {row[1]}, Item Name: {row[2]}")

cur.close()
conn.close()
