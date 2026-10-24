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
Validate and register the supplied Tattly Threads ZPL label (`100 mm × 50.7 mm`, 3-zone, dual tear-off stubs, 804 pitch dots, 19 dynamic placeholders) as the authoritative default template for the 100x50.7mm Footwear/ZPL layout in SMRITI Retail OS, following a strict automated validation-first protocol.
The **master PRN is immutable** (100% character-by-character parity preserved); runtime rendering code in `PrintLabelsStudio.tsx` and the backend fallback generator was updated to reproduce and use that master template without altering database schemas or existing variant records.

## 2. Scope
- Structural ZPL and XPML wrapper validation (^XA/^XZ balance, pitch, width).
- Dynamic placeholder parsing and verification against canonical attributes ({barcode}, {size}, {colour}, {style_code}, {mrp}, {pkd_date}).
- Live database query and substitution for four representative Tattly Threads variants:
  1. BLACK / 37 (8904551005335)
  2. BLACK / 40 (8904551005366)
  3. TOUPE / 37 (8904551005403)
  4. TOUPE / 42 (8904551005458)
- Headless ZPL rasterization used for automated validation only (generating PNG screenshots at 8 dpmm / 203 DPI).
- Automated visual and barcode validation.
- Database registration in `print_templates` and `barcode_layouts` as default for the 100x50.7mm Footwear/ZPL layout.
- Safety check guaranteeing 100% character-by-character parity with the immutable source template.
- UI integration in Print Labels Studio ensuring user selection for both ZPL (203 DPI) and DPL (300 DPI) printers.

## 3. Files Created
- `scripts/validate_zpl_footwear_template.py`: Comprehensive validation pipeline executing Steps 1 through 8.
- `scripts/register_default_zpl_template.py`: Database registration and Step 11 safety parity checker.
- `backend/tests/test_zpl_footwear_label.py`: Automated Pytest verification suite covering structural and visual gates.
- `assets/BarcodePRN/TATTLY_BLACK_37.prn`: Fully substituted ZPL PRN file for BLACK / 37.
- `assets/BarcodePRN/TATTLY_BLACK_40.prn`: Fully substituted ZPL PRN file for BLACK / 40.
- `assets/BarcodePRN/TATTLY_TOUPE_37.prn`: Fully substituted ZPL PRN file for TOUPE / 37.
- `assets/BarcodePRN/TATTLY_TOUPE_42.prn`: Fully substituted ZPL PRN file for TOUPE / 42.
- `assets/BarcodePRN/TATTLY_BLACK_37.png`: Headless rendered 203 DPI label screenshot for BLACK / 37 (validation only).
- `assets/BarcodePRN/TATTLY_BLACK_40.png`: Headless rendered 203 DPI label screenshot for BLACK / 40 (validation only).
- `assets/BarcodePRN/TATTLY_TOUPE_37.png`: Headless rendered 203 DPI label screenshot for TOUPE / 37 (validation only).
- `assets/BarcodePRN/TATTLY_TOUPE_42.png`: Headless rendered 203 DPI label screenshot for TOUPE / 42 (validation only).

## 4. Files Modified
- `backend/app/api/v1/barcode.py`: Set layout response metadata to `"Tattly Threads Footwear — 100x50.7mm"` with `isDefault=True`; synchronized runtime ZPL fallback with master template; routed DPL requests to `PrinterService.generate_dpl_footwear_label`.
- `src/components/barcode/PrintLabelsStudio.tsx`: Updated `LABEL_TEMPLATES` preset title, default `templateId` to `'lay-footwear-100x50-3stub'`, default printer name, and synchronized runtime `compilePrnString` to dynamically populate the master template.
- `src/tests/printLabelsStudio.test.ts`: Updated unit test assertions to match the approved 100x50.7mm footwear template structure and added native DPL footwear compilation tests.

