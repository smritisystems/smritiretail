"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.28.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import os
import json
import uuid
import psycopg2

def import_item_master():
    json_path = os.path.join(os.path.dirname(__file__), "..", "exports", "SMRITI_Item_Master_842.json")
    json_path = os.path.abspath(json_path)

    if not os.path.exists(json_path):
        print(f"ERROR: Export file not found at {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        raw_items = json.load(f)

    print(f"Loaded {len(raw_items)} records from {json_path}")

    # 1. Update db_store.json
    db_store_path = os.path.join(os.path.dirname(__file__), "..", "db_store.json")
    db_store_path = os.path.abspath(db_store_path)

    try:
        with open(db_store_path, "r", encoding="utf-8") as f:
            store_data = json.load(f)
    except Exception:
        store_data = {}

    db_products = []
    for item in raw_items:
        barcode = str(item.get("barcode", "")).strip()
        code = barcode or f"SKU-{item.get('style_code', 'GEN')}"
        
        db_product = {
          "id": f"prod_{barcode}",
          "code": code,
          "sku": code,
          "name": item.get("item_description", "Item") + (" - " + item.get("style_code") if item.get("style_code") else ""),
          "description": f"{item.get('brand', 'SMRITI')} {item.get('category', 'Apparel')} Style {item.get('style_code', '')}",
          "barcode": barcode,
          "price": float(item.get("selling_price", 0.0)),
          "costPrice": float(item.get("cost_price", 0.0)),
          "mrp": float(item.get("planned_mrp", item.get("selling_price", 0.0))),
          "gstPercentage": float(item.get("gst_percentage", 5.0)),
          "stock": int(item.get("stock_quantity", 100)),
          "reservedStock": 0,
          "isActive": True,
          "brand": item.get("brand", "TATTLY THREADS"),
          "category": item.get("category", "Apparel"),
          "color": item.get("color", ""),
          "size": str(item.get("size", "")),
          "styleCode": item.get("style_code", ""),
          "hsnCode": item.get("hsn_code", "61091000") or "61091000",
          "attributes": {
            "brand": item.get("brand", "TATTLY THREADS"),
            "category": item.get("category", "Apparel"),
            "color": item.get("color", ""),
            "size": str(item.get("size", "")),
            "styleCode": item.get("style_code", "")
          }
        }
        db_products.append(db_product)

    store_data["products"] = db_products

    with open(db_store_path, "w", encoding="utf-8") as f:
        json.dump(store_data, f, indent=2)

    print(f"Successfully seeded {len(db_products)} products into db_store.json")

    # 2. Update Postgres smriti001 if active
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
        cur = conn.cursor()
        
        inserted_pg = 0
        for p in db_products:
            item_uuid = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO products (
                    id, uuid, name, code, sku, barcode, price, cost_price, mrp, gst_percentage, stock, reserved_stock, is_active, brand, category, color, size, style_code, hsn_code
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    price = EXCLUDED.price,
                    cost_price = EXCLUDED.cost_price,
                    mrp = EXCLUDED.mrp,
                    stock = EXCLUDED.stock;
            """, (
                p["id"], item_uuid, p["name"], p["code"], p["sku"], p["barcode"], p["price"], p["costPrice"], p["mrp"], p["gstPercentage"], p["stock"], 0, True, p["brand"], p["category"], p["color"], p["size"], p["styleCode"], p["hsnCode"]
            ))
            inserted_pg += 1

        conn.commit()
        conn.close()
        print(f"Successfully seeded {inserted_pg} products into PostgreSQL smriti001 database!")
    except Exception as e:
        print(f"PostgreSQL sync result: {e}")

if __name__ == "__main__":
    import_item_master()
