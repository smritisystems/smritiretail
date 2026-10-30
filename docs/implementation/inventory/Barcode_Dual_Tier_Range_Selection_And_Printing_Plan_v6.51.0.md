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

# Implementation Plan: Dual-Tier Range Selection & Printing Engine (v6.51.0)

## 1. Objective
Implement a high-speed, dual-tier range filtering and selection engine in the Tag & Barcode Label Printing Studio allowing operators to select and print labels based on Barcode sequences, Style Code series, SKU numbers, S.No row sequences, and MRP price bands.

## 2. Business Motivation
Retail warehouse receiving and store floor pricing frequently handle batches of sequential barcodes (e.g. 50 labels on a roll) or style families (e.g. Footwear article CH-10 through CH-30). Manually selecting products or relying solely on single SKU filters is slow, error-prone, and hinders store efficiency during rush hours and physical stock audits.

## 3. Scope
- Step 1 (Selection Criteria) Catalog Range Filtering for Barcodes, Styles, and MRP.
- Step 3 (Loaded Items Data Grid) In-Grid Range Selection Toolbar & Batch Quantity update.
- Natural comparison algorithms (`BigInt` numeric barcodes, alphanumeric style collation).
- Keyboard shortcut `Alt+R` for rapid toggle.

## 4. Current State
- `ItemMasterSelectionCriteria` only supported `stockNoFrom` / `stockNoTo`.
- Barcode only supported an exact single scan input.
- Style only supported multi-select dropdown chips.
- Grid toolbar only provided "Set All to 1" and "Set All to Stock".

## 5. Gap Analysis
- Missing Barcode sequential range bounds (`barcodeFrom` → `barcodeTo`).
- Missing Style Code range bounds (`styleFrom` → `styleTo`).
- Missing MRP price range bounds (`mrpFrom` → `mrpTo`).
- Missing in-grid range isolation and batch quantity update tools.

## 6. Architecture Impact
- Modularized range comparison logic into `src/components/barcode/rangeFilter.ts`.
- Preserved backward compatibility across all existing filter props and data rows.
- Zero changes required to backend database schemas.

## 7. Proposed Design
- **Tier 1 (Catalog Filter):** Extends Step 1 with a collapsible "Natural Range Filters" panel. Active filters render removable chip badges.
- **Tier 2 (Grid Batch Operations):** Adds an interactive toolbar bar in Step 3 allowing selection or label count updates across any loaded dataset.

## 8. Files Created
- `src/components/barcode/rangeFilter.ts`
- `src/tests/rangeFilter.test.ts`

## 9. Files Modified
- `src/components/barcode/types.ts`
- `src/components/barcode/TagLabelPrintingTa.tsx`

## 10. Dependencies
- `lucide-react` (`SlidersHorizontal`, `Filter`, `RotateCcw`)
- `vitest`

## 11. Risks
- Lexicographical comparison of numeric barcodes could order `890100000010` before `890100000005`.
- *Mitigation:* Implemented `BigInt` digit parsing in `compareNatural` and `isWithinRange`.

## 12. Rollback Strategy
- Revert changes to `TagLabelPrintingTa.tsx` and `types.ts` via `git restore`.

## 13. Verification Plan
- Unit tests for all range permutations (barcode, style, SKU, S.No, MRP).
- TypeScript static typecheck (`npx tsc --noEmit`).
- Production build compilation (`npm run build`).

## 14. Test Plan
- `src/tests/rangeFilter.test.ts` (13 tests)
- `src/tests/tagPrinting.test.ts` (22 tests)
- `src/tests/prnInterpolation.test.ts` (7 tests)
- `src/tests/printLabelsStudio.test.ts` (23 tests)

## 15. Documentation Impact
- Created `docs/walkthrough/barcode/Barcode_Dual_Tier_Range_Selection_And_Printing_Walkthrough_v6.51.0.md`.
- Updated `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Appended `CHANGELOG.md` under `[6.51.0]`.

## 16. Deployment Plan
- Frontend client-side deployment via standard Vite build bundle (`dist/assets/smriti-barcode-studio-*.js`).

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: SMRITI Enterprise Barcode Label Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/barcode/Barcode_Dual_Tier_Range_Selection_And_Printing_Walkthrough_v6.51.0.md`
