<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.13.0
  Created      : 2026-09-08
  Modified     : 2026-09-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer PO Fleet Orchestration, AST Schema Parity & Multi-Tenant Isolation Certification

## 1. Purpose
This walkthrough documents the full remediation of the six architectural criteria identified in the Customer PO multi-tenant verification audit. It transitions the Customer PO billing subsystem from being verified exclusively for `smriti001` to an auditable, fleet-wide orchestration architecture with deep AST schema parity, strict tenant/branch isolation guards, control-plane database protection, and live PostgreSQL transactional certification.

## 2. Scope
- **Fleet-Wide Migration Automation:** Safe, resumable, advisory-locked Alembic migration runner for registered tenant databases.
- **Physical Catalog Validation:** Pre-flight cross-referencing between `company_database_registries` and `pg_database`.
- **AST Schema Parity & Invariants:** Column types, nullability, defaults, primary keys, foreign keys, unique constraints, check constraints, and composite indexes on `customer_purchase_orders`, `customer_purchase_order_lines`, and `customer_po_invoice_allocations`.
- **Reversible Downgrade/Upgrade Lifecycle:** Full round-trip testing of migration `v1416_customer_po_billing` down to `v1415_scope_master_values` and back to `head`.
- **Branch and Tenant Isolation Invariants:** Automated verification proving that `branch_id IS NULL` is restricted strictly to the same company, cross-branch access is denied, and cross-company leakage is prevented.
- **Database Divergence Policy:** Formal governance codifying that `smritisys` is the Control Plane capped at `v1415`, while Company Databases dynamically execute operational migrations (`v1416+`).
- **Live Transactional Smoke Testing:** End-to-end atomic billing execution directly against PostgreSQL `smriti001`.

## 3. Files Created
1. `backend/app/db/fleet_migrator.py`: Fleet migration orchestration engine with advisory locking and database catalog checking.
2. `backend/tools/migrate_fleet.py`: CLI tool for inspecting and executing fleet-wide tenant database migrations.
3. `backend/tools/verify_schema_parity_deep.py`: Comprehensive schema parity audit tool inspecting all columns, constraints, and indexes.
4. `backend/tools/tenant_transactional_smoke_test.py`: Live transactional smoke test verifying atomic PO creation, partial billing, and invoice allocations in PostgreSQL.
5. `backend/tests/test_branch_isolation_customer_po.py`: Automated pytest suite testing branch and company isolation boundaries.
6. `docs/architecture/SMRITI_DATABASE_MIGRATION_DIVERGENCE_POLICY.md`: Official governance policy for control-plane vs company-database revision boundaries.
7. `backend/alembic/versions/v1416_customer_po_billing.py`: Alembic migration for Customer PO billing tables and invoice foreign keys.
8. `backend/app/models/customer_po.py`: SQLAlchemy models for Customer PO, PO Lines, and Invoice Allocations.
9. `backend/app/schemas/customer_po.py`: Pydantic validation schemas.
10. `backend/app/services/customer_po.py`: Business logic service for PO lifecycle and atomic billing.
11. `src/tests/customerPoBillingContract.test.ts`: Frontend TypeScript contract tests for Customer PO billing.

## 4. Files Modified
1. `backend/alembic/env.py`: Added dynamic `-x db=<target_db>` target database resolution.
2. `backend/app/tests/conftest.py`: Protected `smritisys` from test-fixture pollution by excluding operational tenant tables during `create_all`.
3. `docs/walkthrough/README.md`: Master index updated with this walkthrough.

## 5. Architecture Decisions
- **ADR-CP-01: Session-Level PostgreSQL Advisory Locking:** Fleet migrations acquire `pg_try_advisory_lock(crc32(db_name))` before running DDL, preventing concurrent worker race conditions.
- **ADR-CP-02: Physical Catalog Cross-Referencing:** The fleet migrator queries `pg_database` before attempting connections to avoid crashing on registered but unprovisioned tenant databases.
- **ADR-CP-03: Plane Separation Ceiling:** Operational transaction tables must never exist in `smritisys`. The control plane is permanently capped at `v1415`. Company databases dynamically resolve migrations `v1416+`.
- **ADR-CP-04: Fail-Closed Company Policy Resolution:** `CustomerPOService._policy()` reads from `smritisys` via control plane sessions and safely falls back to `"BLOCK"` if settings are unavailable, preventing cross-plane table errors.

## 6. Design Rationale
A multi-tenant system cannot rely on manual, single-database migrations. Fleet orchestration must guarantee that partial runs do not leave the fleet in an inconsistent state, and that unprovisioned tenants do not crash fleet-wide deployments. Furthermore, relaxing `branch_id` to allow company-level contracts required strict proof that foreign company boundaries cannot be breached.

## 7. Implementation Summary
- Implemented `FleetMigrator` with regex sanitization (`^smriti(?!000)(?!sys)[a-z0-9]{3,12}$`), advisory locking, and transaction isolation.
- Audited and aligned 6 check constraints between Alembic DDL and SQLAlchemy AST models.
- Purged all leaked Customer PO tables from `smritisys` and patched `conftest.py` table creation guard.
- Executed 5 branch isolation tests verifying boundary enforcement.
- Executed live transactional smoke test verifying atomic PO creation, partial billing, and invoice allocations in PostgreSQL.

## 8. Tests Executed
1. `python tools/migrate_fleet.py --check`: Passed (exit code 0).
2. `python tools/migrate_fleet.py --fleet`: Passed (exit code 0).
3. `python tools/verify_schema_parity_deep.py --db smriti001`: Passed (exit code 0).
4. Symmetrical Alembic downgrade to `v1415` and upgrade to `v1416`: Passed (exit code 0).
5. `python -m pytest tests/test_branch_isolation_customer_po.py -v`: 5/5 passed (exit code 0).
6. `python -m pytest tests/test_b2b_credit_sales_contract.py app/tests/test_database_routing_guard.py tests/test_branch_isolation_customer_po.py -v`: 25/25 passed (exit code 0).
7. `python tools/tenant_transactional_smoke_test.py`: Passed (exit code 0).
8. `npm test src/tests/customerPoBillingContract.test.ts src/tests/distTaxInvoiceStitchFlow.test.ts`: 15/15 passed (exit code 0).

## 9. Verification Results
- **Schema Parity:** 100% parity across columns, data types, nullability, defaults, primary keys, unique constraints, foreign keys, check constraints, and indexes.
- **Control Plane Isolation:** `information_schema.tables` in `smritisys` returns `[]` for all `customer_po` tables.
- **Fleet Orchestration:** Clean execution across all registered databases with clear distinction of provisioned (`smriti001`) vs unprovisioned (`smriti002`, `smriti003`).

## 10. Known Limitations
- `smriti002` and `smriti003` are registered in `company_database_registries` but not yet physically created in PostgreSQL; they will be migrated automatically when provisioned via the tenant onboarding workflow.

## 11. Future Work
- Integrate `FleetMigrator` into CI/CD deployment pipelines.
- Wire Customer PO selection into `DistTaxInvoice.tsx` distributor billing UI with F2 universal lookup.

## 12. Related ADRs
- `ADR-0042`: Control Plane vs Company Database Multi-Tenant Architecture
- `ADR-0043`: Session-Level Advisory Locking for Migration Automation

## 13. Related RFCs
- `RFC-2026-08`: Customer PO Billing and Invoice Source Traceability
