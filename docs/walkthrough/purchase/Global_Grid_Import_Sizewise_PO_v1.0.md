<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.58.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — SMRITI Global Grid Input & Import Standard Rollout: Sizewise Purchase Order Matrix

**Topic:** Procurement & Merchandising — Sizewise Purchase Order Studio (`PoSizewiseTab.tsx`) Global Grid Import & Clipboard Paste  
**Version:** `v6.58.0`  
**Area:** `purchase`  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Purpose
The objective of this phase (`Phase 33`, `v6.58.0`) is to eliminate fragmented, naive spreadsheet parsing in the commercial Footwear & Apparel **Sizewise Purchase Order Matrix** (`PoSizewiseTab.tsx`). Prior to this upgrade, importing items into a purchase order relied on a hardcoded CSV string split (`cols = r.split(",")`) that failed on Excel/Google Sheets clipboard data (TSV), ignored quotes containing commas, assumed fixed column offsets (`cols[2 + sizes.length]`), and bypassed catalog product resolution entirely. This phase converges `PoSizewiseTab.tsx` onto the centralized **SMRITI Global Grid Input & Import Standard**, introducing direct clipboard paste (`Ctrl+V`) on the table container, batch catalog product resolution (`POST /api/v1/products/batch-resolve`), and intelligent retail size curve distribution (`recommendSizeAssortment`) for flat barcode/item scan feeds.

---

## 2. Scope
- **Target Surface:** `src/components/purchase/PoSizewiseTab.tsx` (Footwear & Apparel Sizewise Purchase Order Matrix).
- **Core Integrations:**
  - `GlobalGridImportModal` configured with `GRID_PROFILES.PURCHASE`.
  - Pure mapping utility `mapParsedGridRowsToSizewiseLines` supporting both explicit sizewise matrix columns (e.g. `S`, `M`, `L` or `6`, `7`, `8`) and flat rows with Gaussian retail bell-curve assortment distribution.
  - Multi-mode line merge utility `mergeSizewisePOLines` supporting `APPEND`, `MERGE` (combining quantities across sizes and re-computing line net totals), and `REPLACE` modes.
  - Table wrapper clipboard paste interceptor (`onPaste={handleTableContainerPaste}`) routing multi-line or delimited text (`\t`, `,`, `~`, `|`) directly into `GlobalGridImportModal` with pre-loaded content.
  - Modernized "Global Import" triggers on the primary toolbar, empty state card, and visual lookbook sub-tab.
  - Legacy file picker adapter forwarding selected file contents into `GlobalGridImportModal`.
- **Out of Scope:** Modifications to backend purchase order persistence (`backend/app/api/v1/purchase.py` already supports multi-line POs).

---

## 3. Files Created
- `docs/walkthrough/purchase/Global_Grid_Import_Sizewise_PO_v1.0.md`: Formal 13-section walkthrough.

---

## 4. Files Modified
- `src/components/purchase/PoSizewiseTab.tsx`:
  - Imported `GlobalGridImportModal`, `GRID_PROFILES`, `ParsedGridRow`, and `GridImportMode`.
  - Exported pure functions `mapParsedGridRowsToSizewiseLines` and `mergeSizewisePOLines`.
  - Added `isGlobalImportOpen` and `initialImportText` state variables.
  - Implemented `handleGlobalGridImportCommit` with full line calculation.
  - Implemented `handleTableContainerPaste` on the grid container.
  - Updated toolbar, empty state, and lookbook action buttons to "Global Import".
  - Mounted `<GlobalGridImportModal>` with `GRID_PROFILES.PURCHASE`.
- `src/tests/poSizewiseUX.test.ts`:
  - Added Unit Tests 35–38 covering explicit size parsing, Gaussian curve distribution, product resolution metadata mapping, and merge modes (`APPEND`, `MERGE`, `REPLACE`).
