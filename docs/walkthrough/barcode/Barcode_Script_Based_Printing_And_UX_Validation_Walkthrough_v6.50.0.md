<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.0
  Created      : 2026-10-10
  Modified     : 2026-10-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Barcode Studio Script-Based PRN Printing & Front-End UX Validation (v6.50.0)

## 1. Purpose
This document provides complete architectural, implementation, and verification records for two interconnected capabilities in the SMRITI Barcode & Thermal Label Studio:
1. **Script-Based PRN Printing Engine:** Enabling direct printing and PRN download from any browsed custom `.prn`, `.zpl`, or `.blf` file, as well as built-in layout templates (`Tattly Threads Footwear — 100x50.7mm`, `Retail 50x25mm Standard`, `ModernLabelDesign_TE244.blf`, `Honeywell_IH2_DualStub.prn`), replacing name-only upload placeholders with a robust token interpolation engine (`{style_code}`, `{barcode}`, `{colour}`, `{size}`, `{mrp}`, `{brand}`).
2. **Front-End UX Validation & Fixes:** Correcting viewport footer clipping (P0 defect where action buttons were cut off below the screen), eliminating premature text truncation in data grid columns (`max-w-[160px]` → `max-w-[320px] min-w-[180px]`), and wiring native POS operator keyboard hotkeys (`[F8]` Print All, `[F7]` Print Current, `[F11]` Edit Quantities).

---

## 2. Scope
- **Component Scope:**
  - `src/components/barcode/prnInterpolation.ts`: Token parsing, dynamic template compilation, and protocol detection.
  - `src/components/barcode/TagLabelPrintingTa.tsx`: Front-end wizard UI, file ingestion handler, layout hierarchy, and hotkey listeners.
  - `src/components/barcode/types.ts`: Extended `LabelPrintSettings` with `customScriptContent`.
- **Testing Scope:**
  - `src/tests/prnInterpolation.test.ts`: 7 unit tests covering bracket tokens, hash tokens, static fallbacks, batch repetitions, and protocol detection.
  - `src/tests/tagPrinting.test.ts`: 22 regression tests covering filtering, selection, and quantity calculations.
  - `src/tests/printLabelsStudio.test.ts`: 23 regression tests covering label studio workflows.
  - Monorepo TypeScript compilation (`npx tsc --noEmit`).

---

## 3. Files Created
1. `src/components/barcode/prnInterpolation.ts`: Client-side PRN token replacement, batch compilation, and built-in template registry.
2. `src/tests/prnInterpolation.test.ts`: Vitest test suite for PRN interpolation and protocol detection.
3. `docs/walkthrough/barcode/Barcode_Script_Based_Printing_And_UX_Validation_Walkthrough_v6.50.0.md`: This walkthrough document.
4. `docs/implementation/inventory/Barcode_Script_Based_Printing_And_UX_Validation_Plan_v6.50.0.md`: Implementation governance plan.

---

## 4. Files Modified
1. `src/components/barcode/types.ts`: Added `customScriptContent?: string` to `LabelPrintSettings`.
2. `src/components/barcode/TagLabelPrintingTa.tsx`:
   - Wired async file reader (`await file.text()`) to capture uploaded `.prn` scripts.
   - Connected `compilePrnBatch` to `handleExecutePrintDispatch` for both QZ Tray and file export.
   - Removed `fixed bottom-0` from footer and `pb-16` from container, docking the footer as a flex element to eliminate viewport collision.
   - Broadened product column width in the data grid from `max-w-[160px]` to `max-w-[320px] min-w-[180px]`.
   - Bound native `keydown` listeners for `[F8]`, `[F7]`, and `[F11]`.
3. `docs/walkthrough/README.md`: Master walkthrough index updated.
4. `docs/implementation/README.md`: Master implementation plan index updated.
5. `CHANGELOG.md`: Appended version 6.50.0 release notes.

---

