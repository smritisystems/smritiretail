<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI 9 Purchase Order & Size Pivot Terminal Replacement

## 1. Purpose
This walkthrough documents the complete replacement of legacy Purchase Studio interfaces with the official **SMRITI 9 Purchase Order Generation & Size Pivot Terminal** (`F:\SMRITI\Purchase Order\stitch_invoice_management_system`).

## 2. Scope
- Purchase Order Generation master terminal (`src/components/purchase/PurchOrderGenTab.tsx`).
- Type contracts for PO Header, Line Items, Size Pivot Rows, and Summary Totals (`src/components/purchase/types.ts`).
- F2 Stock Items Browse Modal overlay (`src/components/purchase/PurchProductBrowse.tsx`).
- Re-export and route integration in `src/components/PurchaseStudioTab.tsx`.
- Automated regression test suite (`src/tests/poGenerate.test.ts`).

## 3. Files Created
- `src/components/purchase/types.ts`: TypeScript contracts for `PurchaseOrderHeader`, `PurchaseOrderLineItem`, `PurchaseOrderSizePivotRow`, and `PurchaseOrderSummaryTotals`.
- `src/components/purchase/PurchProductBrowse.tsx`: Keyboard-driven modal for browsing and selecting catalog stock items (`F2`).
- `src/components/purchase/PurchOrderGenTab.tsx`: Master terminal supporting Document & Supplier header, Picture thumbnail box, Standard line item grid, Size Pivot matrix grid, live summary counters, action bar, operational buttons, and backend persistence.
- `src/tests/poGenerate.test.ts`: Automated regression tests for line item calculations, taxes, size pivot row aggregation, and multi-line summary calculations.

## 4. Files Modified
- `src/components/PurchaseStudioTab.tsx`: Re-exports and mounts `PurchaseOrderGenerationTab`.
- `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

## 5. Architecture Decisions
1. **Dual-Mode Tactical Grid**:
   - `Standard Line Items`: Deep attribute fields (Stock No, Product, Brand, Style, Shade, Size, Fibre, Colour Base, Styling, Rate, Qty, Value, Stock on Hand, Tax %, Tax Amount, Add-on %, Add-on Amount).
   - `Size Pivot Matrix`: Footwear/Apparel size-breakdown matrix across columns `36` through `44` with real-time sum and total value calculation.
2. **Interactive Catalog Browser (F2)**: Real-time search, arrow key navigation, and Enter selection for catalog items.
3. **Persistent Transactional Backend**: Direct integration with `/api/v1/purchase/orders` in FastAPI + PostgreSQL.

## 6. Design Rationale
Faithfully reproduces the layout and aesthetics from `F:\SMRITI\Purchase Order\stitch_invoice_management_system` (`purchase_order_generation_smriti_9` and `purchase_order_size_pivot_grid_smriti_9`), retaining SMRITI 9 corporate blue accents, dense desktop tabular grids, and floating keyboard hints.

## 7. Implementation Summary
- Replaced legacy 2750-line `PurchaseStudioTab.tsx` with clean modular components in `src/components/purchase/`.
- Integrated supplier selection, delivery date, lead time days, and common tax propagation.
- Connected hotkeys: `F2 - Browse`, `F4 - Delete Row`, `F6 - Copy Previous Row`.

## 8. Tests Executed
1. `npm test` / `vitest run src/tests/poGenerate.test.ts`: 3/3 unit tests passed.
2. Full Vitest Suite: 28 test files passed (179/179 tests passed).
3. TypeScript validation: `npm run lint` (`tsc --noEmit`) returned 0 errors.
4. Production bundle build: `npm run build` completed in 20.05s with 0 errors.

## 9. Verification Results
- All unit tests and type checks passed with 100% compliance.

## 10. Known Limitations
- Size Pivot column buckets currently default to apparel/footwear sizes `36` to `44`. Dynamic size bucket profiles can be customized in the master settings.

## 11. Future Work
- Direct Electronic Data Interchange (EDI) vendor PO transmission.

## 12. Related ADRs
- `ADR-0046`: Purchase Order Tactical Grid & Matrix Architecture.

## 13. Related RFCs
- `RFC-0090`: SMRITI 9 Procurement & Size Matrix Specification.
