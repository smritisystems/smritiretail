<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.128.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: WMS Phase 3 — Dynamic Picking Bin Replenishment Engine & Min/Max Inventory Slotting Tasks

**Document ID:** IPGP-WMS-v3.128.0  
**Status:** Completed  
**Version:** 3.128.0  
**Effective Date:** 2026-10-28  

---

## 1. Objective
Establish an automated Dynamic Picking Bin Replenishment Engine and Min/Max Inventory Slotting system across SMRITI Retail OS. The system continuously evaluates on-hand inventory levels in designated fast-picking storage bins (`zone == 'PICKING'`), detects depletions breaching configured safety thresholds (`min_reorder_level`), allocates reserve inventory from bulk storage racks (`zone in ('BULK', 'STORAGE')`), and generates actionable internal transfer tasks with one-click atomic ledger execution.

## 2. Business Motivation
In high-throughput retail stores and regional distribution godowns, picking bins are located at floor height for rapid picking by warehouse associates and POS billing staff. When orders exhaust picking bin inventory, fulfillment stalls even when hundreds of units sit idle in upper reserve bulk racks. Without an automated replenishment engine, operators must manually monitor bin levels or encounter stockouts mid-pick. Phase 3 eliminates fulfillment bottlenecks by dynamically scheduling replenishment transfers before picking bins run dry.

## 3. Scope
- **Backend Schemas & Models (`backend/app/schemas/wms.py`):**
  - Define `ReplenishmentTaskItem`, `ReplenishmentTasksResponse`, `ReplenishmentExecuteItem`, `ReplenishmentExecuteRequest`, `ReplenishmentExecuteResponse`.
  - Define `ItemSlottingConfigItem`, `ItemSlottingSaveRequest`.
- **Backend Service Engine (`backend/app/services/inventory_wms.py`):**
  - Implement `get_replenishment_tasks(warehouse_id)`:
    - Scans `ItemWarehouseLocation` and physical picking bins.
    - Aggregates live stock per bin and item from `StockMovement`.
    - Detects depleted picking bins where `current_stock < min_reorder_level`.
    - Scans candidate bulk storage racks (`zone in ('BULK', 'STORAGE')`) for available on-hand stock.
    - Computes suggested transfer quantity: `min(max_capacity - current_stock, available_bulk_stock)`.
    - Assigns urgency priority (`CRITICAL`, `HIGH`, `NORMAL`, `BULK_STOCKOUT`).
  - Implement `execute_replenishment_tasks(warehouse_id, tasks, notes)`:
    - Atomically creates `TRANSFER_OUT` movements from source bulk bins.
    - Atomically creates `TRANSFER_IN` movements to target picking bins.
    - Preserves audit trails under `reference_doc_type="WMS_REPLENISHMENT"`.
  - Implement `get_warehouse_slotting(warehouse_id)` and `save_item_slotting(...)`.
- **REST API Router Endpoints (`backend/app/api/v1/wms.py`):**
  - `GET /api/v1/wms/warehouses/{warehouse_id}/replenishment-tasks`
  - `POST /api/v1/wms/warehouses/{warehouse_id}/replenishment/execute`
  - `GET /api/v1/wms/warehouses/{warehouse_id}/slotting`
  - `POST /api/v1/wms/warehouses/{warehouse_id}/slotting`
- **Frontend UI & Interactive Modals (`src/components/wms/WarehouseLocationManager.tsx`, `WmsStudioTab.tsx`):**
  - Add "Replenishment Engine" action button with live critical counter in toolbar.
  - Interactive Replenishment Manager Modal featuring metrics, search, urgency filter pills, live stock headroom bars, quantity overrides, and batch execution.
  - Interactive Min/Max Slotting Master Tab with rule configuration drawer.
- **Automated Test Suite:**
  - `backend/tests/test_wms_replenishment_and_slotting.py` (5/5 tests passing).

## 4. Current State
- Phase 2 established the physical location matrix and automated 4-tier putaway recommendation engine for inward goods.
- Fast-picking bins were created in the spatial matrix, but stock replenishment from bulk bins required manual multi-step stock transfers without threshold alerts or suggested quantities.

## 5. Gap Analysis
| Functional Area | Previous State (Phase 2) | Target State (Phase 3: v3.128.0) |
|---|---|---|
| Picking Bin Monitoring | Manual inspection of physical bins | Automated ledger scan detecting breaches of `min_reorder_level` |
| Bulk Source Allocation | User manually searched warehouse for reserve stock | Engine automatically ranks reserve bulk bins holding matching product stock |
| Suggested Transfer Qty | Guessed by user | Algorithmic calculation: `min(headroom, available_bulk)` bounded by batch size |
| Replenishment Execution | Manual multi-form transfer entry | One-click atomic dual `StockMovement` generation (`WMS_REPLENISHMENT`) |
| Slotting Governance | Static database entries | Real-time CRUD API & interactive slotting master UI |

