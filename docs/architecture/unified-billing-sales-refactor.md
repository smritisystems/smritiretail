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

# Billing & Sales Consolidation

## Audit inventory

| Area | Existing owner | Current responsibility | Consolidation decision |
| --- | --- | --- | --- |
| Billing workspace and POS | `src/components/billing/BillingWorkspace.tsx`, `SmritiBillingStudio.tsx` | Retail POS, B2B invoicing, shift reports, operational POS tools | Keep as the canonical UI shell and retain mode-specific workflows |
| Credit billing | `src/components/billing/SmritiCreditBillingTerminal.tsx` | Credit sale capture and invoice submission | Keep as a contextual workflow; do not duplicate its posting logic |
| Sales documents | `src/components/SalesStudioTab.tsx`, `src/components/sales/*` | Quotations, orders, invoice history, returns and related actions | Mount this existing owner inside BillingWorkspace; do not rebuild its document screens |
| Unrouted tax-invoice prototype | `src/components/sales/DistTaxInvoice.tsx`, `src/components/sales/components/TaxInvoice*` | Separate tax invoice form with local totals and a direct `/sales/invoices` submit | No active shell caller found. Do not route production billing through it until its local calculation, demo defaults, import/recall handlers, credit-note semantics, and posting contract are reconciled |
| Legacy return dialog | `src/components/ProcessSalesReturn.tsx` | Return UI invoked by SalesStudioTab | Live caller confirmed. Updated to load policy-aware context, remaining quantities and tax from the server and submit via the existing idempotent service; server remains authoritative |
| Navigation and aliases | `src/components/shell/EnterpriseMenuBar.tsx`, `TabRenderer.tsx`, `navigationAccess.ts` | Multiple POS, ProPOS and Sales entries; historical IDs | One visible Billing & Sales entry; keep legacy route IDs as compatibility aliases |
| Canonical billing calculation | `backend/app/services/headless_billing.py`, `backend/app/api/v1/billing.py` | Statutory price/discount/GST calculation preview | Preserve as the shared calculation authority |
| Canonical invoice writer | `backend/app/services/canonical_sales_writer.py`, `canonical_transaction_writer.py` | Sales invoice validation, item resolution, canonical writes | Preserve as posting authority |
| Sales document contracts | `backend/app/api/v1/sales.py`, `backend/app/models/sales.py` | Invoices, quotations, orders, returns and conversion | Keep workflow endpoints and tables distinct |
| POS operations | `backend/app/api/v1/pos.py`, `backend/app/models/pos.py` | Registers, shifts, cashier operations and POS lifecycle | Keep POS-specific operational ownership |
| Payments | `backend/app/api/v1/payments.py`, `backend/app/models/payment_ledger.py` | Tender transactions, refunds and invoice allocations | Keep payment ledger ownership and reconciliation contracts |
| Bulk invoice import | `backend/app/api/v1/billing_csv.py`, `src/services/universalImportEngine.ts` | Billing CSV import, validation and batch support | Reuse the existing import path; no second import engine |
| Returns/refunds | `backend/app/services/sales_return_policy.py`, `sales_return_refund_adapter.py`, `src/services/salesReturnService.ts` | Remaining-quantity/policy resolution and refund ledger integration | Use policy-aware return context and server validation |
| Reports/printing | `backend/app/api/v1/sales_reports.py`, invoice PDF endpoints in `sales.py`, existing print components | Sales/return reporting and invoice output | Retain endpoint and document contracts; expose from unified module contextually |

Existing route aliases in `TabRenderer.tsx` converge many historical billing IDs into BillingWorkspace, but the old menu exposed separate POS, ProPOS, Sales Studio, and Sales Desk entries. Those visible entries have been collapsed while compatibility route IDs remain. The repository includes targeted tests such as `canonicalBillingConsolidation.test.ts`, `billingWorkspaceConvergence.test.ts`, sales return service/integration tests, POS, import, and billing calculation tests. Tests are evidence of intended contracts, not proof that each interaction currently works.

## Target ownership

- `BillingWorkspace` is the single navigation and context shell.
- Its current POS, credit, distributor, reporting, and operational workflows remain owned by their existing components.
- Existing `SalesStudioTab` becomes an in-module contextual view for quotations, orders, invoice history, returns, and sales activity.
- Billing exposes policy-permitted source choices after customer selection. Direct invoices and Customer POs remain in the billing terminal; Sales Orders and Packing Slips navigate to their dedicated workflows and are not implicitly converted into invoice lines.
- Required delivery-store selection is presented by store code, with the outlet name as context. Switching between Direct Invoice and Customer PO is blocked while bill lines exist, preventing source changes from silently relabeling or replacing a draft.
- Existing API routers and business services remain owners for writes, calculations, document numbering, inventory, and payments.
- Invoice, order, return, register/shift, and payment records remain in their current tables and ledgers. No schema migration is proposed by this UI consolidation.

## Increment plan

1. Audit and inventory completed above; preserve existing migrations and posted data. Completed.
2. Put Sales Studio inside the canonical workspace and collapse duplicated visible billing navigation while retaining compatibility IDs. Completed in Increment 2.
3. Deliver high-density compact Credit Tax Invoice editor matching the reference screenshot layout, and adapt into a unified Dual-Mode Editor supporting Tax Invoice (Direct B2B/Retail) and Credit Tax Invoice via NumberingEngine dynamic series/sequence and canonical posting. Completed in Increments 2 & 3.
4. Route credit/return entry through the established server return context and billing calculation rules; preserve the original invoice, remaining quantities, and policy checks. Completed via `SalesReturnService` integration and policy-aware context loading.
5. Run targeted frontend/backend tests and builds, then report pass/fail, unverified areas, modified/deprecated files, and rollback steps. Verified with 20/20 Vitest tests green, 0 tsc errors, and 11/11 architecture gate checks passed.

## Safety constraints

No new billing engine, database, table, migration, or transaction rewrite is part of this plan. Do not remove an implementation until callers and existing API/report/print consumers have been verified. Posted transaction values remain server-authoritative.
