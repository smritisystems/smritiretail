# -*- coding: utf-8 -*-
"""
Sync all Reliance Retail Limited delivery locations from local smriti001 to https://tattlythreads.smritisys.com/
Author: Jawahar Ramkripal Mallah
"""
import asyncio
import httpx
import psycopg2

BASE_URL = "https://tattlythreads.smritisys.com"
CUSTOMER_ID = "cust-rrl-192b561d"

async def sync_delivery_locations():
    # 1. Fetch local delivery locations
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT id, customer_id, location_name, address_line1, address_line2, 
               city, state, pincode, gstin, phone, contact_person, store_code, is_active
        FROM customer_delivery_locations
        WHERE customer_id = %s
        ORDER BY store_code;
    """, (CUSTOMER_ID,))
    cols = [desc[0] for desc in cur.description]
    local_locs = [dict(zip(cols, row)) for row in cur.fetchall()]
    conn.close()

    print(f"[Local] Loaded {len(local_locs)} delivery locations from local smriti001.")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 2. Login to remote
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        token = login_res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        print("[Remote] Authenticated successfully.")

        # 3. Fetch existing remote delivery locations
        existing_res = await client.get(
            f"{BASE_URL}/api/v1/customers/{CUSTOMER_ID}/delivery-locations",
            headers=headers
        )
        existing_locs = existing_res.json() if existing_res.status_code == 200 else []
        existing_store_codes = {l.get("storeCode") for l in existing_locs if l.get("storeCode")}
        print(f"[Remote] Currently has {len(existing_locs)} delivery locations ({len(existing_store_codes)} distinct store codes).")

        created_count = 0
        skipped_count = 0
        failed_count = 0

        # 4. Post missing locations
        for loc in local_locs:
            scode = loc.get("store_code")
            if scode in existing_store_codes:
                skipped_count += 1
                continue

            payload = {
                "locationName": loc.get("location_name") or f"Reliance Trends - Store {scode}",
                "addressLine1": loc.get("address_line1") or "Trends Store Address",
                "addressLine2": loc.get("address_line2") or "",
                "city": loc.get("city") or "Mumbai",
                "state": loc.get("state") or "Maharashtra",
                "pincode": loc.get("pincode") or "400001",
                "gstin": loc.get("gstin") or "27AAACR7055N1ZV",
                "phone": loc.get("phone") or "",
                "contactPerson": loc.get("contact_person") or "Store Manager",
                "storeCode": scode,
                "isActive": bool(loc.get("is_active", True))
            }

            try:
                res = await client.post(
                    f"{BASE_URL}/api/v1/customers/{CUSTOMER_ID}/delivery-locations",
                    json=payload,
                    headers=headers
                )
                if res.status_code in (200, 201):
                    created_count += 1
                    existing_store_codes.add(scode)
                    print(f"  [+] Created store location: {scode} ({loc.get('city')})")
                else:
                    failed_count += 1
                    print(f"  [!] Failed {scode}: {res.status_code} - {res.text[:120]}")
            except Exception as e:
                failed_count += 1
                print(f"  [!] Error {scode}: {e}")

        print(f"\n[Summary] Locations Sync Complete:")
        print(f"  Total Local   : {len(local_locs)}")
        print(f"  Created New   : {created_count}")
        print(f"  Skipped Exists: {skipped_count}")
        print(f"  Failed        : {failed_count}")

        # Final verification count on remote
        ver_res = await client.get(
            f"{BASE_URL}/api/v1/customers/{CUSTOMER_ID}/delivery-locations",
            headers=headers
        )
        final_locs = ver_res.json() if ver_res.status_code == 200 else []
        print(f"[Verification] Total delivery locations on remote now: {len(final_locs)}")

if __name__ == "__main__":
    asyncio.run(sync_delivery_locations())
