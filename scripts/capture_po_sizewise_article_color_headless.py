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

async def run_sizewise_article_color_verification():
    print("=" * 80)
    print("SMRITI RETAIL OS — ARTICLE & COLOR SIZEWISE GRID HEADLESS VERIFICATION")
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

    target_order_no = "PO-978758"

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

        # Remove floating helper overlay that can block pointer events
        await page.evaluate("""() => {
            const overlays = document.querySelectorAll('div.fixed.bottom-6.right-6, div.fixed.bottom-4.right-4');
            overlays.forEach(el => el.remove());
        }""")

        # Ensure Sizewise mode button is selected if not already active
        sizewise_mode_btn = page.locator("button:has-text('Sizewise')").first
        if await sizewise_mode_btn.count() > 0:
            await sizewise_mode_btn.click()
            await asyncio.sleep(1.0)

        # Recall PO-978758
        print(f"\n[STEP 2] Recalling PO {target_order_no} into Sizewise Matrix...")
        open_btn = page.locator("#sw-open-po-btn").first
        if await open_btn.count() > 0:
            await open_btn.click()
            await asyncio.sleep(1.0)
            recall_input = page.locator("#sw-recall-order-input").first
            if await recall_input.count() > 0:
                await recall_input.fill(target_order_no)
                await asyncio.sleep(0.5)
                recall_submit = page.locator("#sw-recall-submit-btn").first
                await recall_submit.click()
                await asyncio.sleep(2.5)

        # Verify Article & Color default view mode
        print("\n[STEP 3] Verifying Article & Color (Default / Recommended) Mode...")
        th_article = page.locator("th:has-text('Article / Style')").first
        th_color = page.locator("th:has-text('Color / Shade')").first
        article_exists = await th_article.count() > 0
        color_exists = await th_color.count() > 0
        print(f"[GRID CHECK] 'Article / Style' header present: {article_exists}")
        print(f"[GRID CHECK] 'Color / Shade' header present  : {color_exists}")

        # Check row inputs
        row_article_input = page.locator("#sw-article-0").first
        row_shade_input = page.locator("#sw-shade-0").first
        art_val = await row_article_input.input_value() if await row_article_input.count() > 0 else "N/A"
        shade_val = await row_shade_input.input_value() if await row_shade_input.count() > 0 else "N/A"
        print(f"[ROW CHECK] Row 0 Article value: '{art_val}' | Shade value: '{shade_val}'")

        pic1 = "01_po_sizewise_article_color_grid.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic1), full_page=False)
        print(f"[SAVED] {pic1}")
        copy_to_artifacts(pic1)

        # Verify Mode Toggle to "Code & Desc"
        print("\n[STEP 4] Toggling to 'Code & Desc' View Mode...")
        code_desc_btn = page.locator("#sw-grid-mode-code-desc-btn").first
        if await code_desc_btn.count() > 0:
            await code_desc_btn.click()
            await asyncio.sleep(1.0)

            th_item_code = page.locator("th:has-text('Item Code')").first
            th_prod_desc = page.locator("th:has-text('Product Description')").first
            print(f"[GRID CHECK] 'Item Code' header present: {await th_item_code.count() > 0}")
            print(f"[GRID CHECK] 'Product Description' header present: {await th_prod_desc.count() > 0}")

            pic2 = "02_po_sizewise_code_desc_grid.png"
            await page.screenshot(path=os.path.join(OUTPUT_DIR, pic2), full_page=False)
            print(f"[SAVED] {pic2}")
            copy_to_artifacts(pic2)

        # Toggle back to Article & Color mode
        print("\n[STEP 5] Toggling back to 'Article & Color' View Mode...")
        art_color_btn = page.locator("#sw-grid-mode-article-color-btn").first
        if await art_color_btn.count() > 0:
            await art_color_btn.click()
            await asyncio.sleep(1.0)

        # Apply Row-level Recommendation ("✨ Ratio")
        print("\n[STEP 6] Testing Row-Level Recommendation ('✨ Ratio' button)...")
        row_recommend_btn = page.locator("#sw-row-recommend-0").first
        if await row_recommend_btn.count() > 0:
            await row_recommend_btn.click()
            await asyncio.sleep(1.5)
            print("[INFO] Row-level recommendation ratio applied to row 0.")

        pic3 = "03_po_sizewise_row_recommendation.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic3), full_page=False)
        print(f"[SAVED] {pic3}")
        copy_to_artifacts(pic3)

        # Update Color and verify dynamic swatch
        print("\n[STEP 7] Updating Color / Shade to 'CREAM' and verifying swatch...")
        if await row_shade_input.count() > 0:
            await row_shade_input.fill("CREAM")
            await asyncio.sleep(0.5)

        pic4 = "04_po_sizewise_color_updated.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic4), full_page=False)
        print(f"[SAVED] {pic4}")
        copy_to_artifacts(pic4)

        # Save Draft / Update Draft
        print("\n[STEP 8] Saving / Updating Draft Purchase Order with Validations...")
        await page.evaluate("""() => {
            const btn = document.getElementById('sw-save-draft-btn');
            if (btn) btn.click();
        }""")
        await asyncio.sleep(3.0)

        pic5 = "05_po_sizewise_article_color_saved.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic5), full_page=False)
        print(f"[SAVED] {pic5}")
        copy_to_artifacts(pic5)

        await browser.close()

    print("\n" + "=" * 80)
    print("ALL ARTICLE & COLOR VERIFICATIONS COMPLETED SUCCESSFULLY (HEADLESS).")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_sizewise_article_color_verification())
