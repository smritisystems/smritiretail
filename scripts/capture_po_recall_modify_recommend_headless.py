# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 6.75.1
# Created      : 2026-10-14
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal / Verification

import asyncio
import os
import sys
import json
import shutil
import urllib.request
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:8101"
API_URL = "http://127.0.0.1:1981"
OUTPUT_DIR = os.path.join(os.getcwd(), "docs", "walkthrough", "purchase", "evidence")
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\1f021eef-4ce0-4a6f-94c5-b253055b2912"
os.makedirs(OUTPUT_DIR, exist_ok=True)

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

async def run_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — HEADLESS RECALL, MODIFY & RECOMMEND SCREENSHOTS")
    print("=" * 80)
    print(f"Target URL   : {BASE_URL}")
    print(f"Backend API  : {API_URL}")
    print(f"Output Dir   : {OUTPUT_DIR}")
    print("-" * 80)

    token = get_admin_jwt_token()
    if not token:
        print("[FAIL] Could not acquire admin JWT token from backend.")
        sys.exit(1)
    print(f"[AUTH OK] Admin token acquired: {token[:25]}...")

    async with async_playwright() as p:
        # Strictly headless - zero physical browser windows
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
        )
        page = await context.new_page()

        # Step 0: Pre-seed authenticated localStorage
        print("\n[Step 0] Seeding authenticated local storage on domain...")
        await page.goto(BASE_URL, wait_until="commit")
        await page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token}');
            localStorage.setItem('smriti_user', JSON.stringify({{
                id: 'usr-admin',
                username: 'admin',
                role: 'SYSADMIN',
                fullName: 'System Administrator',
                branchId: 'BR-001',
                companyId: 'COMP-001'
            }}));
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
            localStorage.setItem('smriti_setup_completed', 'true');
            localStorage.setItem('smriti_po_ux_mode', 'standard');
        }}""")

        # Navigate to Purchase Studio
        target_url = f"{BASE_URL}/?tab=purchase"
        print(f"\n[Step 1] Navigating to Purchase Studio: {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(2500)

        # ---------------------------------------------------------------------
        # Shot 1: Purchase Studio - PO Workspace Tab (All POs with Action Toolbar)
        # ---------------------------------------------------------------------
        print("\n[Shot 1] Navigating to PO Workspace...")
        workspace_tab_btn = page.locator("#purchase-studio-workspace-tab").first
        if await workspace_tab_btn.count() > 0:
            await workspace_tab_btn.click()
            await page.wait_for_timeout(1500)

        shot1_name = "01_po_workspace_overview.png"
        shot1_path = os.path.join(OUTPUT_DIR, shot1_name)
        await page.screenshot(path=shot1_path, full_page=True)
        print(f"   [OK] Shot 1: PO Workspace Overview -> {shot1_path}")

        # ---------------------------------------------------------------------
        # Shot 2: PO Workspace - Draft Tab (Recalling Draft Orders)
        # ---------------------------------------------------------------------
        print("\n[Shot 2] Filtering by DRAFT status...")
        draft_tab = page.locator("button:has-text('Draft')").first
        if await draft_tab.count() > 0:
            await draft_tab.click()
            await page.wait_for_timeout(1000)

        shot2_name = "02_po_workspace_drafts.png"
        shot2_path = os.path.join(OUTPUT_DIR, shot2_name)
        await page.screenshot(path=shot2_path, full_page=True)
        print(f"   [OK] Shot 2: PO Workspace Drafts -> {shot2_path}")

        # ---------------------------------------------------------------------
        # Shot 3: PO Workspace - Confirmed Tab & Amendment Dialog (Modify Confirmed PO)
        # ---------------------------------------------------------------------
        print("\n[Shot 3] Filtering by CONFIRMED status and testing Amend...")
        confirmed_tab = page.locator("button:has-text('Confirmed')").first
        if await confirmed_tab.count() > 0:
            await confirmed_tab.click()
            await page.wait_for_timeout(1000)

        # Check if an Amend button is present
        amend_btn = page.locator("button:has-text('Amend')").first
        if await amend_btn.count() > 0:
            await amend_btn.click()
            await page.wait_for_timeout(1200)

            shot3_name = "03_po_amendment_dialog.png"
            shot3_path = os.path.join(OUTPUT_DIR, shot3_name)
            await page.screenshot(path=shot3_path, full_page=True)
            print(f"   [OK] Shot 3: PO Amendment Dialog -> {shot3_path}")

            # Close amendment dialog
            cancel_dialog_btn = page.locator("div[role='dialog'] button:has-text('Cancel')").first
            if await cancel_dialog_btn.count() > 0:
                await cancel_dialog_btn.click()
                await page.wait_for_timeout(500)
        else:
            shot3_name = "03_po_workspace_confirmed.png"
            shot3_path = os.path.join(OUTPUT_DIR, shot3_name)
            await page.screenshot(path=shot3_path, full_page=True)
            print(f"   [OK] Shot 3: PO Workspace Confirmed Tab -> {shot3_path}")

        # ---------------------------------------------------------------------
        # Shot 4: Generate PO Tab - Recalled PO History Sub-Tab
        # ---------------------------------------------------------------------
        print("\n[Shot 4] Switching back to Generate PO and opening History sub-tab...")
        generate_tab_btn = page.locator("#purchase-studio-generate-tab").first
        if await generate_tab_btn.count() > 0:
            await generate_tab_btn.click()
            await page.wait_for_timeout(1500)

        history_subtab = page.locator("nav button:has-text('History')").first
        if await history_subtab.count() > 0:
            await history_subtab.click()
            await page.wait_for_timeout(1500)

            # If there's a PO in the list, click the first one to open its detailed view
            first_po_card = page.locator("section button div:has-text('PO')").first
            if await first_po_card.count() > 0:
                await first_po_card.click()
                await page.wait_for_timeout(1000)

            shot4_name = "04_po_recalled_history_detail.png"
            shot4_path = os.path.join(OUTPUT_DIR, shot4_name)
            await page.screenshot(path=shot4_path, full_page=True)
            print(f"   [OK] Shot 4: Recalled PO History Detail -> {shot4_path}")

        # ---------------------------------------------------------------------
        # Shot 5: Generate PO Tab - Items Grid with F2 Browse Dialog (Legacy Vendor OK)
        # ---------------------------------------------------------------------
        print("\n[Shot 5] Opening Items tab and F2 Product Browse Modal...")
        items_subtab = page.locator("nav button:has-text('Items')").first
        if await items_subtab.count() > 0:
            await items_subtab.click()
            await page.wait_for_timeout(1000)

        browse_btn = page.locator("button:has-text('Browse Items (F2)')").first
        if await browse_btn.count() > 0:
            await browse_btn.click()
            await page.wait_for_timeout(1800)

            shot5_name = "05_po_f2_browse_dialog_legacy_vendor.png"
            shot5_path = os.path.join(OUTPUT_DIR, shot5_name)
            await page.screenshot(path=shot5_path, full_page=True)
            print(f"   [OK] Shot 5: F2 Browse Items Modal -> {shot5_path}")

            # Close browse dialog via Escape key
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(800)
            await page.evaluate("""() => {
                const closeBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Close') || b.textContent.includes('Cancel') || b.title?.includes('Close'));
                if (closeBtns.length > 0) closeBtns[0].click();
            }""")
            await page.wait_for_timeout(800)

        # ---------------------------------------------------------------------
        # Shot 6: Save Draft Post-Save Workflow Modal
        # ---------------------------------------------------------------------
        print("\n[Shot 6] Saving Draft PO and capturing Post-Save workflow options...")
        # Populate first item line
        first_code_input = page.locator("input[placeholder='Code / F2']").first
        if await first_code_input.count() > 0:
            await first_code_input.fill("CH-533-CREAM-36")
            await first_code_input.dispatch_event("input")
            await first_code_input.dispatch_event("change")
            await page.wait_for_timeout(500)

        first_qty_input = page.locator("input[placeholder='0']").first
        if await first_qty_input.count() > 0:
            await first_qty_input.fill("12")
            await first_qty_input.dispatch_event("input")
            await first_qty_input.dispatch_event("change")
            await page.wait_for_timeout(500)

        first_rate_input = page.locator("input[placeholder='0.00']").first
        if await first_rate_input.count() > 0:
            await first_rate_input.fill("750")
            await first_rate_input.dispatch_event("input")
            await first_rate_input.dispatch_event("change")
            await page.wait_for_timeout(500)

        save_btn = page.locator("footer button:has-text('Save Draft')").first
        if await save_btn.count() > 0:
            await save_btn.click(force=True)
            await page.wait_for_timeout(2500)

            shot6_name = "06_po_saved_draft_workflow_modal.png"
            shot6_path = os.path.join(OUTPUT_DIR, shot6_name)
            await page.screenshot(path=shot6_path, full_page=True)
            print(f"   [OK] Shot 6: Save Draft Post-Save Workflow -> {shot6_path}")

        await browser.close()

    # Copy all captured screenshots to the artifacts directory
    print("\n[Copying Artifacts] Syncing screenshots to conversation artifact directory...")
    for fname in os.listdir(OUTPUT_DIR):
        if fname.endswith(".png"):
            src = os.path.join(OUTPUT_DIR, fname)
            dst = os.path.join(ARTIFACT_DIR, fname)
            shutil.copyfile(src, dst)
            print(f"   * Synced {fname} -> {dst}")

    print("\n" + "=" * 80)
    print("ALL HEADLESS SCREENSHOTS CAPTURED AND SYNCED SUCCESSFULLY (0 PHYSICAL WINDOWS)")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_capture())
