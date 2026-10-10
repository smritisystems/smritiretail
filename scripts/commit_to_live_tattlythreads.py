import asyncio
import csv
import json
import uuid
import httpx

TSV_PATH = r"F:\SMRITRretailNX\tests\fixtures\smart_import_192_footwear_items.tsv"

async def main():
    rows = []
    with open(TSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for i, r in enumerate(reader, start=1):
            upper = r.get("UPPER MATERIAL", "").strip()
            if upper.upper() == "MATERIAL":
                upper = "SYNTHETIC"
            
            heel = r.get("HEELS", "").strip()
            if heel.upper() == "WEDGES":
                heel = "WEDGE"
                
            cat = r.get("MERCHANDISE CATEGORY", "").strip()
            if cat.upper() == "SHOES":
                cat = "SHOE"
                
            sub = r.get("Sub category", "").strip()
            if sub.upper() == "MUEL":
                sub = "MULE"
                
            color = r.get("COLOR", "").strip()
            if color.upper() == "R-GOLD":
                color = "ROSE GOLD"

            row_dict = {
                "rowNumber": i,
                "barcode": r.get("BARCODE NO", "").strip(),
                "sku": r.get("SKU", "").strip(),
                "style_code": r.get("PRODUCT STYLE CODE", "").strip(),
                "styleArticle": r.get("PRODUCT STYLE CODE", "").strip(),
                "product_style_code": r.get("PRODUCT STYLE CODE", "").strip(),
                "product_name": f"{r.get('BRAND NAME', '').strip()} {r.get('PRODUCT STYLE CODE', '').strip()}",
                "brand": r.get("BRAND NAME", "").strip(),
                "color": color,
                "colour": color,
                "size": r.get("SIZE", "").strip(),
                "mrp": float(r.get("PLANNED MRP", 0) or 0),
                "selling_price": float(r.get("PLANNED MRP", 0) or 0),
                "cost_price": float(r.get("COST PRICE", 0) or 0),
                "gst_rate_percent": float(r.get("PRODUCT TAX", 0) or 0),
                "gst_percentage": float(r.get("PRODUCT TAX", 0) or 0),
                "hsn_code": r.get("HSN CODE", "").strip(),
                "gender": r.get("GENDER", "").strip(),
                "vendor_code": r.get("VENDOR CODE", "").strip(),
                "purchase_class": r.get("PURCHASE CLASS", "").strip(),
                "department": r.get("DEPARTMENT", "").strip(),
                "merchandise_category": cat,
                "MERCHANDISE_CATEGORY": cat,
                "category": cat,
                "product_type": cat,
                "subCategory": sub,
                "subcategory": sub,
                "heel_type": heel,
                "upper_material": upper,
                "outsole_material": r.get("OUTSOLE", "").strip(),
                "uom": "PAIR",
            }
            rows.append(row_dict)

    print(f"Loaded {len(rows)} items from {TSV_PATH}.")

    async with httpx.AsyncClient(timeout=180.0) as client:
        login_res = await client.post(
            "https://tattlythreads.smritisys.com/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        print("Login status:", login_res.status_code)
        l_json = login_res.json()
        token = l_json.get("access_token") or (l_json.get("data", {}).get("access_token"))
        assert token, f"Failed to obtain access token: {l_json}"
        print(f"Logged in successfully. Token: {token[:20]}...")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # 1. Preview
        print("\n--- 1. Executing Live Preview on https://tattlythreads.smritisys.com/ ---")
        preview_res = await client.post(
            "https://tattlythreads.smritisys.com/api/v1/universal-import/preview",
            json={"target": "ITEM_MASTER", "rows": rows},
            headers=headers
        )
        print("Preview HTTP Status:", preview_res.status_code)
        p_raw = preview_res.json()
        p_data = p_raw.get("data") if (isinstance(p_raw, dict) and "data" in p_raw) else p_raw
        summary = p_data.get("summary") if isinstance(p_data, dict) else {}
        print("Preview Summary:", json.dumps(summary, indent=2))
        reconcil = p_data.get("reconciliation_report", []) if isinstance(p_data, dict) else []
        print(f"Total reconciliation rows: {len(reconcil)}")
        errors = [r for r in reconcil if r.get("errors")]
        print(f"Rows with errors: {len(errors)}")
        for e in errors[:5]:
            print(f"Row {e.get('row_number')} (Style {e.get('style_code')}): {e.get('errors')}")

        if len(errors) == 0:
            # 2. Commit
            print("\n--- 2. Executing Universal Import Commit on https://tattlythreads.smritisys.com/ ---")
            commit_payload = {
                "target": "ITEM_MASTER",
                "rows": rows,
                "strategy": "ALL_ELIGIBLE",
                "import_strategy": "ALL_ELIGIBLE",
                "idempotency_key": f"live_commit_504_{uuid.uuid4().hex[:12]}",
                "dry_run": False
            }
            commit_res = await client.post(
                "https://tattlythreads.smritisys.com/api/v1/universal-import/commit",
                json=commit_payload,
                headers=headers
            )
            print(f"Commit Status Code: {commit_res.status_code}")
            c_raw = commit_res.json()
            print("Commit Response Summary:", json.dumps(c_raw.get("summary") or c_raw.get("data", {}).get("summary") or c_raw, indent=2))

            # 3. Check items count
            items_res = await client.get("https://tattlythreads.smritisys.com/api/v1/items?limit=5", headers=headers)
            print("\nLive items endpoint status:", items_res.status_code)
            if items_res.status_code == 200:
                print("Live items response:", items_res.json())

if __name__ == "__main__":
    asyncio.run(main())
