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

# DB Phase 1 Schema Remediation Wave 2 Walkthrough
**Walkthrough ID:** WGP-DB-REM-WAVE2-v1.0.0  
**Area:** Database & Schema Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose
Document the implementation and verification of Phase 1 Schema Remediation Wave 2: Additive CHECK Constraints and Compound Uniqueness. This hardening enforces business invariants directly at the PostgreSQL storage layer (preventing negative sales prices, zero quantities, invalid tax rates, unbalanced journal vouchers, and negative general ledger debits/credits) and establishes multi-tenant invoice numbering isolation via a compound unique constraint.

## 2. Scope
1. Additive CHECK constraints across 5 core tables:
   - `sales_invoice_items`: `chk_sii_quantity_positive` (`quantity > 0`), `chk_sii_price_non_negative` (`price >= 0`), `chk_sii_gst_rate_bounds` (`gst_rate >= 0 AND gst_rate <= 100`)
   - `purchase_order_items`: `chk_poi_quantity_positive` (`quantity > 0`), `chk_poi_cost_price_non_negative` (`cost_price >= 0`), `chk_poi_gst_rate_bounds` (`gst_rate >= 0 AND gst_rate <= 100`)
   - `stock_movements`: `chk_stock_movement_qty_nonzero` (`quantity != 0`)
   - `general_ledger_entries`: `chk_gle_amounts_non_negative` (`debit_amount >= 0 AND credit_amount >= 0`)
   - `journal_vouchers`: `chk_jv_balanced` (`total_debit = total_credit`)
2. Compound UNIQUE constraint:
   - `sales_invoices`: `uq_sales_invoices_company_invoice_no` on `(company_id, invoice_no)`
3. Zero-downtime deployment mechanism using PostgreSQL `NOT VALID` followed by `VALIDATE CONSTRAINT`.
4. SQLAlchemy ORM model alignment: added `__table_args__` with `UniqueConstraint` on `SalesInvoice`.

## 3. Files Created
- `backend/alembic/versions/v1491_additive_check_constraints_wave2.py`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave2_v1.0.0.md`

## 4. Files Modified
- `backend/app/models/sales.py`
- `docs/implementation/db/Phase1_Schema_Remediation_Plan_v1.0.0.md`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-DB-002: Storage-Level Invariant Enforcement**: Critical domain invariants (non-negative currency, valid tax bounds 0-100%, non-zero stock increments, balanced double-entry vouchers) must be guaranteed by PostgreSQL constraints (`CHECK`), preventing silent corruption from manual scripts, batch imports, or service bugs.
- **Zero-Downtime NOT VALID Pattern**: CHECK constraints are created with `NOT VALID` to avoid blocking table locks during creation, followed immediately by `VALIDATE CONSTRAINT` which validates without an exclusive lock.
- **Multi-Tenant Scoped Uniqueness**: Transitioning `sales_invoices` towards tenant-scoped uniqueness `(company_id, invoice_no)` while keeping existing numbering series functional.

## 6. Design Rationale
Prior to Wave 2, zero business-rule CHECK constraints existed on quantity, rate, or amount columns in the database. Any direct SQL insertion or service bug could corrupt the financial ledger with negative prices or unbalanced journal vouchers. By enforcing these checks at the PostgreSQL layer, illegal states become physically unrepresentable in the database.

## 7. Implementation Summary
1. Conducted pre-flight parity check across existing database tables (`sales_invoice_items`, `purchase_order_items`, `stock_movements`, `general_ledger_entries`, `journal_vouchers`, `sales_invoices`) confirming 0 existing data violations.
2. Created Alembic migration `v1491_additive_check_constraints_wave2.py` with `down_revision = "v1490_fk_cascade_to_restrict_wave1"`.
3. Updated `SalesInvoice` model in `backend/app/models/sales.py` to declare `UniqueConstraint("company_id", "invoice_no", name="uq_sales_invoices_company_invoice_no")`.
4. Executed Alembic migration: `alembic upgrade v1491_additive_check_constraints_wave2`.
5. Created and executed automated verification suite `verify_wave2_constraints.py`.

## 8. Tests Executed
1. **Catalog CHECK Constraint Inspection**:
   - Query: `pg_constraint` joined with `pg_class`
   - Verified 9/9 CHECK constraints exist and have `convalidated = true`.
2. **Compound Unique Constraint Inspection**:
   - Verified `uq_sales_invoices_company_invoice_no` on `(company_id, invoice_no)`.
3. **Negative DML Rejection Tests**:
   - Negative price on `sales_invoice_items`: rejected with SQLSTATE `23514 (check_violation)`.
   - Zero quantity on `sales_invoice_items`: rejected with SQLSTATE `23514 (check_violation)`.
   - GST rate > 100 on `sales_invoice_items`: rejected with SQLSTATE `23514 (check_violation)`.
   - Unbalanced JV (`total_debit != total_credit`): rejected with SQLSTATE `23514 (check_violation)`.
   - Negative debit on `general_ledger_entries`: rejected with SQLSTATE `23514 (check_violation)`.
   - Duplicate `(company_id, invoice_no)`: rejected with SQLSTATE `23505 (unique_violation)`.
4. **Linter Static Analysis**:
   - `python -m ruff check backend/alembic/versions/v1491_additive_check_constraints_wave2.py` -> exit 0.

## 9. Verification Results
- **Status:** Done
- **Quantitative Metrics:**
  - CHECK constraints created & validated: 9/9 (100%)
  - Compound UNIQUE constraints created: 1/1 (100%)
  - Existing Data Violations: 0
  - DML Negative Test Rejections: 6/6 passed (100%)
  - Migration Execution Time: < 4.1s
- **Alembic Head:** `v1491_additive_check_constraints_wave2`

## 10. Known Limitations
- The global unique constraint `sales_invoices_invoice_no_key` remains active in this phase (Contract phase will retire it once multi-tenant numbering separation is confirmed across all customer tenants).

## 11. Future Work
- Wave 3: Promotions tenant unification (`tenant_id` -> `company_id`) via migration `v1492`.
- Wave 4: Stock source-of-truth consolidation in service layer.

## 12. Related ADRs
- ADR-0012: Database Relational Integrity and Financial Immutability Policy
- ADR-DB-002: Storage-Level Invariant Enforcement

## 13. Related RFCs
- RFC-DB-001: Phase 1 Schema Hardening & Zero-Downtime Governance
