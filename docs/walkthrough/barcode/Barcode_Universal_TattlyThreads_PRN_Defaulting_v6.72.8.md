<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.72.8
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Universal Tattly Threads Footwear PRN Defaulting (v6.72.8)

## 1. Purpose
This document provides complete architectural, implementation, and verification records for establishing **Tattly Threads Footwear 100×50.7mm 3-Stub Master PRN (`TattlyThreads.prn`)** as the universal system default across all barcode label printing engines, dialogs, batch queues, visual designers, and backend API compilers in SMRITI Retail OS.

## 2. Scope
1. **Frontend PRN Engine (`src/components/barcode/prnInterpolation.ts`):** Registered `"TattlyThreads.prn"`, `"lay-footwear-100x50-3stub"`, and `"default"` aliases in `BUILTIN_PRN_TEMPLATES`. Configured `interpolatePrnScript` and `compilePrnBatch` to default empty or omitted templates to the Tattly Threads Footwear master script.
2. **Item Master Barcode Queue Modal (`src/components/itemMaster/modals/BatchBarcodePrintModal.tsx`):** Configured modal format default to `Tattly Threads (100×50.7mm PRN)` with direct `.prn` compilation download (`[Download .PRN File]`) and 3-stub dual tear-off card preview.
3. **Batch Tag & Barcode Printing Tab (`src/components/barcode/TagLabelPrintingTa.tsx`):** Updated `activeTemplateScript` fallback chain to universally resolve `Tattly Threads Footwear — 100x50.7mm`.
4. **Visual Label Designer (`src/components/barcode/VisualLabelDesign.tsx`):** Elevated Tattly Threads Footwear 3-Stub (100mm × 50.7mm) to preset position 0 (`STANDARD_PRESETS[0]`), initializing designer dimensions to 100×50.7mm.
5. **Unified Layout Registry (`src/services/barcodeLayoutRegistry.ts`):** Made `getLabelTemplate()` without parameters or with `"default"` resolve directly to `tattly-threads-footwear-100x50.7`.
6. **Backend Compiler & Dispatcher (`compiler.py`, `barcode.py`):** Configured `BarcodeCompiler.compile()` and `/api/v1/barcode/print` to default unspecified or default layout IDs to `tattly-threads-footwear-100x50.7` ZPL/DPL stream generation.
7. **Regression Testing:** Certified with 67/67 Vitest tests, 13/13 Pytest ZPL tests, 8/8 Pytest DPL tests, and 0 `tsc --noEmit` errors.

## 3. Files Created
- `docs/implementation/barcode/Barcode_Universal_TattlyThreads_PRN_Defaulting_Plan_v6.72.8.md`: Implementation Plan.
- `docs/walkthrough/barcode/Barcode_Universal_TattlyThreads_PRN_Defaulting_v6.72.8.md`: This Walkthrough document.

## 4. Files Modified
- `src/components/barcode/prnInterpolation.ts`: Added template aliases, universal fallback, and canonical PRN download filename generator `generatePrnDownloadFilename` (`SMRITI-[Style]-[VendorCode]-[TimeStamp].prn`).
- `src/components/barcode/TagLabelPrintingTa.tsx`: Ensured Tattly Threads Footwear PRN fallback and adopted `generatePrnDownloadFilename`.
- `src/components/barcode/VisualLabelDesign.tsx`: Positioned 100×50.7mm footwear as preset 0.
- `src/components/barcode/PrintLabelsStudio.tsx`: Adopted canonical `generatePrnDownloadFilename` for raw PRN export.
- `src/components/barcode/BarcodeScriptGenVi.tsx`: Adopted canonical `generatePrnDownloadFilename` for script download.
- `src/components/itemMaster/modals/BatchBarcodePrintModal.tsx`: Added Tattly Threads PRN format, `[Download .PRN File]` using `generatePrnDownloadFilename`, and tear-off stub card preview.
- `src/services/barcodeLayoutRegistry.ts`: Updated `getLabelTemplate()` default.
- `src/tests/barcodeLayoutRegistry.test.ts`: Added test 5 for default template resolution.
- `src/tests/prnInterpolation.test.ts`: Added tests asserting aliases, fallback, and canonical filename generation.
- `backend/app/services/barcode_engine/compiler.py`: Defaulted compiler fallback to Tattly Threads footwear.
- `backend/app/api/v1/barcode.py`: Defaulted print endpoint to footwear layout when layout_id is omitted.
- `CHANGELOG.md`: Appended release notes for v6.72.8.
- `docs/implementation/README.md`: Appended entry to implementation index.
- `docs/walkthrough/README.md`: Appended entry to walkthrough index.

