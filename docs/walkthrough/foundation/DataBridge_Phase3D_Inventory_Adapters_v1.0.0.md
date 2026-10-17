<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough — SMRITI DataBridge Phase 3D Inventory Movement Adapters
-->

# Walkthrough: SMRITI DataBridge Phase 3D — Inventory Movement & Stock Transfer Adapters

## 1. Purpose
This walkthrough documents the design, implementation, and rigorous verification of **SMRITI DataBridge Phase 3D: Inventory Movement & Stock Transfer Domain Adapters**. Phase 3D establishes canonical ingress boundaries for physical inventory transactions:
- **Stock Transfer Order** (`DataBridgeStockTransferAdapter`): Inter-warehouse movement document ingestion (`stock_transfers` and `stock_transfer_items`).
- **Physical Stock Count / Audit & Adjustment** (`DataBridgeStockAuditAdapter`): Warehouse inventory cycle count, physical audit, and variance calculation document ingestion (`stock_audits` and `stock_audit_items`).

These domain adapters enable seamless migration of historical stock transfers and physical count sheets from spreadsheets, external 3PL systems, or legacy ERPs with automated warehouse resolution, product line provisioning, variance calculations, tamper-evident preview tokens, and zero live database schema migrations.

---

## 2. Scope
- Domain entities: `STOCK_TRANSFER` and `STOCK_AUDIT`.
- Tabular multi-row grouping by `transfer_no` and `audit_no`.
- Dual-warehouse resolution and same-warehouse conflict detection (`source_warehouse_id != dest_warehouse_id`).
- Product auto-provisioning via `IdentityEngine.allocate_internal` ensuring foreign key constraints on `stock_transfer_items.product_id` and `stock_audit_items.product_id` are strictly satisfied.
- Variance calculations (`variance_qty = counted_qty - system_qty`, `variance_value = variance_qty * unit_cost`).
- Preview and commit API routes under `/api/v1/databridge/stock-transfer/*` and `/api/v1/databridge/stock-audit/*`.
- Header mapping dictionaries in `src/lib/headerMapping/`.
- Architecture governance preflight certification.

---

