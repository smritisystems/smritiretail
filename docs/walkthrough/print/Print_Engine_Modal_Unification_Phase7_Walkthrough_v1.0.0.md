# SMRITI Print Engine Modal Unification & Layout Safety — Phase 7 Walkthrough (Quick Reports, Sales Order Proforma & HR Muster/Wages)

**Document Version:** 1.0.0  
**Date:** 2026-10-29  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal Governance & Architecture Walkthrough  
**Release Target:** v6.99.18 / Platform v3.149.0  

---

## 1. Purpose
This walkthrough documents Phase 7 of the enterprise-wide modernization of printable documents, audit reports, and modal dialogs across SMRITI Retail OS. Phase 7 eliminates blank print previews, layout box displacement, and conflicting legacy visibility rules in:
1. `QuickReportsWidget.tsx` (Dynamic Interactive Print Preview Modal & 1-Click Operations Ledger Print).
2. `ReportDesignerTab.tsx` (Sales Order Confirmation & Proforma Document A4 Preview Modal).
3. `AttendanceWorkspaceTab.tsx` (Form II Statutory Muster Roll Matrix & Monthly Wage Statement).

---

## 2. Scope
- **Component Standardizations:**
  - `src/components/QuickReportsWidget.tsx` (`v6.99.18`): Replaced flawed legacy `body * { visibility: hidden !important; }` rule with the enterprise single-tree body portal standard (`createPortal(modalContent, document.body)`). Added dynamic `@page` sizing (A4 portrait vs 80mm thermal roll), static block flow unrolling, toolbar exclusion (`.quick-report-toolbar`), and universal `Escape` and `F9` / `Ctrl+P` keyboard shortcuts.
  - `src/components/ReportDesignerTab.tsx` (`v6.99.18`): Migrated Sales Order A4 Confirmation / Proforma Preview Modal (`showSoPrintModal`) to `createPortal(soModalContent, document.body)` with `@page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }`, `#root { display: none !important; }`, toolbar exclusion (`.so-print-toolbar`), and universal `Escape` and `F9` / `Ctrl+P` keyboard listeners.
  - `src/components/hr/AttendanceWorkspaceTab.tsx` (`v6.99.18`): Implemented authoritative printable Form II Statutory Muster Roll sheet (`att-muster-printable-sheet`) with `@page { size: A4 landscape; margin: 8mm; }` and Monthly Wage Statement sheet (`att-wages-printable-sheet`) with `@page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }` mounted to `document.body` via `createPortal`, injecting `#root { display: none !important; }`, excluding on-screen action toolbars, and binding `F9` / `Ctrl+P`.
- **Verification Suites:**
  - `src/tests/quickReportsPrintModal.test.tsx` (2 tests).
  - `src/tests/reportDesignerSalesOrderPrint.test.tsx` (1 test).
  - `src/tests/attendanceMusterAndWagesPrint.test.tsx` (2 tests).
  - 19 full Vitest print verification suites (61/61 tests green).

---

## 3. Files Created
- `src/tests/quickReportsPrintModal.test.tsx`
- `src/tests/reportDesignerSalesOrderPrint.test.tsx`
- `src/tests/attendanceMusterAndWagesPrint.test.tsx`
- `docs/walkthrough/print/Print_Engine_Modal_Unification_Phase7_Walkthrough_v1.0.0.md`

---

## 4. Files Modified
- `src/components/QuickReportsWidget.tsx`
- `src/components/ReportDesignerTab.tsx`
- `src/components/hr/AttendanceWorkspaceTab.tsx`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 5. Architecture Decisions
1. **Elimination of Broken `visibility: hidden` Legacy Pattern:**
   In `QuickReportsWidget.tsx`, the historical `body * { visibility: hidden !important; }` hack caused Chromium to allocate a 100vh blank first page for invisible `#root` DOM ancestors while pushing or clipping the target print sheet. By mounting directly to `document.body` and suppressing `#root { display: none !important; }`, Chromium isolates the document sheet at origin `(0, 0)`.
