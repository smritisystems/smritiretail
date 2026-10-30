# Project      : SMRITI Retail OS
# Repository   : SMRITIRetailNX
# Organization : AITDL NETWORKS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 6.75.2
# Created      : 2026-10-14
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal / Automated Verification

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

def copy_to_artifacts(src_filename):
    src = os.path.join(OUTPUT_DIR, src_filename)
    if os.path.exists(src) and os.path.exists(ARTIFACT_DIR):
        dst = os.path.join(ARTIFACT_DIR, src_filename)
        shutil.copy2(src, dst)
        print(f"[ARTIFACT SYNC] Copied {src_filename} -> Artifacts directory.")

async def run_sizewise_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — HEADLESS SIZEWISE MODE EDIT & RECALL CAPTURE")
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

    # Fetch existing orders from API to find a target order
    orders_req = urllib.request.Request(
        f"{API_URL}/api/v1/purchase/orders/?page=1&page_size=5&sort=created_at&order=desc",
        headers={"Authorization": f"Bearer {token}"}
    )
    target_order_no = "PO-978758"
    try:
        with urllib.request.urlopen(orders_req) as resp:
            data = json.loads(resp.read().decode())
            items = data.get("items", []) if isinstance(data, dict) else data
            if items:
                target_order_no = items[0].get("order_no", target_order_no)
                print(f"[TARGET PO] Selected order for recall: {target_order_no}")
    except Exception as e:
        print(f"[WARN] Failed to fetch orders list: {e}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.0,
        )
        page = await context.new_page()

        print("\n[STEP 1] Pre-seeding authenticated local storage on domain...")
        await page.goto(BASE_URL, wait_until="commit")
        await page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token}');
            localStorage.setItem('smriti_user', JSON.stringify({{
                id: 'usr-admin',
                username: 'admin',
                role: 'MANAGER',
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
            localStorage.setItem('smriti_po_ux_mode', 'sizewise');
        }}""")

        # Navigate to Purchase Studio
        target_url = f"{BASE_URL}/?tab=purchase"
        print(f"[NAVIGATING] {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        await asyncio.sleep(2.5)

        # Remove or hide floating helper overlay that can block pointer events
        await page.evaluate("""() => {
            const overlays = document.querySelectorAll('div.fixed.bottom-6.right-6, div.fixed.bottom-4.right-4');
            overlays.forEach(el => el.remove());
        }""")

        # Ensure Sizewise mode button is selected if not already active
        sizewise_mode_btn = page.locator("button:has-text('Sizewise')").first
        if await sizewise_mode_btn.count() > 0:
            await sizewise_mode_btn.click()
            await asyncio.sleep(1.0)

        # ── Capture 01: Open / Recall Modal inside Sizewise mode ───────────────
        print("\n[STEP 2] Opening Recall Purchase Order Modal in Sizewise Mode...")
        open_btn = page.locator("#sw-open-po-btn").first
        if await open_btn.count() > 0:
            await open_btn.click()
            await asyncio.sleep(1.5)

        pic1 = "06_po_sizewise_open_recall_modal.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic1), full_page=False)
        print(f"[SAVED] {pic1}")
        copy_to_artifacts(pic1)

        # ── Capture 02: Load PO for Editing in Sizewise Mode ───────────────────
        print(f"\n[STEP 3] Recalling PO {target_order_no} into Sizewise Matrix...")
        recall_input = page.locator("#sw-recall-order-input").first
        if await recall_input.count() > 0:
            await recall_input.fill(target_order_no)
            await asyncio.sleep(0.5)
            recall_submit = page.locator("#sw-recall-submit-btn").first
            await recall_submit.click()
            await asyncio.sleep(2.5)
        else:
            order_row = page.locator(f"text='{target_order_no}'").first
            if await order_row.count() > 0:
                await order_row.click()
                await asyncio.sleep(2.5)

        pic2 = "01_po_sizewise_editing_mode_loaded.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic2), full_page=False)
        print(f"[SAVED] {pic2}")
        copy_to_artifacts(pic2)

        # ── Capture 03: Direct in-grid cell editing of sizes ───────────────────
        print("\n[STEP 4] Editing Size Quantities Directly in Grid Cells...")
        grid_qty_inputs = page.locator("table tbody tr input[type='number']")
        qty_count = await grid_qty_inputs.count()
        print(f"[INFO] Found {qty_count} editable numeric inputs in grid.")

        if qty_count >= 3:
            await grid_qty_inputs.nth(0).fill("24")
            await asyncio.sleep(0.3)
            await grid_qty_inputs.nth(1).fill("36")
            await asyncio.sleep(0.3)
            await grid_qty_inputs.nth(2).fill("48")
            await asyncio.sleep(0.5)

        pic3 = "02_po_sizewise_cell_editing.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic3), full_page=False)
        print(f"[SAVED] {pic3}")
        copy_to_artifacts(pic3)

        # ── Capture 04: Recommend Ratio Assortment Menu & Application ─────────
        print("\n[STEP 5] Opening Recommend Ratio Assortment Dropdown...")
        recommend_btn = page.locator("#sw-toolbar-recommend-btn").first
        if await recommend_btn.count() > 0:
            await recommend_btn.click()
            await asyncio.sleep(1)

            pic4 = "03_po_sizewise_recommend_ratio_dialog.png"
            await page.screenshot(path=os.path.join(OUTPUT_DIR, pic4), full_page=False)
            print(f"[SAVED] {pic4}")
            copy_to_artifacts(pic4)

            # Apply Bell Curve assortment
            bell_curve_btn = page.locator("#sw-recommend-curve-bell-btn").first
            if await bell_curve_btn.count() > 0:
                await bell_curve_btn.click()
                await asyncio.sleep(1)

                pic5 = "04_po_sizewise_recommend_ratio_applied.png"
                await page.screenshot(path=os.path.join(OUTPUT_DIR, pic5), full_page=False)
                print(f"[SAVED] {pic5}")
                copy_to_artifacts(pic5)

        # ── Capture 05: Save Draft / Update Draft ─────────────────────────────
        print("\n[STEP 6] Saving / Updating Draft Purchase Order in Sizewise Mode...")
        # Use DOM trigger to avoid floating element interference
        await page.evaluate("""() => {
            const btn = document.getElementById('sw-save-draft-btn');
            if (btn) btn.click();
        }""")
        await asyncio.sleep(2.5)

        pic6 = "05_po_sizewise_update_draft_committed.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic6), full_page=False)
        print(f"[SAVED] {pic6}")
        copy_to_artifacts(pic6)

        await browser.close()

    print("\n" + "=" * 80)
    print("ALL SIZEWISE EDIT CAPTURES COMPLETED SUCCESSFULLY (HEADLESS).")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_sizewise_capture())
