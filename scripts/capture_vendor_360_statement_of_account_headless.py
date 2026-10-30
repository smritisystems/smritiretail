"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.50.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Verification / Headless Evidence Capture
"""

import asyncio
import os
import shutil
import sys
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3000"
DOCS_EVIDENCE_DIR = os.path.join(os.getcwd(), "docs", "walkthrough", "procurement", "evidence")
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\aaff00e6-0df9-4455-9368-34989e066b42"

os.makedirs(DOCS_EVIDENCE_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)


async def run_headless_statement_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — VENDOR STATEMENT OF ACCOUNT (SOA) EVIDENCE CAPTURE")
    print("=" * 80)
    print(f"Target App URL : {BASE_URL}")
    print(f"Docs Evidence  : {DOCS_EVIDENCE_DIR}")
    print(f"Artifact Dir   : {ARTIFACT_DIR}")
    print("-" * 80)

    async with async_playwright() as p:
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

        print("[STEP 1] Navigating to Vendor 360 Payables & Advance Studio...")
        target_url = f"{BASE_URL}/?standalone_vendor_advance_knockoff=1"
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # 1. Open Statement of Account Modal
        print("[STEP 2] Opening Statement of Account Modal...")
        soa_btn = page.locator("button:has-text('Statement of Account')").first
        if await soa_btn.count() > 0:
            await soa_btn.click()
        else:
            print("[WARN] Statement of Account button not found, checking fallback...")
            fallback_btn = page.locator("button:has-text('SOA')").first
            await fallback_btn.click()
        await page.wait_for_timeout(1200)

        # Capture SOA Modal
        soa_modal_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_statement_of_account_modal.png")
        await page.screenshot(path=soa_modal_png, full_page=True)
        print(f"[CAPTURE OK] Statement of Account Modal: {soa_modal_png}")

        artifact_soa_modal = os.path.join(ARTIFACT_DIR, "vendor_360_statement_of_account_modal.png")
        shutil.copy2(soa_modal_png, artifact_soa_modal)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_soa_modal}")

        # 2. Switch Period Filter to "This Month"
        print("[STEP 3] Switching Period Preset to 'This Month'...")
        month_btn = page.locator("button:has-text('This Month')").first
        if await month_btn.count() > 0:
            await month_btn.click()
            await page.wait_for_timeout(800)

        soa_filtered_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_statement_of_account_filtered.png")
        await page.screenshot(path=soa_filtered_png, full_page=True)
        print(f"[CAPTURE OK] Filtered Statement View: {soa_filtered_png}")

        artifact_soa_filtered = os.path.join(ARTIFACT_DIR, "vendor_360_statement_of_account_filtered.png")
        shutil.copy2(soa_filtered_png, artifact_soa_filtered)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_soa_filtered}")

        # 3. Close Modal & Capture Overview
        print("[STEP 4] Closing modal and capturing overview...")
        close_btn = page.locator("button[title='Close modal']").first
        if await close_btn.count() > 0:
            await close_btn.click()
            await page.wait_for_timeout(600)

        overview_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_statement_of_account_overview.png")
        await page.screenshot(path=overview_png, full_page=True)
        print(f"[CAPTURE OK] Studio Overview: {overview_png}")

        artifact_overview = os.path.join(ARTIFACT_DIR, "vendor_360_statement_of_account_overview.png")
        shutil.copy2(overview_png, artifact_overview)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_overview}")

        await browser.close()
        print("-" * 80)
        print("ALL STATEMENT OF ACCOUNT EVIDENCE ARTIFACTS CAPTURED SUCCESSFULLY!")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_headless_statement_capture())
