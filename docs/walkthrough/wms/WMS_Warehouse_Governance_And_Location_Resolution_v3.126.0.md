<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.126.0
Created      : 2026-10-28
Modified     : 2026-10-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
-->

# WMS & Location Management: Warehouse Code Governance, Schema Drift Resilience & Location Selector Wiring

**Version:** 3.126.0  
**Date:** 2026-10-28  
**Area:** Inventory & WMS  
**Status:** Completed  

---

## 1. Purpose

Resolve warehouse and location management inconsistencies across the application by:
1. Implementing non-disruptive schema-drift resilience for unmigrated tenant databases (e.g. `smriti001` where `is_default_for_branch` column is not yet present).
2. Implementing warehouse code governance: format validation, sequential readable code generation (`WH-{BRANCH}-{SEQ:03d}`), uniqueness enforcement per company across active and deactivated records, and prohibition of code reuse after deactivation.
3. Unifying location selection across Dashboard, WMS, Purchase Order Generation, Sizewise Matrix Studio, and GRN Inwarding by linking via stable warehouse IDs while showing readable codes and names to staff.
4. Preserving historical records without fabricating auto-mappings for ambiguous legacy text strings (e.g., `"Main Warehouse"`).

---

## 2. Scope

- **Backend API & Service Hardening:**
  - `backend/app/schemas/wms.py`: Updated `WarehouseBase` to make `code: Optional[str] = None` and add `branch_id: Optional[str] = None`; enforced `code: str` in `WarehouseResponse`.
  - `backend/app/api/v1/wms.py`: Added automatic schema-drift fallback queries with `.options(defer(Warehouse.is_default_for_branch))` and `await db.rollback()`; sequential code generation; duplicate & deactivation code reuse prohibition; raw SQL fallback insert for unmigrated tenant databases.
  - `backend/app/services/inventory_warehouse_resolver.py`: Added `_find_warehouse` helper with automatic session rollback and `defer()` fallback across all 4 resolution levels (explicit ID, POS register FK/legacy text, branch default, company fallback).
- **Frontend UI & Transaction Wiring:**
  - `src/components/dashboard/RegularUxDashboard.tsx`: Replaced static hardcoded `<option>` tags with dynamic state populated via `Promise.allSettled` from `/branches` and `/wms/warehouses`, clearly prefixing `[Branch]` and `[Godown]`.
  - `src/components/purchase/CommercialDeliveryDrawer.tsx`: Replaced static preset strings with dynamic warehouse state loaded from `GET /wms/warehouses`, displaying `{w.code} - {w.name}` and storing stable warehouse `id`.
  - `src/components/purchase/types.ts`: Added `warehouseId?: string;` to `PurchaseOrderHeader`.
  - `src/components/purchase/PoGenerateTab.tsx`: Loaded active warehouses, replaced free-text delivery location with governed `<select>` dropdown, and passed `warehouse_id` in PO save payload and commercial terms.
  - `src/components/purchase/PoSizewiseTab.tsx`: Added `warehouseId` to `SizewisePOHeader`, loaded active warehouses, replaced free-text delivery location with governed `<select>` dropdown, and included `warehouse_id` in PO save payload.
  - `src/components/purchase/GrnReceiptTab.tsx`: Added `availableWarehouses` and `selectedWarehouseId`, loaded warehouses from `/wms/warehouses`, added Target Godown `<select>` dropdown in GRN header form, pre-selected warehouse from PO, added validation, and included `warehouse_id` in `POST /purchase/receipts/` payload.
  - `src/components/wms/WarehouseLocationManager.tsx`: Clarified spatial hierarchy in empty state (Warehouse/Godown vs physical bin subdivisions), displayed active warehouse code and name, and added direct action buttons.
- **Verification Suite:**
  - Automated unit test suite `backend/tests/test_warehouse_code_governance.py` (4/4 passed).
  - Automated resolver tests `backend/tests/test_inventory_warehouse_resolver.py` (7/7 passed).
  - Automated integrity tests `backend/tests/test_wms_integrity_deferred.py` (6/6 passed).
  - TypeScript compiler verification `npx tsc --noEmit` (0 errors).
  - Live PostgreSQL query verification against tenant database `smriti001` (106 warehouses queried without errors).

