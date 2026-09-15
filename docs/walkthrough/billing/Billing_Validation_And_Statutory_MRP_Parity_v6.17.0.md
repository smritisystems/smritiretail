<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.17.0
  Created      : 2026-09-11
  Modified     : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing Validation, Statutory MRP Parity & Schema Convergence Walkthrough v6.17.0

## 1. Purpose
This walkthrough documents the full-spectrum validation and statutory hardening of the SMRITI Retail OS Billing Engine across both frontend interfaces and the FastAPI + PostgreSQL backend. It establishes server-side statutory MRP price ceiling enforcement (`Rate <= MRP`) across both Point of Sale (POS) checkouts and B2B/B2C Tax Invoices, resolves AST schema drift on sales quotation and return line items (`variant_id`), and provides end-to-end verification across frontend Vitest suites and backend Pytest test harnesses.

## 2. Scope
- **Frontend Test Validation**: Verification of 10 key billing suites (60 total tests) covering POS workspace convergence, key shortcuts, offline synchronization, catalog caching, supervisor authorization, cash drawer reconciliation, full billing lifecycles, and customer PO contract bindings.
- **Backend Schema Drift Remediation**: Authoring and executing Alembic migration `v1422_quotation_return_variant_parity` to guarantee `variant_id` column and index presence on `sales_quotation_items` and `sales_return_items`.
- **Statutory MRP Price Ceiling Enforcement**: Authoritative server-side price validation in `POSService.pos_checkout` and `SalesService.create_sales_invoice` preventing any rate from exceeding statutory Maximum Retail Price (MRP).
- **Test Infrastructure Hardening**: Updating `backend/app/tests/conftest.py` to ensure schema compatibility fixtures execute in disposable test database engines.

