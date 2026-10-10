<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-25
  Modified     : 2026-09-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Phase 1 Remediation — Implementation Plan
**Plan ID:** SMRITI-DB-REMEDIATION-v1.0.0  
**Status:** Completed (All Waves 1–6 Completed & Verified)  
**Audit Source:** `docs/architecture/SMRITI_Phase1_Schema_Audit_v1.0.0.md`  
**Alembic Head Before:** `v1489_transaction_integrity_engine`  
**Alembic Head Current:** `v1493_psv_tenant_and_fk_hardening_wave5`  

---

## 1. Objective
Execute six remediation waves identified in the Phase 1 Database Schema Audit in strict priority order using zero-downtime Expand/Contract migrations.

## 2. Business Motivation
- Prevent accidental cascade-deletion of General Ledger entries (financial compliance, Indian Companies Act, GST Act).
- Prevent cascade-deletion of payment allocation audit trails and customer credit ledgers.
- Enforce business-rule invariants at the database layer (prevent negative sales prices, invalid discount percentages, negative stock move quantities) rather than relying exclusively on application code.
- Unify tenant discriminator columns across modules (`tenant_id` -> `company_id` in promotions).
- Consolidate stock source-of-truth to eliminate silent inventory drift between ledger movements and snapshot caches.

## 3. Scope

| Wave | Domain | Migration | Scope Details | Status |
|---|---|---|---|---|
| **1** | **FK CASCADE → RESTRICT** | `v1490` | 6 critical FKs (GLE, Payments, Allocations, Reservations, Fiscal Periods, Purchase Receipts) | **Completed** |
| **2** | **Additive CHECK Constraints & Unique Indexes** | `v1491` | 9 CHECK constraints (price, qty, gst, debit/credit, balanced JV) + compound unique (company_id, invoice_no) | **Completed** |
| **3** | **Promotions Tenant Column Unification** | `v1492` | Unify `tenant_id` to `company_id` on all 18 promotions tables + backfill + compound unique constraints | **Completed** |
| **4** | **Stock Source-of-Truth Consolidation** | None (Code) | Consolidate inventory writers into canonical StockSynchronizer; reconcile products.stock cache | **Completed** |
| **5** | **PSV Tables Tenant & FK Hardening** | `v1493` | Add `company_id` and strict FK to `products` on PSV tables | **Completed** |
| **6** | **Child Table Tenant Model Finalization** | Policy (ADR-DB-006) | Parent-join tenant inheritance formalized; RLS certified | **Completed** |

## 4. Current State
- PostgreSQL schema baseline: 285 tables, 5,781 columns, 533 FKs, 1,206 indexes, 21 triggers.
- Wave 1 completed: 6 target FKs transitioned from `ON DELETE CASCADE` to `ON DELETE RESTRICT`.
- Wave 2 completed: 9 CHECK constraints validated on PostgreSQL storage layer + compound unique constraint on `(company_id, invoice_no)`.
- Wave 3 completed: `company_id` column, indexes, and compound unique constraints deployed to all 18 promotions tables.
- Alembic head migrated to `v1493_psv_tenant_and_fk_hardening_wave5`.

## 5. Gap Analysis
- Prior to Wave 1, deleting a `journal_vouchers` record would delete immutable `general_ledger_entries`.
- Deleting a `payment_transactions` record would delete `payment_allocations`.
- Deleting a `sales_orders` record would delete order invoice allocations and inventory reservations.
- Deleting a `fiscal_years` record would cascade-delete closed `fiscal_periods`.
- Wave 2 resolved missing DB check constraints for negative price/qty and unconstrained double entry balances.
- Wave 3 resolved tenant column inconsistency `tenant_id` vs `company_id` across 18 promotions tables.
- Wave 4 resolved disparate direct writes to `products.stock` and established canonical `StockSynchronizer`.
- Wave 5 resolved Category C tenant isolation gaps and missing referential integrity on `psv_stock_balances` and `psv_stock_events`.

## 6. Architecture Impact
- Enforces relational immutability at the PostgreSQL engine level.
- Hard delete of parent financial records is rejected with PostgreSQL error `23503 (foreign_key_violation)`.
- Zero-downtime deployment: Non-blocking DDL on PostgreSQL 15.

## 7. Proposed Design
- **Wave 1:** Drop old CASCADE FKs, create new RESTRICT FKs (`fk_gle_voucher_id_restrict`, `fk_payment_alloc_payment_restrict`, `fk_so_invoice_alloc_order_restrict`, `fk_so_reservation_order_restrict`, `fk_fiscal_period_year_restrict`, `fk_purchase_receipt_item_receipt_restrict`).
- **Wave 2:** Add CHECK constraints using `ADD CONSTRAINT ... CHECK (...) NOT VALID;` followed by `VALIDATE CONSTRAINT` for zero lock contention.
- **Wave 3:** Dual-write expand/contract pattern for `tenant_id` -> `company_id`.
- **Wave 4:** Dual-tier inventory source of truth with canonical `StockSynchronizer`.
- **Wave 5:** PSV tables `company_id` + FK hardening and composite balance projection uniqueness.

