<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.51.0
  Created      : 2026-10-10
  Modified     : 2026-10-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Dual-Tier Range Selection & Printing Engine (v6.51.0)

## 1. Purpose
Empower retail warehouse and store operators to filter, isolate, and print tag/barcode labels across flexible sequential ranges (From → To) based on Barcode sequences, Style Code series, SKU numbers, S.No row sequences, and MRP price bands, eliminating tedious row-by-row manual selection.

## 2. Scope
- **Domain:** Barcode & Tag Label Printing Studio (`TagLabelPrintingTa.tsx`).
- **Data Model:** Extended `ItemMasterSelectionCriteria` with `barcodeFrom`, `barcodeTo`, `styleFrom`, `styleTo`, `mrpFrom`, `mrpTo` in `types.ts`.
- **Core Engine:** Created standalone `src/components/barcode/rangeFilter.ts` delivering natural alphanumeric and numeric range evaluation.
- **UI Enhancements:**
  - **Tier 1 (Catalog Filter):** Integrated collapsible "Natural Range Filters" panel in Step 1 (Selection Criteria) with interactive chip indicators.
  - **Tier 2 (Grid Batch Operations):** Added interactive "Select by Range (Alt+R)" toolbar and action panel in Step 3 (Loaded Items Data Grid) with batch quantity assignment.
- **Verification:** 13/13 unit tests in `src/tests/rangeFilter.test.ts`, 22/22 tests in `src/tests/tagPrinting.test.ts`, 7/7 in `prnInterpolation.test.ts`, 23/23 in `printLabelsStudio.test.ts`, 0 TypeScript compiler errors, and successful production build.

## 3. Files Created
1. `src/components/barcode/rangeFilter.ts` — Standalone natural comparison and range evaluation engine (`compareNatural`, `isWithinRange`, `filterRowsByItemMasterCriteria`, `filterRowsByGridRange`).
2. `src/tests/rangeFilter.test.ts` — Comprehensive Vitest test suite with 13 unit tests certifying natural alphanumeric style sorting, numeric barcode bounding, MRP ranges, and grid range selection.

## 4. Files Modified
1. `src/components/barcode/types.ts` — Added `GridRangeField` union type and expanded `ItemMasterSelectionCriteria` with range bounds.
2. `src/components/barcode/TagLabelPrintingTa.tsx` — Wired `rangeFilter.ts`, added Tier 1 Range Filter section in Step 1, active range chips, Tier 2 in-grid range toolbar with batch quantity updating, and `Alt+R` keyboard shortcut.

## 5. Architecture Decisions
1. **Dual-Tier Processing Architecture:**
   - *Tier 1 (Pre-Load Filtering):* Filters items from the master catalog before populating the print queue using `filterRowsByItemMasterCriteria`.
   - *Tier 2 (Post-Load In-Grid Selection):* Operates directly on the already loaded table rows (`filterRowsByGridRange`), enabling operators to isolate sub-ranges and update label quantities on any source (PT files, GRN transactions, or PDT files).
2. **BigInt / Natural Alphanumeric Comparison:**
   - 12-digit and 13-digit EAN barcodes are compared numerically via `BigInt` when pure digits are present, preventing lexical distortion where `890100000010` would incorrectly compare against `890100000005`.
   - Alphanumeric style codes (e.g., `CH-10-A`, `CH-20-C`, `CH-30-K`) are sorted via `localeCompare(..., { numeric: true, sensitivity: 'base' })`.
3. **Open-Ended Boundary Evaluation:**
   - If either `fromVal` or `toVal` is omitted, the boundary is treated as open-ended (`val >= from` or `val <= to`), allowing one-sided queries like "All barcodes starting from 890100000005 onwards".

## 6. Design Rationale
In high-volume retail stores, label printing is usually triggered by specific operational events:
- A new delivery of a footwear collection arrives spanning styles `CH-10-A` through `CH-30-K`.
- A roll of 50 pre-sequenced barcode labels is applied in sequence (`890100000001` to `890100000050`).
- A clearance discount is applied to all items with MRP between ₹500 and ₹1,500.
Providing both pre-filter criteria and on-the-fly grid range tools delivers maximum velocity for retail cashier-operators without modifying the underlying database structure.

## 7. Implementation Summary
- `compareNatural(a, b)`: Handles pure digits using `BigInt` and alphanumeric tokens using numeric collation.
- `isWithinRange(val, from, to, mode)`: Evaluates inclusive ranges across `numeric`, `text`, `barcode`, and `style` modes.
- `filterRowsByItemMasterCriteria(rows, criteria)`: Evaluates complete multi-constraint criteria with natural range bounds.
- `filterRowsByGridRange(rows, field, from, to)`: Evaluates active table rows for in-grid selection by `barcode`, `style`, `stockNo`, `sNo`, or `mrp`.
- `TagLabelPrintingTa.tsx`:
  - Step 1: Added collapsible natural range section with real-time active badges and 1-click `Clear Ranges`.
  - Step 3: Added `Select by Range (Alt+R)` button, inline target dropdown, range inputs, matching count badge, `Select Range Only`, `+ Add to Selection`, `- Deselect Range`, and `Set Qty for Range`.

## 8. Tests Executed
```powershell
npx vitest run src/tests/rangeFilter.test.ts src/tests/tagPrinting.test.ts src/tests/prnInterpolation.test.ts src/tests/printLabelsStudio.test.ts
npx tsc --noEmit
npm run build
```

## 9. Verification Results
- **Vitest Range Suite:** 13/13 tests green in `src/tests/rangeFilter.test.ts`.
- **Vitest Regression Suites:** 22/22 green in `tagPrinting.test.ts`, 7/7 green in `prnInterpolation.test.ts`, 23/23 green in `printLabelsStudio.test.ts` (Total 65/65 tests passed).
- **TypeScript Static Analysis:** 0 errors across monorepo via `npx tsc --noEmit`.
- **Production Build:** Succeeded via Vite 5.4.21 transforming 3,703 modules in 1m 18s.

## 10. Known Limitations
- Pure numeric barcode comparison requires inputs to consist strictly of digits; alphanumeric custom barcodes fall back to natural string collation.

## 11. Future Work
- Add multi-column range compound expressions (e.g., "Style CH-10-A to CH-30-K AND Size 38 to 42").
- Support F2 lookup popups on range boundary inputs.

## 12. Related ADRs
- `ADR-0042`: SMRITI Enterprise Barcode Label Architecture.
- `ADR-0068`: Client-Side Universal Token Interpolation.

## 13. Related RFCs
- `RFC-2026-08-PRN`: High-Speed POS Thermal Barcode Spooling Protocol.
