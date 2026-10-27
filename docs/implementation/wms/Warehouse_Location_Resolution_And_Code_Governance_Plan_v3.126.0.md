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

# Warehouse Location Resolution & Code Governance Implementation Plan

**Version:** 3.126.0  
**Date:** 2026-10-28  
**Area:** Inventory & WMS  
**Status:** Completed  
**Related Walkthrough:** `docs/walkthrough/wms/WMS_Warehouse_Governance_And_Location_Resolution_v3.126.0.md`  

---

## 1. Objective

Establish unified, resilient warehouse and location management across SMRITI Retail OS. Ensure non-disruptive query and mutation execution across multi-tenant database schema drift, enforce unique sequential warehouse code governance, wire stable warehouse IDs into all transactions (Dashboard, PO, GRN, WMS), and preserve legacy data integrity without unauthorized automated mappings.

---

## 2. Business Motivation

1. **Operational Transparency**: Ensure retail operators and warehouse personnel see actual branches, godowns, and storage bins across all screens instead of hardcoded placeholder strings like `"Main Warehouse"` or `"Branch 02"`.
2. **Prevent Inventory Fragmentation**: Eliminate phantom inventory routing by ensuring Purchase Orders, GRNs, and Stock Transfers always target verified, active warehouse records via stable foreign keys.
3. **Audit & Compliance Safety**: Maintain full immutability and provenance; prevent reused or colliding warehouse codes upon deactivation.

---

## 3. Scope

- Schema drift resilience on WMS ORM queries (`defer(Warehouse.is_default_for_branch)` with session rollback on missing column).
- Warehouse code format validation (`^[A-Z0-9_\-\.]{2,50}$`).
- Automatic sequential code generation (`WH-{BRANCH}-{SEQ:03d}`).
- Duplicate code rejection across active and deactivated records.
- Deactivation code reuse prevention.
- Raw SQL fallback insert for unmigrated tenant databases.
- Dynamic location picker in Regular UX Dashboard.
- Governed warehouse select dropdown in Purchase Order Generation Tab (`PoGenerateTab.tsx`).
- Governed warehouse select dropdown in Sizewise Matrix Studio (`PoSizewiseTab.tsx`).
- Target Receiving Godown selector and mandatory validation in Goods Receipt Note Tab (`GrnReceiptTab.tsx`).
- Physical bin vs godown spatial hierarchy clarification in WMS Location Manager (`WarehouseLocationManager.tsx`).

---

## 4. Current State

- Tenant database `smriti001` is at Alembic migration `v1556`, where `is_default_for_branch` column is missing from `warehouses`.
- Regular UX Dashboard had hardcoded static `<option>` tags.
- PO generation forms allowed arbitrary free text for delivery locations.
- GRN receipt header had no warehouse selector, falling back to company defaults.

---

## 5. Gap Analysis

| Requirement | Gap Identified | Remediated State |
|---|---|---|
| Schema Drift Tolerance | 500 UndefinedColumnError on unmigrated DB | Automatic rollback and `defer()` query fallback |
| Warehouse Code Numbering | Code was mandatory string or manual | Automatic sequential pattern `WH-{BRANCH}-{SEQ:03d}` |
| Code Immutability | Reusing old codes possible | Deactivation reuse blocked across company |
| PO Delivery Location | Free-text `<input type="text">` | Governed `<select>` with stable `warehouseId` |
| GRN Receiving Location | Empty selector / omitted payload | Target godown dropdown + mandatory validation |

---

## 6. Architecture Impact

- Preserves single backend of record in FastAPI (`backend/app/api/v1/wms.py`).
- Maintains clean multi-tenant isolation via `TenantContext(company_id, branch_id)`.
- Eliminates reliance on client-side preset strings.
- Guarantees backward compatibility with unmigrated tenant schemas.

---

## 7. Proposed Design

- **Resolver Layer**: `InventoryWarehouseResolver._find_warehouse(build_query_fn)` tries standard query; catches exception, rolls back session, and retries with deferred unmigrated columns.
- **Code Engine**: Generates unique sequence by querying existing company codes matching `WH-{branch}-%` or `WH-%`.
- **Selector Standards**: Frontend components query `/wms/warehouses`, cache active records in component state, render `[{code}] {name}`, and store stable UUID `warehouseId`.

---

## 8. Files Created

1. `backend/tests/test_warehouse_code_governance.py`
2. `docs/walkthrough/wms/WMS_Warehouse_Governance_And_Location_Resolution_v3.126.0.md`
3. `docs/implementation/wms/Warehouse_Location_Resolution_And_Code_Governance_Plan_v3.126.0.md`

---

## 9. Files Modified

1. `backend/app/schemas/wms.py`
2. `backend/app/api/v1/wms.py`
3. `backend/app/services/inventory_warehouse_resolver.py`
4. `backend/app/schemas/inventory.py`
5. `backend/app/api/v1/inventory.py`
6. `src/components/dashboard/RegularUxDashboard.tsx`
7. `src/components/inventory/StockTransferStudioModal.tsx`
8. `src/components/purchase/CommercialDeliveryDrawer.tsx`
9. `src/components/purchase/types.ts`
10. `src/components/purchase/PoGenerateTab.tsx`
11. `src/components/purchase/PoSizewiseTab.tsx`
12. `src/components/purchase/GrnReceiptTab.tsx`
13. `src/components/wms/WarehouseLocationManager.tsx`
14. `CHANGELOG.md`
15. `RELEASE_NOTES.md`

---

## 10. Dependencies

- FastAPI, SQLAlchemy 2.0 Async, Pydantic V2, React 18, Vite.

---

## 11. Risks

- **Lagging Tenant Migration**: If a tenant database is missing more than `is_default_for_branch`, raw SQL fallback handles inserts safely.
- **Legacy Free Text Mappings**: Historical records referencing text `"Main Warehouse"` must not be auto-mapped without administrator confirmation.

---

## 12. Rollback Strategy

All modifications maintain backward compatibility. If rolled back, reverting git modifications restores previous behavior. Zero database schema migrations were applied during this phase.

---

## 13. Verification Plan

- Run full unit test suite with Pytest.
- Run Python syntax compilation (`py_compile`).
- Run TypeScript type checks (`tsc --noEmit`).
- Verify queries directly against live tenant database `smriti001`.

---

## 14. Test Plan

- Unit test format rejection for invalid codes.
- Unit test duplicate rejection in same company.
- Unit test sequential code generation.
- Unit test deactivation code reuse blocking.
- Unit test resolver across all 4 levels.

---

## 15. Documentation Impact

- Walkthrough created in `docs/walkthrough/wms/`.
- Master index in `docs/walkthrough/README.md` updated.
- Implementation plan created in `docs/implementation/wms/`.
- Implementation index in `docs/implementation/README.md` updated.

---

## 16. Deployment Plan

- No code commits or deployments were executed per task instructions.
- Changes are prepared in the working tree for deployment via standard CI/CD pipeline.

---

## 17. Status

**Completed**

---

## 18. Related ADRs

- ADR-0024: Multi-Tenant Schema Drift Resilience & Deferred Column Serialization
- ADR-0031: WMS Warehouse Code Numbering & Deactivation Immutability

---

## 19. Related Walkthroughs

- `docs/walkthrough/wms/WMS_Warehouse_Governance_And_Location_Resolution_v3.126.0.md`
- `docs/walkthrough/wms/WMS_DeferredRemediations_v3.125.0.md`
- `docs/walkthrough/wms/WMS_WarehouseLocationIntegrity_v3.124.0.md`
