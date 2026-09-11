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
import json
import urllib.request
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3000"
API_URL = "http://127.0.0.1:8000"
SCREENSHOT_DIR = os.path.join(os.getcwd(), "scratch", "vendor_print_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

console_errors = []
console_logs = []
failed_network = []

def log_console(msg):
    text = f"[{msg.type.upper()}] {msg.text}"
    console_logs.append(text)
    if msg.type == "error":
        console_errors.append(text)

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

async def run_vendor_print_headless_verification():
    print("=" * 80)
    print("SMRITI RETAIL OS — VENDOR PRINT STUDIO HEADLESS PLAYWRIGHT VERIFICATION")
    print("=" * 80)
    print(f"Base App URL : {BASE_URL}")
    print(f"FastAPI URL  : {API_URL}")
    print(f"Screenshots  : {SCREENSHOT_DIR}")
    print("-" * 80)

    token = get_admin_jwt_token()
    if not token:
        print("[FAIL] Could not obtain admin JWT token from backend.")
        sys.exit(1)
    print(f"[AUTH OK] Admin token acquired: {token[:25]}...")

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
        page.on("requestfailed", log_request_failed)

        # Pre-seed authenticated localStorage
        print("[STEP 1] Pre-seeding authenticated local storage on domain...")
        await page.goto(BASE_URL, wait_until="commit")
        await page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token}');
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads Pvt Ltd');
            localStorage.setItem('smriti_branch_name', 'Main Corporate Branch');
        }}""")

        # Navigate to Vendor 360 Workspace
        target_url = f"{BASE_URL}/?tab=vendor-360"
        print(f"[STEP 2] Navigating to: {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)

        # Handle potential login redirect
        page_text = await page.locator("body").inner_text()
        if "Welcome Back" in page_text and "Sign In" in page_text:
            print("[INFO] Executing login fallback...")
            try:
                username_input = page.locator('input[type="text"], input[name="username"]').first
                password_input = page.locator('input[type="password"]').first
                await username_input.fill("admin")
                await password_input.fill("Admin@123")
                await page.locator('button:has-text("Sign In"), button:has-text("Login")').first.click()
                await page.wait_for_timeout(3000)
                await page.goto(target_url, wait_until="networkidle")
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"[WARN] Login fallback error: {e}")

        # Ensure vendor is selected
        print("[STEP 3] Selecting vendor from directory...")
        vendor_locator = page.locator("text=Apex Fabrics Ltd").first
        if await vendor_locator.count() > 0:
            await vendor_locator.click()
            await page.wait_for_timeout(1500)
            print("   Selected 'Apex Fabrics Ltd'")
        else:
            print("[FAIL] Could not locate 'Apex Fabrics Ltd' in directory")
            sys.exit(1)

        # Test Right Panel 'Print Form' dropdown
        print("\n[STEP 4] Opening 'Print Form' Action Menu...")
        print_btn = page.locator("button:has-text('Print Form')").first
        if await print_btn.count() == 0:
            print("[FAIL] 'Print Form' button not found in command toolbar")
            sys.exit(1)

        await print_btn.click()
        await page.wait_for_timeout(500)

        # Verify dropdown options
        with_data_opt = page.locator("button:has-text('Print with Data')").first
        without_data_opt = page.locator("button:has-text('Print without Data')").first
        has_with_data = await with_data_opt.count() > 0
        has_without_data = await without_data_opt.count() > 0
        print(f"   Dropdown Option 'Print with Data' Present: {has_with_data}")
        print(f"   Dropdown Option 'Print without Data' Present: {has_without_data}")

        if not (has_with_data and has_without_data):
            print("[FAIL] Print dropdown options missing")
            sys.exit(1)

        # Test Mode 1: Click 'Print with Data'
        print("\n[STEP 5] Testing 'Print with Data' (Filled Vendor Dossier)...")
        await with_data_opt.click()
        await page.wait_for_timeout(1500)

        # Verify Print Modal opened
        modal_text = await page.locator("body").inner_text()
        modal_text_lower = modal_text.lower()
        modal_open = "vendor form print" in modal_text_lower
        print(f"   Print Studio Modal Opened: {modal_open}")

        dossier_title_present = "universal vendor registration" in modal_text_lower or "kyc dossier" in modal_text_lower
        legal_name_present = "apex fabrics ltd" in modal_text_lower
        code_present = "sup-548ca2" in modal_text_lower
        gstin_present = "27aabca1234f1z5" in modal_text_lower
        pan_present = "aabca1234f" in modal_text_lower

        print(f"   Dossier Title Present: {dossier_title_present}")
        print(f"   Legal Name Present ('Apex Fabrics Ltd'): {legal_name_present}")
        print(f"   Vendor Code Present ('SUP-548CA2'): {code_present}")
        print(f"   GSTIN Present: {gstin_present}")
        print(f"   PAN Present: {pan_present}")

        ss_with_data = os.path.join(SCREENSHOT_DIR, "01_vendor_print_with_data.png")
        await page.screenshot(path=ss_with_data)
        print(f"   Saved screenshot: {ss_with_data}")

        # Test Mode 2: Toggle to 'Without Data (Blank Form)' inside Modal
        print("\n[STEP 6] Testing Toggle to 'Without Data (Blank Form)' inside Modal...")
        blank_toggle = page.locator("button:has-text('Without Data (Blank Form)')").first
        if await blank_toggle.count() > 0:
            await blank_toggle.click()
            await page.wait_for_timeout(1500)
            blank_modal_text = await page.locator("body").inner_text()
            blank_text_lower = blank_modal_text.lower()
            blank_title_present = "vendor onboarding" in blank_text_lower and "kyc registration form" in blank_text_lower
            form_ref_present = "smriti-kyc-blank" in blank_text_lower
            undertaking_present = "statutory undertaking" in blank_text_lower
            print(f"   Blank Form Title Present: {blank_title_present}")
            print(f"   Blank Reference Code Present: {form_ref_present}")
            print(f"   Statutory Undertaking Present: {undertaking_present}")

            ss_without_data = os.path.join(SCREENSHOT_DIR, "02_vendor_print_without_data.png")
            await page.screenshot(path=ss_without_data)
            print(f"   Saved screenshot: {ss_without_data}")
        else:
            print("[FAIL] 'Without Data (Blank Form)' toggle button not found in modal")
            sys.exit(1)

        # Test Close Modal
        print("\n[STEP 7] Closing Print Modal...")
        close_btn = page.locator("button[title='Close Preview']").first
        if await close_btn.count() > 0:
            await close_btn.click()
            await page.wait_for_timeout(500)
            print("   Modal closed successfully")

        # Test Left Directory Header 'Blank Form' quick button
        print("\n[STEP 8] Testing Left Directory Header 'Blank Form' Button...")
        dir_blank_btn = page.locator("button[title*='Print Blank Vendor']").first
        if await dir_blank_btn.count() > 0:
            await dir_blank_btn.click()
            await page.wait_for_timeout(1500)
            quick_text = await page.locator("body").inner_text()
            quick_blank_open = "vendor onboarding" in quick_text.lower()
            print(f"   Quick Blank Form Studio Opened: {quick_blank_open}")

            ss_quick_blank = os.path.join(SCREENSHOT_DIR, "03_vendor_print_quick_blank.png")
            await page.screenshot(path=ss_quick_blank)
            print(f"   Saved screenshot: {ss_quick_blank}")

            # Verify print root portal
            print_portal = page.locator("#smriti-vendor-print-root").first
            portal_count = await print_portal.count()
            print(f"   Print Portal (#smriti-vendor-print-root) Mounted in DOM: {portal_count > 0}")

            # Close again
            await page.locator("button[title='Close Preview']").first.click()
            await page.wait_for_timeout(500)
        else:
            print("[WARN] Directory header blank form button not found")

        # Print diagnostics
        print("\n" + "=" * 80)
        print("HEADLESS PRINT VERIFICATION DIAGNOSTICS")
        print("=" * 80)
        print(f"Failed Network Requests: {len(failed_network)}")
        print(f"Console Errors Count: {len(console_errors)}")
        for ce in console_errors:
            print(f"   [CONSOLE-ERR] {ce}")

        await browser.close()

        # Final Evaluation
        all_passed = (
            modal_open and
            has_with_data and
            has_without_data and
            dossier_title_present and
            legal_name_present and
            blank_title_present and
            len(failed_network) == 0 and
            len(console_errors) == 0
        )

        if all_passed:
            print("\n[STATUS: DONE] Vendor Form Print (With & Without Data) Verified Successfully!")
            sys.exit(0)
        else:
            print("\n[STATUS: FAILED / PARTIALLY VERIFIED] One or more assertions failed.")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_vendor_print_headless_verification())