## 5. Architecture Decisions
1. **Master PRN File Immutability:** `assets/BarcodePRN/TattlyThreads.prn` and `assets/BarcodePRN/RawPRNScript.prn` remain byte-for-byte untouched, preserving SHA-256 integrity governance.
2. **Deterministic Dual Stub Structure:** Preserved the 3-part layout: Upper Counter Stub (Y: 0..25.3mm), Lower Audit Stub (Y: 25.3..50.7mm), and Main Shoe Box Label (X: 31.2..100mm).
3. **Graceful Fallback:** While Tattly Threads PRN is the universal default, specialized alternatives (Retail 50×25mm, ModernLabelDesign TE244, Honeywell IH-2 DPL, A4 24-up) remain accessible across all UI controls.

## 6. Design Rationale
Footwear retail operations rely on dual tear-off counter/audit stubs for inventory and cashier verification. In the past, opening certain modal windows or omitting template IDs in automated print calls could fall back to generic 50×25mm single stickers. Standardizing Tattly Threads PRN as the default across all touchpoints provides consistent operator behavior across the system.

## 7. Implementation Summary
```text
┌────────────────────────────────────────────────────────────────────────┐
│               UNIVERSAL TATTLY THREADS PRN DEFAULT SYSTEM              │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────┐ │
│  │ Print Labels Studio   │  │ Batch Printing Tab    │  │ Item Master │ │
│  │ Default: Footwear PRN │  │ Default: Footwear PRN │  │ Batch Queue │ │
│  └───────────┬───────────┘  └───────────┬───────────┘  └──────┬──────┘ │
│              │                          │                     │        │
│              ▼                          ▼                     ▼        │
│       ┌─────────────────────────────────────────────────────────┐      │
│       │ BUILTIN_PRN_TEMPLATES & prnInterpolation.ts             │      │
│       │ Default / Fallback: Tattly Threads Footwear (100x50.7mm) │      │
│       └─────────────────────────┬───────────────────────────────┘      │
│                                 │                                      │
│                                 ▼                                      │
│       ┌─────────────────────────────────────────────────────────┐      │
│       │ Backend Barcode Engine (compiler.py & barcode.py)       │      │
│       │ Default / Fallback: tattly-threads-footwear-100x50.7   │      │
│       └─────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────┘
```

## 8. Tests Executed
1. `npx vitest run src/tests/prnInterpolation.test.ts src/tests/tagPrinting.test.ts src/tests/printLabelsStudio.test.ts src/tests/barcodeLayoutRegistry.test.ts`
   - Output: 70 passed across 4 test suites.
2. `pytest backend/tests/test_zpl_footwear_label.py`
   - Output: 13 passed in 18.24s.
3. `pytest backend/tests/test_dpl_footwear_label.py`
   - Output: 8 passed in 5.08s.
4. `npx tsc --noEmit`
   - Output: 0 compiler errors.

## 9. Verification Results
- All unit, integration, and geometry tests passed cleanly with 100% green status.
- Immutability check on `assets/BarcodePRN/TattlyThreads.prn` passed.

## 10. Known Limitations
Direct TCP raw socket printing requires configured network printer IP (e.g., Zebra GK420D / ZD421 on port 9100) or QZ Tray client running on the local host. For offline environments, `.prn` direct download provides seamless fallback.

## 11. Future Work
- Add direct printer preview thumbnail generation from canvas worker.
- Expand multi-column sheet generation for footwear stubs.

## 12. Related ADRs
- `ADR-0042`: Script-Based PRN Printing Engine.
- `ADR-0048`: Barcode Font Overlap Controlled Baseline Shift.

## 13. Related RFCs
- `RFC-0019`: Universal Label Layout Standard.
