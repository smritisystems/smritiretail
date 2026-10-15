"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.82.0
Created      : 2026-10-15
Modified     : 2026-10-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Visual Verification & Automated UI Evidence Capture
"""

import os
import shutil
import urllib.request
import json
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\ca00eec5-dbd5-47dd-b923-f72a7899a93c"
EVIDENCE_DIR = r"F:\SMRITRretailNX\docs\walkthrough\inventory\evidence"

def get_auth_token():
    url = "http://127.0.0.1:1981/api/v1/auth/login"
    payload = json.dumps({"username": "admin", "password": "Admin@123"}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["access_token"]

def main():
    print("1. Authenticating via API...", flush=True)
    token = get_auth_token()
    print("   Token acquired, length:", len(token), flush=True)

    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    with sync_playwright() as p:
        print("2. Launching headless Chromium...", flush=True)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.5,
        )

        page = context.new_page()

        # Seed localStorage before navigating
        print("3. Pre-populating authenticated session into localStorage...", flush=True)
        page.goto("http://localhost:3000/")
        page.evaluate(f"""() => {{
            localStorage.setItem("smriti_jwt_token", "{token}");
            localStorage.setItem("smriti_user", JSON.stringify({{
                id: "usr-admin",
                username: "admin",
                role: "SYSADMIN",
                companyId: "COMP-001",
                branchId: "BR-MAIN-001"
            }}));
            localStorage.setItem("smriti_company_id", "COMP-001");
            localStorage.setItem("smriti_company_code", "001");
            localStorage.setItem("smriti_branch_id", "BR-MAIN-001");
            localStorage.setItem("smriti_branch_code", "MAIN");
            localStorage.setItem("smriti_company_name", "SMRITI Retail Enterprise");
            localStorage.setItem("smriti_branch_name", "Main Branch");
            localStorage.setItem("smriti_setup_completed", "true");
            localStorage.setItem("smriti_user_role", "SYSADMIN");
            localStorage.setItem("smriti_user_name", "Chief Administrator");
        }}""")

        # Navigate to item-master tab
        print("4. Navigating to Item Master tab (http://localhost:3000/?tab=item-master)...", flush=True)
        page.goto("http://localhost:3000/?tab=item-master")
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # Search for MISTAKE-SKU-99
        print("5. Searching for un-transacted variant: MISTAKE-SKU-99...", flush=True)
        search_input = page.locator("input[placeholder*='Search SKU']").first
        search_input.wait_for(state="visible", timeout=15000)
        search_input.fill("MISTAKE-SKU-99")
        time.sleep(2)

        # Click on the SKU button to open VariantEditModal
        print("6. Opening VariantEditModal for MISTAKE-SKU-99...", flush=True)
        sku_btn = page.locator("button:has-text('MISTAKE-SKU-99')").first
        sku_btn.wait_for(state="visible", timeout=10000)
        sku_btn.click()

        # Wait for modal and deletion status badge to settle
        print("7. Waiting for deletion status pre-flight check in modal...", flush=True)
        page.wait_for_selector("text=0 Transactions", timeout=15000)
        time.sleep(1.5)

        # Screenshot 1: Un-transacted variant edit modal
        img1_evidence = os.path.join(EVIDENCE_DIR, "01_untransacted_variant_edit_modal.png")
        img1_artifact = os.path.join(ARTIFACT_DIR, "01_untransacted_variant_edit_modal.png")
        page.screenshot(path=img1_evidence)
        shutil.copy2(img1_evidence, img1_artifact)
        print("   [OK] Captured Screenshot 1:", img1_evidence, flush=True)

        # Click "Delete Permanently" button
        print("8. Triggering 'Delete Permanently' confirmation dialog...", flush=True)
        del_btn = page.locator("button:has-text('Delete Permanently')").first
        del_btn.click()

        # Wait for the confirmation dialog
        page.wait_for_selector("text=Permanently Delete Variant?", timeout=10000)
        time.sleep(1.5)

        # Screenshot 2: Guarded hard delete confirmation dialog
        img2_evidence = os.path.join(EVIDENCE_DIR, "02_guard_delete_confirmation_modal.png")
        img2_artifact = os.path.join(ARTIFACT_DIR, "02_guard_delete_confirmation_modal.png")
        page.screenshot(path=img2_evidence)
        shutil.copy2(img2_evidence, img2_artifact)
        print("   [OK] Captured Screenshot 2:", img2_evidence, flush=True)

        # Dismiss confirmation modal by clicking Cancel
        print("9. Dismissing delete confirmation dialog...", flush=True)
        cancel_del_btn = page.locator("button:has-text('Cancel')").last
        cancel_del_btn.click()
        time.sleep(1)

        # Close VariantEditModal
        print("10. Closing VariantEditModal...", flush=True)
        cancel_modal_btn = page.locator("button:has-text('Cancel')").last
        cancel_modal_btn.click()
        time.sleep(1.5)

        # Search for LOCKED-SKU-01
        print("11. Searching for transacted variant: LOCKED-SKU-01...", flush=True)
        search_input.fill("")
        time.sleep(0.5)
        search_input.fill("LOCKED-SKU-01")
        time.sleep(2)

        # Click on LOCKED-SKU-01
        print("12. Opening VariantEditModal for LOCKED-SKU-01...", flush=True)
        locked_btn = page.locator("button:has-text('LOCKED-SKU-01')").first
        locked_btn.wait_for(state="visible", timeout=10000)
        locked_btn.click()

        # Wait for locked state indicator
        print("13. Waiting for deletion status pre-flight check on transacted variant...", flush=True)
        page.wait_for_selector("text=Transacted", timeout=15000)
        time.sleep(1.5)

        # Screenshot 3: Transacted variant locked state
        img3_evidence = os.path.join(EVIDENCE_DIR, "03_transacted_variant_locked_modal.png")
        img3_artifact = os.path.join(ARTIFACT_DIR, "03_transacted_variant_locked_modal.png")
        page.screenshot(path=img3_evidence)
        shutil.copy2(img3_evidence, img3_artifact)
        print("   [OK] Captured Screenshot 3:", img3_evidence, flush=True)

        browser.close()
        print("\nAll 3 visual evidence screenshots successfully captured and saved!", flush=True)

if __name__ == "__main__":
    main()
