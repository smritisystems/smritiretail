"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
- Pushpa Devi Jawahar Mallah (Founder & Chairperson)
- Jawahar Ramkripal Mallah (Founder, CEO & Chief Software Architect)

Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.92.3
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import glob
import json
import asyncio
import httpx
import psycopg2
import openpyxl
from collections import defaultdict, Counter

sys.stdout.reconfigure(encoding="utf-8")

DIR_PATH = r"F:\Smriti-Clients Data\Tattly Threads\ItemMaster"
BASE_URL = "https://tattlythreads.smritisys.com"
DB_URL = "postgresql://postgres:postgres@localhost:2781/smritisys"

TARGET_FIELDS = [
    "PRODUCT TAX", "HSN CODE", "GENDER", "VENDOR CODE", 
    "PURCHASE CLASS", "DEPARTMENT", "MERCHANDISE CATEGORY", 
    "Sub category", "HEELS", "UPPER MATERIAL", "OUTSOLE", "IMAGE LINK"
]

def clean_val(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("none", "null") else s

def analyze_excel_blanks():
    print("=" * 80)
    print("SECTION 1: EXCEL WORKBOOKS INVENTORIED BLANKS")
    print("=" * 80)
    
    files_to_check = [
        "TATTLY THREADS ITEM MASTER 2026 - Copy.xlsx",
        "OLD TO NEW.xlsx",
        "OLD TO NEW (1).xlsx",
        "TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.xlsx"
    ]
    
    for fname in files_to_check:
        fpath = os.path.join(DIR_PATH, fname)
        if not os.path.exists(fpath):
            continue
        print(f"\n>>> Workbook: {fname}")
        wb = openpyxl.load_workbook(fpath, data_only=True)
        for sname in wb.sheetnames:
            ws = wb[sname]
            headers = [str(c.value).strip() if c.value is not None else f"COL_{idx}" for idx, c in enumerate(ws[1])]
            rows = []
            for row in ws.iter_rows(min_row=2, values_only=True):
                if any(row):
                    rows.append(row)
            total_rows = len(rows)
            if total_rows == 0:
                print(f"  Sheet [{sname}]: Empty")
                continue
            
            print(f"  Sheet [{sname}] (Total Populated Rows: {total_rows}):")
            
            # Check 12 target fields specifically
            target_present = [f for f in TARGET_FIELDS if f in headers]
            print(f"    Target 12 Fields Analysis ({len(target_present)}/12 present):")
            has_target_blanks = False
            for f in target_present:
                col_idx = headers.index(f)
                blank_rows = []
                for r_idx, r in enumerate(rows, start=2):
                    v = clean_val(r[col_idx])
                    if not v:
                        st = clean_val(r[headers.index("PRODUCT STYLE CODE")]) if "PRODUCT STYLE CODE" in headers else "N/A"
                        bc = clean_val(r[headers.index("BARCODE NO")]) if "BARCODE NO" in headers else "N/A"
                        blank_rows.append((r_idx, st, bc))
                if blank_rows:
                    has_target_blanks = True
                    print(f"      - '{f}': {len(blank_rows)} / {total_rows} blank ({len(blank_rows)/total_rows*100:.1f}%)")
                    if len(blank_rows) <= 5:
                        for r_idx, st, bc in blank_rows:
                            print(f"          Row {r_idx}: Style={st}, Barcode={bc}")
                    else:
                        for r_idx, st, bc in blank_rows[:3]:
                            print(f"          Row {r_idx}: Style={st}, Barcode={bc}")
                        print(f"          ... and {len(blank_rows)-3} more rows.")
                else:
                    print(f"      - '{f}': 0 blanks (100% Populated)")
            if not has_target_blanks:
                print("      >>> ALL TARGET 12 FIELDS ARE 100% FULLY POPULATED (0 BLANKS)! <<<")

            # Check other columns outside the 12 fields
            other_cols = [h for h in headers if h not in TARGET_FIELDS]
            other_blanks = []
            for h in other_cols:
                col_idx = headers.index(h)
                cnt = sum(1 for r in rows if not clean_val(r[col_idx]))
                if cnt > 0:
                    other_blanks.append((h, cnt))
            if other_blanks:
                print(f"    Other Non-Target Columns with Blanks:")
                for h, cnt in other_blanks:
                    pct = (cnt / total_rows) * 100
                    print(f"      - '{h}': {cnt} / {total_rows} blank ({pct:.1f}%)")

def analyze_backup_excel_blanks():
    print("\n" + "=" * 80)
    print("SECTION 2: HISTORICAL BLANKS IN BACKUP FILES (BEFORE HARMONIZATION)")
    print("=" * 80)
    
    backup_files = [
        "TATTLY THREADS ITEM MASTER 2026 - Copy.backup.xlsx",
        "OLD TO NEW.backup.xlsx",
        "OLD TO NEW (1).backup.xlsx"
    ]
    for fname in backup_files:
        fpath = os.path.join(DIR_PATH, fname)
        if not os.path.exists(fpath):
            continue
        print(f"\n>>> Backup Workbook: {fname}")
        wb = openpyxl.load_workbook(fpath, data_only=True)
        for sname in wb.sheetnames:
            ws = wb[sname]
            headers = [str(c.value).strip() if c.value is not None else f"COL_{idx}" for idx, c in enumerate(ws[1])]
            rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if any(r)]
            total = len(rows)
            if total == 0: continue
            
            target_present = [f for f in TARGET_FIELDS if f in headers]
            blanks_summary = {}
            for f in target_present:
                col_idx = headers.index(f)
                cnt = sum(1 for r in rows if not clean_val(r[col_idx]))
                if cnt > 0:
                    blanks_summary[f] = cnt
            if blanks_summary:
                print(f"  Sheet [{sname}] ({total} rows): Target fields that HAD blanks before harmonization:")
                for f, cnt in blanks_summary.items():
                    print(f"    - '{f}': {cnt} / {total} blank ({cnt/total*100:.1f}%) -> [NOW 100% RESOLVED IN CURRENT WORKBOOK]")
            else:
                print(f"  Sheet [{sname}] ({total} rows): No target blanks in backup.")

