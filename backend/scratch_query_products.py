import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:2781/smriti001')
cur = conn.cursor()
cur.execute("""
    SELECT b.barcode, b.variant_id, b.item_id, v.variant_sku, v.selling_price, v.mrp
    FROM item_barcodes b
    LEFT JOIN item_variants v ON b.variant_id = v.id
    WHERE b.barcode IN ('8904551002228', '8904551001108')
""")
for r in cur.fetchall():
    print('BARCODE:', r)
