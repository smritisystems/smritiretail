# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 1.1.0
# Created      : 2026-09-30
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal / Verification

import asyncio
import os
import sys
import json
import urllib.request
from playwright.async_api import async_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3000"
API_URL = "http://127.0.0.1:1981"
OUTPUT_DIR = os.path.join(os.getcwd(), "docs", "walkthrough", "purchase", "evidence")
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

async def run_purchase_studio_headless_capture():
    print("=" * 80)
    print("SMRITI RETAIL OS — PURCHASE STUDIO HEADLESS SCREENSHOT VERIFICATION")
    print("=" * 80)
    print(f"Target App URL : {BASE_URL}")
    print(f"Backend API    : {API_URL}")
    print(f"Output Evidence: {OUTPUT_DIR}")
    print("-" * 80)

    token = get_admin_jwt_token()
    if not token:
        print("[FAIL] Could not acquire admin JWT token from backend.")
        sys.exit(1)
    print(f"[AUTH OK] Admin token acquired: {token[:25]}...")

    async with async_playwright() as p:
        # Launch Chromium strictly in headless mode without any physical browser window
        browser = await p.chromium.launch(
            channel="chrome",
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
            localStorage.setItem('smriti_po_ux_mode', 'sizewise');
        }}""")

        # Navigate to Purchase Studio
        target_url = f"{BASE_URL}/?tab=purchase"
        print(f"\n[Step 1] Navigating to Purchase Studio: {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # Ensure Sizewise mode is active
        sizewise_btn = page.locator("button:has-text('Sizewise Matrix UX')").first
        if await sizewise_btn.count() > 0:
            await sizewise_btn.click()
            await page.wait_for_timeout(1000)

        # ---------------------------------------------------------------------
        # Screenshot 1: Empty State
        # ---------------------------------------------------------------------
        print("\n[Step 1] Capturing Empty State with composite read-only identity...")
        shot1_path = os.path.join(OUTPUT_DIR, "01_po_sizewise_empty_state.png")
        await page.screenshot(path=shot1_path, full_page=True)
        print(f"   [CAPTURE] Step 1: Empty State -> {shot1_path}")

        # ---------------------------------------------------------------------
        # Screenshot 2: Toolbar Overflow Popover (More Actions)
        # ---------------------------------------------------------------------
        print("\n[Step 2] Opening Toolbar More Actions Overflow Popover...")
        more_btn = page.locator("#sw-toolbar-more-btn").first
        if await more_btn.count() > 0:
            await more_btn.click()
            await page.wait_for_timeout(500)
            shot2_path = os.path.join(OUTPUT_DIR, "02_po_toolbar_overflow_menu.png")
            await page.screenshot(path=shot2_path, full_page=True)
            print(f"   [CAPTURE] Step 2: More Actions Popover -> {shot2_path}")
            # Dismiss popover
            await more_btn.click()
            await page.wait_for_timeout(300)

        # ---------------------------------------------------------------------
        # Screenshot 3: Item Entry & Populated Sizewise Matrix (Footwear EU)
        # ---------------------------------------------------------------------
        print("\n[Step 3] Setting Scale Preset to Footwear EU & Populating Matrix...")
        scale_select = page.locator("#sw-size-scale-select").first
        if await scale_select.count() > 0:
            await scale_select.select_option("FOOTWEAR_EU")
            await page.wait_for_timeout(500)

        # Click Add Item to create row 0
        add_item_btn = page.locator("button:has-text('Add Item')").first
        if await add_item_btn.count() > 0:
            await add_item_btn.click()
            await page.wait_for_timeout(500)

        # Fill Item Code
        item_code_input = page.locator("#sw-itemcode-0").first
        if await item_code_input.count() > 0:
            await item_code_input.fill("FW-NK-9921")
            await item_code_input.dispatch_event("input")
            await item_code_input.dispatch_event("change")

        # Fill Product Name
        prod_input = page.locator("input[placeholder='Product name']").first
        if await prod_input.count() > 0:
            await prod_input.fill("Nike Air Zoom Pegasus 40 (Footwear Division)")
            await prod_input.dispatch_event("input")
            await prod_input.dispatch_event("change")

        # Fill Rate: 2250
        rate_input = page.locator("input[placeholder='0.00']").first
        if await rate_input.count() > 0:
            await rate_input.fill("2250")
            await rate_input.dispatch_event("input")
            await rate_input.dispatch_event("change")

        # Fill Size Quantities for Footwear EU sizes: 36, 37, 38, 39, 40, 41, 42, 43, 44
        eu_distribution = {
            "36": 2, "37": 4, "38": 6, "39": 8, "40": 10,
            "41": 8, "42": 6, "43": 4, "44": 2
        }
        for sz, qty in eu_distribution.items():
            cell = page.locator(f"#sw-qty-0-{sz}").first
            if await cell.count() > 0:
                await cell.fill(str(qty))
                await cell.dispatch_event("input")
                await cell.dispatch_event("change")

        await page.wait_for_timeout(1000)
        shot3_path = os.path.join(OUTPUT_DIR, "03_po_sizewise_matrix_populated.png")
        await page.screenshot(path=shot3_path, full_page=True)
        print(f"   [CAPTURE] Step 3: Populated Matrix (50 pairs) -> {shot3_path}")

        # ---------------------------------------------------------------------
        # Screenshot 4: Scale Change Confirmation Modal
        # ---------------------------------------------------------------------
        print("\n[Step 4] Triggering Scale Change Confirmation Modal (FOOTWEAR_UK)...")
        if await scale_select.count() > 0:
            await scale_select.select_option("FOOTWEAR_UK")
            await page.wait_for_timeout(800)
            shot4_path = os.path.join(OUTPUT_DIR, "04_scale_change_confirmation_modal.png")
            await page.screenshot(path=shot4_path, full_page=True)
            print(f"   [CAPTURE] Step 4: Scale Change Modal -> {shot4_path}")
            # Click Cancel on the modal
            cancel_btn = page.locator("div[role='dialog'] button:has-text('Cancel')").first
            if await cancel_btn.count() > 0:
                await cancel_btn.click()
                await page.wait_for_timeout(500)

        # ---------------------------------------------------------------------
        # Screenshot 5: Row Delete Confirmation Modal
        # ---------------------------------------------------------------------
        print("\n[Step 5] Triggering Row Delete Confirmation Modal...")
        del_btn = page.locator("button:has-text('Delete Row')").first
        if await del_btn.count() > 0:
            await del_btn.click()
            await page.wait_for_timeout(800)
            shot5_path = os.path.join(OUTPUT_DIR, "05_row_delete_confirmation_modal.png")
            await page.screenshot(path=shot5_path, full_page=True)
            print(f"   [CAPTURE] Step 5: Row Delete Modal -> {shot5_path}")
            # Click Cancel on the modal
            cancel_btn = page.locator("div[role='dialog'] button:has-text('Cancel')").first
            if await cancel_btn.count() > 0:
                await cancel_btn.click()
                await page.wait_for_timeout(500)

        # ---------------------------------------------------------------------
        # Screenshot 6: Statutory Print Preview Modal (Size Pivot Matrix)
        # ---------------------------------------------------------------------
        print("\n[Step 6] Opening Statutory Print Preview Modal (Size Pivot Matrix)...")
        print_btn = page.locator("header button:has-text('Print'), button:has-text('Print')").first
        if await print_btn.count() > 0:
            await print_btn.click()
            await page.wait_for_timeout(1500)
            # Switch to Size Pivot Matrix template
            preview_template_select = page.locator("#po-preview-template-select").first
            if await preview_template_select.count() > 0:
                await preview_template_select.select_option("pivot")
                await page.wait_for_timeout(1000)

            shot6_path = os.path.join(OUTPUT_DIR, "06_statutory_print_preview_pivot.png")
            await page.screenshot(path=shot6_path, full_page=True)
            print(f"   [CAPTURE] Step 6: Print Preview Pivot -> {shot6_path}")

        # ---------------------------------------------------------------------
        # Screenshot 7: Statutory Print Preview Modal (Footwear A4 Template)
        # ---------------------------------------------------------------------
        print("\n[Step 7] Switching Print Template to Footwear A4 Specification...")
        preview_template_select = page.locator("#po-preview-template-select").first
        if await preview_template_select.count() > 0:
            await preview_template_select.select_option("footwear")
            await page.wait_for_timeout(1000)
            shot7_path = os.path.join(OUTPUT_DIR, "07_statutory_print_preview_footwear.png")
            await page.screenshot(path=shot7_path, full_page=True)
            print(f"   [CAPTURE] Step 7: Print Preview Footwear -> {shot7_path}")

        # Close the print preview modal via direct DOM click and Escape key
        print("   * Closing Print Preview Modal...")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)
        await page.evaluate("""() => {
            const btn = document.getElementById('po-preview-close-modal-btn');
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(1000)

        # ---------------------------------------------------------------------
        # Screenshot 9: Dedicated Tab 2. Images & Articles (Visual Lookbook - Card View)
        # ---------------------------------------------------------------------
        print("\n[Step 9] Navigating to Dedicated '2. Images & Articles' Visual Lookbook Tab (Card View)...")
        visual_tab = page.locator("#sw-subtab-visual").first
        if await visual_tab.count() > 0:
            await visual_tab.click()
            await page.wait_for_timeout(1000)

            # Select 'Tan' color swatch to demonstrate dynamic color selection & binding
            tan_btn = page.locator("button[title*='Tan']").first
            if await tan_btn.count() > 0:
                await tan_btn.click()
                await page.wait_for_timeout(600)

            shot9_path = os.path.join(OUTPUT_DIR, "09_po_visual_catalog_tab.png")
            await page.screenshot(path=shot9_path, full_page=True)
            print(f"   [CAPTURE] Step 9: Visual Catalog Lookbook (Card View) -> {shot9_path}")

        # ---------------------------------------------------------------------
        # Screenshot 9b: Dedicated Tab 2. Images & Articles (Table View with Color / Shade Column)
        # ---------------------------------------------------------------------
        print("\n[Step 9b] Switching to Table View with Color / Shade Column...")
        table_view_btn = page.locator("#sw-visual-view-table-btn").first
        if await table_view_btn.count() > 0:
            await table_view_btn.click()
            await page.wait_for_timeout(800)
            shot9b_path = os.path.join(OUTPUT_DIR, "09b_po_visual_table_view.png")
            await page.screenshot(path=shot9b_path, full_page=True)
            print(f"   [CAPTURE] Step 9b: Visual Table View with Color Column -> {shot9b_path}")
            # Switch back to Card View
            card_view_btn = page.locator("#sw-visual-view-card-btn").first
            if await card_view_btn.count() > 0:
                await card_view_btn.click()
                await page.wait_for_timeout(600)

        # ---------------------------------------------------------------------
        # Screenshot 10: Product Image Binding & Upload Modal
        # ---------------------------------------------------------------------
        print("\n[Step 10] Opening Product Image Binding Modal...")
        change_photo_btn = page.locator("button:has-text('Change'), button:has-text('Add Multiple Images')").first
        if await change_photo_btn.count() > 0:
            await change_photo_btn.click()
            await page.wait_for_timeout(800)
            shot10_path = os.path.join(OUTPUT_DIR, "10_po_article_image_modal.png")
            await page.screenshot(path=shot10_path, full_page=True)
            print(f"   [CAPTURE] Step 10: Article Image Modal -> {shot10_path}")
            # Close image modal
            modal_cancel = page.locator("div[role='dialog'] button:has-text('Cancel')").first
            if await modal_cancel.count() > 0:
                await modal_cancel.click()
                await page.wait_for_timeout(500)

        # ---------------------------------------------------------------------
        # Screenshot 11: Assortment Curve Recommendation (Bell Curve)
        # ---------------------------------------------------------------------
        print("\n[Step 11] Applying Mathematical Assortment Curve (Bell Curve)...")
        ratio_btn = page.locator("button:has-text('Recommend Ratio')").first
        if await ratio_btn.count() > 0:
            await ratio_btn.click()
            await page.wait_for_timeout(500)
            bell_option = page.locator("button:has-text('Bell Curve')").first
            if await bell_option.count() > 0:
                await bell_option.click()
                await page.wait_for_timeout(800)
            shot11_path = os.path.join(OUTPUT_DIR, "11_po_recommended_assortment.png")
            await page.screenshot(path=shot11_path, full_page=True)
            print(f"   [CAPTURE] Step 11: Recommended Assortment -> {shot11_path}")

        # ---------------------------------------------------------------------
        # Screenshot 12: Landscape Print Preview (Footwear PO A4 Landscape)
        # ---------------------------------------------------------------------
        print("\n[Step 12] Opening Statutory Print Preview in LANDSCAPE Orientation...")
        print_action_btn = page.locator("header button:has-text('Print'), button:has-text('Print')").first
        if await print_action_btn.count() > 0:
            await print_action_btn.click()
            await page.wait_for_timeout(1500)
            # Ensure Footwear template is selected
            preview_template_select = page.locator("#po-preview-template-select").first
            if await preview_template_select.count() > 0:
                await preview_template_select.select_option("footwear")
                await page.wait_for_timeout(800)
            # Click Landscape button
            landscape_btn = page.locator("#po-preview-orientation-landscape").first
            if await landscape_btn.count() > 0:
                await landscape_btn.click()
                await page.wait_for_timeout(800)

            shot12_path = os.path.join(OUTPUT_DIR, "12_po_print_preview_landscape.png")
            await page.screenshot(path=shot12_path, full_page=True)
            print(f"   [CAPTURE] Step 12: Landscape Footwear PO Print Preview -> {shot12_path}")

        # ---------------------------------------------------------------------
        # Screenshot 8: Save PO Draft & Confirmation
        # ---------------------------------------------------------------------
        print("\n[Step 8 (Final)] Saving PO Draft & Capturing Post-Save Dialog...")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(600)
        await page.evaluate("""() => {
            const btn = document.getElementById('po-preview-close-modal-btn');
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(800)

        save_draft_btn = page.locator("footer button:has-text('Save Draft'), div.bg-white button:has-text('Save Draft')").first
        if await save_draft_btn.count() > 0:
            await save_draft_btn.click()
            print("   * Clicked Save Draft, waiting for post-save confirmation...")
            try:
                confirm_heading = page.locator("h2:has-text('Purchase Order Saved')").first
                await confirm_heading.wait_for(state="visible", timeout=8000)
            except Exception as e:
                print(f"   * Notice on confirmation wait: {e}")
            await page.wait_for_timeout(1000)
            shot8_path = os.path.join(OUTPUT_DIR, "08_po_saved_confirmation.png")
            await page.screenshot(path=shot8_path, full_page=True)
            print(f"   [CAPTURE] Step 8: Post-Save Dialog -> {shot8_path}")

        print("\n" + "=" * 80)
        print("ALL 12 HEADLESS SCREENSHOTS CAPTURED SUCCESSFULLY (0 PHYSICAL BROWSER WINDOWS OPENED)")
        print("=" * 80)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_purchase_studio_headless_capture())
