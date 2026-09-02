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
  Classification: Gate 11E Phase 3A Execution Walkthrough Document
-->

# SMRITI Retail OS — Gate 11E Phase 3A Walkthrough: Dead-Column Retirement Execution

## 1. Purpose
This document provides the formal walkthrough for **Gate 11E — Phase 3A Execution: Dead-Column Retirement**, detailing the controlled, individual removal of 7 dead auxiliary `product_id` columns and 1 composite index under batch `MIG-11E-3A-EXEC` with exact metadata capture (`varchar(50)`) and live rollback verification.

## 2. Scope
- Exact schema capture for all 7 target columns.
- Removal of composite unique index `uq_audit_item_product_batch_active`.
- Individual dropping of `product_id` columns on 7 auxiliary tables (`sales_invoice_lines`, `stock_transfer_items`, `stock_audit_items`, `stock_count_lines`, `dispatch_items`, `packing_slip_items`, `psv_sku_tracking`).
- Live rollback re-creation and re-drop verification testing.
- Retention of all core transactional `product_id` columns (`sales_invoice_items`, `sales_order_items`, `stock_movements`), `products` table (682 rows), 10 internal indexes, and legacy APIs.
- Zero financial, tax, or quantity drift.

## 3. Files Created
1. `scripts/execute_gate11e_phase3a_execution.py`: Execution engine for Phase 3A column retirement.
2. `docs/walkthrough/inventory/Inventory_Gate11E_Phase3A_Execution_v1.0.0.md`: This walkthrough document.
3. `docs/implementation/inventory/Inventory_Gate11E_Phase3A_Execution_v1.0.0.md`: Gate 11E Phase 3A execution implementation plan.

## 5. Architecture Decisions
- **Dynamic Reverse DDL:** Rollback DDL was constructed from literal `information_schema.columns` inspection (`varchar(50)`) rather than assuming generic `VARCHAR(64)`.
- **Granular Pruning:** Handled composite index `uq_audit_item_product_batch_active` on `stock_audit_items` prior to column drop to prevent constraint errors.
- **Zero Impact on Core Transaction Domain:** Core billing and inventory ledgers (`sales_invoice_items`, `sales_order_items`, `stock_movements`) remain intact for forensic audit and compatibility.

## 6. Design Rationale
Executing dead-column retirement in a strictly verified, isolated batch ensures that database schema maintenance causes zero regression to operational systems.

## 7. Implementation Summary
Executed `scripts/execute_gate11e_phase3a_execution.py`. Captured metadata, dropped the index and 7 auxiliary columns, tested live reverse DDL, and verified 0.0000 financial and tax invariance.

## 8. Tests Executed
1. `python scripts/execute_gate11e_phase3a_execution.py`
2. Live rollback re-creation testing.
3. `pytest backend/app/tests/test_reports.py` (12/12 passing).

## 9. Verification Results
- 7/7 auxiliary `product_id` columns dropped.
- 1/1 composite unique index dropped.
- 3/3 core transactional `product_id` columns retained.
- 10/10 `products` internal indexes retained.
- `products` table intact with 682 rows.
- Financial delta: 0.0000 INR.
- Tax delta: 0.0000 INR.
- Billed units delta: 0.0000 Units.
- Batch stock delta: 0.0000 Units.
- Batch valuation delta: 0.0000 INR.
- Rollback capability: 100% verified.

## 10. Known Limitations
- Core transactional `product_id` columns remain retained as transitional compatibility attributes.

## 11. Future Work
- Gate 11E Phase 3B: Deprecation notices and auxiliary WMS canonical refactoring upon user authorization.

## 12. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 13. Related RFCs
- RFC-2026-08: Transaction Authority Migration & Strangler-Fig Decoupling
