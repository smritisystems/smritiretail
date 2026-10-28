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

# WMS Phase 6 Walkthrough: Warehouse Physical Bin Cycle Counting, Blind Audits, Variance Approvals & Discrepancy Reconciliation Ledger Integration

**Walkthrough Version:** v3.131.0  
**Area:** Warehouse Management System (WMS) / Inventory Auditing & Reconciliation  
**Date:** 2026-10-28  

---

## 1. Purpose
This walkthrough documents the technical architecture, implementation, and rigorous verification of **WMS Phase 6: Warehouse Physical Bin Cycle Counting, Blind Audits, Variance Approvals & Discrepancy Reconciliation Ledger Integration** for SMRITI Retail OS. 

Phase 6 closes the vital audit and inventory governance loop within SMRITI WMS by introducing:
1. **Targeted Physical Bin Scoping**: Dynamically assembling cycle count audit plans by physical warehouse zone (`PICKING`, `BULK`, `STORAGE`, `QUARANTINE`), aisle code, or explicit bin location lists.
2. **Blind Audit Masking**: Eliminating floor counting bias by obscuring expected system stock quantities (`system_qty`), variance quantities, and discrepancy valuations from floor auditors until counts are confirmed or explicitly unmasked by authorized supervisors.
3. **Multi-Round Optical Barcode Verification**: Enforcing physical barcode/SKU scans with structured reason codes (`MATCHED`, `DAMAGED`, `EXPIRED`, `THEFT_LOSS`, `SURPLUS_FOUND`, `COUNTING_ERROR`) and secondary recount workflows (`RECOUNT_REQUESTED`).
4. **Automated Threshold Classification**: Auto-approving counts when discrepancy quantities and values are within tight tolerance thresholds (default: variance value ≤ ₹1,000 and variance percentage ≤ 5%), while automatically escalating non-conforming items to `APPROVAL_REQUIRED` and placing the plan into `PENDING_APPROVAL`.
5. **Supervisor Approval Gates & Notes**: Authorizing managers to review, audit, and approve high-value or high-variance discrepancies with compulsory justification audit notes.
6. **Atomic Dual-Polarity Ledger Reconciliation**: Committing verified inventory adjustments directly into the SMRITI `stock_movements` ledger with bin-level attribution, generating positive movements (`movement_type="INWARD_SURPLUS"`) for surplus finds and negative movements (`movement_type="OUTWARD_LOSS"`) for shrinkage/breakage, stamped with `reference_doc_type="WMS_CYCLE_COUNT"`.
7. **High-Density Frontend Studio Integration**: Equipping `WmsStudioTab.tsx` with a Mode Switcher ("Physical Bin Cycle Count" vs "Legacy Batch Stocktake"), real-time blind unmasking toggles, barcode scan verification, multi-stage recount triggers, supervisor approval dialogues, and instant ledger reconciliation.

---

## 2. Scope

- **Data Models & Schemas (`backend/app/schemas/wms.py`)**:
  - `CycleCountPlanCreate`: Plan definition supporting warehouse ID, name, plan type (`ZONE`, `AISLE`, `BIN_LIST`, `FULL_WAREHOUSE`), zone filter, aisle filter, bin location list, blind mode flag (`is_blind`), and custom threshold limits (`threshold_qty_pct`, `threshold_val`).
  - `CycleCountItemResponse`: Line-level audit item reflecting location code, item code, barcode, system quantity (masked when blind), counted quantity, variance quantity, discrepancy reason, recount flag, approval requirement, and approval status.
  - `CycleCountPlanResponse` & `CycleCountPlanListResponse`: Detailed plan summary including scope criteria, completion counters, threshold statistics, and aggregated discrepancy values.
  - `CycleCountRecordCountRequest` & `CycleCountRecordCountResponse`: Floor count recording payload with scanned barcode/SKU, physical count, and discrepancy reason code.
  - `CycleCountRecountRequest` & `CycleCountRecountResponse`: Recount initiation triggering status reset on disputed or anomalous lines.
  - `CycleCountApproveRequest` & `CycleCountApproveResponse`: Supervisor approval payload with manager notes.
  - `CycleCountReconcileResponse`: Atomic ledger execution summary reporting generated stock movement counts and adjusted valuation.

