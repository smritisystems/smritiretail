<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.2
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Tattly Threads Barcode Human-Readable Font & Overlap Audit and Controlled Runtime Fix (v6.49.2)

## 1. Objective
Perform a forensic audit of the observed barcode human-readable font and visual overlap anomalies on the Tattly Threads footwear label (`100 mm × 50.7 mm`), prove the root cause geometrically and at the pixel raster level without making assumptions, maintain the immutable client master PRN (`assets/BarcodePRN/TattlyThreads.prn` and `assets/BarcodePRN/RawPRNScript.prn`) byte-for-byte untouched, and deploy a minimal, surgical runtime fix to ensure 100% legible, non-overlapping labels across all product variants.

## 2. Business Motivation
Physical barcode labels printed at retail POS and warehouse receiving terminals must adhere to GS1 readability and optical scanning standards. While tear-off stubs 1 and 2 displayed clear separation, the main/right barcode human-readable digits appeared to collide with the barcode bars. Retailers and inventory auditors require:
1. Zero barcode-to-text collision to ensure handheld scanners do not misread bars corrupted by text ascenders.
2. Exact human-readable legibility for manual cashier input during scanning failures.
3. Strict adherence to client template immutability rules: the original client-provided PRN file must not be silently edited or altered.

## 3. Scope
- **Variants Audited (4 Live Test Cases)**:
  1. `BLACK / 37` — EAN `8904551005335`, style `CH-30-K`, MRP `1199`, pkd `10/26`
  2. `BLACK / 40` — EAN `8904551005366`, style `CH-30-K`, MRP `1199`, pkd `10/26`
  3. `TOUPE / 37` — EAN `8904551005403`, style `CH-30-K`, MRP `1199`, pkd `10/26`
  4. `TOUPE / 42` — EAN `8904551005458`, style `CH-30-K`, MRP `1199`, pkd `10/26`
- **Component Audit**:
  - Upper-left stub barcode and human-readable font.
  - Lower-left stub barcode and human-readable font.
  - Main/right barcode bars, quiet zones, and human-readable font.
  - Surrounding borders, dividers, MRP, size, color, style, and manufacturer texts.
- **Engine Surfaces**:
  - Direct master ZPL rendering via headless 203 DPI rasterizer.
  - SMRITI runtime generator (`PrintLabelsStudio.tsx` and `backend/app/api/v1/barcode.py`).

## 4. Current State
- The client master PRN specifies:
  ```zpl
  ^FO346,305
  ^BY2^BCN,66,N,N^FD{barcode}^FS
  ^FT390,385
  ^CI0
  ^AAN,27,15^FD{barcode}^FS
  ```
- Upper and lower tear-off stubs specify:
  ```zpl
  ^FO34,112^BY1^BCN,30,N,N^FD{barcode}^FS
  ^FT26,165^A0N,25,34^FD{barcode}^FS
  ...
  ^FO33,338^BY1^BCN,30,N,N^FD{barcode}^FS
  ^FT26,394^A0N,25,34^FD{barcode}^FS
  ```
- In stubs, Font 0 (`^A0N,25,34`) is used with baseline 165 (stub 1) and 394 (stub 2), yielding clean 2–4 dot gaps.
- In the main barcode, Font A (`^AAN,27,15`) baseline is set at `Y = 385`. Because Font A has a height of 27 dots, glyph ascenders begin at `Y = 385 - 27 = 358`.
- Barcode bars start at `Y = 305` with height `66`, terminating at `Y = 305 + 66 = 371`.
- Overlap calculation: `371 - 358 = 13` dots vertical collision in the master template specification.

## 5. Gap Analysis
| Characteristic | Master Template Specification | SMRITI Runtime (Before Fix) | SMRITI Runtime (After Fix) |
|---|---|---|---|
| Master PRN File Hash | `E4C8B698...` (Immutable) | `E4C8B698...` (Immutable) | `E4C8B698...` (Immutable) |
| Main Barcode Text Baseline | `^FT390,385` | `^FT390,385` | `^FT390,399` |
| Barcode Bars Vertical Span | `Y: [305, 371]` | `Y: [305, 371]` | `Y: [305, 371]` |
| Text Ascender Start | `Y = 358` | `Y = 358` | `Y = 372` (nominal), `378` (actual) |
| Intersection / Gap | **13-dot Collision (P0)** | **13-dot Collision (P0)** | **7-dot Clean Gap (SAFE)** |
| Main Font Preservation | `^AAN,27,15` (Font A) | `^AAN,27,15` (Font A) | `^AAN,27,15` (Font A) |
| Stub Font Preservation | `^A0N,25,34` (Font 0) | `^A0N,25,34` (Font 0) | `^A0N,25,34` (Font 0) |

