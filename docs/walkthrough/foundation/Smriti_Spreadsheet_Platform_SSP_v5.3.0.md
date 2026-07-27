<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.3.0
  Created      : 2026-07-27
  Copyright    : © SmritiSys. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Spreadsheet Platform (SSP) Architecture v5.3.0

## 1. Purpose
Implement an enterprise-grade, decoupled **SMRITI Spreadsheet Platform (SSP)** under `src/spreadsheet/`, replacing static file import/export with a live spreadsheet workspace connected directly to SMRITI database records with ERP business formulas (`=GST()`, `=MARGIN()`, `=MRP()`), MS Excel 5,000+ row TSV/CSV clipboard paste, live validation, Undo/Redo history, transaction pending buffers, and AI Assistant integration.

## 2. Scope
- **Core Platform Engines (`src/spreadsheet/core/`)**:
  - `FormulaEngine.ts`: Evaluates standard math expressions, Excel functions (`ROUND`, `SUM`, `AVG`, `MIN`, `MAX`), and ERP business functions (`=GST(price, rate)`, `=MARGIN(sell, buy)`, `=MRP(buy, margin)`).
  - `ClipboardEngine.ts`: MS Excel and Google Sheets TSV/CSV parser supporting 5,000+ row copy-paste without file uploads.
  - `ValidationEngine.ts`: Live cell validation for GSTIN Luhn Modulus 36 checksums, 6-digit PIN codes, GST rate ranges (0-50%), and duplicate barcodes.
  - `HistoryEngine.ts`: Multi-step Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`) history stack.
  - `TransactionEngine.ts`: Pending cell edit buffer, commit to DB, rollback, and version snapshots.
  - `PermissionEngine.ts`: Column and cell-level role-based access control.
- **Domain Data Adapters (`src/spreadsheet/adapters/`)**:
  - `ItemMasterAdapter.ts`: Maps `Product[]` catalog into standardized grid columns.
  - `CustomerAdapter.ts`: Maps `Customer[]` entity to SSP grid schema.
  - `SupplierAdapter.ts`: Maps `Supplier[]` entity to SSP grid schema.
- **AI Assistant (`src/spreadsheet/ai/AIAssistant.ts`)**:
  - Executes natural language spreadsheet prompts ("Increase MRP by 10%", "Fill missing HSN", "Highlight duplicates", "Normalize brands").
- **Platform UI (`src/spreadsheet/SmritiSpreadsheetPlatform.tsx`)**:
  - Universal live grid workspace component wired into `ItemMasterTab.tsx` Live Excel Workspace tab.

## 3. Files Created
- `src/spreadsheet/core/FormulaEngine.ts`
- `src/spreadsheet/core/ClipboardEngine.ts`
- `src/spreadsheet/core/ValidationEngine.ts`
- `src/spreadsheet/core/HistoryEngine.ts`
- `src/spreadsheet/core/TransactionEngine.ts`
- `src/spreadsheet/core/PermissionEngine.ts`
- `src/spreadsheet/adapters/ItemMasterAdapter.ts`
- `src/spreadsheet/adapters/CustomerAdapter.ts`
- `src/spreadsheet/adapters/SupplierAdapter.ts`
- `src/spreadsheet/ai/AIAssistant.ts`
- `src/spreadsheet/SmritiSpreadsheetPlatform.tsx`
- `src/tests/smritiSpreadsheetPlatform.test.ts`
- `docs/walkthrough/foundation/Smriti_Spreadsheet_Platform_SSP_v5.3.0.md`

## 4. Files Modified
- `src/components/ItemMasterTab.tsx`
- `src/components/PrintPreviewModal.tsx`
- `src/components/common/AdaptiveWorkspaceHeader.tsx`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Decoupled Platform Architecture**: Built as an independent core platform (`src/spreadsheet/`) separated from any single module or vendor format. Domain entities communicate strictly through Domain Data Adapters.

## 6. Design Rationale
- Provides real-time spreadsheet workspace directly over database records, combining Excel's UX speed with enterprise database governance, audit trails, and live validation.

## 7. Implementation Summary
1. Built 6 core platform engines under `src/spreadsheet/core/`.
2. Built 3 domain data adapters under `src/spreadsheet/adapters/`.
3. Built AI assistant command executor under `src/spreadsheet/ai/`.
4. Built universal UI component `SmritiSpreadsheetPlatform.tsx`.
5. Created unit test suite `smritiSpreadsheetPlatform.test.ts` (11/11 tests passing).
6. Wired SSP into `ItemMasterTab.tsx` tab 2.

## 8. Tests Executed
- `npx tsc --noEmit`
- `npx vitest run`
- `py scripts/validate_governance.py`

## 9. Verification Results
- 0 TypeScript compilation errors.
- 16/16 test files passed (89/89 tests).
- Governance Validation Status: PASSED.

## 10. Known Limitations
None.

## 11. Future Work
Add WebWorker background thread for 500,000+ row virtual rendering.

## 12. Related ADRs
- `ADR-0009`: SMRITI Spreadsheet Platform (SSP) Architecture.

## 13. Related RFCs
- `RFC-SSP-001`: Universal Live Spreadsheet Workspace.
