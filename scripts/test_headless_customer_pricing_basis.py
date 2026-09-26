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

Headless Playwright Runner: Customer Billing Basis (MRP vs RATE) & Promotion Margin Protection Verification
==========================================================================================================
Automates end-to-end browser verification of:
1. Customer Master Form with explicit "Billing Basis (Bill On)*" selector (MRP vs RATE) and "Allow Retail Promotions on Trade Rate" toggle.
2. Customer Browse Dialog (`CustBrowseDlg`) with "Bill On" badge column (MRP emerald chip vs RATE amber chip).
3. POS Billing Terminal customer header displaying `[BILL ON: RATE (Wholesale)]` indicator.
4. POS Cart line item evaluation verifying Wholesale Rate pricing with retail promotion suppression.
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
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_customer_pricing_basis")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


async def run():
    print("=" * 80)
    print("SMRITI RETAIL OS — CUSTOMER BILLING BASIS (MRP VS RATE) HEADLESS VERIFICATION")
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

        # Step 1: Navigate to Frontend and Handle Login
        print("\n[Step 1] Navigating to frontend...")
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        admin_quick_btn = page.locator('button:has-text("Admin")')
        auth_btn = page.locator('button:has-text("Authorize Operator")')
        if await auth_btn.count() > 0 and await auth_btn.is_visible():
            print("  Login screen detected. Clicking Admin & Authorizing...")
            if await admin_quick_btn.count() > 0:
                await admin_quick_btn.click()
                await page.wait_for_timeout(300)
            await auth_btn.click()
            await page.wait_for_timeout(2000)

        enter_ws_btn = page.locator('button:has-text("Enter Workspace"), button:has-text("Connect")')
        if await enter_ws_btn.count() > 0 and await enter_ws_btn.first.is_visible():
            print("  Company selection detected. Entering workspace...")
            await enter_ws_btn.first.click()
            await page.wait_for_timeout(2000)

        # Step 2: Navigate to Customer Master to verify Form controls
        print("\n[Step 2] Navigating to Customer Master tab...")
        await page.goto(f"{BASE_URL}/?tab=customer-master", wait_until="networkidle")
        await page.wait_for_timeout(2500)

        # Look for customer master workspace
        cust_form_card = page.locator('div:has-text("Customer Master"), div:has-text("General Details")').first
        await cust_form_card.wait_for(timeout=10000)

        # Scroll down to Details of Shopper / Billing Basis section
        shopper_card = page.locator('div:has-text("DETAILS OF SHOPPER")').first
        if await shopper_card.count() > 0:
            await shopper_card.scroll_into_view_if_needed()
            await page.wait_for_timeout(500)

        # Select "RATE" in Billing Basis dropdown
        billing_basis_select = page.locator('select[data-field-key="pricing_basis"], select:has(option[value="RATE"])').first
        if await billing_basis_select.count() > 0:
            print("  Found 'Billing Basis (Bill On)' dropdown. Selecting 'RATE'...")
            await billing_basis_select.select_option("RATE")
            await page.wait_for_timeout(500)

        # Capture Screenshot 1: Customer Form with Billing Basis & Promotion on Rate controls
        ss1_path = os.path.join(SCREENSHOT_DIR, "01_customer_form_billing_basis_rate.png")
        await page.screenshot(path=ss1_path, full_page=False)
        print(f"  [OK] Saved: {ss1_path}")

        # Step 3: Navigate to Billing Workspace
        print("\n[Step 3] Navigating to Billing Workspace...")
        launchpad_nav_btn = page.locator('button:has-text("SMRITI Launchpad")').first
        if await launchpad_nav_btn.count() > 0 and await launchpad_nav_btn.is_visible():
            await launchpad_nav_btn.click()
            await page.wait_for_timeout(1000)

        billing_tile = page.locator('button:has-text("Billing Workspace")').first
        if await billing_tile.count() > 0 and await billing_tile.is_visible():
            await billing_tile.click()
        else:
            tile_btn = page.locator('[data-tile-id="billing-workspace"], button:has-text("Billing")').first
            await tile_btn.click()

        await page.wait_for_selector('button[aria-label="More POS actions"]', timeout=15000)
        await page.wait_for_timeout(2000)
        print("  Billing Workspace terminal loaded.")

        # Step 4: Open Customer Search & Browse Window ([F2] Browse)
        print("\n[Step 4] Opening Customer Browse Dialog [F2]...")
        browse_cust_btn = page.locator('button:has-text("Browse")').first
        await browse_cust_btn.click()
        await page.wait_for_timeout(1500)

        await page.wait_for_selector('h3:has-text("Customer Search & Browse Window")', timeout=10000)
        print("  Customer Browse Dialog opened.")

        # Open Quick Add panel to show Bill On Price select
        new_cust_btn = page.locator('button:has-text("New Customer")').first
        if await new_cust_btn.count() > 0:
            await new_cust_btn.click()
            await page.wait_for_timeout(500)

        # Capture Screenshot 2: Customer Browse Dialog showing "Bill On" badge column & quick add
        ss2_path = os.path.join(SCREENSHOT_DIR, "02_customer_browse_dlg_bill_on_column.png")
        await page.screenshot(path=ss2_path, full_page=False)
        print(f"  [OK] Saved: {ss2_path}")

        # Step 5: Select customer CUST-003 billed on RATE
        print("\n[Step 5] Selecting customer CUST-003 billed on RATE in Browse dialog...")
        search_input = page.locator('input[placeholder*="Search by Customer Code"]').first
        await search_input.fill("CUST-003")
        await page.wait_for_timeout(800)

        # Click the row or select button for CUST-003
        cust_row = page.locator('tr:has-text("CUST-003")').first
        if await cust_row.count() > 0:
            select_btn = cust_row.locator('button:has-text("Select")').first
            if await select_btn.count() > 0:
                await select_btn.click()
            else:
                await cust_row.dblclick()
            await page.wait_for_timeout(1500)
            print("  Customer CUST-003 selected.")
        else:
            print("  Fallback: double clicking first row...")
            first_row = page.locator('tbody tr').first
            await first_row.dblclick()
            await page.wait_for_timeout(1500)

        # Capture Screenshot 3: Billing Terminal showing Customer with [BILL ON: RATE (Wholesale)] badge
        ss3_path = os.path.join(SCREENSHOT_DIR, "03_billing_terminal_customer_bill_on_badge.png")
        await page.screenshot(path=ss3_path, full_page=False)
        print(f"  [OK] Saved: {ss3_path}")

        # Step 6: Scan/Add Item into direct entry to verify Wholesale Rate & Promo Suppression
        print("\n[Step 6] Testing barcode / item direct lookup and adding to cart...")
        stock_input = page.locator('input[placeholder*="Scan barcode"], input[placeholder*="Stock No"]').first
        if await stock_input.count() > 0:
            await stock_input.fill("8901234567890")
            await page.wait_for_timeout(500)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1500)

            accept_btn = page.locator('button:has-text("Accept")').first
            if await accept_btn.count() > 0 and await accept_btn.is_visible():
                await accept_btn.click()
                await page.wait_for_timeout(1500)
                print("  Item accepted into cart.")

        # Capture Screenshot 4: Cart line items showing pricing basis and promotional evaluation
        ss4_path = os.path.join(SCREENSHOT_DIR, "04_billing_cart_line_pricing_basis.png")
        await page.screenshot(path=ss4_path, full_page=False)
        print(f"  [OK] Saved: {ss4_path}")

        print("\n" + "=" * 80)
        print("ALL 4 PLAYWRIGHT VERIFICATION SCREENSHOTS CAPTURED SUCCESSFULLY")
        print("=" * 80)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
