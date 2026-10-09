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

# Implementation Plan: Tattly Threads Footwear 100x50.7mm ZPL Default Template Validation and Registration

## 1. Objective
Execute a validation-first verification protocol and formal registration of the supplied Tattly Threads 100x50.7mm 3-zone, dual-stub ZPL barcode label as the authoritative `DEFAULT` ZPL template in SMRITI Retail OS without changing coordinates, fonts, barcodes, dimensions, static texts, or database schema.

## 2. Business Motivation
Footwear manufacturing and retail box labeling requires legal metrology compliance (manufacturer/marketer name, address, customer care, MRP inclusive of all taxes, net contents, manufacturing month/year) alongside dual tear-off counter/audit stubs for store POS and warehouse audits. Registering this verified ZPL template as the system default ensures that store operators and factory packaging lines automatically generate standardized labels.

## 3. Scope
- Structural ZPL and XPML wrapper validation (pitch `50.7 mm`, width `^PW804`).
- Identification and verification of 19 dynamic placeholders across 6 logical tokens (`{barcode}`, `{size}`, `{colour}`, `{style_code}`, `{mrp}`, `{pkd_date}`).
- Live data substitution for 4 target footwear variants (`BLACK/37`, `BLACK/40`, `TOUPE/37`, `TOUPE/42`).
- Headless 203 DPI rendering of substituted labels into PNG screenshots via Labelary API.
- Automated Pillow visual zone inspection and Code 128 barcode data matching.
- Database registration in `print_templates` and `barcode_layouts` with `is_default=True`.
- Pre- and post-registration character-by-character safety check.
- UI integration in `PrintLabelsStudio.tsx` preserving both ZPL and DPL printer workflows.

## 4. Current State
Previous sessions implemented a native 300 DPI DPL rendering path for Honeywell IH-2 desktop printers (`PrinterService.generate_dpl_footwear_label`), while the ZPL printing path had an approximate string generator and lacked database registration for the client's official 100x50.7mm PRN template.

## 5. Gap Analysis
- ZPL footwear label was not registered as `DEFAULT=true` in PostgreSQL `print_templates` or `barcode_layouts`.
- The raw PRN script had not undergone automated multi-zone rasterization, pixel density inspection, and character-by-character safety validation against live variant data.
- Frontend `PrintLabelsStudio.tsx` defaulted to a generic `retail-50x25` preset instead of the footwear 3-stub label.

## 6. Architecture Impact
- Zero database schema migrations required (uses existing `print_templates` and `barcode_layouts` tables).
- Zero disruption to existing DPL rendering path (DPL and ZPL remain separate, independent first-class engines).
- Preserves tenant isolation and multi-company database routing in `smriti001`.

## 7. Proposed Design
1. **Validation Engine**: Build `validate_zpl_footwear_template.py` to parse syntax, count placeholders, substitute live variants, write `.prn` files, render headless `.png` bitmaps, and inspect visual zones.
2. **Registration & Safety Gate**: Build `register_default_zpl_template.py` to perform strict pre-registration and post-registration string comparisons against the source file before flipping `DEFAULT=true`.
3. **Automated Test Suite**: Implement `backend/tests/test_zpl_footwear_label.py` as a permanent CI regression barrier.
4. **Studio Convergence**: Align `PrintLabelsStudio.tsx` presets and default state to `lay-footwear-100x50-3stub` and `Zebra ZD421 (USB) - ZPL`.

## 8. Files Created
- `scripts/validate_zpl_footwear_template.py`
- `scripts/register_default_zpl_template.py`
- `backend/tests/test_zpl_footwear_label.py`
- `assets/BarcodePRN/TATTLY_BLACK_37.prn`
- `assets/BarcodePRN/TATTLY_BLACK_40.prn`
- `assets/BarcodePRN/TATTLY_TOUPE_37.prn`
- `assets/BarcodePRN/TATTLY_TOUPE_42.prn`
- `assets/BarcodePRN/TATTLY_BLACK_37.png`
- `assets/BarcodePRN/TATTLY_BLACK_40.png`
- `assets/BarcodePRN/TATTLY_TOUPE_37.png`
- `assets/BarcodePRN/TATTLY_TOUPE_42.png`

## 9. Files Modified
- `backend/app/api/v1/barcode.py`
- `src/components/barcode/PrintLabelsStudio.tsx`
- `src/tests/printLabelsStudio.test.ts`
- `docs/walkthrough/README.md`
- `docs/walkthrough/barcode/Barcode_TattlyThreads_ZPL_Default_Template_Registration_v6.49.1.md`

## 10. Dependencies
- Python 3.13, Pillow 10.3.0, httpx 0.28.1, pytest 9.1.1.
- Node.js, Vitest 4.1.11, React 18.
- PostgreSQL operational database `smriti001`.

## 11. Risks
- Potential mismatch in printer resolution if a 300 DPI printer is sent 203 DPI ZPL: mitigated by preserving native DPL pipeline and explicit printer name selectors.

## 12. Rollback Strategy
- To revert default status: execute `UPDATE barcode_layouts SET is_default = FALSE WHERE id = 'lay-footwear-100x50-3stub'` and restore previous default layout.
- The raw template and code additions are non-breaking and additive.

## 13. Verification Plan
- Syntax check (^XA/^XZ balance, pitch, width).
- Token count (19 placeholders).
- 4-variant live database query and substitution.
- Headless rasterization and programmatic image extrema/zone check.
- 100% character-by-character database verification.

## 14. Test Plan
- Run automated pipeline script `validate_zpl_footwear_template.py`.
- Run database registration script `register_default_zpl_template.py`.
- Run backend pytest suites (`test_zpl_footwear_label.py`, `test_dpl_footwear_label.py`, `test_printer_service_headless_audit.py`, `test_barcode.py`).
- Run frontend vitest suites (`npx vitest run`).

## 15. Documentation Impact
- Added Walkthrough: `docs/walkthrough/barcode/Barcode_TattlyThreads_ZPL_Default_Template_Registration_v6.49.1.md`.
- Appended Walkthrough Index: `docs/walkthrough/README.md`.
- Added Implementation Plan: `docs/implementation/inventory/Barcode_TattlyThreads_ZPL_Default_Template_Registration_Plan_v6.49.1.md`.
- Appended Implementation Index: `docs/implementation/README.md`.

## 16. Deployment Plan
Code deployed to `D:\Smriti_Retail_OS` and synchronized to `F:\Smriti9` testing environment via git pull per environment rules.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-048`: Dual-Backend Thermal Printing Architecture (ZPL + DPL).
- `ADR-039`: System-of-Record Thermal Label Printing Service.

## 19. Related Walkthroughs
- [`docs/walkthrough/barcode/Barcode_TattlyThreads_ZPL_Default_Template_Registration_v6.49.1.md`](../walkthrough/barcode/Barcode_TattlyThreads_ZPL_Default_Template_Registration_v6.49.1.md)
