"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.8
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


async def run_headless_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — VENDOR 360 ADVANCE PREPAYMENT & KNOCK-OFF EVIDENCE CAPTURE")
    print("=" * 80)
    print(f"Target App URL : {BASE_URL}")
    print(f"Docs Evidence  : {DOCS_EVIDENCE_DIR}")
    print(f"Artifact Dir   : {ARTIFACT_DIR}")
    print("-" * 80)

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

        print("[STEP 1] Navigating to Vendor 360 Payables & Advance Knockoff Studio...")
        target_url = f"{BASE_URL}/?standalone_vendor_advance_knockoff=1"
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # 1. Vendor 360 Payables Overview Screenshot
        overview_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_payables_and_advances_overview.png")
        await page.screenshot(path=overview_png, full_page=True)
        print(f"[CAPTURE OK] Overview screenshot: {overview_png}")

        artifact_overview = os.path.join(ARTIFACT_DIR, "vendor_360_payables_and_advances_overview.png")
        shutil.copy2(overview_png, artifact_overview)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_overview}")

        # 2. Open 1-Click Knock-off Modal
        print("[STEP 2] Opening 1-Click Advance Knock-off Modal...")
        knockoff_btn = page.locator("button:has-text('Knock Off Advance')").first
        if await knockoff_btn.count() > 0:
            await knockoff_btn.click()
            await page.wait_for_timeout(800)

            modal_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_advance_knockoff_modal_active.png")
            await page.screenshot(path=modal_png, full_page=True)
            print(f"[CAPTURE OK] Knock-off modal screenshot: {modal_png}")

            artifact_modal = os.path.join(ARTIFACT_DIR, "vendor_360_advance_knockoff_modal_active.png")
            shutil.copy2(modal_png, artifact_modal)
            print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_modal}")

            # 3. Submit Knock-off Voucher
            print("[STEP 3] Executing Knock-off Voucher...")
            post_btn = page.locator("button:has-text('Post Knock-off Voucher')").first
            if await post_btn.count() > 0:
                await post_btn.click()
                await page.wait_for_timeout(1000)

                settled_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_advance_knockoff_settled.png")
                await page.screenshot(path=settled_png, full_page=True)
                print(f"[CAPTURE OK] Post-settlement screenshot: {settled_png}")

                artifact_settled = os.path.join(ARTIFACT_DIR, "vendor_360_advance_knockoff_settled.png")
                shutil.copy2(settled_png, artifact_settled)
                print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_settled}")

        await browser.close()
        print("-" * 80)
        print("ALL HEADLESS CAPTURES COMPLETED SUCCESSFULLY.")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_headless_capture())