- **Backend Core Services (`backend/app/services/inventory_wms.py`)**:
  - `create_cycle_count_plan`: Resolves physical bins from `WarehouseLocation` (`inventory.py`) matching zone and aisle filters, queries live bin stock from `StockMovement`, initializes plan records, and applies blind masking.
  - `_mask_plan_for_response`: Replaces `system_qty`, `variance_qty`, and `variance_val` with `None` when `is_blind=True` unless `unmask=True` or line count is recorded.
  - `get_cycle_count_plans` & `get_cycle_count_details`: Retrieves scoped plans and individual task manifests with real-time progress calculations.
  - `record_cycle_count_item`: Validates scanned barcode against physical item master, calculates variances, compares against value/percentage thresholds, sets `is_approval_required`, and transitions plan status to `IN_PROGRESS` or `PENDING_APPROVAL`.
  - `request_cycle_count_recount`: Resets item status to `RECOUNT_REQUESTED` and zeroes counted quantity for secondary audit rounds.
  - `approve_cycle_count`: Evaluates manager permissions, approves threshold-exceeding discrepancies, logs supervisor notes, and advances plan to `APPROVED`.
  - `reconcile_cycle_count`: Safety gate ensuring non-zero variance plans cannot post without prior supervisor approval; posts atomic `StockMovement` entries (`INWARD_SURPLUS` / `OUTWARD_LOSS`) with explicit `bin` attribution and sets plan status to `RECONCILED`.

- **FastAPI REST Endpoints (`backend/app/api/v1/wms.py`)**:
  - `POST /api/v1/wms/warehouses/{warehouse_id}/cycle-counts`: Creates new cycle count plan (HTTP 201).
  - `GET /api/v1/wms/warehouses/{warehouse_id}/cycle-counts`: Lists cycle count plans for warehouse.
  - `GET /api/v1/wms/warehouses/{warehouse_id}/cycle-counts/{plan_id}`: Retrieves plan details with optional `?unmask=true` supervisor query.
  - `POST /api/v1/wms/warehouses/{warehouse_id}/cycle-counts/{plan_id}/count`: Records physical count per line.
  - `POST /api/v1/wms/warehouses/{warehouse_id}/cycle-counts/{plan_id}/recount`: Triggers line recount.
  - `POST /api/v1/wms/warehouses/{warehouse_id}/cycle-counts/{plan_id}/approve`: Approves plan discrepancies.
  - `POST /api/v1/wms/warehouses/{warehouse_id}/cycle-counts/{plan_id}/reconcile`: Executes atomic ledger reconciliation.

- **Frontend User Experience (`src/components/wms/WmsStudioTab.tsx`)**:
  - Added mode toggle button between **Physical Bin Cycle Count** and **Legacy Batch Stocktake**.
  - Cycle count plan creation modal supporting Zone filtering (`PICKING`, `BULK`, `STORAGE`, `QUARANTINE`), Aisle code, and Blind Mode toggle.
  - Line-level barcode input with optical scan verification and discrepancy reason selector (`MATCHED`, `DAMAGED`, `EXPIRED`, etc.).
  - Blind audit unmask toggle (`Eye` / `EyeOff` icons) for supervisors.
  - Supervisor approval modal with audit note capture and warning banners.
  - Atomic ledger reconciliation button with instant movement summary toast.

- **Automated Verification**:
  - `backend/tests/test_wms_cycle_counting.py`: 9 comprehensive test cases (100% green).
  - Full WMS regression suite across all 9 test suites.
  - Zero TypeScript compilation errors (`tsc --noEmit`).

---

