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

import sys
import asyncio
import httpx

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "https://tattlythreads.smritisys.com"

async def harmonize_remote_attributes():
    print("=" * 80)
    print("SMRITI ITEM MASTER: Harmonizing Remote Database Attributes")
    print(f"Target Server: {BASE_URL}")
    print("=" * 80)
    
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=30)
    async with httpx.AsyncClient(timeout=60.0, limits=limits) as client:
        # Step 1: Login
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        if login_res.status_code != 200:
            print(f"[FATAL] Login failed: {login_res.status_code} {login_res.text}")
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("  Authenticated as admin successfully.")
        
        # Step 2: Fetch all products
        print("  Loading all products from remote catalog...")
        all_prods = []
        page = 1
        while True:
            resp = await client.get(f"{BASE_URL}/api/v1/inventory/?page={page}&page_size=100", headers=headers)
            if resp.status_code != 200:
                print(f"[ERROR] Failed to fetch inventory page {page}: {resp.status_code}")
                break
            items = resp.json().get("items", [])
            if not items:
                break
            all_prods.extend(items)
            if not resp.json().get("has_next") or len(all_prods) >= resp.json().get("total", 0):
                break
            page += 1
            
        print(f"  Loaded {len(all_prods)} products total.")
        
        # Step 3: Identify products needing attribute harmonization
        to_update = []
        for p in all_prods:
            attrs = dict(p.get("attributes") or {})
            changed = False
            
            # 1. outsole & outsole_material symmetry
            outsole_val = attrs.get("outsole") or attrs.get("outsole_material") or "TPR"
            if attrs.get("outsole_material") != outsole_val:
                attrs["outsole_material"] = outsole_val
                changed = True
            if attrs.get("outsole") != outsole_val:
                attrs["outsole"] = outsole_val
                changed = True
                
            # 2. vendor_code symmetry between column and attributes
            col_vendor = p.get("vendor_code") or attrs.get("vendor_code") or "I"
            if attrs.get("vendor_code") != col_vendor:
                attrs["vendor_code"] = col_vendor
                changed = True
                
            # 3. purchase_class default
            if not attrs.get("purchase_class"):
                attrs["purchase_class"] = "SIS"
                changed = True
                
            # 4. GST percentage default for footwear
            curr_gst = float(p.get("gst_percentage") or 0.0)
            target_gst = 5.0 if curr_gst == 0.0 else curr_gst
            if target_gst != curr_gst:
                changed = True

            if changed:
                to_update.append((p, attrs, target_gst, col_vendor))
                
        print(f"  Identified {len(to_update)} products needing attribute synchronization.")
        if not to_update:
            print("  All products are already 100% harmonized!")
        else:
            # Step 4: Execute updates with concurrency
            sem = asyncio.Semaphore(10)
            success_count = 0
            fail_count = 0
            
            async def update_single_product(prod, new_attrs, gst_val, vendor_val):
                nonlocal success_count, fail_count
                pid = prod["id"]
                payload = {
                    "name": prod.get("name"),
                    "price": float(prod.get("price") or 0.0),
                    "mrp": float(prod.get("mrp") or 0.0),
                    "cost_price": float(prod.get("cost_price") or 0.0),
                    "brand": prod.get("brand") or "TATTLY THREADS",
                    "category": prod.get("category") or "Footwear",
                    "hsn_code": prod.get("hsn_code") or "64041990",
                    "gst_percentage": gst_val,
                    "vendor_code": vendor_val,
                    "attributes": new_attrs
                }
                async with sem:
                    try:
                        put_res = await client.put(
                            f"{BASE_URL}/api/v1/inventory/{pid}",
                            json=payload,
                            headers=headers
                        )
                        if put_res.status_code == 200:
                            success_count += 1
                        else:
                            fail_count += 1
                            print(f"    [FAIL] {prod.get('code')}: {put_res.status_code} {put_res.text[:200]}")
                    except Exception as e:
                        fail_count += 1
                        print(f"    [EXC] {prod.get('code')}: {e}")
                        
            tasks = [update_single_product(p, a, g, v) for p, a, g, v in to_update]
            await asyncio.gather(*tasks)
            print(f"\n  Synchronization finished: {success_count} succeeded, {fail_count} failed.")

        # Step 5: Verification via Database Manager
        print("\n" + "=" * 80)
        print("STEP 5: Verifying Zero Blanks via Database Manager SQL Query")
        print("=" * 80)
        q = """SELECT 
            count(*) as total_prods,
            count(*) filter (where code is null or code = '') as missing_code,
            count(*) filter (where barcode is null or barcode = '') as missing_barcode,
            count(*) filter (where name is null or name = '') as missing_name,
            count(*) filter (where brand is null or brand = '') as missing_brand,
            count(*) filter (where category is null or category = '') as missing_category,
            count(*) filter (where mrp is null) as missing_mrp,
            count(*) filter (where cost_price is null) as missing_cost_price,
            count(*) filter (where gst_percentage is null or gst_percentage = 0) as missing_gst,
            count(*) filter (where hsn_code is null or hsn_code = '') as missing_hsn,
            count(*) filter (where vendor_code is null or vendor_code = '') as missing_col_vendor,
            count(*) filter (where attributes->>'vendor_code' is null or attributes->>'vendor_code' = '') as missing_attr_vendor,
            count(*) filter (where attributes->>'department' is null or attributes->>'department' = '') as missing_dept,
            count(*) filter (where attributes->>'sub_category' is null or attributes->>'sub_category' = '') as missing_subcat,
            count(*) filter (where attributes->>'heel_type' is null or attributes->>'heel_type' = '') as missing_heel,
            count(*) filter (where attributes->>'upper_material' is null or attributes->>'upper_material' = '') as missing_upper,
            count(*) filter (where attributes->>'outsole_material' is null or attributes->>'outsole_material' = '') as missing_outsole_mat,
            count(*) filter (where attributes->>'outsole' is null or attributes->>'outsole' = '') as missing_outsole,
            count(*) filter (where attributes->>'purchase_class' is null or attributes->>'purchase_class' = '') as missing_purchase_class,
            count(*) filter (where attributes->>'image_link' is null or attributes->>'image_link' = '') as missing_image_link,
            count(*) filter (where attributes->>'gender' is null or attributes->>'gender' = '') as missing_gender,
            count(*) filter (where attributes->>'merchandise_category' is null or attributes->>'merchandise_category' = '') as missing_merch_cat
        FROM products"""
        verify_res = await client.post(
            f"{BASE_URL}/api/v1/database-manager/query",
            json={"query": q, "database": "smriti001"},
            headers=headers
        )
        if verify_res.status_code == 200 and verify_res.json().get("success"):
            row = verify_res.json()["rows"][0]
            for k, val in row.items():
                print(f"    {k:30}: {val}")
        else:
            print("  Verification query error:", verify_res.text)

if __name__ == "__main__":
    asyncio.run(harmonize_remote_attributes())
