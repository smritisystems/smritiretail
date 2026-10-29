<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.21
  Created      : 2026-10-29
  Modified     : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Print Engine: Platform-Wide Modal Unification & Layout Safety (Phase 10)
-->

# Walkthrough: Print Engine: Platform-Wide Modal Unification & Layout Safety (Phase 10: Promotions Schemes, Visual Report Designer, Desk Reference & Global Print Store Engine)

## 1. Purpose
This implementation phase extends the SMRITI Enterprise Single-Tree Body Portal Architecture across the remaining operational and reporting domains:
1. `src/print_engine/print_store.tsx`: Modernizes the central `PrintPortal` component, injecting mandatory `@media print { #root { display: none !important; } }` and static block unrolling styles to guarantee that any document dispatched through `usePrintEngine().print(...)` is protected against layout flow offset.
2. `src/components/promotions/SmritiSalesPromotionsStudio.tsx`: Eliminates bare `window.print()` invocation by wrapping the schemes catalog in a dedicated body portal (`showPrintSchemesModal`) rendering an official A4 portrait promotions and discount rule directory.
3. `src/components/reports/ReportBuilder.tsx`: Upgrades "Print / PDF" report exports from bare `window.print()` into a dedicated body portal (`showPrintReportModal`) rendering an official A4 landscape pivot and dimensional analysis report sheet.
4. `src/components/AboutSmritiTab.tsx`: Modernizes the Reference Desk "Print View" button into a dedicated body portal (`showPrintDeskModal`) rendering an official A4 portrait platform architecture and diagnostics dossier.

## 2. Scope
- Mount promotion directory, report designer sheets, and desk dossiers directly to `document.body` via `createPortal`.
- Inject active `#root` suppression via `@media print { #root { display: none !important; } }`.
- Static flow unrolling: `position: static !important; display: block !important; overflow: visible !important; width: 100% !important; margin: 0 !important;`.
- Dynamic `@page` sizing rules:
  - A4 portrait (`margin: 8mm 10mm 10mm 10mm`) in Promotions Schemes Directory.
  - A4 landscape (`margin: 8mm 10mm 10mm 10mm`) in Visual Report Designer.
  - A4 portrait (`margin: 8mm 10mm 10mm 10mm`) in Reference Desk Dossier.
- Complete toolbar exclusion in print media (`print:hidden`, `.promotions-print-toolbar`, `.report-builder-print-toolbar`, `.about-desk-print-toolbar`).
- Universal keyboard listeners: `Escape` to close and `F9` / `Ctrl+P` to execute print.
- Comprehensive automated verification via 3 dedicated test suites and full regression pass across all 28 print test suites (88/88 green).

## 3. Files Created
- `src/tests/smritiSalesPromotionsPrint.test.tsx`: Automated verification suite for Sales Promotions Schemes directory portal architecture.
- `src/tests/reportBuilderPrint.test.tsx`: Automated verification suite for Visual Report Designer A4 landscape portal architecture.
- `src/tests/aboutSmritiTabPrint.test.tsx`: Automated verification suite for Reference Desk dossier portal architecture.
- `docs/walkthrough/print/Print_Engine_Modal_Unification_Phase10_Walkthrough_v1.0.0.md`: This WGP walkthrough document.

## 4. Files Modified
- `src/print_engine/print_store.tsx`:
  - Updated header to `v6.99.21`.
  - Injected `#root { display: none !important; }` and static unrolling rules into `PrintPortal`.
- `src/components/promotions/SmritiSalesPromotionsStudio.tsx`:
  - Updated header to `v6.99.21`.
  - Replaced bare `window.print()` trigger with `setShowPrintSchemesModal(true)`.
  - Added `showPrintSchemesModal` state, `getTenantCompanyContext` memoization, and keyboard listeners (`Escape`, `F9`, `Ctrl+P`).
  - Added official promotion schemes directory printable sheet (`#promotions-printable-directory`) portaled to `document.body` via `createPortal`.
- `src/components/reports/ReportBuilder.tsx`:
  - Updated header to `v6.99.21`.
  - Replaced bare `window.print()` call in `handleExport` with `setShowPrintReportModal(true)`.
  - Added `showPrintReportModal` state, `getTenantCompanyContext` memoization, and keyboard listeners (`Escape`, `F9`, `Ctrl+P`).
  - Added official report printable sheet (`#report-builder-printable-sheet`) portaled to `document.body` via `createPortal` with A4 landscape geometry.
