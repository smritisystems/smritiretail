<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.47
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Smart Import & Correction Studio (v6.70.47)

## 1. Objective
Upgrade the existing Item Master bulk-import interface (`ItemMasterStudio.tsx`) into an interactive, same-window Smart Import & Correction Studio. Enable operators and inventory managers to detect, review, correct inline, resolve conflicts, skip invalid rows, download error reports, and execute safe partial or complete transactional imports without leaving the studio or failing with opaque database errors.

## 2. Business Motivation
Retailers regularly import merchandise datasets containing hundreds or thousands of SKUs copied from supplier spreadsheets, CSVs, or legacy systems. When errors occur (e.g. unseeded master lookup attributes, duplicate barcodes within file, database barcode collisions, price inversion), previous implementations crashed with generic database conflict errors (`SMRITI-DATA-001`) or blocked the entire batch without actionable row-level guidance. 
The Smart Import & Correction Studio provides:
1. **Zero-Exit Workflow**: Immediate inline editing, dropdown master lookup fixes, and deterministic bulk auto-corrections directly in the mapping grid.
2. **Deterministic Governance & IM-001 Compliance**: Preserves original uploaded data alongside proposed corrections, revalidates instantly, and prohibits unverified synthetic values.
3. **Transparent Conflict Resolution**: Disambiguates internal file duplicates from database collisions, offering safe actions ("Link to Existing", "Correct Value", "Skip Row").
4. **Resilient Transaction Commit**: Supports safe partial imports of valid rows while skipping or shelving unresolved rows with clear audit logs and zero data corruption.

## 3. Scope
- **Frontend Surfaces**:
  - `src/components/itemMaster/ItemMasterStudio.tsx`: Core studio upgrade with 7-metric dashboard, row-level status pills, cell-level inline editors, filter tabs, bulk action toolbars, conflict drawers, error report downloader, and commit confirmation dialog.
  - `src/components/itemMaster/types.ts` & `src/types.ts`: Extended types for row reconciliation, field failure states, and correction records.
- **Backend API & Services**:
  - `backend/app/api/v1/universal_import.py`: Structured HREP-compliant validation responses (`SMRITI-IMPORT-VALIDATION`), multi-level conflict detection (in-file vs DB `ItemBarcode`, `ItemVariant`, `Item`, `Product`), transaction-safe partial import option, and idempotency protection.
- **Automated Test Suites**:
  - Frontend Vitest suites: `src/tests/smartImportStudio.test.ts`.
  - Backend Pytest suites: `backend/app/tests/test_smart_import_studio.py`.

## 4. Current State
- `ItemMasterStudio.tsx` allows pasting delimited text, file dropping, and column mapping.
- Calling `/universal-import/preview` returns a high-level summary and `reconciliation_report`.
- If an unhandled conflict occurs during preview/commit, the backend throws an unhandled `IntegrityError` or `SQLAlchemyError`, triggering generic `SMRITI-DATA-001` HTTP 400 responses.
- The UI displays a single generic error banner and lacks cell-level editing in the main grid, bulk actions, and multi-filter tabs.

## 5. Gap Analysis
| Requirement | Current Implementation | Target Studio State (v6.70.47) |
|---|---|---|
| **Live Dashboard Metrics** | 2 basic badges (detected rows, error count) | 7 dynamically calculated metrics: Total, Valid, Blocking Errors, Warnings, Corrected, Skipped, Ready |
| **Row-Level Highlighting & Filters** | All rows or Errors Only | Status-coded badges (Green/Amber/Red/Gray/Blue) + Filters: All, Valid, Errors, Warnings, Corrected, Skipped |
| **Inline Grid Correction** | Textarea only or static bottom fix list | Interactive cell-level inline editing + master lookup select dropdowns + original vs corrected value tracking + Undo |
| **Conflict Disambiguation** | Generic duplicate message | Clear distinction between duplicate in file vs database collision with existing item metadata (name, SKU, style) |
| **Bulk Actions** | Auto-Fill SKU only | Auto-Fix Safe Errors, Correct Selected, Skip Selected, Restore Original, Revalidate All, Export Error Report TSV/CSV |
| **Import Strategies** | All-or-nothing commit | Import All Valid, Partial Import (Skip Invalid), Full Pre-commit Review with confirmation summary |
| **Error Contract & HREP** | Generic `SMRITI-DATA-001` on DB collision | Structured `SMRITI-IMPORT-VALIDATION` with row_number, field, code, original_value, suggested_action |

