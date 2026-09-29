"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.50.0
Created      : 2026-09-29
Modified     : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Task: Read-Only Dry-Run Analysis for 1,405 Legacy Products with NULL item_id
Rule: READ-ONLY. Zero DML. Zero Updates.
"""

import psycopg2
import json
from collections import defaultdict

def run_dry_run_report():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
    cur = conn.cursor()

    # Query all products with NULL item_id
    cur.execute("""
        SELECT 
            p.id, 
            p.code, 
            p.sku, 
            p.style_code, 
            p.barcode, 
            p.name, 
            p.brand, 
            p.category, 
            p.company_id, 
            p.branch_id
        FROM products p
        WHERE p.item_id IS NULL AND p.is_deleted = false
        ORDER BY p.id;
    """)
    products = cur.fetchall()
    total_legacy = len(products)
    print(f"=== LEGACY PRODUCTS DRY-RUN ANALYSIS ===")
    print(f"Total Legacy Products with NULL item_id: {total_legacy}")

    # Index existing items by item_code and style_code
    cur.execute("SELECT id, item_code, style_code, item_name, company_id FROM items WHERE is_deleted = false;")
    items = cur.fetchall()
    item_by_code = {(r[4], r[1].strip().upper()): r for r in items if r[1]}
    item_by_style = {(r[4], r[2].strip().upper()): r for r in items if r[2]}

    # Index existing variants by variant_sku
    cur.execute("SELECT id, item_id, variant_sku, company_id FROM item_variants WHERE is_deleted = false;")
    variants = cur.fetchall()
    variant_by_sku = {(r[3], r[2].strip().upper()): r for r in variants if r[2]}

    results = []
    category_counts = defaultdict(int)

    for p in products:
        p_id, p_code, p_sku, p_style, p_barcode, p_name, p_brand, p_cat, cid, bid = p
        clean_code = (p_code or "").strip().upper()
        clean_sku = (p_sku or "").strip().upper()
        clean_style = (p_style or "").strip().upper()

        candidate_item = None
        candidate_variant = None
        confidence = "NONE"
        reason = ""

        # Strategy 1: Match by style_code
        if clean_style and (cid, clean_style) in item_by_code:
            candidate_item = item_by_code[(cid, clean_style)][0]
            confidence = "HIGH"
            reason = f"Exact match on items.item_code == products.style_code ('{clean_style}')"
        elif clean_style and (cid, clean_style) in item_by_style:
            candidate_item = item_by_style[(cid, clean_style)][0]
            confidence = "HIGH"
            reason = f"Exact match on items.style_code == products.style_code ('{clean_style}')"
        # Strategy 2: Match by code / sku to existing item
        elif clean_code and (cid, clean_code) in item_by_code:
            candidate_item = item_by_code[(cid, clean_code)][0]
            confidence = "MEDIUM"
            reason = f"Direct match on items.item_code == products.code ('{clean_code}')"
        # Strategy 3: Match to existing variant
        elif clean_sku and (cid, clean_sku) in variant_by_sku:
            v_match = variant_by_sku[(cid, clean_sku)]
            candidate_variant = v_match[0]
            candidate_item = v_match[1]
            confidence = "HIGH"
            reason = f"Exact match on item_variants.variant_sku == products.sku ('{clean_sku}')"
        else:
            # Candidate creation required
            candidate_item = f"PROPOSED_NEW_ITEM_FOR_{clean_code or p_id}"
            candidate_variant = f"PROPOSED_NEW_VARIANT_FOR_{clean_sku or clean_code or p_id}"
            confidence = "CONVERGENCE_CANDIDATE"
            reason = "No existing canonical Item found; requires convergence via UniversalItemService"

        category_counts[confidence] += 1
        results.append({
            "product_id": p_id,
            "sku": p_sku,
            "code": p_code,
            "style_code": p_style,
            "barcode": p_barcode,
            "candidate_item": candidate_item,
            "candidate_variant": candidate_variant,
            "confidence": confidence,
            "reason": reason
        })

    print(f"\nBreakdown by Confidence Level:")
    for conf, cnt in category_counts.items():
        print(f"  - {conf}: {cnt} products")

    print("\nSample Mappings (First 10):")
    for r in results[:10]:
        print(f"  Product: {r['product_id']} | SKU: {r['sku']} | Code: {r['code']} | Style: {r['style_code']} -> Item: {r['candidate_item']} | Confidence: {r['confidence']}")
        print(f"    Reason: {r['reason']}")

    with open("legacy_products_dry_run_report.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved full dry-run report to legacy_products_dry_run_report.json (READ-ONLY, ZERO DML).")

if __name__ == "__main__":
    run_dry_run_report()
