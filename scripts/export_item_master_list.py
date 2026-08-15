"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import os, json, csv, psycopg2

def export_item_master():
    conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
    cur = conn.cursor()

    cur.execute('''
        SELECT barcode, style_code, name, brand, category, color, size, mrp, price, cost_price, hsn_code, gst_percentage, stock
        FROM products
        ORDER BY barcode;
    ''')
    rows = cur.fetchall()
    conn.close()

    items = []
    for r in rows:
        items.append({
            "barcode": r[0],
            "style_code": r[1],
            "item_description": r[2],
            "brand": r[3],
            "category": r[4],
            "color": r[5],
            "size": r[6],
            "planned_mrp": float(r[7]),
            "selling_price": float(r[8]),
            "cost_price": float(r[9]),
            "hsn_code": r[10],
            "gst_percentage": float(r[11]),
            "stock_quantity": r[12]
        })

    json_output = r"F:\SMRITRretailNX\exports\SMRITI_Item_Master_842.json"
    csv_output = r"F:\SMRITRretailNX\exports\SMRITI_Item_Master_842.csv"

    with open(json_output, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)

    headers = list(items[0].keys())
    with open(csv_output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(items)

    print("==========================================================")
    print(f"EXPORTED ALL {len(items)} ITEM MASTER RECORDS")
    print("==========================================================")
    print(f"JSON File: {json_output}")
    print(f"CSV File : {csv_output}")

if __name__ == "__main__":
    export_item_master()
