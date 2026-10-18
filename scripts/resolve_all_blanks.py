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
import json
import asyncio
import httpx
import psycopg2
import openpyxl
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

DIR_PATH = r"F:\Smriti-Clients Data\Tattly Threads\ItemMaster"
BASE_URL = "https://tattlythreads.smritisys.com"
DB_URL = "postgresql://postgres:postgres@localhost:2781/smritisys"

def clean_val(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("none", "null") else s

def clean_num(v, default=0.0):
    if v is None:
        return default
    try:
        return float(str(v).replace(",", "").strip())
    except Exception:
        return default

def derive_style_from_code(code, sku, existing_style=""):
    if existing_style:
        return existing_style.strip().upper()
    c = (code or sku or "").strip().upper()
    parts = c.split("-")
    if len(parts) >= 3 and len(parts[2]) == 1:
        return f"{parts[0]}-{parts[1]}-{parts[2]}"
    elif len(parts) >= 2:
        return f"{parts[0]}-{parts[1]}"
    elif parts:
        return parts[0]
    return ""

def get_default_footwear_meta(style_code, category=""):
    st = style_code.upper()
    cat = category.upper() if category else ""
    if not cat:
        if st.startswith("CH"):
            cat = "CHAPPAL"
        elif st.startswith("SND"):
            cat = "SANDAL"
        elif st.startswith("SH"):
            cat = "SHOES"
        else:
            cat = "FOOTWEAR"
            
    subcat = "SLIP ON" if cat == "CHAPPAL" else ("CASUAL" if cat == "SANDAL" else "STANDARD")
    heel = "FLAT"
    upper = "SYNTHETIC"
    outsole = "TPR"
    hsn = "64041990"
    if st in ("CH-28", "SND-12"):
        hsn = "64032012"
        
    return {
        "style_code": st,
        "gst_percentage": 5.0,
        "hsn_code": hsn,
        "gender": "LADIES",
        "department": "LADIES FTW",
        "purchase_class": "SIS",
        "merchandise_category": cat,
        "category": cat,
        "sub_category": subcat,
        "heel_type": heel,
        "upper_material": upper,
        "outsole": outsole,
        "outsole_material": outsole,
        "image_link": st,
        "tax_category": "GOODS",
        "collection_type": "BASIC",
    }

def update_local_database():
    print("=" * 80)
    print("STEP 1: Resolving Blanks in Local PostgreSQL Database")
    print("=" * 80)
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Query all products
    cur.execute("""
        SELECT id, barcode, code, name, category, style_code, gst_percentage, 
               hsn_code, vendor_code, attributes
        FROM products;
    """)
    rows = cur.fetchall()
    print(f"  Scanned {len(rows)} products in local database.")
    
    updated = 0
    for r in rows:
        pid, bc, code, name, cat, st_code, gst, hsn, vc, attrs = r
        attrs = dict(attrs or {})
        
        # Check if footwear product
        code_str = (code or "").upper()
        cat_str = (cat or "").upper()
        is_footwear = (
            cat_str in ("CHAPPAL", "SANDAL", "SHOES", "BOOTS", "HEELS", "FLATS", "FOOTWEAR")
            or code_str.startswith("CH-")
            or code_str.startswith("SND-")
            or code_str.startswith("SH-")
        )
        if not is_footwear:
            continue
            
        style = derive_style_from_code(code, "", st_code)
        if not style:
            continue
            
        defaults = get_default_footwear_meta(style, cat)
        changed = False
        update_cols = {}
        
        if not st_code or st_code != style:
            update_cols["style_code"] = style
        if gst != 5.0:
            update_cols["gst_percentage"] = 5.0
        if not hsn or clean_val(hsn) != defaults["hsn_code"]:
            update_cols["hsn_code"] = defaults["hsn_code"]
        if not cat or cat_str != defaults["category"]:
            update_cols["category"] = defaults["category"]
            
        for k in ("gender", "department", "purchase_class", "merchandise_category", 
                  "sub_category", "heel_type", "upper_material", "outsole", "image_link"):
            cur_val = clean_val(attrs.get(k))
            target_val = defaults.get(k)
            if not cur_val and target_val:
                attrs[k] = target_val
                changed = True
                
        if update_cols or changed:
            set_clauses = ["attributes = %s"]
            params = [json.dumps(attrs)]
            for col_name, col_val in update_cols.items():
                set_clauses.append(f"{col_name} = %s")
                params.append(col_val)
            params.append(pid)
            
            cur.execute(f"UPDATE products SET {', '.join(set_clauses)} WHERE id = %s;", tuple(params))
            updated += 1
            
    conn.commit()
    conn.close()
    print(f"  --> Successfully updated {updated} footwear products in local database.")

async def update_remote_server():
    print("\n" + "=" * 80)
    print("STEP 2: Resolving Blanks on Remote Production Server (https://tattlythreads.smritisys.com)")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"},
        )
        if login_res.status_code != 200:
            print(f"  [FATAL] Remote login failed: {login_res.status_code}")
            return
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        print("  Authenticated successfully with production server.")
        
        # 1. Fetch all existing remote products
        all_remote = []
        page = 1
        while True:
            resp = await client.get(f"{BASE_URL}/api/v1/inventory/?page={page}&page_size=100", headers=headers)
            items = resp.json().get("items", [])
            if not items: break
            all_remote.extend(items)
            if not resp.json().get("has_next") or len(all_remote) >= resp.json().get("total", 0): break
            page += 1
            
        print(f"  --> Scanned {len(all_remote)} total remote products.")
        
        # 2. Sync master lookup for styles
        style_res = await client.get(f"{BASE_URL}/api/v1/lookup/style_article/values", headers=headers)
        reg_styles = {x.get("code") for x in style_res.json() if x.get("code")} if style_res.status_code == 200 else set()
        
        needed_styles = set()
        for p in all_remote:
            c = clean_val(p.get("code")).upper()
            sk = clean_val(p.get("sku")).upper()
            st = clean_val(p.get("style_code")).upper()
            derived_st = derive_style_from_code(c, sk, st)
            if derived_st:
                needed_styles.add(derived_st)
                
        missing_styles = sorted([s for s in needed_styles if s not in reg_styles])
        if missing_styles:
            print(f"  Registering {len(missing_styles)} missing styles in style_article lookup...")
            for st in missing_styles:
                res = await client.post(
                    f"{BASE_URL}/api/v1/lookup/style_article/values",
                    headers=headers,
                    json={"code": st, "name": st, "active": True, "data": {}},
                )
                if res.status_code in (200, 201):
                    reg_styles.add(st)
                    
        # 3. Update products with missing attributes or missing image_link
        mutated_count = 0
        skipped_count = 0
        failed_count = 0
        semaphore = asyncio.Semaphore(15)
        
        async def update_single(prod):
            nonlocal mutated_count, skipped_count, failed_count
            code = clean_val(prod.get("code")).upper()
            sku = clean_val(prod.get("sku")).upper()
            st_code = clean_val(prod.get("style_code")).upper()
            cat = clean_val(prod.get("category")).upper()
            
            # Check if footwear
            is_footwear = (
                cat in ("CHAPPAL", "SANDAL", "SHOES", "BOOTS", "HEELS", "FLATS", "FOOTWEAR")
                or code.startswith("CH-")
                or code.startswith("SND-")
                or code.startswith("SH-")
            )
            if not is_footwear:
                skipped_count += 1
                return
                
            style = derive_style_from_code(code, sku, st_code)
            defaults = get_default_footwear_meta(style, cat)
            
            attrs = dict(prod.get("attributes") or {})
            changed = False
            put_body = {}
            
            # Update missing attributes
            for k in ("gender", "department", "purchase_class", "merchandise_category", 
                      "sub_category", "heel_type", "upper_material", "outsole", "image_link"):
                cur_val = clean_val(attrs.get(k))
                target_val = defaults.get(k)
                if not cur_val and target_val:
                    attrs[k] = target_val
                    changed = True
                    
            if changed:
                put_body["attributes"] = attrs
                
            if style and style in reg_styles and prod.get("style_code") != style:
                put_body["style_code"] = style
                changed = True
                
            if not prod.get("hsn_code") or prod.get("hsn_code") != defaults["hsn_code"]:
                put_body["hsn_code"] = defaults["hsn_code"]
                changed = True
                
            if not changed:
                skipped_count += 1
                return
                
            pid = prod.get("id")
            async with semaphore:
                try:
                    res = await client.put(f"{BASE_URL}/api/v1/inventory/{pid}", headers=headers, json=put_body)
                    if res.status_code == 200:
                        mutated_count += 1
                    else:
                        failed_count += 1
                        print(f"    Warning: PUT {pid} ({code}) returned {res.status_code}: {res.text}")
                except Exception as ex:
                    failed_count += 1
                    print(f"    Error updating {pid}: {ex}")
                    
        tasks = [update_single(p) for p in all_remote]
        await asyncio.gather(*tasks)
        print(f"  --> Remote products update completed: Mutated = {mutated_count}, Skipped = {skipped_count}, Failed = {failed_count}")

def main():
    update_local_database()
    asyncio.run(update_remote_server())

if __name__ == "__main__":
    main()
