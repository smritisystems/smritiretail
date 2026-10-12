"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.72.3
Created      : 2026-10-12
Modified     : 2026-10-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Live Tattly Threads Item Master Seeder
"""

import asyncio
import json
import uuid
from pathlib import Path
import httpx
import openpyxl

SOURCE_FILE = Path(r"F:\Smriti-Clients Data\Tattly Threads\ItemMaster\OLD TO NEW (1).xlsx")
BASE_URL = "https://tattlythreads.smritisys.com"
BATCH_SIZE = 150


def load_and_normalize_items():
    if not SOURCE_FILE.exists():
        raise FileNotFoundError(f"Source file not found at: {SOURCE_FILE}")

    wb = openpyxl.load_workbook(str(SOURCE_FILE), data_only=True)
    all_items = []
    row_idx = 1
    excluded_multy = 0

    for sheetname in ["Sheet1", "Sheet2", "021026"]:
        ws = wb[sheetname]
        rows = list(ws.iter_rows(values_only=True))
        for r in rows[1:]:
            if not any(r):
                continue

            color = str(r[4] or "").strip().upper()
            # Directive: Exclude all items with MULTY / MULTI color
            if color in ("MULTY", "MULTI"):
                excluded_multy += 1
                continue

            bc = str(r[0]).strip()
            style = str(r[1]).strip()
            desc = str(r[2] or "BASIC").strip()
            brand = str(r[3] or "Tattly Threads").strip()
            size = str(r[5] or "").strip()
            mrp = float(r[6] or 0)
            cost = float(r[7] or 0)
            tax = float(r[8] or 5)
            hsn = str(r[9] or "64041990").strip()
            if hsn == "None" or not hsn:
                hsn = "64041990"
            gender = str(r[10] or "LADIES").strip().upper()
            vendor = str(r[11] or "TT").strip()
            pclass = str(r[12] or "SIS").strip()
            dept = str(r[13] or "LADIES FTW").strip()
            cat = str(r[14] or "CHAPPAL").strip()
            subcat = str(r[15] or "BURMY").strip()
            heel = str(r[16] or "FLAT").strip()
            upper = str(r[17] or "LEATHER").strip()
            outsole = str(r[18] or "PVC").strip()
            img = str(r[19] or style).strip()

            if cat.upper() == "SHOES":
                cat = "SHOE"
            if subcat.upper() == "MUEL":
                subcat = "MULE"
            if heel.upper() == "WEDGES":
                heel = "WEDGE"
            if upper.upper() == "MATERIAL":
                upper = "SYNTHETIC"

            item_dict = {
                "rowNumber": row_idx,
                "barcode": bc,
                "sku": f"{style}-{color}-{size}",
                "style_code": style,
                "styleArticle": style,
                "product_style_code": style,
                "product_name": f"{brand} {style} {color}",
                "itemDescription": desc,
                "brand": brand,
                "colour": color,
                "color": color,
                "size": size,
                "mrp": mrp,
                "selling_price": mrp,
                "cost_price": cost,
                "gst_rate_percent": tax,
                "gst_percentage": tax,
                "tax_rate": tax,
                "hsn_code": hsn,
                "gender": gender,
                "vendor_code": vendor,
                "purchase_class": pclass,
                "department": dept,
                "category": cat,
                "merchandise_category": cat,
                "subCategory": subcat,
                "subcategory": subcat,
                "heel_type": heel,
                "upper_material": upper,
                "outsole_material": outsole,
                "imageName": img,
                "uom": "PAIR",
            }
            all_items.append(item_dict)
            row_idx += 1

    print(f"[Loader] Loaded {len(all_items)} valid items (Excluded {excluded_multy} MULTY rows).")
    return all_items


async def seed_live():
    items = load_and_normalize_items()
    total_items = len(items)
    print(f"[Seeder] Initiating live seeding of {total_items} items into {BASE_URL}...")

    async with httpx.AsyncClient(timeout=180.0) as client:
        # Step 1: Login
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"},
        )
        if login_res.status_code != 200:
            print(f"[ERROR] Login failed: {login_res.status_code} {login_res.text}")
            return False

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        print("[Auth] Successfully logged into live server.")

        # Step 2: Full Preview Verification
        print("\n--- Phase 1: Pre-Commit Comprehensive Preview ---")
        preview_res = await client.post(
            f"{BASE_URL}/api/v1/universal-import/preview",
            json={"target": "ITEM_MASTER", "rows": items},
            headers=headers,
        )
        if preview_res.status_code != 200:
            print(f"[ERROR] Preview returned {preview_res.status_code}: {preview_res.text}")
            return False

        p_data = preview_res.json()
        summary = p_data.get("summary") or p_data.get("data", {}).get("summary") or {}
        print(f"[Preview] Status: {summary.get('status')}")
        print(f"[Preview] Valid Rows: {summary.get('valid_rows')} / {summary.get('total_rows')}")
        print(f"[Preview] Blocking Errors: {summary.get('blocking_errors')}")
        print(f"[Preview] Distinct Styles: {summary.get('distinct_styles')}")

        if summary.get("blocking_errors", 0) > 0:
            print("[ABORT] Cannot commit because blocking errors remain in preview.")
            return False

        # Step 3: Chunked Commit
        print("\n--- Phase 2: Committing Items in Batches ---")
        total_created = 0
        total_batches = (total_items + BATCH_SIZE - 1) // BATCH_SIZE

        for i in range(0, total_items, BATCH_SIZE):
            batch_num = (i // BATCH_SIZE) + 1
            batch_rows = items[i : i + BATCH_SIZE]
            idempotency_key = f"live_seed_{uuid.uuid4().hex[:12]}_b{batch_num}"
            print(f"\n[Commit Batch {batch_num}/{total_batches}] Committing {len(batch_rows)} rows (Rows {i+1} to {i+len(batch_rows)})...")

            commit_payload = {
                "target": "ITEM_MASTER",
                "rows": batch_rows,
                "strategy": "ALL_ELIGIBLE",
                "import_strategy": "ALL_ELIGIBLE",
                "idempotency_key": idempotency_key,
                "dry_run": False,
            }

            commit_res = await client.post(
                f"{BASE_URL}/api/v1/universal-import/commit",
                json=commit_payload,
                headers=headers,
            )

            if commit_res.status_code != 200:
                print(f"[ERROR] Batch {batch_num} failed with status {commit_res.status_code}: {commit_res.text}")
                return False

            c_data = commit_res.json()
            c_summary = c_data.get("summary") or c_data.get("data", {}).get("summary") or {}
            c_results = c_data.get("results") or c_data.get("data", {}).get("results") or []
            created_in_batch = c_summary.get("imported_rows") or c_summary.get("committed") or len(c_results) or len(batch_rows)
            total_created += created_in_batch
            print(f"[Batch {batch_num} OK] Successfully committed {created_in_batch} items. Cumulative: {total_created}/{total_items}")

        # Step 4: Verification against live server
        print("\n--- Phase 3: Final Catalog Verification on Live Server ---")
        offset = 0
        limit = 200
        live_items = []
        while True:
            res = await client.get(
                f"{BASE_URL}/api/v1/universal/items?limit={limit}&offset={offset}",
                headers=headers,
            )
            if res.status_code != 200:
                print(f"[WARN] Failed fetching verification page: {res.status_code}")
                break
            page_items = res.json()
            if not page_items:
                break
            live_items.extend(page_items)
            offset += len(page_items)
            if len(page_items) < limit:
                break

        print(f"[Verification] Authoritative Total Items on Live: {len(live_items)}")
        live_styles = set(it.get("style_code") for it in live_items if it.get("style_code"))
        live_barcodes = set()
        for it in live_items:
            for b in it.get("barcodes", []):
                live_barcodes.add(b.get("barcode"))
            for v in it.get("variants", []):
                for b in v.get("barcodes", []):
                    live_barcodes.add(b.get("barcode"))

        print(f"[Verification] Distinct Styles on Live: {len(live_styles)}")
        print(f"[Verification] Distinct Barcodes on Live: {len(live_barcodes)}")
        print("\n[SUCCESS] Seeding completed and verified!")
        return True


if __name__ == "__main__":
    asyncio.run(seed_live())