## 3. Files Created
1. `backend/tests/test_wms_cycle_counting.py`: Comprehensive test suite testing plan creation, zone scoping, blind audit masking, barcode verification, threshold escalation, recount workflows, approval blocking, atomic bin ledger reconciliation, and API router endpoints.
2. `docs/implementation/wms/WMS_Phase6_Cycle_Counting_Blind_Audits_And_Reconciliation_Plan_v3.131.0.md`: Formal 19-section IPGP implementation plan.
3. `docs/walkthrough/wms/WMS_Phase6_Cycle_Counting_Blind_Audits_And_Reconciliation_v3.131.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/wms.py`: Added 10 cycle counting Pydantic schemas.
2. `backend/app/services/inventory_wms.py`: Added 8 cycle counting domain service functions in `InventoryWmsService`.
3. `backend/app/api/v1/wms.py`: Added 7 REST API endpoints under `/warehouses/{warehouse_id}/cycle-counts`.
4. `src/components/wms/WmsStudioTab.tsx`: Added Physical Bin Cycle Count mode switcher, plan creation, scan entry, recount actions, supervisor approval, and ledger reconciliation buttons.
5. `docs/implementation/README.md`: Added v3.131.0 Phase 6 row to the master implementation plan index.
6. `docs/walkthrough/README.md`: Added v3.131.0 Phase 6 row to the master walkthrough index.
7. `CHANGELOG.md`: Added v3.131.0 release entry.
8. `RELEASE_NOTES.md`: Added v3.131.0 release notes.

---

## 5. Architecture Decisions

### 1. Physical Bin (`WarehouseLocation`) Scoping vs Batch Stock
In earlier versions, stocktaking operated purely at the broad SKU/Batch level without spatial bin context. Phase 6 directly queries `WarehouseLocation` (`backend/app/models/inventory.py`), matching physical spatial dimensions (`zone`, `aisle`, `rack`, `shelf`, `code`). This ensures auditors are directed to exact physical shelf locations, enabling micro-auditing of individual picking faces or bulk storage aisles without halting warehouse operations.

### 2. Statutory Blind Audit Masking Engine
To adhere to strict internal audit standards and prevent "lazy confirmation" (where counters visually verify whatever number the screen shows), `is_blind=True` plans mask `system_qty`, `variance_qty`, and `variance_val` by returning `None` to the client. The system quantity is only revealed once the counter has committed an initial physical count or if an authorized supervisor queries the plan with `unmask=True`.

### 3. Automated Two-Tier Variance Thresholding
Counts are classified in real time against dual thresholds:
- **Relative Variance:** `abs(variance_qty) / system_qty > threshold_qty_pct` (default: 5%)
- **Absolute Discrepancy Value:** `abs(variance_val) > threshold_val` (default: ₹1,000.00)

If either threshold is violated:
- Line item is flagged with `is_approval_required = True` and `approval_status = "PENDING"`.
- Overall plan status escalates to `PENDING_APPROVAL`.
- Reconciliation is strictly blocked until an authorized manager executes `approve_cycle_count`.

### 4. Atomic Ledger Posting with Bin Symmetry
When reconciling a cycle count plan, adjustments are posted directly to `stock_movements`:
- **Surplus (`variance_qty > 0`)**:
  - `movement_type = "INWARD_SURPLUS"`
  - `quantity = +abs(variance_qty)`
  - `bin = item.location_code`
  - `reference_doc_type = "WMS_CYCLE_COUNT"`
- **Shrinkage/Loss (`variance_qty < 0`)**:
  - `movement_type = "OUTWARD_LOSS"`
  - `quantity = -abs(variance_qty)`
  - `bin = item.location_code`
  - `reference_doc_type = "WMS_CYCLE_COUNT"`

This preserves full double-entry balance and ensures the physical bin ledger exactly matches real shelf stock.

---

## 6. Design Rationale
- **Zero Interruption Stocktaking**: Full-warehouse stocktakes require shutting down retail fulfillment for days. Zone-based cycle counting allows perpetual counting of fast-moving picking bins during active shifts.
- **Fail-Closed Discrepancy Safety**: High-value inventory losses (theft, misplacement) cannot be quietly wiped out by floor counters; the mandatory supervisor approval gate prevents unauthorized reconciliation.
- **Auditable Recounts**: Rather than immediately writing off a mismatch, counters can request a recount, prompting a senior auditor to re-verify the shelf before triggering ledger postings.

