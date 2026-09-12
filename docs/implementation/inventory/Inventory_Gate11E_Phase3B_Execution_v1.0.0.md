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
  Classification: Gate 11E Phase 3B Execution Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 3B Schema Retirement & Final Migration Closure

## 1. Objective
Execute the final schema mutations under batch `MIG-11E-3B-EXEC` (dropping `transaction_cost_snapshots.product_id` and redefining view `report_flat_inventory_sales` without `product_id`), verify 100% reversible rollback capability, validate zero financial/tax/quantity drift, and certify the completion of Gate 11E and the canonical Single Workspace migration (`Item` -> `ItemVariant` -> `ItemBarcode`).

## 2. Business Motivation
Finalize all authorized legacy schema retirements, establish clean boundaries between canonical transactional tables and legacy compatibility stores, and protect statutory forensic audit trails.

## 3. Scope
- Drop `product_id` column on `transaction_cost_snapshots`.
- Redefine view `report_flat_inventory_sales` to omit legacy `product_id`.
- Verify live rollback re-creation and re-pruning.
- Retain core transactional `product_id` columns (`sales_invoice_items`, `sales_order_items`, `stock_movements`).
- Retain `products` table (682 rows) with 10 internal indexes as read-only compatibility store.
- Permanently protect `legacy_id_mappings` (681 records, 218 quarantined) and `transaction_identity_migration_ledger`.
- Zero financial, tax, or stock reconciliation drift.

## 4. Current State
- Gate 11E Phase 3A: PASS & CLOSED
- Gate 11E Phase 3B Pre-Flight: PASS & CLOSED
- Gate 11E Phase 3B Execution: COMPLETE (Final Mutations Done, Rollback Verified, Baseline Parity Certified)

## 5. Gap Analysis
All candidate `RETIRE_NOW` objects have been cleanly dropped. All remaining dependencies are explicitly classified as `DEPRECATE_FIRST`, `RETAIN_FOR_COMPATIBILITY`, or `PERMANENT_LINEAGE`.

## 6. Architecture Impact
Locks the final architectural state of the platform: canonical transaction write authority operates 100% on `variant_id`, parent catalog on `item_id`, and barcodes on `item_barcodes`.

## 7. Proposed Design
- Controlled individual DDL operations with exact pre-capture and post-validation checks.
- Reverse DDL rollback testing.

## 8. Files Created
- `scripts/execute_gate11e_phase3b_execution.py`
- `scripts/inspect_view_def.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase3B_Execution_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase3B_Execution_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`, `transaction_identity_migration_ledger`

## 11. Risks
- Rollback inaccuracy: Mitigated by live reverse DDL re-creation testing.

## 12. Rollback Strategy
All mutations have tested reverse DDL scripts (`ALTER TABLE ADD COLUMN` / `CREATE VIEW`).

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase3b_execution.py`.

## 14. Test Plan
- Individual pre-drop and post-drop validation.
- Live rollback testing.
- Pytest regression suite (`test_reports.py`).
- Financial and tax invariance verification.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Gate 11E Phase 3B complete. Present final closure report.

## 17. Status
Completed (Final Execution)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 3B Execution Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase3B_Execution_v1.0.0.md)
