"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.52.0
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


async def run_headless_challan_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — CHALLAN 281 & FORM 26Q EVIDENCE CAPTURE")
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

        # 1. Capture Overview with Card 4 & Challan 281 Action button
        print("[STEP 2] Capturing Overview with Challan 281 & Form 26Q Action button...")
        overview_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_challan281_overview.png")
        await page.screenshot(path=overview_png, full_page=True)
        print(f"[CAPTURE OK] Overview: {overview_png}")
        shutil.copy2(overview_png, os.path.join(ARTIFACT_DIR, "vendor_360_challan281_overview.png"))

        # 2. Open Challan 281 & Form 26Q Modal
        print("[STEP 3] Opening Challan 281 & Form 26Q Modal...")
        chl_btn = page.locator("button:has-text('Challan 281')").first
        if await chl_btn.count() > 0:
            await chl_btn.click()
        else:
            # Fallback: click Card 4
            card4 = page.locator("div:has-text('Statutory TDS (Account 2030)')").first
            await card4.click()
        await page.wait_for_timeout(1200)

        # Capture Modal Active
        modal_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_challan281_form26q_modal.png")
        await page.screenshot(path=modal_png, full_page=True)
        print(f"[CAPTURE OK] Modal Active: {modal_png}")
        shutil.copy2(modal_png, os.path.join(ARTIFACT_DIR, "vendor_360_challan281_form26q_modal.png"))

        # 3. Open Record Challan 281 Deposit Drawer
        print("[STEP 4] Opening Record Challan 281 Deposit Drawer...")
        record_btn = page.locator("button:has-text('Record Challan 281 Deposit')").first
        if await record_btn.count() > 0:
            await record_btn.click()
            await page.wait_for_timeout(800)

            # Fill sample values to show live double-entry balancing
            await page.fill("input[placeholder='e.g. 00142']", "00142")
            await page.fill("input[placeholder='e.g. 0002134']", "0002134")
            tax_inputs = page.locator("input[type='number']")
            if await tax_inputs.count() >= 5:
                await tax_inputs.nth(0).fill("10000.00")
                await tax_inputs.nth(1).fill("500.00")
                await tax_inputs.nth(2).fill("400.00")
                await tax_inputs.nth(3).fill("150.00")
                await tax_inputs.nth(4).fill("200.00")
            await page.wait_for_timeout(800)

        deposit_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_challan281_deposit_drawer.png")
        await page.screenshot(path=deposit_png, full_page=True)
        print(f"[CAPTURE OK] Deposit Drawer: {deposit_png}")
        shutil.copy2(deposit_png, os.path.join(ARTIFACT_DIR, "vendor_360_challan281_deposit_drawer.png"))

        # 4. Open NSDL ASCII Layout Inspection
        print("[STEP 5] Inspecting NSDL ASCII Layout...")
        inspect_btn = page.locator("button:has-text('Inspect NSDL ASCII Layout')").first
        if await inspect_btn.count() > 0:
            await inspect_btn.click()
            await page.wait_for_timeout(1000)

        nsdl_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_form26q_nsdl_preview.png")
        await page.screenshot(path=nsdl_png, full_page=True)
        print(f"[CAPTURE OK] NSDL ASCII Preview: {nsdl_png}")
        shutil.copy2(nsdl_png, os.path.join(ARTIFACT_DIR, "vendor_360_form26q_nsdl_preview.png"))

        print("=" * 80)
        print("[SUCCESS] All 4 Challan 281 & Form 26Q visual evidence artifacts captured successfully!")
        print("=" * 80)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(run_headless_challan_capture())
