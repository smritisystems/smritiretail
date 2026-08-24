<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.10.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Smriti Distributor Stitch-Integrated Tax Invoice Workspace v4.10.0

## 1. Purpose
The purpose of this implementation is to provide a specialized, high-density, keyboard-driven Tax Invoice creation workspace ("Smriti Distributor") strictly adhering to the Stitch Design System layout specification and 1:1 visual fidelity with `code.html`.

## 2. Scope
- Full replacement of legacy in-place sales invoice forms in Sales Studio with the Smriti Distributor Tax Invoice Workspace.
- Implementation of high-density direct entry row (`F1`), tactical item grid, customer selector (`F2`), multi-tab logistics and settlement panel, net values summary, high-visibility status strip, and hotkey listeners.
- Automated calculation of taxable values, item discounts, scheme discounts, SGST/CGST/IGST tax splits, addons, deductions, and net payable in Indian currency.
- Headless verification via automated test suites (`vitest`) and Vite production bundle builds.

## 3. Files Created
- `src/components/sales/SmritiDistributorTaxInvoiceWorkspace.tsx`
- `src/components/sales/components/TaxInvoiceHeaderToolbar.tsx`
- `src/components/sales/components/TaxInvoiceDocumentPanel.tsx`
- `src/components/sales/components/TaxInvoiceItemGrid.tsx`
- `src/components/sales/components/TaxInvoiceDirectEntryBar.tsx`
- `src/components/sales/components/TaxInvoiceFooterTabs.tsx`
- `src/components/sales/components/TaxInvoiceNetValuesPanel.tsx`
- `src/components/sales/components/TaxInvoiceStatusBar.tsx`
- `src/components/sales/types.ts`
- `src/tests/smritiDistributorTaxInvoice.test.ts`
- `docs/walkthrough/sales/Smriti_Distributor_Tax_Invoice_Stitch_UI_v4.10.0.md`

## 4. Files Modified
- `src/App.tsx`
- `src/components/SalesStudioTab.tsx`
- `src/index.css`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Material 3 / Fiori Horizon Hybrid Palette**: Integrated extended color tokens (`bg-surface`, `bg-surface-container-low`, `bg-primary-container`, `text-on-secondary-container`) directly into Tailwind v4 base layers.
- **Direct Entry Rapid Input Engine**: Maintained an isolated entry state in `TaxInvoiceDirectEntryBar.tsx` allowing fast barcode scanning and automated calculation before appending rows into the document item state.
- **Statutory Tax Alignment**: Unified back-calculation and IGST vs Intrastate tax calculation with the PostgreSQL backend ledger endpoints (`/api/v1/sales/invoices`).

## 6. Design Rationale
The Stitch design specification provides desktop ergonomics for distributor invoice billing desks where speed, visibility of totals, clear tax breakdown, and keyboard navigation (`F1`, `F2`, `Ctrl+S`, `ESC`) eliminate mouse dependency and minimize entry errors.

## 7. Implementation Summary
- Re-architected `SalesStudioTab.tsx` to mount `SmritiDistributorTaxInvoiceWorkspace` upon triggering "New Invoice".
- Created modular UI subcomponents reflecting the top navigation bar, header document parameters, main grid, direct entry bar, footer tabs (Transporter, Payment, AddOns), net values grid, and high-visibility status bar.
- Implemented comprehensive keyboard shortcuts and dialogs for customer search (F2 modal) and direct entry submission.

## 8. Tests Executed
```bash
$ npm test
```
All 42 test suites (324 individual tests) passed with zero errors, including 5 dedicated tax invoice calculation tests in `src/tests/smritiDistributorTaxInvoice.test.ts`.

## 9. Verification Results
```bash
$ npx vite build
✓ 3499 modules transformed.
✓ built in 20.84s
```
Production bundle compiled cleanly without syntax or type errors.

## 10. Known Limitations
- Background retry synchronization uses local memory queue when FastAPI is running offline.

## 11. Future Work
- Integration with direct E-Way Bill JSON export generator for immediate NIC portal upload.
- Batch printing spooling integration via QZ Tray for dot-matrix continuous stationery.

## 12. Related ADRs
- `docs/adr/ADR-0017-FastAPI-Sole-System-Of-Record.md`
- `docs/adr/ADR-0021-Stitch-Enterprise-UI-Design-System.md`

## 13. Related RFCs
- `docs/rfc/RFC-0034-Distributor-Billing-Matrix.md`