2. **Dynamic Orientation Matching Form II Wide Tables:**
   Form II Statutory Muster Roll matrices span 31 horizontal day columns plus employee identifiers and summary tallies. Injecting `@page { size: A4 landscape; margin: 8mm; }` provides sufficient horizontal width (297mm) to prevent table truncation.
3. **Dual Print Mode Coexistence in Quick Reports:**
   Quick Reports supports both modal interactive preview printing and direct 1-click background printing. When `isPreviewOpen` is true, background containers are suppressed via `print:hidden` to prevent duplicate output, while ensuring direct prints still render with static unrolling and `#root` suppression.

---

## 6. Design Rationale
- Embedding print stylesheets directly within each portaled modal isolates style rules strictly to the lifecycle of that modal or active tab, eliminating CSS global pollution across the application shell.

---

## 7. Implementation Summary
- **Universal Portal Pattern:**
  ```tsx
  const mountedModal = isPreviewOpen && typeof document !== "undefined" && document?.body && typeof (document.body as any).appendChild === "function"
    ? createPortal(previewModalContent, document.body)
    : null;
  ```
- **CSS Isolation in Document Body:**
  ```css
  @media print {
    @page {
      size: A4 portrait; /* or A4 landscape / 80mm auto */
      margin: 10mm 12mm 12mm 12mm; /* or 8mm / 0 */
    }
    #root {
      display: none !important;
    }
    html, body {
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }
  }
  ```

---

## 8. Tests Executed
```bash
# Phase 7 targeted test suites
npx vitest run src/tests/quickReportsPrintModal.test.tsx src/tests/reportDesignerSalesOrderPrint.test.tsx src/tests/attendanceMusterAndWagesPrint.test.tsx

# Full 19-suite platform print verification
npx vitest run src/tests/vendorPrintModal.test.tsx src/tests/vendorStatementOfAccountModal.test.tsx src/tests/grnLogisticsAndTerms.test.tsx src/tests/staffPrintModal.test.tsx src/tests/poPrintCorporateIdentityUnblocking.test.tsx src/tests/batchBarcodePrintModal.test.tsx src/tests/packingSlipManagementModal.test.tsx src/tests/proposTaxInvoiceReceipt.test.tsx src/tests/proposShiftCloseModal.test.tsx src/tests/employeeAttendancePayslipModal.test.tsx src/tests/wmsDeliveryChallanModal.test.tsx src/tests/tagLabelPrintThermalPortal.test.tsx src/tests/printLabelsStudioPreviewModal.test.tsx src/tests/visualLabelDesignPrint.test.tsx src/tests/proposEodZReportPrint.test.tsx src/tests/proposShiftHandoverDailyReportsPrint.test.tsx src/tests/quickReportsPrintModal.test.tsx src/tests/reportDesignerSalesOrderPrint.test.tsx src/tests/attendanceMusterAndWagesPrint.test.tsx

# TypeScript Compiler Check
npx tsc --noEmit
```

---

## 9. Verification Results
- **Vitest Suite Output:**
  ```text
  Test Files  19 passed (19)
       Tests  61 passed (61)
    Duration  6.67s
  ```
- **TypeScript Compiler Output:**
  ```text
  Exit Code: 0 (0 errors, 0 warnings)
  ```
- **Status:** Done

---

## 10. Known Limitations
- Landscape printing for Form II requires the printer driver or browser print preview dialog to support landscape orientation, which is automatically suggested by `@page { size: A4 landscape; }`.

---

## 11. Future Work
- Add Excel-direct streaming for ultra-wide muster rolls spanning over 100 staff members.

---

## 12. Related ADRs
- `ADR-0042`: Enterprise Single-Tree Body Portal Architecture for Web & Thermal Printing.

---

## 13. Related RFCs
- `RFC-2026-PRINT-01`: Chromium Layout Displacement & Modal Print Isolation.
