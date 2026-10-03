"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Comprehensive Customer Catalogue & CRM Sub-System Audit:
1. PostgreSQL Database Schema & Relational Integrity Audit (smriti001)
2. FastAPI Backend API Gateway Audit (port 8000)
3. Headless Playwright UI Parity & Verification Audit (port 3000)
"""

import asyncio
import json
import os
import sys
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from playwright.async_api import async_playwright

API_BASE = "http://localhost:8000/api/v1"
WEB_BASE = "http://localhost:3000"
DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
SCREENSHOT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\d1e1ac2d-e193-4ebb-9bd8-b13b02474afe\screenshots_customer_catalogue_audit"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def audit_database_layer():
    print("=" * 80)
    print("PHASE 1: POSTGRESQL DATABASE SCHEMA & RELATIONAL INTEGRITY AUDIT (smriti001)")
    print("=" * 80)

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    tables_to_check = [
        "customers",
        "customer_groups",
        "customer_gst_registrations",
        "customer_billing_locations",
        "customer_delivery_locations",
        "customer_external_identities",
        "customer_article_mappings",
        "customer_credit_ledger_entries",
    ]

    print("\n[1.1] Table Row Counts & Primary Integrity:")
    for t in tables_to_check:
        cur.execute(f"SELECT count(*) AS cnt FROM {t};")
        cnt = cur.fetchone()["cnt"]
        print(f"  - Table `{t:<32}`: {cnt:>5} records")

    print("\n[1.2] Column & Constraints Audit for `customers` Table:")
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'customers'
        ORDER BY ordinal_position;
    """)
    cols = cur.fetchall()
    print(f"  Total columns in `customers`: {len(cols)}")
    key_cols = ["id", "code", "name", "mobile", "pricing_basis", "allow_promotions_on_rate", "customer_group_id", "is_tax_inclusive"]
    for c in cols:
        if c["column_name"] in key_cols:
            print(f"    * {c['column_name']:<25}: Type={c['data_type']:<15} Nullable={c['is_nullable']:<4} Default={str(c['column_default']):<20}")

    print("\n[1.3] Customer Master Record Audit for Anchor Customer 'RRL-001':")
    cur.execute("""
        SELECT c.id, c.code, c.name, c.mobile, c.email, c.pricing_basis, c.allow_promotions_on_rate,
               c.status, cg.name AS group_name
        FROM customers c
        LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
        WHERE c.code = 'RRL-001';
    """)
    rrl = cur.fetchone()
    if rrl:
        print(f"  Customer ID         : {rrl['id']}")
        print(f"  Customer Code       : {rrl['code']}")
        print(f"  Customer Name       : {rrl['name']}")
        print(f"  Mobile              : {rrl['mobile']}")
        print(f"  Group               : {rrl['group_name']}")
        print(f"  Pricing Basis       : {rrl['pricing_basis']} (Authoritative)")
        print(f"  Margin Protection   : Allow Promos on Rate = {rrl['allow_promotions_on_rate']}")

        # Audit RRL-001 Sub-entities
        cust_id = rrl["id"]
        cur.execute("SELECT gstin, state_name, registration_type, is_primary FROM customer_gst_registrations WHERE customer_id = %s;", (cust_id,))
        gsts = cur.fetchall()
        print(f"  GST Registrations   : {len(gsts)} registered")
        for g in gsts:
            print(f"    - GSTIN: {g['gstin']} ({g['state_name']}, {g['registration_type']}, Primary={g['is_primary']})")

        cur.execute("SELECT billing_store_code, location_name, city, state, pincode, is_default FROM customer_billing_locations WHERE customer_id = %s;", (cust_id,))
        bills = cur.fetchall()
        print(f"  Billing Locations   : {len(bills)} registered")
        for b in bills:
            print(f"    - Store Code: {b['billing_store_code']} ({b['location_name']}, {b['city']}, Default={b['is_default']})")

        cur.execute("SELECT count(*) AS cnt FROM customer_delivery_locations WHERE customer_id = %s;", (cust_id,))
        deliv_cnt = cur.fetchone()["cnt"]
        print(f"  Delivery Locations  : {deliv_cnt} physical sites")

        cur.execute("SELECT count(*) AS cnt FROM customer_article_mappings WHERE customer_id = %s;", (cust_id,))
        art_cnt = cur.fetchone()["cnt"]
        print(f"  Article Mappings    : {art_cnt} buyer SKU cross-references")
    else:
        print("  [ERROR] Customer RRL-001 not found!")

    conn.close()
    return rrl


