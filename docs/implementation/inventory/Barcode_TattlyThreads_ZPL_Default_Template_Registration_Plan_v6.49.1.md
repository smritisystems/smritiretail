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
Execute a validation-first verification protocol and formal registration of the supplied Tattly Threads 100x50.7mm 3-zone, dual-stub ZPL barcode label as the authoritative default template for the 100x50.7mm Footwear/ZPL layout in SMRITI Retail OS.
The **master PRN is immutable** (100% character-by-character parity preserved); runtime rendering code was updated to reproduce and use that master template without altering database schemas or existing variant master records.

## 2. Business Motivation
Footwear manufacturing and retail box labeling requires legal metrology compliance (manufacturer/marketer name, address, customer care, MRP inclusive of all taxes, net contents, manufacturing month/year) alongside dual tear-off counter/audit stubs for store POS and warehouse audits. Registering this verified ZPL template as the default for the 100x50.7mm Footwear layout ensures that store operators and factory packaging lines automatically generate standardized labels.

## 3. Scope
- Structural ZPL and XPML wrapper validation (pitch `50.7 mm`, width `^PW804`).
- Identification and verification of 19 dynamic placeholders across 6 logical tokens (`{barcode}`, `{size}`, `{colour}`, `{style_code}`, `{mrp}`, `{pkd_date}`).
- Live data substitution for 4 target footwear variants (`BLACK/37`, `BLACK/40`, `TOUPE/37`, `TOUPE/42`).
- Headless ZPL rasterization used for automated validation only (generating PNG screenshots at 8 dpmm / 203 DPI).
- Automated Pillow visual zone inspection and Code 128 barcode data matching.
- Database registration in `print_templates` and `barcode_layouts` as the default for the 100x50.7mm Footwear/ZPL layout.
- Pre- and post-registration character-by-character safety check on the immutable master PRN.
- UI integration in `PrintLabelsStudio.tsx` preserving both ZPL (203 DPI) and DPL (300 DPI) printer workflows.

## 4. Current State

The SMRITI thermal printing architecture supports two independent printer-language backends:

1. ZPL — existing/proven 203 DPI ZPL workflow.
2. DPL — native 300 DPI Honeywell IH-2 workflow.

The client's official Tattly Threads 100x50.7mm ZPL PRN is now validated as the authoritative master template.

The master PRN remains immutable.

The runtime ZPL renderer/PrintLabelsStudio has been aligned to reproduce and populate this master template using current SMRITI item/variant data.

The DPL renderer remains independent and is not used to modify or convert the master ZPL template.

## 5. Gap Analysis
- ZPL footwear label was not registered in PostgreSQL `print_templates` or `barcode_layouts` as the default for the 100x50.7mm size.
- The raw PRN script had not undergone automated multi-zone rasterization, pixel density inspection, and character-by-character safety validation against live variant data.
- Frontend `PrintLabelsStudio.tsx` defaulted to a generic `retail-50x25` preset instead of the footwear 3-stub label.

## 6. Architecture Impact
- Zero database schema migrations required (uses existing `print_templates` and `barcode_layouts` tables).
- Zero disruption to existing DPL rendering path (DPL and ZPL remain separate, independent first-class engines).
- Preserves tenant isolation and multi-company database routing in `smriti001`.

## 7. Proposed Design

1. Validation Engine
   Validate the immutable master ZPL template, resolve live data, generate test PRNs, perform headless rasterization and verify the resulting label structure.

2. Registration & Safety Gate
   Register the master template in the existing template/layout tables only after strict character-by-character source validation.

3. Runtime Resolver
   Resolve current canonical SMRITI attributes into the template:
   - barcode
   - size
   - colour
   - style_code
   - mrp
   - pkd_date

4. ZPL Renderer
   Generate the validated 100x50.7mm ZPL output for compatible 203 DPI ZPL printers.

5. DPL Renderer
   Generate the separate native 300 DPI DPL output for compatible Honeywell IH-2/DPL printers.

6. Studio Convergence
   Print Labels Studio allows the user/printer profile to select the appropriate template and printer backend.

The master ZPL PRN is never converted, rewritten or modified by the DPL renderer.

### Target Architecture

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
- `backend/app/api/v1/barcode.py`: Synchronized runtime footwear fallback ZPL with master template; routed DPL requests to `PrinterService.generate_dpl_footwear_label`.
- `src/components/barcode/PrintLabelsStudio.tsx`: Synchronized runtime `compilePrnString` generator to reproduce master template with dynamic variables; defaulted template to `lay-footwear-100x50-3stub`.
- `src/tests/printLabelsStudio.test.ts`: Added tests verifying both ZPL and DPL compilation paths.
- `docs/walkthrough/README.md`: Master walkthrough index updated.
- `docs/walkthrough/barcode/Barcode_TattlyThreads_ZPL_Default_Template_Registration_v6.49.1.md`: Walkthrough document created.

## 10. Dependencies
- Python 3.11/3.13, Pillow 10.3.0, httpx 0.28.1, pytest 8.2.1.
- Node.js, Vitest 4.1.11, React 18.
- PostgreSQL operational database `smriti001`.
- Headless ZPL rasterization used for automated validation only (zero runtime production external dependency).

## 11. Risks
- **203 DPI vs 300 DPI Resolution & Routing**:
  ```text
  ZPL template
  100 × 50.7 mm
  ^PW804
  ≈ 203 DPI
          ↓
  ZPL printer/profile (203 DPI) → appropriate

  DPL printer (300 DPI) → separate DPL renderer
  ```
  The 203-DPI ZPL template must not be sent to the 300-DPI DPL renderer/queue. Mitigated by strict runtime printer language detection and architectural isolation in `PrintLabelsStudio.tsx` and `PrinterService`.

## 12. Rollback Strategy
- To revert default status: execute `UPDATE barcode_layouts SET is_default = FALSE WHERE id = 'lay-footwear-100x50-3stub'` and restore previous default layout for that size.
- Master PRN file and runtime code additions remain non-breaking and additive.

## 13. Verification Plan
- Syntax check (^XA/^XZ balance, pitch, width).
- Token count (19 placeholders).
- 4-variant live database query and substitution.
- Headless rasterization and programmatic image extrema/zone check (automated validation only).
- 100% character-by-character database verification against immutable source.

## 14. Test Plan
- Run automated pipeline script `validate_zpl_footwear_template.py`.
- Run database registration script `register_default_zpl_template.py`.
- Run backend pytest suites (`test_zpl_footwear_label.py`, `test_dpl_footwear_label.py`, `test_printer_service_headless_audit.py`, `test_barcode.py` — 28/28 passed).
- Run frontend vitest suites (`npx vitest run` — 1,345/1,345 passed).

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
