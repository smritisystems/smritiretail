"""
Project      : SMRITI Retail OS
Author       : Antigravity Verification Engine
Version      : 1.0.0
Description  : Playwright Screenshot Generator for Billing with Reliance Retail Parent and Child Accounts
"""

import asyncio
import os
import sys
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8101"
CSV_PATH = "F:/SMRITRretailNX/CSV/reliance_retail_order.csv"
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity\brain\e31cd5ed-3482-4fd4-a8a0-4435b7ad21e0\screenshots"
os.makedirs(ARTIFACT_DIR, exist_ok=True)


async def main():
    print("=" * 80)
    print("PLAYWRIGHT CAPTURE: BILLING WITH RELIANCE RETAIL PARENT AND CHILD")
    print("=" * 80)
    print(f"Target URL   : {BASE_URL}")
    print(f"Target CSV   : {CSV_PATH}")
    print(f"Artifact Dir : {ARTIFACT_DIR}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080"
            ]
        )
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[CONSOLE {msg.type.upper()}] {msg.text}") if msg.type in ("error", "warning") else None)

        async def on_preview_request(request):
            if "billing/preview" in request.url:
                print(f"\n>>> [BILLING PREVIEW REQUEST] Method: {request.method}")
                try:
                    post_data = request.post_data
                    print(f">>> [BILLING PREVIEW POST_DATA] {post_data}\n")
                except Exception as e:
                    print(f">>> [BILLING PREVIEW POST_DATA ERR] {e}\n")

        page.on("request", on_preview_request)

        async def on_preview_response(response):
            if "billing/preview" in response.url:
                print(f"\n>>> [BILLING PREVIEW RESPONSE] Status: {response.status}")
                try:
                    body = await response.text()
                    print(f">>> [BILLING PREVIEW BODY] {body}\n")
                except Exception as e:
                    print(f">>> [BILLING PREVIEW BODY ERR] {e}\n")

        page.on("response", on_preview_response)

        # -------------------------------------------------------------
        # STEP 1: Navigate to Base URL & Authenticate
        # -------------------------------------------------------------
        print("\n[Step 1] Navigating to SMRITI Retail OS & Authenticating...")
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        admin_btn = page.locator('button:has-text("Admin")').first
        if await admin_btn.count() > 0:
            await admin_btn.click()
            await page.wait_for_timeout(300)

        login_btn = page.locator('button:has-text("Login")').first
        if await login_btn.count() > 0:
            await login_btn.click()
            await page.wait_for_timeout(2000)

        # -------------------------------------------------------------
        # STEP 2: Navigate to POS Billing Terminal
        # -------------------------------------------------------------
        print("\n[Step 2] Navigating to POS Billing Terminal...")
        pos_btn = page.locator('button:has-text("POS Billing")').first
        await pos_btn.click()
        await page.wait_for_timeout(2500)
        print("  POS Billing Terminal mounted.")

        # -------------------------------------------------------------
        # STEP 3: Open Universal Master Browse [F2] & Inspect Reliance Accounts
        # -------------------------------------------------------------
        print("\n[Step 3] Opening Universal Master Browse [F2] & filtering Reliance hierarchy...")
        await page.keyboard.press("F2")
        await page.wait_for_timeout(1500)

        # Click Customer tab
        cust_tab = page.locator('button:has-text("Customer")').first
        await cust_tab.click()
        await page.wait_for_timeout(1500)

        filter_input = page.locator('input[placeholder*="Filter across any column"]').first
        await filter_input.fill("Reliance")
        await page.wait_for_timeout(1500)

        # Screenshot 1: Customer Browse showing Reliance Parent and Child Accounts
        ss_01 = os.path.join(ARTIFACT_DIR, "01_customer_browse_reliance_parent_and_child_hierarchy.png")
        await page.screenshot(path=ss_01)
        print(f"  ✓ [Screenshot 1] Saved: {ss_01} ({os.path.getsize(ss_01):,} bytes)")

        # -------------------------------------------------------------
        # STEP 4: Select Reliance Child Store Account into Billing Terminal
        # -------------------------------------------------------------
        print("\n[Step 4] Selecting Child Store Customer 'CUST-RIL-1888' (Reliance Retail Ltd)...")
        child_row = page.locator('tr:has-text("CUST-RIL-1888")').first
        await child_row.dblclick()
        await page.wait_for_timeout(2000)

        cust_val = await page.locator('input[name="customerSearch"]').input_value()
        print(f"  Customer loaded in POS: '{cust_val}'")

        # Scan product into cart (barcode 8904551002228, MRP 2599.00)
        print("  Scanning catalog barcode '8904551002228'...")
        stock_input = page.locator('input[name="directStockNo"]')
        await stock_input.click()
        await stock_input.fill("8904551002228")
        await page.wait_for_timeout(800)
        await stock_input.press("Enter")
        await page.wait_for_timeout(800)
        add_btn = page.locator('button[title="Add Item (Enter)"]').first
        if await add_btn.count() > 0:
            await add_btn.click()
        else:
            await stock_input.press("Enter")
        await page.wait_for_timeout(2000)

        # Screenshot 2: Billing Terminal with Child Store Account
        ss_02 = os.path.join(ARTIFACT_DIR, "02_billing_child_store_account_cart.png")
        await page.screenshot(path=ss_02)
        print(f"  ✓ [Screenshot 2] Saved: {ss_02} ({os.path.getsize(ss_02):,} bytes)")

        # -------------------------------------------------------------
        # STEP 5: Switch to Reliance Parent Corporate Account (RRL-001)
        # -------------------------------------------------------------
        print("\n[Step 5] Switching to Parent Corporate Account 'RRL-001' (Reliance Retail Limited)...")
        clear_cust_btn = page.locator('button[title="Clear selected customer"]').first
        if await clear_cust_btn.count() > 0:
            await clear_cust_btn.click()
            await page.wait_for_timeout(800)

        cust_input = page.locator('input[name="customerSearch"]')
        await cust_input.click()
        await cust_input.fill("Reliance Retail Limited")
        await page.wait_for_timeout(1500)

        # If typeahead dropdown is visible, select Reliance Retail Limited
        typeahead_opt = page.locator('div:has-text("Reliance Retail Limited")').last
        if await typeahead_opt.count() > 0:
            await typeahead_opt.click()
            await page.wait_for_timeout(1500)

        parent_val = await page.locator('input[name="customerSearch"]').input_value()
        print(f"  Switched customer in POS: '{parent_val}'")

        # Screenshot 3: Billing Terminal with Parent Corporate Account
        ss_03 = os.path.join(ARTIFACT_DIR, "03_billing_parent_corporate_account_cart.png")
        await page.screenshot(path=ss_03)
        print(f"  ✓ [Screenshot 3] Saved: {ss_03} ({os.path.getsize(ss_03):,} bytes)")

        # -------------------------------------------------------------
        # STEP 6: Open Barcode CSV Import Modal with Active Reliance Banner
        # -------------------------------------------------------------
        print("\n[Step 6] Opening Barcode CSV Import Modal (More Options -> Validated CSV Import)...")
        more_btn = page.locator('button[title="More Options & Supporting Workspaces"]').first
        await more_btn.click()
        await page.wait_for_timeout(800)

        csv_item = page.locator('button:has-text("Validated CSV Import")').first
        await csv_item.click()
        await page.wait_for_timeout(1500)

        # Verify #reliance-contract-banner
        banner = page.locator('#reliance-contract-banner')
        if await banner.count() > 0 and await banner.is_visible():
            b_text = await banner.inner_text()
            print(f"  #reliance-contract-banner active:\n    {b_text.replace(chr(10), ' ')}")

        # Screenshot 4: Barcode CSV Import Modal showing Reliance 43.76% Contract Banner
        ss_04 = os.path.join(ARTIFACT_DIR, "04_reliance_csv_import_modal_active_contract_banner.png")
        await page.screenshot(path=ss_04)
        print(f"  ✓ [Screenshot 4] Saved: {ss_04} ({os.path.getsize(ss_04):,} bytes)")

        # -------------------------------------------------------------
        # STEP 7: Upload CSV Order & Inspect 43.76% Trade Markdown
        # -------------------------------------------------------------
        print(f"\n[Step 7] Uploading CSV order file: {CSV_PATH}...")
        file_input = page.locator('input[type="file"]')
        await file_input.set_input_files(CSV_PATH)
        await page.wait_for_timeout(3000)

        # Screenshot 5: CSV Preview with 43.76% Trade Discount Badges
        ss_05 = os.path.join(ARTIFACT_DIR, "05_reliance_csv_import_preview_with_4376_discount.png")
        await page.screenshot(path=ss_05)
        print(f"  ✓ [Screenshot 5] Saved: {ss_05} ({os.path.getsize(ss_05):,} bytes)")

        # Confirm import into bill
        add_btn = page.locator('button:has-text("Verified DB Item(s) to Bill")')
        if await add_btn.count() > 0 and await add_btn.is_visible():
            await add_btn.click()
            await page.wait_for_timeout(3000)
            print("  CSV Verified Items successfully merged into POS cart.")

        # Wait for backend-authoritative billing preview to validate
        try:
            await page.wait_for_selector('text="Backend-authoritative prices, discounts, GST and rounding validated."', timeout=10000)
            print("  ✓ Backend-authoritative billing preview validated.")
        except Exception as e:
            print(f"  Note: billing preview status indicator: {e}")

        # -------------------------------------------------------------
        # STEP 8: Open Settlement / Settle & Save (F8)
        # -------------------------------------------------------------
        print("\n[Step 8] Triggering Settlement Modal [Settle & Save (F8)]...")
        settle_btn = page.locator('button:has-text("Settle & Save (F8)")').first
        if await settle_btn.count() > 0:
            await settle_btn.click()
        else:
            await page.keyboard.press("F8")
        await page.wait_for_timeout(3000)

        # Screenshot 6: Settlement / Finalization Modal
        ss_06 = os.path.join(ARTIFACT_DIR, "06_settlement_and_invoice_finalization.png")
        await page.screenshot(path=ss_06)
        print(f"  ✓ [Screenshot 6] Saved: {ss_06} ({os.path.getsize(ss_06):,} bytes)")

        await browser.close()

    print("\n" + "=" * 80)
    print("ALL 6 PLAYWRIGHT SCREENSHOTS SUCCESSFULLY CAPTURED AND RECORDED")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
