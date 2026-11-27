# Module-wise Functional Assessment

## Method

This report distinguishes **code presence** from **operational status**. No user login, API request, database transaction, integration, or browser workflow was executed. Module inventory documents describing a feature as `Done` are not treated as runtime proof.

## Workflow status

| Workflow/domain | Source path evidence | Assessment |
|---|---|---|
| Purchase: supplier → PO → approval → barcode → receiving/GRN → stock | `api/v1/purchase.py`, `services/purchase.py`, purchase schemas/models, React purchase/GRN views and focused frontend tests. | Implemented in source; transaction boundaries, stock posting, idempotency, audit and end-to-end completion unverified. |
| Sales: customer/item → stock check → billing/payment → inventory/reporting | sales/billing/POS APIs, services, models, billing components, calculator/validator helpers and tests. | Implemented in source; no database-level sales commit or reconciliation executed. |
| Inventory: receipt → movement → transfer/adjustment/count/valuation | inventory/WMS/physical-stock APIs and models, services and UI. | Implemented in source; concurrency, valuation correctness, FK integrity and ledger reconciliation unverified. |
| POS/cash: shift open → tenders/cash moves → closing/reconciliation | POS APIs, cash-register/shift models, frontend POS modules and tests. | Implemented in source; real register and settlement state not inspected. |
| Returns/exchanges | Sales return/exchange APIs/services and frontend flows/test files. | Source and unit-level coverage exist; cross-workflow stock/payment reversal not proven. |
| Supplier payments / finance / accounting | Supplier payment, finance, payments, accounting, reporting and integration sources. | Present; ledger posting and external reconciliation not executed. |
| CRM/customer/loyalty | CRM routes, schemas, customer services, loyalty components and models. | Present; company/branch scoping and data integrity unverified. |
| GST/compliance/e-invoice/e-waybill | Compliance APIs/models and configuration. E-way bill live calls disabled by default. | Source/config only; no statutory API call or fiscal reconciliation. |
| eCommerce/omnichannel | E-commerce APIs, outbox/connectors and UI. | Partially evidenced; no external delivery or idempotent retry test. |
| E-commerce webhook ingestion | Webhook route and tenant resolver paths exist. | Static security review found a bearer-to-SYSADMIN tenant resolution path; no request was sent. Treat as a release blocker. |
| Loyalty/commission reversals | CGE unified routes and service mutations exist. | Static security review found no role check, refund verification or idempotency in the reversal path; no transaction was made. |
| TallyPrime/data exchange | Tally connector/service and data bridge/import/export code. | Integration code exists; no test against a real or sandbox Tally endpoint. |
| Backups/restores | Backup engine, scheduler, UI and operational guide. | Code and documentation exist; no successful backup artifact/restore drill verified. |
| Training sandbox | Frontend training store and sandbox UI. | Local-only implementation; not evidence of production transaction processing. |

## Example end-to-end workflow verdicts

- **Purchase:** No PO-to-GRN-to-stock transaction was exercised; cannot certify each transition, duplicate prevention, approval, valuation, or audit trail.
- **Sales:** No invoice/tender/inventory transaction or report was exercised; calculations and atomicity are not certified.
- **Inventory:** No stock movement, transfer, physical count, or valuation was executed against an isolated company DB.
- **Cash register:** No shift opening/closing or tender reconciliation was performed.
- **Accounting:** No export/import or Tally reconciliation was performed.

## Functional risks

- Non-SYSADMIN tenant context now fails closed when company identity is absent; focused mocked regression tests passed (EA-SEC-01).
- Backup database/session fallbacks are removed; focused mocked failure-path tests passed (EA-DB-01).
- The full Vitest suite has one load-sensitive timeout; focused test passed separately.
- API, ORM, migration and front-end presence cannot establish that the database schema, API contracts and UI payloads align.

## Overall classification

The product has wide functional surface area and dedicated components/routes/services for core retail operations. Operational workflows must currently be classified as **implemented but unverified**, not “passed” or “enterprise ready.” A database-backed, isolated E2E suite and a test-data-backed browser run are prerequisites for raising confidence.
