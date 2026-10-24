<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.56.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: SMRITI Global Grid Input & Import Rollout
-->

# Walkthrough: Global Grid Import Standard Rollout — Barcode Label Studio & Physical Stock Audit

**Version:** `6.56.0`  
**Date:** 2026-10-03  
**Status:** Completed & Verified  

---

## 1. Purpose
Roll out the centralized SMRITI Global Grid Input, Paste, Import & Product Resolution Standard (`GlobalGridImportModal`, `GridInputEngine`, `GRID_PROFILES`) to secondary transaction and operational surfaces:
1. **Barcode Label Studio (`TagLabelPrintingTa.tsx`)**: Replace fragmented ad-hoc line-splitting with `GridInputEngine.parseDelimitedText` and integrate `GlobalGridImportModal` with `GRID_PROFILES.BARCODE_PRINTING`.
2. **Physical Stock Count & Verification Audit (`PhysicalStockTab.tsx`)**: Equip warehouse staff and store auditors with "Bulk Count Import (PDT / Excel / CSV)" allowing direct clipboard paste or file upload of hundreds of stock take lines with instant session line matching and quantity patching.

---

## 2. Scope
- Centralize file and clipboard ingestion in `src/components/barcode/TagLabelPrintingTa.tsx`.
- Enable multi-format bulk count updates in `src/components/PhysicalStockTab.tsx` (`SessionDetailModal`).
- Maintain 100% backward compatibility with existing single-barcode scanning and manual cell editing.
- Ensure strict TypeScript typing and 0 compile errors.

---

## 3. Files Created
None (central engine components from v6.55.0 were reused).

---

## 4. Files Modified
- `src/components/barcode/TagLabelPrintingTa.tsx`:
  - Imported `GridInputEngine`, `GRID_PROFILES`, `GlobalGridImportModal`, and `ParsedGridRow`.
  - Refactored `handlePdtFileUpload` to use `GridInputEngine.parseDelimitedText` and `GridInputEngine.mapColumns`.
  - Added `isGlobalImportOpen` state and `handleGlobalImportCommit`.
  - Added "Global Import (Excel / CSV / Scan)" button and rendered modal.
- `src/components/PhysicalStockTab.tsx`:
  - Imported `FileSpreadsheet`, `GlobalGridImportModal`, `GRID_PROFILES`, and `ParsedGridRow`.
  - Added `isBulkImportOpen` state and `handleBulkImportCommit` in `SessionDetailModal`.
  - Added "Bulk Count Import (PDT / Excel / CSV)" button to the count workspace.
  - Rendered `GlobalGridImportModal` with `GRID_PROFILES.STOCK_MOVEMENT`.
- `CHANGELOG.md`: Added release entry `[6.56.0]`.
- `package.json`, `backend/app/core/config.py`, `src/config/version.ts`: Synchronized to `6.56.0`.
- `docs/walkthrough/README.md`: Appended rollout walkthrough to master index.

---

## 5. Architecture Decisions
1. **Zero Greenfield Rewrite / Pure Reuse**: Directly leveraged `GlobalGridImportModal` and `GridInputEngine` created in v6.55.0. No custom parsing routines were introduced.
2. **Profile-Driven Configuration**:
   - `GRID_PROFILES.BARCODE_PRINTING` used in Barcode Studio (`ADD_AS_SEPARATE_ROWS`, default count = 1).
   - `GRID_PROFILES.STOCK_MOVEMENT` used in Physical Stock Count (`MERGE_ROWS`, atomic safety).
3. **Session Line Matching in Physical Audit**: Bulk imported rows match existing lines in the stock count session by `sku`, `product_id`, or resolved product identifiers, updating counted quantities and triggering live variance recalculations without mutating unrelated session metadata.

---

## 6. Design Rationale
- Retail warehouse personnel frequently receive physical stock verification files from portable data terminals (PDT) in tilde-separated format (`barcode~qty`), or maintain stock take logs in Microsoft Excel.
- Manually scanning hundreds of barcodes one-by-one or typing into table cells is error-prone and time-consuming.
- Reusing the Global Grid Input Standard provides consistent keyboard shortcuts (`Ctrl+V`), column mapping confidence chips, and instant validation previews across all document types.

---

## 7. Implementation Summary
```text
Spreadsheet / PDT File / Scan Stream
                 ↓
      GlobalGridImportModal
                 ↓
    GridInputEngine Parser & Mapper
                 ↓
    Batch Product Resolution API
                 ↓
       onCommit(rows, mode)
        ↙                ↘
Barcode Label Studio     Physical Stock Audit
(Queue LabelPrintRow)    (Patch Session Count Lines)
```

---

## 8. Tests Executed
1. `npx vitest run src/tests/tagPrinting.test.ts` (22/22 passed)
2. `npx vitest run src/tests/globalGridInputEngine.test.ts` (19/19 passed)
3. `npx vitest run src/tests/headerMap.test.ts` (13/13 passed)
4. `npx tsc --noEmit` (0 errors)
5. `scripts/validate_version_ssot.py` (Pass: 6.56.0)

---

## 9. Verification Results
All 54 tests across label printing and grid input passed. Full TypeScript compilation succeeded with zero errors. Version SSOT verified across all 4 boundaries.

---

## 10. Known Limitations
- Physical stock count import currently matches against items present in the active count session scope; items outside the scheduled stock take scope are ignored.

---

## 11. Future Work
- Add direct serial communication (WebSerial API) for tethered hardware PDT cradles in warehouse dispatch bays.

---

## 12. Related ADRs
- `docs/architecture/ADR_GLOBAL_PRODUCT_RESOLUTION.md`

---

## 13. Related RFCs
- `RFC-2026-CATALOG-GRID-IMPORT-001`
