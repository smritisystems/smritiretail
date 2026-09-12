<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.18.0
  Created      : 2026-09-11
  Modified     : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing Invoicing Transactions Browser & Read-Only Audit Terminal Walkthrough v6.18.0

## 1. Purpose
This walkthrough documents the implementation of the comprehensive Invoicing & Commercial Transaction Browser and immutable Audit Read-Only Mode inside the SMRITI Retail OS Billing Terminal (`BillingTerm.tsx`). This feature fulfills statutory auditability, customer dispute resolution, and cashier verification workflows by allowing operators and supervisors to browse, search, and inspect all finalized invoices, sales orders, returns, cancelled transactions, and suspended bills directly inside the billing window under an immutable, tamper-proof read-only state.

## 2. Scope
- **Transaction Browser Modal Component**: Created [`InvoicingTransactionBrowserModal.tsx`](file:///f:/SMRITRretailNX/src/components/billing/InvoicingTransactionBrowserModal.tsx) supporting 5 categorized tabs (`INVOICES`, `ORDERS`, `RETURNS`, `CANCELLED`, `SUSPENDED`) with real-time multi-criteria search, status pill indicators, order fulfillment ratios (`total / billed / pending`), and direct PDF printing actions.
- **Terminal Read-Only Audit Mode**: Extended [`BillingTerm.tsx`](file:///f:/SMRITRretailNX/src/components/billing/BillingTerm.tsx) with an immutable `isReadOnlyView` state that locks all entry inputs, item mutations, row deletions, discounts, and customer overrides, while displaying a high-contrast amber audit banner with document metadata and an exit shortcut (`Ctrl+N`).
- **Keyboard Shortcuts & Quick Access**: Integrated `F4` and `Alt+6` hotkeys and added a dedicated `History` toolbar action in the billing window to invoke the browser modal instantaneously.
- **ProPOS Reprint Integration**: Refactored [`ProPosReprintDlg.tsx`](file:///f:/SMRITRretailNX/src/components/billing/propos/ProPosReprintDlg.tsx) to dynamically query `/api/v1/sales/invoices` and `/api/v1/sales/returns` instead of static placeholder arrays.
- **Architecture & Preflight Governance**: Registered novel capabilities and decisions in `smritisys` control plane (`sales_invoice.transaction_browser`, `hr.staff_master`, `ADR-INV-01`, `ADR-HR-001`), issued cryptographically tracked preflight certificates, and verified 10/10 checks with 0 violations in `architecture_duplication_gate.py`.
- **Test Suite Verification**: Authored [`src/tests/invoicingTransactionBrowser.test.ts`](file:///f:/SMRITRretailNX/src/tests/invoicingTransactionBrowser.test.ts) covering tab switching, search filtering, line item mapping, and cancellation audit trails.

## 3. Files Created
- [`src/components/billing/InvoicingTransactionBrowserModal.tsx`](file:///f:/SMRITRretailNX/src/components/billing/InvoicingTransactionBrowserModal.tsx): Universal commercial transaction browsing modal component.
- [`src/tests/invoicingTransactionBrowser.test.ts`](file:///f:/SMRITRretailNX/src/tests/invoicingTransactionBrowser.test.ts): Unit and contract test suite for the transaction browser modal.
- [`docs/walkthrough/billing/Billing_Invoicing_Transactions_ReadOnly_Mode_v6.18.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/billing/Billing_Invoicing_Transactions_ReadOnly_Mode_v6.18.0.md): This walkthrough document.

## 4. Files Modified
- [`src/components/billing/BillingTerm.tsx`](file:///f:/SMRITRretailNX/src/components/billing/BillingTerm.tsx): Integrated transaction browser modal, read-only audit banner, row deletion lockout, hotkeys, and dynamic PDF reprinting.
- [`src/components/billing/propos/ProPosReprintDlg.tsx`](file:///f:/SMRITRretailNX/src/components/billing/propos/ProPosReprintDlg.tsx): Dynamic backend API fetching for recent invoices and sales returns.
- [`src/components/staff/StaffMasterWs.tsx`](file:///f:/SMRITRretailNX/src/components/staff/StaffMasterWs.tsx): Wrapped with `withCapability` and registered `hr.staff_master` canonical capability.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md): Appended v6.18.0 entry to master index.

## 5. Architecture Decisions
1. **Immutable In-Terminal Document Inspection**:
   - Rather than navigating away to separate report views, operators require immediate context verification (e.g. verifying previous invoice lines during customer exchange). When a document is loaded from the browser into `BillingTerm.tsx`, the terminal transitions into `isReadOnlyView = true`.
   - All state mutations (barcode scanning, quantity editing, unit price adjustment, item deletion) are completely locked. The bottom primary action switches from `F8 Settle` to `Print Document`.
2. **Dynamic Multi-Endpoint Aggregation**:
   - The browser modal communicates with canonical FastAPI endpoints:
     - Invoices: `GET /api/v1/sales/invoices?page_size=100`
     - Orders: `GET /api/v1/sales/orders` and `/api/v1/sales/customer-pos`
     - Returns: `GET /api/v1/sales/returns`
     - Suspended: `GET /api/v1/sales/invoices/suspended`
   - Data structures are normalized into a unified display model providing uniform search across document numbers, customer names, and mobile numbers.
3. **Architecture Preflight & Capability Enforcement**:
   - In adherence to Rule 7 & 8 of SMRITI Governance, all new UI assets carry `@SmritiCapability` / `withCapability` declarations, linking to approved ADRs (`ADR-INV-01`, `ADR-HR-001`) and registered in the `smritisys` control plane.

## 6. Design Rationale
Prior to this release, cashiers needing to inspect a past invoice or check an earlier order had to leave the billing screen or rely on separate reporting modules. This caused cashier lane delays during return or warranty inquiries. By embedding a high-density, multi-tab transaction browser triggered via `F4` / `Alt+6`, cashiers can inspect historical records in milliseconds. Furthermore, locking the terminal into an explicit, styled Read-Only mode eliminates the danger of accidental modification or duplicate billing of finalized statutory documents.

## 7. Implementation Summary
- **Browser Modal**: High-density table displaying Document #, Date/Time, Customer, Total Quantity / Line Items, Status Pill, and Grand Total. Includes live search across all columns and a dedicated tab for cancelled invoices displaying the reason and cancellation timestamp.
- **Terminal Audit View**: Amber top notification bar indicating `Audit Read-Only Mode — Document Locked [docNo] • Status: [status]`. Direct button to `Exit Audit Mode (Ctrl+N)` restores normal new-bill workflow.
- **Contract Parity**: Vitest test suite verifies that items loaded into the terminal map line prices, quantities, tax calculations, and discount amounts faithfully.

## 8. Tests Executed
1. **Transaction Browser & Read-Only Suite (`invoicingTransactionBrowser.test.ts`)**:
   - Tab structure and default active tab (5 tabs verified).
   - Real-time client-side search filtering by document number and customer name.
   - Sales Order fulfillment ratio computation (`total_qty`, `billed_qty`, `pending_qty`).
   - Line item transformation into `BillingTerm` row format with statutory MRP and tax rate preservation.
   - Cancelled invoices audit trail rendering.
2. **Vitest Billing Suites Regression (65 / 65 Green)**:
   - `invoicingTransactionBrowser.test.ts` (5 passed)
   - `billingTerm.test.ts` (8 passed)
   - `billingWorkspaceConvergence.test.ts` (5 passed)
   - `fullBilling.test.ts` (6 passed)
   - `billingCorporateWiring.test.ts` (5 passed)
   - `customerPoBillingContract.test.ts` (4 passed)
   - `proposOfflineSync.test.ts` (5 passed)
   - `proposSupervisorAuth.test.ts` (4 passed)
   - `proposCatalogCache.test.ts` (4 passed)
   - `proposReconciliation.test.ts` (4 passed)
   - `proPosKeys.test.ts` (15 passed)
3. **Architecture Duplication Gate (`scripts/architecture_duplication_gate.py`)**:
   - 10 checks executed: 0 P0/P1 violations.
4. **TypeScript Linter (`npm run lint` / `tsc --noEmit`)**:
   - Clean pass: 0 diagnostics.

## 9. Verification Results
- Vitest: 65 / 65 passed (100% green).
- Architecture CI Gate: PASSED (0 violations).
- TypeScript: 0 errors.

## 10. Known Limitations
- Suspended invoices currently load as read-only snapshots; converting a suspended invoice into an active checkout session requires resuming through the existing suspended bill checkout workflow.

## 11. Future Work
- Add barcode scanner shortcut directly inside the transaction browser modal to auto-filter by printed invoice barcode.
- Implement server-side pagination for transaction browsing on very high transaction volume stores (>50,000 invoices/month).

## 12. Related ADRs
- `ADR-INV-01`: Commercial Invoicing & Transaction Browser in Billing Window.
- `ADR-HR-001`: Staff 360 Workspace & User Access Management.
- `ADR-VEND-01`: Vendor 360 Workspace & Universal Party Master Canonical Architecture.

## 13. Related RFCs
- `RFC-2026-08`: Universal Commercial Transaction Inspection and Dispute Resolution in POS Terminals.
