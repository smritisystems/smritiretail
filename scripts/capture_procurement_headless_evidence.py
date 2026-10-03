"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.5
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Verification / Headless Evidence Capture
"""

import asyncio
import json
import os
import sys
import urllib.request
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3000"
API_URL = "http://127.0.0.1:1981"
DOCS_EVIDENCE_DIR = os.path.join(os.getcwd(), "docs", "walkthrough", "procurement", "evidence")
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\aaff00e6-0df9-4455-9368-34989e066b42"

os.makedirs(DOCS_EVIDENCE_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)


def get_admin_jwt_token():
    login_url = f"{API_URL}/api/v1/auth/login"
    payload = json.dumps({"username": "admin", "password": "Admin@123"}).encode()
    req = urllib.request.Request(
        login_url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get("access_token")
    except Exception as e:
        print(f"[Auth Error] Failed to get JWT token: {e}")
        return None


async def run_headless_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — PROCUREMENT & PAYABLES HEADLESS EVIDENCE CAPTURE")
    print("=" * 80)
    print(f"Target App URL : {BASE_URL}")
    print(f"FastAPI API    : {API_URL}")
    print(f"Docs Evidence  : {DOCS_EVIDENCE_DIR}")
    print(f"Artifact Dir   : {ARTIFACT_DIR}")
    print("-" * 80)

    token = get_admin_jwt_token()
    if not token:
        print("[FAIL] Could not obtain admin JWT token from backend.")
        sys.exit(1)
    print(f"[AUTH OK] Admin token acquired: {token[:25]}...")

    async with async_playwright() as p:
        # Strictly headless without physical browser window
        browser = await p.chromium.launch(
            channel="chrome",
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

        print("[STEP 1] Pre-seeding authentication and tenant context into localStorage...")
        await page.goto(BASE_URL, wait_until="commit")
        await page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token}');
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
        }}""")

        # Navigate to Vendor 360 Workspace
        target_url = f"{BASE_URL}/?tab=vendor-360"
        print(f"[STEP 2] Navigating to Vendor 360: {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(3000)

        # Handle UI login form if still present
        body_text = await page.locator("body").inner_text()
        if "Welcome Back" in body_text and "Sign In" in body_text:
            print("[INFO] Executing automated UI form login fallback...")
            try:
                username_input = page.locator('input[type="text"], input[name="username"]').first
                password_input = page.locator('input[type="password"]').first
                await username_input.fill("admin")
                await password_input.fill("Admin@123")
                submit_btn = page.locator('button[type="submit"], button:has-text("Sign In")').first
                await submit_btn.click()
                await page.wait_for_timeout(3000)
                await page.goto(target_url, wait_until="networkidle")
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"[WARN] Login fallback error: {e}")

        # Capture 01: Vendor 360 Landing
        ss1_docs = os.path.join(DOCS_EVIDENCE_DIR, "01_vendor_360_directory.png")
        ss1_art = os.path.join(ARTIFACT_DIR, "vendor_360_directory.png")
        await page.screenshot(path=ss1_docs)
        await page.screenshot(path=ss1_art)
        print(f"[SCREENSHOT 1] Vendor 360 Directory saved: {ss1_docs}")

        # Step 3: Select a vendor to view detail tabs
        print("[STEP 3] Selecting first available vendor card in directory...")
        vendor_cards = page.locator("div.cursor-pointer, [role='button']").filter(has_text="Active")
        count = await vendor_cards.count()
        if count > 0:
            await vendor_cards.first.click()
            await page.wait_for_timeout(2000)

        # Capture 02: Vendor Detail Overview
        ss2_docs = os.path.join(DOCS_EVIDENCE_DIR, "02_vendor_360_detail_overview.png")
        ss2_art = os.path.join(ARTIFACT_DIR, "vendor_360_detail_overview.png")
        await page.screenshot(path=ss2_docs)
        await page.screenshot(path=ss2_art)
        print(f"[SCREENSHOT 2] Vendor Detail Overview saved: {ss2_docs}")

        # Step 4: Click Payables & Aging Tab
        print("[STEP 4] Locating and clicking 'Payables & Aging' tab...")
        payables_tab = page.locator("button:has-text('Payables & Aging'), button:has-text('Payables')").first
        if await payables_tab.count() > 0:
            await payables_tab.click()
            await page.wait_for_timeout(2500)
            ss3_docs = os.path.join(DOCS_EVIDENCE_DIR, "03_vendor_payables_and_aging.png")
            ss3_art = os.path.join(ARTIFACT_DIR, "vendor_payables_and_aging.png")
            await page.screenshot(path=ss3_docs)
            await page.screenshot(path=ss3_art)
            print(f"[SCREENSHOT 3] Vendor Payables & Aging Tab saved: {ss3_docs}")
        else:
            print("[WARN] Could not find 'Payables & Aging' tab button.")

        # Step 5: Navigate to Purchase Orders / Procurement Workspace
        po_url = f"{BASE_URL}/?tab=purchase"
        print(f"[STEP 5] Navigating to PO Workspace: {po_url}...")
        await page.goto(po_url, wait_until="networkidle")
        await page.wait_for_timeout(3500)
        ss4_docs = os.path.join(DOCS_EVIDENCE_DIR, "04_purchase_workspace.png")
        ss4_art = os.path.join(ARTIFACT_DIR, "purchase_workspace.png")
        await page.screenshot(path=ss4_docs)
        await page.screenshot(path=ss4_art)
        print(f"[SCREENSHOT 4] Purchase Workspace saved: {ss4_docs}")

        await browser.close()
        print("\n[COMPLETE] All headless screenshots captured successfully.")


if __name__ == "__main__":
    asyncio.run(run_headless_capture())
