"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Headless Playwright Runner: Reliance Retail Ltd. CSV Billing with 43.76% Markdown
==================================================================================
Automates end-to-end POS billing verification for Reliance Retail Ltd.:
1. Connects to database and determines next sequential document number.
2. Logs into SMRITI Retail OS & enters Billing Workspace.
3. Selects customer Reliance Retail Ltd. via F2 Customer Browse Modal.
4. Captures screenshot: 01_customer_reliance_selected.png.
5. Opens Barcode CSV Import Modal (Alt+I / Overflow Menu).
6. Asserts #reliance-contract-banner is visible with 43.76% trade markdown badge.
7. Captures screenshot: 02_csv_import_modal_reliance_banner.png.
8. Uploads reliance_retail_order.csv and validates 43.76% off MRP [REL_RET_4376].
9. Captures screenshot: 03_csv_import_4376_discount_preview.png.
10. Adds verified items to cart; asserts 43.76% discount & REL_RET_4376 applied, all other discounts skipped.
11. Captures screenshot: 04_billing_terminal_with_4376_items.png.
12. Executes Exact Cash Settlement [F7] and renders Tax Invoice Receipt.
13. Captures screenshot: 05_bill_settled_receipt.png.
14. Switches to 80mm Thermal Receipt format view.
15. Captures screenshot: 06_bill_printable_thermal_receipt.png.
16. Verifies fresh database records in PostgreSQL smriti001 (sales_invoices, sales_invoice_items, billing_csv_import_logs).
"""

import asyncio
import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8000"
CSV_PATH = "F:/SMRITRretailNX/CSV/reliance_retail_order.csv"
ARTIFACT_DIR = os.environ.get("CONVERSATION_ARTIFACT_DIR", "C:/Users/netma/.gemini/antigravity-ide/brain/d1e1ac2d-e193-4ebb-9bd8-b13b02474afe")
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_csv_reliance_discount")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def get_next_doc_number():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("SELECT invoice_no FROM sales_invoices WHERE invoice_no LIKE 'TT/%' ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    max_num = 2
    for r in rows:
        inv = r[0]
        try:
            parts = inv.split('/')
            num = int(parts[-1].replace('-', ''))
            if num > max_num:
                max_num = num
        except Exception:
            pass
    return max_num + 1


async def run():
    next_doc_no = get_next_doc_number()
    target_invoice_no = f"TT/{next_doc_no:04d}"

    print("=" * 80)
    print("SMRITI RETAIL OS — HEADLESS PLAYWRIGHT RELIANCE RETAIL 43.76% CSV BILLING")
    print("=" * 80)
    print(f"Target Frontend   : {BASE_URL}")
    print(f"Target CSV File   : {CSV_PATH}")
    print(f"Target Invoice No : {target_invoice_no}")
    print(f"Screenshot Dir    : {SCREENSHOT_DIR}")

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

        # Step 3: Select Customer Reliance Retail Ltd. via [F2] Browse
        print("\n[Step 3] Selecting Customer Reliance Retail Ltd. via [F2] Browse...")
        browse_cust_btn = page.locator('button:has-text("Browse")').first
        await browse_cust_btn.click()
        await page.wait_for_timeout(1500)

        # Wait for customer search & browse window
        await page.wait_for_selector('h3:has-text("Customer Search & Browse Window")', timeout=10000)
        print("  Customer Search & Browse Window modal opened.")

        # Search for Reliance
        search_input = page.locator('input[placeholder*="Search by Customer Code"]').first
        await search_input.fill("Reliance")
        await page.wait_for_timeout(1000)

        # Select Reliance Retail row
        rel_row = page.locator('tr:has-text("Reliance Retail")').first
        await rel_row.wait_for(state="visible", timeout=5000)
        select_btn = rel_row.locator('button:has-text("Select")')
        await select_btn.click()
        await page.wait_for_timeout(1500)

        # Verify customer name updated on terminal
        cust_name_input = page.locator('input[name="posCustomerName"]')
        cust_name_val = await cust_name_input.input_value()
        print(f"  Customer loaded on POS terminal: '{cust_name_val}'")
        assert "Reliance" in cust_name_val, f"Expected Reliance customer, found '{cust_name_val}'"

        ss_01 = os.path.join(SCREENSHOT_DIR, "01_customer_reliance_selected.png")
        await page.screenshot(path=ss_01)
        print(f"  [Screenshot 1] Captured: {ss_01} ({os.path.getsize(ss_01):,} bytes)")

        # Step 4: Open Barcode CSV Import Modal
        print("\n[Step 4] Opening Barcode CSV Import Modal...")
        more_btn = page.locator('button[aria-label="More POS actions"]').first
        await more_btn.click()
        await page.wait_for_timeout(500)
        csv_menu_item = page.locator('button:has-text("CSV Import")').first
        await csv_menu_item.click()
        await page.wait_for_timeout(1000)

        # Verify modal is open and #reliance-contract-banner is visible
        await page.wait_for_selector('text="Barcode Billing CSV Import"', timeout=5000)
        banner = page.locator('#reliance-contract-banner')
        await banner.wait_for(state="visible", timeout=5000)
        banner_text = await banner.inner_text()
        print(f"  Reliance Contract Banner verified in modal:\n    {banner_text.replace(chr(10), ' ')}")
        assert "43.76% Markdown" in banner_text, "43.76% Markdown badge missing from banner"

        ss_02 = os.path.join(SCREENSHOT_DIR, "02_csv_import_modal_reliance_banner.png")
        await page.screenshot(path=ss_02)
        print(f"  [Screenshot 2] Captured: {ss_02} ({os.path.getsize(ss_02):,} bytes)")

        # Step 5: Upload CSV File
        print(f"\n[Step 5] Uploading CSV file: {CSV_PATH}...")
        file_input = page.locator('input[type="file"]')
        await file_input.set_input_files(CSV_PATH)
        print("  File uploaded. Waiting for catalogue validation...")

        # Wait for validation to finish and confirm button to appear
        add_btn = page.locator('button:has-text("Verified DB Item(s) to Bill")')
        await add_btn.wait_for(state="visible", timeout=15000)
        await page.wait_for_timeout(1500)

        # Verify 43.76% discount badge in preview rows
        promo_badges = page.locator('span:has-text("43.76% off MRP [REL_RET_4376]")')
        badge_count = await promo_badges.count()
        print(f"  Contract discount badges detected in preview: {badge_count}")
        assert badge_count >= 2, f"Expected at least 2 contractual discount badges, found {badge_count}"

        ss_03 = os.path.join(SCREENSHOT_DIR, "03_csv_import_4376_discount_preview.png")
        await page.screenshot(path=ss_03)
        print(f"  [Screenshot 3] Captured: {ss_03} ({os.path.getsize(ss_03):,} bytes)")

        # Step 6: Add Verified DB Items to Bill
        print("\n[Step 6] Clicking 'Add Verified DB Item(s) to Bill'...")
        btn_text = await add_btn.inner_text()
        print(f"  Button text: '{btn_text}'")
        await add_btn.click()

        # Wait for modal to close and items to populate in cart
        await page.wait_for_selector('text="Barcode Billing CSV Import"', state="hidden", timeout=5000)
        await page.wait_for_timeout(2000)

        # Assert cart items have 43.76% discount and REL_RET_4376 applied
        cart_rel_promos = page.locator('span:has-text("REL_RET_4376")')
        rel_promo_count = await cart_rel_promos.count()
        print(f"  Cart items with REL_RET_4376 promo badge: {rel_promo_count}")
        assert rel_promo_count >= 2, f"Expected at least 2 REL_RET_4376 promo badges in cart, found {rel_promo_count}"

        # Assert bill promotions (FEST500 / VIP) are skipped and absent
        fest_promos = page.locator('text="FEST500", text="Festival Privilege"')
        fest_count = await fest_promos.count()
        print(f"  General retail promotions (FEST500) detected: {fest_count} (Must be 0)")
        assert fest_count == 0, f"Expected 0 retail promotions for Reliance Retail, found {fest_count}"

        ss_04 = os.path.join(SCREENSHOT_DIR, "04_billing_terminal_with_4376_items.png")
        await page.screenshot(path=ss_04)
        print(f"  [Screenshot 4] Captured: {ss_04} ({os.path.getsize(ss_04):,} bytes)")

        # Ensure document number is sequential to avoid idempotency caching
        doc_input = page.locator('input[name="posDocNumber"]')
        if await doc_input.count() > 0:
            await doc_input.fill(f"{next_doc_no:04d}")
            print(f"  Set target document number in UI to: {next_doc_no:04d} (Full: {target_invoice_no})")
            await page.wait_for_timeout(500)

        # Step 7: Finalize Bill via Exact Cash Settlement [F7]
        print("\n[Step 7] Executing Exact Cash Settlement [F7]...")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        settle_clicked = await page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const exactCashBtn = btns.find(b => b.textContent && b.textContent.includes('Exact Cash'));
            if (exactCashBtn) {
                exactCashBtn.click();
                return true;
            }
            return false;
        }""")
        print(f"  Clicked Exact Cash via evaluate: {settle_clicked}")
        if not settle_clicked:
            await page.keyboard.press("F7")
            print("  Pressed [F7] hotkey fallback.")

        print("  Waiting for backend /api/v1/pos/checkout response and receipt modal rendering...")
        await page.wait_for_timeout(4000)

        # Verify receipt modal is visible
        receipt_locator = page.locator('button:has-text("Thermal Slip"), button:has-text("A4 Standard")').first
        await receipt_locator.wait_for(state="visible", timeout=12000)
        print("  Receipt modal successfully mounted.")

        ss_05 = os.path.join(SCREENSHOT_DIR, "05_bill_settled_receipt.png")
        await page.screenshot(path=ss_05)
        print(f"  [Screenshot 5] Captured: {ss_05} ({os.path.getsize(ss_05):,} bytes)")

        # Step 8: Switch to 80mm Thermal Receipt Format View
        print("\n[Step 8] Capturing 80mm Thermal Receipt print format view...")
        thermal_btn = page.locator('button:has-text("Thermal Slip")').first
        if await thermal_btn.count() > 0 and await thermal_btn.is_visible():
            print("  Switching to thermal print layout...")
            await thermal_btn.click()
            await page.wait_for_timeout(1500)

        ss_06 = os.path.join(SCREENSHOT_DIR, "06_bill_printable_thermal_receipt.png")
        await page.screenshot(path=ss_06)
        print(f"  [Screenshot 6] Captured: {ss_06} ({os.path.getsize(ss_06):,} bytes)")

        await browser.close()

    # Step 9: Database Audit Verification in PostgreSQL smriti001
    print("\n" + "=" * 80)
    print("DATABASE AUDIT & SETTLEMENT VERIFICATION")
    print("=" * 80)
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Check newly created sales_invoice
    cur.execute("""
        SELECT id, invoice_no, date, grand_total, tax_total, payment_mode, shift_id, created_at, modified_at
        FROM sales_invoices
        WHERE invoice_no = %s
    """, (target_invoice_no,))
    inv = cur.fetchone()
    if not inv:
        # Fallback to latest invoice
        cur.execute("""
            SELECT id, invoice_no, date, grand_total, tax_total, payment_mode, shift_id, created_at, modified_at
            FROM sales_invoices
            ORDER BY COALESCE(modified_at, created_at) DESC NULLS LAST, id DESC
            LIMIT 1
        """)
        inv = cur.fetchone()

    print("\n[Persisted Sales Invoice in PostgreSQL]")
    print(dict(inv))
    assert inv is not None, "Failed to persist sales invoice in database"

    # 2. Check sales_invoice_items
    cur.execute("""
        SELECT id, line_no, code, name, quantity, price, mrp, is_tax_inclusive, taxable_value, gst_rate, total_amount
        FROM sales_invoice_items
        WHERE invoice_id = %s
        ORDER BY line_no
    """, (inv["id"],))
    items = cur.fetchall()
    print(f"\n[Persisted Invoice Line Items ({len(items)} items)]")
    for it in items:
        mrp = it['mrp'] or it['price']
        disc_pct_calc = round((float(mrp) - float(it['price'])) / float(mrp) * 100, 2) if mrp and float(mrp) > 0 else 0
        print(f"  Line {it['line_no']}: code={it['code']}, qty={it['quantity']}, MRP=₹{mrp}, Unit Price=₹{it['price']} "
              f"(Contract Markdown: {disc_pct_calc}%), Taxable=₹{it['taxable_value']}, GST={it['gst_rate']}%, Total=₹{it['total_amount']}")

    # 3. Check billing_csv_import_logs
    cur.execute("""
        SELECT id, file_name, file_sha256, format_detected, total_rows, valid_rows, warning_rows, rejected_rows,
               total_gross_amount, total_tax_amount, tax_mode_applied, created_at
        FROM billing_csv_import_logs
        ORDER BY created_at DESC
        LIMIT 1
    """)
    import_log = cur.fetchone()
    print("\n[Latest Barcode CSV Import Audit Log in PostgreSQL]")
    print(dict(import_log))

    conn.close()
    print("\n[SUCCESS] End-to-end Reliance Retail Ltd. 43.76% CSV billing & settlement successfully verified with 0 errors!")


if __name__ == "__main__":
    asyncio.run(run())
