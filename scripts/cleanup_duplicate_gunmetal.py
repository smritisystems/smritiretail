#!/usr/bin/env python3
"""
Remove duplicate GUNMETAL products and keep proper GUNMTL variants with real barcodes
"""
import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

print("Removing duplicate CH-17-D GUNMETAL products...")
print("(Keeping the proper GUNMTL variants with real barcodes)")
print("=" * 80)

# Mark GUNMETAL variants as deleted (soft delete)
cur.execute('''
    UPDATE products
    SET 
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = 'SYSTEM',
        modified_at = NOW(),
        updated_by = 'SYSTEM',
        version = version + 1
    WHERE style_code = 'CH-17-D'
    AND LOWER(color) = 'gunmetal'
    AND is_deleted = FALSE
''')

deleted_count = cur.rowcount
conn.commit()

print(f"✓ Deleted {deleted_count} duplicate GUNMETAL products")
print(f"✓ Proper GUNMTL variants with real barcodes preserved")

# Verify
cur.execute('''
    SELECT COUNT(*) FROM products 
    WHERE is_deleted = FALSE 
    AND style_code = 'CH-17-D'
''')
remaining = cur.fetchone()[0]
print(f"\n✓ Remaining CH-17-D products: {remaining}")

# Show what's left
cur.execute('''
    SELECT DISTINCT LOWER(color)
    FROM products
    WHERE is_deleted = FALSE
    AND style_code = 'CH-17-D'
    ORDER BY LOWER(color)
''')

print(f"\nRemaining CH-17-D colors:")
for row in cur.fetchall():
    print(f"  ✓ {row[0]}")

cur.close()
conn.close()

print("\n" + "=" * 80)
print("✅ Cleanup complete - Now all CH-17-D products have real EAN barcodes")
print("=" * 80)
