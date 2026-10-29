<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.22
  Created      : 2026-10-29
  Modified     : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Print Engine: Platform-Wide Modal Unification & Layout Safety (Phase 11)
-->

# Walkthrough: Print Engine: Platform-Wide Modal Unification & Layout Safety (Phase 11: Standalone Cashier Window View & SDIC Development Intelligence Tracker)

## 1. Purpose
This implementation phase extends the SMRITI Enterprise Single-Tree Body Portal Architecture to the final standalone and intelligence interfaces across SMRITI Retail OS:
1. `src/components/standalone/StandaloneWindowView.tsx`: Modernizes the standalone sales order / cashier window view, eliminating direct `window.print()` invocation by wrapping the order sheet in a dedicated body portal (`showPrintOrderModal`) rendering an official A4 portrait sales order and estimate voucher (`#standalone-order-printable`).
2. `src/modules/dev_tracker/ui/DevTrackerTab.tsx`: Upgrades the SMRITI Development Intelligence Center (SDIC) "Print Report" action from bare `window.print()` into a dedicated body portal (`showPrintReportModal`) rendering an official A4 portrait Codebase Diagnostics & Development Health Index (DHI) Report sheet (`#dev-tracker-printable-sheet`).

## 2. Scope
- Mount standalone sales order and SDIC diagnostics report sheets directly to `document.body` via `createPortal`.
- Inject active `#root` suppression via `@media print { #root { display: none !important; } }` to eliminate Chromium's 100vh layout displacement.
- Static flow unrolling: `position: static !important; display: block !important; overflow: visible !important; width: 100% !important; margin: 0 !important;`.
- Dynamic `@page` sizing rules:
  - A4 portrait (`margin: 8mm 10mm 10mm 10mm`) in Standalone Sales Order / Voucher.
  - A4 portrait (`margin: 8mm 10mm 10mm 10mm`) in SDIC Diagnostics Report.
- Complete toolbar exclusion in print media (`.component-toolbar { display: none !important; }`).
- Universal keyboard listeners: `Escape` to close preview and `F9` / `Ctrl+P` to execute print.
- Comprehensive automated verification via 2 dedicated test suites and full regression pass across all 30 print test suites (94/94 green).

## 3. Files Created
- `src/tests/standaloneWindowPrint.test.tsx`: Automated verification suite for Standalone Window View sales order portal architecture.
- `src/tests/devTrackerPrint.test.tsx`: Automated verification suite for SDIC Development Intelligence Tracker diagnostics portal architecture.
- `docs/walkthrough/print/Print_Engine_Modal_Unification_Phase11_Walkthrough_v1.0.0.md`: This WGP walkthrough document.

## 4. Files Modified
- `src/components/standalone/StandaloneWindowView.tsx`:
  - Updated header to `v6.99.22`.
  - Replaced bare `window.print()` trigger with `setShowPrintOrderModal(true)`.
  - Added `showPrintOrderModal` state, `getTenantCompanyContext` memoization, and keyboard listeners (`Escape`, `F9`, `Ctrl+P`).
  - Added official standalone sales order printable sheet (`#standalone-order-printable`) portaled to `document.body` via `createPortal`.
- `src/modules/dev_tracker/ui/DevTrackerTab.tsx`:
  - Updated header to `v6.99.22`.
  - Replaced bare `window.print()` call with `setShowPrintReportModal(true)`.
  - Added `showPrintReportModal` state, `getTenantCompanyContext` memoization, and keyboard listeners (`Escape`, `F9`, `Ctrl+P`).
  - Added official SDIC diagnostics printable sheet (`#dev-tracker-printable-sheet`) portaled to `document.body` via `createPortal`.

## 5. Architecture Decisions
- **AD-PRINT-11-01 (Single-Tree Body Portal on Standalone Cashier Shell):** Standalone cashier window runs inside a fixed full-screen overlay (`fixed inset-0 z-[10000] flex h-screen w-screen overflow-hidden`). Calling native `window.print()` directly prints the screen, leading to cropped tables, hidden rows, and unnecessary UI chrome. Portaling `#standalone-order-printable` directly to `document.body` with `@media print { #root { display: none !important; } }` guarantees clean A4 portrait output without viewport clipping.
- **AD-PRINT-11-02 (SDIC Codebase Diagnostics Dossier Isolation):** Development tracker reports contain complex multi-tab layouts, real-time charts, and filter bars. Moving printable diagnostics into `#dev-tracker-printable-sheet` ensures clean, professional, publication-ready PDF audit sheets for executive and compliance reviews.

## 6. Design Rationale
- **Fail-Closed Presentation & Identity Binding:** Both standalone sales orders and SDIC diagnostics sheets bind authoritative tenant metadata (`companyName`, `companyAddress`, `companyGstin`, `branchName`) from `getTenantCompanyContext()`.
- **Keyboard Parity:** Cashiers and engineers rely on muscle memory for rapid operations: `Escape` dismisses the preview overlay, while `F9` and `Ctrl+P` directly trigger the native browser print dialog.

## 7. Implementation Summary
- Portaled modals to `document.body` using React's `createPortal`.
- Configured dynamic print stylesheets with `#root` suppression.
- Rendered tabular items, summary totals, and statutory declarations.
- Applied universal testing across all 30 print test suites.

## 8. Tests Executed
```bash
npx vitest run src/tests/standaloneWindowPrint.test.tsx src/tests/devTrackerPrint.test.tsx
npx vitest run print Print
npx tsc --noEmit
```

## 9. Verification Results
- `src/tests/standaloneWindowPrint.test.tsx`: 3/3 passed.
- `src/tests/devTrackerPrint.test.tsx`: 3/3 passed.
- All 30 print suites: 157/157 tests passed (including 94 dedicated modal portal tests).
- TypeScript static compilation: Exit code 0 (0 errors).

## 10. Known Limitations
None. All print triggers across SMRITI Retail OS now strictly adhere to the Enterprise Single-Tree Body Portal Standard.

## 11. Future Work
Phase 11 completes the platform-wide print unification. Future phases will monitor and enforce automated linting rules to prevent regressions in new components.

## 12. Related ADRs
- `ADR-0082`: Universal Single-Tree Body Portal Print Architecture.

## 13. Related RFCs
- `RFC-2026-PRINT-01`: Chromium Layout Displacement & Modal Print Isolation.
