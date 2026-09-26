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

# DB Phase 1 Schema Remediation Wave 1 Walkthrough
**Walkthrough ID:** WGP-DB-REM-WAVE1-v1.0.0  
**Area:** Database & Schema Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose
Document the transition of critical database foreign key constraints from `ON DELETE CASCADE` to `ON DELETE RESTRICT` under Phase 1 Schema Remediation Wave 1, ensuring compliance with statutory financial retention laws (Indian Companies Act, GST Act) and eliminating risk of silent ledger or allocation audit loss.

## 2. Scope
Remediate 6 foreign key constraints across financial and transactional domains:
1. `general_ledger_entries.voucher_id` -> `journal_vouchers.id`
2. `payment_allocations.payment_id` -> `payment_transactions.id`
3. `sales_order_invoice_allocations.order_id` -> `sales_orders.id`
4. `sales_order_reservations.order_id` -> `sales_orders.id`
5. `fiscal_periods.fiscal_year_id` -> `fiscal_years.id`
6. `purchase_receipt_items.receipt_id` -> `purchase_receipts.id`

Also update the SQLAlchemy ORM model `JournalVoucher.entries` to eliminate `cascade="all, delete-orphan"`.

## 3. Files Created
- `backend/alembic/versions/v1490_fk_cascade_to_restrict_wave1.py`
- `docs/implementation/db/Phase1_Schema_Remediation_Plan_v1.0.0.md`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave1_v1.0.0.md`

## 4. Files Modified
- `backend/app/models/accounting.py`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-DB-001: Strict RESTRICT on Financial Audits**: Any table representing a ledger entry, allocation audit record, or accounting fiscal period MUST use `ON DELETE RESTRICT`. Parent deletion must fail hard at the relational database level rather than cascade-deleting child financial lines.
- **Zero-Downtime Non-Blocking DDL**: Constraints are dropped and recreated without table locks, keeping transaction execution continuous.

## 6. Design Rationale
In retail ERP systems, financial ledgers (`general_ledger_entries`) and payment allocations must maintain absolute immutability. If a user or script attempts to delete a parent journal voucher or payment transaction, the database engine must immediately abort the transaction with error `23503 foreign_key_violation`, forcing the system to record a compensating cancellation or reversal rather than destroying history.

## 7. Implementation Summary
1. Generated Alembic migration `v1490_fk_cascade_to_restrict_wave1.py` targeting the 6 verified constraint names.
2. Modified `JournalVoucher.entries` in `backend/app/models/accounting.py` to remove `cascade="all, delete-orphan"`.
3. Executed Alembic migration: `alembic upgrade v1490_fk_cascade_to_restrict_wave1`.
4. Verified schema catalogs and foreign key deletion rules.

## 8. Tests Executed
1. **Schema Referential Constraint Inspection**:
   - Command: `python verify_wave1_fk_restrict.py`
   - Verified 6/6 target constraints now possess `delete_rule = 'RESTRICT'`.
   - Verified 0 CASCADE constraints remain on the target pairs.
2. **Transactional DML Negative Deletion Test**:
   - Command: `python test_dml_restrict.py`
   - Attempted deletion of parent `journal_vouchers` with active `general_ledger_entries`.
   - Result: PostgreSQL rejected deletion with error `23503 foreign_key_violation`.
3. **Linter Static Analysis**:
   - Command: `python -m ruff check backend/alembic/versions/v1490_fk_cascade_to_restrict_wave1.py`
   - Result: All checks passed.

## 9. Verification Results
- **Status:** Done
- **Quantitative Metrics:**
  - RESTRICT constraints added: 6/6 (100%)
  - CASCADE constraints eliminated on targets: 6/6 (100%)
  - Migration Execution Time: < 3.2s
  - DML Deletion Rejection: Verified (`Key (id)=(...) is still referenced from table "general_ledger_entries"`)
- **Alembic Head:** `v1490_fk_cascade_to_restrict_wave1`

## 10. Known Limitations
- The remaining 103 CASCADE constraints in the database belong to non-financial child tables or configuration entities (e.g. menu items, permissions). These will be audited in subsequent phases.

## 11. Future Work
- Wave 2: Additive CHECK constraints for non-negative values and unique constraint enforcement (`v1491`).
- Wave 3: Tenant column unification (`tenant_id` -> `company_id`) on promotions tables (`v1492`).

## 12. Related ADRs
- ADR-0012: Relational Financial Immutability and Audit Integrity

## 13. Related RFCs
- RFC-DB-001: Phase 1 Schema Hardening & Zero-Downtime Governance
