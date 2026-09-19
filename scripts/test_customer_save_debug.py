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

Diagnostic script to test modifying details in Customer Catalogue Form and clicking Save.
Captures console logs, network payloads, HTTP status codes, and UI notifications.
"""

import asyncio
import os
from playwright.async_api import async_playwright

WEB_BASE = "http://localhost:3000"
SCREENSHOT_PATH = r"C:\Users\netma\.gemini\antigravity-ide\brain\d1e1ac2d-e193-4ebb-9bd8-b13b02474afe\screenshots_customer_catalogue_audit\debug_save_failure.png"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(viewport={"width": 1600, "height": 950})
        page = await context.new_page()

        # Capture console messages
        page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[BROWSER PAGE ERROR] {err}"))

        # Capture network traffic for /api/v1/crm
        async def handle_request(req):
            if "/api/v1/crm" in req.url:
                print(f"[NET REQ] {req.method} {req.url}")
                if req.post_data:
                    print(f"  Payload: {req.post_data[:200]}")
        page.on("request", handle_request)

        async def handle_response(res):
            if "/api/v1/crm" in res.url:
                body = await res.text()
                print(f"[NET RES] {res.status} {res.url} -> {body[:250]}")
        page.on("response", handle_response)

        print("[1] Navigating to http://localhost:3000/?tab=customer-master...")
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
            await page.wait_for_timeout(3000)

        # Ensure Customer Master is open
        if await page.locator('text="Customer Catalogue"').count() == 0:
            print("  Dispatching smriti_navigate_module for customer-master...")
            await page.evaluate("""() => {
                window.dispatchEvent(new CustomEvent('smriti_navigate_module', { detail: { moduleId: 'customer-master' } }));
            }""")
            await page.wait_for_timeout(2500)

        print("\n[2] Selecting customer RRL-001 from Directory...")
        dir_btn = page.locator('button:has-text("Directory")').first
        if await dir_btn.count() > 0 and await dir_btn.is_visible():
            await dir_btn.click()
            await page.wait_for_timeout(1000)

        rrl_row = page.locator('tr:has-text("RRL-001")').first
        if await rrl_row.count() > 0:
            await rrl_row.click()
            await page.wait_for_timeout(1500)
            print("  Selected RRL-001 from Directory.")

        name_input = page.locator('input[data-field-key="customer_name"]').first
        if await name_input.count() > 0:
            val = await name_input.input_value()
            print(f"  Current Customer Name in input: '{val}'")

            # Modify the name slightly
            new_val = "Reliance Retail Limited Corp"
            print(f"  Modifying Customer Name to '{new_val}'...")
            await name_input.fill(new_val)
            await page.wait_for_timeout(500)

        # Click Save
        print("\n[3] Clicking Save button...")
        save_btn = page.locator('button:has-text("Save"), button:has-text("Save Ctrl+S")').first
        if await save_btn.count() > 0 and await save_btn.is_visible():
            await save_btn.click()
            await page.wait_for_timeout(4000)

        # Check for notifications or toast
        notifications = await page.locator('div[role="alert"], div:has-text("Save Failed"), div:has-text("Catalogue Saved"), div:has-text("Validation Error")').all_inner_texts()
        print("\n[4] Detected notifications on screen:", notifications)

        await page.screenshot(path=SCREENSHOT_PATH)
        print(f"  Saved debug screenshot to {SCREENSHOT_PATH}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