## 6. Architecture Impact
- Reuses canonical `ItemWarehouseLocation` (`item_warehouse_locations`) model for min/max thresholds and dedicated bin affinities.
- Operates entirely on the transactional `StockMovement` ledger without requiring external cache or ad-hoc inventory tables.
- Guarantees strict multi-tenant isolation via `company_id` enforcement.
- Incorporates `_get_warehouse_resilient` to ensure fault tolerance against unmigrated tenant databases.

## 7. Proposed Design
```text
Depletion Detection:
┌───────────────────────────────────────┐
│ ItemWarehouseLocation (Item + Bin)   │
│ Min Reorder Level: 15 units           │
│ Max Capacity: 100 units               │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ Real-Time Stock Ledger Scan           │
│ Bin PICK-A01-01 Stock: 0 units        │
│ Condition: 0 < 15 ──► DELETED BREACH  │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ Reserve Bulk Rack Lookup              │
│ Scans BULK / STORAGE bins for Item    │
│ Found: BULK-R02-01 with 50 units      │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ Transfer Computation & Task Priority  │
│ Headroom: 100 - 0 = 100 units         │
│ Transfer Qty: min(40 batch, 50 bulk)  │
│ Suggested Qty: 40 units               │
│ Priority: CRITICAL (Stockout)         │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ Atomic Execution                      │
│ 1. TRANSFER_OUT: -40 @ BULK-R02-01    │
│ 2. TRANSFER_IN:  +40 @ PICK-A01-01    │
│ Audit: WMS_REPLENISHMENT              │
└───────────────────────────────────────┘
```

## 8. Files Created
- `backend/tests/test_wms_replenishment_and_slotting.py`
- `docs/implementation/wms/WMS_Phase3_Dynamic_Picking_Bin_Replenishment_And_Slotting_Plan_v3.128.0.md`
- `docs/walkthrough/wms/WMS_Phase3_Dynamic_Picking_Bin_Replenishment_And_Slotting_v3.128.0.md`

## 9. Files Modified
- `backend/app/schemas/wms.py`
- `backend/app/services/inventory_wms.py`
- `backend/app/api/v1/wms.py`
- `src/components/wms/WarehouseLocationManager.tsx`
- `src/components/wms/WmsStudioTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy 2.0+ (asyncpg)
- Pydantic v2
- React 18 + Lucide Icons + Tailwind CSS

## 11. Risks
- **High Concurrency Stock Transfers:** Mitigated by atomic dual `StockMovement` creation in an explicit session transaction flush.
- **Bulk Stockout Situations:** Handled gracefully with explicit `BULK_STOCKOUT` priority and blocked transfer status to prevent phantom inventory moves.

## 12. Rollback Strategy
All database and API extensions are non-destructive and backward-compatible. In the event of rollback, routes and frontend modals can be disabled without database schema interventions.

## 13. Verification Plan
1. Python syntax compilation across backend schemas, services, and APIs.
2. Full Pytest test suite covering replenishment detection, bulk allocation, stockout blocking, and atomic transfer execution.
3. Regression verification across all 6 WMS test suites.
4. TypeScript compilation across frontend components.

## 14. Test Plan
- Unit tests: `backend/tests/test_wms_replenishment_and_slotting.py` (5/5 passed).
- Full WMS regression suite: 34/34 tests passed in 224.94s.

## 15. Documentation Impact
- Updated Master Implementation Index (`docs/implementation/README.md`).
- Updated Master Walkthrough Index (`docs/walkthrough/README.md`).
- Updated `CHANGELOG.md` and `RELEASE_NOTES.md`.

## 16. Deployment Plan
Pure backend and frontend code deployment. No Alembic DDL migration required as `item_warehouse_locations` and `stock_movements` are already present in PostgreSQL.

## 17. Status
**Completed** (Verified with 34/34 automated tests passing and 0 TypeScript compilation errors).

## 18. Related ADRs
- `ADR-0021`: Warehouse Physical Location and Bin Structure
- `ADR-0045`: Multi-tier Inventory Resolution Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/wms/WMS_Phase3_Dynamic_Picking_Bin_Replenishment_And_Slotting_v3.128.0.md`
- `docs/walkthrough/wms/WMS_Phase2_Physical_Bin_Matrix_And_Putaway_Rules_v3.127.0.md`
