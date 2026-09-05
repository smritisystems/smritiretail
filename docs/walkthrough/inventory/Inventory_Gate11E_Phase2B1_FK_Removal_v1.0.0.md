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
  Classification: Gate 11E Phase 2B-1 Walkthrough Document
-->

# SMRITI Retail OS — Gate 11E Phase 2B-1 Walkthrough: Legacy Foreign Key Removal

## 1. Purpose
This document provides the formal engineering walkthrough for **Gate 11E — Phase 2B-1: Legacy Foreign Key Removal**, detailing the controlled, isolated removal of legacy foreign key constraints referencing `products.id` while preserving all `product_id` columns, `products` table, `Product` models, and legacy APIs.

## 2. Scope
- Pre-drop validation of each legacy foreign key constraint.
- Individual DDL execution to drop foreign key constraints across 18 tables.
- Verification that 0 foreign key constraints remain pointing to `products`.
- Live rollback re-creation and re-drop verification test.
- Post-drop financial, tax, and stock reconciliation.
- Zero column, table, or API deletions.

## 3. Files Created
1. `scripts/execute_gate11e_phase2b1_fk_removal.py`: Controlled FK removal and rollback verification engine.
2. `scripts/check_remaining_fks.py`: Residual FK verification script.
3. `docs/walkthrough/inventory/Inventory_Gate11E_Phase2B1_FK_Removal_v1.0.0.md`: This walkthrough document.
4. `docs/implementation/inventory/Inventory_Gate11E_Phase2B1_FK_Removal_v1.0.0.md`: Gate 11E Phase 2B-1 implementation plan.

## 5. Architecture Decisions
- **Granular Individual DDL:** Constraints were dropped one-by-one in isolated transactions rather than a single batch.
- **Proven Reversibility:** Live test executed recreating `sales_invoice_items_product_id_fkey` via its reverse DDL and verifying successful re-establishment before re-dropping.
- **Zero Schema Mutation:** All `product_id` columns and `products` rows remain intact.

## 6. Design Rationale
Removing relational foreign keys eliminates database constraint locks while transitional dual-write and legacy API compatibility remain active.

## 7. Implementation Summary
Executed `scripts/execute_gate11e_phase2b1_fk_removal.py`. Dropped all foreign key constraints targeting `products.id`. Reached 0 remaining foreign keys. Executed rollback test confirming 100% reversibility. Verified 0.0000 financial delta and 0.0000 tax delta.

## 8. Tests Executed
1. `python scripts/execute_gate11e_phase2b1_fk_removal.py`
2. `python scripts/check_remaining_fks.py`
3. Live rollback DDL re-creation test.
4. `pytest backend/app/tests/test_reports.py` (12/12 passing).

## 9. Verification Results
- 18/18 FK constraints removed.
- Remaining FKs referencing `products`: Exactly 0.
- `product_id` columns retained: 18/18 tables.
- `products` table intact: 682 rows.
- Financial delta: 0.0000 INR.
- Tax delta: 0.0000 INR.
- Batch stock delta: 0.0000 Units.
- Rollback capability: 100% tested and verified.

## 10. Known Limitations
- Transitional `product_id` columns remain in transaction tables until Phase 2B-2.

## 11. Future Work
- Gate 11E Phase 2B-2: Transitional column retirement and index cleanup upon user authorization.

## 12. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 13. Related RFCs
- RFC-2026-08: Transaction Authority Migration & Strangler-Fig Decoupling
