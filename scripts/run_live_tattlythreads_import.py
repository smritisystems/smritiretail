"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.50
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Live Cloudflare Remote Import Test & Screenshot Runner
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

WORKSPACE_ARTIFACTS_DIR = Path(r"f:\SMRITRretailNX\artifacts\smart-import\live-tattlythreads")
BRAIN_ARTIFACTS_DIR = Path(r"C:\Users\netma\.gemini\antigravity-ide\brain\3c4e6bbb-73a9-447e-9441-c54a230b29ff\artifacts\smart-import\live-tattlythreads")
WORKSPACE_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
BRAIN_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

FIXTURE_PATH = Path(r"f:\SMRITRretailNX\tests\fixtures\smart_import_192_footwear_items.tsv")

def save_screenshots(filename, page_screenshot_bytes):
    p1 = WORKSPACE_ARTIFACTS_DIR / filename
    p2 = BRAIN_ARTIFACTS_DIR / filename
    p1.write_bytes(page_screenshot_bytes)
    p2.write_bytes(page_screenshot_bytes)
    print(f"[Screenshot] Successfully saved {filename} ({len(page_screenshot_bytes)} bytes)")

async def main():
    print("=== LIVE TATTLY THREADS (https://tattlythreads.smritisys.com/) COMPLETE FOOTWEAR IMPORT RUNNER ===")

    # 1. Read Fixture
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        tsv_content = f.read()

    lines = [l for l in tsv_content.strip().split("\n") if l.strip()]
    row_count = len(lines) - 1
    print(f"Loaded fixture: {FIXTURE_PATH} ({row_count} data rows)")

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
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            device_scale_factor=1
        )

        page = await context.new_page()

        # Listen to browser console and network
        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda err: print(f"[Browser PageError] {err}"))

        async def handle_response(resp):
            if "/universal-import/preview" in resp.url:
                try:
                    res_json = await resp.json()
                    print(f"\n[Preview Network Response] Status {resp.status}")
                    print("Summary:", res_json.get("summary"))
                    rows = res_json.get("reconciliation_report") or res_json.get("rows") or []
                    print(f"Returned rows: {len(rows)}")
                    for r in rows[:3]:
                        print(f"Row {r.get('row_number')}: status={r.get('status')} errors={r.get('errors')}")
                except Exception as e:
                    print(f"[Preview Response Parse Error]: {e}")
            elif "/universal-import/commit" in resp.url:
                try:
                    res_json = await resp.json()
                    print(f"\n[Commit Network Response] Status {resp.status}")
                    print("Commit result:", json.dumps(res_json, indent=2))
                except Exception as e:
                    print(f"[Commit Response Parse Error]: {e}")

        async def handle_request(req):
            if "/universal-import/preview" in req.url:
                try:
                    post_data = req.post_data
                    if post_data:
                        body_json = json.loads(post_data)
                        rows = body_json.get("rows", [])
                        print(f"\n[Preview Network Request] Total rows in payload: {len(rows)}")
                        if rows:
                            print("Sample payload row 1:", json.dumps(rows[0], indent=2))
                except Exception as e:
                    print(f"[Preview Request Parse Error]: {e}")

        page.on("request", handle_request)
        page.on("response", handle_response)

        print("\nStep 1: Navigating to https://tattlythreads.smritisys.com/ ...")
        await page.goto("https://tattlythreads.smritisys.com/", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Check if login form is present
        print("Checking for login form or existing session...")
        login_input = page.locator("input[name='username'], input[type='text'], input[placeholder*='username' i], input[placeholder*='email' i]").first
        if await login_input.is_visible():
            print("Login page detected. Performing UI login...")
            await login_input.fill("admin")
            pwd_input = page.locator("input[name='password'], input[type='password']").first
            await pwd_input.fill("Admin@123")
            
            s_login = await page.screenshot(full_page=True)
            save_screenshots("01-live-login-page.png", s_login)

            login_btn = page.locator("button[type='submit'], button:has-text('Sign In'), button:has-text('Login')").first
            await login_btn.click()
            await page.wait_for_timeout(4000)

        # Screenshot after login / home view
        s_home = await page.screenshot(full_page=True)
        save_screenshots("02-live-authenticated-home.png", s_home)

        # Navigate to Item Master
        print("\nStep 2: Navigating to Item Master Studio...")
        await page.goto("https://tattlythreads.smritisys.com/?tab=item_master", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)

        # Switch to Imports & Bulk Paste tab
        print("Switching to 'Imports & Bulk Paste' sub-tab...")
        imports_tab_button = page.locator("button:has-text('Imports & Bulk Paste'), button:has-text('Imports')").first
        if await imports_tab_button.is_visible():
            await imports_tab_button.click()
            await page.wait_for_timeout(2000)

        # Screenshot: Live Import Studio
        s_studio = await page.screenshot(full_page=True)
        save_screenshots("03-live-import-studio.png", s_studio)

        # Step 3: Paste TSV content into Raw Matrix Input
        print("\nStep 3: Pasting 50 footwear TSV rows into Raw Matrix Input...")
        raw_textarea = page.locator("textarea[placeholder*='Paste tab-delimited'], textarea").first
        if await raw_textarea.is_visible():
            await raw_textarea.fill(tsv_content)
            await page.wait_for_timeout(3000)

            # Screenshot: Column mapping
            s_mapping = await page.screenshot(full_page=True)
            save_screenshots("04-live-column-mapping.png", s_mapping)

            # Step 4: Re-validate All
            print("\nStep 4: Triggering preview validation...")
            revalidate_btn = page.locator("button:has-text('Re-validate All')").first
            if await revalidate_btn.is_visible():
                await revalidate_btn.click()
                print("Waiting for validation response...")
                await page.wait_for_timeout(15000)

            # Select strategy ALL_ELIGIBLE in strategy selector if present
            strategy_select = page.locator("select:has-text('All Eligible'), select").first
            if await strategy_select.is_visible():
                try:
                    await strategy_select.select_option("ALL_ELIGIBLE")
                    await page.wait_for_timeout(1500)
                except Exception:
                    pass

            # Screenshot: Preview results
            s_preview = await page.screenshot(full_page=True)
            save_screenshots("05-live-validation-preview.png", s_preview)

            # Step 5: Click Import & Commit
            print("\nStep 5: Submitting database import...")
            commit_btn = page.locator("button:has-text('Import & Commit'), button:has-text('Import')").first
            if await commit_btn.is_visible():
                print("Clicking 'Import & Commit' button...")
                await commit_btn.click()
                await page.wait_for_timeout(3000)

                # Confirm Modal: Click 'Confirm & Commit'
                confirm_btn = page.locator("div[role='dialog'] button:has-text('Confirm & Commit'), button:has-text('Confirm & Commit')").last
                if await confirm_btn.is_visible():
                    print("Clicking 'Confirm & Commit' in modal...")
                    await confirm_btn.click()
                    print("Awaiting commit response and live PostgreSQL transaction...")
                    await page.wait_for_timeout(25000)

            # Screenshot: Import Result
            s_result = await page.screenshot(full_page=True)
            save_screenshots("06-live-import-result.png", s_result)

            # Step 6: Visual Catalog View
            print("\nStep 6: Navigating to Item Master Catalog...")
            catalog_tab_btn = page.locator("button:has-text('Article / Design Catalog'), button:has-text('Catalog')").first
            if await catalog_tab_btn.is_visible():
                await catalog_tab_btn.click()
                await page.wait_for_timeout(4000)

            s_catalog = await page.screenshot(full_page=True)
            save_screenshots("07-live-catalog-verification.png", s_catalog)

        await browser.close()
        print("\n=== LIVE RUN COMPLETED ===")

if __name__ == "__main__":
    asyncio.run(main())
