<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-26
  Modified     : 2026-10-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sales & Billing: Invoice Save As Draft, Submit, and Post Lifecycle Walkthrough v1.0.0

## 1. Purpose
This walkthrough documents the headless certification, bug remediation, and end-to-end verification of the SMRITI Retail OS Sales Invoice lifecycle: saving an invoice as a draft, updating draft metadata/quantities, submitting the draft for review (`SUBMIT`), posting to the financial ledger and stock movements (`POST`), asserting strict post-posting immutability (HTTP 409 Conflict), and validating complete database persistence across the PostgreSQL system of record.

## 2. Scope
- **Domain Modules:** Sales Invoicing (`SalesService`, `SalesInvoice`, `SalesInvoiceItem`), Universal Lifecycle Engine (`UniversalLifecycleEngine`, `LifecycleRegistry`, `WorkflowEvent`), Inventory Stock Ledger (`StockLedger`, `StockMovement`), Financial Accounting (`GeneralLedgerService`, `JournalVoucher`), and Cost Management Engine (`transaction_cost_snapshots`).
- **Target Operations:**
  1. Creation of Sales Quotation (`POST /api/v1/sales/quotations`) in `Draft` state.
  2. Conversion of Quotation to Sales Invoice (`POST /api/v1/sales/quotations/convert/{quotation_id}`) resulting in `Draft` invoice.
  3. Updating Draft Invoice properties (`PUT /api/v1/sales/invoices/{id}`) without ledger impact or stock reservations.
  4. Querying Universal Lifecycle state (`GET /api/v1/lifecycle/SalesInvoice/{id}/state`) returning allowed transitions `['SUBMIT', 'POST', 'CANCEL']`.
  5. State transition execution: `SUBMIT` action via `POST /api/v1/lifecycle/SalesInvoice/{id}/SUBMIT` advancing status to `SUBMITTED`.
  6. Final posting execution: `POST` action via `POST /api/v1/lifecycle/SalesInvoice/{id}/POST` transitioning status to `POSTED`, decrementing available stock via `OUTWARD_SALE`, writing balancing double-entry GL vouchers, and computing transaction cost snapshots.
  7. Verification of immutability gate: verifying `PUT /api/v1/sales/invoices/{id}` rejects edits with HTTP 409 Conflict once posted.
  8. Extraction of full sequential audit trail via `GET /api/v1/lifecycle/SalesInvoice/{id}/events`.
- **Exclusions:** UI/Browser front-end rendering was omitted per user constraint (100% headless execution).

## 3. Files Created
- `backend/app/tests/test_invoice_draft_to_submit_lifecycle.py`: Automated Pytest regression test suite executing isolated multi-tenant draft creation, update, submit, post, immutability assertion, and ledger verification.

## 4. Files Modified
- `backend/app/api/v1/lifecycle.py`: Updated lifecycle route dependencies from `get_db` (control-plane database `smritisys`) to `get_company_db` (tenant database `smriti001`), resolving HTTP 404 Not Found errors during tenant document state queries and action transitions.
- `backend/alembic/versions/v1532_cost_management_engine_foundations.py`: Hardened `transaction_cost_snapshots` table creation by ensuring `product_id VARCHAR(50)` is included in both table creation and column addition fallback loops, remediating `UndefinedColumnError` during posting.
- `backend/app/db/bootstrap_engine.py`: Added proactive schema migration assertion for `transaction_cost_snapshots.product_id` across tenant databases during system startup and tenant bootstrap.
- `backend/app/tests/test_universal_sales_lifecycle.py`: Fixed `_setup_product` test fixture to seed canonical `StockMovement(movement_type="OPENING_STOCK", user="SYSTEM")`, enabling stock ledger positive balance verification for async integration tests.
- `docs/walkthrough/README.md`: Appended chronological index entry for this walkthrough.
- `CHANGELOG.md`: Added release notes under `[Unreleased]` detailing lifecycle multi-tenant resolution, schema parity fixes, and headless invoice certification.

## 5. Architecture Decisions
1. **Tenant-Scoped Lifecycle Engine (`get_company_db`):**
   * *Context:* The Universal Lifecycle Engine endpoints (`/api/v1/lifecycle/{doc_type}/{doc_id}/*`) previously resolved database sessions using `get_db`, which points to the control-plane database (`smritisys`). All transactional documents (`SalesInvoice`, `PurchaseOrder`, `GoodsReceipt`) reside strictly in tenant databases (`smriti001`, `smriti002`).
   * *Decision:* Switched the dependency in `lifecycle.py` to `get_company_db`. This dynamically extracts the active tenant context (`X-Company-Id` / JWT claims) and binds the lifecycle engine directly to the tenant database session.
2. **Authoritative Stock Ledger Inflows (`OPENING_STOCK`):**
   * *Context:* The inventory stock engine calculates available balance by summing signed quantities from `StockMovement`. Legacy or unclassified movement types (such as `INWARD_OPENING`) return `NULL` in the case statement, triggering false `INSUFFICIENT_STOCK` errors even if `products.stock` displays an integer balance.
   * *Decision:* Reaffirmed `OPENING_STOCK` as the canonical inflow movement type for seed balances and test fixtures, adhering strictly to `INFLOW_MOVEMENT_TYPES`.
