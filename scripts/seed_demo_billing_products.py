import psycopg2
import uuid

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
cur = conn.cursor()

# 1. Update existing conflict barcodes in COMP-001 in item_barcodes
cur.execute("UPDATE item_barcodes SET barcode = '8901234567899' WHERE id = 'bc_872c0c256ade'")

# 2. Seed Canonical Items
canonical_items = [
    ("itm-snd-18", "SND-18", "Regular Sandal", 750.00, 750.00, 400.00, 5.00, "Footwear"),
    ("itm-spl-22", "SPL-22", "Sport Shoe", 1200.00, 1200.00, 700.00, 5.00, "Footwear"),
]

for i_id, i_code, i_name, mrp, price, cost, tax_rate, cat in canonical_items:
    cur.execute("""
        INSERT INTO items (
            id, uuid, company_id, branch_id, item_code, item_name, item_type,
            tax_rate, mrp, selling_price, cost_price, is_batch_tracked, is_serial_tracked,
            is_favorite, status, least_saleable_qty, tracking_type, tracking_mode,
            is_inventory_yn, is_billable_yn, is_service_yn, category, is_active, is_deleted
        ) VALUES (
            %s, %s, 'COMP-001', 'MAIN', %s, %s, 'GOODS',
            %s, %s, %s, %s, false, false,
            false, 'ACTIVE', 1, 'NONE', 'NONE',
            true, true, false, %s, true, false
        ) ON CONFLICT (id) DO UPDATE SET
            mrp = EXCLUDED.mrp, selling_price = EXCLUDED.selling_price, status = 'ACTIVE'
    """, (i_id, str(uuid.uuid4()), i_code, i_name, tax_rate, mrp, price, cost, cat))

# 3. Seed Canonical Item Variants
canonical_variants = [
    ("P-SND-18-36", "itm-snd-18", "SND-18-36", "Regular Sandal 36 Beige", 750.00, 750.00, 400.00, "36", "BEIGE", "6403", 5.00),
    ("P-SND-18-37", "itm-snd-18", "SND-18-37", "Regular Sandal 37 Beige", 750.00, 750.00, 400.00, "37", "BEIGE", "6403", 5.00),
    ("P-SPL-22-42", "itm-spl-22", "SPL-22-42", "Sport Shoe 42 White", 1200.00, 1200.00, 700.00, "42", "WHITE", "6404", 5.00),
]

for v_id, i_id, v_sku, v_name, mrp, price, cost, size, color, hsn, tax_rate in canonical_variants:
    cur.execute("""
        INSERT INTO item_variants (
            id, uuid, company_id, branch_id, item_id, variant_sku, variant_name,
            mrp, selling_price, cost_price, size, color, hsn_code, tax_rate,
            status, is_active, is_deleted
        ) VALUES (
            %s, %s, 'COMP-001', 'MAIN', %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            'ACTIVE', true, false
        ) ON CONFLICT (id) DO UPDATE SET
            mrp = EXCLUDED.mrp, selling_price = EXCLUDED.selling_price, status = 'ACTIVE'
    """, (v_id, str(uuid.uuid4()), i_id, v_sku, v_name, mrp, price, cost, size, color, hsn, tax_rate))

# 4. Seed Canonical Item Barcodes
barcodes = [
    ("bc-snd-18-36", "itm-snd-18", "P-SND-18-36", "8901234567890"),
    ("bc-snd-18-37", "itm-snd-18", "P-SND-18-37", "8901234567891"),
    ("bc-spl-22-42", "itm-spl-22", "P-SPL-22-42", "8901234567893"),
]

for b_id, i_id, v_id, bcode in barcodes:
    cur.execute("""
        INSERT INTO item_barcodes (
            id, uuid, company_id, branch_id, item_id, variant_id, barcode,
            barcode_type, is_primary, barcode_purpose, encoding_standard,
            status, source, is_active, is_deleted
        ) VALUES (
            %s, %s, 'COMP-001', 'MAIN', %s, %s, %s,
            'EAN13', true, 'SALES', 'EAN13',
            'ASSIGNED', 'MANUAL', true, false
        ) ON CONFLICT (id) DO UPDATE SET
            barcode = EXCLUDED.barcode, status = 'ASSIGNED'
    """, (b_id, str(uuid.uuid4()), i_id, v_id, bcode))

conn.commit()
print("All canonical and legacy product assets seeded successfully!")
conn.close()
