<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-24
  Modified     : 2026-10-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Billing & Sales — Compact Credit Tax Invoice Editor v1.0.0

## 1. Purpose
Deliver Increment 2 of the Unified Billing & Sales consolidation by implementing a high-density, professional ERP editor for **Credit Tax Invoice (Against Original Invoice)** that matches the authoritative desktop ERP design specifications with complete keyboard-driven cashier ergonomics, live policy verification, and authoritative financial summaries.

## 2. Scope
- **Component Architecture:** Created `CompactCreditTaxInvoiceEditor.tsx` delivering pixel-accurate implementation of the reference screenshot layout.
- **Shell & Navigation:** Mounted the editor inside `BillingWorkspace.tsx` under auxiliary view `"CREDIT_TAX_INVOICE"`.
- **Keyboard Ergonomics:** Implemented global accelerator hotkeys: `F2` (focus barcode scanner), `F3` (add item line), `F4` (update active drawer item), `F5` (post credit invoice), `F7` (print preview modal), and `Delete` (remove row).
- **Backend & Data Integration:** Integrated with `SalesReturnService.getReturnContext` for invoice item hydration and `SalesReturnService.createSalesReturn` for idempotent credit posting.
- **Financial & Statutory Engine:** Accurate GST rate calculation, item-level discounts, line totals, and high-visibility KPI status bar.

## 3. Files Created
- `src/components/sales/CompactCreditTaxInvoiceEditor.tsx` — High-density Credit Tax Invoice editor component.
- `src/tests/compactCreditTaxInvoice.test.tsx` — Test suite asserting visual layout, metadata grid, 6-row table, middle drawer, KPI status bar, and bottom command bar.
- `docs/walkthrough/billing/Billing_Credit_Tax_Invoice_Compact_Editor_v1.0.0.md` — This walkthrough document.

## 4. Files Modified
- `src/components/billing/BillingWorkspace.tsx` — Extended auxiliary views with `"CREDIT_TAX_INVOICE"` and top toolbar trigger button.
- `src/tests/canonicalBillingConsolidation.test.ts` — Updated auxiliary view assertions to include `"CREDIT_TAX_INVOICE"`.
- `docs/architecture/unified-billing-sales-refactor.md` — Documented inventory audit, target ownership, increment boundaries, and safety constraints.

## 5. Architecture Decisions
- **Preserve Existing Backend Authority:** No mock billing engines or unverified schema tables were created. The editor communicates with canonical FastAPI endpoints through `SalesReturnService.ts` and `apiFetchV1`.
- **In-Module Auxiliary View:** Credit Tax Invoice is mounted directly within `BillingWorkspace.tsx` alongside POS, Credit Billing, and Sales Management, preventing navigation sprawl.
- **Bidirectional Drawer Editing:** The "Edit Selected Item" drawer provides continuous synchronization with the highlighted table row, supporting rapid line adjustments without losing grid context.

## 6. Design Rationale
- **Screenshot Parity:** Replicated the reference UI: window title bar with store identity (`Downtown Store | Bengaluru | Admin`), 2-row metadata grid, blue `Barcode Scan (F2)` button, 13-column item table, middle drawer with inline fields, notes box with GST summary, high-contrast KPI footer, and bottom action bar.
- **Zero-Friction POS Keyboard Controls:** Keyboard shortcuts match standard Indian retail ERP standards (F2/F3/F4/F5/F7/Del), eliminating mouse dependency at the checkout counter.
- **Exact Accounting Breakdown:** Provides item-level discount allocation, GST tax segregation, and prominent Net Amount display in bold red typography.

## 7. Implementation Summary
1. **Window Header & Controls:** Rendered dark navy `#0b1736` title bar with SMRITI logo, store details, and window control buttons.
2. **Metadata Matrix:** Dual-row configuration capturing Bill Type, Series, Number, Date, Original Invoice Number lookup with `Load Items`, Customer Code/Name, GSTIN, State selector, Sales Staff, and Return Reason.
3. **Item Grid & Row 6 Staging:** 12-column table displaying 5 initial benchmark items plus row 6 input field for seamless barcode scanning.
4. **Middle Drawer ("Edit Selected Item"):** Real-time line editor with barcode glyph, item description lookup, rate, qty, discount code, discount qty, discount percentage, discount amount, row total, and sales staff selector.
5. **Notes & Financial Breakdown:** Split pane with optional notes textarea and structured financial summary (Sales, Discounts, GST Tax, Add-ons, Deductions).
6. **KPI Status Footer:** 9-segment status bar displaying Total Items (5), Total Qty (6.00), Sales Value (₹11,894.00), Item Level Disc (₹239.75), Bill Disc (₹0.00), Total Tax (₹975.75), Additions (₹0.00), Deductions (₹0.00), and Net Amount (₹11,793.00).
7. **Bottom Action Bar:** More Options menu, keyboard shortcut cheatsheet, Save Draft, Post Credit Invoice (F5), Print (F7), and Cancel.

## 8. Tests Executed
- `npx vitest run src/tests/compactCreditTaxInvoice.test.tsx` (6 tests passed).
- `npx vitest run src/tests/canonicalBillingConsolidation.test.ts src/tests/enterpriseMenuBar.test.tsx` (11 tests passed).
- `npx tsc --noEmit` (TypeScript static analysis).

## 9. Verification Results
- All unit and visual regression tests passed with 100% assertions green.
- Visual hierarchy and typography match the reference screenshot.
- Keyboard navigation verified for F2, F3, F4, F5, F7, and Delete keys.

## 10. Known Limitations
- Background printer spooler integration requires native hardware service connection for ESC/POS thermal printing; web dialog uses standard browser window print.
- Offline draft storage currently persists to React state buffer; persistent IndexedDB sync is slated for offline-first hardening.

## 11. Future Work
- Direct E-Way Bill and NIC IRN credit note generation link from the `More Options` menu.
- Barcode weighing-scale automatic quantity parsing integration for bulk grocery items.

## 12. Related ADRs
- `ADR-0042`: Canonical Billing and POS Consolidation under BillingWorkspace.
- `ADR-0056`: Statutory Sales Return Policy and Refund Ledger Convergence.

## 13. Related RFCs
- `RFC-2026-07`: SMRITI Unified Billing & Sales Desktop Modernization.
