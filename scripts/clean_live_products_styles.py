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
Classification: Clean Live Product Styles & Separate Vendor Codes
"""

import asyncio
import re
import sys
import httpx

BASE_URL = "https://tattlythreads.smritisys.com"


async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("[1/4] Authenticating with SMRITI Retail OS...")
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"},
        )
        if login_res.status_code != 200:
            print(f"Authentication failed: {login_res.status_code} {login_res.text}")
            sys.exit(1)

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        print("  Authenticated successfully.")

        print("[2/4] Fetching all products from inventory...")
        page = 1
        page_size = 100
        all_prods = []
        while True:
            res = await client.get(
                f"{BASE_URL}/api/v1/inventory?page={page}&page_size={page_size}",
                headers=headers
            )
            if res.status_code != 200:
                print(f"Failed to fetch page {page}: {res.status_code} {res.text}")
                break
            data = res.json()
            items = data.get("items", [])
            if not items:
                break
            all_prods.extend(items)
            if not data.get("has_next"):
                break
            page += 1

        print(f"  Total products fetched: {len(all_prods)}")

        to_update = []
        for p in all_prods:
            pid = p["id"]
            code = p.get("code") or ""
            current_style = (p.get("style_code") or "").strip()
            # Match pattern: STYLE-VENDOR where VENDOR is 1-2 uppercase letters
            m = re.match(r"^(.*?)-([A-Z]{1,2})$", current_style)
            if m:
                clean_style = m.group(1).strip()
                vendor = m.group(2).strip()
                to_update.append((pid, code, current_style, clean_style, vendor))

        print(f"[3/4] Found {len(to_update)} products with vendor suffix in style_code.")
        if not to_update:
            print("  No products require style cleaning! All product styles are clean.")
            return

        print("  Beginning asynchronous concurrent batch updates (concurrency=12)...")
        sem = asyncio.Semaphore(12)
        success_count = 0
        failure_count = 0

        async def update_single(pid, code, curr_st, clean_st, vend):
            nonlocal success_count, failure_count
            async with sem:
                try:
                    resp = await client.put(
                        f"{BASE_URL}/api/v1/inventory/{pid}",
                        json={"style_code": clean_st, "vendor_code": vend},
                        headers=headers
                    )
                    if resp.status_code == 200:
                        success_count += 1
                        if success_count % 50 == 0 or success_count == len(to_update):
                            print(f"    Progress: {success_count}/{len(to_update)} updated...")
                    else:
                        failure_count += 1
                        print(f"    [FAIL] {code}: {resp.status_code} {resp.text[:100]}")
                except Exception as ex:
                    failure_count += 1
                    print(f"    [ERR] {code}: {ex}")

        tasks = [
            update_single(pid, code, curr_st, clean_st, vend)
            for pid, code, curr_st, clean_st, vend in to_update
        ]
        await asyncio.gather(*tasks)

        print(f"\n[4/4] Verification & Audit Summary:")
        print(f"  Successfully updated: {success_count}")
        print(f"  Failures: {failure_count}")

        # Verification pass
        print("  Running post-update verification query...")
        verify_page = await client.get(
            f"{BASE_URL}/api/v1/inventory?page=1&page_size=100",
            headers=headers
        )
        sample_items = verify_page.json().get("items", [])
        sample_styles = {p.get("code"): (p.get("style_code"), p.get("vendor_code")) for p in sample_items[:10]}
        for sku, (st, v) in sample_styles.items():
            print(f"    SKU: {sku:<25} | Style: {st:<10} | Vendor: {v}")


if __name__ == "__main__":
    asyncio.run(main())