---

## 3. Files Created

1. `backend/tests/test_warehouse_code_governance.py` — Automated unit test suite for warehouse code format validation, duplicate code rejection, sequential code generation, and deactivation reuse blocking.
2. `docs/walkthrough/wms/WMS_Warehouse_Governance_And_Location_Resolution_v3.126.0.md` — This walkthrough document.

---

## 4. Files Modified

1. `backend/app/schemas/wms.py` — Added `branch_id` and made `code: Optional[str]` on Base, enforced `code: str` on Response.
2. `backend/app/api/v1/wms.py` — Added schema-drift fallback, code generator, duplicate/deactivation guards, raw SQL insert fallback.
3. `backend/app/services/inventory_warehouse_resolver.py` — Added `_find_warehouse` schema-drift resilient resolution.
4. `backend/app/schemas/inventory.py` — Added `warehouse_id: Optional[str] = None` to `StockMovementResponse`.
5. `backend/app/api/v1/inventory.py` — Added `warehouse_id` and `warehouse` query parameters and filtering to `GET /inventory/ledger` and populated `warehouse_id` in movement items.
6. `src/components/dashboard/RegularUxDashboard.tsx` — Dynamic branch and godown picker.
7. `src/components/inventory/StockTransferStudioModal.tsx` — Dynamic warehouse selector and schema-aligned transfer creation payload.
8. `src/components/purchase/CommercialDeliveryDrawer.tsx` — Dynamic warehouse selector with stable ID propagation.
9. `src/components/purchase/types.ts` — Added `warehouseId?: string;` to `PurchaseOrderHeader`.
10. `src/components/purchase/PoGenerateTab.tsx` — Governed warehouse selector and payload wiring.
11. `src/components/purchase/PoSizewiseTab.tsx` — Governed warehouse selector and payload wiring.
12. `src/components/purchase/GrnReceiptTab.tsx` — Target Godown selector, validation, and payload wiring.
13. `src/components/wms/WarehouseLocationManager.tsx` — Spatial hierarchy clarification in empty state.
14. `CHANGELOG.md` — Appended [3.126.0] changelog entry.
15. `RELEASE_NOTES.md` — Appended Release v3.126.0 section.

---

## 5. Architecture Decisions

- **AD-01: Schema-Drift Non-Disruptive Resilience**: Because multi-tenant databases may run on slightly staggered migration lineages (e.g. `smriti001` lacking `is_default_for_branch`), all ORM warehouse queries employ a `try...except` wrapper with immediate `await db.rollback()` and fallback `defer(Warehouse.is_default_for_branch)`. This ensures continuous service availability without requiring downtime or ad-hoc DDL in production.
- **AD-02: Safe Code Numbering via Pattern Generation**: Warehouse codes are generated sequentially using `WH-{BRANCH}-{SEQ:03d}` (or `WH-{SEQ:03d}`) rather than relying on generic lookups. Code uniqueness is enforced per company across active and deactivated records to prevent code collisions.
- **AD-03: Stable ID Transaction Links**: Across all screens (PO, GRN, STO, Transfers, Registers), transactions store the immutable technical UUID/ID (`warehouse_id`), while displaying user-friendly readable labels (`[{code}] {name}`) to operators.

---

## 6. Design Rationale

- **Prevent Phantom Routing**: Previously, free-text inputs like `"Main Store (MAIN)"` resulted in unlinked records or default fallbacks. Standardizing on `<select>` dropdowns backed by valid active warehouse records guarantees that inventory movements always link to verified godowns.
- **Zero Fabrication Policy**: Old text strings such as `"Main Warehouse"` are flagged for administrator review rather than silently auto-mapped to random godowns, adhering strictly to audit integrity.
- **Spatial Separation**: The distinction between stock-holding Warehouses/Godowns (legal and inventory entities) and physical storage locations (aisles, racks, shelves, bins) is explicitly clarified in both UI messaging and API payloads.

---

## 7. Implementation Summary

