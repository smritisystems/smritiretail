<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.47.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- SMRITI Walkthrough Governance Policy (WGP) v1.0
-->

# Barcode & Hardware: Client PRN Dynamic Mapping, Reverse Black-Box Rendering & 3-Stub Footwear Template Walkthrough (v6.47.0)

## 1. Purpose
This walkthrough documents the reverse-engineering, dynamic field mapping, backend ZPL generation engine, and frontend thermal studio integration for the client-supplied static `.PRN` barcode file (`assets/BarcodePRN/smriti_barcodes_2026-10-08.prn`).

Prior to this work, thermal printing utilized synthetic single-tag designs or flawed rotated barcode layouts that omitted essential retail footwear industry structures: dual tear-off audit/counter stubs, inverted reverse-print black boxes (`^GB` with `^FR`), Legal Metrology Packaged Commodities compliance, and authentic physical dimensions (100mm × 50.7mm at 203 DPI). This release replaces static/flawed templates with a dynamically bound layout (`lay-footwear-100x50-3stub`) matching client printer commands with 100% byte-for-byte token parity.

---

## 2. Scope
- **Client Artifact Audit:** Forensic inspection of 1,140 lines across 12 labels in `assets/BarcodePRN/smriti_barcodes_2026-10-08.prn`.
- **Database Alignment:** PostgreSQL Item Master verification for Article `CH-30-K` (`01a11b30-aaa2-7000-ab9c-784df587ac5f`), 12 variants, barcodes, and MRP.
- **Backend API & Service:** `backend/app/api/v1/barcode.py` and `backend/app/schemas/barcode.py` (`lay-footwear-100x50-3stub`, `generate_footwear_3stub_zpl`, and `SystemConfig` legal metrology resolution).
- **Frontend Thermal Studio:** `src/components/barcode/PrintLabelsStudio.tsx` (100x50.7mm template preset and authentic 3-zone vector SVG preview).
- **Test Suites:** `backend/app/tests/test_barcode_client_prn_dynamic.py` and `src/tests/printLabelsStudio.test.ts`.

---

## 3. Files Created
- `docs/implementation/inventory/Barcode_ClientPRN_DynamicMapping_And_Template_Plan_v6.47.0.md`: Full 19-section Implementation Plan.
- `backend/app/tests/test_barcode_client_prn_dynamic.py`: Unit and integration test suite verifying dynamic ZPL token generation, layout endpoints, and PRN stream dispatch.
- `docs/walkthrough/barcode/Barcode_ClientPRN_DynamicMapping_And_Template_v6.47.0.md`: This 13-section WGP walkthrough.

---

## 4. Files Modified
- `backend/app/api/v1/barcode.py`: Added `generate_footwear_3stub_zpl`, registered `lay-footwear-100x50-3stub` in `GET /layouts`, added dynamic legal metrology lookup via `SystemConfig`, and fixed layout lookup and tenant company imports.
- `backend/app/schemas/barcode.py`: Added `layout_id` alias alongside `layoutId` on `PrintRequest` for API flexibility.
- `src/components/barcode/PrintLabelsStudio.tsx`: Added `lay-footwear-100x50-3stub` to `LABEL_TEMPLATES` and updated `generateThermalLabelSvgString` to render high-fidelity 3-zone visual SVG preview with dual tear-off perforation lines and reverse black boxes.
- `src/tests/printLabelsStudio.test.ts`: Added test case verifying 3-zone footwear SVG generation and bumped version to 6.47.0.
- `docs/implementation/README.md`: Appended implementation plan entry to master index table.
- `docs/walkthrough/README.md`: Appended walkthrough entry to master index table.
- `CHANGELOG.md`: Added release notes for v6.47.0.

---

## 5. Architecture Decisions
1. **Dynamic Templating with Byte-for-Byte Visual Geometry:**
   Rather than rewriting the label using abstract coordinates or generic bounding boxes, the exact 203 DPI coordinate grid, font definitions (`^A0`, `^AA`, `^AB`, `^AD`), barcode symbols (`^BCN,66` and `^BCN,30`), and reverse graphic boxes (`^GB284,47,47` and `^GB70,67,67` with `^FR`) are preserved directly in `generate_footwear_3stub_zpl`.
2. **Right-Padded Article Number Box Fill:**
   In the client PRN, article code `CH-30-K` is padded with 5 trailing spaces to exactly 12 characters (`^FDCH-30-K     ^FS`). This ensures white-on-black inverted text visually fills the 284-dot black box symmetrically. The backend generator automatically pads article codes shorter than 12 characters (`f"{raw_art:<12}"`).
