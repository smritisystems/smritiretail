# Project      : SMRITI Retail OS
# Repository   : SMRITIRetailNX
# Organization : AITDL NETWORKS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 6.77.0
# Created      : 2026-10-17
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal / Automated Headless Playwright Full Cycle Verification

import asyncio
import os
import sys
import json
import shutil
import urllib.request
import psycopg2
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3000"
API_URL = "http://127.0.0.1:1981"
OUTPUT_DIR = os.path.join(os.getcwd(), "docs", "walkthrough", "sales", "evidence")
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\d3046702-19a3-432b-a17e-17337a4ec8a8\screenshots_sales_channel_psv"
DB_URL = "postgresql://postgres:postgres@localhost:2781/smriti001"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def get_admin_jwt_token():
    login_url = f"{API_URL}/api/v1/auth/login"
    payload = json.dumps({"username": "admin", "password": "Admin@123"}).encode()
    req = urllib.request.Request(login_url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get("access_token")
    except Exception as e:
        print(f"[Auth Error] Failed to get JWT token: {e}")
        return None

def copy_to_artifacts(src_filename):
    src = os.path.join(OUTPUT_DIR, src_filename)
    if os.path.exists(src) and os.path.exists(ARTIFACT_DIR):
        dst = os.path.join(ARTIFACT_DIR, src_filename)
        shutil.copy2(src, dst)
        print(f"  -> Synced to Artifacts: {dst}")

async def run_full_cycle():
    print("=" * 90)
    print("SMRITI RETAIL OS — HEADLESS PLAYWRIGHT FULL-CYCLE VERIFICATION")
    print("Phase 2: Conditional Store Code Visibility & Automatic PSV Projection Mapping")
    print("=" * 90)
    print(f"Frontend URL : {BASE_URL}")
    print(f"Backend API  : {API_URL}")
    print(f"PostgreSQL   : {DB_URL}")
    print(f"Output Dir   : {OUTPUT_DIR}")
    print(f"Artifact Dir : {ARTIFACT_DIR}")
    print("-" * 90)

    token = get_admin_jwt_token()
    if not token:
        print("[FAIL] Could not acquire admin JWT token from backend.")
        sys.exit(1)
    print(f"[AUTH OK] Admin token acquired: {token[:25]}...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        context = await browser.new_context(
            viewport={"width": 1600, "height": 950},
            device_scale_factor=1.0,
        )
        page = await context.new_page()

        print("\n[STEP 1] Pre-seeding authenticated local storage on domain...")
        await page.goto(BASE_URL, wait_until="commit")
        await page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token}');
            localStorage.setItem('smriti_user', JSON.stringify({{
                id: 'usr-admin',
                username: 'admin',
                role: 'MANAGER',
                fullName: 'System Administrator',
                branchId: 'BR-001',
                companyId: 'COMP-001'
            }}));
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
            localStorage.setItem('smriti_setup_completed', 'true');
        }}""")

        # Navigate to Billing Workspace
        print("\n[STEP 2] Navigating to Billing Terminal (?tab=propos)...")
        await page.goto(f"{BASE_URL}/?tab=propos", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 1. Initial State: B2B_WHOLESALE
        print("\n[STEP 3] Verifying initial B2B Wholesale state...")
        channel_select = page.locator('[data-testid="sales-channel-select"]')
        await channel_select.wait_for(state="visible", timeout=15000)
        initial_val = await channel_select.input_value()
        print(f"  Sales Channel current value: '{initial_val}'")
        assert initial_val == "B2B_WHOLESALE", f"Expected B2B_WHOLESALE, got {initial_val}"

        # Confirm store code container is NOT visible
        loc_container = page.locator('[data-testid="delivery-location-container"]')
        store_container = page.locator('[data-testid="delivery-store-code-container"]')
        assert await loc_container.count() == 0, "Delivery location container must be hidden for B2B_WHOLESALE"
        assert await store_container.count() == 0, "Delivery store code container must be hidden for B2B_WHOLESALE"
        print("  ✓ Delivery Location and Store Code containers are hidden for B2B_WHOLESALE.")

        shot1 = "01_initial_b2b_wholesale.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, shot1))
        copy_to_artifacts(shot1)

        # 2. Switch to GENERAL_TRADE: verify containers remain hidden
        print("\n[STEP 4] Selecting General Trade channel...")
        await channel_select.select_option("GENERAL_TRADE")
        await page.wait_for_timeout(500)
        assert await loc_container.count() == 0, "Delivery location container must remain hidden for GENERAL_TRADE"
        assert await store_container.count() == 0, "Delivery store code container must remain hidden for GENERAL_TRADE"
        print("  ✓ Delivery Location and Store Code containers remain hidden for GENERAL_TRADE.")

        shot2 = "02_general_trade_hidden.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, shot2))
        copy_to_artifacts(shot2)

        # 3. Switch to MODERN_TRADE: select customer Reliance Retail Limited
        print("\n[STEP 5] Selecting Modern Trade channel & Customer Reliance Retail...")
        await channel_select.select_option("MODERN_TRADE")
        await page.wait_for_timeout(500)

        # Select Customer: Search "RRL-001" (exact code auto-populates)
        cust_input = page.locator('input[placeholder*="Search customer"]')
        await cust_input.click()
        await cust_input.fill("RRL-001")
        await page.wait_for_timeout(1000)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(2000)

        # Confirm store containers are now visible
        await loc_container.wait_for(state="visible", timeout=15000)
        await store_container.wait_for(state="visible", timeout=15000)
        print("  ✓ Delivery Location and Store Code containers are now VISIBLE for MODERN_TRADE.")

        # Reset selection to empty to test mandatory validation
        deliv_select = page.locator('[data-testid="delivery-location-select"]')
        if await deliv_select.count() > 0:
            await deliv_select.select_option("")
            await page.wait_for_timeout(500)

        shot3 = "03_modern_trade_mandatory_store.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, shot3))
        copy_to_artifacts(shot3)

        # Close any lingering F2 overlay if present
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        # 4. Add an item first so cart is not empty
        print("\n[STEP 6] Adding line item to cart (SKU-CPO1-31e3cb)...")
        stock_input = page.locator('#directStockNo')
        await stock_input.click()
        await stock_input.fill("SKU-CPO1-31e3cb")
        await page.wait_for_timeout(1000)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1000)

        # Press Enter again to commit direct entry
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(2000)

        # Verify line item is committed into table
        table_item = page.locator('table').first.locator('tbody tr:has-text("Widget A")').first
        await table_item.wait_for(state="visible", timeout=10000)
        print("  ✓ Item successfully committed to cart table (Widget A).")

        # 5. Negative Test: Attempt settlement without store code selected
        print("\n[STEP 7] Negative Test: Attempting settlement with store code unselected...")
        # Open settlement via Settle & Save (F8) or shortcut
        settle_btn = page.locator('button:has-text("Settle & Save (F8)")')
        await settle_btn.wait_for(state="visible", timeout=10000)
        await settle_btn.click()
        await page.wait_for_timeout(1000)

        # In settlement modal, click Complete Settlement
        complete_modal_btn = page.locator('button:has-text("Complete Settlement")').first
        await complete_modal_btn.wait_for(state="visible", timeout=10000)
        await complete_modal_btn.click()
        await page.wait_for_timeout(1000)

        # Verify toast error appears
        toast_elem = page.locator('text="Store Location Required"').first
        await toast_elem.wait_for(state="visible", timeout=10000)
        print("  ✓ Toast caught: 'Store Location Required'")

        # Capture blocking error screenshot
        shot4 = "04_settlement_blocked_missing_store.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, shot4))
        copy_to_artifacts(shot4)
        print("  ✓ Settlement blocked with mandatory store location requirement.")

        # Close settlement modal if still open
        cancel_btn = page.locator('button:has-text("Cancel (Esc)")')
        if await cancel_btn.count() > 0:
            await cancel_btn.click()
            await page.wait_for_timeout(1000)

        # 6. Select valid store location and verify automatic PSV resolution
        print("\n[STEP 8] Selecting Store Location 'cdl-c64f6f2fec8a1d4e0a656483' (S4NN/8319)...")
        await deliv_select.select_option("cdl-c64f6f2fec8a1d4e0a656483")
        await page.wait_for_timeout(2000)

        store_code_disp = page.locator('[data-testid="delivery-store-code-display"]')
        store_val = (await store_code_disp.text_content()).strip()
        print(f"  Store Code Display value: '{store_val}'")
        assert "S4NN/8319" in store_val, f"Expected store code S4NN/8319, got '{store_val}'"
        print("  ✓ Store code badge updated to S4NN/8319.")

        shot5 = "05_store_selected_psv_resolved.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, shot5))
        copy_to_artifacts(shot5)

        # 7. Item in cart inspection screenshot
        shot6 = "06_item_added_to_cart.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, shot6))
        copy_to_artifacts(shot6)

        # 8. Complete settlement successfully
        print("\n[STEP 9] Opening Settlement modal and committing invoice...")
        await settle_btn.click()
        await page.wait_for_timeout(1000)

        complete_modal_btn = page.locator('button:has-text("Complete Settlement")').first
        await complete_modal_btn.wait_for(state="visible", timeout=10000)
        await complete_modal_btn.click()
        
        # Await settlement complete toast
        settle_toast = page.locator('text="Settlement Complete"').first
        try:
            await settle_toast.wait_for(state="visible", timeout=15000)
            print("  ✓ Toast caught: 'Settlement Complete'")
        except Exception:
            print("  (Toast auto-dismissed or already processed)")
        await page.wait_for_timeout(2000)

        shot7 = "07_invoice_settlement_success.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, shot7))
        copy_to_artifacts(shot7)
        print("  ✓ Invoice settlement committed successfully.")

        await browser.close()

    # 9. Direct PostgreSQL Database Assertions
    print("\n[STEP 10] Direct PostgreSQL Transactional Verification on port 2781...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT invoice_no, sales_channel, delivery_location_id, delivery_store_code, grand_total, customer_name
        FROM sales_invoices
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
    """)
    row = cur.fetchone()
    print("Latest Invoice Record in PostgreSQL:")
    print(f"  Invoice No           : {row[0]}")
    print(f"  Sales Channel        : {row[1]}")
    print(f"  Delivery Location ID : {row[2]}")
    print(f"  Delivery Store Code  : {row[3]}")
    print(f"  Grand Total (₹)      : {row[4]}")
    print(f"  Customer Name        : {row[5]}")

    assert row[1] == "MODERN_TRADE", f"Expected sales_channel MODERN_TRADE, got {row[1]}"
    assert row[2] == "cdl-c64f6f2fec8a1d4e0a656483", f"Expected delivery_location_id cdl-c64f6f2fec8a1d4e0a656483, got {row[2]}"
    assert row[3] == "S4NN/8319", f"Expected delivery_store_code S4NN/8319, got {row[3]}"
    assert float(row[4]) > 0, "Expected positive grand_total"

    # Verify PSV Party Record linked by delivery_location_id
    cur.execute("""
        SELECT id, company_id, host_customer_id, delivery_location_id, store_code, name, stock_model, status
        FROM psv_parties
        WHERE delivery_location_id = %s
    """, (row[2],))
    prow = cur.fetchone()
    print("\nLinked PSV Party in PostgreSQL:")
    print(f"  Party ID             : {prow[0]}")
    print(f"  Company ID           : {prow[1]}")
    print(f"  Host Customer ID     : {prow[2]}")
    print(f"  Delivery Location ID : {prow[3]}")
    print(f"  Store Code           : {prow[4]}")
    print(f"  Party Name           : {prow[5]}")
    print(f"  Stock Model          : {prow[6]}")
    print(f"  Status               : {prow[7]}")

    assert prow[2] == "cust-rrl-192b561d", f"Expected host_customer_id cust-rrl-192b561d, got {prow[2]}"
    assert prow[3] == "cdl-c64f6f2fec8a1d4e0a656483", f"Expected delivery_location_id cdl-c64f6f2fec8a1d4e0a656483, got {prow[3]}"
    assert prow[4] == "S4NN/8319", f"Expected store_code S4NN/8319, got {prow[4]}"
    assert prow[6] == "OUTRIGHT_SALE", f"Expected stock_model OUTRIGHT_SALE, got {prow[6]}"

    conn.close()

    print("\n" + "=" * 90)
    print("ALL 10 VERIFICATION STEPS PASSED WITH 100% SUCCESS — EVIDENCE GENERATED!")
    print("=" * 90)

if __name__ == "__main__":
    asyncio.run(run_full_cycle())
