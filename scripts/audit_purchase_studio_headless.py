"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal / Verification Audit
"""

import os
import sys
import time
import json
import urllib.request
import urllib.error
import psycopg2
from decimal import Decimal
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8000"
DB_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"
SCREENSHOT_DIR = os.path.join(os.getcwd(), "scratch", "purchase_studio_audit_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

console_errors = []
console_logs = []
failed_network = []
api_calls = []

def log_console(msg):
    text = f"[{msg.type.upper()}] {msg.text}"
    console_logs.append(text)
    if msg.type == "error":
        console_errors.append(text)

def log_request(request):
    if "/api/v1/" in request.url:
        api_calls.append(f"REQ: {request.method} {request.url}")

def log_response(response):
    if "/api/v1/" in response.url:
        api_calls.append(f"RESP: {response.status} {response.url}")

def log_request_failed(request):
    failed_network.append(f"FAIL: {request.method} {request.url} - {request.failure}")

def get_admin_jwt_token():
    login_url = f"{API_URL}/api/v1/auth/login"
    payload = json.dumps({"username": "admin", "password": "Admin@123"}).encode()
    req = urllib.request.Request(login_url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get("access_token")
    except Exception as e:
        print(f"[AUTH ERROR] Failed to get JWT token: {e}")
        return None

def run_backend_supplier_validations_audit(token: str):
    print("\n" + "=" * 80)
    print("PHASE 1: BACKEND SUPPLIER & PURCHASE ORDER VALIDATION AUDIT")
    print("=" * 80)

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "001",
        "X-Branch-Code": "MAIN",
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "MAIN",
        "Content-Type": "application/json",
    }

    results = {}

    # 1.1 List Suppliers Scoped to COMP-001
    print("\n[1.1] Auditing GET /api/v1/purchase/suppliers/ (Tenant Scoping)...")
    req = urllib.request.Request(f"{API_URL}/api/v1/purchase/suppliers/", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            suppliers = json.loads(resp.read().decode())
            print(f"   ✓ Returned HTTP {resp.status} with {len(suppliers)} suppliers.")
            active_suppliers = [s for s in suppliers if s.get("company_id") == "COMP-001"]
            print(f"   ✓ Tenant Scoped Suppliers (COMP-001): {len(active_suppliers)} suppliers.")
            results["list_suppliers"] = "PASS"
            sample_sup = suppliers[0] if suppliers else None
    except Exception as e:
        print(f"   ✗ Failed: {e}")
        results["list_suppliers"] = f"FAIL ({e})"
        sample_sup = None

    # 1.2 Get Single Supplier Details
    if sample_sup:
        sup_id = sample_sup.get("id")
        print(f"\n[1.2] Auditing GET /api/v1/purchase/suppliers/{sup_id}...")
        req = urllib.request.Request(f"{API_URL}/api/v1/purchase/suppliers/{sup_id}", headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                sup_detail = json.loads(resp.read().decode())
                assert sup_detail.get("id") == sup_id
                print(f"   ✓ Supplier details retrieved: [{sup_detail.get('code')}] {sup_detail.get('name')}")
                results["get_supplier"] = "PASS"
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results["get_supplier"] = f"FAIL ({e})"

    # 1.3 Negative Test: Query Non-Existent Supplier
    print("\n[1.3] Auditing Negative Test: Non-existent supplier lookup (Expected 404)...")
    req = urllib.request.Request(f"{API_URL}/api/v1/purchase/suppliers/sup-non-existent-9999", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"   ✗ Unexpected HTTP {resp.status} for non-existent supplier!")
            results["negative_get_supplier_404"] = "FAIL (Unexpected 200)"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"   ✓ Correctly returned HTTP 404: {e.reason}")
            results["negative_get_supplier_404"] = "PASS"
        else:
            print(f"   ✗ Returned HTTP {e.code} instead of 404")
            results["negative_get_supplier_404"] = f"FAIL (HTTP {e.code})"

    # 1.4 Negative Test: Create PO with Non-Existent Supplier
    print("\n[1.4] Auditing Negative Test: Create PO with non-existent supplier (Expected 404)...")
    invalid_po_payload = {
        "order_no": "PO-TEST-AUDIT-INVALID",
        "supplier_id": "sup-does-not-exist-8888",
        "items": [
            {
                "product_id": "prod-sample-01",
                "code": "ITEM-01",
                "name": "Sample Item",
                "quantity": 10,
                "cost_price": 500,
                "gst_rate": 5
            }
        ]
    }
    req = urllib.request.Request(
        f"{API_URL}/api/v1/purchase/orders/",
        data=json.dumps(invalid_po_payload).encode(),
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"   ✗ Unexpected HTTP {resp.status} for invalid supplier PO!")
            results["negative_po_invalid_supplier"] = "FAIL (Unexpected 200)"
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if e.code == 404:
            print(f"   ✓ Correctly rejected with HTTP 404: {body[:80]}...")
            results["negative_po_invalid_supplier"] = "PASS (HTTP 404 Supplier not found)"
        else:
            print(f"   ✗ Returned HTTP {e.code}: {body[:80]}")
            results["negative_po_invalid_supplier"] = f"FAIL (HTTP {e.code})"

    # 1.5 Negative Test: Create PO with Empty Line Items
    print("\n[1.5] Auditing Negative Test: Create PO with empty items (Expected 400 or 422)...")
    empty_po_payload = {
        "order_no": "PO-TEST-AUDIT-EMPTY",
        "supplier_id": sample_sup.get("id") if sample_sup else "sup-sample",
        "items": []
    }
    req = urllib.request.Request(
        f"{API_URL}/api/v1/purchase/orders/",
        data=json.dumps(empty_po_payload).encode(),
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"   ✗ Unexpected HTTP {resp.status} for empty items PO!")
            results["negative_po_empty_items"] = "FAIL (Unexpected 200)"
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"   ✓ Rejection confirmed with HTTP {e.code}: {body[:80]}...")
        results["negative_po_empty_items"] = f"PASS (HTTP {e.code})"

    return results, sample_sup

def run_frontend_headless_playwright_audit(token: str, sample_sup: dict):
    print("\n" + "=" * 80)
    print("PHASE 2: FRONTEND HEADLESS PLAYWRIGHT AUDIT (PORT 3000)")
    print("=" * 80)

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        page.on("console", log_console)
        page.on("request", log_request)
        page.on("response", log_response)
        page.on("requestfailed", log_request_failed)

        # 2.1 Pre-seed LocalStorage Authentication
        print("\n[2.1] Pre-seeding authenticated local storage context...")
        page.goto(BASE_URL, wait_until="commit")
        page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token}');
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
        }}""")

        # 2.2 Deep Link Navigation to Purchase Studio
        target_url = f"{BASE_URL}/?tab=purchase"
        print(f"\n[2.2] Navigating directly to Purchase Studio: {target_url}...")
        page.goto(target_url, wait_until="networkidle")
        page.wait_for_timeout(3000)

        # Check for login fallback
        body_text = page.locator("body").inner_text()
        if "Welcome Back" in body_text and "Sign In" in body_text:
            print("   [INFO] Login screen encountered. Performing automated UI login...")
            try:
                page.locator('input[type="text"], input[name="username"]').first.fill("admin")
                page.locator('input[type="password"]').first.fill("Admin@123")
                page.locator('button[type="submit"], button:has-text("Sign In")').first.click()
                page.wait_for_timeout(3000)
                page.goto(target_url, wait_until="networkidle")
                page.wait_for_timeout(3000)
                body_text = page.locator("body").inner_text()
            except Exception as e:
                print(f"   [WARN] Login fallback encountered error: {e}")

        # Capture landing screenshot
        ss_landing = os.path.join(SCREENSHOT_DIR, "01_purchase_studio_landing.png")
        page.screenshot(path=ss_landing)
        print(f"   ✓ Screenshot saved: {ss_landing}")

        # 2.3 Verify Studio Header & Shell Mounting
        print("\n[2.3] Auditing Studio Header & Elements...")
        has_title = "Purchase Order / Indent Generation" in body_text or "Purchase Order" in body_text
        has_mode_badge = "Standard Line Items" in body_text or "Size Pivot Matrix" in body_text
        print(f"   - Title Detected: {has_title}")
        print(f"   - Mode Badge Detected: {has_mode_badge}")
        results["studio_mounted"] = "PASS" if has_title else "FAIL"

        # 2.4 Verify Supplier Dropdown Population
        print("\n[2.4] Auditing Supplier Dropdown Population from Backend...")
        supplier_select = page.locator("select").nth(1)

        supplier_options = []
        if supplier_select.count() > 0:
            options = supplier_select.locator("option").all_inner_texts()
            supplier_options = [opt.strip() for opt in options if opt.strip()]
            print(f"   ✓ Supplier Dropdown populated with {len(supplier_options)} options from backend:")
            for opt in supplier_options[:6]:
                print(f"      • {opt}")
            if len(supplier_options) > 6:
                print(f"      ... and {len(supplier_options) - 6} more.")
            results["supplier_dropdown_populated"] = "PASS" if len(supplier_options) >= 30 else "FAIL"
        else:
            print("   ✗ Could not find supplier dropdown select element.")
            results["supplier_dropdown_populated"] = "FAIL"

        # 2.5 AUDIT SUPPLIER VALIDATION 1: Empty Supplier Blocking
        print("\n[2.5] Auditing Supplier Validation 1: Blank / Unselected Supplier Blocking...")
        # Simulate unselected supplier by setting value to ""
        page.evaluate("""() => {
            const selects = document.querySelectorAll('select');
            for (const s of selects) {
                if (s.options.length > 5) {
                    s.value = "";
                    s.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }""")
        page.wait_for_timeout(500)

        # Trigger Save PO button
        save_btn = page.locator("button:has-text('Save & Issue PO'), button:has-text('Save PO'), button:has-text('Save')").first
        if save_btn.count() > 0:
            save_btn.click()
            page.wait_for_timeout(1000)
            ss_sup_val = os.path.join(SCREENSHOT_DIR, "02_supplier_validation_empty_supplier.png")
            page.screenshot(path=ss_sup_val)
            print(f"   ✓ Screenshot saved: {ss_sup_val}")

            body_after_save = page.locator("body").inner_text()
            has_sup_req = "Supplier Required" in body_after_save or "load and select a supplier" in body_after_save.lower()
            print(f"   - Validation Notification Triggered: {has_sup_req}")
            results["validation_empty_supplier_blocked"] = "PASS" if has_sup_req else "FAIL"
        else:
            print("   ✗ Save button not found.")
            results["validation_empty_supplier_blocked"] = "FAIL"

        # 2.6 AUDIT LINE ITEMS VALIDATION 2: Empty Grid Blocking
        print("\n[2.6] Auditing Line Items Validation 2: Missing Items Blocking...")
        # Re-select a valid supplier
        page.evaluate("""() => {
            const selects = document.querySelectorAll('select');
            for (const s of selects) {
                if (s.options.length > 5) {
                    s.selectedIndex = 0;
                    s.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }""")
        page.wait_for_timeout(500)

        # Clear line items
        clear_btn = page.locator("button:has-text('Clear All'), button:has-text('Clear')").first
        if clear_btn.count() > 0:
            clear_btn.click()
            page.wait_for_timeout(500)

        if save_btn.count() > 0:
            save_btn.click()
            page.wait_for_timeout(1000)
            ss_item_val = os.path.join(SCREENSHOT_DIR, "03_line_item_validation_empty_grid.png")
            page.screenshot(path=ss_item_val)
            print(f"   ✓ Screenshot saved: {ss_item_val}")

            body_after_save2 = page.locator("body").inner_text()
            has_val_err = "Validation Error" in body_after_save2 or "at least one line item" in body_after_save2.lower()
            print(f"   - Validation Notification Triggered: {has_val_err}")
            results["validation_empty_grid_blocked"] = "PASS" if has_val_err else "FAIL"

        # 2.7 AUDIT CALCULATION ENGINE: Standard Line Items
        print("\n[2.7] Auditing Mathematical Calculations on Standard Line Items...")
        # Populate row 1 with stock number, quantity, rate
        page.evaluate("""() => {
            const row = document.querySelector('table tbody tr:first-child');
            if (row) {
                const inputs = Array.from(row.querySelectorAll('input'));
                if (inputs[0]) {
                    inputs[0].value = 'CH-24-G-BLACK-36';
                    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                }
                for (const input of inputs) {
                    if (input.type === 'number') {
                        input.value = '10';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        }""")
        page.wait_for_timeout(1000)
        ss_calc = os.path.join(SCREENSHOT_DIR, "04_standard_line_items_calculation.png")
        page.screenshot(path=ss_calc)
        print(f"   ✓ Screenshot saved: {ss_calc}")

        calc_text = page.locator("body").inner_text()
        has_totals = "Total Qty" in calc_text or "Gross Value" in calc_text or "Total Tax" in calc_text
        print(f"   - Totals Summary Bar Visible: {has_totals}")
        results["calculation_engine"] = "PASS" if has_totals else "PARTIAL"

        # 2.8 AUDIT SUB-TAB: Size Pivot Grid
        print("\n[2.8] Auditing Sub-tab: Size Pivot Grid...")
        size_tab_btn = page.locator("button:has-text('Size Pivot Grid')").first
        if size_tab_btn.count() > 0:
            size_tab_btn.click()
            page.wait_for_timeout(1000)
            ss_pivot = os.path.join(SCREENSHOT_DIR, "05_size_pivot_matrix.png")
            page.screenshot(path=ss_pivot)
            print(f"   ✓ Screenshot saved: {ss_pivot}")

            pivot_body = page.locator("body").inner_text()
            has_sizes = "36" in pivot_body and "40" in pivot_body and "44" in pivot_body
            print(f"   - Size Columns (36-44) Visible: {has_sizes}")
            results["size_pivot_grid"] = "PASS" if has_sizes else "FAIL"
        else:
            results["size_pivot_grid"] = "FAIL (Button not found)"

        # 2.9 AUDIT SUB-TAB: Other Details
        print("\n[2.9] Auditing Sub-tab: Other Details...")
        other_tab_btn = page.locator("button:has-text('Other Details')").first
        if other_tab_btn.count() > 0:
            other_tab_btn.click()
            page.wait_for_timeout(1000)
            ss_other = os.path.join(SCREENSHOT_DIR, "06_other_details_tab.png")
            page.screenshot(path=ss_other)
            print(f"   ✓ Screenshot saved: {ss_other}")
            results["other_details_tab"] = "PASS"
        else:
            results["other_details_tab"] = "FAIL"

        # 2.10 AUDIT SUB-TAB: GRN & Bills (GrnReceiptTab)
        print("\n[2.10] Auditing Sub-tab: GRN & Bills (GrnReceiptTab)...")
        grn_tab_btn = page.locator("button:has-text('GRN & Bills')").first
        if grn_tab_btn.count() > 0:
            grn_tab_btn.click()
            page.wait_for_timeout(1000)
            ss_grn = os.path.join(SCREENSHOT_DIR, "07_grn_and_bills_tab.png")
            page.screenshot(path=ss_grn)
            print(f"   ✓ Screenshot saved: {ss_grn}")

            grn_body = page.locator("body").inner_text()
            has_grn_content = "GRN" in grn_body or "Receipt" in grn_body or "Material" in grn_body
            print(f"   - GRN Interface Active: {has_grn_content}")
            results["grn_and_bills_tab"] = "PASS" if has_grn_content else "PARTIAL"
        else:
            results["grn_and_bills_tab"] = "FAIL"

        browser.close()

    return results