3. **Legal Metrology Resolution Hierarchy:**
   Packaged Commodities regulations require marketer name, address, and consumer care email. These are dynamically queried from `SystemConfig` (`business_trade_name`, `legal_metrology_address`, `legal_metrology_email`) with automatic fallback to tenant `Company.name` and default contact details.
4. **Three-Zone Visual SVG Preview:**
   Warehouse staff require visual confirmation before sending print jobs to thermal printers. `PrintLabelsStudio.tsx` renders an authentic vector SVG depicting Zone 1 (Upper Counter Stub), Zone 2 (Lower Audit Stub), and Zone 3 (Main Shoe Box Label) with dashed perforation cut lines.

---

## 6. Design Rationale
- **Zero Drift Risk:** By auditing all 1,140 lines of the client `.PRN` file and creating automated diff scripts, 100% equivalence was confirmed across all 12 variants in the client batch.
- **Physical Label Geometry:** Footwear retail tags feature two detachable stubs for cash counter detachment and physical audit trailing. Generating single tags without dual stubs breaks store inventory operations.

---

## 7. Implementation Summary
- **Audit Findings:** The client PRN corresponds exactly to SMRITI PostgreSQL tenant `smriti001`, item `CH-30-K` (Heel), variants `BLACK` and `TOUPE` across sizes 37–42, EAN-13 barcodes `8904551005335` to `8904551005458`, and MRP ₹1,199.00.
- **Field Mappings:**
  - Article No: `item.style_code` / `item.style` (padded to 12 chars in main box)
  - Color / Shade: `item.color` / `attrs.color` / `item.shade`
  - Size: `item.size` / `attrs.size`
  - Barcode: `item.barcode` / `item.code` (Code 128)
  - MRP: `item.mrp` / `item.price` (formatted as integer `1199/-`)
  - Marketer / Address / Email: Dynamic from `SystemConfig` / `Company`
  - Net Contents: `NET CONTENTS:1 Pair Footwear`

---

## 8. Tests Executed
1. **Dynamic Footwear ZPL Test Suite:**
   ```bash
   C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe -m pytest backend/app/tests/test_barcode_client_prn_dynamic.py -v
   ```
   - `test_generate_footwear_3stub_zpl_exact_structure`: PASSED
   - `test_generate_footwear_3stub_zpl_variant_toupe`: PASSED
   - `test_get_layouts_includes_footwear_3stub`: PASSED
   - `test_print_footwear_3stub_prn_dispatch`: PASSED
   *Result: 4/4 passed.*

2. **Backend Barcode Regression Suite:**
   ```bash
   C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe -m pytest backend/app/tests/test_barcode.py -v
   ```
   - `test_get_and_save_printer_settings`: PASSED
   - `test_print_labels_recording_history`: PASSED
   - `test_print_labels_dynamic_placeholder_replacement`: PASSED
   - `test_print_labels_qz_tray_mode`: PASSED
   - `test_print_labels_prn_mode`: PASSED
   - `test_print_job_ack_endpoint_success_and_failure`: PASSED
   - `test_qz_certificate_and_signing_endpoints`: PASSED
   *Result: 7/7 passed.*

3. **Frontend Studio Vitest Suite:**
   ```bash
   npx vitest run src/tests/printLabelsStudio.test.ts
   ```
   *Result: 11/11 passed.*

4. **TypeScript Typecheck:**
   ```bash
   npx tsc --noEmit
   ```
   *Result: 0 errors.*

---

## 9. Verification Results
- **ZPL Parity:** Generated ZPL streams matched client PRN structure with 0 coordinate or command deviation.
- **Dynamic Field Resolution:** Variant attributes (color, size, barcode, price) and legal metrology addresses bound seamlessly to live database records.
- **UI Studio Parity:** 3-zone visual SVG rendered accurately in Print Labels Studio preview pane.

---

## 10. Known Limitations
- The 3-stub layout is optimized specifically for 100mm × 50.7mm thermal footwear labels. Other apparel labels with single hangtags use standard 50x25mm or custom dimensions.
- The default net contents field defaults to `NET CONTENTS:1 Pair Footwear` unless overridden in item attributes.

---

## 11. Future Work
- Visual interactive stub-drag editor allowing users to reposition stub boundaries in the template designer.
- Support for QR code generation alongside Code 128 in the right margin for consumer warranty registration.

---

## 12. Related ADRs
- `ADR-0042`: FastAPI PostgreSQL System-of-Record Architecture.
- `ADR-0089`: Thermal Printer Raw TCP Socket and ZPL Dispatch Standards.

---

## 13. Related RFCs
- `RFC-2026-08`: Thermal Label Dynamic Placeholder Replacement Protocol.
- `RFC-2026-11`: Legal Metrology Dynamic Tenant Resolution Standard.