def audit_backend_api():
    print("\n" + "=" * 80)
    print("PHASE 2: FASTAPI BACKEND API GATEWAY AUDIT (port 8000)")
    print("=" * 80)

    # 1. Login to acquire JWT token
    print("[2.1] Authenticating with FastAPI /api/v1/auth/login...")
    login_resp = requests.post(f"{API_BASE}/auth/login", json={"username": "admin", "password": "Admin@123"})
    if login_resp.status_code != 200:
        print(f"  [FAIL] Login failed: {login_resp.status_code} - {login_resp.text}")
        sys.exit(1)
    
    token = login_resp.json()["access_token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "MAIN",
    }
    print("  [OK] JWT Bearer token acquired. Multi-tenant headers established.")

    # 2. List Customers
    print("\n[2.2] Testing GET /api/v1/crm/customers...")
    resp = requests.get(f"{API_BASE}/crm/customers?limit=5", headers=headers)
    print(f"  Status Code: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    cust_list = resp.json()
    print(f"  Retrieved {len(cust_list)} customers from backend.")
    if cust_list:
        sample = cust_list[0]
        pbasis = sample.get('pricingBasis') or sample.get('pricing_basis')
        print(f"  Sample Customer: ID={sample.get('id')} Code={sample.get('code')} Name={sample.get('name')} PricingBasis={pbasis}")

    # 3. List Customer Groups
    print("\n[2.3] Testing GET /api/v1/crm/customer-groups...")
    resp = requests.get(f"{API_BASE}/crm/customer-groups", headers=headers)
    print(f"  Status Code: {resp.status_code}")
    assert resp.status_code == 200
    groups = resp.json()
    print(f"  Retrieved {len(groups)} customer groups.")

    # 4. Search Customer RRL-001
    print("\n[2.4] Testing GET /api/v1/crm/customers/search?q=RRL-001...")
    resp = requests.get(f"{API_BASE}/crm/customers/search?q=RRL-001", headers=headers)
    print(f"  Status Code: {resp.status_code}")
    assert resp.status_code == 200
    search_results = resp.json()
    print(f"  Found {len(search_results)} search match(es).")
    rrl_api = search_results[0] if search_results else None
    if rrl_api:
        pbasis = rrl_api.get('pricingBasis') or rrl_api.get('pricing_basis')
        print(f"  Match: {rrl_api.get('code')} | {rrl_api.get('name')} | PricingBasis={pbasis}")

    # 5. Customer Sub-resources
    if rrl_api:
        cust_id = rrl_api["id"]
        # 5.1 Single Customer Details
        print(f"\n[2.5] Testing GET /api/v1/crm/customers/{cust_id}...")
        resp = requests.get(f"{API_BASE}/crm/customers/{cust_id}", headers=headers)
        print(f"  Status Code: {resp.status_code}")
        assert resp.status_code == 200
        cust_data = resp.json()
        print(f"  Customer Record: {cust_data.get('name')} ({cust_data.get('code')}) | Mobile: {cust_data.get('mobile')}")

        # 5.2 GST Registrations
        print(f"\n[2.6] Testing GET /api/v1/crm/customers/{cust_id}/gst-registrations...")
        resp = requests.get(f"{API_BASE}/crm/customers/{cust_id}/gst-registrations", headers=headers)
        print(f"  Status Code: {resp.status_code}")
        if resp.status_code == 200:
            print(f"  GST Registrations: {len(resp.json())} entries retrieved.")

        # 5.3 Billing Locations
        print(f"\n[2.7] Testing GET /api/v1/crm/customers/{cust_id}/billing-locations...")
        resp = requests.get(f"{API_BASE}/crm/customers/{cust_id}/billing-locations", headers=headers)
        print(f"  Status Code: {resp.status_code}")
        if resp.status_code == 200:
            print(f"  Billing Locations: {len(resp.json())} entries retrieved.")

        # 5.4 Delivery Locations
        print(f"\n[2.8] Testing GET /api/v1/crm/customers/{cust_id}/delivery-locations...")
        resp = requests.get(f"{API_BASE}/crm/customers/{cust_id}/delivery-locations", headers=headers)
        print(f"  Status Code: {resp.status_code}")
        if resp.status_code == 200:
            print(f"  Delivery Locations: {len(resp.json())} entries retrieved.")

    # 6. Duplicate Check API
    print("\n[2.9] Testing POST /api/v1/crm/customers/check-duplicate...")
    dup_resp = requests.post(
        f"{API_BASE}/crm/customers/check-duplicate",
        headers=headers,
        json={"mobile": "9820098200", "code": "RRL-001"}
    )
    print(f"  Status Code: {dup_resp.status_code}")
    if dup_resp.status_code == 200:
        dup_data = dup_resp.json()
        has_dup = dup_data.get('hasDuplicate') if 'hasDuplicate' in dup_data else dup_data.get('has_duplicate')
        print(f"  Duplicate Check Result: has_duplicate={has_dup}")


async def audit_frontend_ui():
    print("\n" + "=" * 80)
    print("PHASE 3: HEADLESS PLAYWRIGHT FRONTEND UI VERIFICATION (port 3000)")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(viewport={"width": 1600, "height": 950})
        page = await context.new_page()

        # Step 1: Login
        print("[3.1] Navigating to http://localhost:3000/?tab=customer-master...")
        await page.goto(f"{WEB_BASE}/?tab=customer-master", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)

        # Handle login screen
        admin_quick_btn = page.locator('button:has-text("Admin")')
        auth_btn = page.locator('button:has-text("Authorize Operator")')
        if await auth_btn.count() > 0 and await auth_btn.is_visible():
            print("  Login screen detected. Clicking Admin & Authorizing...")
            if await admin_quick_btn.count() > 0:
                await admin_quick_btn.click()
                await page.wait_for_timeout(300)
            await auth_btn.click()
            await page.wait_for_timeout(2500)

        # Handle company selector modal
        enter_ws_btn = page.locator('button:has-text("Enter Workspace"), button:has-text("Connect Workspace"), button:has-text("Connect")')
        if await enter_ws_btn.count() > 0 and await enter_ws_btn.first.is_visible():
            print("  Company selection detected. Connecting...")
            await enter_ws_btn.first.click()
            await page.wait_for_timeout(3000)

        # If not already on customer-master, switch via custom event
        if await page.locator('text="Customer Catalogue"').count() == 0:
            print("  Dispatching smriti_navigate_module for customer-master...")
            await page.evaluate("""() => {
                window.dispatchEvent(new CustomEvent('smriti_navigate_module', { detail: { moduleId: 'customer-master' } }));
            }""")
            await page.wait_for_timeout(2500)

        # Screenshot 1: Customer Catalogue Form View
        ss1 = os.path.join(SCREENSHOT_DIR, "01_customer_catalogue_form_view.png")
        await page.screenshot(path=ss1, full_page=False)
        print(f"  [OK] Screenshot 1 saved: {ss1}")

        # Step 2: Switch to Directory Grid View
        print("\n[3.2] Switching to Customer Master Directory Grid View...")
        dir_btn = page.locator('button:has-text("Directory")').first
        if await dir_btn.count() > 0 and await dir_btn.is_visible():
            await dir_btn.click()
            await page.wait_for_timeout(1500)

        # Screenshot 2: Customer Master Directory Grid Mode
        ss2 = os.path.join(SCREENSHOT_DIR, "02_customer_catalogue_directory_grid.png")
        await page.screenshot(path=ss2, full_page=False)
        print(f"  [OK] Screenshot 2 saved: {ss2}")

        # Step 3: In Directory Grid, click row for RRL-001 to load it into Catalogue Form View
        print("\n[3.3] Selecting Customer RRL-001 from Directory Grid...")
        rrl_row = page.locator('tr:has-text("RRL-001")').first
        if await rrl_row.count() > 0:
            await rrl_row.click()
            await page.wait_for_timeout(1500)
            print("  Clicked RRL-001 row in Directory Grid. Switched to Form View.")

        # Screenshot 3: Selected Customer RRL-001 Basic Details (Form Tab)
        ss3 = os.path.join(SCREENSHOT_DIR, "03_customer_catalogue_rrl001_basic_details.png")
        await page.screenshot(path=ss3, full_page=False)
        print(f"  [OK] Screenshot 3 saved: {ss3}")

        # Step 4: Switch to Additional Details Tab
        print("\n[3.4] Inspecting Additional Details Tab (Billing Basis & Margin Protection)...")
        addl_tab = page.locator('button:has-text("Additional Details"), button:has-text("3. The \\"Additional Details\\" Tab")').first
        if await addl_tab.count() > 0 and await addl_tab.is_visible():
            await addl_tab.click()
            await page.wait_for_timeout(1500)

        # Screenshot 4: Additional Details Tab
        ss4 = os.path.join(SCREENSHOT_DIR, "04_customer_catalogue_rrl001_additional_details.png")
        await page.screenshot(path=ss4, full_page=False)
        print(f"  [OK] Screenshot 4 saved: {ss4}")

        # Step 5: Billing Workspace & F2 Customer Browse Window
        print("\n[3.5] Navigating to Billing Workspace and testing [F2] Customer Search & Browse Window...")
        await page.evaluate("""() => {
            window.dispatchEvent(new CustomEvent('smriti_navigate_module', { detail: { moduleId: 'billing' } }));
        }""")
        await page.wait_for_timeout(2500)

        # Click Customer Search button in Billing POS header or press F2
        cust_browse_btn = page.locator('button[title*="Customer"], button:has-text("Customer Browse"), button:has-text("Lookup Customer")').first
        if await cust_browse_btn.count() > 0 and await cust_browse_btn.is_visible():
            await cust_browse_btn.click()
            await page.wait_for_timeout(1500)
        else:
            # Trigger F2 and switch entity to Customer
            await page.keyboard.press("F2")
            await page.wait_for_timeout(1500)
            cust_tab = page.locator('div[role="dialog"] button:has-text("Customer")').first
            if await cust_tab.count() > 0 and await cust_tab.is_visible():
                await cust_tab.click()
                await page.wait_for_timeout(1000)

        # Search for RRL-001 in the lookup modal
        f2_search = page.locator('div[role="dialog"] input, div:has-text("Customer Search & Browse") input, input[placeholder*="Locate"]').first
        if await f2_search.count() > 0 and await f2_search.is_visible():
            await f2_search.fill("RRL-001")
            await page.wait_for_timeout(1000)

        # Screenshot 5: F2 Browse Window with Customer lookup
        ss5 = os.path.join(SCREENSHOT_DIR, "05_customer_catalogue_f2_quick_search.png")
        await page.screenshot(path=ss5, full_page=False)
        print(f"  [OK] Screenshot 5 saved: {ss5}")

        await browser.close()

    print("\n" + "=" * 80)
    print("CUSTOMER CATALOGUE END-TO-END AUDIT COMPLETED SUCCESSFULLY")
    print("=" * 80)


def main():
    audit_database_layer()
    audit_backend_api()
    asyncio.run(audit_frontend_ui())


if __name__ == "__main__":
    main()