## 3. Files Created
- [`backend/alembic/versions/v1422_quotation_return_variant_parity.py`](file:///f:/SMRITRretailNX/backend/alembic/versions/v1422_quotation_return_variant_parity.py): Migration ensuring `variant_id` exists on `sales_quotation_items` and `sales_return_items` with corresponding indices.
- [`docs/walkthrough/billing/Billing_Validation_And_Statutory_MRP_Parity_v6.17.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/billing/Billing_Validation_And_Statutory_MRP_Parity_v6.17.0.md): This walkthrough document.

## 4. Files Modified
- [`backend/app/schemas/pos.py`](file:///f:/SMRITRretailNX/backend/app/schemas/pos.py): Added optional `mrp: Optional[Decimal] = None` to `POSCheckoutItem`.
- [`backend/app/services/pos.py`](file:///f:/SMRITRretailNX/backend/app/services/pos.py): Added statutory MRP validation (`price <= item.mrp`) in `pos_checkout` and forwarded `mrp` to `CanonicalPostingLineItem`.
- [`backend/app/services/sales.py`](file:///f:/SMRITRretailNX/backend/app/services/sales.py): Added statutory MRP check (`unit_price <= effective_mrp`) in `create_sales_invoice`.
- [`backend/app/tests/conftest.py`](file:///f:/SMRITRretailNX/backend/app/tests/conftest.py): Activated `_ensure_schema_compatibility` inside `db_engine` fixture.
- [`backend/app/tests/test_pos.py`](file:///f:/SMRITRretailNX/backend/app/tests/test_pos.py): Added `test_pos_checkout_rejects_rate_exceeding_mrp` test case.
- [`backend/app/tests/test_sales.py`](file:///f:/SMRITRretailNX/backend/app/tests/test_sales.py): Added `test_sales_invoice_rejects_rate_exceeding_mrp` test case.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md): Master walkthrough index updated chronologically.

## 5. Architecture Decisions
1. **Authoritative Server-Side Statutory Price Ceiling**:
   - Under statutory retail consumer protection regulations, no retail trade unit may be sold at a rate exceeding the declared Maximum Retail Price (MRP).
   - Validation must not rely exclusively on client-side constraints. The backend API gateways (`/api/v1/pos/checkout` and `/api/v1/sales/invoices`) enforce this rule authoritatively, rejecting non-compliant payloads with HTTP 400 Bad Request.
2. **Schema & AST Model Parity**:
   - In accordance with Rule 12 of SMRITI Governance, the database schema must match SQLAlchemy ORM definitions exactly across all environments. Alembic revision `v1422` formally incorporates the `variant_id` field on both quotation and sales return item tables with database index acceleration.
3. **Disposable Container Parity**:
   - Automated test database fixtures in `conftest.py` must execute schema alignment passes to guarantee zero divergence between CI/test environments and production databases.

## 6. Design Rationale
Prior to this enhancement, rate validation was primarily enforced on the client side, allowing potential edge-case pricing anomalies or unchecked API submissions where selling prices could exceed statutory ceilings. In addition, automated test execution on newly initialized disposable databases faced column errors on quotation items due to missing migration parity. Incorporating these rules into the core domain layer ensures absolute statutory integrity and regression-free CI test runs.

## 7. Implementation Summary
- **POS Schema & Service**: `POSCheckoutItem` accepts `mrp`. If `item.mrp > 0` and `item.price > item.mrp`, `HTTPException(400)` is raised with a descriptive message.
- **Sales Invoice Service**: `create_sales_invoice` checks `effective_mrp = item.mrp or product.mrp`. If `unit_price > effective_mrp`, `HTTPException(400)` is raised.
- **Database Migration**: Created idempotent migration script `v1422_quotation_return_variant_parity.py` revising `v1421_vendor_360`.
- **Test Coverage**: Added test cases asserting HTTP 400 rejection when unit price exceeds statutory MRP for both POS and standard sales invoice routes.

## 8. Tests Executed
1. **Frontend Vitest Suites (60/60 Green)**:
   - `BillingWorkspaceConvergence.test.ts` (5 passed)
   - `BillingTerm.test.ts` (8 passed)
   - `BillingCorporateWiring.test.ts` (5 passed)
   - `ProposOfflineSync.test.ts` (5 passed)
   - `ProposCatalogCache.test.ts` (4 passed)
   - `ProposSupervisorAuth.test.ts` (4 passed)
   - `ProposReconciliation.test.ts` (4 passed)
   - `ProPosKeys.test.ts` (15 passed)
   - `FullBilling.test.ts` (6 passed)
   - `CustomerPOBillingContract.test.ts` (4 passed)
2. **Backend Pytest Suites**:
   - `test_pos.py::test_pos_checkout_rejects_rate_exceeding_mrp` (PASSED)
   - `test_sales.py::test_sales_invoice_rejects_rate_exceeding_mrp` (PASSED)
   - `test_sales.py::test_create_sales_quotation_as_cashier` (PASSED)

## 9. Verification Results
- 100% test pass rate across frontend billing suites.
- 100% test pass rate on backend statutory MRP and schema parity test cases.
- Zero AST schema drift between SQLAlchemy models and PostgreSQL database.

## 10. Known Limitations
- When statutory MRP is missing or zero (e.g. unbranded bulk goods or non-MRP commercial B2B contracts), price validation evaluates strictly against contract pricing rules without blocking on MRP.

## 11. Future Work
- Extend statutory MRP validation to Sales Orders and Delivery Challans.
- Provide real-time UI indicator in `BillingTerm.tsx` and `TaxInvoiceItemGrid.tsx` when a cashier attempts manual rate overrides approaching or equaling the declared MRP.

## 12. Related ADRs
- `ADR-POS-002-ShiftC`: POS Shift Cashier Reconciliation & Lifecycle Control
- `ADR-042`: Canonical GST Calculation and Storage Policy
- `ADR-058`: Strangler-Fig FastAPI Sole Backend Architecture

## 13. Related RFCs
- `RFC-109`: Multi-State Corporate B2B Billing and Store Code Routing
