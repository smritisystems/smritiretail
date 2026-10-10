<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.61.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough: Global Grid Import Standard Rollout — Item Master Studio File Upload & Headerless Mode Hardening

**Version:** 6.61.0  
**Area:** Catalog & Master Data / Item Master Studio  
**Date:** 2026-10-03  
**Status:** Completed  
**Branch:** `smritiNX`  

---

## 1. Purpose
The purpose of this phase is to harden `ItemMasterStudio` intake capabilities in accordance with the **SMRITI Global Grid Input, Paste, Import & Product Resolution Standard**. While Phase 35 migrated the internal matrix parser to `GridInputEngine.parseDelimitedText`, operators importing large catalog datasets required direct file upload (`.csv`, `.tsv`, `.txt`), visual drag-and-drop intake, an official downloadable sample TSV template, explicit user control over header presence ("First row has headers" toggle), zero row loss in headerless mode, and sanitization of Excel cell quotation artifacts during tab-delimited paste.

---

## 2. Scope
1. **File Upload & Drag-and-Drop Dropzone**: Adding hidden file input and drag-and-drop visual indicators to `ItemMasterStudio.tsx` supporting `.csv`, `.tsv`, and `.txt` files up to several thousand rows.
2. **Template Download**: Client-side dynamic TSV template generation (`Item_Master_Import_Template.tsv`) with pre-populated headers and standard footwear SKU examples.
3. **Headerless Mode Preservation**: Ensuring that when "First row has headers" is unchecked or absent, 100% of rows (including row 0) are preserved as data rows and synthetic column identifiers (`Column 1`, `Column 2`, ...) are assigned.
4. **Excel TSV Quote Unwrapping**: Hardening `GridInputEngine.parseDelimitedText` for non-comma delimiters (e.g. tabs) to unwrap enclosing double-quotes and unescape internal quotes copied from spreadsheet applications.
5. **Automated Testing & Governance**: Unit testing intake mechanisms in `src/tests/itemMasterStudioIntake.test.ts` and synchronizing the Version SSOT to `6.61.0`.

---

## 3. Files Created
1. `src/tests/itemMasterStudioIntake.test.ts` — Dedicated Vitest test suite for Item Master Studio intake, testing Excel TSV quote sanitization, header auto-detection, 100% row preservation in headerless mode, and CSV comma handling.
2. `docs/walkthrough/catalog/Global_Grid_Import_Item_Master_File_Upload_And_Headerless_Mode_v1.0.md` — This walkthrough document.

---

## 4. Files Modified
1. `src/components/itemMaster/ItemMasterStudio.tsx`:
   - Added `hasHeaderRow` state with auto-detection sync via `mappingEngine.detectHeaderRow(matrix)`.
   - Updated `headerDetection` logic to return `headerRowIndex: -1`, `dataRows: matrix`, and synthetic headers when `!hasHeaderRow`.
   - Added `fileInputRef`, `isDraggingFile`, `handleFileSelect`, `handleFileDrop`, and `handleDownloadTemplate`.
   - Enhanced left panel UI with "Upload File" button, hidden input, "Template" button, drag-and-drop dropzone overlay, and "First row has headers" toggle.
   - Updated UADHP header version to `6.61.0`.
2. `src/services/gridInput/gridInputEngine.ts`:
   - Updated non-comma delimiter branch (`delimiter !== ","`) in `GridInputEngine.parseDelimitedText` to detect enclosing double quotes, trim them, and replace double quotes (`""` -> `"`).
   - Updated UADHP header version to `6.61.0`.
3. `package.json`:
   - Bumped version to `6.61.0`.
4. `src/config/version.ts`:
   - Bumped `APP_VERSION` and `ENTERPRISE_BILLING_SUITE_VERSION` to `6.61.0`.
5. `backend/app/core/config.py`:
   - Bumped `VERSION` setting and docstring to `6.61.0`.
6. `CHANGELOG.md`:
   - Added `[6.61.0]` release notes and updated header version.
7. `docs/walkthrough/README.md`:
   - Appended entry for this walkthrough in the master index table.

---

