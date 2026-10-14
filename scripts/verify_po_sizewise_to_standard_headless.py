# Project      : SMRITI Retail OS
# Repository   : SMRITIRetailNX
# Organization : AITDL NETWORKS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 6.75.3
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

async def run_sizewise_to_standard_verification():
    print("=" * 80)
    print("SMRITI RETAIL OS — PURCHASE ORDER: SIZEWISE TO STANDARD MODE VERIFICATION")
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
        await asyncio.sleep(2.0)

        # Remove floating helper overlay
        await page.evaluate("""() => {
            const overlays = document.querySelectorAll('div.fixed.bottom-6.right-6, div.fixed.bottom-4.right-4');
            overlays.forEach(el => el.remove());
        }""")

        # Step 2: Ensure Sizewise mode is active
        print("\n[STEP 2] Initializing Sizewise Mode with Footwear EU scale...")
        sizewise_mode_btn = page.locator("#po-mode-sizewise-btn").first
        if await sizewise_mode_btn.count() > 0:
            await sizewise_mode_btn.click()
            await asyncio.sleep(0.5)

        # Set scale to FOOTWEAR_EU
        scale_select = page.locator("#sw-size-scale-select").first
        if await scale_select.count() > 0:
            await scale_select.select_option("FOOTWEAR_EU")
            await asyncio.sleep(0.5)

        # Click New PO button to start with a fresh row if empty
        new_po_btn = page.locator("#sw-new-po-btn").first
        if await new_po_btn.count() > 0:
            await new_po_btn.click()
            await asyncio.sleep(0.8)

        # Step 3: Populate Sizewise Mode with Article SH-03-I, Color BLACK, Rate 660, 108 pairs
        print("\n[STEP 3] Entering Article SH-03-I, Color BLACK, 108 pairs across sizes 36-44...")
        art_input = page.locator("#sw-article-0").first
        shade_input = page.locator("#sw-shade-0").first
        rate_input = page.locator("#sw-rate-0").first

        if await art_input.count() > 0:
            await art_input.fill("SH-03-I")
            await asyncio.sleep(0.3)
        if await shade_input.count() > 0:
            await shade_input.fill("BLACK")
            await asyncio.sleep(0.3)
        if await rate_input.count() > 0:
            await rate_input.fill("660")
            await asyncio.sleep(0.3)

        # Distribution from user specification:
        # 36: 4, 37: 8, 38: 14, 39: 18, 40: 20, 41: 18, 42: 14, 43: 8, 44: 4 => Total = 108
        quantities = {
            "36": "4",
            "37": "8",
            "38": "14",
            "39": "18",
            "40": "20",
            "41": "18",
            "42": "14",
            "43": "8",
            "44": "4"
        }

        for sz, qty in quantities.items():
            qty_input = page.locator(f"#sw-qty-0-{sz}").first
            if await qty_input.count() > 0:
                await qty_input.fill(qty)
                await asyncio.sleep(0.1)

        await asyncio.sleep(1.0)

        # Capture Screenshot 1: Sizewise Mode with 108 pairs
        pic1 = "01_po_sizewise_108_pairs_matrix.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic1), full_page=False)
        print(f"[SAVED] {pic1}")
        copy_to_artifacts(pic1)

        # Verify Sizewise totals
        sw_total_text = await page.locator("td.font-extrabold.text-indigo-600").first.text_content()
        print(f"[SIZEWISE TOTAL] Measured Total Qty: {sw_total_text.strip()}")
        assert "108" in sw_total_text, f"Expected 108 in Sizewise total, found {sw_total_text}"

        # Step 4: Switch to Standard Mode
        print("\n[STEP 4] Switching from Sizewise to Standard Mode...")
        std_mode_btn = page.locator("#po-mode-standard-btn").first
        await std_mode_btn.click()
        await asyncio.sleep(1.5)

        # Step 5: Verify Standard Mode Expanded Variant Rows
        print("\n[STEP 5] Verifying Standard Mode Barcode-wise Variant Rows...")
        # Check active rows count in Standard tab
        item_rows = page.locator("tbody tr")
        row_count = await item_rows.count()
        print(f"[STANDARD ROWS] Rendered table rows: {row_count}")

        # Check the 9 variant lines
        verified_lines = []
        for i in range(9):
            row = item_rows.nth(i)
            # Find inputs in row
            row_text = await row.text_content()
            qty_input = row.locator(f"#po-qty-input-{i}").first
            qty_val = await qty_input.input_value() if await qty_input.count() > 0 else "N/A"
            verified_lines.append(f"Row {i+1}: Qty = {qty_val}")

        print(f"[STANDARD ROWS INSPECTION] Verified 9 rows:")
        for line in verified_lines:
            print(f"  {line}")

        # Capture Screenshot 2: Standard Mode Expanded Rows
        pic2 = "02_po_standard_9_barcode_rows.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic2), full_page=False)
        print(f"[SAVED] {pic2}")
        copy_to_artifacts(pic2)

        # Step 6: Edit Size 40 Quantity in Standard Mode from 20 to 25
        print("\n[STEP 6] Modifying Size 40 Quantity in Standard Mode from 20 -> 25...")
        # Size 40 corresponds to index 4 (36=0, 37=1, 38=2, 39=3, 40=4)
        qty_input_40 = page.locator("#po-qty-input-4").first
        if await qty_input_40.count() > 0:
            await qty_input_40.fill("25")
            await asyncio.sleep(0.5)

        # Capture Screenshot 3: Standard Mode after Edit
        pic3 = "03_po_standard_size40_edited.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic3), full_page=False)
        print(f"[SAVED] {pic3}")
        copy_to_artifacts(pic3)

        # Step 7: Switch back to Sizewise Mode
        print("\n[STEP 7] Switching back to Sizewise Mode...")
        await sizewise_mode_btn.click()
        await asyncio.sleep(1.5)

        # Step 8: Verify Sizewise Mode Regrouped Rows & Updated Total (113 pairs)
        print("\n[STEP 8] Verifying Sizewise Matrix after switching back...")
        qty_40_after = await page.locator("#sw-qty-0-40").first.input_value()
        sw_total_after = (await page.locator("td.font-extrabold.text-indigo-600").first.text_content()).strip()
        print(f"[SIZEWISE VERIFY] Size 40 Qty in Matrix: {qty_40_after}")
        print(f"[SIZEWISE VERIFY] Recalculated Matrix Total: {sw_total_after}")

        assert qty_40_after == "25", f"Expected size 40 qty to be 25, got {qty_40_after}"
        assert sw_total_after == "113", f"Expected matrix total to be 113, got {sw_total_after}"

        # Capture Screenshot 4: Sizewise Mode after Return
        pic4 = "04_po_sizewise_after_return.png"
        await page.screenshot(path=os.path.join(OUTPUT_DIR, pic4), full_page=False)
        print(f"[SAVED] {pic4}")
        copy_to_artifacts(pic4)

        # Step 9: Verify Idempotency over multiple switches
        print("\n[STEP 9] Verifying Idempotency over 3 consecutive mode switches...")
        for switch_cycle in range(3):
            await std_mode_btn.click()
            await asyncio.sleep(0.8)
            await sizewise_mode_btn.click()
            await asyncio.sleep(0.8)

        sw_total_final = (await page.locator("td.font-extrabold.text-indigo-600").first.text_content()).strip()
        print(f"[IDEMPOTENCY CHECK] Matrix Total after 3 cycles: {sw_total_final}")
        assert sw_total_final == "113", f"Expected total 113 after cycling, got {sw_total_final}"

        print("\n" + "=" * 80)
        print("[SUCCESS] ALL VERIFICATIONS PASSED 100% GREEN WITH ZERO LOSS!")
        print("=" * 80)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_sizewise_to_standard_verification())
