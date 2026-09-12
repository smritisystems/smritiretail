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
  Classification: Gate 11E Phase 3A Dead-Column Verification Walkthrough Document
-->

# SMRITI Retail OS — Gate 11E Phase 3A Walkthrough: Final Dead-Column Dependency Verification

## 1. Purpose
This document provides the formal walkthrough for **Gate 11E — Phase 3A: Final Dead-Column Dependency Verification**, documenting the exhaustive database constraint, trigger, view, index, and codebase scan performed across 7 auxiliary `product_id` columns with zero schema mutations.

## 2. Scope
- Verify row counts and database constraint dependencies across 7 auxiliary tables (`sales_invoice_lines`, `stock_transfer_items`, `stock_audit_items`, `stock_count_lines`, `dispatch_items`, `packing_slip_items`, `psv_sku_tracking`).
- Audit application models, repositories, and API schemas.
- Classify columns into `SAFE_TO_DROP` vs `RETAIN`.
- Formulate proposed DROP COLUMN DDL and reverse Rollback DDL.
- Zero DDL executed.

## 3. Files Created
1. `scripts/execute_gate11e_phase3a_verification.py`: Verification audit engine.
2. `docs/walkthrough/inventory/Inventory_Gate11E_Phase3A_Dead_Column_Verification_v1.0.0.md`: This walkthrough document.
3. `docs/implementation/inventory/Inventory_Gate11E_Phase3A_Dead_Column_Verification_v1.0.0.md`: Gate 11E Phase 3A implementation plan.

## 5. Architecture Decisions
- **Complete Decoupling Confirmed:** Proven that 0 active backend services reference `product_id` on these 7 auxiliary tables.
- **Index Cascade Management:** Documented that `stock_audit_items.product_id` requires dropping composite unique index `uq_audit_item_product_batch_active` prior to column drop.
- **Permanent Lineage Preservation:** Reconfirmed that `legacy_id_mappings` and `transaction_identity_migration_ledger` remain permanent and untouched.

## 6. Design Rationale
Conducting this verification step guarantees that column removal will not cause constraint violation errors, broken ORM relationships, or query failures.

## 7. Implementation Summary
Executed `scripts/execute_gate11e_phase3a_verification.py`. Verified database metadata, conducted full-text codebase searches across `backend/app/`, validated canonical replacement paths, and locked the reconciliation baseline.

## 8. Tests Executed
1. `python scripts/execute_gate11e_phase3a_verification.py`
2. Database constraint, index, and trigger metadata scans.
3. Codebase grep verification across `backend/app/`.

## 9. Verification Results
- 6/7 columns: `SAFE_TO_DROP` directly.
- 1/7 column (`stock_audit_items.product_id`): `SAFE_TO_DROP_WITH_INDEX_CASCADE`.
- 0 backend ORM or query references found.
- Locked baseline: INR 10,619,693.59 revenue, 0.0000 delta.
- 0 DDL executed.

## 10. Known Limitations
- DDL execution deferred until explicit user authorization.

## 11. Future Work
- Gate 11E Phase 3A Execution: Execute column dropping upon explicit authorization.

## 12. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 13. Related RFCs
- RFC-2026-08: Transaction Authority Migration & Strangler-Fig Decoupling
