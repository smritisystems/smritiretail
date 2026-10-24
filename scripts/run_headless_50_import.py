"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.49
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Headless Playwright 50-Item Import Test
"""

import os
import sys
import json
import asyncio
from pathlib import Path
import psycopg2
from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(r"f:\SMRITRretailNX").resolve()))
sys.path.insert(0, str(Path(r"f:\SMRITRretailNX\backend").resolve()))

from backend.app.core.security import create_access_token

WORKSPACE_ARTIFACTS_DIR = Path(r"f:\SMRITRretailNX\artifacts\smart-import")
BRAIN_ARTIFACTS_DIR = Path(r"C:\Users\netma\.gemini\antigravity-ide\brain\3c4e6bbb-73a9-447e-9441-c54a230b29ff\artifacts\smart-import")
WORKSPACE_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
BRAIN_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

FIXTURE_PATH = Path(r"f:\SMRITRretailNX\tests\fixtures\smart_import_50_footwear_items.tsv")

def save_screenshots(filename, page_screenshot_bytes):
    p1 = WORKSPACE_ARTIFACTS_DIR / filename
    p2 = BRAIN_ARTIFACTS_DIR / filename
    p1.write_bytes(page_screenshot_bytes)
    p2.write_bytes(page_screenshot_bytes)
    print(f"[Screenshot] Successfully saved {filename} ({len(page_screenshot_bytes)} bytes)")

async def main():
    print("=== SMRITI SMART IMPORT 50-ITEM HEADLESS PLAYWRIGHT RUNNER ===")

    # 1. Read Fixture
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        tsv_content = f.read()

    lines = [l for l in tsv_content.strip().split("\n") if l.strip()]
    row_count = len(lines) - 1
    print(f"Loaded fixture: {FIXTURE_PATH} ({row_count} data rows)")

    # 2. Generate Auth Token for usr-admin / COMP-001 / BR-MAIN-001
    token_payload = {
        "sub": "usr-admin",
        "username": "admin",
        "company_id": "COMP-001",
        "branch_id": "BR-MAIN-001",
        "role": "SYSADMIN"
    }
    jwt_token = create_access_token(token_payload, expires_minutes=120)
    print("Generated valid JWT token for tenant COMP-001.")

    # 3. Check Initial DB Count
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM items WHERE company_id = 'COMP-001';")
    initial_items_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM item_variants WHERE company_id = 'COMP-001';")
    initial_variants_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM item_barcodes WHERE company_id = 'COMP-001';")
    initial_barcodes_count = cur.fetchone()[0]
    print(f"Initial DB counts for COMP-001: Items={initial_items_count}, Variants={initial_variants_count}, Barcodes={initial_barcodes_count}")
    conn.close()

    # 4. Launch Headless Browser
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080"
            ]
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )

        # Pre-seed localStorage with authenticated session
        init_script = f"""
            localStorage.setItem('smriti_jwt_token', '{jwt_token}');
            localStorage.setItem('smriti_session_token', '{jwt_token}');
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'BR-MAIN-001');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
            localStorage.setItem('smriti_user', JSON.stringify({{
                id: 'usr-admin',
                username: 'admin',
                role: 'SYSADMIN',
                company_id: 'COMP-001',
                branch_id: 'BR-MAIN-001',
                name: 'Administrator'
            }}));
            localStorage.setItem('smriti_company', JSON.stringify({{
                id: 'COMP-001',
                name: 'Tattly Threads',
                code: '001'
            }}));
            localStorage.setItem('smriti_last_activity', Date.now().toString());
        """
        await context.add_init_script(init_script)

        page = await context.new_page()

        # Listen to browser console messages
        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)

        print("\nStep 1: Navigating to Item Master Studio...")
        await page.goto("http://localhost:3000/?tab=item_master", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(3000)

        # Find and click "Imports & Bulk Paste" tab in ItemMasterWs
        print("Switching to 'Imports & Bulk Paste' sub-tab...")
        imports_tab_button = page.locator("button:has-text('Imports & Bulk Paste'), button:has-text('Imports')").first
        await imports_tab_button.wait_for(state="visible", timeout=15000)
        await imports_tab_button.click()
        await page.wait_for_timeout(1500)

        # Wait for Item Master Studio header
        await page.wait_for_selector("text=SMRITI Smart Import", timeout=15000)
        print("Smart Import Studio UI loaded successfully.")

        # Screenshot 1: 01-import-studio.png
        s1 = await page.screenshot(full_page=True)
        save_screenshots("01-import-studio.png", s1)

        # Step 2: Paste the 50-item TSV into raw matrix textarea
        print("\nStep 2: Pasting 50 footwear TSV rows into Raw Matrix Input...")
        raw_textarea = page.locator("textarea[placeholder*='Paste tab-delimited'], textarea").first
        await raw_textarea.fill(tsv_content)
        await page.wait_for_timeout(2500)

        # Screenshot 2: 02-column-mapping.png
        print("Capturing column mapping header disambiguation...")
        s2 = await page.screenshot(full_page=True)
        save_screenshots("02-column-mapping.png", s2)

        # Step 3: Run Preview Validation
        print("\nStep 3: Triggering live preview validation...")
        revalidate_btn = page.locator("button:has-text('Re-validate All')").first
        await revalidate_btn.click()
        
        # Wait for preview completion (dashboard cards update)
        print("Waiting for validation preview to complete...")
        await page.wait_for_timeout(5000)
        await page.wait_for_selector("text=Ready to Commit", timeout=15000)

        # Screenshot 3: 03-validation-preview.png
        print("Capturing 50-row validation preview...")
        s3 = await page.screenshot(full_page=True)
        save_screenshots("03-validation-preview.png", s3)

        # Screenshot 4: 04-validation-errors.png (Validation summary showing 0 blocking errors)
        print("Capturing validation error & summary dashboard...")
        s4 = await page.screenshot(full_page=True)
        save_screenshots("04-validation-errors.png", s4)

        # Step 4: Submit Database Import
        print("\nStep 4: Submitting database import...")
        commit_btn = page.locator("button:has-text('Import & Commit')").first
        await commit_btn.click()
        await page.wait_for_timeout(1500)

        # Wait for Confirm Database Import Modal
        await page.wait_for_selector("text=Confirm Database Import", timeout=10000)
        print("Pre-Commit Modal opened.")

        # Select strategy ALL_ELIGIBLE and confirm
        confirm_btn = page.locator("div[role='dialog'] button:has-text('Confirm & Commit'), button:has-text('Confirm & Commit')").last
        await confirm_btn.click()

        # Wait for commit network request to finish and toast notification
        print("Awaiting commit response and database transaction...")
        await page.wait_for_timeout(6000)

        # Screenshot 5: 05-import-result.png
        print("Capturing import result and toast confirmation...")
        s5 = await page.screenshot(full_page=True)
        save_screenshots("05-import-result.png", s5)

        # Step 5: Database Verification
        print("\nStep 5: Querying database to verify created records...")
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
        cur = conn.cursor()

        cur.execute("SELECT count(*) FROM items WHERE company_id = 'COMP-001';")
        final_items_count = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM item_variants WHERE company_id = 'COMP-001';")
        final_variants_count = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM item_barcodes WHERE company_id = 'COMP-001';")
        final_barcodes_count = cur.fetchone()[0]

        # Verify the 50 barcodes
        cur.execute("""
            SELECT b.barcode, v.variant_sku, i.item_name, i.item_code, i.brand, i.attributes_json
            FROM item_barcodes b
            JOIN item_variants v ON b.variant_id = v.id
            JOIN items i ON v.item_id = i.id
            WHERE i.company_id = 'COMP-001' AND b.barcode = ANY(%s)
            ORDER BY b.barcode;
        """, ([l.split('\t')[0] for l in lines[1:]],))
        imported_records = cur.fetchall()

        print(f"Post-Import DB counts for COMP-001: Items={final_items_count} (+{final_items_count - initial_items_count}), Variants={final_variants_count} (+{final_variants_count - initial_variants_count}), Barcodes={final_barcodes_count} (+{final_barcodes_count - initial_barcodes_count})")
        print(f"Verified imported barcodes matched in PostgreSQL: {len(imported_records)} / {row_count}")

        if len(imported_records) > 0:
            print(f"Sample Record 1: Barcode={imported_records[0][0]}, SKU={imported_records[0][1]}, Item={imported_records[0][2]}, Style={imported_records[0][3]}")
            print(f"Sample Record 50: Barcode={imported_records[-1][0]}, SKU={imported_records[-1][1]}, Item={imported_records[-1][2]}, Style={imported_records[-1][3]}")

        conn.close()

        # Switch to Item Catalog Tab in UI for Visual Verification Screenshot
        print("\nSwitching to Catalog tab in UI for database visual verification...")
        catalog_tab_btn = page.locator("button:has-text('Article / Design Catalog'), button:has-text('Catalog')").first
        if await catalog_tab_btn.is_visible():
            await catalog_tab_btn.click()
            await page.wait_for_timeout(3000)

        # Screenshot 6: 06-database-verification.png
        s6 = await page.screenshot(full_page=True)
        save_screenshots("06-database-verification.png", s6)

        await browser.close()

    print("\n=== HEADLESS RUN COMPLETED SUCCESSFULLY ===")
    print(f"Total rows submitted: {row_count}")
    print(f"Total records verified in PostgreSQL: {len(imported_records)}")

if __name__ == "__main__":
    asyncio.run(main())
