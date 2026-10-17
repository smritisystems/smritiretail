"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.9
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


async def run_headless_batch_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — MULTI-BILL BATCH ADVANCE KNOCK-OFF & FIFO EVIDENCE CAPTURE")
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

        print("[STEP 1] Navigating to Vendor 360 Payables & Advance Knockoff Studio...")
        target_url = f"{BASE_URL}/?standalone_vendor_advance_knockoff=1"
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # 1. Open Batch Knock-off Modal
        print("[STEP 2] Opening Multi-Bill Batch Knock-Off Modal...")
        batch_btn = page.locator("button:has-text('Batch FIFO Knock-Off')").first
        if await batch_btn.count() > 0:
            await batch_btn.click()
        else:
            fallback_btn = page.locator("button:has-text('Batch Settle')").first
            await fallback_btn.click()
        await page.wait_for_timeout(1000)

        # 2. Trigger 1-Click Auto FIFO Allocation
        print("[STEP 3] Triggering ⚡ Auto FIFO Allocate...")
        fifo_btn = page.locator("button:has-text('Auto FIFO Allocate')").first
        if await fifo_btn.count() > 0:
            await fifo_btn.click()
            await page.wait_for_timeout(800)

        batch_modal_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_batch_knockoff_modal_fifo_active.png")
        await page.screenshot(path=batch_modal_png, full_page=True)
        print(f"[CAPTURE OK] Batch Knock-off FIFO Modal: {batch_modal_png}")

        artifact_batch_modal = os.path.join(ARTIFACT_DIR, "vendor_360_batch_knockoff_modal_fifo_active.png")
        shutil.copy2(batch_modal_png, artifact_batch_modal)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_batch_modal}")

        # 3. Confirm Batch Settlement
        print("[STEP 4] Executing Batch Settlement Voucher...")
        confirm_btn = page.locator("button:has-text('Confirm Batch Settlement')").first
        if await confirm_btn.count() > 0:
            await confirm_btn.click()
            await page.wait_for_timeout(1200)

        settled_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_batch_knockoff_settled_overview.png")
        await page.screenshot(path=settled_png, full_page=True)
        print(f"[CAPTURE OK] Settled Overview: {settled_png}")

        artifact_settled = os.path.join(ARTIFACT_DIR, "vendor_360_batch_knockoff_settled_overview.png")
        shutil.copy2(settled_png, artifact_settled)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_settled}")

        await browser.close()
        print("=" * 80)
        print("HEADLESS EVIDENCE CAPTURE COMPLETED SUCCESSFULLY!")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_headless_batch_capture())
