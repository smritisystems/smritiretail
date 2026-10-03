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
  Classification: Gate 11E Phase 3A Execution Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 3A Dead-Column Retirement Execution

## 1. Objective
Execute the controlled, individual retirement of 7 dead auxiliary `product_id` columns (`sales_invoice_lines`, `stock_transfer_items`, `stock_audit_items`, `stock_count_lines`, `dispatch_items`, `packing_slip_items`, `psv_sku_tracking`) and composite unique index `uq_audit_item_product_batch_active` under batch `MIG-11E-3A-EXEC`, verifying zero financial/tax/quantity drift and proving 100% reversible rollback capability using exact captured column schemas (`varchar(50)`).

## 2. Business Motivation
Prune obsolete database columns from auxiliary tables that have zero active production consumers, eliminating schema clutter while preserving core transaction columns, forensic audit trails, and legacy API compatibility.

## 3. Scope
- Capture exact schema definitions from `information_schema.columns` prior to DDL execution.
- Drop composite unique index `uq_audit_item_product_batch_active` on `stock_audit_items`.
- Drop `product_id` columns across 7 auxiliary tables in isolated transactions.
- Perform live rollback testing using captured exact definitions.
- Retain core transactional `product_id` columns (`sales_invoice_items`, `sales_order_items`, `stock_movements`).
- Retain the `products` table (682 rows) and 10 internal indexes.
- Verify 0.0000 financial and tax drift.

## 4. Current State
- Gate 11E Phase 2B-2: PASS & CLOSED
- Gate 11E Phase 3 Pre-Flight: PASS & CLOSED
- Gate 11E Phase 3A Execution: COMPLETE (7 Auxiliary Columns Dropped, Rollback Verified)

## 5. Gap Analysis
Successfully eliminated 7 dead columns and 1 composite index from auxiliary tables without mutating any core transactional, master catalog, or API assets.

## 6. Architecture Impact
Reduces database schema footprint and enforces clean separation between active canonical tables and legacy compatibility stores.

## 7. Proposed Design
- Controlled individual DDL operations with exact pre-capture and post-validation checks.
- Dynamic reverse DDL rollback testing.

## 8. Files Created
- `scripts/execute_gate11e_phase3a_execution.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase3A_Execution_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase3A_Execution_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- Rollback inaccuracy: Mitigated by querying live metadata (`varchar(50)`) before execution.

## 12. Rollback Strategy
Reverse DDL scripts dynamically constructed from captured metadata (`ALTER TABLE <tbl> ADD COLUMN product_id varchar(50)`).

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase3a_execution.py`.

## 14. Test Plan
- Individual pre-drop and post-drop validation.
- Live rollback testing.
- Pytest regression suite (`test_reports.py`).
- Financial and tax invariance verification.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Phase 3A execution complete. Await user review and authorization for next gate.

## 17. Status
Completed (Execution)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 3A Execution Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase3A_Execution_v1.0.0.md)
