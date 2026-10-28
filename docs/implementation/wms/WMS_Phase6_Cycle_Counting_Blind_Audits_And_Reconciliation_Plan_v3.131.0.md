<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.131.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: WMS Phase 6 — Warehouse Physical Bin Cycle Counting, Blind Audits, Variance Approvals & Reconciliation Ledger Integration

## 1. Objective
Deliver an enterprise-grade, bin-level Warehouse Cycle Counting & Physical Inventory Audit Engine for SMRITI Retail OS. Transition the system from generic godown-level batch auditing to precise spatial bin verification (`aisle-rack-shelf-bin`), featuring Blind Auditing (obscuring expected balances to prevent operator confirmation bias), multi-parameter plan generation (by Zone, Aisle, or Bin list), automated variance threshold classification, supervisor escalation/approval gates, secondary recount scheduling, and atomic bin-attributed `StockMovement` ledger reconciliation.

## 2. Business Motivation
In high-throughput omnichannel warehouses, discrepancy between ERP book stock and physical floor stock leads to false stockouts, missed customer orders, and unaccounted shrinkage. Traditional full-warehouse annual stocktakes require complete warehouse shutdowns, incurring massive commercial losses. Cycle counting replaces shutdown stocktakes with continuous, targeted audits of specific aisles and zones without halting warehouse fulfillment. Blind auditing guarantees operators physically touch and count inventory rather than pencil-whipping expected counts, while automated variance thresholds safeguard against unauthorized write-offs.

## 3. Scope
1. **Cycle Count Plan Generation**: Scope counts by Warehouse, Zone (`PICKING`, `BULK`, `STORAGE`, `QUARANTINE`), Aisle code, or explicit Bin location list.
2. **Blind Audit Mode (`is_blind`)**: When enabled, hides `system_qty`, `variance_qty`, and `variance_value` from floor operators until count submission or supervisor reveal.
3. **Barcode / RFID Count Recording**: Optical scan integration incrementing counted quantities at specific bins with discrepancy categorization (`DAMAGED`, `EXPIRED`, `THEFT_LOSS`, `SURPLUS_FOUND`, `COUNTING_ERROR`).
4. **Variance Threshold & Approval Governance**: Automatic classification of variance lines into `AUTO_APPROVED` or `APPROVAL_REQUIRED` (e.g. value > ₹1,000 or qty variance > 5%).
5. **Multi-round Recounts**: Flags high-variance bins for independent recount (`RECOUNT_REQUESTED`) before ledger posting.
6. **Bin-Attributed Reconciliation**: Atomically posts `StockMovement` records (`INVENTORY_ADJUSTMENT`, `STOCK_RECONCILIATION`) attributing exact bins, updating bin occupancy and headroom.
7. **Frontend Workspace Integration**: Full UI support in `WmsStudioTab.tsx` with blind mode badges, threshold alerts, recount actions, and supervisor approval controls.

## 4. Current State
`StockAuditService` exists at `backend/app/services/stock_audit_service.py` and provides batch-level stock counting against `ProductBatchStock`. However:
- It lacks spatial bin awareness (`bin_location` / `zone` / `aisle`).
- It has no blind auditing toggle to obscure expected numbers from mobile/floor counters.
- It lacks automated variance threshold governance and supervisor approval gates.
- It does not support secondary recount tracking before ledger posting.

## 5. Gap Analysis
| Capability | Current State (`StockAuditService`) | WMS Phase 6 Target Architecture |
|---|---|---|
| Spatial Location Scope | Whole warehouse only | Targeted by Zone, Aisle, or specific Bin list |
| Floor Counter Visibility | Expected quantities always visible | Blind Audit mode (`is_blind=True`) obscuring expected quantities |
| Variance Governance | Immediate reconciliation without threshold gates | Automatic tiering (`AUTO_APPROVED` vs `APPROVAL_REQUIRED`) |
| Recount Workflow | Not supported | Flagging high-variance items for secondary recount |
| Bin Ledger Attribution | Ledger movement `bin` field often null | Explicit bin attribution on `StockMovement` (`bin="A-01-01"`) |
| Supervisor Approval | No dedicated approval phase | Formal `approve_cycle_count` route with supervisor audit logging |

