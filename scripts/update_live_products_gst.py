"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.72.5
Created      : 2026-10-13
Modified     : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Migrate Live Footwear Products GST Rate to 5.00%
"""

import asyncio
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
            current_gst = float(p.get("gst_percentage") or 0)
            # Only update footwear items that currently have 0% GST
            if current_gst == 0.0 and (p.get("hsn_code") in ("64041990", "64032012") or p.get("category") in ("Footwear", "CHAPPAL", "SANDAL", "SHOE", "OTHERS") or (code.startswith(("CH-", "SND-", "SH-")))):
                to_update.append((pid, code))

        print(f"[3/4] Found {len(to_update)} footwear products with 0.00% GST requiring update to 5.00%.")
        if not to_update:
            print("  No products require GST update! All footwear products already have 5.00% GST.")
            return

        print("  Beginning asynchronous concurrent batch updates (concurrency=12)...")
        sem = asyncio.Semaphore(12)
        success_count = 0
        failure_count = 0

        async def update_single(pid, code):
            nonlocal success_count, failure_count
            async with sem:
                try:
                    resp = await client.put(
                        f"{BASE_URL}/api/v1/inventory/{pid}",
                        json={"gst_percentage": 5.0},
                        headers=headers
                    )
                    if resp.status_code == 200:
                        success_count += 1
                        if success_count % 50 == 0 or success_count == len(to_update):
                            print(f"    Progress: {success_count}/{len(to_update)} updated to 5.00% GST...")
                    else:
                        failure_count += 1
                        print(f"    [FAIL] {code}: {resp.status_code} {resp.text[:100]}")
                except Exception as ex:
                    failure_count += 1
                    print(f"    [ERR] {code}: {ex}")

        tasks = [update_single(pid, code) for pid, code in to_update]
        await asyncio.gather(*tasks)

        print(f"\n[4/4] Verification & Audit Summary:")
        print(f"  Successfully updated: {success_count}")
        print(f"  Failures: {failure_count}")

        # Post-update verification query across full catalog
        print("  Running post-update verification scan across all inventory...")
        page = 1
        all_verify_prods = []
        while True:
            res = await client.get(
                f"{BASE_URL}/api/v1/inventory?page={page}&page_size={page_size}",
                headers=headers
            )
            if res.status_code != 200:
                break
            data = res.json()
            items = data.get("items", [])
            if not items:
                break
            all_verify_prods.extend(items)
            if not data.get("has_next"):
                break
            page += 1

        gst_dist = {}
        for p in all_verify_prods:
            gst = p.get("gst_percentage")
            gst_dist[gst] = gst_dist.get(gst, 0) + 1

        print(f"  Final GST Rate Distribution across {len(all_verify_prods)} products:")
        for rate, count in sorted(gst_dist.items(), key=lambda x: str(x[0])):
            print(f"    {rate}%: {count} products")


if __name__ == "__main__":
    asyncio.run(main())
