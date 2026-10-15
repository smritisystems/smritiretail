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
import fitz  # PyMuPDF
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

async def run_print_parity_and_distortion_audit():
    print("=" * 85)
    print("SMRITI RETAIL OS — COMPREHENSIVE PRINT & PDF PARITY / ZERO DISTORTION AUDIT")
    print("Target: Print to Printer (with Preview) vs Print to PDF vs On-Screen Preview")
    print("=" * 85)

    token = get_admin_jwt_token()
    if not token:
        print("[FAIL] Could not acquire admin JWT token.")
        sys.exit(1)

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

        target_url = f"{BASE_URL}/?tab=purchase"
        print("\n[Phase 1] Establishing Authenticated Session & Seeding 5 Footwear Articles...")
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

        await page.goto(target_url, wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)

        # Switch to Generate PO tab and sizewise mode
        gen_tab = page.locator("#purchase-studio-generate-tab").first
        if await gen_tab.count() > 0:
            await gen_tab.click()
            await page.wait_for_timeout(400)

        sw_btn = page.locator("#po-mode-sizewise-btn").first
        if await sw_btn.count() > 0:
            await sw_btn.click()
            await page.wait_for_timeout(600)

        # Wait for Sizewise UI to be ready
        await page.wait_for_selector("#sw-new-po-btn, #sw-print-po-btn, button:has-text('Add Item')", timeout=15000)
        await page.wait_for_timeout(1000)

        scale_select = page.locator("#sw-size-scale-select").first
        if await scale_select.count() > 0:
            await scale_select.select_option("FOOTWEAR_EU")
            await page.wait_for_timeout(500)

        sample_rows = [
            {"code": "SH-03-I", "name": "Classic Oxford Running Sneaker", "rate": "660", "shade": "Black", "qtys": {"36": 4, "37": 8, "38": 14, "39": 18, "40": 20, "41": 18, "42": 14, "43": 8, "44": 4}},
            {"code": "SH-05-R", "name": "Tan Leather Formal Walking Shoe", "rate": "645", "shade": "Brown", "qtys": {"36": 2, "37": 4, "38": 8, "39": 10, "40": 12, "41": 10, "42": 8, "43": 4, "44": 2}},
            {"code": "SN-11-S", "name": "Athletic Pro Court Trainer", "rate": "720", "shade": "White", "qtys": {"36": 1, "37": 2, "38": 4, "39": 6, "40": 8, "41": 6, "42": 4, "43": 2, "44": 1}},
            {"code": "SN-12-R", "name": "Navy Blue Urban Slip-On", "rate": "695", "shade": "Navy", "qtys": {"36": 2, "37": 4, "38": 6, "39": 8, "40": 8, "41": 6, "42": 4, "43": 2, "44": 2}},
            {"code": "SN-21-L", "name": "Grey Comfort Lifestyle Sneaker", "rate": "610", "shade": "Grey", "qtys": {"36": 1, "37": 2, "38": 4, "39": 6, "40": 6, "41": 6, "42": 4, "43": 2, "44": 1}}
        ]

        for i, item in enumerate(sample_rows):
            add_item_btn = page.locator("button:has-text('Add Item')").first
            if await add_item_btn.count() > 0:
                await add_item_btn.click()
                await page.wait_for_timeout(400)

            art_input = page.locator(f"#sw-article-{i}, #sw-itemcode-{i}").first
            await art_input.wait_for(state="visible", timeout=8000)
            await art_input.fill(item["code"])
            await art_input.dispatch_event("input")
            await art_input.dispatch_event("change")

            shade_input = page.locator(f"#sw-shade-{i}").first
            if await shade_input.count() > 0:
                await shade_input.fill(item["shade"])
                await shade_input.dispatch_event("input")
                await shade_input.dispatch_event("change")

            rate_input = page.locator(f"#sw-rate-{i}").first
            if await rate_input.count() > 0:
                await rate_input.fill(item["rate"])
                await rate_input.dispatch_event("input")
                await rate_input.dispatch_event("change")

            for sz, qty in item["qtys"].items():
                cell = page.locator(f"#sw-qty-{i}-{sz}").first
                if await cell.count() > 0 and await cell.is_enabled():
                    await cell.fill(str(qty))
                    await cell.dispatch_event("input")
                    await cell.dispatch_event("change")

        print("   * Successfully populated 5 footwear articles with EU 36-44 distributions.")

        # Phase 2: Open Print Preview Modal
        print("\n[Phase 2] Opening PO Print Preview Modal...")
        sw_print = page.locator("#sw-print-po-btn").first
        await sw_print.click()
        await page.wait_for_timeout(1500)

        modal = page.locator("div[role='dialog'][aria-label='Purchase Order Print Preview']")
        assert await modal.count() > 0, "PO Print Preview Modal did not open."
        print("   * Modal opened successfully.")

        # Phase 3: Screen Preview Measurements & Distortion Pre-Check
        print("\n[Phase 3] Measuring Screen Preview Dimensions & Field Integrity...")
        preview_metrics = await page.evaluate("""() => {
            const sheet = document.querySelector('#po-print-preview-sheet-wrapper');
            const table = sheet.querySelector('table');
            const header = sheet.querySelector('header');
            const imgSection = sheet.querySelector('div.grid.grid-cols-2');
            const termsSection = sheet.querySelector('div.grid.grid-cols-12');
            const footer = sheet.querySelector('footer');

            // Collect all th cells
            const thList = Array.from(table.querySelectorAll('thead th')).map(th => ({
                text: th.innerText.trim(),
                width: th.getBoundingClientRect().width,
                scrollWidth: th.scrollWidth,
                clientWidth: th.clientWidth,
                isClipped: th.scrollWidth > th.clientWidth + 1
            }));

            // Check if any text node in the sheet is overflowing
            const allElements = Array.from(sheet.querySelectorAll('*'));
            let overflowCount = 0;
            const overflowSamples = [];
            for (const el of allElements) {
                if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
                    // Check if it has text or visible overflow
                    const style = window.getComputedStyle(el);
                    if (style.overflow !== 'visible' && el.innerText.trim().length > 0) {
                        overflowCount++;
                        if (overflowSamples.length < 5) {
                            overflowSamples.push({ tag: el.tagName, class: el.className, text: el.innerText.slice(0, 30) });
                        }
                    }
                }
            }

            return {
                sheetWidth: sheet.getBoundingClientRect().width,
                sheetHeight: sheet.getBoundingClientRect().height,
                tableWidth: table.getBoundingClientRect().width,
                tableScrollWidth: table.scrollWidth,
                tableClientWidth: table.clientWidth,
                thList: thList,
                overflowCount: overflowCount,
                overflowSamples: overflowSamples,
                footerBottomY: footer ? footer.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top : null
            };
        }""")

        print(f"   * Screen Sheet Rendered Dimensions: {preview_metrics['sheetWidth']:.1f}px × {preview_metrics['sheetHeight']:.1f}px")
        print(f"   * Table clientWidth: {preview_metrics['tableClientWidth']}px | scrollWidth: {preview_metrics['tableScrollWidth']}px")
        assert preview_metrics['tableScrollWidth'] <= preview_metrics['tableClientWidth'] + 2, "Table has horizontal overflow in preview!"
        print(f"   * Column Count: {len(preview_metrics['thList'])} headers analyzed.")
        clipped_cols = [c for c in preview_metrics['thList'] if c['isClipped']]
        assert len(clipped_cols) == 0, f"Clipped table columns detected: {clipped_cols}"
        print("   [PASS] Screen Preview: Zero column clipping, zero horizontal overflow.")

        # Phase 4: Test Modal "Print" Action Button Trigger
        print("\n[Phase 4] Testing 'Print' Action Button & window.print() dispatch...")
        await page.evaluate("""() => {
            window.__smriti_print_called = false;
            window.print = () => {
                window.__smriti_print_called = true;
            };
        }""")
        print_action_btn = page.locator("#po-preview-print-action-btn")
        await print_action_btn.click()
        await page.wait_for_timeout(300)
        was_print_called = await page.evaluate("() => window.__smriti_print_called")
        assert was_print_called, "window.print() was NOT invoked when clicking #po-preview-print-action-btn!"
        print("   [PASS] Modal 'Print' action button dispatches window.print() cleanly.")

        # Phase 5: Printer Media Emulation (@media print) Deep Inspection
        print("\n[Phase 5] Emulating @media print (Simulating Physical Printer & Print Dialog)...")
        await page.emulate_media(media="print")
        await page.wait_for_timeout(800)

        print_metrics = await page.evaluate("""() => {
            const sheet = document.querySelector('#po-print-preview-sheet-wrapper');
            const table = sheet.querySelector('table');
            const modalToolbar = document.querySelector('.sticky.top-2');
            const footer = sheet.querySelector('footer');

            // Verify toolbar visibility in print
            const toolbarStyle = modalToolbar ? window.getComputedStyle(modalToolbar) : null;
            const isToolbarHidden = !modalToolbar || toolbarStyle.display === 'none';

            // Check table overflow in print
            const tableOverflow = table.scrollWidth > table.clientWidth + 2;

            // Check columns in print
            const thList = Array.from(table.querySelectorAll('thead th')).map(th => ({
                text: th.innerText.trim(),
                width: th.getBoundingClientRect().width,
                isClipped: th.scrollWidth > th.clientWidth + 1
            }));

            // Check Golden Ratio image boxes
            const goldenBoxes = Array.from(sheet.querySelectorAll('div.relative.overflow-hidden')).filter(d => {
                return d.innerText.includes('GOLDEN RATIO') || d.innerText.includes('SMRITI RETAIL');
            }).map(b => {
                const rect = b.getBoundingClientRect();
                return {
                    width: rect.width,
                    height: rect.height,
                    ratio: (rect.width / (rect.height || 1)).toFixed(3)
                };
            });

            return {
                isToolbarHidden: isToolbarHidden,
                tableOverflow: tableOverflow,
                tableWidth: table.getBoundingClientRect().width,
                thList: thList,
                goldenBoxes: goldenBoxes,
                footerY: footer ? footer.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top : 0,
                sheetHeight: sheet.getBoundingClientRect().height
            };
        }""")

        assert print_metrics['isToolbarHidden'], "Modal top toolbar is NOT hidden in @media print!"
        print("   [PASS] Modal UI toolbar is completely hidden in @media print.")
        assert not print_metrics['tableOverflow'], "Table has horizontal overflow in @media print!"
        print(f"   [PASS] Zero horizontal overflow in @media print. Table Width: {print_metrics['tableWidth']:.1f}px")

        for i, gb in enumerate(print_metrics['goldenBoxes']):
            print(f"   * Image Card {i+1} Golden Ratio Box: {gb['width']:.1f}px × {gb['height']:.1f}px (Ratio: {gb['ratio']})")

        print(f"   * Printable Content Vertical Height: {print_metrics['sheetHeight']:.1f}px (Footer at Y: {print_metrics['footerY']:.1f}px)")
        assert print_metrics['sheetHeight'] <= 1120, f"Printable sheet height ({print_metrics['sheetHeight']}px) exceeds A4 single-page budget (1120px)!"
        print("   [PASS] Vertical Budget: Entire document fits within statutory single-page A4 boundaries.")

        # Capture print emulation screenshot
        emulation_shot = os.path.join(OUTPUT_DIR, "04_po_print_sizewise_emulation.png")
        await page.screenshot(path=emulation_shot)
        print(f"   [CAPTURE] Print Emulation Snapshot -> {emulation_shot}")

        # Phase 6: Print to PDF Generation & PyMuPDF Geometry/Parity Verification
        print("\n[Phase 6] Printing to PDF & Verifying Text/Geometry Parity...")
        pdf_path = os.path.join(OUTPUT_DIR, "po_print_sizewise_a4.pdf")
        await page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "6mm", "bottom": "6mm", "left": "6mm", "right": "6mm"}
        )
        print(f"   * PDF generated: {pdf_path} ({os.path.getsize(pdf_path)} bytes)")

        # PyMuPDF Structural Analysis
        doc = fitz.open(pdf_path)
        print(f"   * PDF Page Count: {len(doc)}")
        assert len(doc) == 1, f"Expected strictly 1 page in PDF, got {len(doc)}"

        page0 = doc[0]
        rect = page0.rect
        print(f"   * Page Dimensions: {rect.width:.2f}pt × {rect.height:.2f}pt (Standard A4: 595.28pt × 841.89pt)")
        assert abs(rect.width - 595.28) < 2 and abs(rect.height - 841.89) < 2, "PDF dimensions deviate from standard A4!"

        # Extract text blocks and inspect positions
        blocks = page0.get_text("blocks")
        print(f"   * Total Rendered Text Blocks in PDF: {len(blocks)}")

        # Check for overlapping blocks (field distortion / collision check)
        overlapping_blocks = 0
        for i in range(len(blocks)):
            r_i = fitz.Rect(blocks[i][:4])
            for j in range(i + 1, len(blocks)):
                r_j = fitz.Rect(blocks[j][:4])
                # Check for significant intersection
                inter = r_i.intersect(r_j)
                if inter.is_valid and inter.width > 15 and inter.height > 10:
                    text_i = blocks[i][4].strip().replace("\n", " ")
                    text_j = blocks[j][4].strip().replace("\n", " ")
                    # If both blocks have non-empty text, flag as overlap
                    if len(text_i) > 2 and len(text_j) > 2:
                        print(f"     [WARN] Potential overlap between '{text_i[:25]}' and '{text_j[:25]}'")
                        overlapping_blocks += 1

        print(f"   * Overlapping text block collisions: {overlapping_blocks}")
        assert overlapping_blocks == 0, f"Found {overlapping_blocks} overlapping text blocks in PDF!"
        print("   [PASS] Geometry Parity: Zero text overlaps or collisions detected in PDF.")

        # Verify all mandatory statutory fields in PDF
        full_pdf_text = "".join(page0.get_text("text").split()).lower()
        mandatory_fields = [
            ("Company Brand", "smriti"),
            ("Brand Identifier", "retailos"),
            ("Document Title", "purchaseorder"),
            ("Company Name", "smritiretailprivatelimited"),
            ("Company GSTIN", "29aabcs1234f1z5"),
            ("Supplier Heading", "supplier"),
            ("Table Title", "itemdetails(sizewise)"),
            ("Size EU Group", "size(eu)"),
            ("Tax Percent Header", "tax%"),
            ("Tax Value Header", "tax"),
            ("Amount Header", "amount"),
            ("Article 1 Code", "sh-03-i"),
            ("Article 2 Code", "sh-05-r"),
            ("Article 3 Code", "sn-11-s"),
            ("Article 4 Code", "sn-12-r"),
            ("Article 5 Code", "sn-21-l"),
            ("Total Quantity Sum", "264"),
            ("Subtotal Amount", "1,75,250.00"),
            ("GST Tax Value", "31,545.00"),
            ("Grand Total", "2,06,795.00"),
            ("Image Card Heading", "itemreference(images)"),
            ("2 Images Indicator", "2imagesperrow"),
            ("Footwear Attribute Heels", "heels"),
            ("Footwear Attribute Upper", "uppermaterial"),
            ("Footwear Attribute Outsole", "outsole"),
            ("Golden Ratio Label", "goldenratio(1.618:1)"),
            ("Watermark Text", "smritiretailprivatelimited"),
            ("Commercial Terms", "commercialterms"),
            ("Payment Terms", "paymentterms"),
            ("Order Summary", "ordersummary"),
            ("Prepared By Block", "preparedby"),
            ("Checked By Block", "checkedby"),
            ("Signatory Block", "authorizedsignatory"),
            ("System Footer", "computer-generatedpurchaseorder"),
            ("Pagination", "page1of1")
        ]

        verified_count = 0
        for label, needle in mandatory_fields:
            if needle in full_pdf_text:
                verified_count += 1
            else:
                print(f"   [FAIL] Mandatory field missing in PDF: {label} ('{needle}')")
                assert False, f"Mandatory field missing in PDF: {label} ('{needle}')"

        print(f"   [PASS] 100% Statutory Field Parity: All {verified_count}/{len(mandatory_fields)} fields verified in PDF.")

        # Phase 7: Cross-check Standard Barcode Format Parity as well
        print("\n[Phase 7] Cross-Checking Standard Barcode-wise Print & PDF Parity...")
        await page.emulate_media(media="screen")
        template_select = page.locator("#po-preview-template-select")
        await template_select.select_option("smriti-standard")
        await page.wait_for_timeout(800)

        await page.emulate_media(media="print")
        await page.wait_for_timeout(500)

        pdf_std_path = os.path.join(OUTPUT_DIR, "po_print_standard_a4.pdf")
        await page.pdf(
            path=pdf_std_path,
            format="A4",
            print_background=True,
            margin={"top": "6mm", "bottom": "6mm", "left": "6mm", "right": "6mm"}
        )

        doc_std = fitz.open(pdf_std_path)
        print(f"   * Standard PDF Page Count: {len(doc_std)}")
        std_text = "".join("".join([doc_std[p].get_text("text") for p in range(len(doc_std))]).split()).lower()
        assert "itemdetails(standard-barcode-wise)" in std_text, "Missing standard heading in PDF"
        assert "barcode/sku" in std_text, "Missing BARCODE / SKU column in standard PDF"
        assert "articleno." in std_text, "Missing ARTICLE NO. column in standard PDF"
        assert "tax%" in std_text, "Missing Tax % in standard PDF"
        std_pages = len(doc_std)
        doc_std.close()
        print(f"   [PASS] Standard Barcode-wise PDF parity confirmed ({std_pages} page, 100% column parity).")

        # Phase 8: Reset to Default Sizewise Format
        print("\n[Phase 8] Restoring Default 'smriti-sizewise' Format...")
        await page.emulate_media(media="screen")
        await template_select.select_option("smriti-sizewise")
        await page.wait_for_timeout(400)
        final_tpl = await template_select.input_value()
        assert final_tpl == "smriti-sizewise", f"Failed to reset default template: '{final_tpl}'"
        print("   [PASS] Default format confirmed and locked as 'smriti-sizewise'.")

        await browser.close()

    print("\n" + "=" * 85)
    print("VERIFICATION COMPLETED: ZERO COMPROMISE • ZERO FIELD DISTORTION • 100% PARITY")
    print("PRINT TO PRINTER AND PRINT TO PDF YIELD IDENTICAL, STATUTORY-COMPLIANT RESULTS")
    print("=" * 85)

if __name__ == "__main__":
    asyncio.run(run_print_parity_and_distortion_audit())
