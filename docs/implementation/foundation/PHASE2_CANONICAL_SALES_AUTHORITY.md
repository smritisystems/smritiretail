# Phase 2 — Canonical Sales and Billing Authority

## Objective

Establish one tenant-database financial write authority for sales, billing, stock movements, payments, and downstream adapters. UI work follows writer convergence; it does not define financial behavior.

## Authority

`backend/app/services/sales_ledger_svc.py` is the target transaction authority for confirmed sales posting because it owns the invoice snapshot, `stock_movements`, batch handling, tenant context, outbox event, and reversal boundary.

`SalesService` remains the compatibility-facing sales API adapter during migration. It must delegate confirmed financial posting to the authority before it is considered retired.

## Adapter Boundaries

| Adapter | Current path | Phase 2 responsibility | Status |
| --- | --- | --- | --- |
| Customer PO | `CustomerPOService` and sales-order conversion | Validate PO allocation, then delegate invoice posting | Pending |
| Sales Order | `SalesService.create_sales_order` and conversion | Preserve order lifecycle; delegate invoice conversion and allocation posting | Pending |
| POS | `POSService.pos_checkout` | Preserve shift lock, tender, and cashier context; delegate invoice and stock posting | First slice |
| E-commerce | `EcomGrowthEngine.converge_order` | Normalize external order, then delegate confirmed invoice posting | Pending |
| Offline Sync | `OfflineConflictResolutionEngine` / `UnifiedSalesLedgerService` | Remain an idempotent transport adapter over the authority | Partial |
| Payments | `PaymentsEngine` | Remain the sole payment transaction writer | Pending duplicate removal |
| General Ledger | `UnifiedAccountingLedgerService` | Consume committed financial events; never duplicate invoice writes | Pending |

## Duplicate Writers Identified

- `POSService.pos_checkout` directly creates `SalesInvoice`, `SalesInvoiceItem`, and `StockMovement`, and mutates `Product.stock`.
- `SalesService.create_sales_invoice` independently creates invoices and performs stock/batch work.
- `EcomGrowthEngine.converge_order` independently creates invoices and stock movements.
- `UnifiedSalesLedgerService.post_sales_invoice` is already used by offline sync but has a separate invoice contract.
- `pricing_payment.py` creates payment transactions outside `PaymentsEngine`.

## First Slice: POS Adapter Convergence

The first production change must preserve these POS invariants while delegating financial posting:

1. Shift is locked and must be `OPEN`.
2. Invoice number is tenant-scoped and idempotent.
3. One confirmed invoice produces exactly one stock movement per stock line.
4. Product, variant, company, branch, and warehouse identity remain tenant-scoped.
5. Payment mode and shift linkage are preserved.
6. Failed posting rolls back invoice, stock, outbox, and shift-side effects together.

The adapter contract must be characterized before the route is rewired because the current POS and ledger services differ in discount handling, variant resolution, stock decrement semantics, and shift linkage.

## Retirement Order

1. Characterize and converge POS through the authority.
2. Route standard Sales invoice confirmation through the same authority.
3. Route Customer PO and Sales Order conversion through the authority.
4. Route E-commerce convergence through the authority.
5. Remove `pricing_payment.py` payment writes in favor of `PaymentsEngine`.
6. Make GL posting event-driven from committed canonical transactions.
7. Consolidate duplicate frontend invoice/order submission modules.
8. Enforce the Single Workspace Principle after backend writer parity is proven.

## Validation Gates

- Focused POS checkout and closed-shift tests.
- Invoice idempotency and duplicate-document tests.
- Stock movement cardinality and quantity reconciliation.
- Tenant and branch isolation tests.
- Offline sync replay and conflict tests.
- E-commerce convergence tests.
- Payment and GL posting tests.
- Frontend contract tests only after backend authority parity is established.

Historical Alembic migrations remain immutable. All financial writes remain inside the Company DB; `smritisys` is never a transaction target.
