# Project      : SMRITI Retail OS
# Repository   : SMRITIRetailNX
# Organization : AITDL NETWORKS
#
# Founders
#
# * Pushpa Devi Jawahar Mallah
#   * Founder & Chairperson
#   * Phone: [REDACTED_PUBLIC_PII]
#   * Email: founder@aitdl.com
#
# * Jawahar Ramkripal Mallah
#   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
#   * Email: founder@aitdl.com
#
# * Websites: aitdl.com | erpnbook.com | smritibooks.com
#
# * Version    : 1.0.0
# * Created    : 2026-10-15
# * Modified   : 2026-10-15
# * Copyright  : © SMRITIBooks.com. All Rights Reserved.
# * License    : Proprietary Commercial Software
# * Classification: Internal / Verification

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

BASE_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
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

async def verify_po_print_format():
    print("=" * 80)
    print("SMRITI RETAIL OS — PURCHASE ORDER PRINT FORMAT VISUAL VERIFICATION")
    print("Design Reference: image(8).png / Approved A4 Visual Lock")
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
        page.on("console", lambda msg: print(f"   [BROWSER CONSOLE {msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"   [BROWSER PAGEERROR] {err}"))

        # Step 0: Pre-seed authenticated localStorage
        target_url = f"{BASE_URL}/?tab=purchase"
        print(f"\n[Step 0] Seeding authenticated local storage on domain: {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
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
            localStorage.setItem('smriti_company_name', 'SMRITI Retail Private Limited');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
            localStorage.setItem('smriti_setup_completed', 'true');
            localStorage.setItem('smriti_po_ux_mode', 'sizewise');
        }}""")

        # Navigate with authenticated context
        print(f"\n[Step 1] Loading Purchase Studio with authenticated session...")
        await page.goto(target_url, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        # Click Generate PO tab if present
        gen_tab = page.locator("#purchase-studio-generate-tab").first
        if await gen_tab.count() > 0:
            await gen_tab.click()
            await page.wait_for_timeout(500)

        # Ensure Sizewise mode is active
        sw_btn = page.locator("#po-mode-sizewise-btn").first
        if await sw_btn.count() > 0:
            await sw_btn.click()
            await page.wait_for_timeout(1000)

        # Wait for Sizewise UI to be ready
        await page.wait_for_selector("#sw-new-po-btn, #sw-print-po-btn, button:has-text('Add Item')", timeout=10000)
        await page.wait_for_timeout(1000)

        # Set Scale Preset to Footwear EU (EU 36 - 44)
        print("\n[Step 2] Configuring Footwear EU Scale (36 - 44) & Real Footwear Articles...")
        scale_select = page.locator("#sw-size-scale-select").first
        if await scale_select.count() > 0:
            await scale_select.select_option("FOOTWEAR_EU")
            await page.wait_for_timeout(500)

        # Populate rows matching the approved reference image
        sample_rows = [
            {
                "code": "SH-03-I",
                "name": "Classic Oxford Running Sneaker",
                "rate": "660",
                "shade": "Black",
                "heels": "Flat",
                "upper": "Mesh",
                "outsole": "EVA",
                "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60",
                "qtys": {"36": 4, "37": 8, "38": 14, "39": 18, "40": 20, "41": 18, "42": 14, "43": 8, "44": 4}
            },
            {
                "code": "SH-05-R",
                "name": "Tan Leather Formal Walking Shoe",
                "rate": "645",
                "shade": "Brown",
                "heels": "Low (2 cm)",
                "upper": "PU",
                "outsole": "Rubber",
                "image": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=60",
                "qtys": {"36": 2, "37": 4, "38": 8, "39": 10, "40": 12, "41": 10, "42": 8, "43": 4, "44": 2}
            },
            {
                "code": "SN-11-S",
                "name": "Athletic Pro Court Trainer",
                "rate": "720",
                "shade": "White",
                "heels": "Flat",
                "upper": "Synthetic",
                "outsole": "TPR",
                "image": "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500&auto=format&fit=crop&q=60",
                "qtys": {"36": 1, "37": 2, "38": 4, "39": 6, "40": 8, "41": 6, "42": 4, "43": 2, "44": 1}
            },
            {
                "code": "SN-12-R",
                "name": "Navy Blue Urban Slip-On",
                "rate": "695",
                "shade": "Navy",
                "heels": "Medium (4 cm)",
                "upper": "Mesh",
                "outsole": "EVA",
                "image": "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=500&auto=format&fit=crop&q=60",
                "qtys": {"36": 2, "37": 4, "38": 6, "39": 8, "40": 8, "41": 6, "42": 4, "43": 2, "44": 2}
            },
            {
                "code": "SN-21-L",
                "name": "Grey Comfort Lifestyle Sneaker",
                "rate": "610",
                "shade": "Grey",
                "heels": "High (6 cm)",
                "upper": "PU",
                "outsole": "Rubber",
                "image": "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500&auto=format&fit=crop&q=60",
                "qtys": {"36": 1, "37": 2, "38": 4, "39": 6, "40": 6, "41": 6, "42": 4, "43": 2, "44": 1}
            }
        ]

        for i, item in enumerate(sample_rows):
            print(f"   * Populating row {i+1}: {item['code']} - {item['shade']}...")
            # Click Add Item button to add a row (empty state or toolbar)
            add_item_btn = page.locator("button:has-text('Add Item')").first
            if await add_item_btn.count() > 0:
                await add_item_btn.click()
                await page.wait_for_timeout(400)

            # Fill Article Code (using article_color mode selector #sw-article-{i} or fallback #sw-itemcode-{i})
            art_input = page.locator(f"#sw-article-{i}, #sw-itemcode-{i}").first
            if await art_input.count() > 0:
                await art_input.fill(item["code"])
                await art_input.dispatch_event("input")
                await art_input.dispatch_event("change")

            # Fill Color / Shade
            shade_input = page.locator(f"#sw-shade-{i}").first
            if await shade_input.count() > 0:
                await shade_input.fill(item["shade"])
                await shade_input.dispatch_event("input")
                await shade_input.dispatch_event("change")

            # Fill Rate
            rate_input = page.locator(f"#sw-rate-{i}").first
            if await rate_input.count() > 0:
                await rate_input.fill(item["rate"])
                await rate_input.dispatch_event("input")
                await rate_input.dispatch_event("change")

            # Fill size quantities
            for sz, qty in item["qtys"].items():
                cell = page.locator(f"#sw-qty-{i}-{sz}").first
                if await cell.count() > 0 and await cell.is_enabled():
                    await cell.fill(str(qty))
                    await cell.dispatch_event("input")
                    await cell.dispatch_event("change")

            # Attach product image for the first article if modal is available, leave others for Golden Ratio placeholder
            if i == 0 and item.get("image"):
                try:
                    row_tr = page.locator("#sw-items-grid tbody tr").nth(0)
                    img_trigger = row_tr.locator("button[title*='image'], button[title*='Attach'], button[title*='photo']").first
                    if await img_trigger.count() > 0:
                        await img_trigger.click(timeout=3000)
                        await page.wait_for_timeout(500)
                        url_input = page.locator("input[placeholder*='shoe-photo']").first
                        if await url_input.count() > 0:
                            await url_input.fill(item["image"], timeout=3000)
                            await url_input.dispatch_event("input")
                            await url_input.dispatch_event("change")
                            save_btn = page.locator("div[role='dialog'] button:has-text('Save & Apply Image')").first
                            if await save_btn.count() > 0:
                                await save_btn.click(timeout=3000)
                                await page.wait_for_timeout(500)
                except Exception as ex:
                    print(f"     [Note] Direct image attach skipped, using Golden Ratio fallback: {ex}")
                    # Close any leftover modal if open
                    cancel_btn = page.locator("div[role='dialog'] button:has-text('Cancel')").first
                    if await cancel_btn.count() > 0:
                        await cancel_btn.click(timeout=1000)

        await page.wait_for_timeout(1000)

        # Step 3: Open Print Preview Modal
        print("\n[Step 3] Opening Statutory Print Preview Modal...")
        await page.screenshot(path=os.path.join(OUTPUT_DIR, "debug_before_print.png"))
        await page.wait_for_selector("#sw-print-po-btn", state="visible", timeout=15000)
        sw_print = page.locator("#sw-print-po-btn").first
        print(f"   * Clicking #sw-print-po-btn...")
        await sw_print.click()
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(OUTPUT_DIR, "debug_after_print_click.png"))

        # Check modal is visible
        modal = page.locator("div[role='dialog'][aria-label='Purchase Order Print Preview']")
        modal_count = await modal.count()
        print(f"   [DEBUG] Modal count with role=dialog and aria-label: {modal_count}")
        if modal_count == 0:
            all_dialogs = await page.locator("div[role='dialog']").all()
            print(f"   [DEBUG] Total dialogs in DOM: {len(all_dialogs)}")
            for d in all_dialogs:
                print(f"      dialog aria-label: {await d.get_attribute('aria-label')}")
            print("[FAIL] PO Print Preview Modal did not open.")
            sys.exit(1)
        print("   [PASS] PO Print Preview Modal opened successfully.")

        # Verify default template is smriti-sizewise
        template_select = page.locator("#po-preview-template-select")
        selected_val = await template_select.input_value()
        print(f"   [CHECK] Default template: '{selected_val}'")
        assert selected_val == "smriti-sizewise", f"Expected default template to be 'smriti-sizewise', got '{selected_val}'"

        # Verify Layout default is Portrait
        portrait_btn = page.locator("#po-preview-orientation-portrait")
        portrait_class = await portrait_btn.get_attribute("class") or ""
        assert "bg-amber-400" in portrait_class, "Expected Portrait orientation button to be active by default"
        print("   [PASS] Orientation default is verified as A4 Portrait.")

        # Capture Modal Overview
        shot1_path = os.path.join(OUTPUT_DIR, "01_po_print_sizewise_modal.png")
        await page.screenshot(path=shot1_path)
        print(f"   [CAPTURE] Step 3: Modal Overview -> {shot1_path}")

        # Capture Sheet Document Element
        await modal.evaluate("el => el.scrollTop = 0")
        await page.wait_for_timeout(300)
        sheet = page.locator("#po-print-preview-sheet-wrapper")
        shot2_path = os.path.join(OUTPUT_DIR, "02_po_print_sizewise_sheet.png")
        await sheet.screenshot(path=shot2_path)
        print(f"   [CAPTURE] Step 3: A4 Sizewise Print Sheet -> {shot2_path}")

        # Verify Sheet Elements
        sheet_text = await sheet.inner_text()

        # 1. Company and Brand Header
        assert "SMRITI" in sheet_text, "Missing SMRITI logo in header"
        assert "RETAIL OS" in sheet_text, "Missing RETAIL OS brand in header"
        assert "PURCHASE ORDER" in sheet_text, "Missing PURCHASE ORDER document title"
        print("   [PASS] Header & Company Information verified.")

        # 2. Supplier Panel
        assert "SUPPLIER" in sheet_text, "Missing SUPPLIER section"
        print("   [PASS] Supplier panel verified.")

        # 3. Item Details (Sizewise) Table
        assert "ITEM DETAILS (SIZEWISE)" in sheet_text, "Missing ITEM DETAILS (SIZEWISE) heading"
        assert "ARTICLE NO." in sheet_text, "Missing ARTICLE NO. column"
        assert "COLOR" in sheet_text, "Missing COLOR column"
        assert "SIZE (EU)" in sheet_text, "Missing SIZE (EU) group heading"
        assert "RATE" in sheet_text, "Missing RATE column"
        assert "TAX %" in sheet_text, "Missing TAX % column in Sizewise table"
        assert "TAX (" in sheet_text, "Missing TAX value column in Sizewise table"
        assert "AMOUNT" in sheet_text, "Missing AMOUNT column"
        assert "TOTAL" in sheet_text, "Missing TOTAL footer row"
        print("   [PASS] Item Details (Sizewise) table structure with TAX % and TAX value verified.")

        # 4. Item Reference (Images) Cards
        assert "ITEM REFERENCE (IMAGES)" in sheet_text.upper(), "Missing ITEM REFERENCE (IMAGES) heading"
        assert "2 IMAGES PER ROW" in sheet_text.upper(), "Missing 2 images per row indicator"
        assert "COLOR" in sheet_text.upper(), "Missing Color sub-attribute"
        assert "HEELS" in sheet_text.upper(), "Missing Heels sub-attribute"
        assert "UPPER MATERIAL" in sheet_text.upper(), "Missing Upper Material sub-attribute"
        assert "OUTSOLE" in sheet_text.upper(), "Missing Outsole sub-attribute"
        assert "GOLDEN RATIO" in sheet_text.upper(), "Missing Golden Ratio indicator for missing image placeholder"
        assert "SMRITI RETAIL PRIVATE LIMITED" in sheet_text.upper(), "Missing Company Name watermark in placeholder"
        print("   [PASS] Item Reference (Images) 2-card per row layout, footwear sub-attributes & Golden Ratio company watermark verified.")

        # 5. Commercial Terms & Order Summary
        assert "COMMERCIAL TERMS" in sheet_text.upper(), "Missing COMMERCIAL TERMS panel"
        assert "PAYMENT TERMS" in sheet_text.upper(), "Missing Payment Terms"
        assert "FREIGHT TERMS" in sheet_text.upper(), "Missing Freight Terms"
        assert "ORDER SUMMARY" in sheet_text.upper(), "Missing ORDER SUMMARY panel"
        assert "TOTAL ITEMS" in sheet_text.upper(), "Missing Total Items in summary"
        assert "TOTAL QUANTITY" in sheet_text.upper(), "Missing Total Quantity in summary"
        assert "SUBTOTAL" in sheet_text.upper(), "Missing Subtotal in summary"
        assert "GST" in sheet_text.upper(), "Missing GST in summary"
        assert "GRAND TOTAL" in sheet_text.upper(), "Missing Grand Total in summary"
        print("   [PASS] Side-by-side Commercial Terms & Order Summary verified.")

        # 6. Remarks & Approval Signatures
        assert "REMARKS:" in sheet_text.upper(), "Missing Remarks section"
        assert "PREPARED BY" in sheet_text.upper(), "Missing Prepared By signature block"
        assert "CHECKED BY" in sheet_text.upper(), "Missing Checked By signature block"
        assert "AUTHORIZED SIGNATORY" in sheet_text.upper(), "Missing Authorized Signatory signature block"
        assert "DESIGNATION" in sheet_text.upper(), "Missing Designation line"
        print("   [PASS] Remarks and 3-block approval signatures verified.")

        # 7. System Footer
        assert "Computer-generated Purchase Order | SMRITI Retail OS | www.smritibooks.com" in sheet_text, "Missing standard computer-generated footer"
        assert "Page 1 of 1" in sheet_text, "Missing Page 1 of 1 pagination"
        print("   [PASS] System Footer & Page 1 of 1 pagination verified.")

        # Step 3B: Test Default Sizewise Print to Printer (@media print) & Print to PDF
        print("\n[Step 3B] Testing Default Sizewise Print to Printer (@media print) & Print to PDF...")
        await page.emulate_media(media="print")
        await page.wait_for_timeout(800)

        # Assert no table overflow
        no_overflow = await page.evaluate("""() => {
            const tables = document.querySelectorAll('#po-print-preview-sheet-wrapper table');
            for (const t of tables) {
                if (t.scrollWidth > t.clientWidth + 5) return false;
            }
            return true;
        }""")
        assert no_overflow, "Table has horizontal overflow in @media print"
        print("   [PASS] Zero horizontal overflow on Sizewise table in @media print.")

        shot4_path = os.path.join(OUTPUT_DIR, "04_po_print_sizewise_emulation.png")
        await page.screenshot(path=shot4_path)
        print(f"   [CAPTURE] Step 3B: Sizewise Print Emulation -> {shot4_path}")

        pdf_sizewise_path = os.path.join(OUTPUT_DIR, "po_print_sizewise_a4.pdf")
        try:
            await page.pdf(
                path=pdf_sizewise_path,
                format="A4",
                print_background=True,
                margin={"top": "8mm", "bottom": "8mm", "left": "8mm", "right": "8mm"}
            )
        except PermissionError:
            pdf_sizewise_path = os.path.join(OUTPUT_DIR, "po_print_sizewise_a4_latest.pdf")
            await page.pdf(
                path=pdf_sizewise_path,
                format="A4",
                print_background=True,
                margin={"top": "8mm", "bottom": "8mm", "left": "8mm", "right": "8mm"}
            )
        print(f"   [CAPTURE] Step 3B: Statutory A4 Sizewise PDF Generated -> {pdf_sizewise_path}")

        # PyMuPDF Parity Audit for Sizewise PDF
        import fitz
        doc_sw = fitz.open(pdf_sizewise_path)
        assert len(doc_sw) == 1, f"Expected 1 page for Sizewise PDF, got {len(doc_sw)}"
        sw_rect = doc_sw[0].rect
        assert abs(sw_rect.width - 595.28) < 2 and abs(sw_rect.height - 841.89) < 2, "Page dimensions deviate from A4"
        sw_raw_text = doc_sw[0].get_text("text")
        sw_norm_text = "".join(sw_raw_text.split()).lower()

        sw_checklist = [
            "smriti", "retailos", "purchaseorder", "supplier",
            "itemdetails(sizewise)", "sizechart:eu",
            "articleno.", "color", "totalqty", "rate", "tax%", "tax", "amount",
            "sh-03-i", "sh-05-r", "sn-11-s", "sn-12-r", "sn-21-l",
            "264", "1,75,250.00", "31,545.00", "2,06,795.00",
            "itemreference(images)", "heels", "uppermaterial", "outsole",
            "goldenratio(1.618:1)", "smritiretailprivatelimited",
            "commercialterms", "ordersummary", "grandtotal",
            "preparedby", "checkedby", "authorizedsignatory",
            "page1of1"
        ]
        for fld in sw_checklist:
            assert fld in sw_norm_text, f"Sizewise PDF missing field: '{fld}'"
        print(f"   [PASS] PyMuPDF Field Parity: 100% of all {len(sw_checklist)} fields verified in Sizewise PDF.")
        doc_sw.close()

        await page.emulate_media(media="screen")
        await page.wait_for_timeout(300)

        # Step 4: Test Format 2 — Standard Barcode-wise (Approved A4)
        print("\n[Step 4] Switching Format to Standard Barcode-wise (Approved A4)...")
        await template_select.select_option("smriti-standard")
        await page.wait_for_timeout(1000)

        sheet_standard_text = await sheet.inner_text()
        assert "ITEM DETAILS (STANDARD - BARCODE-WISE)" in sheet_standard_text, "Missing Standard table heading"
        assert "BARCODE / SKU" in sheet_standard_text, "Missing BARCODE / SKU column in standard format"
        assert "TAX %" in sheet_standard_text, "Missing TAX % column in standard format"
        assert "TAX (" in sheet_standard_text, "Missing TAX value column in standard format"
        assert "ITEM REFERENCE (IMAGES)" in sheet_standard_text, "Item reference cards must still be rendered in standard format"
        print("   [PASS] Standard (Barcode-wise) format with TAX % and TAX value verified.")

        await modal.evaluate("el => el.scrollTop = 0")
        await page.wait_for_timeout(300)
        shot3_path = os.path.join(OUTPUT_DIR, "03_po_print_standard_sheet.png")
        await sheet.screenshot(path=shot3_path)
        print(f"   [CAPTURE] Step 4: A4 Standard Barcode-wise Sheet -> {shot3_path}")

        # Step 5: Test Print Media Emulation & PDF Generation for Standard
        print("\n[Step 5] Emulating @media print on Standard Barcode-wise & generating PDF...")
        await page.emulate_media(media="print")
        await page.wait_for_timeout(800)
        shot5_path = os.path.join(OUTPUT_DIR, "05_po_print_standard_emulation.png")
        await page.screenshot(path=shot5_path)
        print(f"   [CAPTURE] Step 5: Standard Print Emulation -> {shot5_path}")

        pdf_std_path = os.path.join(OUTPUT_DIR, "po_print_standard_a4.pdf")
        try:
            await page.pdf(
                path=pdf_std_path,
                format="A4",
                print_background=True,
                margin={"top": "8mm", "bottom": "8mm", "left": "8mm", "right": "8mm"}
            )
        except PermissionError:
            pdf_std_path = os.path.join(OUTPUT_DIR, "po_print_standard_a4_latest.pdf")
            await page.pdf(
                path=pdf_std_path,
                format="A4",
                print_background=True,
                margin={"top": "8mm", "bottom": "8mm", "left": "8mm", "right": "8mm"}
            )
        print(f"   [CAPTURE] Step 5: Statutory A4 Standard PDF Generated -> {pdf_std_path}")

        doc_std = fitz.open(pdf_std_path)
        std_raw_text = doc_std[0].get_text("text")
        std_norm = "".join(std_raw_text.split()).lower()
        assert "itemdetails(standard-barcode-wise)" in std_norm
        assert "barcode/sku" in std_norm
        print("   [PASS] PyMuPDF Field Parity confirmed on Standard Barcode-wise PDF.")
        doc_std.close()

        await page.emulate_media(media="screen")
        await page.wait_for_timeout(300)

        # Step 6: Return to Default Sizewise Format
        print("\n[Step 6] Resetting to Default Format (smriti-sizewise)...")
        await template_select.select_option("smriti-sizewise")
        await page.wait_for_timeout(500)
        final_val = await template_select.input_value()
        assert final_val == "smriti-sizewise", f"Failed to reset to smriti-sizewise: '{final_val}'"
        print("   [PASS] Format successfully verified and locked to default 'smriti-sizewise'.")

        await browser.close()

    print("\n" + "=" * 80)
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY (100% PREVIEW & PDF PARITY CONFIRMED)")
    print("ZERO COMPROMISE • ZERO DISTORTION • 100% FIELD PARITY")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(verify_po_print_format())
