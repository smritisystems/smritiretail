#!/usr/bin/env python3
"""
Check database schema for purchase orders
"""
import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()

print("=" * 80)
print("DATABASE SCHEMA ANALYSIS")
print("=" * 80)

# Check what columns are in purchase_orders
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'purchase_orders'
    ORDER BY ordinal_position
""")

print("\n✓ purchase_orders columns:")
for col in cur.fetchall():
    print(f"   {col[0]}: {col[1]}")

# Check purchase_order_items columns
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'purchase_order_items'
    ORDER BY ordinal_position
""")

print("\n✓ purchase_order_items columns:")
for col in cur.fetchall():
    print(f"   {col[0]}: {col[1]}")

# Count records
cur.execute("SELECT COUNT(*) FROM purchase_orders")
po_count = cur.fetchone()[0]
print(f"\n✓ Total purchase_orders: {po_count}")

cur.execute("SELECT COUNT(*) FROM purchase_order_items")
poi_count = cur.fetchone()[0]
print(f"✓ Total purchase_order_items: {poi_count}")

# Show first 5 POs
print("\n✓ First 5 purchase orders:")
cur.execute("SELECT id, po_no FROM purchase_orders LIMIT 5")
for row in cur.fetchall():
    print(f"   ID: {row[0]}, PO#: {row[1]}")

cur.close()
conn.close()