## 6. Architecture Impact
- **Frontend**: Component maintains immutable `originalUploadedRows` alongside `rowCorrections` state (`Map<number, Record<string, any>>`) and `userSkippedRows` (`Set<number>`).
- **Backend**: `/universal-import/preview` and `/universal-import/commit` handle tenant isolation, bulk master caching, duplicate detection in O(N), and safe atomic partial transaction commits without throwing unhandled SQL exceptions.
- **Zero Schema Migrations**: Operates directly on canonical `items`, `item_variants`, `item_barcodes`, and `products` models.

## 7. Proposed Design
1. **Interactive Grid Engine**:
   - Each data cell renders original value, with visual indicator if corrected.
   - Double-click or click-to-edit cell with input or dropdown based on field definition.
   - Row status column shows colored status icon with tooltips detailing specific blocking reasons or review flags.
2. **Deterministic Auto-Fix Engine**:
   - Trims leading/trailing whitespace.
   - Uppercases standard codes (Barcodes, SKUs, Style Codes, HSN).
   - Case-normalizes master lookup values matching known synonyms.
   - Fixes GST rates to valid numeric slabs.
3. **Structured Validation & Error Contract**:
   - Backend returns unified error dictionary entries with actionable remediation recommendations.

## 8. Files Created
- `src/tests/smartImportStudio.test.ts`: Frontend tests for dashboard metrics, inline correction, filters, auto-fix, skip rows, and export.
- `backend/app/tests/test_smart_import_studio.py`: Backend tests for validation responses, conflict resolution, partial commit, and isolation.
- `docs/walkthrough/inventory/Smart_Import_And_Correction_Studio_Walkthrough_v6.70.47.md`: Verification walkthrough.

## 9. Files Modified
- `src/components/itemMaster/ItemMasterStudio.tsx`: Enhanced Studio component.
- `backend/app/api/v1/universal_import.py`: Enhanced validation, error formatting, and safe import handling.
- `docs/implementation/README.md`: Master implementation plans index.
- `CHANGELOG.md`: Version release notes.

## 10. Dependencies
- `@material-symbols/font-400`, `lucide-react`, `react`, `react-dom`.
- `FastAPI`, `SQLAlchemy`, `pydantic`.

## 11. Risks
- **Large Dataset Rendering Performance**: Editing grids with >1000 rows can cause re-render lag.
  *Mitigation*: Optimized memoization and virtualization-friendly row renderers.
- **Accidental Field Overwrites**: Auto-fix mutating intended values.
  *Mitigation*: Deterministic auto-fix only applies to unambiguous syntax/whitespace fixes; preview and undo available.

## 12. Rollback Strategy
Git revert of `ItemMasterStudio.tsx` and `universal_import.py`. Zero database schema migrations required.

## 13. Verification Plan
1. Unit tests for frontend grid filtering, inline editing, undo, auto-fix, error report generation.
2. Integration tests for backend preview validation, conflict detection, and partial commit.
3. End-to-end verification with 504-row sample dataset verifying zero uncaught HTTP 500/400 generic errors.

## 14. Test Plan
- `npm run test` / `npx vitest run src/tests/smartImportStudio.test.ts`
- `pytest backend/app/tests/test_smart_import_studio.py`
- `npm run lint` (`tsc --noEmit`)
- `npm run build`

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Generate `docs/walkthrough/inventory/Smart_Import_And_Correction_Studio_Walkthrough_v6.70.47.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
1. Commit code to branch `smritiNX`.
2. Execute full validation test suite.
3. Build production bundle with `npm run build`.

## 17. Status
Approved — In Progress

## 18. Related ADRs
- `docs/adr/ADR-0021-Canonical-Item-Master-Architecture.md`
- `docs/adr/ADR-0016-Universal-Error-Handling-Policy.md`

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Smart_Import_And_Correction_Studio_Walkthrough_v6.70.47.md`
