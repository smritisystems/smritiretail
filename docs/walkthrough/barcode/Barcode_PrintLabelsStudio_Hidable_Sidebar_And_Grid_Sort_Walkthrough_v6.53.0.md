<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.53.0
  Created      : 2026-10-10
  Modified     : 2026-10-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Print Labels Studio Hidable Right Sidebar, Collapsible Step 1 & Interactive Grid Sorting / Column Filters (v6.53.0)

## 1. Purpose
In SMRITI Retail OS Barcode Studio (`PrintLabelsStudio.tsx`), printing operators running on standard retail desktop monitors (1366x768 to 1920x1080) previously experienced horizontal and vertical view compression. The right sidebar (containing Label Preview, Pre-Print Sanitizer, Print Summary, Recent Jobs, and Print Action buttons) consumed 320px (`w-72 xl:w-80`) permanently, forcing the 10-column worksheet table into narrow constraints. Concurrently, Step 1 (Choose Source) consumed ~115px vertical height, and the table lacked interactive sorting, per-column searching, and natural BigInt range comparison.

This release harmonizes `PrintLabelsStudio.tsx` with `TagLabelPrintingTa.tsx`, introducing:
1. **Collapsible Right Sidebar** with top header toggle, `[Alt+S]` keyboard shortcut, floating right edge tab handle, and `localStorage` persistence, enabling the table to expand to 100% full screen width.
2. **Collapsible Step 1 (Choose Source)** allowing operators to collapse the 6 large source tiles into a sleek 1-line active source chip, reclaiming >80px vertical space.
3. **Interactive Grid Sorting & Inline Column Filtering** across Item Code, Product, Brand, Style, Shade, Size, Barcode, Stock, and Print Qty with natural alphanumeric collation.
4. **Natural Barcode Range Filtering** via `rangeFilter.ts` using BigInt/numeric matching instead of ASCII string comparison.
5. **Deduplication of Advanced Filters Markup** eliminating redundant duplicate filters below the table footer.

---

## 2. Scope
- `src/components/barcode/PrintLabelsStudio.tsx`:
  - Added `isSidebarCollapsed` state with `localStorage` key `'smriti_print_studio_sidebar_collapsed'` and `[Alt+S]` shortcut.
  - Added header toggle button `[Hide Sidebar] / [Show Sidebar]` with badge.
  - Added floating edge tab handle `[SIDEBAR]` on the right border when collapsed.
  - Added `isStep1Collapsed` state to collapse 6 source tiles into an informative 1-line chip.
  - Consolidated Step 2 Advanced Filters to include Brand, Style, Item Code Range, and Barcode Range with natural range evaluation.
  - Added interactive column headers with sort direction indicators (`ArrowUp`, `ArrowDown`, `ArrowUpDown`).
  - Added inline column filter row for real-time live filtering across all table columns.
  - Styled Barcode column with crisp monospace badges.
  - Removed dead/duplicate Advanced Filters block below the table footer.
- `src/tests/printLabelsStudio.test.ts`:
  - Added 8 automated unit tests covering zero-armed printing defaults, BigInt barcode ranges, natural style collation, grid sorting, and column filtering.

---

## 3. Files Created
- `src/tests/printLabelsStudio.test.ts`
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_Hidable_Sidebar_And_Grid_Sort_Walkthrough_v6.53.0.md`
- `docs/implementation/inventory/Barcode_PrintLabelsStudio_Hidable_Sidebar_And_Grid_Sort_Plan_v6.53.0.md`

---

## 4. Files Modified
- `src/components/barcode/PrintLabelsStudio.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

---

## 5. Architecture Decisions
1. **Zero-Armed Printing Safety Contract:**
   - Unlike legacy systems where loading rows automatically selects all items and sets quantities to 1, `PrintLabelsStudio.tsx` defaults all rows to `selected: false` and `printQty: 0`. The printer hardware remains zero-armed on startup and upon clearing filters.
2. **Natural / BigInt Range Parsing:**
   - Barcode ranges (`filters.barcodeFrom`, `filters.barcodeTo`) use `isWithinRange(..., 'barcode')` from `rangeFilter.ts`, parsing digits via `BigInt` to avoid ASCII lexicographic errors on numeric EAN-13 barcodes.
3. **Decoupled View Width Transitions:**
   - Right sidebar uses `transition-all duration-200` with `w-0 opacity-0 pointer-events-none` when collapsed, allowing seamless expand/collapse without React re-mount glitches or state loss.
4. **Natural Collation Grid Sorting:**
   - Table sorting uses `compareNatural` for alphanumeric tokens (`CH-01-A-CREAM-36` < `CH-01-A-CREAM-37`), guaranteeing logical sequence sorting.

---

## 6. Design Rationale
- **Operator Velocity on High-Density Screens:** Retail barcode printing stations typically feature dense monitors where operators inspect dozens of footwear size/color variants simultaneously. Reclaiming 320px horizontal space and 80px vertical space allows the full 10-column table to display without horizontal scrolling.
- **Persistent State Across Reloads:** Storing `isSidebarCollapsed` in `localStorage` ensures that operators who prefer full-screen table editing retain their layout preference across page refreshes.

---

## 7. Implementation Summary
```typescript
// 1. Sidebar Collapse State & Keyboard Shortcut
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
  try {
    return localStorage.getItem('smriti_print_studio_sidebar_collapsed') === 'true';
  } catch {
    return false;
  }
});

// 2. Natural Sorting & Column Filters Memoization
const displayedRows = useMemo(() => {
  let list = rows;
  if (hasActiveColFilters) {
    list = list.filter(r => { /* per-column substring checks */ });
  }
  if (sortField) {
    list = [...list].sort((a, b) => {
      // Numerical for stock & printQty, compareNatural for strings
    });
  }
  return list;
}, [rows, colFilters, hasActiveColFilters, sortField, sortAsc]);
```

---

## 8. Tests Executed
```bash
npx vitest run src/tests/printLabelsStudio.test.ts src/tests/rangeFilter.test.ts
```
**Literal Console Output:**
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/printLabelsStudio.test.ts (8 tests) 23ms
 ✓ src/tests/rangeFilter.test.ts (13 tests) 29ms

 Test Files  2 passed (2)
      Tests  21 passed (21)
   Start at  21:16:02
   Duration  514ms (transform 78ms, setup 0ms, import 148ms, tests 52ms, environment 0ms)
```

TypeScript type-check:
```bash
npx tsc --noEmit
# Exit Code: 0 (Zero errors)
```

Vite production build:
```bash
npm run build
# Exit Code: 0 (Built in 1m 2s, 3,703 modules transformed)
```

---

## 9. Verification Results
- **Evidence Level:** A (Direct CLI Execution, 21/21 Unit Tests Green, 0 Type Errors, Clean Production Build).
- **Verification Status:** `Done`

---

## 10. Known Limitations
- When the right sidebar is collapsed, the Live Pre-Print Sanitizer and Print Summary are hidden; operators expand the sidebar via `[Alt+S]` or the floating edge handle prior to clicking Print.

---

## 11. Future Work
- Add keyboard hotkey `[F8]` to trigger Print Labels directly when at least one label is armed.
- Add multi-column compound sorting.

---

## 12. Related ADRs
- `ADR-0042`: Zero-Armed Hardware Spool Safety in Label Studio
- `ADR-0043`: Natural Alphanumeric and BigInt Range Evaluation Engine

---

## 13. Related RFCs
- `RFC-2026-BARCODE-08`: Responsive Multi-Axis Ergonomics for Industrial Thermal Labeling
