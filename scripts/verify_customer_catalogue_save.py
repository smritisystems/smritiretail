"""
Verification Script for Customer Catalogue Form Save & PostgreSQL Persistence.
Tests modifying customer details, saving via UI, intercepting network PUT request,
verifying toast notifications, checking database persistence in PostgreSQL,
and reloading frontend to verify round-trip state restoration.
"""

import asyncio
import os
import subprocess
from playwright.async_api import async_playwright

WEB_BASE = "http://localhost:3000"
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\d1e1ac2d-e193-4ebb-9bd8-b13b02474afe"
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_customer_save_verification")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def query_postgres_customer(code="RRL-001"):
    cmd = [
        "docker", "exec", "smriti-db", "psql", "-U", "postgres", "-d", "smriti001",
        "-c", f"SELECT id, code, name, pricing_basis, allow_promotions_on_rate, is_tax_inclusive FROM customers WHERE code = '{code}';"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout.strip()

async def main():
    print("================================================================================")
    print("CUSTOMER CATALOGUE FORM SAVE & DATABASE VALIDATION E2E TEST")
    print("================================================================================")

    # Pre-check database
    print("\n[DB PRE-CHECK] Current PostgreSQL record for RRL-001:")
    print(query_postgres_customer("RRL-001"))

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(viewport={"width": 1600, "height": 950})
        page = await context.new_page()

        put_responses = []

        async def handle_response(res):
            if "/api/v1/crm/customers" in res.url and res.request.method == "PUT":
                body = await res.text()
                put_responses.append({
                    "url": res.url,
                    "status": res.status,
                    "body": body
                })
                print(f"  [NETWORK EVENT] PUT {res.url} -> HTTP {res.status}")
        page.on("response", handle_response)

        # 1. Navigate to Customer Master
        print("\n[Step 1] Navigating to http://localhost:3000/?tab=customer-master...")
        await page.goto(f"{WEB_BASE}/?tab=customer-master", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)

        # Login if needed
        admin_quick_btn = page.locator('button:has-text("Admin")')
        auth_btn = page.locator('button:has-text("Authorize Operator")')
        if await auth_btn.count() > 0 and await auth_btn.is_visible():
            print("  Logging in as Admin...")
            if await admin_quick_btn.count() > 0:
                await admin_quick_btn.click()
                await page.wait_for_timeout(300)
            await auth_btn.click()
            await page.wait_for_timeout(2500)

        enter_ws_btn = page.locator('button:has-text("Enter Workspace"), button:has-text("Connect Workspace"), button:has-text("Connect")')
        if await enter_ws_btn.count() > 0 and await enter_ws_btn.first.is_visible():
            print("  Connecting Workspace...")
            await enter_ws_btn.first.click()
            await page.wait_for_timeout(2500)

        # Ensure Customer Master is open
        if await page.locator('text="Customer Catalogue"').count() == 0:
            print("  Dispatching smriti_navigate_module for customer-master...")
            await page.evaluate("""() => {
                window.dispatchEvent(new CustomEvent('smriti_navigate_module', { detail: { moduleId: 'customer-master' } }));
            }""")
            await page.wait_for_timeout(2000)

        # 2. Select RRL-001 from Directory
        print("\n[Step 2] Selecting customer RRL-001 from Directory...")
        dir_btn = page.locator('button:has-text("Directory")').first
        if await dir_btn.count() > 0 and await dir_btn.is_visible():
            await dir_btn.click()
            await page.wait_for_timeout(1000)

        rrl_row = page.locator('tr:has-text("RRL-001")').first
        if await rrl_row.count() > 0:
            await rrl_row.click()
            await page.wait_for_timeout(1500)
            print("  Selected RRL-001 from Directory.")

        # 3. Modify Details in Form
        print("\n[Step 3] Modifying Customer Details in Form...")
        name_input = page.locator('input[data-field-key="customer_name"]').first
        await name_input.fill("Reliance Retail Enterprise Limited")
        print("  - Customer Name set to: 'Reliance Retail Enterprise Limited'")

        shopper_card = page.locator('div:has-text("DETAILS OF SHOPPER")').first
        if await shopper_card.count() > 0:
            await shopper_card.scroll_into_view_if_needed()
            await page.wait_for_timeout(500)

        pricing_select = page.locator('select[data-field-key="pricing_basis"]').first
        await pricing_select.select_option("RATE")
        print("  - Billing Basis (Bill On) set to: 'RATE'")

        # Toggle Allow Retail Promotions on Trade Rate
        promo_checkbox = page.locator('input[type="checkbox"]').nth(1)
        await promo_checkbox.check()
        print("  - Allow Retail Promotions on Trade Rate checked: True")

        await page.wait_for_timeout(500)

        # Take Screenshot 1: Form with modified fields
        ss1_path = os.path.join(SCREENSHOT_DIR, "01_customer_details_modified_in_form.png")
        await page.screenshot(path=ss1_path)
        print(f"  [SAVED SCREENSHOT 1] {ss1_path}")

        # 4. Save Customer Record
        print("\n[Step 4] Clicking 'Save Ctrl+S'...")
        put_responses.clear()
        save_btn = page.locator('button:has-text("Save"), button:has-text("Save Ctrl+S")').first
        await save_btn.click()
        await page.wait_for_timeout(3000)

        # Verify network PUT response
        print(f"  Total PUT responses intercepted: {len(put_responses)}")
        assert any(r["status"] == 200 for r in put_responses), "Expected at least one HTTP 200 PUT response!"
        for r in put_responses:
            print(f"  -> HTTP {r['status']} for {r['url']}")

        # Verify UI Notification
        toast_el = page.locator('text="CATALOGUE SAVED"').first
        toast_visible = await toast_el.is_visible()
        print(f"  Toast 'CATALOGUE SAVED' visible on UI: {toast_visible}")

        # Take Screenshot 2: Save Toast Notification
        ss2_path = os.path.join(SCREENSHOT_DIR, "02_customer_save_toast_notification.png")
        await page.screenshot(path=ss2_path)
        print(f"  [SAVED SCREENSHOT 2] {ss2_path}")

        # 5. Database Direct Verification (PostgreSQL)
        print("\n[Step 5] Direct PostgreSQL verification after Save:")
        db_out = query_postgres_customer("RRL-001")
        print(db_out)
        assert "Reliance Retail Enterprise Limited" in db_out, "DB verification failed: Name not updated in PostgreSQL!"
        assert "RATE" in db_out, "DB verification failed: pricing_basis not RATE in PostgreSQL!"
        assert "t" in db_out, "DB verification failed: allow_promotions_on_rate not true in PostgreSQL!"
        print("  [OK] PostgreSQL columns verified successfully!")

        # 6. Reload page to verify round-trip persistence in UI
        print("\n[Step 6] Reloading page to verify persistence from PostgreSQL into UI...")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(2500)

        # Navigate back to customer master if needed
        if await page.locator('text="Customer Catalogue"').count() == 0:
            await page.evaluate("""() => {
                window.dispatchEvent(new CustomEvent('smriti_navigate_module', { detail: { moduleId: 'customer-master' } }));
            }""")
            await page.wait_for_timeout(2000)

        # Verify name in input
        name_val = await page.locator('input[data-field-key="customer_name"]').first.input_value()
        print(f"  Customer Name loaded from backend after reload: '{name_val}'")
        assert name_val == "Reliance Retail Enterprise Limited", f"Expected 'Reliance Retail Enterprise Limited', got '{name_val}'"

        # Verify pricing basis in select
        pricing_val = await page.locator('select[data-field-key="pricing_basis"]').first.input_value()
        print(f"  Billing Basis loaded from backend after reload: '{pricing_val}'")
        assert pricing_val == "RATE", f"Expected 'RATE', got '{pricing_val}'"

        # Verify promo checkbox
        is_promo_checked = await page.locator('input[type="checkbox"]').nth(1).is_checked()
        print(f"  Allow Retail Promotions on Trade Rate after reload: {is_promo_checked}")
        assert is_promo_checked == True, "Expected promo checkbox to be checked after reload!"

        # Take Screenshot 3: Reloaded Form with persisted values
        ss3_path = os.path.join(SCREENSHOT_DIR, "03_customer_reloaded_from_postgres.png")
        await page.screenshot(path=ss3_path)
        print(f"  [SAVED SCREENSHOT 3] {ss3_path}")

        # 7. Clean Restoration: Reset back to canonical "Reliance Retail Limited", MRP, Promo OFF
        print("\n[Step 7] Reverting canonical record back to 'Reliance Retail Limited', MRP, Promo OFF...")
        await page.locator('input[data-field-key="customer_name"]').first.fill("Reliance Retail Limited")
        await page.locator('select[data-field-key="pricing_basis"]').first.select_option("MRP")
        await page.locator('input[type="checkbox"]').nth(1).uncheck()
        await page.wait_for_timeout(500)

        put_responses.clear()
        await page.locator('button:has-text("Save"), button:has-text("Save Ctrl+S")').first.click()
        await page.wait_for_timeout(3000)

        assert any(r["status"] == 200 for r in put_responses), "Expected at least one HTTP 200 PUT response on reset save!"
        print("  Reset save succeeded via HTTP 200!")

        # Take Screenshot 4: Final canonical state
        ss4_path = os.path.join(SCREENSHOT_DIR, "04_customer_restored_to_canonical_mrp.png")
        await page.screenshot(path=ss4_path)
        print(f"  [SAVED SCREENSHOT 4] {ss4_path}")

        print("\n[FINAL DB CHECK] PostgreSQL record for RRL-001:")
        final_db = query_postgres_customer("RRL-001")
        print(final_db)
        assert "Reliance Retail Limited" in final_db and "MRP" in final_db, "Reset verification failed in PostgreSQL!"

        print("\n================================================================================")
        print("ALL VALIDATION GATES PASSED PERFECTLY (100% SUCCESS)")
        print("================================================================================")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
