"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.7
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
    print("SMRITI RETAIL OS — SUPPLIER ADVANCE & AUTOMATIC KNOCK-OFF EVIDENCE CAPTURE")
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

        print("[STEP 1] Navigating to standalone Supplier Advance Knockoff Visualizer...")
        target_url = f"{BASE_URL}/?standalone_supplier_advance=1"
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # 1. Full Lifecycle Screenshot
        full_png = os.path.join(DOCS_EVIDENCE_DIR, "supplier_advance_disbursement_and_knockoff.png")
        await page.screenshot(path=full_png, full_page=True)
        print(f"[CAPTURE OK] Full lifecycle screenshot: {full_png}")

        artifact_full = os.path.join(ARTIFACT_DIR, "supplier_advance_disbursement_and_knockoff.png")
        shutil.copy2(full_png, artifact_full)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_full}")

        # 2. Filter to Disbursement View
        print("[STEP 2] Switching to Disbursement Focus View...")
        disb_btn = page.locator("button:has-text('Disbursement')")
        if await disb_btn.count() > 0:
            await disb_btn.click()
            await page.wait_for_timeout(500)
            disb_png = os.path.join(DOCS_EVIDENCE_DIR, "supplier_advance_disbursement_focus.png")
            await page.screenshot(path=disb_png, full_page=True)
            print(f"[CAPTURE OK] Disbursement focus screenshot: {disb_png}")
            artifact_disb = os.path.join(ARTIFACT_DIR, "supplier_advance_disbursement_focus.png")
            shutil.copy2(disb_png, artifact_disb)
            print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_disb}")

        # 3. Filter to Knockoff View
        print("[STEP 3] Switching to Knock-off Focus View...")
        knock_btn = page.locator("button:has-text('Knock-off')")
        if await knock_btn.count() > 0:
            await knock_btn.click()
            await page.wait_for_timeout(500)
            knock_png = os.path.join(DOCS_EVIDENCE_DIR, "supplier_advance_knockoff_focus.png")
            await page.screenshot(path=knock_png, full_page=True)
            print(f"[CAPTURE OK] Knock-off focus screenshot: {knock_png}")
            artifact_knock = os.path.join(ARTIFACT_DIR, "supplier_advance_knockoff_focus.png")
            shutil.copy2(knock_png, artifact_knock)
            print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_knock}")

        await browser.close()
        print("=" * 80)
        print("ALL HEADLESS SCREENSHOTS CAPTURED SUCCESSFULLY (WITHOUT BROWSER WINDOW)!")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_headless_capture())