---

## 7. Implementation Summary

### REST Endpoints
| HTTP Method | Route | Description | Status Code |
|---|---|---|---|
| `POST` | `/api/v1/wms/warehouses/{id}/cycle-counts` | Create zone/aisle/bin cycle count plan | 201 Created |
| `GET` | `/api/v1/wms/warehouses/{id}/cycle-counts` | List all cycle count plans | 200 OK |
| `GET` | `/api/v1/wms/warehouses/{id}/cycle-counts/{plan_id}` | Get plan details (optional `?unmask=true`) | 200 OK |
| `POST` | `/api/v1/wms/warehouses/{id}/cycle-counts/{plan_id}/count` | Record optical barcode scan & physical count | 200 OK |
| `POST` | `/api/v1/wms/warehouses/{id}/cycle-counts/{plan_id}/recount` | Trigger secondary recount round | 200 OK |
| `POST` | `/api/v1/wms/warehouses/{id}/cycle-counts/{plan_id}/approve` | Supervisor approval for high variances | 200 OK |
| `POST` | `/api/v1/wms/warehouses/{id}/cycle-counts/{plan_id}/reconcile` | Post atomic bin-level stock movements | 200 OK |

---

## 8. Tests Executed
The test suite `backend/tests/test_wms_cycle_counting.py` covers 9 distinct scenarios:
1. `test_cycle_count_create_plan_zone_filtering`: Validates zone-filtered bin resolution and plan initialization.
2. `test_cycle_count_blind_mode_masks_system_qty`: Verifies that blind audit mode suppresses expected quantities until unmasked.
3. `test_cycle_count_record_item_count_matched`: Verifies zero-variance count recording with automatic approval.
4. `test_cycle_count_record_item_threshold_violation_triggers_approval`: Verifies that variance exceeding ₹1,000 or 5% flags `APPROVAL_REQUIRED` and moves plan to `PENDING_APPROVAL`.
5. `test_cycle_count_mismatched_barcode_rejected`: Validates optical barcode verification rejecting wrong items with HTTP 400.
6. `test_cycle_count_recount_workflow`: Tests recount status resets and secondary counting rounds.
7. `test_cycle_count_reconcile_blocked_when_unapproved`: Verifies fail-closed safety blocking reconciliation of pending variance plans.
8. `test_cycle_count_approve_and_reconcile_posts_bin_movements`: Validates supervisor approval flow and atomic `StockMovement` ledger entry creation.
9. `test_cycle_count_api_router_endpoints`: Tests end-to-end FastAPI router endpoints via direct function calls.

---

## 9. Verification Results
- **Pytest**: 9/9 passed in `backend/tests/test_wms_cycle_counting.py`.
- **TypeScript**: 0 compilation errors (`npx tsc --noEmit`).
- **Regression**: 100% green across all 9 WMS test suites.

---

## 10. Known Limitations
- Floor counters currently perform barcode scans sequentially line-by-line; RFID bulk tunnel portal multi-tag reads for cycle counting will be integrated in Phase 7.
- Cycle counting plans are currently stored in tenant-isolated resilient memory registry; persistent table migration will follow once transaction volume is benchmarked.

---

## 11. Future Work
- **Phase 7: Mobile RFID Tunnel & Gate Scanning**: Automated portal scanning of entire pallet bins during cycle count sweeps.
- **Phase 8: ABC Velocity Cycle Count Scheduling**: Automated scheduling algorithm prioritizing Class A items (weekly), Class B (monthly), and Class C (quarterly).

---

## 12. Related ADRs
- `ADR-0042`: WMS Spatial Hierarchy & Multi-Tier Location Matrix Architecture.
- `ADR-0058`: Strangler-Fig FastAPI Sovereign Backend & Dual-Leg Ledger Symmetry.

---

## 13. Related RFCs
- `RFC-0118`: Warehouse Physical Cycle Counting & Blind Inventory Auditing Protocol.
- `RFC-0125`: High-Density Warehouse Operations & Handheld Terminal Protocols.
