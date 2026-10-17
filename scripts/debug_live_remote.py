import csv
import json
import httpx
import asyncio

TSV_PATH = r"F:\SMRITRretailNX\tests\fixtures\smart_import_192_footwear_items.tsv"

async def test_live_remote_api():
    rows = []
    with open(TSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for i, r in enumerate(reader, start=1):
            row_dict = {
                "rowNumber": i,
                "barcode": r.get("BARCODE NO", "").strip(),
                "style_code": r.get("PRODUCT STYLE CODE", "").strip(),
                "itemDescription": r.get("ITEM DESCRIPTION", "").strip(),
                "brand": r.get("BRAND NAME", "").strip(),
                "colour": r.get("COLOR", "").strip(),
                "size": r.get("SIZE", "").strip(),
                "code": r.get("SKU", "").strip(),
                "mrp": r.get("PLANNED MRP", "").strip(),
                "cost_price": r.get("COST PRICE", "").strip(),
                "gst_percentage": r.get("PRODUCT TAX", "").strip(),
                "hsn_code": r.get("HSN CODE", "").strip(),
                "gender": r.get("GENDER", "").strip(),
                "vendor_code": r.get("VENDOR CODE", "").strip(),
                "purchase_class": r.get("PURCHASE CLASS", "").strip(),
                "department": r.get("DEPARTMENT", "").strip(),
                "MERCHANDISE_CATEGORY": r.get("MERCHANDISE CATEGORY", "").strip(),
                "subCategory": r.get("Sub category", "").strip(),
                "heel_type": r.get("HEELS", "").strip(),
                "upper_material": r.get("UPPER MATERIAL", "").strip(),
                "outsole_material": r.get("OUTSOLE", "").strip(),
                "imageName": r.get("IMAGE LINK", "").strip(),
            }
            rows.append(row_dict)

    print(f"Prepared {len(rows)} rows for live remote test.")

    async with httpx.AsyncClient(timeout=60.0) as client:
        login_res = await client.post(
            "https://tattlythreads.smritisys.com/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        if login_res.status_code != 200:
            print(f"Login failed: {login_res.status_code} {login_res.text}")
            return
        token = login_res.json().get("access_token")
        print(f"Logged into live server! Token: {token[:15]}...")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        resp = await client.post(
            "https://tattlythreads.smritisys.com/api/v1/universal-import/preview",
            json={"target": "ITEM_MASTER", "rows": rows},
            headers=headers
        )
        print(f"Live Preview Status: {resp.status_code}")
        p_json = resp.json()
        summary = p_json.get("summary", {})
        print("Live Preview Summary:", json.dumps(summary, indent=2))
        reconcil = p_json.get("reconciliation_report", [])
        errors_found = [r for r in reconcil if r.get("errors")]
        print(f"Live total rows with errors: {len(errors_found)}")
        for e in errors_found[:10]:
            print(f"Row {e.get('row_number')} (Style: {e.get('style_code')}): {e.get('errors')}")

if __name__ == "__main__":
    asyncio.run(test_live_remote_api())