## 3. Files Created
1. `backend/app/services/databridge/adapters/stock_transfer_adapter.py`: Domain adapter for Stock Transfer Orders.
2. `backend/app/services/databridge/adapters/stock_audit_adapter.py`: Domain adapter for Stock Audits & Physical Counts.
3. `backend/tests/test_databridge_phase3d_inventory.py`: Automated test suite with 7 test cases covering multi-line grouping, conflict detection, variance calculations, and REST API routes.
4. `docs/implementation/foundation/DataBridge_Phase3D_Inventory_Adapters_Implementation_Plan_v1.0.0.md`: 19-section IPGP implementation plan.
5. `scripts/register_databridge_phase3d_architecture.py`: Preflight certificate issuer and capability registration script.
6. `docs/walkthrough/foundation/DataBridge_Phase3D_Inventory_Adapters_v1.0.0.md`: This 13-section WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py`: Added `STOCK_TRANSFER` and `STOCK_AUDIT` to `DataBridgeEntityType`.
2. `backend/app/services/databridge/adapters/__init__.py`: Exported `DataBridgeStockTransferAdapter` and `DataBridgeStockAuditAdapter`.
3. `backend/app/services/databridge/service.py`: Registered `STOCK_TRANSFER` and `STOCK_AUDIT` in `resolve_adapter`.
4. `backend/app/api/v1/databridge.py`: Added `/stock-transfer/preview`, `/stock-transfer/commit`, `/stock-audit/preview`, and `/stock-audit/commit` routes.
5. `src/lib/headerMapping/types.ts`: Extended `MappingContext` with `'STOCK_TRANSFER' | 'STOCK_AUDIT'`.
6. `src/lib/headerMapping/HeaderAliasRegistry.ts`: Registered `SMRITI_STOCK_TRANSFER_FIELDS` and `SMRITI_STOCK_AUDIT_FIELDS`.
7. `docs/implementation/README.md`: Registered Phase 3D implementation plan.
8. `docs/walkthrough/README.md`: Appended Phase 3D walkthrough entry.

---

## 5. Architecture Decisions
- **Zero Schema Migrations**: Operates strictly on existing `stock_transfers`, `stock_transfer_items`, `stock_audits`, and `stock_audit_items` tables.
- **Physical Warehouse Isolation**: Rejects identical source and destination warehouses (`source_warehouse_id == dest_warehouse_id`) with blocking conflict `SMRITI-VAL-WAREHOUSE-SAME`.
- **Governed Identity Allocation**: Uses `IdentityEngine.allocate_internal` returning `(tech_id, id_code)` for canonical entity and code generation.
- **Immutable Previews**: Previews execute read-only without modifying database state; preview tokens expire after 30 minutes.

---

## 6. Design Rationale
In enterprise retail, stock transfers and inventory counts represent critical physical asset reconciliations. Allowing imports without strict warehouse validation or automatic calculation of discrepancy values would cause inventory drift. Providing automated line grouping allows operators to paste or upload standard flat spreadsheets where each row has a transfer or audit number without requiring pre-formatted nested JSON structures.

---

## 7. Implementation Summary
- **Multi-Line Grouping**: `group_rows` aggregates flat tabular rows into parent documents by `transfer_no` or `audit_no`, while passing nested JSON structures through unchanged.
- **Warehouse Resolution**: Resolves warehouse by `id`, `code`, or `name`. Auto-provisions fallback warehouses with clean codes if necessary.
- **Product Reconciliation**: Looks up `Product` by `id`, `sku`, `barcode`, or `code`. If missing, auto-provisions a catalog product via `IdentityEngine` to prevent foreign key violations.
- **Variance Calculation**: For stock audits, automatically computes `variance_qty = counted_qty - system_qty` and `variance_value = variance_qty * unit_cost`.

---

## 8. Tests Executed
1. `backend/tests/test_databridge_phase3d_inventory.py`:
   - `test_tc_inv_001_stock_transfer_preview_and_commit`: PASSED
   - `test_tc_inv_002_stock_transfer_same_warehouse_conflict`: PASSED
   - `test_tc_inv_003_stock_transfer_duplicate_conflict`: PASSED
   - `test_tc_inv_004_stock_transfer_in_file_duplicate`: PASSED
   - `test_tc_inv_005_stock_audit_preview_and_commit`: PASSED
   - `test_tc_inv_006_stock_audit_duplicate_conflict`: PASSED
   - `test_tc_inv_007_rest_endpoints_e2e_preview_and_commit`: PASSED
2. **Full Regression Test Suite across Phases 1, 2, 3A, 3B, 3C, and 3D**:
   - `backend/tests/test_databridge_phase1.py` (9 tests): PASSED
   - `backend/tests/test_databridge_phase2_catalog.py` (16 tests): PASSED
   - `backend/tests/test_databridge_phase3a_party.py` (11 tests): PASSED
   - `backend/tests/test_databridge_phase3b_procurement.py` (8 tests): PASSED
   - `backend/tests/test_databridge_phase3c_sales.py` (8 tests): PASSED
   - `backend/tests/test_databridge_phase3d_inventory.py` (7 tests): PASSED
   - **Total**: 59/59 tests green in 63.03 seconds.
3. **Frontend Linting**:
   - `npm run lint` (`tsc --noEmit`): PASSED (Exit code 0).
4. **Architecture Gate**:
   - `npm run architecture:check`: PASSED (11/11 checks, 0 violations).

---

## 9. Verification Results
```
Verification Checklist

✓ Code Complete: Adapters implemented, wired, and registered
✓ Tests Passed: 59/59 full regression suite green
✓ Linters Passed: tsc --noEmit 0 errors
✓ Architecture Passed: 11/11 checks passed, 0 violations
✓ Documentation Updated: Implementation Plan and Walkthrough created
✓ Zero Database Migrations: Zero schema alterations
✓ Status Marked: Done
```

---

## 10. Known Limitations
- High-volume files (>5,000 rows) are rejected synchronously per `MAX_SYNC_ROWS = 5000` limit and must be processed via Phase 4 asynchronous worker queue.

---

## 11. Future Work
- **Phase 4**: Asynchronous Background Task Queue & Chunked Ingestion for large datasets (>5,000 rows).
- Real-time WebSocket progress reporting for chunked uploads.

---

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture
- `ADR-0042`: DataBridge Enterprise Architecture & Multi-Tenant Ingress Boundary
- `ADR-0043`: Transaction Document Grouping & Auto-Provisioning Invariants

---

## 13. Related RFCs
- `RFC-2026-08`: Universal DataBridge Interchange Specification (SMRITI-X v1.0)
