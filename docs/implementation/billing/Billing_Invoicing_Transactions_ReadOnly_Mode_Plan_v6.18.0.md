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

# Billing Invoicing Transactions Browser & Read-Only Audit Terminal Plan v6.18.0

## 1. Objective
Implement a high-density, real-time Invoicing & Commercial Transaction Browser directly inside the Billing Terminal (`BillingTerm.tsx`), coupled with a secure, immutable **Read-Only Audit Mode** for inspecting finalized invoices, sales orders, customer returns, cancelled bills, and suspended checkouts.

## 2. Business Motivation
In high-throughput retail stores, cashiers and supervisors frequently encounter customer dispute inquiries, warranty queries, exchanges, and reprints. Forcing staff to leave the billing interface or rely on back-office accounting reports slows checkout lanes. Furthermore, viewing past invoices inside the active billing terminal without strong immutability guarantees risks inadvertent line item deletions, price overrides, or accidental re-billing. An explicit, tamper-proof read-only state with clear visual indicators guarantees statutory compliance and operational velocity.

## 3. Scope
- 5-tab transaction modal: `INVOICES`, `ORDERS`, `RETURNS`, `CANCELLED`, `SUSPENDED`.
- Live client-side and server-side filtering across document numbers, customer identities, and dates.
- Read-Only Mode in `BillingTerm.tsx` locking item grid mutations, inputs, customer selection, and discounts.
- Hotkey triggers: `F4`, `Alt+6`, and dedicated header toolbar button.
- Reprints: Direct PDF print triggers from the modal and from the read-only terminal action bar.
- Preflight Certification and registration in `smritisys` architecture registry.

## 4. Current State
- `BillingTerm.tsx` supported new transaction creation, barcode scanning, and tender settlement.
- Prior inspection of past sales relied on separate report workspaces or static dialogs.
- `ProPosReprintDlg.tsx` relied on hardcoded placeholder data.

## 5. Gap Analysis
1. **Lack of Integrated Transaction Browser**: Operators had no direct in-terminal access to historical sales transactions.
2. **Missing Terminal Lockout**: No mechanism existed to view a finalized invoice inside `BillingTerm.tsx` without risking editing the lines.
3. **Hardcoded Reprint Dialogs**: POS reprint dialogues did not query live canonical PostgreSQL records.

## 6. Architecture Impact
- **UI Architecture**: Added `InvoicingTransactionBrowserModal.tsx` wrapped with `withCapability` under entity `sales_invoice`, capability `sales_invoice.transaction_browser`, role `SPECIALIZED_UI`.
- **API Utilization**: Pure consumption of canonical endpoints (`/api/v1/sales/invoices`, `/api/v1/sales/orders`, `/api/v1/sales/returns`, `/api/v1/sales/invoices/suspended`).
- **Control Plane**: Registered capabilities and ADRs (`ADR-INV-01`, `ADR-HR-001`) in `smritisys` database.

## 7. Proposed Design
- A modal dialog with 5 segmented category tabs, a live search filter bar, and a high-density responsive table.
- Selecting any transaction invokes `handleSelectDocumentFromBrowser`, mapping line items, taxes, and customer details, setting `isReadOnlyView = true`.
- Top amber alert bar communicates document locking and provides one-click PDF printing or exit back to new billing (`Ctrl+N`).

## 8. Files Created
- `src/components/billing/InvoicingTransactionBrowserModal.tsx`
- `src/tests/invoicingTransactionBrowser.test.ts`
- `docs/walkthrough/billing/Billing_Invoicing_Transactions_ReadOnly_Mode_v6.18.0.md`
- `docs/implementation/billing/Billing_Invoicing_Transactions_ReadOnly_Mode_Plan_v6.18.0.md`

## 9. Files Modified
- `src/components/billing/BillingTerm.tsx`
- `src/components/billing/propos/ProPosReprintDlg.tsx`
- `src/components/staff/StaffMasterWs.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- FastAPI Core backend with PostgreSQL.
- React 18 + Vite frontend runtime.
- Lucide React icon suite.
- Architecture Governance Preflight Certificate Engine.

## 11. Risks
- **Accidental State Leakage**: Risk that exiting read-only mode leaves residual locked state.
  - *Mitigation*: `exitReadOnlyMode` performs a full reset back to `resetForm()`, restoring all editable states cleanly.

## 12. Rollback Strategy
- Atomic Git revert of `BillingTerm.tsx` and deletion of `InvoicingTransactionBrowserModal.tsx`.
- Reverse capability entries in `architecture_capabilities` if required.

## 13. Verification Plan
- Unit and contract tests with Vitest.
- TypeScript compiler (`tsc --noEmit`).
- Architecture Duplication Gate (`scripts/architecture_duplication_gate.py`).
- Production build validation (`npm run build`).

## 14. Test Plan
- Verify tab navigation across all 5 transaction states.
- Verify search query matching against document IDs and customer names.
- Verify line item quantity and rate mapping from backend payloads.
- Verify lockout of row deletion buttons and tender settlement.

## 15. Documentation Impact
- Added Walkthrough: `docs/walkthrough/billing/Billing_Invoicing_Transactions_ReadOnly_Mode_v6.18.0.md`.
- Updated Master Indexes: `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
- Pull changes into test environment (`F:\Smriti9\apps\smriti_retail_os`) per environment rules.
- Production deployment via standard Git release pipeline.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-INV-01`: Commercial Invoicing & Transaction Browser in Billing Window
- `ADR-HR-001`: Staff 360 Workspace & User Access Management
- `ADR-VEND-01`: Vendor 360 Workspace & Universal Party Master Canonical Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Invoicing_Transactions_ReadOnly_Mode_v6.18.0.md`