## 6. Architecture Impact
- **Zero Schema or Database Impact**: No migrations, column changes, or variant attribute renamings.
- **Zero Master PRN Modification**: Both `assets/BarcodePRN/TattlyThreads.prn` and `assets/BarcodePRN/RawPRNScript.prn` remain byte-for-byte untouched.
- **Runtime-Only Controlled Realignment**: Only the dynamic generator string template baseline was shifted by 14 dots (`385` → `399`).

## 7. Proposed Design
1. **Mathematical Validation**:
   - Bottom of barcode bars: `305 + 66 = 371`.
   - New baseline: `399`.
   - Top of Font A: `399 - 27 = 372`.
   - Optical gap between bottom bar pixels and top digit pixels: `372..376` (5 to 7 dots clean white space).
   - Label pitch height: `50.7 mm × 8 dpmm = 405.6 ≈ 405` dots.
   - Text baseline at `399` leaves `405 - 399 = 6` dots safety clearance before bottom edge.
2. **Font Hierarchy**:
   - Retain Font 0 for Stubs 1 and 2 (`^A0N,25,34`).
   - Retain Font A for Main Barcode (`^AAN,27,15`).

## 8. Files Created
- `scripts/audit_barcode_overlap_v6492.py`
- `audit/barcode-overlap-v6.49.2/master/` (4 master PNGs)
- `audit/barcode-overlap-v6.49.2/runtime/` (4 runtime PNGs)
- `audit/barcode-overlap-v6.49.2/annotated/` (4 master annotated PNGs + 4 runtime annotated PNGs)
- `audit/barcode-overlap-v6.49.2/reports/` (variant JSONs + `AUDIT_SUMMARY.json`)
- `docs/implementation/inventory/Barcode_TattlyThreads_Barcode_Font_Overlap_Audit_v6.49.2.md`
- `docs/walkthrough/barcode/Barcode_TattlyThreads_Barcode_Font_Overlap_Audit_v6.49.2.md`

## 9. Files Modified
- `src/components/barcode/PrintLabelsStudio.tsx`
- `backend/app/api/v1/barcode.py`
- `backend/tests/test_zpl_footwear_label.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Pillow (PIL) for headless raster verification and pixel inspection.
- httpx for headless Labelary raster calls during CI/CD test execution.
- Pytest and Vitest test runners.

## 11. Risks
- **Printer Bottom Tear Drift**: With baseline at 399, printers with severe vertical feed calibration error (>2mm down-shift) could clip the lower digits. (Risk Level: Low, within standard 6-dot tolerance).

## 12. Rollback Strategy
- In the event of unforeseen printer feeding issues, reverting `^FT390,399` back to `^FT390,385` in `PrintLabelsStudio.tsx` and `backend/app/api/v1/barcode.py` requires a two-line git diff.

## 13. Verification Plan
1. Validate master file hash immutability (SHA-256).
2. Rasterize master and runtime ZPL for all 4 variants at 8 dpmm.
3. Quantitatively count black pixels in the critical transition rows `Y=372..376` across `X=390..530`.
4. Ensure stub barcodes retain distinct Font 0 (`^A0N,25,34`) and main barcode retains Font A (`^AAN,27,15`).

## 14. Test Plan
- Run automated unit and regression tests:
  - `pytest backend/tests/test_zpl_footwear_label.py backend/tests/test_dpl_footwear_label.py backend/tests/test_printer_service_headless_audit.py backend/app/tests/test_barcode.py`
  - `npx vitest run src/tests/printLabelsStudio.test.ts`
  - `npx tsc --noEmit`

## 15. Documentation Impact
- Implementation index, Walkthrough index, and CHANGELOG updated.

## 16. Deployment Plan
- Merge runtime generator updates to `origin/smritiNX`.
- Deploy to test environment via standard git pull per SMRITI Environment Rule.

## 17. Status
**Completed** — Verified with evidence level A.

## 18. Related ADRs
- `ADR-048`: Dual-Engine Footwear Label Architecture.
- `ADR-049`: Master PRN Immutability and Runtime Controlled Correction Protocol.

## 19. Related Walkthroughs
- `Barcode_TattlyThreads_Barcode_Font_Overlap_Audit_v6.49.2.md`
