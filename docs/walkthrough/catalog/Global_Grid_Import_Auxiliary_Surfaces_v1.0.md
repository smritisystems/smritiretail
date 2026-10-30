<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.63.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough: Global Grid Import Standard Rollout — Auxiliary & Secondary Surface Parser Modernization

**Version:** 6.63.0  
**Area:** Catalog, Sales & Operations / Multi-Surface Parser Harmonization  
**Date:** 2026-10-03  
**Status:** Completed  
**Branch:** `smritiNX`  

---

## 1. Purpose
Following the core transactional grid import rollout across Billing, Goods Receipt (GRN), Item Master Studio, WMS Stock Transfers, and Purchase Orders, a forensic audit of the entire codebase identified lingering private string/delimiter splitters in auxiliary and secondary workspaces (`ItemDetailsGridTab.tsx`, `SalesStudioTab.tsx`, `LabelPrintingSec.tsx`, and `StandaloneWindowView.tsx`). These isolated parsers lacked multi-delimiter auto-detection, failed on quoted CSV/TSV cells containing commas or tabs, and duplicated parsing state machines. This phase harmonizes all four remaining auxiliary ingestion surfaces onto `GridInputEngine.parseDelimitedText`, achieving 100% elimination of ad-hoc string and delimiter splitters across SMRITI Retail OS.

---

## 2. Scope
1. **Item Master Tactical Grid Paste Intake (`ItemDetailsGridTab.tsx`)**:
   - Modernized `handleAnalysePaste` to parse incoming clipboard content using `GridInputEngine.parseDelimitedText(pastedRawText).matrix`.
   - Eliminated naive `pastedRawText.split(/\r\n|\n|\r/)` and `lines.map(l => l.split("\t"))`.
   - Granted RFC 4180 quotation protection, multi-delimiter autodetection (`\t`, `,`, `;`, `|`, `~`), and Excel clipboard TSV quote unwrapping to tactical grid pasting.
2. **Sales Studio Customer Delimited Text Ingestion (`SalesStudioTab.tsx`)**:
   - Replaced private monolithic comma-only `parseCSV` state machine with `GridInputEngine.parseDelimitedText(text).matrix`.
   - Enabled drag-and-drop and file upload of TSV, semicolon, pipe, and quoted CSV customer files with embedded commas, quotes, or newlines.
3. **Barcode Label Printing Section Ingestion (`LabelPrintingSec.tsx`)**:
   - Replaced manual line/delimiter splitting in `parseCsv` with `GridInputEngine.parseDelimitedText(csvText)`.
   - Enabled robust whitespace-trimmed column mapping, dynamic custom rates, and quote unescaping.
4. **Standalone Terminal Window Import Staging (`StandaloneWindowView.tsx`)**:
   - Modernized `parseImportedText` to utilize `GridInputEngine.parseDelimitedText(text).matrix`.
   - Eradicated bespoke `parseImportLine` and candidate delimiter counting heuristics.
5. **Unit Test Suite (`src/tests/auxiliaryGridIntake.test.ts`)**:
   - Built comprehensive automated Vitest test suite validating all four auxiliary surfaces.

---

## 3. Files Created
- `src/tests/auxiliaryGridIntake.test.ts`
- `docs/walkthrough/catalog/Global_Grid_Import_Auxiliary_Surfaces_v1.0.md`

---

## 4. Files Modified
- `src/components/itemMaster/tabs/ItemDetailsGridTab.tsx`
- `src/components/SalesStudioTab.tsx`
- `src/components/LabelPrintingSec.tsx`
- `src/components/standalone/StandaloneWindowView.tsx`
- `package.json`
- `src/config/version.ts`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`
- `docs/implementation/inventory/Global_Grid_Input_And_Import_Standard_Plan_v1.0.md`

---

## 5. Architecture Decisions
- **Unified Engine Matrix Protocol**: Rather than introducing new component interfaces or disrupting downstream consumers, auxiliary components access `GridInputEngine.parseDelimitedText(text).matrix` (`string[][]`). Downstream column mappers, customer validation gates, and layout elements receive cleaned tokens with unescaped internal quotes and BOM markers stripped.
- **Zero Third-Party Dependencies**: Retained zero external frontend library additions. All parsing logic runs through the vanilla TypeScript RFC 4180 state machine in `GridInputEngine`.

---

## 6. Design Rationale
- Private, ad-hoc string splitters are prone to failure whenever users paste spreadsheet cells with commas inside quotes (e.g. `"AITDL Networks, Inc."` or `"Classic Cotton Shirt, Blue"`). Using `GridInputEngine` across all surfaces ensures consistent behavior regardless of where tabular data enters the system.

---

## 7. Implementation Summary
- **`ItemDetailsGridTab.tsx`**: Imported `GridInputEngine` and swapped naive `l.split("\t")` with `GridInputEngine.parseDelimitedText(pastedRawText).matrix`.
- **`SalesStudioTab.tsx`**: Updated `parseCSV(text: string)` to return `GridInputEngine.parseDelimitedText(text).matrix`, ensuring backward compatibility for customer ingestion and server-side validation.
- **`LabelPrintingSec.tsx`**: Updated `parseCsv` to use `GridInputEngine.parseDelimitedText(csvText)`, using `matrix[0]` as `rawHeaders` and iterating `matrix.slice(1)` as row data.
- **`StandaloneWindowView.tsx`**: Deleted private `parseImportLine` and simplified `parseImportedText` to consume `GridInputEngine.parseDelimitedText(text).matrix`.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/auxiliaryGridIntake.test.ts src/tests/grnGridIntake.test.ts src/tests/itemMasterStudioIntake.test.ts src/tests/barcodeManagementIntake.test.ts src/tests/globalGridInputEngine.test.ts src/tests/poGenerateUX.test.ts src/tests/poSizewiseUX.test.ts src/tests/itemGrid.test.ts
```

---

## 9. Verification Results
- **Vitest**: 102/102 tests passed across 8 suites (100% green).
- **TypeScript**: `npx tsc --noEmit` exit 0 (zero compiler errors).
- **Version SSOT**: `scripts/validate_version_ssot.py` clean pass on `6.63.0`.

---

## 10. Known Limitations
- Auxiliary surfaces still perform local column index lookup rather than presenting the full `GlobalGridImportModal` pre-commit UI. Full modal conversion can be scheduled if users require live visual mapping re-assignment on these auxiliary screens.

---

## 11. Future Work
- Consolidate legacy standalone window import modals with `GlobalGridImportModal`.
- Extend batch product resolution to customer lookup endpoints if bulk customer imports exceed 500 rows.

---

## 12. Related ADRs
- `docs/architecture/ADR_GLOBAL_PRODUCT_RESOLUTION.md`

---

## 13. Related RFCs
- `RFC-GRID-IMPORT-STANDARD-v1.0`
