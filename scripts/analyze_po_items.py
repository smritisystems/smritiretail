#!/usr/bin/env python3
"""
Analyze Purchase Orders 18-137 to preview items for import to smriti001
"""
import psycopg2

print("=" * 80)
print("ANALYZING PURCHASE ORDERS 18-137 FOR ITEM IMPORT")
print("=" * 80)

# Connect to control plane
conn_sys = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur_sys = conn_sys.cursor()

# Check purchase orders in range 18-137
cur_sys.execute('''
    SELECT COUNT(*) as total_pos, 
           MIN(id::int) as min_id, 
           MAX(id::int) as max_id
    FROM purchase_orders 
    WHERE id::int BETWEEN 18 AND 137
''')
result = cur_sys.fetchone()
print(f"\n✓ Purchase Orders 18-137: {result[0]} records (IDs: {result[1]}-{result[2]})")

# Get sample PO with line items
cur_sys.execute('''
    SELECT po.id, po.po_no, COUNT(poi.id) as line_items
    FROM purchase_orders po
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    WHERE po.id::int BETWEEN 18 AND 137
    GROUP BY po.id, po.po_no
    ORDER BY po.id::int
    LIMIT 5
''')

print("\n✓ Sample POs with line items:")
for row in cur_sys.fetchall():
    print(f"   PO ID {row[0]}: {row[1]} ({row[2]} line items)")

# Check product details in sample PO items
cur_sys.execute('''
    SELECT DISTINCT 
           p.id, p.sku, p.barcode, p.name, p.article, p.color, p.size
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.purchase_order_id IN (
        SELECT id FROM purchase_orders WHERE id::int BETWEEN 18 AND 137
    )
    LIMIT 10
''')

print("\n✓ Sample products from PO items:")
print("   ID | SKU | Barcode | Name | Article | Color | Size")
print("   " + "-" * 75)
for row in cur_sys.fetchall():
    sku = row[1] if row[1] else "N/A"
    barcode = row[2][:10] if row[2] else "N/A"
    name = row[3][:15] if row[3] else "N/A"
    article = row[4] if row[4] else "N/A"
    color = row[5] if row[5] else "N/A"
    size = row[6] if row[6] else "N/A"
    print(f"   {row[0]} | {sku} | {barcode} | {name:15} | {article} | {color} | {size}")

# Count unique products across range
cur_sys.execute('''
    SELECT COUNT(DISTINCT poi.product_id) as unique_products
    FROM purchase_order_items poi
    JOIN purchase_orders po ON poi.purchase_order_id = po.id
    WHERE po.id::int BETWEEN 18 AND 137
''')
unique_count = cur_sys.fetchone()[0]
print(f"\n✓ Unique products in PO 18-137: {unique_count}")

# Check what's already in smriti001
conn_co = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur_co = conn_co.cursor()

cur_co.execute('SELECT COUNT(*) FROM products')
smriti001_count = cur_co.fetchone()[0]
print(f"\n✓ Current products in smriti001: {smriti001_count}")

cur_sys.close()
conn_sys.close()
cur_co.close()
conn_co.close()

print("\n" + "=" * 80)
print("Analysis complete. Ready to import.")
print("=" * 80)
