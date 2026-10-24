# SMRITI Retail OS — Template Readiness

**Audit date:** 2026-10-23  
**Overall state:** No template is ready to provision from the evidence collected in this read-only audit.

## A. Distributor + Wholesale / Dealer

**Readiness: NOT READY TO PROVISION**

### Reusable code candidates

- Shared company/branch, customer/party, item/SKU/barcode, warehouse and stock services.
- Purchase order, procurement, receipt/GRN, landed cost, supplier payment, sales order/invoice, distribution, dispatch, and accounting APIs.
- Customer PO and CRM paths can support dealer relationships after tenant/customer rules are verified.

### Required before provisioning

1. Define dealer identity and credit ownership, receivables, collections, and return rules.
2. Establish trade price lists, quantity slabs, schemes, and channel-aware tax/pricing precedence.
3. Trace purchase order → receipt → landed cost → stock ledger → sales invoice → payment allocation → GL in an isolated DB.
4. Verify warehouse reservation, picking, dispatch, and dealer return paths.
5. Map dealer permissions to routes and menus, and validate company/branch boundaries.

### Blocking dependencies

- Live migration/schema parity is unknown; current checkout includes a modified migration.
- No end-to-end transaction tests or safe runtime checks were completed.
- Several routes and billing/sales screens overlap; canonical wholesale transaction writer and channel selection are not established.

**Evidence:** Distributor-related routers, models, services, and frontend areas exist.  
**Interpretation:** Static capability coverage is broad but workflow completeness and financial correctness are unverified.  
**Recommendation:** Use the existing purchase, stock, sales, customer, and accounting code as candidates only; resolve the channel and DB evidence before enabling the template.

## B. Retail Billing

**Readiness: NOT READY TO PROVISION**

### Reusable code candidates

- POS profiles and shifts, barcode lookup, item/variant fields, pricing/promotions, invoice print/PDF, payment ledger, returns, loyalty, and an offline synchronization queue.
- Frontend API client carries JWT and company/branch headers; FastAPI is the declared system of record.

### Required before provisioning

1. Select a single canonical billing screen and writer across `BillingWorkspace`, `BillingTerm`, `SmritiBillingStudio`, `SmritiCreditBillingTerminal`, and standalone billing.
2. Prove barcode → item selection → price/tax/discount → payment → invoice → stock movement → receipt, including returns/reversal.
3. Verify cashier shift opening/closing, cash drops, variance, day-end reconciliation, and role restrictions.
4. Test offline queue replay, idempotency, conflict handling, and recovery in an isolated environment.
5. Check printer/label behavior and receipt numbering with safe test fixtures.

### Blocking dependencies

- Billing screens have separate fallback and suspension paths; financial rule parity is unknown.
- No test runner or live API/database verification was completed.
- Payment allocation and stock/accounting consistency are static-only findings.

**Evidence:** POS, billing, payment, print, promotion, loyalty, and offline code are present.  
**Interpretation:** Feature presence does not prove a valid retail bill can be completed safely.  
**Recommendation:** First define a canonical billing flow and then verify it end-to-end against a disposable test database.

## C. Hybrid Distributor + Retail

**Readiness: NOT READY TO PROVISION**

### Reusable code candidates

- Shared customer/party, item/barcode, inventory/warehouse, purchase, sales, payment, and accounting modules.
- POS shift and billing code for immediate retail sales; sales/order and distribution code for dealer transactions.

### Required before provisioning

1. Define an explicit sales-mode field and enforce it through API, pricing, tax, credit, payment, and reporting paths.
2. Define shared customer accounts with permitted retail/wholesale roles and outstanding balance treatment.
3. Verify shared stock across POS and dealer order reservations, dispatch, returns, and replenishment.
4. Test combined purchasing and ensure consolidated reports reconcile to invoice, stock, payment, and GL ledgers.
5. Define channel-aware permissions and validate cross-branch/company isolation.

### Blocking dependencies

- No verified channel-aware price/credit/permission contract was found.
- The billing entry points and API aliases overlap; it is unclear which route is canonical for each channel.
- Database schema, migration head, and runtime paths are unverified.

**Evidence:** Shared models and APIs exist for retail POS, sales, distribution, procurement, customer, stock, and finance.  
**Interpretation:** Hybrid cannot be treated as the sum of two menus; channel separation and shared-ledger invariants have not been proven.  
**Recommendation:** Specify channel contracts first, then validate the shared transaction path before enabling a hybrid configuration.

## Suggested implementation sequence after explicit approval

1. Confirm isolated test DB and secret configuration; verify schema/migration head without changing the database.
2. Select canonical item, barcode, stock ledger, pricing/tax, invoice writer, and payment/GL services.
3. Verify shared core transaction path and permissions.
4. Validate distributor flows on the canonical core.
5. Validate retail POS/offline/shift flows.
6. Add hybrid channel rules and cross-channel reconciliation.
7. Publish template manifests only after evidence and approval.

## Final assessment

**Evidence:** Source-level implementations and route/model registrations are present; runtime tests were not completed.  
**Interpretation:** All three templates contain reusable code but remain unverified for safe provisioning.  
**Recommendation:** Review the audit and approve a separate test-environment verification phase. No implementation was started.
