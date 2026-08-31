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

import sys
import psycopg2
from psycopg2.extras import RealDictCursor


def link_historical_invoice_products(database: str = "smriti001", apply: bool = False):
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{database}")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Fetch all products into memory
    cur.execute("SELECT id, code, sku, barcode, name, style_code, color, size FROM products WHERE is_deleted = false;")
    products = cur.fetchall()
    
    # Build lookup dictionaries
    by_id = {p["id"].lower(): p["id"] for p in products}
    by_code = {p["code"].upper(): p["id"] for p in products if p.get("code")}
    by_sku = {p["sku"].upper(): p["id"] for p in products if p.get("sku")}
    by_clean_code = {p["code"].replace("-", "").upper(): p["id"] for p in products if p.get("code")}
    by_clean_sku = {p["sku"].replace("-", "").upper(): p["id"] for p in products if p.get("sku")}
    by_clean_name = {p["name"].replace(",", "").replace("-", " ").upper().strip(): p["id"] for p in products if p.get("name")}

    # 2. Fetch all sales_invoice_items
    cur.execute("SELECT id, invoice_id, code, name, product_id FROM sales_invoice_items ORDER BY id ASC;")
    items = cur.fetchall()
    total_items = len(items)

    matched = 0
    unmatched = []
    updates = []

    for it in items:
        item_id = it["id"]
        code = (it["code"] or "").strip().upper()
        name = (it["name"] or "").strip().upper()
        curr_pid = (it["product_id"] or "").strip().lower()

        # Check existing valid product_id
        if curr_pid and curr_pid in by_id:
            matched += 1
            continue

        resolved_pid = None

        # Strategy 1: Direct SKU / Code match
        if code in by_sku:
            resolved_pid = by_sku[code]
        elif code in by_code:
            resolved_pid = by_code[code]

        # Strategy 2: Clean code (strip hyphens)
        if not resolved_pid:
            clean_c = code.replace("-", "")
            if clean_c in by_clean_sku:
                resolved_pid = by_clean_sku[clean_c]
            elif clean_c in by_clean_code:
                resolved_pid = by_clean_code[clean_c]

        # Strategy 3: Standard ID formatting
        if not resolved_pid:
            candidate_id = f"prod-{code.lower()}"
            if candidate_id in by_id:
                resolved_pid = by_id[candidate_id]

        # Strategy 4: Gunmetal abbreviation (GUNMETAL -> GUNMTL)
        if not resolved_pid and "GUNMETAL" in code:
            alt_code = code.replace("GUNMETAL", "GUNMTL")
            if alt_code in by_sku or alt_code in by_code:
                resolved_pid = by_sku.get(alt_code) or by_code.get(alt_code)
            else:
                candidate_id = f"prod-{alt_code.lower()}"
                if candidate_id in by_id:
                    resolved_pid = by_id[candidate_id]

        # Strategy 5: Resolve TT79-XXX temporary code by its descriptive item name
        if not resolved_pid and name:
            # Example name: "CH-08-J CREAM 36" -> SKU: "CH-08-J-CREAM-36"
            name_parts = name.replace("-", " ").split()
            if len(name_parts) >= 4:
                constructed_sku = f"{name_parts[0]}-{name_parts[1]}-{name_parts[2]}-{name_parts[3]}-{name_parts[-1]}"
                constructed_id = f"prod-{name_parts[0].lower()}-{name_parts[1].lower()}-{name_parts[2].lower()}-{name_parts[3].lower()}-{name_parts[-1]}"
                if constructed_sku in by_sku:
                    resolved_pid = by_sku[constructed_sku]
                elif constructed_id in by_id:
                    resolved_pid = by_id[constructed_id]

            if not resolved_pid:
                # Try normalized name
                norm_name = name.replace(",", "").replace("-", " ").strip()
                if norm_name in by_clean_name:
                    resolved_pid = by_clean_name[norm_name]

        if resolved_pid:
            matched += 1
            updates.append((resolved_pid, item_id))
        else:
            unmatched.append(it)

    print("=" * 60)
    print(f" HISTORICAL INVOICE ITEM PRODUCT RESOLUTION")
    print("=" * 60)
    print(f" Total items analyzed : {total_items}")
    print(f" Matched items        : {matched} ({(matched/total_items)*100:.2f}%)")
    print(f" Updates to apply     : {len(updates)}")
    print(f" Unmatched items      : {len(unmatched)}")
    print("=" * 60)

    if unmatched:
        print("\nUnmatched sample:")
        for u in unmatched[:10]:
            print(f"ID: {u['id']} | Code: {u['code']} | Name: {u['name']}")

    if apply and updates:
        print(f"\nApplying {len(updates)} product_id updates to sales_invoice_items...")
        cur.executemany("""
            UPDATE sales_invoice_items
            SET product_id = %s
            WHERE id = %s;
        """, updates)
        conn.commit()
        print("Successfully committed product_id links to sales_invoice_items.")

    conn.close()
    return matched, len(unmatched)


if __name__ == "__main__":
    apply_mode = "--apply" in sys.argv
    link_historical_invoice_products(apply=apply_mode)
