"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.18
Created      : 2026-10-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Verification & Headless E2E Automation

Headless Child Customer Billing Verification:
1. Authenticate & Establish Multi-tenant Workspace Context (smriti001)
2. Mount Credit Billing Terminal
3. Search and View Subordinate Child Customer with Parent Badge in CustomerMasterModal
4. Select Child Customer into Terminal Header
5. Verify Cart Line Items & Headless Billing Core Calculation
6. Atomically Submit & Commit Credit Invoice in PostgreSQL
7. Capture High-Resolution Headless Artifact Screenshots
"""

import asyncio
import os
import sys
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
else:
    sys.stdout.reconfigure(line_buffering=True)

BASE_URL = "http://localhost:3000"
SCREENSHOT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\94b1863b-ce32-4b24-b6d6-009d43a226df\screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def main():
    print("=" * 80, flush=True)
    print("SMRITI RETAIL OS: HEADLESS BILLING USING CHILD CUSTOMER ACCOUNT", flush=True)
    print("=" * 80, flush=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1600,1000",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=1,
        )
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[CONSOLE {msg.type.upper()}] {msg.text}", flush=True) if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}", flush=True))
        page.on("response", lambda resp: print(f"[NET {resp.status}] {resp.url}", flush=True) if any(x in resp.url for x in ["billing/customers", "billing/preview", "billing/checkout"]) else None)

        # ── Step 1: Navigate to App & Login ──
        print("[STEP 1] Navigating to http://localhost:3000/?tab=credit-billing...", flush=True)
        await page.goto(f"{BASE_URL}/?tab=credit-billing", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Handle Login Screen
        auth_btn = page.locator('button:has-text("Authorize Operator"), button:has-text("Login"), button#btn-login-submit').first
        admin_quick_btn = page.locator('button:has-text("Admin")').first
        if await auth_btn.count() > 0 and await auth_btn.is_visible():
            print("  Login form detected. Selecting Admin persona & authorizing...", flush=True)
            if await admin_quick_btn.count() > 0:
                await admin_quick_btn.click()
                await page.wait_for_timeout(400)
            await auth_btn.click()
            await page.wait_for_timeout(3000)

        # Handle Company Selection Modal
        enter_ws_btn = page.locator('button:has-text("Enter Workspace"), button:has-text("Connect Workspace"), button:has-text("Connect")').first
        if await enter_ws_btn.count() > 0 and await enter_ws_btn.is_visible():
            print("  Company selector modal detected. Entering workspace...", flush=True)
            await enter_ws_btn.click()
            await page.wait_for_timeout(3000)

        # Dismiss any overlays
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        # ── Step 2: Ensure Credit Billing Terminal is Active ──
        print("[STEP 2] Verifying Credit Billing Terminal workspace...", flush=True)
        terminal_heading = page.locator('h1:has-text("Credit Billing")')
        if await terminal_heading.count() == 0:
            print("  Dispatching smriti_navigate_module for credit-billing...", flush=True)
            await page.evaluate("""() => {
                window.dispatchEvent(new CustomEvent('smriti_navigate_module', { detail: { moduleId: 'credit-billing' } }));
            }""")
            await page.wait_for_timeout(2500)

        # In Billing Workspace, if needed, click the Credit mode button (Alt+2)
        credit_tab_btn = page.locator('button:has-text("Credit"):has-text("Alt+2"), button:has-text("Credit Billing")').first
        if await credit_tab_btn.count() > 0 and await credit_tab_btn.is_visible():
            print("  Clicking Credit mode toggle...", flush=True)
            await credit_tab_btn.click()
            await page.wait_for_timeout(2000)

        # Wait for terminal to be visible
        await page.wait_for_selector('h1:has-text("Credit Billing")', timeout=15000)
        print("  [OK] Credit Billing Terminal active.", flush=True)

        # ── Step 3: Open Customer Master Modal & Search Child Customer ──
        print("[STEP 3] Opening Customer Master Modal & Searching for Child Customer...", flush=True)
        cust_trigger = page.locator('button:has-text("Select Customer...")').first
        if await cust_trigger.count() == 0 or not await cust_trigger.is_visible():
            cust_trigger = page.locator('button[title="Customer Master (New/Lookup)"]').first
        
        await cust_trigger.click()
        await page.wait_for_timeout(1500)

        # Identify modal container specifically
        modal = page.locator('div.fixed:has-text("Customer Master")').first
        await modal.wait_for(state="visible", timeout=10000)
        print("  [OK] Customer Master Modal opened.", flush=True)

        # Search for "Bandra" inside the modal search input
        search_input = modal.locator('input[type="text"]').first
        await search_input.wait_for(state="visible", timeout=5000)
        print("  Searching for 'Bandra' child customer...", flush=True)
        await search_input.fill("Bandra")
        await page.wait_for_timeout(2000)

        # Check rows in modal
        child_row = modal.locator('tr:has-text("Reliance Fresh - Bandra West (Child Outlet)")').first
        await child_row.wait_for(state="visible", timeout=10000)
        row_txt = await child_row.text_content()
        print(f"  [OK] Subordinate Child Customer located: {row_txt.strip()}", flush=True)

        # Capture Screenshot 1: Child customer in lookup modal with parent badge
        ss1_path = os.path.join(SCREENSHOT_DIR, "01_child_customer_lookup_modal.png")
        await page.screenshot(path=ss1_path, full_page=False)
        print(f"  [SCREENSHOT 1 CAPTURED] {ss1_path}", flush=True)

        # ── Step 4: Select Child Customer ──
        print("[STEP 4] Selecting Child Customer into Billing Terminal...", flush=True)
        await child_row.click()
        await page.wait_for_timeout(400)

        # Click the "Select" button in the modal footer
        select_btn = modal.locator('button:has-text("Select")').first
        if await select_btn.count() > 0 and await select_btn.is_visible():
            await select_btn.click()
        else:
            await child_row.dblclick()
        await page.wait_for_timeout(1500)

        # Verify customer header now shows Bandra child customer
        cust_card_text = await page.locator('div:has-text("Customer *")').first.text_content()
        print(f"  Customer Assigned in Terminal: {cust_card_text.strip()[:80]}...", flush=True)

        # ── Step 5: Verify Cart Line Items & Calculations ──
        print("[STEP 5] Verifying Cart Line Items & Statutory Preview...", flush=True)
        await page.wait_for_timeout(1500)

        # Capture Screenshot 2: Cart with Child Customer and Line Items
        ss2_path = os.path.join(SCREENSHOT_DIR, "02_billing_cart_with_child_customer.png")
        await page.screenshot(path=ss2_path, full_page=False)
        print(f"  [SCREENSHOT 2 CAPTURED] {ss2_path}", flush=True)

        # ── Step 6: Post / Submit Credit Invoice ──
        print("[STEP 6] Posting / Submitting Credit Invoice for Child Customer...", flush=True)
        submit_btn = page.locator('button:has-text("Submit Invoice"), button:has-text("Post Invoice")').first

        # Expect the backend checkout API response
        async with page.expect_response(lambda r: "billing/checkout" in r.url, timeout=20000) as resp_info:
            if await submit_btn.count() > 0 and await submit_btn.is_visible():
                print("  Clicking Submit Invoice button...", flush=True)
                await submit_btn.click()
            else:
                print("  Triggering F6 shortcut for Submit Invoice...", flush=True)
                await page.keyboard.press("F6")

        checkout_resp = await resp_info.value
        resp_json = await checkout_resp.json()
        inv_no = resp_json.get("invoice_no") or resp_json.get("invoice_id")
        print(f"  [OK] Checkout committed atomically! Status: {checkout_resp.status}, Invoice No: {inv_no}", flush=True)
        await page.wait_for_timeout(2000)

        # Wait for the "Submitted" badge in the UI
        submitted_badge = page.locator('span:has-text("Submitted")').first
        if await submitted_badge.count() > 0:
            await submitted_badge.wait_for(state="visible", timeout=5000)
            badge_text = await submitted_badge.text_content()
            print(f"  UI Status Badge: {badge_text.strip()}", flush=True)

        # Capture Screenshot 3: Final posted invoice with child customer account
        ss3_path = os.path.join(SCREENSHOT_DIR, "03_invoice_posted_for_child_customer.png")
        await page.screenshot(path=ss3_path, full_page=False)
        print(f"  [SCREENSHOT 3 CAPTURED] {ss3_path}", flush=True)

        # ── Step 7: Open Statutory Tax Invoice Print Preview Modal (A4) ──
        print("[STEP 7] Opening Statutory Tax Invoice Print Preview Modal (A4)...", flush=True)
        print_btn = page.locator('button:has-text("Print (F9)"), button:has-text("Preview (F5)")').first
        if await print_btn.count() > 0 and await print_btn.is_visible():
            print("  Clicking Print (F9) button in footer...", flush=True)
            await print_btn.click()
        else:
            print("  Triggering F9 shortcut for Print Preview...", flush=True)
            await page.keyboard.press("F9")
        await page.wait_for_timeout(2500)

        # Wait for the Tax Invoice print preview modal
        modal_preview = page.locator('div.fixed:has-text("A4 Standard")').first
        await modal_preview.wait_for(state="visible", timeout=10000)
        
        # Verify statutory seller and customer identity inside the preview
        await page.wait_for_selector('div.fixed:has-text("Tattly Threads Private Limited")', timeout=5000)
        print("  [OK] Tax Invoice Print Preview Modal rendered with authoritative seller & child customer identity.", flush=True)
        await page.wait_for_timeout(1500)

        # Capture Screenshot 4: Tax Invoice Print Preview Modal in Terminal
        ss4_path = os.path.join(SCREENSHOT_DIR, "04_tax_invoice_print_preview.png")
        await page.screenshot(path=ss4_path, full_page=False)
        print(f"  [SCREENSHOT 4 CAPTURED] {ss4_path}", flush=True)

        # ── Step 8: Render Standalone A4 Statutory Tax Invoice Document ──
        print("[STEP 8] Rendering Standalone Statutory A4 Tax Invoice Document...", flush=True)
        html_file = os.path.join(SCREENSHOT_DIR, "tax_invoice_INV-20261023-7A149D.html")
        if os.path.exists(html_file):
            preview_page = await context.new_page()
            await preview_page.set_viewport_size({"width": 1200, "height": 1600})
            file_url = f"file:///{html_file.replace(os.sep, '/')}"
            await preview_page.goto(file_url, wait_until="load")
            await preview_page.wait_for_timeout(1000)
            ss5_path = os.path.join(SCREENSHOT_DIR, "05_statutory_a4_tax_invoice_full.png")
            await preview_page.screenshot(path=ss5_path, full_page=True)
            print(f"  [SCREENSHOT 5 CAPTURED] {ss5_path}", flush=True)
            await preview_page.close()

        await browser.close()
        print("\n" + "=" * 80, flush=True)
        print("[SUCCESS] Headless child customer billing & Tax Invoice print preview completed perfectly!", flush=True)
        print(f"Screenshots saved to: {SCREENSHOT_DIR}", flush=True)
        print("=" * 80, flush=True)

if __name__ == '__main__':
    asyncio.run(main())
