<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.48.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- SMRITI Walkthrough Governance Policy (WGP) v1.0
-->

# Barcode & Hardware: SMRITI Print Labels Studio V2 Feature Parity & Operational Modernization Walkthrough (v6.48.0)

## 1. Purpose
This walkthrough documents the full ergonomic and operational modernization of SMRITI Print Labels Studio (`src/components/barcode/PrintLabelsStudio.tsx`), closing all feature gaps identified in comparison with the legacy standalone "Label Studio V2" (previously running on `http://localhost:8765/barcode`).

This release delivers 6 high-productivity capabilities:
1. 1-Click Footwear / Apparel Variant Matrix Expansion (`[Load Variants]`)
2. Live Pre-Print Data Sanitizer card checking for duplicate barcodes, missing sizes, missing colors, and zero prices
3. Recent Print Jobs drawer with 1-Click Reprint buttons backed by `GET /api/v1/barcode/print-history`
4. Direct Raw PRN Code Editor modal and instant `.prn` text download
5. Dynamic Label Token Mapping Reference modal explaining placeholder syntax
6. Image-to-Hex monochrome Zebra ZPL `^GFA` converter with persistent hardware connection diagnostics (`● QZ Connected`, `[Ping IP]`, `[Test Print]`)

---

## 2. Scope
- **Component Enhancements:** `src/components/barcode/PrintLabelsStudio.tsx` updated to version `6.48.0` with state management, pure exportable sanitizer/compiler helpers, and modals.
- **Pure Domain Algorithms:**
  - `runPrePrintSanitizer`: Fast set-based detection of barcode collisions, missing dimensions, and invalid pricing.
  - `compilePrnString`: Deterministic compiler supporting 100x50.7mm footwear 3-stub ZPL and standard retail formats.
  - `downloadPrnFile`: Standard HTML5 blob-driven `.prn` download.
  - `generateFootwearVariantMatrix`: 6-variant footwear size curve generator (37–42) with authentic EAN-13 barcodes.
  - `convertCanvasToZplGfa`: 1-bit monochrome image thresholding canvas emitting Zebra `^GFA` graphic hex code.
- **Automated Verification:** `src/tests/printLabelsStudio.test.ts` expanded from 11 to 16 unit tests, covering sanitizer rules, variant curves, and PRN compilation.
- **Full TypeScript Certification:** Zero compiler errors (`tsc --noEmit` exit code 0).
- **Backend Stability:** `11/11` pytest tests green across barcode test suites.

---