## 8. Files Created
- `backend/alembic/versions/v1490_fk_cascade_to_restrict_wave1.py`
- `backend/alembic/versions/v1491_additive_check_constraints_wave2.py`
- `backend/alembic/versions/v1492_promotions_company_id_unification_wave3.py`
- `backend/app/services/stock_synchronizer.py`
- `backend/alembic/versions/v1493_psv_tenant_and_fk_hardening_wave5.py`
- `docs/implementation/db/Phase1_Schema_Remediation_Plan_v1.0.0.md`

## 9. Files Modified
- `backend/app/models/accounting.py` (removed ORM `cascade="all, delete-orphan"` on `JournalVoucher.entries`)
- `backend/app/models/sales.py` (added compound unique constraint on `SalesInvoice`)
- `backend/app/models/promotions.py` (added company-scoped unique constraints on `SmritiPromotion` & `SmritiPromotionVersion`)
- `backend/app/models/inventory.py` (documented `Product.stock` invariant as read-only cache)
- `backend/app/models/psv.py` (added `company_id`, `product_id`, composite indexes, and unique constraint)
- `backend/app/services/stock_acct_svc.py` (delegated to `StockSynchronizer`)
- `backend/app/services/inventory_wms.py` (delegated to `StockSynchronizer`)
- `backend/app/services/stock_audit_service.py` (delegated to `StockSynchronizer`)
- `backend/app/services/sales.py` (delegated to `StockSynchronizer`)

## 10. Dependencies
- PostgreSQL 15+ database running on port 2781.
- Python virtual environment `.venv` with Alembic and psycopg2.

## 11. Risks
- Risk: Attempted parent record deletion by legacy services causes unhandled 500 error instead of soft delete.
  - Mitigation: Application uses soft deletes (`is_deleted=True`), hard delete is prohibited.
- Risk: Migration lock contention during DDL.
  - Mitigation: Verified zero blocking locks before upgrade; completed in < 5 seconds.

## 12. Rollback Strategy
- Downgrade step: `alembic downgrade v1492_promotions_company_id_unification_wave3` drops `company_id` constraints, indexes, and columns from PSV tables.
- No data is destroyed during downgrade.

## 13. Verification Plan
1. Schema introspection: Verify `information_schema.referential_constraints` has `delete_rule = 'RESTRICT'` for all target FKs.
2. Negative deletion test: Insert parent and child records in a transaction, attempt to DELETE parent, assert error `23503 foreign_key_violation`.
3. CHECK constraints inspection: Verify `convalidated = true` for all 9 CHECK constraints.
4. Negative DML test: Insert invalid prices, negative amounts, unbalanced JVs, and assert error `23514 check_violation`.
5. Unique constraint test: Assert error `23505 unique_violation` on duplicate `(company_id, invoice_no)`.
6. Promotions tenant unification test: Assert `company_id` exists on all 18 tables, test duplicate `(company_id, promotion_code)`.
7. PSV tenant & FK hardening test: Assert `company_id`, `product_id`, 4 FKs (RESTRICT), and duplicate rejection on `uq_psv_stock_balances_party_sku`.

## 14. Test Plan
- Run parity script `verify_wave1_fk_restrict.py`.
- Run transactional DML test `test_dml_restrict.py`.
- Run Wave 2 parity and negative DML test `verify_wave2_constraints.py`.
- Run Wave 3 promotions unification test `verify_wave3_promotions.py`.
- Run Wave 4 stock synchronization test `verify_wave4_stock_synchronization.py`.
- Run Wave 5 PSV hardening test `verify_wave5_psv_hardening.py`.
- Run linter `ruff check` on migration and modified model files.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create walkthroughs `DB_Phase1_Schema_Remediation_Wave[1-5]_v1.0.0.md`.
- Update `docs/walkthrough/README.md` master index.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
1. Dev environment: Apply migration and run verification scripts in `D:\Smriti_Retail_OS`.
2. Commit and push.
3. Test environment (`F:\Smriti9`): Git pull and execute `alembic upgrade head`.

## 17. Status
**Waves 1, 2, 3, 4, 5 & 6: Completed & Certified** (Verified with evidence). All Phase 1 remediation waves fully executed.

## 18. Related ADRs
- ADR-0012: Database Relational Integrity and Financial Immutability Policy.
- ADR-DB-004: Dual-Tier Inventory Source of Truth.
- ADR-DB-005: Tenant Isolation and Catalog Decoupling in PSV Projections.
- ADR-DB-006: Child Table Tenant Isolation Model.

## 19. Related Walkthroughs
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave1_v1.0.0.md`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave2_v1.0.0.md`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave3_v1.0.0.md`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave4_v1.0.0.md`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave5_v1.0.0.md`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave6_v1.0.0.md`