- `package.json`: Version bumped to `6.58.0`.
- `src/config/version.ts`: Version bumped to `6.58.0`.
- `backend/app/core/config.py`: Version bumped to `6.58.0`.
- `CHANGELOG.md`: Added release notes for `[6.58.0]`.
- `docs/walkthrough/README.md`: Registered walkthrough entry for `v6.58.0`.
- `docs/implementation/inventory/Global_Grid_Input_And_Import_Standard_Plan_v1.0.md`: Updated with Phase 33 details.

---

## 5. Architecture Decisions
1. **Dual Column Matching Paradigm (Explicit Sizes vs Assortment Curve):**
   - When vendors provide pre-sized matrices (e.g., column headers matching active scale sizes `6`, `7`, `8`, `9`, `10`), `mapParsedGridRowsToSizewiseLines` extracts exact counts per size.
   - When importing standard product lists or PDT barcode scans with only total quantities (e.g. `barcode`, `qty`, `costPrice`), the engine utilizes `recommendSizeAssortment(sizes, totalQty, "bell")` to distribute the target quantity across the active footwear/apparel size run.
2. **Authoritative Master Catalog Resolution:**
   - Instead of admitting unverified text strings, imported rows undergo batch resolution via `POST /api/v1/products/batch-resolve` to retrieve canonical SKU, description, brand, style, and standard cost prices before commitment.
3. **Ergonomic Direct Clipboard Paste:**
   - Merchandisers can simply copy tabular cells from Excel or Google Sheets and press `Ctrl+V` on the matrix workspace without locating a file or navigating dialogs.

---

## 6. Design Rationale
- **Zero Raw Exceptions (HREP):** Replaced silent parsing failures and naive index lookups with structured validation status badges and friendly notifications.
- **Merge Integrity:** In `MERGE` mode, when duplicate items exist, size quantities are accumulated on a per-size basis rather than blindly overwriting the line.

---

## 7. Implementation Summary
```typescript
// PoSizewiseTab.tsx - Universal Grid Import Handler
const handleGlobalGridImportCommit = (
  committedRows: ParsedGridRow[],
  mode: GridImportMode
) => {
  const incomingLines = mapParsedGridRowsToSizewiseLines(
    committedRows,
    sizes,
    header.deliveryDate,
    header.commonTaxPercent,
    mode === "REPLACE" ? 0 : lines.filter((l) => l.itemCode).length
  );

  const updatedLines = mergeSizewisePOLines(lines, incomingLines, mode, sizes);
  setLines(updatedLines);
  setIsGlobalImportOpen(false);
  setInitialImportText(undefined);
  onNotification?.(
    "Import Successful",
    `Processed ${committedRows.length} item(s) into Purchase Order (${mode} mode).`,
    "success"
  );
};
```

---

## 8. Tests Executed
1. **Frontend Vitest Suite (`src/tests/poSizewiseUX.test.ts`):**
   - 38/38 unit tests passed including new tests 35–38.
2. **Frontend Engine Suite (`src/tests/globalGridInputEngine.test.ts`):**
   - 19/19 tests passed.
3. **Backend Batch Resolution Suite (`backend/tests/test_batch_product_resolution.py`):**
   - 5/5 tests passed.
4. **TypeScript Compiler Check (`npx tsc --noEmit`):**
   - Exited with code 0 (0 errors).
5. **Version SSOT Validation (`scripts/validate_version_ssot.py`):**
   - All 4 SSOT boundaries verified at `6.58.0`.

---

## 9. Verification Results
- **Evidence Level:** Level A (Verifiable code diffs, literal test execution outputs, zero compilation errors).
- **Status:** Done.

---

## 10. Known Limitations
- Import of multi-color assortment pre-packs with custom size ratios currently defaults to the standard retail Bell Curve unless explicit per-size columns are present in the source spreadsheet.

---

## 11. Future Work
- Support vendor EDI 850 / 855 electronic order ingestion through the same grid resolution pipeline.

---

## 12. Related ADRs
- `ADR-0042`: Centralized Product Identity & Resolution Architecture.
- `ADR-0056`: SMRITI Universal Grid Input & Paste Standard.

---

## 13. Related RFCs
- `RFC-2026-GRID-INPUT-01`: Enterprise Spreadsheet Ingestion and Batch Product Resolution.
