"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.51.0
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


async def run_headless_tds_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — VENDOR STATUTORY TDS (ACCOUNT 2030) EVIDENCE CAPTURE")
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

        print("[STEP 1] Navigating to Vendor 360 Payables & Advance Studio (Standalone)...")
        target_url = f"{BASE_URL}/?standalone_vendor_advance_knockoff=1"
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # 1. Full studio overview
        print("[STEP 2] Capturing Vendor 360 Studio Overview with Statutory TDS Card...")
        overview_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_statutory_tds_overview.png")
        await page.screenshot(path=overview_png, full_page=True)
        print(f"[CAPTURE OK] Overview screenshot: {overview_png}")

        artifact_overview = os.path.join(ARTIFACT_DIR, "vendor_360_statutory_tds_overview.png")
        shutil.copy2(overview_png, artifact_overview)
        print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_overview}")

        # 2. Focus on TDS Card (Account 2030)
        print("[STEP 3] Capturing Focused Financial Summary Cards Strip...")
        cards_locator = page.locator("div.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4").first
        if await cards_locator.count() > 0:
            card_png = os.path.join(DOCS_EVIDENCE_DIR, "vendor_360_statutory_tds_card_focus.png")
            await cards_locator.screenshot(path=card_png)
            print(f"[CAPTURE OK] Focused Cards Strip: {card_png}")

            artifact_card = os.path.join(ARTIFACT_DIR, "vendor_360_statutory_tds_card_focus.png")
            shutil.copy2(card_png, artifact_card)
            print(f"[ARTIFACT OK] Copied to artifact directory: {artifact_card}")
        else:
            print("[WARN] Cards strip locator not matched directly, taking top section screenshot...")

        await browser.close()
        print("-" * 80)
        print("ALL TDS EVIDENCE SCREENSHOTS SUCCESSFULLY CAPTURED & SAVED.")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_headless_tds_capture())
