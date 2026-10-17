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
  Classification: Gate 11E Phase 2B-2 Execution Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 2B-2 Schema Hardening Execution

## 1. Objective
Execute transitional index pruning (dropping 8 obsolete non-unique `product_id` indexes) and nullability hardening (relaxing `NOT NULL` to `NULL` on 11 tables) under batch `MIG-11E-2B2-EXEC`, validating zero financial/tax/quantity drift and proving 100% reversible rollback capability.

## 2. Business Motivation
Eliminate redundant transitional index overhead and prevent database write-plane blocking on legacy product constraints, allowing canonical Item/Variant transactions to write without requiring legacy product identifiers.

## 3. Scope
- Execute controlled removal of 8 obsolete indexes: `ix_dispatch_items_product_id`, `ix_packing_slip_items_product_id`, `ix_sales_invoice_lines_product_id`, `ix_sil_product`, `idx_sales_order_items_product_id`, `ix_stock_count_lines_product_id`, `ix_stock_count_lines_take_product`, `ix_transaction_cost_snapshots_product_id`.
- Relax `product_id` column nullability to `NULL` across 11 auxiliary tables.
- Perform live rollback testing for both index re-creation and nullability re-application.
- Verify 10/10 internal `products` indexes and 682 table rows remain intact.
- Verify zero financial, tax, and stock reconciliation drift.

## 4. Current State
- Gate 11E Phase 2B-1: PASS & CLOSED (0 FKs on `products`)
- Gate 11E Phase 2B-2 Pre-Flight & Evidence Audit: PASS
- Gate 11E Phase 2B-2 Execution: COMPLETE (Index Pruning & Nullability Hardening Done)

## 5. Gap Analysis
Completed removal of 8 obsolete transitional indexes and relaxed restrictive NOT NULL constraints across 11 tables without mutating physical columns or legacy APIs.

## 6. Architecture Impact
Reduces write-path index maintenance latency and decouples table-level nullability constraints from legacy product IDs.

## 7. Proposed Design
- Controlled individual DDL transactions with pre- and post-validation checks.
- Reverse DDL rollback testing.

## 8. Files Created
- `scripts/execute_gate11e_phase2b2_execution.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase2B2_Execution_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase2B2_Execution_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- Rollback failure: Mitigated by testing reverse DDL live in isolated transactions.

## 12. Rollback Strategy
All 8 dropped indexes have exact `CREATE INDEX` reverse statements. All 11 altered columns have verified `ALTER COLUMN product_id SET NOT NULL` statements.

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase2b2_execution.py`.

## 14. Test Plan
- Individual pre-drop and post-drop validation.
- Live rollback testing.
- Pytest regression suite (`test_reports.py`).
- Financial and tax invariance verification.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Phase 2B-2 execution complete. Await user review and authorization for next gate.

## 17. Status
Completed (Execution)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 2B-2 Execution Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase2B2_Execution_v1.0.0.md)