- `src/components/AboutSmritiTab.tsx`:
  - Updated header to `v6.99.21`.
  - Replaced bare `window.print()` in navigation bar with `setShowPrintDeskModal(true)`.
  - Added `showPrintDeskModal` state, `getTenantCompanyContext` memoization, and keyboard listeners (`Escape`, `F9`, `Ctrl+P`).
  - Added platform reference dossier printable sheet (`#about-desk-printable-dossier`) portaled to `document.body` via `createPortal`.
- `docs/walkthrough/README.md`: Appended entry `v3.153.0`.
- `CHANGELOG.md`: Added release notes for `[6.99.21]`.

## 5. Architecture Decisions
- **Unified Print Safety at the Store Level**: In addition to component-specific modals, hardening `PrintPortal` inside `print_store.tsx` ensures any ad-hoc or headless print job dispatched via the core print engine automatically inherits `#root` suppression.
- **Enterprise Promotions Auditability**: Retail operators and auditors require printed circulars of active promotional schemes (Buy 2 Get 1, Flat %, Bundle Combos, Happy Hours). Portaling to an A4 portrait directory ensures clean statutory review without UI button interference.
- **Dimensional Pivot Matrix Printing**: Visual analysis tables dynamically adjust column widths and render aggregations with currency formatting on an A4 landscape canvas.

## 6. Design Rationale
- **Promotions Studio (`SmritiSalesPromotionsStudio.tsx`)**: Previously, clicking "Print Schemes" captured the raw browser window including sidebar tabs and wizards. The new directory portal provides a clean tabular sheet with scheme codes, benefit types, validity periods, and auditor sign-off.
- **Visual Report Designer (`ReportBuilder.tsx`)**: "Export -> Print / PDF" was previously a bare `window.print()` call that printed the entire report designer including field lists and configuration drop-zones. The new portal renders only the finished data matrix with row and column dimensions.
- **Reference Desk (`AboutSmritiTab.tsx`)**: Replaced bare page print with an official corporate and technological dossier containing release numbers, system diagnostics, and operational scopes.

## 7. Implementation Summary
- **Promotions Schemes Directory**:
  - Attached `createPortal` targeting `document.body`.
  - Bound `promotions-print-schemes-btn` and `promotions-portal-print-action-btn`.
  - Formatted 8-column scheme table with category badges and validity dates.
- **Report Designer Matrix Sheet**:
  - Attached `createPortal` targeting `document.body`.
  - Bound `report-builder-portal-print-action-btn`.
  - Formatted multi-dimensional pivot table with dimension header ribbons and measure calculations.
- **Reference Desk Dossier**:
  - Attached `createPortal` targeting `document.body`.
  - Bound `about-desk-print-btn` and `about-desk-portal-print-action-btn`.
  - Formatted active section snapshot with system diagnostics metrics.

## 8. Tests Executed
1. `npx vitest run src/tests/smritiSalesPromotionsPrint.test.tsx`:
   - Schemes directory portal mounting verified.
   - A4 portrait sizing and `#root` suppression verified.
   - Buttons, printable container `#promotions-printable-directory`, and keyboard shortcuts verified.
2. `npx vitest run src/tests/reportBuilderPrint.test.tsx`:
   - Report builder portal mounting verified.
   - A4 landscape sizing and `#root` suppression verified.
   - Export menu routing, printable container `#report-builder-printable-sheet`, and keyboard shortcuts verified.
3. `npx vitest run src/tests/aboutSmritiTabPrint.test.tsx`:
   - Reference desk dossier portal mounting verified.
   - A4 portrait sizing and `#root` suppression verified.
   - Buttons, printable container `#about-desk-printable-dossier`, and keyboard shortcuts verified.
4. Full Regression Run:
   - Executed all 28 print test suites across the repository: 88/88 passed in 8.66s.
5. Static TypeScript Compilation:
   - `npx tsc --noEmit` exited with code 0 (0 errors).

## 9. Verification Results
- 28/28 test files passed.
- 88/88 unit tests passed.
- 0 TypeScript compiler errors.
- 100% parity across DEV (`F:\SMRITRretailNX`) and TEST (`F:\Smriti9`).

## 10. Known Limitations
None identified in this phase.

## 11. Future Work
All known print triggers and modals across SMRITI Retail OS have now been systematically unified onto the Single-Tree Body Portal Architecture. Continuous repository governance will enforce this standard on any future print feature.

## 12. Related ADRs
- `ADR-0042`: Universal Body Portal Architecture for Print Media.
- `ADR-0089`: Tenant Corporate Context and Legal Entity Header Governance.

## 13. Related RFCs
- `RFC-2026-PRINT-01`: Chromium Layout Displacement & Modal Print Isolation.
