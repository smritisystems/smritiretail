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
  Classification: Gate 11E Phase 2B-1 Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 2B-1 Legacy Foreign Key Removal

## 1. Objective
Execute controlled, individual removal of all legacy foreign key constraints referencing `products.id` across transactional and auxiliary tables, verifying that every removal is backed by tested reverse-DDL rollback capability while preserving all `product_id` columns, `products` table, `Product` ORM models, and legacy APIs.

## 2. Business Motivation
Decouple the database write and read planes from legacy product table constraints, enabling independent lifecycle management of canonical Item and Item Variant entities without blocking transactional operations.

## 3. Scope
- Execute pre-drop check on each individual foreign key constraint.
- Drop all legacy foreign key constraints referencing `products.id` individually in isolated transactions.
- Perform an end-to-end rollback verification test on a sample constraint (`sales_invoice_items_product_id_fkey`) to prove 100% reversibility.
- Verify 0 foreign keys remain pointing to `products`.
- Verify all `product_id` columns and the `products` table remain intact.
- Verify financial, tax, and stock reconciliation (0.0000 drift).

## 4. Current State
- Gate 11E Phase 1: PASS
- Gate 11E Phase 2A: PASS
- Gate 11E Phase 2B-1: COMPLETE (FKs Removed & Reversibility Proven)

## 5. Gap Analysis
Prior to Phase 2B-1, 18 foreign keys strictly bound transaction tables to `products.id`. Phase 2B-1 eliminated these constraint blockers while preserving column structure for backward compatibility.

## 6. Architecture Impact
Removes relational constraint coupling to `products` while maintaining physical storage for transitional reads and forensic lineage via `legacy_id_mappings`.

## 7. Proposed Design
- Controlled individual `ALTER TABLE ... DROP CONSTRAINT ...` transactions.
- Automated reverse DDL generator with verified re-creation testing.

## 8. Files Created
- `scripts/execute_gate11e_phase2b1_fk_removal.py`
- `scripts/check_remaining_fks.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase2B1_FK_Removal_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase2B1_FK_Removal_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- Constraint removal causing orphaned records: Mitigated by Phase 2A backfill and canonical writer enforcement.

## 12. Rollback Strategy
Every dropped constraint has a tested reverse DDL statement (`ALTER TABLE <tbl> ADD CONSTRAINT <c_name> FOREIGN KEY (<col>) REFERENCES products(id)`). Tested and verified live.

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase2b1_fk_removal.py`.

## 14. Test Plan
- Individual pre-drop and post-drop validation.
- Live rollback re-creation test.
- Financial and tax invariance check.
- Pytest test suite execution.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Phase 2B-1 complete. Await user review and explicit authorization for Phase 2B-2.

## 17. Status
Completed (Phase 2B-1)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 2B-1 Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase2B1_FK_Removal_v1.0.0.md)