## 5. Architecture Decisions
1. **Client-Side Token Replacement for Offline Resilience:** Rather than sending raw uploaded templates to a server endpoint for parsing, the interpolation engine executes client-side. This ensures that air-gapped retail POS terminals can download or spool `.prn` files even when network access to backend API compilers is intermittent.
2. **Dual-Syntax Token Support:** The parser supports both modern bracket tokens (`{style_code}`, `{barcode}`, `{colour}`, `{size}`, `{mrp}`) and legacy hash tokens (`#STYLE#`, `#BARCODE#`), while retaining an intelligent sample-literal fallback for pre-rendered BarTender/ZebraDesigner samples.
3. **Flexbox Containment vs. Fixed Positioning:** Replaced viewport-pinned `fixed bottom-0` with container-scoped `shrink-0` flexbox styling. This prevents overlap collisions with the global SMRITI shell status bar.

---

## 6. Design Rationale
- **Direct Script Ingestion:** Operators often receive custom `.prn` files from footwear manufacturers or specialized barcode label vendors. Previously, uploading these files only changed the filename dropdown, discarding the script body. Reading and executing the actual script text ensures 100% fidelity to vendor label designs.
- **Operator Keyboard Ergonomics:** Retail checkout staff require keyboard-only speed. Surfacing `[F8]` on the primary CTA and binding it to a native key listener eliminates mouse hunting during heavy batch print runs.

---

## 7. Implementation Summary
- **Token Parser Engine:**
  - Bracket replacement: `{barcode}`, `{style_code}`, `{brand}`, `{product}`, `{colour}`, `{size}`, `{mrp}`, `{selling_price}`, `{pkd_date}`.
  - Multi-copy batch expansion: Repeats each template block according to `item.labelCount`.
  - Protocol detector: Inspects text markers (`^XA` for ZPL, `\x02L` or `D11` for DPL, `SIZE` for TSPL).
- **UI Integration:**
  - Upload input: Reads file asynchronously using HTML5 `file.text()`.
  - Active indicator badge: Displays `✓ Script Active ({N} lines, {PROTOCOL})` with a 1-click `Clear` button.
  - Table rendering: Expanded product title width to prevent premature text truncation.
  - Footer layout: Docked flex container above the window bottom boundary.

---

## 8. Tests Executed
1. `npx vitest run src/tests/prnInterpolation.test.ts src/tests/tagPrinting.test.ts` (29/29 passed in 544ms).
2. `npx vitest run src/tests/printLabelsStudio.test.ts` (23/23 passed in 723ms).
3. `pytest backend/tests/test_zpl_footwear_label.py` (13/13 passed in 16.58s).
4. `npx tsc --noEmit` (0 errors).
5. `python scripts/validate_zpl_footwear_template.py` (8/8 gates passed).

---

## 9. Verification Results
```text
✓ src/tests/prnInterpolation.test.ts (7 tests) 9ms
✓ src/tests/tagPrinting.test.ts (22 tests) 14ms
✓ src/tests/printLabelsStudio.test.ts (23 tests) 44ms
✓ backend/tests/test_zpl_footwear_label.py (13 tests) 16.58s
✓ TypeScript Monorepo Compilation: 0 errors
✓ ZPL Footwear Raster Pixel Alignment: 0 overlap
```

---

## 10. Known Limitations
- Static templates lacking any tokens or recognized sample numbers (`890100000006`, `CH-30-K`) cannot have dynamic data injected and will print as raw static designs.

---

## 11. Future Work
- Visual preview drawer that parses interpolated ZPL/DPL commands into an immediate client-side SVG bitmap representation.
- Dynamic drag-and-drop token insertion toolbar for the in-app Script Designer view.

---

## 12. Related ADRs
- `ADR-048`: Client-Side Multi-Protocol Thermal Printing Abstraction.
- `ADR-062`: POS Keyboard Ergonomics & Single-Key Transaction Routing.

---

## 13. Related RFCs
- `RFC-2026-09`: Dynamic Thermal Template Token Standard (DTTS).
