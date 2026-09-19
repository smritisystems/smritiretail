<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-02
  Modified     : 2026-09-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Gate 11E Phase 3A Dead-Column Verification Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 3A Dead-Column Dependency Verification

## 1. Objective
Perform exhaustive database and application codebase verification for the 7 proposed `RETIRE_NOW` `product_id` columns across auxiliary tables (`sales_invoice_lines`, `stock_transfer_items`, `stock_audit_items`, `stock_count_lines`, `dispatch_items`, `packing_slip_items`, `psv_sku_tracking`) with zero schema mutations, proving that all 7 columns have zero runtime consumers and are safe to drop.

## 2. Business Motivation
Clean up residual database schema noise from obsolete auxiliary tables while ensuring zero regression across active business domains, reports, and tax audits.

## 3. Scope
- Verify row counts, foreign keys, unique constraints, triggers, views, and index dependencies across 7 target auxiliary tables.
- Audit backend ORM models, repositories, API schemas, background jobs, and test fixtures for any remaining references.
- Formulate the exact DROP COLUMN DDL and corresponding reverse rollback DDL.
- Zero schema mutations executed.

## 4. Current State
- Gate 11E Phase 2B-2: PASS & CLOSED (Pruning & Nullability Done)
- Gate 11E Phase 3 Pre-Flight: PASS & CLOSED (Retirement Matrix Established)
- Gate 11E Phase 3A: COMPLETE (Dead-Column Verification Proven, Zero DDL Executed)

## 5. Gap Analysis
Identified that 6 of the 7 columns are completely free of all constraints and indexes, while `stock_audit_items.product_id` contains a composite partial unique index (`uq_audit_item_product_batch_active`) that must be pruned prior to column dropping.

## 6. Architecture Impact
Confirms that operational WMS and billing flows execute entirely on canonical tables (`sales_invoice_items`, `stock_takes`, `stock_transfers`, `item_variants`) without touching these 7 auxiliary columns.

## 7. Proposed Design
- Stage 1: Drop composite index `uq_audit_item_product_batch_active` on `stock_audit_items`.
- Stage 2: Execute `ALTER TABLE ... DROP COLUMN product_id` across all 7 verified tables upon explicit authorization.

## 8. Files Created
- `scripts/execute_gate11e_phase3a_verification.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase3A_Dead_Column_Verification_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase3A_Dead_Column_Verification_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- Dropping columns referenced in application code: Mitigated by codebase grep proving 0 occurrences in models, repositories, and schemas.

## 12. Rollback Strategy
Every dropped column has an exact `ALTER TABLE ADD COLUMN` reverse DDL statement.

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase3a_verification.py`.

## 14. Test Plan
- Database constraint and trigger audit.
- Codebase reference search.
- Baseline invariance verification.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Verification complete. Await user review and authorization for Phase 3A Execution.

## 17. Status
Completed (Verification)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 3A Dead-Column Verification Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase3A_Dead_Column_Verification_v1.0.0.md)