## 6. Architecture Impact
- **Schemas (`backend/app/schemas/wms.py`)**: Introduce `CycleCountPlanCreate`, `CycleCountItemResponse`, `CycleCountPlanResponse`, `CycleCountRecordCountRequest`, `CycleCountApproveRequest`, `CycleCountRecountRequest`.
- **Domain Service (`backend/app/services/inventory_wms.py`)**: Implement `create_cycle_count_plan`, `get_cycle_count_plans`, `get_cycle_count_details`, `record_cycle_count_item`, `request_cycle_count_recount`, `approve_cycle_count`, and `reconcile_cycle_count`.
- **API Router (`backend/app/api/v1/wms.py`)**: Expose REST endpoints under `/warehouses/{warehouse_id}/cycle-counts`.
- **Frontend (`src/components/wms/WmsStudioTab.tsx`)**: Augment the Stock Audit sub-tab with Cycle Count filtering, blind mode toggles, recount controls, and approval badges.

## 7. Proposed Design
```text
Zone/Aisle Selection (e.g. Zone: PICKING, Aisle: A-01)
         ↓
Generate Cycle Count Plan (Snapshot Bin Allocations & Stock)
         ↓
Blind Count Mode: system_qty HIDDEN from Floor Counter
         ↓
Floor Scan / Count Entry (Optical Barcode / RFID Tag)
         ↓
Variance Check:
  ├─ If Variance <= Threshold (e.g. <= ₹1,000 & <= 5%) → AUTO_APPROVED
  └─ If Variance > Threshold → APPROVAL_REQUIRED / RECOUNT_REQUESTED
         ↓
Supervisor Approval / Recount Sign-off
         ↓
Atomic Reconciliation:
  - Posts StockMovement with movement_type="STOCK_ADJUSTMENT" & bin="A-01-01"
  - Updates ItemWarehouseLocation and Batch Stock
  - Status -> COMPLETED
```

## 8. Files Created
1. `docs/implementation/wms/WMS_Phase6_Cycle_Counting_Blind_Audits_And_Reconciliation_Plan_v3.131.0.md`
2. `docs/walkthrough/wms/WMS_Phase6_Cycle_Counting_Blind_Audits_And_Reconciliation_v3.131.0.md`
3. `backend/tests/test_wms_cycle_counting.py`

## 9. Files Modified
1. `backend/app/schemas/wms.py`
2. `backend/app/services/inventory_wms.py`
3. `backend/app/api/v1/wms.py`
4. `src/components/wms/WmsStudioTab.tsx`
5. `docs/implementation/README.md`
6. `docs/walkthrough/README.md`
7. `CHANGELOG.md`
8. `RELEASE_NOTES.md`

## 10. Dependencies
- FastAPI `Depends(get_company_db)`, `TenantContext`
- SQLAlchemy `select`, `AsyncSession`, `StockMovement`, `ItemWarehouseLocation`
- Pydantic v2 `BaseModel`, `ConfigDict`

## 11. Risks
- *Risk*: Blind counting prevents operators from catching typo inputs.
  *Mitigation*: Provide instant item barcode verification and reasonable bounds checks (e.g., negative counts rejected).
- *Risk*: High concurrency between picking waves and cycle counts in the same aisle.
  *Mitigation*: Cycle count records snapshot timestamp; reconciliation accounts for post-snapshot stock movements.

## 12. Rollback Strategy
All changes are additive. The previous batch audit endpoints remain intact and functional. If cycle counting fails, operators continue using legacy audit routes.

## 13. Verification Plan
- Unit tests for plan creation with zone/aisle filtering.
- Test for blind mode obscuring system quantities in responses.
- Test for threshold violation marking `APPROVAL_REQUIRED`.
- Test for recount requests and supervisor approval workflow.
- Test for atomic `StockMovement` creation with exact bin attribution.

## 14. Test Plan
Execute `backend/tests/test_wms_cycle_counting.py` alongside all 8 existing WMS test suites. Target 100% pass rate. Verify frontend with `npx tsc --noEmit`.

## 15. Documentation Impact
Update implementation index, walkthrough index, `CHANGELOG.md`, and `RELEASE_NOTES.md`.

## 16. Deployment Plan
Pure backend logic and frontend UI updates. No database migrations required due to resilient memory-backed plan store keyed by company ID.

## 17. Status
In Progress

## 18. Related ADRs
- `ADR-0045`: WMS Architecture & Bin Matrix Governance
- `ADR-0078`: Stock Ledger Immutable Audit Trails

## 19. Related Walkthroughs
- `docs/walkthrough/wms/WMS_Phase6_Cycle_Counting_Blind_Audits_And_Reconciliation_v3.131.0.md`
- `docs/walkthrough/wms/WMS_Phase5_Wave_Picking_And_Packing_Station_v3.130.0.md`
