# SMRITI Retail OS Walkthrough: Purchase Order Print Image Grid & Selective Item Imagery v1.0.0

## 1. Purpose
This walkthrough documents the design, implementation, and verification of dynamic image density controls and selective product photography printing in the Purchase Order Print Engine (`PurchaseOrderPrintA4.tsx`) and Print Preview Workspace (`POPrintPreviewModal.tsx`). It provides procurement operators with complete flexibility to print either large high-detail images (2 per row at 118px height) or compact single-page layouts (4 per row at 78px height), alongside fine-grained article selection checkboxes with quick presets (`All`, `Top 2`, `Top 4`, `None`).

## 2. Scope
- **Print Engine Template (`PurchaseOrderPrintA4.tsx`)**:
  - Extended `PurchaseOrderPrintData` with `imageColumns?: 2 | 4`.
  - Implemented responsive image container height: `118px` for 2-column mode (+28% larger visual preview) and `78px` for 4-column mode (compact single-page fit).
  - Dynamically styled card headers, attribute typography, and grid containers (`grid-cols-2` vs `grid-cols-4`).
- **Preview Modal Controls (`POPrintPreviewModal.tsx`)**:
  - Added `Grid Density` selector dropdown (`Auto`, `2 / Row (Large 118px)`, `4 / Row (Fit 1 Page)`).
  - Added interactive `Select Photos` popover checklist with fast filtering presets (`All`, `Top 2`, `Top 4`, `None`) and per-article toggle checkboxes.
  - Automatically derived non-selected items to remain purely in the tabular item details, keeping physical printouts strictly bounded to Page 1 of 1 when desired.
- **Automated Verification**:
  - Added unit test coverage in `src/tests/poPrintBrandingAndTerms.test.tsx` verifying both 2-column and 4-column rendering, container height styles, and layout badges.

## 3. Files Created
- `docs/walkthrough/purchase/Purchase_Order_Print_Image_Grid_Selection_Walkthrough_v1.0.0.md`: This 13-section WGP walkthrough document.

## 4. Files Modified
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx`: Added `imageColumns?: 2 | 4`, dynamic `118px`/`78px` container heights, and 4-column grid support.
- `src/components/purchase/POPrintPreviewModal.tsx`: Added `imageGridSetting` state, `selectedArticleCodes` state, Grid density selector, Photos selection checklist popover, and `localStorage` preference persistence (`smriti_po_image_grid_setting`, `smriti_po_item_reference_fields`).
- `src/tests/poPrintBrandingAndTerms.test.tsx`: Added test case 12 verifying dynamic image columns.
- `CHANGELOG.md`: Appended version `[6.99.5]`.
- `docs/walkthrough/README.md`: Appended index entry for `v3.137.0`.

## 5. Architecture Decisions
- **Decision 1: Dual-Density Physical Layout (2 vs 4)**: Rather than an arbitrary slider that might cause unpredictable page breaks across different printer drivers, two calibrated physical grid presets are provided: 2-per-row at 118px (optimized for visual clarity on 1-2 styles) and 4-per-row at 78px (optimized for single-page containment on 3-4 styles).
- **Decision 2: Non-Destructive Article Imagery Filtering**: Selecting which articles to print images for only filters the visual card gallery in the `ITEM REFERENCE (IMAGES)` section; the statutory tabular line items remain 100% complete and intact in the main order grid.

## 6. Design Rationale
Footwear procurement involves both artistic inspection (heels, upper finish, stitching) and logistics compactness (fitting everything on a single sheet of paper for warehouse receiving). By giving the operator direct control in the print preview bar to toggle between large 2-column presentation and compact 4-column layout or select specific articles to showcase, SMRITI Retail OS eliminates unnecessary second-page spillover while enabling high-resolution photo presentation when desired.

## 7. Implementation Summary
1. Upgraded `PurchaseOrderPrintData` interface to accept `imageColumns?: 2 | 4`.
2. Updated `PurchaseOrderPrintA4.tsx` to dynamically switch between `grid-cols-2` (`maxHeight: 118px`) and `grid-cols-4` (`maxHeight: 78px`).
3. Added `allAvailableArticleReferences`, `mappedItemReferences`, and `effectiveImageColumns` reactive pipelines in `POPrintPreviewModal.tsx`.
4. Embedded `Grid: [ Auto | 2 / Row | 4 / Row ]` and `Photos: [ All | Top 2 | Top 4 | None ]` interactive controls in the floating preview toolbar.

## 8. Tests Executed
1. `src/tests/poPrintBrandingAndTerms.test.tsx`: Verified dynamic image column rendering (2-column and 4-column layout).
2. Full PO test suite (`poGenerate.test.ts`, `poGenerateUX.test.ts`, `poModeConversion.test.ts`, `poSizewiseGrouping.test.tsx`, `poSizewiseUX.test.ts`, `poPrintBrandingAndTerms.test.tsx`): 82/82 tests passed green.
3. `npx tsc --noEmit`: 0 errors.

## 9. Verification Results
- Vitest suite: 6/6 test files green, 82/82 tests passed.
- TypeScript compiler: 0 errors.

## 10. Known Limitations
- Landscape orientation formats currently use the same column configuration as portrait.

## 11. Future Work
- Add custom image upload directly inside the print preview modal for ad-hoc supplier swatch photos.

## 12. Related ADRs
- `ADR-0056`: Two-Way Purchase Order Commercial Drawer & Visual Print Engine Architecture.

## 13. Related RFCs
- `RFC-2026-PURCH-015`: Selective Product Visual Gallery in Statutory Purchase Order Prints.

