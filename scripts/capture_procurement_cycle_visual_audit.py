"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.53.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Playwright Chromium Visual Audit Runner:
Captures end-to-end screenshots across the procurement lifecycle into docs/walkthrough/procurement/evidence/:
  1. procurement_cycle_step1_vendor_360.png
  2. procurement_cycle_step2_po_generation.png
  3. procurement_cycle_step3_po_workspace.png
  4. procurement_cycle_step4_grn_studio_inward.png
  5. procurement_cycle_step5_grn_posted_and_bill.png
  6. procurement_cycle_step6_three_way_match.png
  7. procurement_cycle_step7_procurement_reports.png
"""

import os
import sys
import json
import asyncio
import urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8000"
EVIDENCE_DIR = Path("f:/SMRITRretailNX/docs/walkthrough/procurement/evidence")
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def get_jwt_token():
    for user, pwd in [("admin", "Admin@123"), ("manager", "Manager@123"), ("admin", "Audit@1234")]:
        try:
            req = urllib.request.Request(
                f"{API_URL}/api/v1/auth/login",
                data=json.dumps({"username": user, "password": pwd}).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                if data.get("access_token"):
                    return data.get("access_token")
        except Exception:
            continue
    return None


async def capture_procurement_visual_audit():
    print("=" * 70)
    print("SMRITI RETAIL OS — HEADLESS PLAYWRIGHT PROCUREMENT CYCLE AUDIT")
    print("=" * 70)
    print(f"Target Evidence Directory: {EVIDENCE_DIR}")

    token = get_jwt_token()
    print(f"JWT Token Acquired: {token[:20]}..." if token else "JWT Token: Fallback to UI Quick Access")

    async with async_playwright() as p:
        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        browser = await p.chromium.launch(
            headless=True,
            executable_path=chrome_path if os.path.exists(chrome_path) else None,
            channel="chrome" if not os.path.exists(chrome_path) else None,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        context = await browser.new_context(viewport={"width": 1600, "height": 950})
        page = await context.new_page()

        # Step 0: Pre-seed authenticated localStorage
        print("\n[STEP 0] Pre-seeding authentication context on client domain...")
        await page.goto(BASE_URL, wait_until="commit")
        jwt_script = f"localStorage.setItem('smriti_jwt_token', '{token}');" if token else ""
        await page.evaluate(f"""() => {{
            {jwt_script}
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'SMRITI Retail Enterprise');
            localStorage.setItem('smriti_branch_name', 'Central Hub');
            localStorage.setItem('smriti_active_module', 'purchase-studio');
        }}""")

        # Check if login card appears and log in if needed
        await page.goto(f"{BASE_URL}/?tab=vendor-360", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        login_btn = page.locator("button:has-text('Login')").first
        if await login_btn.is_visible():
            print("[AUTH] Login screen detected, performing 1-click Manager login...")
            mgr_btn = page.locator("button:has-text('Manager')").first
            if await mgr_btn.is_visible():
                await mgr_btn.click()
                await page.wait_for_timeout(500)
            await login_btn.click()
            await page.wait_for_timeout(3000)
        p1 = EVIDENCE_DIR / "procurement_cycle_step1_vendor_360.png"
        await page.screenshot(path=str(p1), full_page=False)
        print(f"   [CAPTURED] Step 1 -> {p1.name}")

        # ── Step 2: PO Generation (Sizewise Matrix) ────────────────────────
        print("\n[STEP 2] Navigating to Purchase Studio (PO Generation)...")
        await page.goto(f"{BASE_URL}/?tab=purchase-studio", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # Ensure Generate PO is active
        gen_tab_btn = page.locator("#purchase-studio-generate-tab")
        if await gen_tab_btn.is_visible():
            await gen_tab_btn.click()
            await page.wait_for_timeout(1000)

        p2 = EVIDENCE_DIR / "procurement_cycle_step2_po_generation.png"
        await page.screenshot(path=str(p2), full_page=False)
        print(f"   [CAPTURED] Step 2 -> {p2.name}")

        # ── Step 3: PO Workspace (Status Badges & 1-Click Receive) ──────────
        print("\n[STEP 3] Opening Purchase Studio PO Workspace...")
        ws_tab_btn = page.locator("#purchase-studio-workspace-tab")
        if await ws_tab_btn.is_visible():
            await ws_tab_btn.click()
            await page.wait_for_timeout(1500)

        p3 = EVIDENCE_DIR / "procurement_cycle_step3_po_workspace.png"
        await page.screenshot(path=str(p3), full_page=False)
        print(f"   [CAPTURED] Step 3 -> {p3.name}")

        # ── Step 4: GRN Studio Desktop Terminal (Inward & Landed Cost) ─────
        print("\n[STEP 4] Navigating to GRN Studio (Desktop Terminal)...")
        await page.goto(f"{BASE_URL}/?tab=grn-studio", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        p4 = EVIDENCE_DIR / "procurement_cycle_step4_grn_studio_inward.png"
        await page.screenshot(path=str(p4), full_page=False)
        print(f"   [CAPTURED] Step 4 -> {p4.name}")

        # ── Step 5: GRN History & Purchase Bill Tab ─────────────────────────
        print("\n[STEP 5] Switching to Purchase Bill / History view...")
        # Check for bill tab or history button
        bill_btn = page.locator("button:has-text('Purchase Bill')").first
        if await bill_btn.is_visible():
            await bill_btn.click()
            await page.wait_for_timeout(1500)

        p5 = EVIDENCE_DIR / "procurement_cycle_step5_grn_posted_and_bill.png"
        await page.screenshot(path=str(p5), full_page=False)
        print(f"   [CAPTURED] Step 5 -> {p5.name}")

        # ── Step 6: Three-Way Matching Audit Modal ─────────────────────────
        print("\n[STEP 6] Opening Three-Way Matching Verification Modal...")
        more_btn = page.locator("button[title='More Options']").first
        if await more_btn.is_visible():
            await more_btn.click()
            await page.wait_for_timeout(500)
            match_btn = page.locator("button:has-text('3-Way Invoice Match')").first
            if await match_btn.is_visible():
                await match_btn.click()
                await page.wait_for_timeout(1200)

        p6 = EVIDENCE_DIR / "procurement_cycle_step6_three_way_match.png"
        await page.screenshot(path=str(p6), full_page=False)
        print(f"   [CAPTURED] Step 6 -> {p6.name}")

        # Close 3-Way Match modal by clicking its Close button
        close_btn = page.locator("button:has-text('Close')").first
        if await close_btn.is_visible():
            await close_btn.click()
            await page.wait_for_timeout(800)
        else:
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(500)

        # ── Step 7: Procurement Reports Studio (All 3 Reports) ─────────────
        print("\n[STEP 7] Opening Procurement Reports Modal...")
        reports_btn = page.locator("#grn-terminal-reports-btn, #grn-reports-btn, #po-workspace-reports-btn").first
        if await reports_btn.is_visible():
            await reports_btn.click()
            await page.wait_for_timeout(2000)

        p7 = EVIDENCE_DIR / "procurement_cycle_step7_procurement_reports.png"
        await page.screenshot(path=str(p7), full_page=False)
        print(f"   [CAPTURED] Step 7 -> {p7.name}")

        await browser.close()

    print("\n" + "=" * 70)
    print("ALL 7 HEADLESS PLAYWRIGHT SCREENSHOTS RECORDED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(capture_procurement_visual_audit())