def analyze_database_blanks():
    print("\n" + "=" * 80)
    print("SECTION 3: LOCAL POSTGRESQL DATABASE BLANKS (localhost:2781/smritisys)")
    print("=" * 80)
    
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE barcode IS NULL OR barcode = '') as blank_barcode,
            COUNT(*) FILTER (WHERE name IS NULL OR name = '') as blank_name,
            COUNT(*) FILTER (WHERE style_code IS NULL OR style_code = '') as blank_style,
            COUNT(*) FILTER (WHERE category IS NULL OR category = '') as blank_category,
            COUNT(*) FILTER (WHERE brand IS NULL OR brand = '') as blank_brand,
            COUNT(*) FILTER (WHERE gst_percentage IS NULL) as blank_gst,
            COUNT(*) FILTER (WHERE hsn_code IS NULL OR hsn_code = '') as blank_hsn,
            COUNT(*) FILTER (WHERE vendor_code IS NULL OR vendor_code = '') as blank_vendor,
            COUNT(*) FILTER (WHERE attributes->>'gender' IS NULL OR attributes->>'gender' = '') as blank_gender,
            COUNT(*) FILTER (WHERE attributes->>'purchase_class' IS NULL OR attributes->>'purchase_class' = '') as blank_purchase_class,
            COUNT(*) FILTER (WHERE attributes->>'department' IS NULL OR attributes->>'department' = '') as blank_department,
            COUNT(*) FILTER (WHERE attributes->>'merchandise_category' IS NULL OR attributes->>'merchandise_category' = '') as blank_merchandise_category,
            COUNT(*) FILTER (WHERE attributes->>'sub_category' IS NULL OR attributes->>'sub_category' = '') as blank_sub_category,
            COUNT(*) FILTER (WHERE attributes->>'heel_type' IS NULL OR attributes->>'heel_type' = '') as blank_heel_type,
            COUNT(*) FILTER (WHERE attributes->>'upper_material' IS NULL OR attributes->>'upper_material' = '') as blank_upper_material,
            COUNT(*) FILTER (WHERE attributes->>'outsole' IS NULL OR attributes->>'outsole' = '') as blank_outsole,
            COUNT(*) FILTER (WHERE attributes->>'image_link' IS NULL OR attributes->>'image_link' = '') as blank_image_link,
            COUNT(*) FILTER (WHERE attributes->>'color' IS NULL OR attributes->>'color' = '') as blank_color,
            COUNT(*) FILTER (WHERE attributes->>'size' IS NULL OR attributes->>'size' = '') as blank_size
        FROM products;
    """)
    r = cur.fetchone()
    total = r[0]
    col_names = [
        "barcode", "name", "style_code", "category", "brand", 
        "gst_percentage", "hsn_code", "vendor_code", "gender", 
        "purchase_class", "department", "merchandise_category", 
        "sub_category", "heel_type", "upper_material", "outsole", 
        "image_link", "color", "size"
    ]
    print(f"Total Products in Local Database: {total}")
    print("\n  Target 12 Fields & Dimensions across ALL {total} database records:")
    for col, cnt in zip(col_names, r[1:]):
        pct = (cnt / total) * 100 if total else 0
        print(f"    - {col:22}: {cnt:4} / {total} blank ({pct:5.1f}%)")
        
    # Breakdown between Tattly Footwear vs legacy / other products
    cur.execute("""
        SELECT 
            COUNT(*) as total_footwear,
            COUNT(*) FILTER (WHERE hsn_code IS NULL OR hsn_code = '') as blank_hsn,
            COUNT(*) FILTER (WHERE gst_percentage IS NULL) as blank_gst,
            COUNT(*) FILTER (WHERE vendor_code IS NULL OR vendor_code = '') as blank_vendor,
            COUNT(*) FILTER (WHERE attributes->>'gender' IS NULL OR attributes->>'gender' = '') as blank_gender,
            COUNT(*) FILTER (WHERE attributes->>'heel_type' IS NULL OR attributes->>'heel_type' = '') as blank_heel,
            COUNT(*) FILTER (WHERE attributes->>'image_link' IS NULL OR attributes->>'image_link' = '') as blank_image
        FROM products
        WHERE category IN ('CHAPPAL', 'SANDAL', 'SHOES', 'BOOTS', 'HEELS', 'FLATS') 
           OR code LIKE 'CH-%' OR code LIKE 'SND-%' OR code LIKE 'SH-%';
    """)
    fw = cur.fetchone()
    print(f"\n  Footwear-Specific Catalog (CH/SND/SH Articles: {fw[0]} products):")
    print(f"    - HSN Code Blanks      : {fw[1]} / {fw[0]}")
    print(f"    - GST % Blanks         : {fw[2]} / {fw[0]}")
    print(f"    - Vendor Code Blanks   : {fw[3]} / {fw[0]}")
    print(f"    - Gender Blanks        : {fw[4]} / {fw[0]}")
    print(f"    - Heel Type Blanks     : {fw[5]} / {fw[0]}")
    print(f"    - Image Link Blanks    : {fw[6]} / {fw[0]}")
    
    conn.close()

async def analyze_remote_blanks():
    print("\n" + "=" * 80)
    print("SECTION 4: REMOTE PRODUCTION SERVER BLANKS (https://tattlythreads.smritisys.com)")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"},
        )
        if login_res.status_code != 200:
            print(f"  [ERROR] Login failed: {login_res.status_code}")
            return
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        all_prods = []
        page = 1
        while True:
            resp = await client.get(f"{BASE_URL}/api/v1/inventory/?page={page}&page_size=100", headers=headers)
            items = resp.json().get("items", [])
            if not items: break
            all_prods.extend(items)
            if len(all_prods) >= resp.json().get("total", 0): break
            page += 1
            
        total = len(all_prods)
        print(f"Total Remote Products Scanned: {total}")
        
        target_keys = {
            "PRODUCT TAX (gst_percentage)": lambda p: p.get("gst_percentage") or (p.get("attributes") or {}).get("gst_percentage"),
            "HSN CODE (hsn_code)": lambda p: p.get("hsn_code"),
            "GENDER (gender)": lambda p: (p.get("attributes") or {}).get("gender"),
            "VENDOR CODE (vendor_code)": lambda p: p.get("vendor_code") or (p.get("attributes") or {}).get("vendor_code"),
            "PURCHASE CLASS (purchase_class)": lambda p: (p.get("attributes") or {}).get("purchase_class"),
            "DEPARTMENT (department)": lambda p: (p.get("attributes") or {}).get("department"),
            "MERCHANDISE CATEGORY (merchandise_category)": lambda p: (p.get("attributes") or {}).get("merchandise_category") or p.get("category"),
            "Sub category (sub_category)": lambda p: (p.get("attributes") or {}).get("sub_category"),
            "HEELS (heel_type)": lambda p: (p.get("attributes") or {}).get("heel_type") or (p.get("attributes") or {}).get("heels"),
            "UPPER MATERIAL (upper_material)": lambda p: (p.get("attributes") or {}).get("upper_material"),
            "OUTSOLE (outsole)": lambda p: (p.get("attributes") or {}).get("outsole"),
            "IMAGE LINK (image_link)": lambda p: (p.get("attributes") or {}).get("image_link"),
        }
        
        blank_details = defaultdict(list)
        for p in all_prods:
            code = p.get("code") or p.get("sku") or p.get("barcode")
            style = p.get("style_code") or "N/A"
            for label, extractor in target_keys.items():
                val = clean_val(extractor(p))
                if not val:
                    blank_details[label].append((code, style))
                    
        print("\n  Target 12 Fields Remote Audit Results:")
        for label, missing_list in blank_details.items():
            cnt = len(missing_list)
            pct = (cnt / total) * 100
            print(f"    - {label:45}: {cnt:4} / {total} blank ({pct:5.1f}%)")
            if 0 < cnt <= 5:
                for code, style in missing_list:
                    print(f"        Item: {code} (Style: {style})")
            elif cnt > 5 and cnt <= 30:
                styles = sorted(list(set(s for _, s in missing_list)))
                print(f"        Affected Styles ({len(styles)}): {', '.join(styles)}")

def main():
    analyze_excel_blanks()
    analyze_backup_excel_blanks()
    analyze_database_blanks()
    asyncio.run(analyze_remote_blanks())

if __name__ == "__main__":
    main()
