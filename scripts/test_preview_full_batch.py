import csv
import json
import httpx
import asyncio

TSV_PATH = r"F:\SMRITRretailNX\tests\fixtures\smart_import_192_footwear_items.tsv"

async def test_api_preview_and_commit():
    rows = []
    with open(TSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for i, r in enumerate(reader, start=1):
            row_dict = {
                "rowNumber": i,
                "barcode": r.get("BARCODE NO", "").strip(),
                "sku": r.get("SKU", "").strip(),
                "style_code": r.get("PRODUCT STYLE CODE", "").strip(),
                "styleArticle": r.get("PRODUCT STYLE CODE", "").strip(),
                "product_style_code": r.get("PRODUCT STYLE CODE", "").strip(),
                "product_name": f"{r.get('BRAND NAME', '').strip()} {r.get('PRODUCT STYLE CODE', '').strip()}",
                "brand": r.get("BRAND NAME", "").strip(),
                "color": r.get("COLOR", "").strip(),
                "size": r.get("SIZE", "").strip(),
                "mrp": float(r.get("PLANNED MRP", 0) or 0),
                "selling_price": float(r.get("PLANNED MRP", 0) or 0),
                "cost_price": float(r.get("COST PRICE", 0) or 0),
                "gst_rate_percent": float(r.get("PRODUCT TAX", 0) or 0),
                "hsn_code": r.get("HSN CODE", "").strip(),
                "gender": r.get("GENDER", "").strip(),
                "vendor_code": r.get("VENDOR CODE", "").strip(),
                "purchase_class": r.get("PURCHASE CLASS", "").strip(),
                "department": r.get("DEPARTMENT", "").strip(),
                "merchandise_category": r.get("MERCHANDISE CATEGORY", "").strip(),
                "category": r.get("MERCHANDISE CATEGORY", "").strip(),
                "product_type": r.get("MERCHANDISE CATEGORY", "").strip(),
                "subCategory": r.get("Sub category", "").strip(),
                "subcategory": r.get("Sub category", "").strip(),
                "heel_type": r.get("HEELS", "").strip(),
                "upper_material": r.get("UPPER MATERIAL", "").strip(),
                "outsole_material": r.get("OUTSOLE", "").strip(),
                "uom": "PRS",
            }
            rows.append(row_dict)

    print(f"Prepared {len(rows)} rows for API test.")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Login to get token on port 1981
        login_res = await client.post(
            "http://localhost:1981/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        if login_res.status_code != 200:
            print(f"Login with Admin@123 failed ({login_res.status_code}), trying Password@123...")
            login_res = await client.post(
                "http://localhost:1981/api/v1/auth/login",
                json={"username": "admin", "password": "Password@123"}
            )
        if login_res.status_code != 200:
            print(f"Login failed: {login_res.status_code} {login_res.text}")
            return
        token = login_res.json().get("access_token")
        print(f"Logged in successfully. Token: {token[:15]}...")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # 2. Preview
        print("\n--- Testing /api/v1/universal-import/preview ---")
        preview_payload = {
            "target": "ITEM_MASTER",
            "rows": rows
        }
        resp = await client.post(
            "http://localhost:1981/api/v1/universal-import/preview",
            json=preview_payload,
            headers=headers
        )
        print(f"Preview Status Code: {resp.status_code}")
        if resp.status_code == 200:
            p_json = resp.json()
            summary = p_json.get("summary", {})
            print("Preview Summary:", json.dumps(summary, indent=2))
            reconcil = p_json.get("reconciliation_report", [])
            print(f"Reconciliation rows returned: {len(reconcil)}")
            errors_found = [r for r in reconcil if r.get("errors")]
            print(f"Rows with errors: {len(errors_found)}")
            if errors_found:
                for e in errors_found[:5]:
                    print(f"Row {e.get('row_number')}: {e.get('errors')}")
        else:
            print("Preview Response:", resp.text)

if __name__ == "__main__":
    asyncio.run(test_api_preview_and_commit())