## 3. Files Created
- `docs/implementation/inventory/Barcode_PrintLabelsStudio_V2_Parity_Plan_v6.48.0.md`: Full 19-section Implementation Plan.
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_V2_Parity_v6.48.0.md`: This 13-section WGP walkthrough document.

---

## 4. Files Modified
- `src/components/barcode/PrintLabelsStudio.tsx`:
  - Added icon imports (`Code`, `FileText`, `BookOpen`, `Image`, `History`, `CheckCircle2`, `Activity`, `Grid`, `Plus`, `Copy`, `Check`, `ShieldAlert`).
  - Added export helpers: `SanitizerReport`, `runPrePrintSanitizer`, `compilePrnString`, `downloadPrnFile`, `generateFootwearVariantMatrix`, `convertCanvasToZplGfa`.
  - Added top header buttons: `[Mapping Reference]`, `[Image to Hex (PRN)]`.
  - Added worksheet action toolbar: `[Load Variants]`, `[+ Add Custom Item]`, `[Download PRN]`, `[Direct Raw PRN]`.
  - Added Pre-Print Sanitizer card with live issue badges and `⚡ Auto-Sanitize & Fix Issues` trigger.
  - Added Recent Jobs & 1-Click Reprint card fetching from `/api/v1/barcode/print-history`.
  - Added persistent printer connection diagnostics in Step 3 (`● QZ Tray Connected`, `[Ping IP]`, `Zebra ZPL-II Driver`).
  - Mounted modals for Direct Raw PRN, Mapping Reference, Image to Hex converter, and Add Custom Item.
- `src/tests/printLabelsStudio.test.ts`:
  - Added 5 new unit tests verifying sanitizer dirty/clean cases, variant curve generation, and PRN compilation for 3-stub and standard formats.
  - Version bumped to `6.48.0`.
- `docs/implementation/README.md`: Appended `v6.48.0` implementation plan to master index table.
- `docs/walkthrough/README.md`: Appended `v6.48.0` walkthrough entry to master index table.
- `CHANGELOG.md`: Added release notes for `[6.70.28] - 2026-10-08 (v6.48.0)`.

---

## 5. Architecture Decisions
1. **Decoupled Pure Business Functions for Sanitization & Compilation:**
   The sanitization logic (`runPrePrintSanitizer`) and PRN string compilation (`compilePrnString`) are implemented as pure, side-effect-free TypeScript functions exported from the module. This enables fast, isolated unit testing without mounting heavy DOM trees or requiring active WebSocket connections.
2. **Client-Side Size Curve Generation with Backend Fallback:**
   When warehouse operators search for an article number (e.g. `CH-30-K`) and click `[Load Variants]`, the system attempts to resolve matching records via `GET /api/v1/products?search=...`. If the product is not yet fully unrolled or the network is constrained, the engine deterministically generates the standard 6-size footwear matrix (37 to 42) with valid EAN-13 barcodes so printing is never blocked.
3. **In-Browser 1-Bit Monochrome Image Thresholding:**
   The `Image to Hex (PRN)` utility uses HTML5 `<canvas>` grayscale luminance calculation (`0.299*R + 0.587*G + 0.114*B`) and thresholding directly in the client. This avoids server roundtrips, preserves confidentiality of uploaded brand assets, and generates exact Zebra `^GFA` hex bytes compatible with all ZPL-II thermal printers.
4. **Idempotent 1-Click Reprinting:**
   The Recent Jobs card connects directly to the canonical database log (`PrintHistory` table via `/api/v1/barcode/print-history`). Clicking `[Reprint]` dispatches the exact item, quantity, and layout to the active printer target without requiring the operator to re-enter worksheet rows.

---

## 6. Design Rationale
In high-velocity warehouse and dispatch environments:
- Operators do not want to checkmark individual variant sizes one by one. The `[Load Variants]` button populates all 6 sizes in a single click.
- Printing labels with duplicate barcodes or missing sizes creates expensive returns and rework. The `Pre-Print Sanitizer` catches errors before physical paper is spooled.
- Reprints of damaged or lost labels should take exactly 1 click from the sidebar rather than an entire workflow restart.
- Hardware connectivity should be transparent: the `Ping IP` and QZ connection badges provide instant feedback when troubleshooting network printers.

---

## 7. Implementation Summary
| Feature | UI Location | Implementation Detail |
|---|---|---|
| **1-Click Load Variants** | Worksheet Action Toolbar | Queries backend or falls back to `generateFootwearVariantMatrix`; unrolls sizes 37–42 with EAN-13 codes. |
| **Pre-Print Sanitizer** | Right Sidebar Card | Scans worksheet rows for duplicate barcodes, missing sizes/colors, and zero prices; offers `Auto-Sanitize & Fix`. |
| **Recent Jobs & Reprint** | Right Sidebar Card | Pulls from `GET /api/v1/barcode/print-history`; renders recent batches with instant `[Reprint]` buttons. |
| **Direct Raw PRN Editor** | Worksheet Action Toolbar | Monospace modal with snippet insertion (`Footwear 3-Stub`, `Retail 50x25`), direct socket print, and download. |
| **Download PRN File** | Worksheet Action Toolbar | Compiles selected items into raw ZPL script and triggers instant browser `.prn` text download. |
| **Mapping Reference** | Top Header | Modal detailing all available replacement tokens (`{barcode}`, `{art_no}`, `{mrp}`, `{size}`, `{color}`, etc.). |
| **Image to Hex (PRN)** | Top Header | Upload logo, adjust threshold, render 1-bit canvas, and generate Zebra `^GFA` graphic hex code. |
| **Hardware Diagnostics** | Step 3 Print Setup | Persistent status badge (`● QZ Tray: Connected`), `[Ping IP]` latency test, and `[Test Print]` trigger. |

---

## 8. Tests Executed
1. **Frontend Vitest Test Suite (`src/tests/printLabelsStudio.test.ts`):**
   - 16/16 tests passed (100% green).
   - Validated pre-print sanitizer dirty scenario with duplicate barcodes, missing sizes, missing colors, and zero MRP.
   - Validated pre-print sanitizer clean scenario with 0 warnings.
   - Validated variant matrix expansion across all 6 sizes with distinct EAN-13 barcodes.
   - Validated raw PRN compiler for 100x50.7mm footwear 3-stub layout with reverse boxes and tear-off stubs.
   - Validated raw PRN compiler for standard 50x25mm retail labels.
2. **TypeScript Compiler Check (`tsc --noEmit`):**
   - Exit code 0, 0 compiler errors.
3. **Backend Pytest Suites:**
   - `backend/app/tests/test_barcode_client_prn_dynamic.py` (4/4 passed).
   - `backend/app/tests/test_barcode.py` (7/7 passed).
   - Total: 11/11 backend tests passed.

---

## 9. Verification Results
```text
✓ Vitest Test Suite (src/tests/printLabelsStudio.test.ts): 16/16 passed
✓ TypeScript Compiler (tsc --noEmit): Exit code 0 (0 errors)
✓ Pytest Barcode Suite (test_barcode_client_prn_dynamic.py + test_barcode.py): 11/11 passed
✓ Zero Database Schema Alterations
✓ Zero Regressions on Existing Footwear 3-Stub Layout
```

---

## 10. Known Limitations
- The `Image to Hex` converter scales images to a maximum width of 240 dots to prevent overflowing Zebra printer buffer limits on standard 203 DPI heads. High-resolution logos should be scaled to appropriate dot dimensions before uploading.

---

## 11. Future Work
- Add custom font sizing sliders directly in the visual designer.
- Add support for TSPL (TSC printers) and ESC-POS (receipt printers) syntax alongside Zebra ZPL-II.

---

## 12. Related ADRs
- `ADR-0042`: Barcode Architecture and Thermal Hardware Spooling Standards.

---

## 13. Related RFCs
- `RFC-8594`: Sunset and Deprecation HTTP Header Compliance.
- `RFC-4180`: Common Format and MIME Type for CSV Data.
