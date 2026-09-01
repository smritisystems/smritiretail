#!/usr/bin/env python3
"""
Import items using REAL EAN/Barcode data from TT.CSV
Extracts products with actual EAN codes and imports to smriti001
"""
import csv
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime
from uuid import uuid4

barcode_file = 'TT/tt.csv'

print("=" * 80)
print("IMPORT: Tax Items with REAL EAN/Barcodes from TT.CSV")
print("=" * 80)

# Read barcode CSV file
print(f"\n✓ Reading {barcode_file}...")
products_with_barcodes = {}

with open(barcode_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    row_count = 0
    
    for row in reader:
        row_count += 1
        
        article = row.get('Style / Article', '').strip()
        color = row.get('Color', '').strip()
        size = row.get('Size', '').strip()
        barcode = row.get('EAN / Barcode', '').strip()
        mrp_str = row.get('MRP (₹)', '').strip().replace('₹ ', '').replace(',', '')
        hsn = row.get('HSN Code', '').strip()
        product_name = row.get('Product Name', '').strip()
        
        # Skip if missing critical data
        if not article or not barcode or not mrp_str:
            continue
        
        # Create key by article-color-size (unique product variant)
        key = f'{article}|{color}|{size}'
        
        # Store only first occurrence (handle duplicates)
        if key not in products_with_barcodes:
            try:
                mrp = float(mrp_str)
            except:
                mrp = 0
            
            products_with_barcodes[key] = {
                'article': article,
                'color': color,
                'size': size,
                'barcode': barcode,  # REAL EAN/Barcode
                'mrp': mrp,
                'hsn': hsn,
                'product_name': product_name,
                'sku': f'{article}-{color}-{size}'  # Create SKU from components
            }

print(f"   Read {row_count} rows from CSV")
print(f"   Found {len(products_with_barcodes)} unique products with real barcodes")

# Connect to smriti001
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

print(f"\n✓ Connected to smriti001")

# Get company ID for Tattly Threads
cur.execute("SELECT id FROM companies WHERE name LIKE '%Tattly%' LIMIT 1")
result = cur.fetchone()
if result:
    company_id = result[0]
    print(f"   Company: {company_id}")
else:
    cur.execute("SELECT id FROM companies LIMIT 1")
    company_id = cur.fetchone()[0]
    print(f"   Company: {company_id} (default)")

# Get a branch ID
cur.execute("SELECT id FROM branches LIMIT 1")
branch_id = cur.fetchone()[0]
print(f"   Branch: {branch_id}")

# Check existing products
cur.execute("SELECT COUNT(*) FROM products WHERE is_deleted = FALSE")
existing_count = cur.fetchone()[0]
print(f"   Existing products: {existing_count}")

# Check existing barcodes
cur.execute("SELECT barcode FROM products WHERE is_deleted = FALSE AND barcode IS NOT NULL")
existing_barcodes = {row[0] for row in cur.fetchall()}
print(f"   Existing barcodes: {len(existing_barcodes)}")

# Check existing variants
cur.execute("""
    SELECT DISTINCT LOWER(style_code), LOWER(color), LOWER(size)
    FROM products
    WHERE company_id = %s AND is_deleted = FALSE
""", (company_id,))
existing_variants = {(row[0], row[1], row[2]) for row in cur.fetchall()}
print(f"   Existing variants: {len(existing_variants)}")

# Filter products - only import if barcode doesn't already exist and variant is new
new_products = {}
skipped_barcode = 0
skipped_variant = 0

for key, product in products_with_barcodes.items():
    # Check if barcode already exists
    if product['barcode'] in existing_barcodes:
        skipped_barcode += 1
        continue
    
    # Check if variant already exists
    variant_key = (
        product['article'].lower(),
        product['color'].lower(),
        product['size'].lower()
    )
    if variant_key in existing_variants:
        skipped_variant += 1
        continue
    
    new_products[key] = product

print(f"\n✓ Product Filtering:")
print(f"   Skipped (barcode exists): {skipped_barcode}")
print(f"   Skipped (variant exists): {skipped_variant}")
print(f"   After filtering: {len(new_products)} truly new products")

# Prepare insert data with REAL barcodes
insert_data = []
for key, product in new_products.items():
    # Generate code from article-color-size
    code = f"{product['article']}{product['color'].upper()}{product['size']}".replace(' ', '')[:30]
    
    insert_data.append((
        code,  # code (NOT NULL, PK)
        product['product_name'] or f"{product['article']} {product['color']} {product['size']}",  # name
        float(product['mrp']),  # price (use MRP)
        0,  # stock (default 0)
        'FOOTWEAR',  # category
        product['barcode'],  # barcode - REAL EAN CODE (NOT NULL)
        float(product['mrp']),  # mrp
        5.0,  # gst_percentage
        product['sku'],  # sku
        product['article'],  # style_code
        float(product['mrp']) * 0.75,  # cost_price (assume 25% margin)
        product['color'],  # color
        product['size'],  # size
        product['hsn'],  # hsn_code
        0,  # reserved_stock
        str(uuid4()),  # id
        str(uuid4()),  # uuid
        company_id,  # company_id
        branch_id,  # branch_id
        datetime.now().isoformat(),  # created_at
        datetime.now().isoformat(),  # modified_at
        'SYSTEM',  # created_by
        'SYSTEM',  # updated_by
        True,  # is_active
        False,  # is_deleted
        None,  # deleted_at
        None,  # deleted_by
        1,  # version
    ))

# Insert products with REAL barcodes
if insert_data:
    print(f"\n✓ Inserting {len(insert_data)} products with REAL EAN/Barcodes...")
    
    insert_sql = '''
        INSERT INTO products (
            code, name, price, stock, category, barcode, mrp, gst_percentage,
            sku, style_code, cost_price, color, size, hsn_code, reserved_stock,
            id, uuid, company_id, branch_id, created_at, modified_at,
            created_by, updated_by, is_active, is_deleted, deleted_at,
            deleted_by, version
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    '''
    
    try:
        execute_batch(cur, insert_sql, insert_data, page_size=100)
        conn.commit()
        print(f"   ✅ Successfully inserted {len(insert_data)} products")
        
        # Show sample of imported products
        print(f"\n✓ Sample imported products (with REAL EAN barcodes):")
        for i, (key, product) in enumerate(list(new_products.items())[:5]):
            print(f"   {i+1}. {product['article']} {product['color']} {product['size']} | EAN: {product['barcode']}")
    except Exception as e:
        conn.rollback()
        print(f"   ❌ Error: {e}")
        cur.close()
        conn.close()
        exit(1)
else:
    print("\n✓ All products already imported")

# Final count
cur.execute("SELECT COUNT(*) FROM products WHERE is_deleted = FALSE")
final_count = cur.fetchone()[0]
added_count = final_count - existing_count

print(f"\n✓ Final product count: {final_count}")
print(f"   Added: {added_count}")

cur.close()
conn.close()

print("\n" + "=" * 80)
print("✅ IMPORT COMPLETE - Using REAL EAN/Barcodes from TT.CSV")
print("=" * 80)
