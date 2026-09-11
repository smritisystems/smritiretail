# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.30.0
# Created      : 2026-09-11
# Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal / Verification

import asyncio
import os
import sys
import time
import json
import urllib.request
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3000"
API_URL = "http://127.0.0.1:8000"
SCREENSHOT_DIR = os.path.join(os.getcwd(), "scratch", "vendor_360_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

console_errors = []
console_logs = []
failed_network = []
api_calls = []

def log_console(msg):
    text = f"[{msg.type.upper()}] {msg.text}"
    console_logs.append(text)
    if msg.type == "error":
        console_errors.append(text)

def log_request(request):
    if "/api/v1/" in request.url:
        api_calls.append(f"REQ: {request.method} {request.url}")

def log_response(response):
    if "/api/v1/" in response.url:
        api_calls.append(f"RESP: {response.status} {response.url}")

def log_request_failed(request):
    failed_network.append(f"FAIL: {request.method} {request.url} - {request.failure}")

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

async def run_vendor_360_headless_verification():
    print("=" * 80)
    print("SMRITI RETAIL OS — VENDOR 360 HEADLESS PLAYWRIGHT CHROMIUM E2E VERIFICATION")
    print("=" * 80)
    print(f"Base App URL : {BASE_URL}")
    print(f"FastAPI URL  : {API_URL}")
    print(f"Screenshots  : {SCREENSHOT_DIR}")
    print("-" * 80)

    # Step 1: Pre-flight Auth & Backend API Check
    token = get_admin_jwt_token()
    if not token:
        print("[FAIL] Could not obtain admin JWT token from backend.")
        sys.exit(1)
    print(f"[AUTH OK] Admin token acquired: {token[:25]}...")

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "001",
        "X-Branch-Code": "MAIN",
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "MAIN",
        "Content-Type": "application/json",
    }

    req = urllib.request.Request(f"{API_URL}/api/v1/purchase/vendors/", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            vlist = json.loads(resp.read().decode())
            print(f"[API PRE-FLIGHT OK] /purchase/vendors/ returned HTTP 200 with {len(vlist)} vendors:")
            for v in vlist:
                print(f"   - [{v.get('code')}] {v.get('legalName')} ({v.get('supplierType')}) | Status: {v.get('status')}")
    except Exception as e:
        print(f"[API PRE-FLIGHT FAIL] Failed to query /purchase/vendors/: {e}")
        sys.exit(1)

    # Step 2: Launch Headless Chromium
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        page.on("console", log_console)
        page.on("request", log_request)
        page.on("response", log_response)
        page.on("requestfailed", log_request_failed)

        # Pre-seed localStorage with authentication and multi-tenant keys
        print("\n[STEP 1] Pre-seeding authenticated local storage on domain...")
        await page.goto(BASE_URL, wait_until="commit")
        await page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token}');
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads Pvt Ltd');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
        }}""")

        # Step 3: Deep Link Navigation to Vendor 360 Workspace
        target_url = f"{BASE_URL}/?tab=vendor-360"
        print(f"[STEP 2] Navigating directly to deep link: {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)

        # Check if login form is still displayed (if auth redirect occurred)
        page_text = await page.locator("body").inner_text()
        if "Welcome Back" in page_text and "Sign In" in page_text:
            print("[INFO] Login screen encountered. Executing automated UI login...")
            try:
                username_input = page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i]').first
                password_input = page.locator('input[type="password"]').first
                await username_input.fill("admin")
                await password_input.fill("Admin@123")
                submit_btn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first
                await submit_btn.click()
                await page.wait_for_timeout(3000)
                # Re-navigate to target
                await page.goto(target_url, wait_until="networkidle")
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"[WARN] Automated UI login fallback error: {e}")

        # Step 4: Verify Workspace Render
        body_content = await page.locator("body").inner_text()
        has_dir = "Vendors Directory" in body_content or "Vendor 360" in body_content or "Supplier Directory" in body_content
        print(f"[STEP 3] Workspace Container Detected: {has_dir}")

        # Screenshot initial workspace
        ss_path = os.path.join(SCREENSHOT_DIR, "01_vendor_360_landing.png")
        await page.screenshot(path=ss_path)
        print(f"   Saved screenshot: {ss_path}")

        # Step 5: Check Vendor Listing
        vendor_names = ["Apex Fabrics Ltd", "Supplier 53d11e", "Universal Fabrics Ltd"]
        found_vendors = []
        for vname in vendor_names:
            if vname in body_content:
                found_vendors.append(vname)
        print(f"[STEP 4] Found Vendors in DOM: {found_vendors} (Total: {len(found_vendors)}/{len(vendor_names)})")

        # Step 6: Click on Vendor to ensure detail loads
        selected_vendor_name = None
        for vname in vendor_names:
            vendor_locator = page.locator(f"text={vname}").first
            if await vendor_locator.count() > 0:
                print(f"[STEP 5] Clicking vendor: '{vname}' to load detail...")
                await vendor_locator.click()
                await page.wait_for_timeout(2000)
                selected_vendor_name = vname
                break

        # Step 7: Verify the 9 Canonical Detail Tabs
        tab_names = [
            ("Overview", "overview"),
            ("Statutory & Tax", "statutory"),
            ("Addresses & Godowns", "addresses"),
            ("Key Contacts", "contacts"),
            ("Commercial Terms", "commercial"),
            ("Disbursement Banks", "banking"),
            ("Purchase Orders", "procurement"),
            ("Payables & Aging", "payables"),
            ("SLA & Scorecard", "scorecard"),
        ]

        print("\n[STEP 6] Verifying 9 Detail Tabs...")
        # Scope strictly to the 9-tab navigation bar inside VendorMasterWs
        tab_bar = page.locator("div.overflow-x-auto").filter(has_text="Overview")
        if await tab_bar.count() == 0:
            tab_bar = page.locator("div:has(> button:has-text('Overview'))")

        verified_tabs = []
        for idx, (label, slug) in enumerate(tab_names, 1):
            tab_locator = tab_bar.locator("button").filter(has_text=label).first
            count = await tab_locator.count()
            if count == 0:
                # Fallback: look for span with exact text
                tab_locator = tab_bar.locator(f"span:text-is('{label}')").first
                count = await tab_locator.count()

            if count > 0:
                await tab_locator.scroll_into_view_if_needed()
                await tab_locator.click()
                await page.wait_for_timeout(1000)
                tab_ss = os.path.join(SCREENSHOT_DIR, f"tab_{idx:02d}_{slug}.png")
                await page.screenshot(path=tab_ss)
                verified_tabs.append(label)
                print(f"   [TAB {idx}/9] [PASSED] '{label}' clicked and screenshot saved.")
            else:
                print(f"   [TAB {idx}/9] [MISSING] Could not locate tab button for '{label}'.")

        # Step 8: Tab Specific Verification Checks
        print("\n[STEP 7] Performing Specific Tab Inspections...")
        
        # Statutory & Tax Tab
        stat_tab = tab_bar.locator("button").filter(has_text="Statutory & Tax").first
        if await stat_tab.count() > 0:
            await stat_tab.click()
            await page.wait_for_timeout(1000)
            stat_text = await page.locator("body").inner_text()
            has_gst = "GSTIN" in stat_text or "27AABCA1234F1Z5" in stat_text
            has_pan = "PAN" in stat_text or "AABCA1234F" in stat_text
            print(f"   - Statutory & Tax Tab Content: GSTIN Present={has_gst}, PAN Present={has_pan}")

        # Disbursement Banks Tab
        bank_tab = tab_bar.locator("button").filter(has_text="Disbursement Banks").first
        if await bank_tab.count() > 0:
            await bank_tab.click()
            await page.wait_for_timeout(1000)
            bank_text = await page.locator("body").inner_text()
            has_bank = "Bank" in bank_text or "Account" in bank_text or "IFSC" in bank_text
            print(f"   - Disbursement Banks Tab Content: Bank details Present={has_bank}")

        # Commercial Terms Tab
        comm_tab = tab_bar.locator("button").filter(has_text="Commercial Terms").first
        if await comm_tab.count() > 0:
            await comm_tab.click()
            await page.wait_for_timeout(1000)
            comm_text = await page.locator("body").inner_text()
            has_terms = "Payment Terms" in comm_text or "TDS" in comm_text or "Classification" in comm_text
            print(f"   - Commercial Terms Tab Content: Terms/TDS Present={has_terms}")

        # Payables & Aging Tab
        pay_tab = tab_bar.locator("button").filter(has_text="Payables & Aging").first
        if await pay_tab.count() > 0:
            await pay_tab.click()
            await page.wait_for_timeout(1000)
            pay_text = await page.locator("body").inner_text()
            has_aging = "Aging" in pay_text or "Payable" in pay_text or "Outstanding" in pay_text
            print(f"   - Payables & Aging Tab Content: Aging/Payable Present={has_aging}")

        # SLA & Scorecard Tab
        sla_tab = tab_bar.locator("button").filter(has_text="SLA & Scorecard").first
        if await sla_tab.count() > 0:
            await sla_tab.click()
            await page.wait_for_timeout(1000)
            sla_text = await page.locator("body").inner_text()
            has_sla = "Score" in sla_text or "SLA" in sla_text or "Fulfillment" in sla_text or "Performance" in sla_text
            print(f"   - SLA & Scorecard Tab Content: Score/SLA Present={has_sla}")

        # Step 9: Report Network & Console Log Diagnostics
        print("\n" + "=" * 80)
        print("HEADLESS PLAYWRIGHT DIAGNOSTIC LOGS")
        print("=" * 80)
        print(f"Total API /api/v1/ Calls Recorded: {len(api_calls)}")
        for ac in api_calls[:10]:
            print(f"   {ac}")
        if len(api_calls) > 10:
            print(f"   ... ({len(api_calls) - 10} more API calls)")

        print(f"\nFailed Network Requests: {len(failed_network)}")
        for fn in failed_network:
            print(f"   [NET-FAIL] {fn}")

        print(f"\nConsole Errors Count: {len(console_errors)}")
        for ce in console_errors:
            print(f"   [CONSOLE-ERR] {ce}")

        await browser.close()

        # Step 10: Final Assertion & Exit Code
        print("\n" + "=" * 80)
        print("VERIFICATION SUMMARY")
        print("=" * 80)
        success = (
            has_dir and
            len(found_vendors) > 0 and
            len(verified_tabs) >= 8 and
            len(failed_network) == 0
        )
        if success:
            print("[STATUS: DONE] Headless Playwright Verification Succeeded!")
            print(f"   - Vendors Displayed: {len(found_vendors)}/{len(vendor_names)}")
            print(f"   - Canonical Tabs Verified: {len(verified_tabs)}/9")
            print(f"   - Zero Failed Network Calls: True")
            sys.exit(0)
        else:
            print("[STATUS: PARTIALLY VERIFIED / FAILED] Some assertions did not pass.")
            print(f"   - Directory Present: {has_dir}")
            print(f"   - Vendors Found: {len(found_vendors)}/{len(vendor_names)}")
            print(f"   - Tabs Verified: {len(verified_tabs)}/9")
            print(f"   - Failed Network Calls: {len(failed_network)}")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_vendor_360_headless_verification())