3. **Draft Mutation vs. Posted Immutability Gate:**
   * *Context:* Tax invoices under Indian GST statutory rules must remain immutable once posted to prevent fraud and record tampering.
   * *Decision:* Enforced that while an invoice remains in `Draft` or `Hold`, `PUT /api/v1/sales/invoices/{id}` permits full mutations of quantities, customer details, and pricing without generating stock movements or GL postings. Once transitioned to `POSTED`, any mutation attempt immediately raises HTTP 409 Conflict: `"Posted tax invoices are immutable. Use the approved cancellation, amendment, credit-note, or debit-note workflow."`

## 6. Design Rationale
- Decoupling document drafting from financial and inventory commitment gives cashiers and back-office operators the ability to prepare invoices, save drafts across shifts, and review totals before formal commitment.
- Driving transitions through `UniversalLifecycleEngine` ensures every step (`SUBMIT`, `POST`, `CANCEL`) is idempotently gated, validated by state machine guards, and stamped into `WorkflowEvent` with operator ID, source state, target state, and timestamp.

## 7. Implementation Summary
1. **Multi-Tenant Lifecycle Dependency Alignment:**
   - Modified `backend/app/api/v1/lifecycle.py` routes:
     - `GET /{document_type}/{document_id}/state` -> `db: AsyncSession = Depends(get_company_db)`
     - `POST /{document_type}/{document_id}/{action}` -> `db: AsyncSession = Depends(get_company_db)`
     - `GET /{document_type}/{document_id}/events` -> `db: AsyncSession = Depends(get_company_db)`
2. **Schema Parity & Drift Remediation (Rule 12):**
   - Added column `product_id VARCHAR(50) NOT NULL` to table `transaction_cost_snapshots`.
   - Propagated migration across tenant databases `smriti001`, `smriti002`, `smriti003`, and `smriti004`.
3. **Live Headless In-Container Lifecycle Execution:**
   - Authenticated against live backend container `http://localhost:8000` (`smriti-api`) as `admin`.
   - Executed 9-step invoice workflow:
     - Created quotation `QTN-33FAC2` in `Draft` status.
     - Converted quotation to draft invoice `SAL-INV-00002003` (`01a176d4-a0ca-7000-8f19-4eea440db195`).
     - Updated draft customer to `"ShopperStop Mumbai Hub"`.
     - Verified state `DRAFT` and available actions `['SUBMIT', 'POST', 'CANCEL']`.
     - Executed action `SUBMIT` -> state transitioned to `SUBMITTED` (version 2).
     - Executed action `POST` -> state transitioned to `POSTED` (version 3).
     - Verified attempt to update posted invoice via `PUT` failed with HTTP 409 Conflict.
     - Extracted 2-event audit history from `workflow_events`.
4. **Database Verification Across 5 Core Relations:**
   - `sales_invoices`: verified invoice status `POSTED`, version `3`, grand total `236.00`.
   - `workflow_events`: verified 2 records (`SUBMIT` and `POST`) associated with `SalesInvoice`.
   - `stock_movements`: verified outward sale movement (`OUTWARD_SALE`, qty: `2.00`, prod: `prod_storm_0de0cadb`).
   - `journal_vouchers`: verified GL voucher `JV-20261026-8386E2` of type `SALES_INVOICE`.
   - `transaction_cost_snapshots`: verified COGS snapshot for `prod_storm_0de0cadb` (GrossSales: `200.00`, COGS: `20.00`, NetProfit: `180.00`).

## 8. Tests Executed
1. **Isolated Integration Pytest Suite:**
   - Command: `pytest backend/app/tests/test_invoice_draft_to_submit_lifecycle.py -v`
   - Result: 1 passed, 28 warnings in 95.05s.
2. **Universal Sales Lifecycle Regression Suite:**
   - Command: `pytest backend/app/tests/test_universal_sales_lifecycle.py -k "test_sales_invoice_posting_and_stock_gl" -v`
   - Result: 1 passed, 9 deselected, 28 warnings in 81.73s.

## 9. Verification Results
- **Invoice Draft Mutation:** Fully verified. Draft invoices accept updates without impacting ledger or inventory balances.
- **State Transition Guard:** Fully verified. Transitioning from `DRAFT` to `SUBMITTED` to `POSTED` strictly respects configured workflows.
- **Post-Posting Immutability:** Fully verified. Returns HTTP 409 Conflict upon attempted updates.
- **Stock Ledger Integration:** Fully verified. Available inventory decrements atomically upon posting.
- **Audit Logging:** Fully verified. All lifecycle actions logged in `workflow_events`.

## 10. Known Limitations
- The lifecycle engine currently requires an explicit tenant identifier (`X-Company-Id` header) or a tenant-authenticated user token; unauthenticated control-plane requests to tenant documents are rejected with HTTP 403/404.

## 11. Future Work
- Expose bulk-submit and bulk-post batch actions for high-volume invoice processing.
- Add real-time WebSocket push notifications to UI desks when draft invoices transition to submitted or posted status.

## 12. Related ADRs
- `ADR-0042`: Universal Lifecycle State Machine and Immutable Document Governance.
- `ADR-0089`: Multi-Tenant Schema Isolation and Tenant Database Routing.
- `ADR-0112`: Authoritative Double-Entry Ledger and Stock Movement Atomicity.

## 13. Related RFCs
- `RFC-0028`: Indian GST Rule 46 Tax Invoice Immutability and Audit Trails.
- `RFC-0074`: Universal Lifecycle Engine Architecture for SMRITI Retail OS.
