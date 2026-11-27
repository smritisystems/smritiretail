# Company Database Assessment — `Smritibus_<CompanyCode>`

## Scope and limitation

No company database could be inventoried because no authorized database connection was provided or used. The repository has an ignored local `.env`, which was not read. No production service was probed. Consequently, this report cannot list accessible tenants or assert schema parity/drift, data integrity, query plans, indexes or actual foreign-key behavior for any company.

## Intended routing and database model

- `backend/app/db/session.py` resolves company identifiers from `company_database_registries`, checks `READY`, validates database-name shape and creates cached SQLAlchemy async engines.
- `backend/app/api/deps.py` builds an authenticated `TenantContext`, selects the company database and annotates the session with tenant/company/branch/routing metadata.
- `backend/app/db/tenant_context.py` wraps a tenant session and rejects `smritisys`.
- `backend/app/db/ownership.py` assigns operational data (customers, products/items/variants/barcodes, purchases, sales, inventory, POS, CRM, stock and financial records) to tenant databases.
- SQLAlchemy model and migration code represents item/product, sales, purchase/receiving, supplier/customer, POS, payments, stock, warehouse, CRM, e-commerce, compliance and audit domains.

These are intended structures, not per-database evidence. The repository's Compose file configures one PostgreSQL service. Tenant databases appear as separate logical database names on that server; separate server instances or per-company credentials were not demonstrated.

## Domain inventory (implementation presence, not workflow certification)

| Domain | Source evidence | Runtime state |
|---|---|---|
| Item/product, variant, barcode | Models, routes, services, frontend components and migrations present. | Not executed. |
| Supplier, PO, receiving/GRN | Purchase API/service, schemas and UI present. | No transaction trace executed. |
| Sales, billing, returns, POS | Routes, models, services and component/test suites present. | No API/database commit verified. |
| Stock ledger, transfer, warehouse | Inventory/WMS/distribution sources and migration assets present. | Integrity and concurrent posting unknown. |
| Customer/CRM/loyalty | CRM/customer/lifecycle routes, services and models present. | Tenant scoping and actual records not checked. |
| Payments, cash register, expenses/accounting | Finance/POS/payment/accounting sources present. | Reconciliation and posting behavior not verified. |
| GST/compliance/e-invoice | Compliance and tax/invoice sources present; external settings configurable. | No statutory/e-invoice external call made. |
| Integrations/e-commerce | Connector registry, Tally, e-commerce and data exchange sources present. | No live connector invocation. |
| Permissions/audit | Control Plane user/role/assignment and audit models/routes present. | No permission matrix or live audit trail verified. |

## Key risks

- **EA-SEC-01:** non-SYSADMIN default tenant selection and empty company context are now rejected in the working tree; focused mocked tests passed. Existing valid-company legacy assignment behavior remains.
- **EA-DB-01:** backup database-resolution and default-session fallbacks are removed in the working tree; focused mocked failure-path tests passed.
- **EA-DB-02:** migration filters now apply canonical ownership in both target directions; focused unit tests passed and live schema impact remains unknown.
- Current worktree contains 284 migration files and newly added, untracked tenant/control migration revisions. The database's applied revision and compatibility cannot be inferred from those files.

## Required verification (not performed)

For each registered database, obtain metadata-only inventories of tables/columns/constraints/indexes and current migration head, compare against the expected ownership map, run foreign-key and orphan checks without exposing row contents, and compare the selected schema fingerprints. Use isolated databases for migrations and workflow tests. Do not execute migration or repair scripts against production as part of this assessment.

**Company Database Architecture: 5.0/10. Database Integrity: 3.5/10.** A design is visible, but actual customer databases and operational integrity remain unassessed.
