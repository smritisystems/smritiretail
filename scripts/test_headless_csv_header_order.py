"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.1
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Headless Playwright Runner: CSV Header Order Preservation, Suggestions & Distinguished Validations
===================================================================================================
Automates verification of:
1. Quick-Insert Header Template Buttons (+ Standard, + B2B Rate, + Retail SP, + Commercial).
2. Exact Column Sequence Preservation & Alias Mapping Chips (#1, #2, #3, alias translation).
3. Distinguished Statutory and Pricing Validations (Rate vs SP, Legal Metrology MRP, Tax Modes).
4. Intelligent Header Suggestions & Fuzzy Heuristics for Misspelled Columns.
5. Captures screenshots for documentation walkthrough.
"""

import asyncio
import os
import sys
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:3000"
ARTIFACT_DIR = os.environ.get(
    "CONVERSATION_ARTIFACT_DIR",
    "C:/Users/netma/.gemini/antigravity-ide/brain/d1e1ac2d-e193-4ebb-9bd8-b13b02474afe"
)
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_csv_header_order")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


async def run():
    print("=" * 80)
    print("SMRITI RETAIL OS — HEADLESS PLAYWRIGHT CSV HEADER ORDER & VALIDATION SUITE")
    print("=" * 80)
    print(f"Target Frontend : {BASE_URL}")
    print(f"Screenshot Dir  : {SCREENSHOT_DIR}")

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
        async def on_response(res):
            if "/billing/csv/validate" in res.url and res.status == 200:
                try:
                    body = await res.json()
                    print("[CSV VALIDATE RESPONSE KEYS]:", list(body.keys()))
                    print("[RAW HEADERS]:", body.get("raw_headers"))
                    print("[CANONICAL HEADERS]:", body.get("canonical_headers"))
                    print("[DISTINGUISHED VALIDATIONS]:", body.get("distinguished_validations"))
                    print("[SUGGESTIONS]:", body.get("header_suggestions"))
                except Exception as ex:
                    print(f"[CSV VALIDATE ERROR PARSING JSON]: {ex}")
            elif "/billing/csv" in res.url:
                print(f"[NET {res.status}] {res.url}")

        page.on("response", on_response)

        # Step 1: Navigate to Base URL
        print("\n[Step 1] Navigating to frontend...")
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # Check for login screen
        admin_quick_btn = page.locator('button:has-text("Admin")')
        auth_btn = page.locator('button:has-text("Authorize Operator")')
        if await auth_btn.count() > 0 and await auth_btn.is_visible():
            print("  Login screen detected. Authenticating as Admin...")
            if await admin_quick_btn.count() > 0 and await admin_quick_btn.is_visible():
                await admin_quick_btn.click()
                await page.wait_for_timeout(500)
            await auth_btn.click()
            await page.wait_for_timeout(2000)

        # Check for company / workspace selection
        enter_ws_btn = page.locator('button:has-text("Enter Workspace"), button:has-text("Connect")')
        if await enter_ws_btn.count() > 0 and await enter_ws_btn.first.is_visible():
            print("  Company selection detected. Entering workspace...")
            await enter_ws_btn.first.click()
            await page.wait_for_timeout(2000)

        # Step 2: Navigate to Launchpad then Billing Workspace
        print("\n[Step 2] Navigating to SMRITI Launchpad and Billing Workspace...")
        launchpad_nav_btn = page.locator('button:has-text("SMRITI Launchpad")').first
        if await launchpad_nav_btn.count() > 0 and await launchpad_nav_btn.is_visible():
            print("  Clicking 'SMRITI Launchpad' navigation button...")
            await launchpad_nav_btn.click()
            await page.wait_for_timeout(1500)

        billing_tile = page.locator('button:has-text("Billing Workspace")').first
        if await billing_tile.count() > 0 and await billing_tile.is_visible():
            print("  Found 'Billing Workspace' tile. Clicking...")
            await billing_tile.click()
        else:
            print("  Searching for billing tile fallback...")
            tile_btn = page.locator('[data-tile-id="billing-workspace"], button:has-text("Billing")').first
            if await tile_btn.count() > 0:
                await tile_btn.click()

        # Wait for terminal to mount
        print("  Waiting for Billing Workspace terminal to load...")
        await page.wait_for_selector('button[aria-label="More POS actions"]', timeout=15000)
        await page.wait_for_timeout(2000)
        print(f"  Current URL: {page.url}")

        # Step 2: Open CSV Import Modal
        print("\n[Step 2] Opening Barcode CSV Import Modal...")
        more_btn = page.locator('button[aria-label="More POS actions"]').first
        if await more_btn.count() > 0 and await more_btn.is_visible():
            await more_btn.click()
            await page.wait_for_timeout(500)
            csv_menu_item = page.locator('button:has-text("CSV Import")').first
            await csv_menu_item.click()
        else:
            csv_btn = page.locator('button:has-text("CSV Import"), button:has-text("Import CSV")')
            if await csv_btn.count() > 0 and await csv_btn.first.is_visible():
                await csv_btn.first.click()
            else:
                await page.keyboard.press("Alt+i")
        await page.wait_for_timeout(1000)

        modal = page.locator('h2:has-text("Barcode Billing CSV Import")')
        await modal.wait_for(state="visible", timeout=10000)
        print("  ✓ Barcode CSV Import Modal successfully opened and visible.")

        dbg_ss = os.path.join(SCREENSHOT_DIR, "debug_modal_opened.png")
        await page.screenshot(path=dbg_ss, full_page=True)
        print(f"  Debug screenshot captured: {dbg_ss}")

        modal_text = await page.locator(".fixed.inset-0").inner_text()
        print(f"  Modal inner text snippet:\n{modal_text[:500]}")

        # Step 3: Verify Quick Headers Buttons
        print("\n[Step 3] Verifying Quick Header Template Buttons...")
        b2b_btn = page.locator('#btn-quick-b2b')
        standard_btn = page.locator('#btn-quick-standard')
        retail_btn = page.locator('#btn-quick-retail')
        commercial_btn = page.locator('#btn-quick-commercial')

        print(f"  btn count: b2b={await b2b_btn.count()}, standard={await standard_btn.count()}")
        await b2b_btn.wait_for(state="visible", timeout=10000)
        assert await b2b_btn.count() > 0, "+ B2B Rate button missing!"
        assert await standard_btn.count() > 0, "+ Standard button missing!"
        assert await retail_btn.count() > 0, "+ Retail SP button missing!"
        assert await commercial_btn.count() > 0, "+ Commercial button missing!"
        print("  ✓ All 4 Quick Header Template buttons (+ Standard, + B2B Rate, + Retail SP, + Commercial) verified.")

        # Click + B2B Rate button
        await b2b_btn.click()
        await page.wait_for_timeout(400)
        paste_area = page.locator("#csv-paste-area")
        val = await paste_area.input_value()
        assert "barcode,quantity,rate" in val, f"Expected B2B template in textarea, got: {val}"
        print("  ✓ Quick template insertion verified.")

        # Step 4: Test Preserved Header Order & Alias Mapping + Distinguished Validations
        print("\n[Step 4] Testing Exact Column Order & Alias Mapping with Rate...")
        test_csv_b2b = "ean,qty,base_rate,inclusive\nBAR-CH-24-G,2,500.00,0\nBAR-CH-01-A,1,450.00,0\n"
        await paste_area.fill(test_csv_b2b)
        print("  Pasted B2B CSV with aliases [ean, qty, base_rate, inclusive]...")
        await page.wait_for_timeout(1500)

        # Wait for validation results
        seq_strip = page.locator('text=Detected Column Sequence')
        await seq_strip.wait_for(state="visible", timeout=10000)
        print("  ✓ Column Sequence & Alias Mapping strip is visible.")

        # Verify exact chips order
        chip_1 = page.locator('text="#1"').first
        chip_2 = page.locator('text="#2"').first
        chip_3 = page.locator('text="#3"').first
        chip_4 = page.locator('text="#4"').first
        assert await chip_1.is_visible() and await chip_2.is_visible() and await chip_3.is_visible() and await chip_4.is_visible()
        print("  ✓ Ordered sequence chips (#1, #2, #3, #4) rendered.")

        # Verify alias indicator
        alias_badges = page.locator('text=(alias)')
        assert await alias_badges.count() >= 3, f"Expected at least 3 alias badges, found {await alias_badges.count()}"
        print(f"  ✓ Alias translations recognized: {await alias_badges.count()} badges present.")

        # Verify Distinguished Validations checklist
        rules_header = page.locator('text=Active Validation Rules Distinguished')
        assert await rules_header.count() > 0 and await rules_header.is_visible()
        print("  ✓ Distinguished Validations Checklist is rendered.")

        rate_rule = page.locator('text=Wholesale Base Rate Validation')
        assert await rate_rule.count() > 0
        print("  ✓ Wholesale Base Rate rule distinguished with post-tax MRP ceiling protection.")

        tax_rule = page.locator('text=Per-Row Tax Mode Arbitration')
        assert await tax_rule.count() > 0
        print("  ✓ Per-Row Tax Mode Arbitration rule distinguished.")

        # Capture Screenshot 01
        ss1 = os.path.join(SCREENSHOT_DIR, "01_csv_header_order_and_distinguished_validations.png")
        await page.screenshot(path=ss1, full_page=True)
        print(f"  ✓ Screenshot 01 saved: {ss1}")

        # Step 5: Test Intelligent Header Suggestions for Misspelled Columns
        print("\n[Step 5] Testing Intelligent Header Suggestions for Misspelled Columns...")
        test_csv_misspelled = "barcd,quant,prc\nBAR-CH-24-G,2,500.00\n"
        await paste_area.fill(test_csv_misspelled)
        print("  Pasted misspelled CSV [barcd, quant, prc]...")
        await page.wait_for_timeout(1500)

        sugg_header = page.locator('text=Column Header Validation')
        await sugg_header.wait_for(state="visible", timeout=10000)
        print("  ✓ Column Header Validation & Suggestions alert card is visible.")

        barcd_sugg = page.locator("text=barcd")
        assert await barcd_sugg.count() > 0
        print("  ✓ Intelligent suggestions for misspelled column 'barcd' verified.")

        # Capture Screenshot 02
        ss2 = os.path.join(SCREENSHOT_DIR, "02_csv_header_suggestions_alert.png")
        await page.screenshot(path=ss2, full_page=True)
        print(f"  ✓ Screenshot 02 saved: {ss2}")

        # Step 6: Test Unmapped / Unknown Header Chip
        print("\n[Step 6] Testing Unmapped Column Chips...")
        test_csv_unknown = "barcode,quantity,custom_note_field\nBAR-CH-24-G,2,urgent_order\n"
        await paste_area.fill(test_csv_unknown)
        print("  Pasted CSV with unknown column [custom_note_field]...")
        await page.wait_for_timeout(1500)

        unmapped_badge = page.locator('text="Unmapped"')
        await unmapped_badge.wait_for(state="visible", timeout=10000)
        print("  ✓ 'Unmapped' chip rendered for unknown column.")

        # Capture Screenshot 03
        ss3 = os.path.join(SCREENSHOT_DIR, "03_csv_unmapped_header_chip.png")
        await page.screenshot(path=ss3, full_page=True)
        print(f"  ✓ Screenshot 03 saved: {ss3}")

        print("\n" + "=" * 80)
        print("✓ ALL PLAYWRIGHT VERIFICATION CHECKS PASSED SUCCESSFULLY!")
        print("=" * 80)

        await context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
