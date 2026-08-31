"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.36.0
Created      : 2026-08-27
Modified     : 2026-08-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import uuid
import re
from decimal import Decimal
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor


def parse_sku_details(code: str, name: str):
    """
    Parses Style, Color, Size, Category from SKU codes like:
    CH-04-A-BLACK-39 -> Style: CH-04-A, Color: BLACK, Size: 39, Cat: CHAPPAL
    SND-07-G-GOLD-36 -> Style: SND-07-G, Color: GOLD, Size: 36, Cat: SANDAL
    """
    clean_code = code.strip().upper()
    parts = clean_code.split("-")
    
    # Determine category
    category = "CHAPPAL"
    if clean_code.startswith("SND-"):
        category = "SANDAL"
    elif clean_code.startswith("SH-") or clean_code.startswith("SHO-"):
        category = "SHOE"
    elif clean_code.startswith("SL-") or clean_code.startswith("SLP-"):
        category = "SLIPPER"
    elif clean_code.startswith("HEEL-") or clean_code.startswith("HL-"):
        category = "HEELS"
        
    size = ""
    color = ""
    style_code = ""
    
    # Try pattern: PREFIX-NUM-LETTER-COLOR-SIZE (e.g. CH-04-A-BLACK-39 or CH-01-A-ROSEGOLD-40)
    # Check if last part is numeric (size)
    if len(parts) >= 4:
        if parts[-1].isdigit():
            size = parts[-1]
            color = parts[-2]
            style_code = "-".join(parts[:-2])
        else:
            # Maybe color-size joined
            style_code = "-".join(parts[:-1])
            color = parts[-1]
    elif len(parts) == 3:
        if parts[-1].isdigit():
            size = parts[-1]
            color = parts[-2]
            style_code = parts[0]
        else:
            style_code = "-".join(parts[:2])
            color = parts[2]
    else:
        style_code = clean_code
        color = "STANDARD"
        size = "STANDARD"

    return {
        "style_code": style_code,
        "color": color,
        "size": size,
        "category": category,
    }


def populate_missing_historical_products(
    database: str = "smriti001",
    dry_run: bool = True
):
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{database}")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Find all distinct unmapped items from sales_invoice_items
    cur.execute("""
        SELECT 
            it.code,
            it.name,
            MAX(it.price) as price,
            MAX(it.gst_rate) as gst_rate,
            COUNT(*) as line_count,
            SUM(it.quantity) as total_sold_qty
        FROM sales_invoice_items it
        LEFT JOIN products p ON (p.id = it.product_id OR p.code = it.code)
        WHERE p.id IS NULL
        GROUP BY it.code, it.name
        ORDER BY it.code ASC;
    """)
    missing_items = cur.fetchall()
    print(f"Found {len(missing_items)} distinct missing product SKUs in historical invoices.")

    # 2. Get existing barcodes to ensure uniqueness
    cur.execute("SELECT barcode FROM products WHERE barcode IS NOT NULL;")
    existing_barcodes = {r["barcode"] for r in cur.fetchall()}

    barcode_base = 8904551000000
    barcode_counter = 1000

    products_to_create = []
    for item in missing_items:
        code = item["code"].strip()
        name = item["name"].strip() if item.get("name") else code
        price = Decimal(str(item.get("price") or "999.00"))
        gst_rate = Decimal(str(item.get("gst_rate") or "5.00"))
        mrp = round(price * Decimal("1.78"), 2)  # Typical wholesale to retail markup

        parsed = parse_sku_details(code, name)
        prod_id = f"prod-{code.lower()}"
        
        # Generate unique barcode
        while True:
            candidate_barcode = str(barcode_base + barcode_counter)
            barcode_counter += 1
            if candidate_barcode not in existing_barcodes:
                existing_barcodes.add(candidate_barcode)
                barcode = candidate_barcode
                break

        product_record = {
            "id": prod_id,
            "uuid": str(uuid.uuid4()),
            "code": code,
            "name": name,
            "sku": code,
            "style_code": parsed["style_code"],
            "color": parsed["color"],
            "size": parsed["size"],
            "brand": "Tattly Threads",
            "category": parsed["category"],
            "barcode": barcode,
            "hsn_code": "64032012",
            "gst_percentage": gst_rate,
            "price": price,
            "mrp": mrp,
            "cost_price": round(price * Decimal("0.60"), 2),
            "stock": 0,
            "reserved_stock": Decimal("0.00"),
            "tracking_mode": "Standard",
            "pricing_mode": "FIXED",
            "company_id": "COMP-001",
            "branch_id": "MAIN",
            "is_active": True,
            "is_deleted": False,
            "version": 1,
            "line_count": item["line_count"],
            "total_sold_qty": item["total_sold_qty"],
        }
        products_to_create.append(product_record)

    print("\n--- SAMPLE PRODUCTS TO REGISTER ---")
    for p in products_to_create[:5]:
        print(f"ID: {p['id']} | Code: {p['code']} | Style: {p['style_code']} | Color: {p['color']} | Size: {p['size']} | Barcode: {p['barcode']} | Price: {p['price']} | GST: {p['gst_percentage']}%")

    if dry_run:
        print(f"\n[DRY-RUN] Would create {len(products_to_create)} product records in 'products' table.")
        conn.close()
        return products_to_create

    print(f"\n[APPLY] Inserting {len(products_to_create)} product records into 'products' table...")
    for p in products_to_create:
        cur.execute("""
            INSERT INTO products (
                id, uuid, code, name, sku, style_code, color, size, brand, category,
                barcode, hsn_code, gst_percentage, price, mrp, cost_price, stock,
                reserved_stock, tracking_mode, pricing_mode, company_id, branch_id,
                is_active, is_deleted, version, created_at, modified_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, NOW(), NOW()
            ) ON CONFLICT (code) DO NOTHING;
        """, (
            p["id"], p["uuid"], p["code"], p["name"], p["sku"], p["style_code"], p["color"], p["size"],
            p["brand"], p["category"], p["barcode"], p["hsn_code"], p["gst_percentage"], p["price"],
            p["mrp"], p["cost_price"], p["stock"], p["reserved_stock"], p["tracking_mode"],
            p["pricing_mode"], p["company_id"], p["branch_id"], p["is_active"], p["is_deleted"], p["version"]
        ))

    # Link product_id in sales_invoice_items
    print("Linking product_id in sales_invoice_items...")
    cur.execute("""
        UPDATE sales_invoice_items it
        SET product_id = p.id
        FROM products p
        WHERE (it.product_id IS NULL OR it.product_id = '')
          AND (it.code = p.code OR it.code = p.sku);
    """)
    updated_lines = cur.rowcount
    print(f"Updated {updated_lines} historical invoice lines with canonical product_id.")

    conn.commit()
    conn.close()
    print("Registration and invoice item linking completed successfully.")
    return products_to_create


if __name__ == "__main__":
    dry_run = "--apply" not in sys.argv
    populate_missing_historical_products(dry_run=dry_run)
