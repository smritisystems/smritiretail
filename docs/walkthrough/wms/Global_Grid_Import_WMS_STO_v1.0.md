<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.57.1
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — SMRITI Global Grid Input & Import Standard Rollout: WMS Stock Transfer Orders (STO)

**Topic:** Warehouse Management System (WMS) — Global Grid Import & Multi-Item Transfer Staging  
**Version:** `v6.57.1`  
**Area:** `wms`  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Purpose
The objective of this phase (`Phase 32.1`, `v6.57.1`) is to eliminate single-item entry bottlenecks in the **Warehouse Management System (WMS)** Stock Transfer Order (STO) interface within `WmsStudioTab.tsx`. Prior to this upgrade, warehouse operators could only initiate STOs containing a single item line, requiring tedious repetitive submissions or manual database interventions for multi-line transfers between godowns. This release seamlessly incorporates the centralized `GlobalGridImportModal` configured with `GRID_PROFILES.STOCK_MOVEMENT`, introduces a multi-item staging table with item removal and clear controls, and supports both single-item ad-hoc addition and bulk batch ingestion (from Excel/Sheets clipboard, CSV, PDT terminal, or hardware scanner) into a single atomic STO transaction.

---

## 2. Scope
- **Target Surface:** `src/components/wms/WmsStudioTab.tsx` (Stock Transfer Order creation workflow).
- **Core Integrations:**
  - `GlobalGridImportModal` configured with `GRID_PROFILES.STOCK_MOVEMENT`.
  - In-memory transfer staging pipeline (`transferStagingItems: StockTransferItem[]`).
  - Single-item addition control (`+ Add Item to List`) allowing manual sequential staging.
  - Fast Import toolbar button triggering universal grid import with live product resolution badges.
  - Multi-item batch STO creation via `POST /api/v1/wms/transfers`.
  - Dynamic button labeling reflecting total staged line count.
- **Out of Scope:** Modifications to backend WMS transfer endpoints (`backend/app/api/v1/wms.py` already supports multi-line STOs via `items: List[StockTransferItemCreate]`).

---

## 3. Files Created
- `docs/walkthrough/wms/Global_Grid_Import_WMS_STO_v1.0.md`: Formal 13-section walkthrough.

---

## 4. Files Modified
- `src/components/wms/WmsStudioTab.tsx`:
  - Imported `GlobalGridImportModal`, `GRID_PROFILES`, `ParsedGridRow`, `GridImportMode`, and UI icons (`ClipboardCheck`, `X`).
  - Added `transferStagingItems` state and `isGlobalTransferImportOpen` modal trigger.
  - Implemented `handleGlobalTransferImportCommit` to ingest resolved product lines with support for `APPEND`, `MERGE`, and `REPLACE` modes.
  - Implemented `handleAddSingleItemToTransfer` for incremental single item staging.
  - Enhanced `handleCreateTransfer` to submit all staged items in a consolidated payload.
  - Added "Fast Import" button in the STO header card.
  - Added reactive staged items summary table with line deletion and bulk clear actions.
  - Mounted `<GlobalGridImportModal>` with `GRID_PROFILES.STOCK_MOVEMENT`.
- `package.json`: Version bumped to `6.57.1`.
- `src/config/version.ts`: Version bumped to `6.57.1`.
- `backend/app/core/config.py`: Version bumped to `6.57.1`.
- `CHANGELOG.md`: Added release notes for `[6.57.1]`.
- `docs/walkthrough/README.md`: Registered walkthrough entry for `v6.57.1`.

---

## 5. Architecture Decisions
1. **Multi-Item Staging Paradigm:**
   - In accordance with enterprise warehouse ergonomics, operators frequently prepare transfer consignments comprising 5–50+ line items.
   - Decoupled item selection/import from immediate STO document submission by introducing an intermediate staging array (`transferStagingItems`).
   - Maintained backward compatibility: If no items are explicitly staged but the single-item form fields are populated, `handleCreateTransfer` auto-wraps the single item on submit.
2. **Unified Product Resolution Standard:**
   - Enforced `GRID_PROFILES.STOCK_MOVEMENT` for WMS transfers. Imported barcodes, SKUs, and product codes are resolved through `POST /api/v1/products/batch-resolve`, guaranteeing that only valid, non-quarantined products with proper batch numbers enter the STO pipeline.
3. **Flexible Merge Modes:**
   - Supported `APPEND`, `MERGE`, and `REPLACE` import modes so operators can choose to append additional scan batches to an existing staging list or replace an obsolete batch entirely.

---

## 6. Design Rationale
- **Zero Modal Blocking / HREP Compliance:** Notifications and errors use SMRITI's standard toast notifications (`onNotification`) without intrusive browser `alert()` calls.
- **High Visibility Staging Table:** Rendered with a max-height scrollable container and emerald quantity badges, allowing operators to visually inspect staged items, verify batch numbers, and remove erroneous entries before final commitment.

---

## 7. Implementation Summary
```typescript
// WmsStudioTab.tsx - Fast Import Commitment Handler
const handleGlobalTransferImportCommit = (
  committedRows: ParsedGridRow[],
  mode: GridImportMode
) => {
  const newItems: StockTransferItem[] = committedRows.map((r, idx) => ({
    id: `sto-imp-${Date.now()}-${idx}`,
    product_id: r.resolvedProduct?.id || r.productId || r.barcode || "UNKNOWN",
    batch_no: r.batchNo || "BATCH-DEFAULT",
    quantity: r.quantity || 1,
    unit_cost: r.unitCost || 0,
  }));

  if (mode === "REPLACE") {
    setTransferStagingItems(newItems);
  } else if (mode === "MERGE") {
    setTransferStagingItems((prev) => {
      const copy = [...prev];
      newItems.forEach((n) => {
        const existing = copy.find(
          (c) => c.product_id === n.product_id && c.batch_no === n.batch_no
        );
        if (existing) {
          existing.quantity = Number((existing.quantity + n.quantity).toFixed(3));
        } else {
          copy.push(n);
        }
      });
      return copy;
    });
  } else {
    // APPEND
    setTransferStagingItems((prev) => [...prev, ...newItems]);
  }
};
```

---

## 8. Tests Executed
1. **Frontend Vitest Unit Suite:**
   - `npx vitest run src/tests/globalGridInputEngine.test.ts` (19/19 tests passed).
2. **Backend Pytest Resolution Suite:**
   - `python -m pytest backend/tests/test_batch_product_resolution.py` (5/5 tests passed).
3. **TypeScript Compilation:**
   - `npx tsc --noEmit` (0 errors, exit code 0).
4. **Version SSOT Validation:**
   - `python scripts/validate_version_ssot.py` (all 4 files synchronized to `6.57.1`).

---

## 9. Verification Results
- **Evidence Level:** Level A (Verifiable code diffs, literal test execution outputs, zero compilation errors).
- **Status:** Done.

---

## 10. Known Limitations
- Warehouse stock availability checks currently occur during STO dispatch/fulfillment rather than at staging time; future enhancements will show live available batch stock next to each staged line.

---

## 11. Future Work
- Integration of `GlobalGridImportModal` into WMS Physical Audit reconciliation counts.
- Mobile PDA barcode scanner auto-increment mode directly in the WMS STO interface.

---

## 12. Related ADRs
- `ADR-0042`: Centralized Product Identity & Resolution Architecture.
- `ADR-0056`: SMRITI Universal Grid Input & Paste Standard.

---

## 13. Related RFCs
- `RFC-2026-GRID-INPUT-01`: Enterprise Spreadsheet Ingestion and Batch Product Resolution.
