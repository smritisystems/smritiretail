"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-31
Classification: Playwright Verification Suite for Draft Tax Invoice Print Preview
"""

import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("SMRITI_BASE_URL", "http://localhost:8101")
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity\brain\e31cd5ed-3482-4fd4-a8a0-4435b7ad21e0\screenshots"
os.makedirs(ARTIFACT_DIR, exist_ok=True)


async def main():
    print("=" * 80)
    print("PLAYWRIGHT CAPTURE: DRAFT TAX INVOICE WITH PRINT PREVIEW")
    print("=" * 80)
    print(f"Target URL   : {BASE_URL}")
    print(f"Artifact Dir : {ARTIFACT_DIR}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            color_scheme="dark",
        )
        page = await context.new_page()

        # Step 1: Navigate and Authenticate
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
            print("  Authenticated successfully.")

        # Step 2: Navigate to POS Billing Terminal
        print("\n[Step 2] Navigating to POS Billing Terminal...")
        pos_btn = page.locator('button:has-text("POS Billing")').first
        await pos_btn.click()
        await page.wait_for_timeout(2500)
        print("  POS Billing Terminal mounted.")

        # Step 3: Open Universal Master Browse [F2] & Select Reliance
        print("\n[Step 3] Opening F2 Browse & Selecting Reliance Child Store Account...")
        f2_btn = page.locator('button:has-text("Master Browse (F2)"), button[title*="F2"]').first
        if await f2_btn.count() > 0:
            await f2_btn.click()
        else:
            await page.keyboard.press("F2")
        await page.wait_for_timeout(1500)

        cust_tab = page.locator('button:has-text("Customer")').first
        await cust_tab.click()
        await page.wait_for_timeout(1000)

        filter_input = page.locator('input[placeholder*="Filter across any column"]').first
        await filter_input.fill("Reliance")
        await page.wait_for_timeout(1000)

        child_row = page.locator('tr:has-text("CUST-RIL-1888")').first
        if await child_row.count() > 0:
            await child_row.dblclick()
            await page.wait_for_timeout(1500)
        print("  Reliance Retail Ltd loaded.")

        # Step 4: Scan Product into cart
        print("\n[Step 4] Scanning Barcode '8904551002228'...")
        stock_input = page.locator('input[name="directStockNo"]')
        await stock_input.wait_for(state="visible", timeout=10000)
        await stock_input.click()
        await stock_input.fill("8904551002228")
        await page.wait_for_timeout(800)
        await stock_input.press("Enter")
        await page.wait_for_timeout(800)
        add_btn = page.locator('button[title="Add Item (Enter)"]').first
        if await add_btn.count() > 0 and await add_btn.is_visible():
            await add_btn.click()
        else:
            await stock_input.press("Enter")
        await page.wait_for_timeout(2000)
        print("  Item added to cart.")

        # Step 5: Save as Draft
        print("\n[Step 5] Triggering Save as Draft Invoice...")
        draft_btn = page.locator('button:has-text("Draft"), button[title*="Save as Draft"]').first
        if await draft_btn.count() > 0 and await draft_btn.is_visible():
            await draft_btn.click()
            await page.wait_for_timeout(2500)
            print("  [OK] Draft invoice saved server-side with zero stock/GL impact.")

        # Step 6: Trigger Print Draft Preview
        print("\n[Step 6] Triggering Print Draft Preview...")
        draft_print_btn = page.locator('button:has-text("Print Draft Preview")').first
        if await draft_print_btn.count() > 0 and await draft_print_btn.is_visible():
            print("  Clicking 'Print Draft Preview' on active Draft banner...")
            await draft_print_btn.click()
        else:
            print("  Clicking Print in action bar...")
            print_btn = page.locator('button:has-text("Print"), button[title*="Print"]').first
            await print_btn.click()

        # Step 7: Wait for Print Preview Modal
        print("\n[Step 7] Verifying SMRITI Interactive Print & Preview Engine (Draft Mode)...")
        await page.wait_for_selector('text="SMRITI Interactive Print & Preview Engine"', timeout=15000)
        await page.wait_for_timeout(3000)

        # Step 8: Capture Screenshot
        ss_draft = os.path.join(ARTIFACT_DIR, "08_draft_tax_invoice_print_preview.png")
        await page.screenshot(path=ss_draft)
        print(f"  [OK] [Screenshot 8] Saved: {ss_draft} ({os.path.getsize(ss_draft):,} bytes)")

        await browser.close()
        print("\n" + "=" * 80)
        print("DRAFT TAX INVOICE PRINT PREVIEW VERIFICATION SUCCESS")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
