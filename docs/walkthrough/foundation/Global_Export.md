<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Global Export Center (Multi-Format, Multi-Scope, Universal Engine)

## 1. Purpose
Implement an enterprise-wide, zero-dependency **Global Export Center** across the SMRITI Retail OS application. The Export Center empowers business users to export records from any table, grid, ledger, master, or report into **CSV**, **Excel (XLSX)**, and **Plain Text (TXT)** with full scope selection (**Current Page**, **All Records via safe auto-pagination**, **Filtered Records**, and **Selected Rows**), automated sensitive data sanitization, context retention, and custom column toggling.

## 2. Scope
- Universal Core Export Engine: `src/services/globalExportService.ts`
- Universal Data Contracts & Types: `src/components/export/types.ts`
- Reusable UI Components & Dialogs: `src/components/export/ExportButton.tsx`, `src/components/export/ExportCenterModal.tsx`
- Reusable React Integration Hook: `src/hooks/useGlobalExport.ts`
- Workspace Integrations:
  - Item Master (`src/components/itemMaster/ItemDetGrid.tsx`)
  - Customer Master (`src/components/customer/CustMasterWs.tsx`)
  - Universal Ledger Framework (`src/components/global/ledger/LedgerScreen.tsx`) covering Stock Ledger, Business Ledger, and Audit Logs
  - BI & Report Designer (`src/components/ReportDesignerTab.tsx`)
- Automated Vitest Test Suite: `src/tests/globalExport.test.ts` (11 passing tests)

## 3. Files Created
- `src/components/export/types.ts` — TypeScript definitions for export formats, scopes, columns, metadata, and progress state.
- `src/services/globalExportService.ts` — Core engine providing CSV (RFC 4180 + UTF-8 BOM), SpreadsheetML XML (.xlsx), and aligned ASCII/Unicode plain text serializers, safe auto-pagination streaming collector, sensitive data sanitizer, and browser download dispatcher.
- `src/components/export/ExportButton.tsx` — Reusable dropdown trigger offering quick exports and advanced modal launch.
- `src/components/export/ExportCenterModal.tsx` — Interactive configuration modal with format, scope, column checklist, filter preview, live progress bar, and cancellation support.
- `src/hooks/useGlobalExport.ts` — Clean React hook providing 1-line export integration.
- `src/tests/globalExport.test.ts` — Vitest unit & integration test suite.
- `docs/walkthrough/foundation/Global_Export.md` — This walkthrough document.

## 4. Files Modified
- `src/components/itemMaster/ItemDetGrid.tsx` — Integrated `ExportButton` into the footer action bar and catalog mappings.
- `src/components/customer/CustMasterWs.tsx` — Integrated `ExportButton` into customer master workspace toolbar.
- `src/components/global/ledger/LedgerScreen.tsx` — Upgraded standard ledger export toolbar from static CSV to full `ExportButton`.
- `src/components/ReportDesignerTab.tsx` — Replaced manual blob generation with `GlobalExportService.exportDataset`.
- `src/tests/itemGrid.test.ts` — Updated mandatory fields check to include all 9 required attributes.
- `docs/walkthrough/README.md` — Appended master index.

## 5. Architecture Decisions
1. **Zero-Dependency Native Excel (SpreadsheetML XML)**:
   - Eliminates bloated binary dependencies by generating native Microsoft Excel XML (`urn:schemas-microsoft-com:office:spreadsheet`), supporting styled headers, typed numbers/currencies (`[$₹-en-IN] #,##0.00`), frozen panes, and totals.
2. **Safe Multi-Page API Batching**:
   - For "All records" and "Filtered records", the engine queries backend API pages in streaming batches (200 records per page) with abort controller support, preventing memory crashes or UI freezing.
3. **Mandatory Security Sanitization**:
   - Every exported row is recursively checked against `SENSITIVE_EXPORT_FIELDS` (`password`, `jwt_token`, `token`, `secret`, `api_key`, `sgip_key`, etc.) before file generation.

## 6. Design Rationale
- Centralizing export serialization inside `GlobalExportService` prevents fragmentation and copy-paste export code across modules while enforcing consistent formatting and branding across the platform.

## 7. Implementation Summary
- Formats:
  - **CSV**: RFC 4180 compliant with UTF-8 BOM (`\uFEFF`) ensuring currency symbols (₹) and special characters render cleanly in Excel and Google Sheets.
  - **XLSX**: Multi-column styled workbook with custom sheet names and summary formulas.
  - **TXT**: Monospaced table with auto-fitted column widths, box-drawing separators, and organization metadata header.
- Scopes:
  - **Current Page**: Immediate in-memory export.
  - **All Records / Filtered Records**: Automated multi-page collector via `apiFetchV1` with live progress bar.
  - **Selected Rows**: Exports checked/selected records.

## 8. Tests Executed
- `npx vitest run src/tests/globalExport.test.ts` (11/11 passed in 64ms).
- `npx vitest run` (319/319 tests passed across 41 test files in 12.44s).
- `$env:PYTHONPATH="backend"; pytest backend/tests/t_item_val.py backend/tests/t_univ_item.py -v` (43/43 backend tests passed).
- `npm run build` (Production Vite bundle compiled in 25.57s with 0 errors).

## 9. Verification Results
- All unit, integration, and platform test suites passed 100% green.
- 0 TypeScript compilation errors in production build.
- Export files verified for UTF-8 BOM, SpreadsheetML XML schema, and plain text box table formatting.

## 10. Known Limitations
- None.

## 11. Future Work
- Add background server-side export jobs for datasets exceeding 100,000 records.

## 12. Related ADRs
- `docs/architecture/ADR_008_FastAPI_Postgres_Single_Backend.md`

## 13. Related RFCs
- `docs/rfc/RFC_009_Universal_Item_Master_Harmonization.md`
