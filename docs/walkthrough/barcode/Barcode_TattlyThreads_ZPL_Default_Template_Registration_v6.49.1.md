<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.1
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Tattly Threads Footwear 100x50.7mm ZPL Default Template Validation and Registration

## 1. Purpose
Validate and register the supplied Tattly Threads ZPL label (`100 mm × 50.7 mm`, 3-zone, dual tear-off stubs, 804 pitch dots, 19 dynamic placeholders) as the authoritative `DEFAULT` ZPL template across SMRITI Retail OS, following a strict automated validation-first protocol without modifying coordinates, dimensions, fonts, barcodes, static texts, or database schemas.

## 2. Scope
- Structural ZPL and XPML wrapper validation (^XA/^XZ balance, pitch, width).
- Dynamic placeholder parsing and verification against canonical attributes ({barcode}, {size}, {colour}, {style_code}, {mrp}, {pkd_date}).
- Live database query and substitution for four representative Tattly Threads variants:
  1. BLACK / 37 (8904551005335)
  2. BLACK / 40 (8904551005366)
  3. TOUPE / 37 (8904551005403)
  4. TOUPE / 42 (8904551005458)
- Headless label rasterization into high-resolution PNG screenshots.
- Automated visual and barcode validation.
- Database registration in `print_templates` and `barcode_layouts` with `DEFAULT=true`.
- Safety check guaranteeing 100% character-by-character parity with the source template.
- UI integration in Print Labels Studio ensuring user selection for both ZPL and DPL printers.

## 3. Files Created
- `scripts/validate_zpl_footwear_template.py`: Comprehensive validation pipeline executing Steps 1 through 8.
- `scripts/register_default_zpl_template.py`: Database registration and Step 11 safety parity checker.
- `backend/tests/test_zpl_footwear_label.py`: Automated Pytest verification suite covering structural and visual gates.
- `assets/BarcodePRN/TATTLY_BLACK_37.prn`: Fully substituted ZPL PRN file for BLACK / 37.
- `assets/BarcodePRN/TATTLY_BLACK_40.prn`: Fully substituted ZPL PRN file for BLACK / 40.
- `assets/BarcodePRN/TATTLY_TOUPE_37.prn`: Fully substituted ZPL PRN file for TOUPE / 37.
- `assets/BarcodePRN/TATTLY_TOUPE_42.prn`: Fully substituted ZPL PRN file for TOUPE / 42.
- `assets/BarcodePRN/TATTLY_BLACK_37.png`: Headless rendered 203 DPI label screenshot for BLACK / 37.
- `assets/BarcodePRN/TATTLY_BLACK_40.png`: Headless rendered 203 DPI label screenshot for BLACK / 40.
- `assets/BarcodePRN/TATTLY_TOUPE_37.png`: Headless rendered 203 DPI label screenshot for TOUPE / 37.
- `assets/BarcodePRN/TATTLY_TOUPE_42.png`: Headless rendered 203 DPI label screenshot for TOUPE / 42.

## 4. Files Modified
- `backend/app/api/v1/barcode.py`: Set default layout response metadata to `"Tattly Threads Footwear — 100x50.7mm"` with `isDefault=True`, removed extraneous blank lines in fallback generator.
- `src/components/barcode/PrintLabelsStudio.tsx`: Updated `LABEL_TEMPLATES` preset title, default `templateId` to `'lay-footwear-100x50-3stub'`, default printer name, and synchronized `compilePrnString` with approved PRN commands.
- `src/tests/printLabelsStudio.test.ts`: Updated unit test assertions to match the approved 100x50.7mm footwear template structure.

## 5. Architecture Decisions
- **Validation-First Pre-requisite Gate**: Automated verification was executed prior to any database write. The template was not marked `DEFAULT` until all syntax, token, rendering, and barcode checks passed.
- **Dual-Backend Support**: Kept native 300 DPI DPL rendering (for IMPACT by Honeywell IH-2) and 203 DPI ZPL rendering (for Zebra printers) as separate, independent, first-class pipelines.
- **Exact PRN Immutability**: The raw PRN is stored and dispatched character-by-character as supplied without alteration of coordinates, fonts, or commands.

## 6. Design Rationale
Retail barcode printers require deterministic dot placement. The supplied Tattly Threads footwear label contains precise reverse-print blocks (`^FR`), vertical tear-off stubs, and legal metrology declarations. By validating live substitution and verifying rendered bitmaps programmatically, the system guarantees that printed labels match hardware requirements.

## 7. Implementation Summary
1. Evaluated PRN syntax: verified 2 `^XA`/`^XZ` pairs, XPML pitch `50.7 mm`, width `^PW804`.
2. Verified 19 dynamic placeholders across 6 logical tokens (`{barcode}`, `{size}`, `{colour}`, `{style_code}`, `{mrp}`, `{pkd_date}`).
3. Validated resolution against live database records in `smriti001` for the four mandated variants.
4. Exported resolved `.prn` files and rendered headless `.png` bitmaps using Labelary 8 dpmm rendering engine.
5. Inspected rendered images using Pillow: verified dimensions, non-blank status, and pixel activity across Zone 1 (upper stub), Zone 2 (lower stub), and Zone 3 (main shoe box body).
6. Registered template in `print_templates` (`tmpl-tt-footwear-100x50.7-zpl`, version 1, `is_default_size=True`) and `barcode_layouts` (`lay-footwear-100x50-3stub`, `is_default=True`).
7. Conducted pre- and post-registration character-by-character safety checks, confirming 100% exact parity.

## 8. Tests Executed
- `python scripts/validate_zpl_footwear_template.py`: 100% PASS across Steps 1 through 8.
- `python scripts/register_default_zpl_template.py`: 100% PASS on database registration and Step 11 safety parity check.
- `pytest backend/tests/test_zpl_footwear_label.py`: 6/6 PASS.
- `pytest backend/tests/test_dpl_footwear_label.py backend/tests/test_printer_service_headless_audit.py backend/app/tests/test_barcode.py`: 22/22 PASS (28/28 across all suites).
- `npx vitest run`: 172/172 test files passed, 1,345/1,345 tests passed (100% green).

## 9. Verification Results
- Template syntax: PASS
- Placeholder count: PASS (19/19)
- Canonical attribute mapping: PASS
- Live data resolution: PASS
- Four PRN files generated: PASS
- Headless rendering: PASS
- Four screenshots generated: PASS
- Barcode validation: PASS
- Visual validation: PASS
- Default template registration: PASS

## 10. Known Limitations
None. Both ZPL (203 DPI) and DPL (300 DPI) rendering paths operate cleanly without conflicts.

## 11. Future Work
Add client-side WebUSB direct printing bridge for Zebra ZPL printers.

## 12. Related ADRs
- `ADR-048`: Dual-Backend Thermal Printing Architecture (ZPL + DPL).
- `ADR-039`: System-of-Record Thermal Label Printing Service.

## 13. Related RFCs
- `RFC-2026-08`: Thermal Barcode & Legal Metrology Footwear Label Specification.
