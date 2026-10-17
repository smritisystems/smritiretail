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

# Implementation Plan: Universal Tattly Threads PRN Defaulting (v6.72.8)

## 1. Objective
Establish the 100mm × 50.7mm 3-Part Footwear Box Label with Dual Counter Tear-Off Stubs (`TattlyThreads.prn`) as the authoritative, system-wide default barcode label printing template across all application dialogs, batch queues, visual designers, token interpolation engines, and backend API compilers.

## 2. Business Motivation
In retail footwear enterprise operations, printing barcodes with dual tear-off counter/audit stubs is critical for inventory control, store operations, cashier tear-offs, and compliance with Legal Metrology rules (MRP incl. taxes, packed date, net contents, company address, customer care email). Standardizing Tattly Threads PRN as the default ensures zero operator friction and prevents accidental fallbacks to generic retail 50×25mm stickers.

## 3. Scope
- Frontend token engine (`src/components/barcode/prnInterpolation.ts`).
- Front-end batch printing tab (`src/components/barcode/TagLabelPrintingTa.tsx`).
- Barcode layout registry (`src/services/barcodeLayoutRegistry.ts`).
- Visual Label Designer (`src/components/barcode/VisualLabelDesign.tsx`).
- Item Master batch barcode modal (`src/components/itemMaster/modals/BatchBarcodePrintModal.tsx`).
- Backend compilation engine (`backend/app/services/barcode_engine/compiler.py`).
- Backend API print dispatcher (`backend/app/api/v1/barcode.py`).
- Vitest and Pytest test suites.

## 4. Current State
- `PrintLabelsStudio.tsx` already selected `lay-footwear-100x50-3stub` by default.
- `BarcodeScriptGenVi.tsx` already auto-loaded `TattlyThreads.prn`.
- However, `prnInterpolation.ts` had no `"default"` or `"TattlyThreads.prn"` alias.
- `TagLabelPrintingTa.tsx` fallback resolved `Retail 50x25mm Standard`.
- `BatchBarcodePrintModal.tsx` lacked Tattly Threads PRN layout and PRN download capability.
- `VisualLabelDesign.tsx` defaulted to 50×25mm.
- `compiler.py` defaulted to `retail-50x25`.

## 5. Gap Analysis
Universal alignment required registering aliases, ensuring fallback chains resolve to Tattly Threads 100×50.7mm, exposing PRN download in batch queues, and certifying regression suites.

## 6. Architecture Impact
- **Non-breaking**: All specialized templates (`Retail 50x25mm`, `ModernLabelDesign_TE244.blf`, `Honeywell_IH2_DualStub.prn`) remain accessible via explicit selection.
- **Immutability Preserved**: `assets/BarcodePRN/TattlyThreads.prn` remains 100% byte-for-byte immutable per SHA-256 integrity governance.

## 7. Proposed Design
1. Register `"TattlyThreads.prn"`, `"lay-footwear-100x50-3stub"`, and `"default"` in `BUILTIN_PRN_TEMPLATES`.
2. Fall back to Tattly Threads Footwear PRN if `templateText` is empty in `interpolatePrnScript` and `compilePrnBatch`.
3. Provide canonical PRN download filename generator `generatePrnDownloadFilename` producing `SMRITI-[Style]-[VendorCode]-[TimeStamp].prn`.
4. Update `TagLabelPrintingTa.tsx` fallback to Tattly Threads Footwear and adopt `generatePrnDownloadFilename`.
5. Update `BatchBarcodePrintModal.tsx` to default to `Tattly Threads PRN (100×50.7mm)` and provide `[Download .PRN File]` using `generatePrnDownloadFilename`.
6. Update `VisualLabelDesign.tsx` preset 0 to Tattly Threads Footwear 100×50.7mm.
7. Update `PrintLabelsStudio.tsx` and `BarcodeScriptGenVi.tsx` to use canonical filename generation.
8. Update `getLabelTemplate()` to default to `tattly-threads-footwear-100x50.7`.
9. Update `compiler.py` and `barcode.py` fallbacks to Tattly Threads footwear layout.

## 8. Files Created
- `docs/implementation/barcode/Barcode_Universal_TattlyThreads_PRN_Defaulting_Plan_v6.72.8.md`
- `docs/walkthrough/barcode/Barcode_Universal_TattlyThreads_PRN_Defaulting_v6.72.8.md`

## 9. Files Modified
- `src/components/barcode/prnInterpolation.ts`
- `src/components/barcode/TagLabelPrintingTa.tsx`
- `src/components/barcode/VisualLabelDesign.tsx`
- `src/components/barcode/PrintLabelsStudio.tsx`
- `src/components/barcode/BarcodeScriptGenVi.tsx`
- `src/components/itemMaster/modals/BatchBarcodePrintModal.tsx`
- `src/services/barcodeLayoutRegistry.ts`
- `src/tests/barcodeLayoutRegistry.test.ts`
- `src/tests/prnInterpolation.test.ts`
- `backend/app/services/barcode_engine/compiler.py`
- `backend/app/api/v1/barcode.py`
- `package.json`
- `src/config/version.ts`
- `backend/app/core/config.py`
- `src/components/billing/BillingWorkspace.tsx`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
No external dependencies added. Uses existing `lucide-react`, `vitest`, `pytest`, `fastapi`, and native browser `Blob` download APIs.

## 11. Risks
Risk: Changing default could impact users expecting 50×25mm retail stickers.
Mitigation: 50×25mm retail sticker option remains 1-click selectable across all screens.

## 12. Rollback Strategy
Git revert commits on modified files restores previous fallback behavior.

## 13. Verification Plan
1. Version SSOT: Run `py -3.13 scripts/validate_version_ssot.py`.
2. Vitest: Run 4 test files (`prnInterpolation.test.ts`, `tagPrinting.test.ts`, `printLabelsStudio.test.ts`, `barcodeLayoutRegistry.test.ts`).
3. Pytest: Run `test_zpl_footwear_label.py` and `test_dpl_footwear_label.py`.
4. TypeScript: Run `npx tsc --noEmit`.

## 14. Test Plan
- Unit tests asserting default template resolution.
- Batch repetition tests.
- Master hash immutability regression tests.

## 15. Documentation Impact
- Updated Walkthrough and Implementation indexes.
- Release entry in `CHANGELOG.md`.

## 16. Deployment Plan
Sync via standard `git pull` into test environments.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-0042`: Script-Based PRN Printing Engine.
- `ADR-0048`: Barcode Font Overlap Controlled Baseline Shift.

## 19. Related Walkthroughs
- `docs/walkthrough/barcode/Barcode_Universal_TattlyThreads_PRN_Defaulting_v6.72.8.md`
- `docs/walkthrough/barcode/Barcode_TattlyThreads_Barcode_Font_Overlap_Audit_v6.49.2.md`
- `docs/walkthrough/barcode/Barcode_Script_Based_Printing_And_UX_Validation_Walkthrough_v6.50.0.md`