## 5. Architecture Decisions
- **Validation-First Pre-requisite Gate**: Automated verification was executed prior to any database write. The template was not marked `DEFAULT` until all syntax, token, rendering, and barcode checks passed.
- **Dual-Backend Support & Resolution Routing**:
  ```text
  ZPL template (100 × 50.7 mm, ^PW804, ≈ 203 DPI) → Zebra / ZPL printer (203 DPI)
  DPL template (300 DPI)                           → Honeywell IH-2 (300 DPI DPL)
  ```
  The 203-DPI ZPL template is never sent to the 300-DPI DPL renderer/queue. The DPL renderer remains independent and is not used to modify or convert the master ZPL template.
- **Master PRN Immutability vs Runtime Rendering**: The master PRN is stored and dispatched character-by-character as supplied without alteration. The runtime code in `PrintLabelsStudio.tsx` was updated to dynamically generate and populate that exact master layout using current item/variant data.
- **Scoped Default Status**: The default status applies specifically to the 100x50.7mm Footwear/ZPL layout, preserving standard presets for other label dimensions and industries.
- **Zero Production External Dependencies**: Headless ZPL rasterization was utilized solely for automated pre-registration test validation, keeping production printing independent of external rendering engines.

### System Architecture

```text
                    SMRITI PRINT LABELS STUDIO
                              │
                 ┌────────────┴────────────┐
                 │                         │
             Template                  Printer
              Selection                 Selection
                 │                         │
                 └────────────┬────────────┘
                              │
                       Canonical Data
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
      ZPL Renderer                            DPL Renderer
          │                                       │
    203 DPI ZPL                              300 DPI DPL
          │                                       │
    Zebra / ZPL printer                    Honeywell IH-2
```

## 6. Design Rationale
Retail barcode printers require deterministic dot placement. The supplied Tattly Threads footwear label contains precise reverse-print blocks (`^FR`), vertical tear-off stubs, and legal metrology declarations. By validating live substitution and verifying rendered bitmaps programmatically, the system guarantees that printed labels match hardware requirements.

## 7. Implementation Summary
1. Evaluated PRN syntax: verified 2 `^XA`/`^XZ` pairs, XPML pitch `50.7 mm`, width `^PW804`.
2. Verified 19 dynamic placeholders across 6 logical tokens (`{barcode}`, `{size}`, `{colour}`, `{style_code}`, `{mrp}`, `{pkd_date}`).
3. Validated resolution against live database records in `smriti001` for the four mandated variants.
4. Exported resolved `.prn` files and rendered headless `.png` bitmaps using 8 dpmm rendering engine for automated validation.
5. Inspected rendered images using Pillow: verified dimensions, non-blank status, and pixel activity across Zone 1 (upper stub), Zone 2 (lower stub), and Zone 3 (main shoe box body).
6. Registered template in `print_templates` (`tmpl-tt-footwear-100x50.7-zpl`, version 1, `is_default_size=True`) and `barcode_layouts` (`lay-footwear-100x50-3stub`, `is_default=True`) as default for the 100x50.7mm footwear layout.
7. Conducted pre- and post-registration character-by-character safety checks, confirming 100% exact parity on the master template.

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
- Headless rendering: PASS (automated validation only)
- Four screenshots generated: PASS
- Barcode validation: PASS
- Visual validation: PASS
- Default template registration (100x50.7mm Footwear): PASS

## 10. Known Limitations
None. Both ZPL (203 DPI) and DPL (300 DPI) rendering paths operate cleanly without conflicts.

## 11. Future Work
Add client-side WebUSB direct printing bridge for Zebra ZPL printers.

## 12. Related ADRs
- `ADR-048`: Dual-Backend Thermal Printing Architecture (ZPL + DPL).
- `ADR-039`: System-of-Record Thermal Label Printing Service.

## 13. Related RFCs
- `RFC-2026-08`: Thermal Barcode & Legal Metrology Footwear Label Specification.
