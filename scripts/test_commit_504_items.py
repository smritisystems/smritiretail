import csv
import json
import uuid
import httpx
import asyncio
import psycopg2
from psycopg2.extras import RealDictCursor

TSV_PATH = r"F:\SMRITRretailNX\tests\fixtures\smart_import_192_footwear_items.tsv"

async def main():
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

    print(f"Loaded {len(rows)} items from {TSV_PATH}.")

    async with httpx.AsyncClient(timeout=180.0) as client:
        login_res = await client.post(
            "http://localhost:1981/api/v1/auth/login",
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
        print("\n--- 1. Executing Universal Import Preview ---")
        preview_res = await client.post(
            "http://localhost:1981/api/v1/universal-import/preview",
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

        # 2. Commit
        print("\n--- 2. Executing Universal Import Commit (strategy=ALL_ELIGIBLE) ---")
        commit_payload = {
            "target": "ITEM_MASTER",
            "rows": rows,
            "strategy": "ALL_ELIGIBLE",
            "import_strategy": "ALL_ELIGIBLE",
            "idempotency_key": f"commit_504_{uuid.uuid4().hex[:12]}",
            "dry_run": False
        }
        commit_res = await client.post(
            "http://localhost:1981/api/v1/universal-import/commit",
            json=commit_payload,
            headers=headers
        )
        print(f"Commit Status Code: {commit_res.status_code}")
        c_raw = commit_res.json()
        print("Commit Response Summary:", json.dumps(c_raw.get("summary") or c_raw.get("data", {}).get("summary") or c_raw, indent=2))

        # 3. Database Verification
        print("\n--- 3. Verifying PostgreSQL smriti001 Database ---")
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("SELECT COUNT(*) as cnt FROM items WHERE is_deleted = false;")
        items_cnt = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) as cnt FROM item_variants WHERE is_deleted = false;")
        variants_cnt = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) as cnt FROM item_barcodes WHERE is_deleted = false;")
        barcodes_cnt = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(DISTINCT item_code) as cnt FROM items WHERE is_deleted = false;")
        distinct_styles_cnt = cur.fetchone()["cnt"]

        print(f"Total Active Items in smriti001: {items_cnt}")
        print(f"Total Active Variants in smriti001: {variants_cnt}")
        print(f"Total Active Barcodes in smriti001: {barcodes_cnt}")
        print(f"Total Distinct Styles in smriti001: {distinct_styles_cnt}")

        # Sample check for some styles
        cur.execute("""
            SELECT i.item_code, i.brand, i.category, COUNT(iv.id) as variant_count
            FROM items i
            LEFT JOIN item_variants iv ON iv.item_id = i.id AND iv.is_deleted = false
            WHERE i.is_deleted = false
            GROUP BY i.id, i.item_code, i.brand, i.category
            ORDER BY i.item_code
            LIMIT 15;
        """)
        sample_styles = cur.fetchall()
        print("\nSample Imported Styles:")
        for s in sample_styles:
            print(f"Style: {s['item_code']} | Brand: {s['brand']} | Category: {s['category']} | Variants: {s['variant_count']}")

        conn.close()

if __name__ == "__main__":
    asyncio.run(main())
