<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.146.0
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Print Engine Modal Unification Phase 4 (POS Invoices, Shift Closeout & Payslips) Walkthrough v1.0.0

## 1. Purpose
This walkthrough document details the Phase 4 platform-wide unification of print preview modals across SMRITI Retail OS:
1. POS Tax Invoice & Thermal Receipt Preview (`ProPosTaxInvoiceRc.tsx`).
2. Shift Closeout & Z-Report Handover Slip Preview (`ProPosShiftCloseDl.tsx`).
3. HR Salary Voucher & Payslip Studio (`EmployeeAttendanceModal.tsx`).

Prior to Phase 4, these modals were mounted inline within the application DOM tree or relied on legacy `body * { visibility: hidden; }` and `position: fixed` CSS tricks. In Chromium print preview, this resulted in blank sheets or displaced multi-page overflows because `#root` retained bounding box layout flow.

---

## 2. Scope
- Area: Billing, POS Operations & HR Payroll (`src/components/billing/propos/`, `src/components/hr/`)
- Modals Modernized:
  - `ProPosTaxInvoiceRc.tsx` (`v6.99.15`)
  - `ProPosShiftCloseDl.tsx` (`v6.99.15`)
  - `EmployeeAttendanceModal.tsx` (`v6.99.15`)
- Test Suites Authored:
  - `src/tests/proposTaxInvoiceReceipt.test.tsx` (3 tests)
  - `src/tests/proposShiftCloseModal.test.tsx` (2 tests)
  - `src/tests/employeeAttendancePayslipModal.test.tsx` (2 tests)

---

## 3. Files Created
- `src/tests/proposTaxInvoiceReceipt.test.tsx`
- `src/tests/proposShiftCloseModal.test.tsx`
- `src/tests/employeeAttendancePayslipModal.test.tsx`
- `docs/walkthrough/print/Print_Engine_Modal_Unification_Phase4_Walkthrough_v1.0.0.md`

---

## 4. Files Modified
- `src/components/billing/propos/ProPosTaxInvoiceRc.tsx`
- `src/components/billing/propos/ProPosShiftCloseDl.tsx`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **Single-Tree Body Portal Standard**: All print preview modals mount directly as children of `document.body` via `createPortal(modalContent, document.body)`.
- **Active Root Suppression**: Each modal injects `@media print { #root { display: none !important; } }` to eliminate layout displacement caused by invisible `#root` DOM boxes.
- **Dynamic @page Sizing**:
  - `ProPosTaxInvoiceRc.tsx`: dynamically switches `@page` between `A4 portrait` (with margins `8mm 6mm 10mm 12mm`) and `80mm auto` margin 0 (thermal roll).
  - `ProPosShiftCloseDl.tsx`: enforces `@page { size: 80mm auto; margin: 0; }`.
  - `EmployeeAttendanceModal.tsx`: enforces `@page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }`.
- **Static Flow Unrolling**: Modals and printable canvas sheets unroll from `fixed`/`absolute` dialogs into `position: static !important; display: block !important; overflow: visible !important;` sheets in `@media print`.
- **Keyboard Shortcuts**: Added `Escape` (close) and `F9` / `Ctrl+P` (print) listeners across all modals.

---

## 6. Design Rationale
Chromium's print engine respects the CSS layout box even when elements are hidden via `visibility: hidden`. If an invisible container like `#root` occupies the viewport, subsequent elements appended to `document.body` are rendered after that layout box, pushing printable content off the first page or resulting in a completely blank white preview. Direct portal mounting combined with `#root { display: none !important; }` completely detaches the printing canvas from the host application flow.

---

## 7. Implementation Summary
- Upgraded `ProPosTaxInvoiceRc.tsx` to portal directly to `document.body`, suppress `#root`, hide control toolbars (`propos-receipt-toolbar`), and dynamically switch between A4 standard invoice and 80mm thermal receipt formats.
- Upgraded `ProPosShiftCloseDl.tsx` to portal directly to `document.body`, suppress `#root`, isolate the thermal handover slip (`#thermal-handover-slip`), and add keyboard listeners.
- Upgraded `EmployeeAttendanceModal.tsx` Payslip Studio to portal directly to `document.body`, eliminating legacy `visibility: hidden` and `position: fixed` rules that caused blank page generation.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/vendorPrintModal.test.tsx src/tests/vendorStatementOfAccountModal.test.tsx src/tests/grnLogisticsAndTerms.test.tsx src/tests/staffPrintModal.test.tsx src/tests/poPrintCorporateIdentityUnblocking.test.tsx src/tests/batchBarcodePrintModal.test.tsx src/tests/packingSlipManagementModal.test.tsx src/tests/proposTaxInvoiceReceipt.test.tsx src/tests/proposShiftCloseModal.test.tsx src/tests/employeeAttendancePayslipModal.test.tsx
```

---

## 9. Verification Results
```text
 Test Files  10 passed (10)
      Tests  44 passed (44)
   Start at  16:03:42
   Duration  2.55s
```
- POS Tax Invoice Receipt: 3/3 tests passed.
- POS Shift Closeout Modal: 2/2 tests passed.
- Employee Attendance & Payslip Studio Modal: 2/2 tests passed.
- Vendor Print Modal: 7/7 tests passed.
- Vendor Statement of Account Modal: 5/5 tests passed.
- GRN Logistics & Terms: 4/4 tests passed.
- Staff Print Modal: 6/6 tests passed.
- PO Corporate Identity: 7/7 tests passed.
- Batch Barcode Print Modal: 4/4 tests passed.
- Packing Slip Management Modal: 4/4 tests passed.

---

## 10. Known Limitations
- Modals that render iframe or third-party PDF viewers (e.g. PDF.js canvas) require separate print bridge connectors if not rendered via browser DOM.
- In headless CI testing environments where `document.body` is mocked or absent, components safely fall back to rendering static markup without crashing.

---

## 11. Future Work
- Extend body portal standard to remaining secondary ledger modals if any ad-hoc components are discovered.
- Consider a shared reusable `<SmritiPrintPortal>` wrapper component across the design system to centralize CSS injection and keyboard shortcuts.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Print Preview & Hardware Spool Architecture
- `ADR-0045`: Single-Tree Body Portal Migration for Multi-Format Output

---

## 13. Related RFCs
- `RFC-2026-PRINT-01`: Chromium Layout Displacement & Modal Print Isolation