## 5. Architecture Decisions
- **Client-Side File Reading**: Used `FileReader.readAsText` with UTF-8 decoding to read dropped or selected text files immediately into the intake state without round-tripping to a server upload endpoint, maintaining instant client-side preview.
- **Explicit Header Toggle vs Auto-Detection**: While `mappingEngine.detectHeaderRow` provides intelligent heuristic detection, operators frequently paste supplier files where row 0 contains actual data values that look like text. The explicit "First row has headers" checkbox allows operators to override heuristic detection and guarantees row 0 is never lost.
- **Universal Non-Comma Quote Stripping**: When spreadsheet applications like Microsoft Excel or LibreOffice Calc copy rows to the clipboard as TSV, any cell containing commas, quotes, or newlines is wrapped in double quotes. By adding universal quote unwrapping in `GridInputEngine.parseDelimitedText`, all consumers of tab-separated text automatically receive clean values without quote pollution.

---

## 6. Design Rationale
- **Zero Loss Guarantee**: In catalog onboarding, losing row 0 means an entire SKU is dropped from inventory. In headerless mode, `dataRows` points directly to the un-sliced `matrix`, and `headerRowIndex` is set to `-1`.
- **Integrated Dropzone**: Rather than presenting a disjointed modal, the dropzone overlays the existing textarea, allowing operators to freely paste (`Ctrl+V`), type, or drag-and-drop `.csv`/`.tsv` files into the same workflow container.

---

## 7. Implementation Summary
- **Intake Actions**:
  - `handleFileSelect(e)`: Reads selected file, updates `pasteText`, resets file input, and clears dragging state.
  - `handleFileDrop(e)`: Intercepts `dragover`, `dragleave`, and `drop` events on the paste container, reading the first dropped `.csv`, `.tsv`, or `.txt` file.
  - `handleDownloadTemplate()`: Generates a UTF-8 TSV blob containing standard Item Master headers (`Article`, `Product Name`, `Barcode`, `Brand`, `Category`, `Sub Category`, `Size`, `Colour`, `HSN`, `GST%`, `MRP`, `Selling Price`, `Cost Price`, `Stock`) with footwear sample data, triggering browser download as `Item_Master_Import_Template.tsv`.
- **Headerless Column Mapping**:
  - When `!hasHeaderRow`, `headers` are synthesized as `Column 1, Column 2, ...` and `dataRows` equals `matrix`.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/itemMasterStudioIntake.test.ts src/tests/barcodeManagementIntake.test.ts src/tests/globalGridInputEngine.test.ts src/tests/poGenerateUX.test.ts src/tests/multiMap.test.ts src/tests/aliasMap.test.ts
```
Terminal Output:
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/aliasMap.test.ts (4 tests) 34ms
 ✓ src/tests/globalGridInputEngine.test.ts (19 tests) 26ms
 ✓ src/tests/itemMasterStudioIntake.test.ts (4 tests) 19ms
 ✓ src/tests/multiMap.test.ts (9 tests) 13ms
 ✓ src/tests/barcodeManagementIntake.test.ts (7 tests) 10ms
 ✓ src/tests/poGenerateUX.test.ts (11 tests) 11ms

 Test Files  6 passed (6)
      Tests  54 passed (54)
   Start at  12:21:12
   Duration  3.86s
```

TypeScript Compiler Verification:
```bash
npx tsc --noEmit
```
Terminal Output: Exit code 0 (zero errors).

Version SSOT Validator:
```bash
python scripts/validate_version_ssot.py
```
Terminal Output:
```text
--- SMRITI Version SSOT Inspection ---
package.json          : 6.61.0
backend/core/config.py: 6.61.0
src/config/version.ts : 6.61.0
CHANGELOG.md (head)   : 6.61.0

[PASS] Version SSOT consistent across all boundaries: 6.61.0
```

---

## 9. Verification Results
- `src/tests/itemMasterStudioIntake.test.ts`: 4/4 passed.
- All 6 grid intake test suites: 54/54 passed.
- TypeScript compilation: 0 errors.
- Version SSOT: Clean 4-way match on `6.61.0`.

---

## 10. Known Limitations
- File upload is limited to text-based delimited files (`.csv`, `.tsv`, `.txt`). Direct binary Excel workbook ingestion (`.xlsx`, `.xls`) is deferred to a future dedicated server-side or web-worker parser.

---

## 11. Future Work
- Add batch image upload association during catalog onboarding in `ItemMasterStudio`.
- Support column header re-ordering via drag-and-drop within the column mapping preview.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Client-Side Tabular Parsing with GridInputEngine.
- `ADR-0043`: Universal Header Mapping Engine and Flexible Aliases.

---

## 13. Related RFCs
- `RFC-2026-GRID-INPUT-01`: SMRITI Global Grid Input & Import Standard.