1. **Warehouse Code Generation**: When creating a warehouse without providing a code, the backend automatically resolves the parent branch code (e.g. `BR01`), inspects existing codes for that pattern, and generates the next sequence (e.g. `WH-BR01-001`).
2. **Deactivation Protection**: `PATCH /warehouses/{id}/deactivate` verifies that the warehouse has zero positive stock before deactivation. Any subsequent attempt to create a warehouse with the same code is rejected with HTTP 400.
3. **GRN Validation**: Posting a GRN requires selecting a target godown from the database, which is passed as `warehouse_id` to `POST /purchase/receipts/`.

---

## 8. Tests Executed

1. `pytest backend/tests/test_warehouse_code_governance.py` (4/4 passed)
2. `pytest backend/tests/test_inventory_warehouse_resolver.py` (7/7 passed)
3. `pytest backend/tests/test_wms_integrity_deferred.py` (6/6 passed)
4. `python -m py_compile` across all modified backend files (0 errors)
5. `npx tsc --noEmit --project tsconfig.json` (0 errors)
6. Live tenant verification against `smriti001` database (106 warehouses queried, resolver verified, 0 data modified)

---

## 9. Verification Results

```text
================= 17 passed, 17 warnings in 88.37s (0:01:28) ==================
backend/tests/test_warehouse_code_governance.py::test_warehouse_code_invalid_format_rejected PASSED
backend/tests/test_warehouse_code_governance.py::test_warehouse_code_duplicate_rejected PASSED
backend/tests/test_warehouse_code_governance.py::test_warehouse_code_auto_generated_when_omitted PASSED
backend/tests/test_warehouse_code_governance.py::test_deactivated_warehouse_code_cannot_be_reused PASSED
backend/tests/test_inventory_warehouse_resolver.py::test_resolver_level1_explicit_warehouse_id_success PASSED
backend/tests/test_inventory_warehouse_resolver.py::test_resolver_level1_explicit_warehouse_id_not_found PASSED
backend/tests/test_inventory_warehouse_resolver.py::test_resolver_level2_register_fk_priority PASSED
backend/tests/test_inventory_warehouse_resolver.py::test_resolver_level2_register_legacy_text_fallback PASSED
backend/tests/test_inventory_warehouse_resolver.py::test_resolver_level3_branch_default_priority PASSED
backend/tests/test_inventory_warehouse_resolver.py::test_resolver_level4_company_fallback PASSED
backend/tests/test_inventory_warehouse_resolver.py::test_resolver_all_levels_fail_raises_value_error PASSED
backend/tests/test_wms_integrity_deferred.py::test_r003_purchase_receipt_model_warehouse_not_null PASSED
backend/tests/test_wms_integrity_deferred.py::test_r005_transfer_status_enum_members PASSED
backend/tests/test_wms_integrity_deferred.py::test_r005_dispatch_blocks_requested_status PASSED
backend/tests/test_wms_integrity_deferred.py::test_r005_dispatch_blocks_draft_when_bypass_false PASSED
backend/tests/test_wms_integrity_deferred.py::test_r005_request_approve_reject_transitions PASSED
backend/tests/test_wms_integrity_deferred.py::test_r008_wms_router_exposes_branches PASSED
```

---

## 10. Known Limitations

- Tenant database `smriti001` has not yet had Alembic migration `v1557` applied; while the ORM and SQL fallback handles this transparently, the migration should be scheduled during an operational maintenance window.
- Tenant `smriti001` has 0 rows in `warehouse_locations` (physical bins). Physical bins must be created via the 1-Click Matrix Wizard before bin-level picking or bin stock allocation can be utilized.

---

## 11. Future Work

- Apply Alembic migration `v1557` to add `is_default_for_branch` column across any lagging tenant databases.
- Present administrator with migration wizard to formally map historical free-text references (`"Main Warehouse"`) to canonical records (`wh-central-001` or `WH-COMP-001-MAIN`).

---

## 12. Related ADRs

- ADR-0024: Multi-Tenant Schema Drift Resilience & Deferred Column Serialization
- ADR-0031: WMS Warehouse Code Numbering & Deactivation Immutability

---

## 13. Related RFCs

- RFC-0089: Universal Location Resolution & Stable FK Representation
