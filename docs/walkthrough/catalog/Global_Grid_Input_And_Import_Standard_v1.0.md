<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.55.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Global Grid Input, Paste, Import & Product Resolution Standard

**Walkthrough ID:** WGP-CATALOG-GRID-IMPORT-v1.0  
**Version:** 6.55.0  
**Date:** 2026-10-03  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the centralized SMRITI Global Grid Input, Paste, Import & Product Resolution Standard across SMRITI Retail OS. It replaces duplicated, fragmented Excel/clipboard parsers and ad-hoc barcode lookups with a single authoritative engine and modal capability.

## 2. Scope
- **Universal Delimited Text Parser:** Supports Excel/Google Sheets TSV (`\t`), standard RFC 4180 CSV (`,`), Semicolon (`;`), Pipe (`|`), and PDT Tilde (`~`).
- **Governed Grid Profiles:** `BILLING`, `PURCHASE`, `STOCK_MOVEMENT`, `BARCODE_PRINTING`, `ITEM_MASTER`.
- **Duplicate & Row Policies:** `MERGE_ROWS`, `ADD_AS_SEPARATE_ROWS`, `REJECT_DUPLICATE` combined with import modes `APPEND`, `MERGE`, `REPLACE`.
- **Atomic Transaction Safety:** Prevents partial commitment of unverified/phantom products to transactional documents.
- **Backend Batch Resolution:** `POST /api/v1/products/batch-resolve` executing single-roundtrip batch verification with resolution caching.
- **Refactored Consumers:** `ExcelGridEntrySec.tsx`, `GrnCsvImportModal.tsx`, `ptFileParser.ts`, and `billing_csv.py`.

## 3. Files Created
1. `src/services/gridInput/types.ts`: Core data structures, profile definitions, resolution statuses, duplicate policies, and parse result contracts.
2. `src/services/gridInput/gridProfiles.ts`: Authoritative field definitions and defaults for Billing, Purchase, Stock Movement, Barcode Printing, and Item Master.
3. `src/services/gridInput/gridInputEngine.ts`: Unified parsing, column mapping integration, row normalization, duplicate policy enforcement, and batch resolution.
4. `src/services/gridInput/useGridClipboardPaste.ts`: Universal React hook for direct clipboard paste (`Ctrl+V`) into table bodies.
5. `src/components/gridInput/GlobalGridImportModal.tsx`: Comprehensive multi-tab import modal (Paste, File Upload, Rapid Scanner) with live preview, error filters, and atomic protection.
6. `src/tests/globalGridInputEngine.test.ts`: Vitest suite with 19 tests validating parser, column mappings, normalization, duplicate handling, and import modes.
7. `backend/tests/test_batch_product_resolution.py`: Pytest suite with 5 tests validating batch resolution, inactive checks, dedup cache, and HTTP endpoint.

## 4. Files Modified
1. `backend/app/schemas/product_resolution.py`: Added `BatchProductResolutionItem`, `BatchProductResolutionRequest`, and `BatchProductResolutionResponse`.
2. `backend/app/services/product_resolution_service.py`: Added `resolve_batch` and query deduplication cache in `validate_transaction_lines`.
3. `backend/app/api/v1/product_resolution.py`: Added `POST /api/v1/products/batch-resolve` endpoint with tenant-isolated DB dependency.
4. `backend/app/api/v1/billing_csv.py`: Refactored `_lookup_catalog` to call `ProductResolutionService.resolve()`.
5. `src/lib/headerMapping/HeaderMappingEngine.ts`: Added context-aware default resolution for ambiguous headers (`GRN` vs `ITEM_MASTER`).
6. `src/components/ExcelGridEntrySec.tsx`: Refactored `handlePaste` to delegate line and delimiter parsing to `GridInputEngine`.
7. `src/components/barcode/ptFileParser.ts`: Refactored `parsePTFileContent` to reuse `GridInputEngine.parseDelimitedText`.
8. `src/components/purchase/GrnCsvImportModal.tsx`: Refactored `parseInwardCsv` to reuse `GridInputEngine`, removing rogue fake SKU generation.

## 5. Architecture Decisions
1. **Zero External Dependency on Frontend:** Direct clipboard paste from Excel produces Tab-Separated Values (TSV). Implementing RFC 4180 parsing in TypeScript avoids bloat from bulky third-party spreadsheet libraries.
2. **Context-Driven Ambiguity Resolution:** The trigger "Rate" maps to `costPrice` in Purchase/GRN contexts and `price` in Sales/Item Master contexts, avoiding false unmapped columns.
3. **Single Authoritative Resolver:** All surfaces query `ProductResolutionService` (Postgres catalog `items` → `item_variants` → `item_barcodes`), eliminating ad-hoc SQL lookup queries.

## 6. Design Rationale
The "Discover → Audit → Reuse → Refactor → Centralize → Configure → Integrate → Test" principle ensured that established capabilities like `HeaderMappingEngine` were preserved and extended rather than replaced with competing code.

## 7. Implementation Summary
```text
  Direct Clipboard (Ctrl+V) / CSV / TSV / PDT / Scanner
                         ↓
         GridInputEngine.parseDelimitedText()
                         ↓
         HeaderMappingEngine.mapColumns()
                         ↓
        GridInputEngine.buildGridRows()
                         ↓
  POST /api/v1/products/batch-resolve (Single Roundtrip)
                         ↓
     GlobalGridImportModal / useGridClipboardPaste
                         ↓
   Document Grid Commit (APPEND / MERGE / REPLACE)
```

## 8. Tests Executed
1. `npx vitest run src/tests/globalGridInputEngine.test.ts` (19/19 passed)
2. `npx vitest run src/tests/headerMap.test.ts` (13/13 passed)
3. `npx vitest run src/tests/universalImportEngine.test.ts src/tests/grnCsvImportEngine.test.ts src/tests/itemGrid.test.ts src/tests/tagPrinting.test.ts src/tests/multiMap.test.ts src/tests/itemAttrs.test.ts src/tests/aliasMap.test.ts` (73/73 passed)
4. `.venv\Scripts\python.exe -m pytest backend/tests/test_batch_product_resolution.py -v` (5/5 passed)
5. `.venv\Scripts\python.exe -m pytest backend/tests/test_global_product_resolution.py backend/tests/test_billing_csv.py -v` (21/21 passed)
6. `npx tsc --noEmit` (0 errors)

## 9. Verification Results
All 131 automated tests passed with 0 failures and 0 regressions. Full type parity verified across frontend and backend.

## 10. Known Limitations
- XLSX binary file upload requires conversion or backend processing if binary files without clipboard extraction are uploaded directly. (Clipboard paste from Excel works natively without saving files).

## 11. Future Work
- Integration with mobile optical barcode camera scanner for handheld warehouse audit tablets.

## 12. Related ADRs
- `docs/architecture/ADR_GLOBAL_PRODUCT_RESOLUTION.md`

## 13. Related RFCs
- `RFC-2026-CATALOG-GRID-IMPORT-001`
