"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.32.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Headless Playwright Runner for SMRITI Retail OS: CSV Billing Import Workflow
============================================================================
Automates end-to-end POS billing via Barcode CSV Import:
1. Logs into SMRITI Retail OS
2. Navigates via SMRITI Launchpad to Billing Workspace
3. Opens Barcode CSV Import Modal (Alt+I / Overflow Menu)
4. Uploads CSV file (F:/SMRITRretailNX/CSV/tt.csv)
5. Validates 8 catalog items against Postgres backend
6. Adds all 8 validated items to POS Cart
7. Executes Exact Cash Settlement [F7]
8. Renders Tax Invoice Receipt
9. Captures high-res step-by-step screenshots to artifact directory
"""
import asyncio
import os
import sys
import json
import psycopg2
from playwright.async_api import async_playwright

# Ensure utf-8 stdout
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8000"
CSV_PATH = "F:/SMRITRretailNX/CSV/tt.csv"
ARTIFACT_DIR = "C:/Users/netma/.gemini/antigravity-ide/brain/30f5debb-e5af-4fa3-ad08-7e2d26618acf"
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_csv_billing")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def run():
    print("=" * 80)
    print("SMRITI RETAIL OS — HEADLESS PLAYWRIGHT CSV BILLING IMPORT")
    print("=" * 80)
    print(f"Target Frontend : {BASE_URL}")
    print(f"Target CSV File : {CSV_PATH}")
    print(f"Screenshot Dir  : {SCREENSHOT_DIR}")

    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] CSV file not found: {CSV_PATH}")
        return

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        csv_lines = [l.strip() for l in f if l.strip()]
    print(f"Loaded {len(csv_lines)} rows from {CSV_PATH}:")
    for l in csv_lines:
        print(f"  {l}")

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
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[CONSOLE {msg.type.upper()}] {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("response", lambda res: print(f"[NET {res.status}] {res.url}") if any(k in res.url for k in ("/pos/checkout", "/billing/csv")) else None)

        # Step 1: Navigate to Base URL
        print("\n[Step 1] Navigating to frontend...")
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # Check for login screen
        admin_quick_btn = page.locator('button:has-text("Admin")')
        auth_btn = page.locator('button:has-text("Authorize Operator")')
        if await auth_btn.count() > 0 and await auth_btn.is_visible():
            print("  Login screen detected. Clicking Admin & Authorizing...")
            if await admin_quick_btn.count() > 0:
                await admin_quick_btn.click()
                await page.wait_for_timeout(300)
            await auth_btn.click()
            await page.wait_for_timeout(2000)

        # Check for company / workspace selection
        enter_ws_btn = page.locator('button:has-text("Enter Workspace"), button:has-text("Connect")')
        if await enter_ws_btn.count() > 0 and await enter_ws_btn.first.is_visible():
            print("  Company selection detected. Entering workspace...")
            await enter_ws_btn.first.click()
            await page.wait_for_timeout(2000)

        ss_01 = os.path.join(SCREENSHOT_DIR, "01_desktop_launchpad.png")
        await page.screenshot(path=ss_01)
        print(f"  [Screenshot 1] Captured: {ss_01}")

        # Step 2: Navigate to Launchpad then Billing Workspace
        print("\n[Step 2] Navigating to SMRITI Launchpad and Billing Workspace...")
        launchpad_nav_btn = page.locator('button:has-text("SMRITI Launchpad")').first
        if await launchpad_nav_btn.count() > 0 and await launchpad_nav_btn.is_visible():
            print("  Clicking 'SMRITI Launchpad' navigation button...")
            await launchpad_nav_btn.click()
            await page.wait_for_timeout(1500)

        billing_tile = page.locator('button:has-text("Billing Workspace")').first
        if await billing_tile.count() > 0 and await billing_tile.is_visible():
            print("  Found 'Billing Workspace' tile. Clicking...")
            await billing_tile.click()
        else:
            print("  Searching for billing tile fallback...")
            tile_btn = page.locator('[data-tile-id="billing-workspace"], button:has-text("Billing")').first
            await tile_btn.click()

        # Wait for terminal to mount
        print("  Waiting for Billing Workspace terminal to load...")
        await page.wait_for_selector('button[aria-label="More POS actions"]', timeout=15000)
        await page.wait_for_timeout(2000)
        ss_02 = os.path.join(SCREENSHOT_DIR, "02_billing_terminal_empty.png")
        await page.screenshot(path=ss_02)
        print(f"  [Screenshot 2] Captured: {ss_02}")

        # Step 3: Trigger CSV Import Modal
        print("\n[Step 3] Opening Barcode CSV Import Modal...")
        more_btn = page.locator('button[aria-label="More POS actions"]').first
        await more_btn.click()
        await page.wait_for_timeout(500)
        csv_menu_item = page.locator('button:has-text("CSV Import")').first
        await csv_menu_item.click()
        await page.wait_for_timeout(1000)

        # Verify modal is open
        await page.wait_for_selector('text="Barcode Billing CSV Import"', timeout=5000)
        ss_03 = os.path.join(SCREENSHOT_DIR, "03_csv_import_modal_open.png")
        await page.screenshot(path=ss_03)
        print(f"  [Screenshot 3] Captured: {ss_03}")

        # Step 4: Upload CSV File
        print(f"\n[Step 4] Setting file input to: {CSV_PATH}...")
        file_input = page.locator('input[type="file"]')
        await file_input.set_input_files(CSV_PATH)
        print("  File uploaded. Waiting for catalogue validation...")

        # Wait for validation to finish and confirm button to appear with items
        add_btn = page.locator('button:has-text("Verified DB Item(s) to Bill")')
        await add_btn.wait_for(state="visible", timeout=15000)
        await page.wait_for_timeout(1500)

        # Capture validated preview
        ss_04 = os.path.join(SCREENSHOT_DIR, "04_csv_import_validated_preview.png")
        await page.screenshot(path=ss_04)
        print(f"  [Screenshot 4] Captured: {ss_04}")

        # Step 5: Add Validated Items to Bill
        print("\n[Step 5] Clicking 'Add Verified DB Item(s) to Bill'...")
        btn_text = await add_btn.inner_text()
        print(f"  Button text: '{btn_text}'")
        await add_btn.click()

        # Wait for modal to close and items to populate in cart
        await page.wait_for_selector('text="Barcode Billing CSV Import"', state="hidden", timeout=5000)
        await page.wait_for_timeout(2000)

        ss_05 = os.path.join(SCREENSHOT_DIR, "05_billing_terminal_with_items.png")
        await page.screenshot(path=ss_05)
        print(f"  [Screenshot 5] Captured: {ss_05}")

        # Step 6: Exact Cash Settlement [F7]
        print("\n[Step 6] Executing Exact Cash Settlement [F7]...")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        # Trigger click via evaluate to bypass any floating barcode overlay occlusion
        clicked = await page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(el => el.textContent && el.textContent.includes('Exact Cash'));
            if (b) {
                b.click();
                return true;
            }
            return false;
        }""")
        print(f"  Exact cash DOM click: {clicked}")
        if not clicked:
            print("  Fallback: pressing F7 key...")
            await page.keyboard.press("F7")

        # Wait for Tax Invoice Receipt modal to mount
        print("  Waiting for Tax Invoice Receipt dialog...")
        await page.wait_for_timeout(4000)
        receipt_header = page.locator('text="TAX INVOICE", text="Tax Invoice", button:has-text("Print")')
        if await receipt_header.count() > 0:
            try:
                await receipt_header.first.wait_for(state="visible", timeout=10000)
            except Exception:
                pass

        ss_06 = os.path.join(SCREENSHOT_DIR, "06_bill_settled_receipt.png")
        await page.screenshot(path=ss_06)
        print(f"  [Screenshot 6] Captured: {ss_06}")

        print("\n" + "=" * 80)
        print("ALL 6 HEADLESS SCREENSHOTS SUCCESSFULLY CAPTURED!")
        print("=" * 80)
        await browser.close()

    # Step 7: Verify generated invoice in PostgreSQL
    print("\n[Step 7] Querying PostgreSQL smriti001 for the latest invoice...")
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
        cur = conn.cursor()
        cur.execute("""
            SELECT id, invoice_no, date, customer_name, payment_mode, grand_total, tax_total, shift_id, created_at
            FROM sales_invoices
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT 1;
        """)
        inv = cur.fetchone()
        if inv:
            inv_id, inv_no, inv_date, cust_name, pay_mode, grand_total, tax_total, shift_id, created_at = inv
            print(f"  Latest Invoice ID   : {inv_id}")
            print(f"  Invoice Number      : {inv_no}")
            print(f"  Date                : {inv_date}")
            print(f"  Customer            : {cust_name}")
            print(f"  Payment Mode        : {pay_mode}")
            print(f"  Shift ID            : {shift_id}")
            print(f"  Tax Total           : ₹{tax_total}")
            print(f"  Grand Total         : ₹{grand_total}")
            print(f"  Created At          : {created_at}")

            cur.execute("""
                SELECT code, name, quantity, price, gst_rate, total_amount
                FROM sales_invoice_items
                WHERE invoice_id = %s
                ORDER BY line_no ASC, id ASC;
            """, (inv_id,))
            items = cur.fetchall()
            print(f"\n  Line Items in Invoice ({len(items)} items):")
            for it in items:
                print(f"    - Code: {it[0]:<20} | Name: {it[1]:<35} | Qty: {it[2]:<3} | Price: ₹{it[3]:<8} | GST: {it[4]:<3}% | Total: ₹{it[5]}")
        cur.close()
        conn.close()
    except Exception as ex:
        print(f"  [DB Query Warning] Could not inspect database directly: {ex}")

if __name__ == "__main__":
    asyncio.run(run())