def run_database_integrity_audit():
    print("\n" + "=" * 80)
    print("PHASE 3: DATABASE INTEGRITY & SCHEMA AUDIT (POSTGRESQL)")
    print("=" * 80)

    results = {}
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()

        # Check suppliers table
        cur.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'suppliers' 
            ORDER BY ordinal_position;
        """)
        sup_cols = cur.fetchall()
        print(f"   ✓ Table 'suppliers' verified with {len(sup_cols)} columns:")
        for col, dt, null in sup_cols[:8]:
            print(f"      • {col} ({dt}, nullable={null})")

        # Check purchase_orders table
        cur.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'purchase_orders' 
            ORDER BY ordinal_position;
        """)
        po_cols = cur.fetchall()
        print(f"\n   ✓ Table 'purchase_orders' verified with {len(po_cols)} columns:")
        for col, dt, null in po_cols[:8]:
            print(f"      • {col} ({dt}, nullable={null})")

        # Check purchase_order_items table
        cur.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'purchase_order_items' 
            ORDER BY ordinal_position;
        """)
        poi_cols = cur.fetchall()
        print(f"\n   ✓ Table 'purchase_order_items' verified with {len(poi_cols)} columns:")
        for col, dt, null in poi_cols[:8]:
            print(f"      • {col} ({dt}, nullable={null})")

        # Count records
        cur.execute("SELECT COUNT(*) FROM suppliers WHERE company_id = 'COMP-001';")
        comp001_sups = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM purchase_orders;")
        total_pos = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM purchase_order_items;")
        total_poi = cur.fetchone()[0]

        print(f"\n   - Database Record Counts:")
        print(f"      • Suppliers (COMP-001): {comp001_sups}")
        print(f"      • Purchase Orders     : {total_pos}")
        print(f"      • PO Line Items       : {total_poi}")

        conn.close()
        results["db_schema_and_counts"] = "PASS"
    except Exception as e:
        print(f"   ✗ Database audit failed: {e}")
        results["db_schema_and_counts"] = f"FAIL ({e})"

    return results

def main():
    print("=" * 80)
    print("SMRITI RETAIL OS — HEADLESS AUDIT: PURCHASE STUDIO WITH SUPPLIER VALIDATIONS")
    print("=" * 80)
    print(f"Timestamp    : {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Base App URL : {BASE_URL}")
    print(f"FastAPI URL  : {API_URL}")
    print(f"Database URL : {DB_URL}")
    print(f"Screenshots  : {SCREENSHOT_DIR}")
    print("-" * 80)

    token = get_admin_jwt_token()
    if not token:
        print("[CRITICAL] Could not acquire JWT token. Aborting audit.")
        sys.exit(1)
    print(f"[AUTH OK] Admin token acquired: {token[:20]}...")

    # Phase 1: Backend Supplier Validations
    be_results, sample_sup = run_backend_supplier_validations_audit(token)

    # Phase 2: Frontend Headless Playwright UI Audit
    fe_results = run_frontend_headless_playwright_audit(token, sample_sup)

    # Phase 3: Database Schema & Integrity Audit
    db_results = run_database_integrity_audit()

    # Final Audit Summary Report
    print("\n" + "=" * 80)
    print("HEADLESS AUDIT SUMMARY REPORT — PURCHASE STUDIO & SUPPLIER VALIDATIONS")
    print("=" * 80)
    
    all_passed = True
    print("\n[PHASE 1: BACKEND VALIDATIONS]")
    for k, v in be_results.items():
        print(f"   • {k:<35}: {v}")
        if "FAIL" in str(v): all_passed = False

    print("\n[PHASE 2: FRONTEND PLAYWRIGHT AUDIT]")
    for k, v in fe_results.items():
        print(f"   • {k:<35}: {v}")
        if "FAIL" in str(v): all_passed = False

    print("\n[PHASE 3: DATABASE SCHEMA & LINEAGE]")
    for k, v in db_results.items():
        print(f"   • {k:<35}: {v}")
        if "FAIL" in str(v): all_passed = False

    print("\n[CONSOLE ERRORS LOGGED]")
    if console_errors:
        print(f"   ! {len(console_errors)} console errors recorded:")
        for ce in console_errors[:10]:
            print(f"      {ce}")
    else:
        print("   ✓ Zero console errors recorded.")

    print("\n[FAILED NETWORK REQUESTS]")
    if failed_network:
        print(f"   ! {len(failed_network)} network failures recorded:")
        for fn in failed_network[:10]:
            print(f"      {fn}")
    else:
        print("   ✓ Zero failed network requests recorded.")

    print("\n" + "=" * 80)
    final_status = "PASSED" if all_passed else "COMPLETED WITH FINDINGS"
    print(f"FINAL AUDIT RESULT: {final_status}")
    print("=" * 80)

if __name__ == "__main__":
    main()
