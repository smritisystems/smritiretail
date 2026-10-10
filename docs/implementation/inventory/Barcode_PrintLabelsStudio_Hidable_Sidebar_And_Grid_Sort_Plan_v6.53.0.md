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

# Implementation Plan: SMRITI Print Labels Studio Hidable Right Sidebar, Collapsible Step 1 & Interactive Grid Sorting / Column Filters (v6.53.0)

## 1. Objective
Enhance `PrintLabelsStudio.tsx` with a hidable/collapsible right sidebar (`[Alt+S]`), collapsible Step 1 source cards, interactive grid sorting, per-column text filtering, and natural BigInt barcode range matching.

## 2. Business Motivation
Barcode printing operators work with high-density footwear and apparel size matrices. The permanent 320px right sidebar and ~115px Step 1 card stack constrained the worksheet grid, preventing operators from seeing all item codes, barcodes, and stock levels simultaneously without excessive scrolling.

## 3. Scope
- Right Sidebar collapse mechanism with `localStorage` persistence, `[Alt+S]` keyboard listener, and edge tab handle.
- Step 1 collapse mechanism saving >80px vertical height.
- Interactive sorting and per-column filtering on worksheet data grid.
- Natural barcode and style range matching using `rangeFilter.ts`.
- Deletion of duplicate/broken Advanced Filters block beneath the table footer.

## 4. Current State
`PrintLabelsStudio.tsx` loaded initial catalog items on open with zero armed labels (`selected: false`, `printQty: 0`). The right sidebar was fixed at 320px width, Step 1 was permanently expanded, the table headers were non-sortable strings, and raw string comparison was used for barcode ranges.

## 5. Gap Analysis
1. *Fixed 320px Right Sidebar:* Squeezed the 10-column table on desktop monitors.
2. *Non-Collapsible Step 1:* Consumed vertical space permanently.
3. *Missing Sorting & Per-Column Filters:* Operators had to search through pages manually.
4. *Flawed Barcode Range Logic:* Raw ASCII comparison failed on variable length or non-padded numeric barcodes.
5. *Duplicate Advanced Filters Markup:* Two filter blocks rendered simultaneously when `advOpen` was true.

## 6. Architecture Impact
Zero database schema impact. Frontend UI ergonomics and client-side sorting/filtering enhancements fully backward-compatible with existing API endpoints.

## 7. Proposed Design
- Introduce `isSidebarCollapsed` with smooth CSS width transition.
- Introduce `isStep1Collapsed` with active source summary chip.
- Introduce `sortField`, `sortAsc`, and `colFilters` driving `displayedRows` memoized array using `compareNatural` from `rangeFilter.ts`.
- Integrate `isWithinRange` into `applyFilterRules`.
- Remove duplicate filter markup below table footer.

## 8. Files Created
- `src/tests/printLabelsStudio.test.ts`
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_Hidable_Sidebar_And_Grid_Sort_Walkthrough_v6.53.0.md`
- `docs/implementation/inventory/Barcode_PrintLabelsStudio_Hidable_Sidebar_And_Grid_Sort_Plan_v6.53.0.md`

## 9. Files Modified
- `src/components/barcode/PrintLabelsStudio.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- `lucide-react` icons (`PanelRightClose`, `PanelRightOpen`, `ArrowUp`, `ArrowDown`, `ArrowUpDown`).
- `rangeFilter.ts` (`compareNatural`, `isWithinRange`).

## 11. Risks
- Potential confusion if operator collapses right sidebar and forgets where Print button is located.
  - *Mitigation:* Prominent floating `[SIDEBAR]` edge handle on the right screen edge and top header toggle button with `[Alt+S]` badge.

## 12. Rollback Strategy
Git revert commit to restore original layout if needed.

## 13. Verification Plan
1. Vitest unit tests in `src/tests/printLabelsStudio.test.ts`.
2. TypeScript compilation check (`npx tsc --noEmit`).
3. Production bundle build (`npm run build`).

## 14. Test Plan
- Test zero-armed defaults on initialization.
- Test BigInt barcode range boundaries.
- Test natural style collation.
- Test stock and printQty numerical sorting.
- Test per-column substring filtering.

## 15. Documentation Impact
- Updated Walkthrough index.
- Updated Implementation Plan index.
- Updated CHANGELOG.md.

## 16. Deployment Plan
Commit and push directly to `origin/smritiNX`. Pull to test environments as needed.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: Zero-Armed Hardware Spool Safety in Label Studio
- `ADR-0043`: Natural Alphanumeric and BigInt Range Evaluation Engine

## 19. Related Walkthroughs
- `Barcode_PrintLabelsStudio_Hidable_Sidebar_And_Grid_Sort_Walkthrough_v6.53.0.md`
