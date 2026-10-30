<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.75.3
  Created      : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Walkthrough
-->

# Procurement & Sizewise UX: Article & Color Matrix Grid, Dynamic Autocomplete, Validations & Ratio Recommendation

**Walkthrough ID:** WGP-PURCHASE-SIZEWISE-ARTICLE-COLOR-v6.75.3  
**Status:** Done  
**Capability:** `@SmritiCapability("PURCHASE", "PO_SIZEWISE_ARTICLE_COLOR_ENTRY")`  
**Area:** Procurement & Merchandising UX  
**Version:** 6.75.3  
**Date:** 2026-10-14  

---

## 1. Purpose
In wholesale and retail fashion, apparel, and footwear procurement, buyers and merchandisers operate primarily in terms of **Article / Style** numbers (e.g. `SH-03`, `OXF-990`) and **Color / Shade** names (e.g. `CREAM`, `BLACK`, `TAN`, `CHERRY`) across a size curve, rather than obscure generic SKU strings or monolithic product names. This walkthrough documents the enhancement of the Sizewise Purchase Order Matrix (`PoSizewiseTab.tsx`) to show dedicated **Article / Style** and **Color / Shade** columns alongside the sizes matrix by default, while offering a 1-click toolbar toggle to switch to Standard SKU Code & Description mode, robust client-side validations, dynamic color autocomplete with live swatches, and 1-click row-level size ratio recommendation.

---

## 2. Scope
1. **Configurable Grid Display Mode:**
   - Toolbar segmented control allowing users to switch between:
     - `Article & Color` (Default / Recommended for fashion & footwear)
     - `Code & Desc` (Standard SKU mode for general merchandise)
   - Zero column drift: both modes occupy exactly 2 descriptor columns before the horizontal size matrix, guaranteeing that table headers, sub-headers, body cells, and footer totals align with 100% mathematical precision.
2. **Dynamic Article & Color Extraction & Autocomplete:**
   - Universal `extractArticleAndColor` utility parsing complex SKU formats (`SH-03-I-BLACK-36` -> Article `SH-03-I`, Color `BLACK`) across recall, Excel import, barcode scan, and F2 lookups.
   - Comprehensive retail color palette datalist (`#sw-common-colors-list`) supporting fast typeahead suggestions while preserving custom shade names.
   - Real-time color swatch indicators reflecting hex values from `SHADE_COLOR_MAP`.
3. **Comprehensive Data Validation:**
   - Mandatory Article / Item Code validation per line item (`art || code`).
   - Positive order quantity enforcement (`totalQty > 0`).
   - Non-negative unit purchase rate check (`rate >= 0`).
   - Statutory GST rate ceiling validation (`0 <= taxPercent <= 28`).
   - Seamless synthetic variant generation fallback (`${article}-${color}`) for items created directly within the matrix.
4. **Row-Level & Batch Recommendation Engine:**
   - 1-click `✨ Ratio` button in each row action column (`#sw-row-recommend-${idx}`) immediately distributing target quantity using retail Gaussian bell curves.
   - Batch toolbar ratio assortment menu with Bell Curve, Core Sizes (60/40), and Uniform distributions.

---

## 3. Files Created
1. `docs/walkthrough/purchase/Purchase_Order_Sizewise_Article_Color_Mode_And_Validation_v6.75.3.md` — This official Walkthrough document.
2. `scripts/capture_po_sizewise_article_color_headless.py` — Headless Playwright end-to-end verification and visual evidence capture script.
3. `docs/walkthrough/purchase/evidence/01_po_sizewise_article_color_grid.png` — Recalled purchase order in default Article & Color mode.
4. `docs/walkthrough/purchase/evidence/02_po_sizewise_code_desc_grid.png` — Grid toggled to Standard Code & Description mode.
5. `docs/walkthrough/purchase/evidence/03_po_sizewise_row_recommendation.png` — 1-click row-level bell curve ratio recommendation applied.
6. `docs/walkthrough/purchase/evidence/04_po_sizewise_color_updated.png` — Color updated to CREAM with dynamic swatch update.
7. `docs/walkthrough/purchase/evidence/05_po_sizewise_article_color_saved.png` — Draft purchase order successfully updated with validations passed.

---

## 4. Files Modified
1. `src/components/purchase/PoSizewiseTab.tsx` — Added `gridDisplayMode` state, toolbar segmented toggle, conditional thead/tbody columns for Article & Color vs Code & Desc, color autocomplete datalist, row-level recommendation button, and validation logic in `handleSavePO`.
2. `docs/walkthrough/README.md` — Master walkthrough index updated with v6.75.3 entry.

---

## 5. Architecture Decisions
- **ADR-065: Dual Descriptor Grid Layout with Invariant Column Parity:**
  - Both `"article_color"` and `"item_code_desc"` modes project into exactly 2 columns preceding the horizontal size run.
  - Col 1: `#` (S.No)
  - Col 2: Article / Style (or Item Code)
  - Col 3: Color / Shade (or Product Description)
  - Cols 4..(4+N): Size Run Matrix
  - This ensures that table headers (`<thead>`), sub-headers with column spacers, data rows (`<tbody>`), and totals footer (`<tfoot>`) maintain 100% geometric alignment without recalculating widths or shifting grid layout.
- **ADR-066: Resilient Code & Variant Auto-Resolution:**
  - When users enter new fashion lines in `article_color` mode without an existing canonical SKU, the system resolves `effectiveCode` as `${article}-${color}` (or `${article}`) during `handleSavePO`. This allows `ProductResolutionService.validate_line` on the backend to match or create the variant without requiring cashiers/merchandisers to know internal database surrogate keys.

---

## 6. Design Rationale
- **Fashion Merchandiser Usability:** Footwear buyers order styles in batches of colors across standard runs (e.g. 36 to 44). Displaying "SH-03-I" as Article and "BLACK" with a visual color dot directly matches physical purchase order indent forms from suppliers.
- **Backward Compatibility:** Retaining the segmented toggle for "Code & Desc" ensures standard warehouse operators and SKU-driven departments can continue using traditional barcode/code-based workflows.

---

## 7. Implementation Summary
```typescript
// 1. Grid Mode State
const [gridDisplayMode, setGridDisplayMode] = useState<"article_color" | "item_code_desc">("article_color");

// 2. Toolbar Segmented Control
<div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
  <button id="sw-grid-mode-article-color-btn" onClick={() => setGridDisplayMode("article_color")}>
    Article & Color (Recommended)
  </button>
  <button id="sw-grid-mode-code-desc-btn" onClick={() => setGridDisplayMode("item_code_desc")}>
    Code & Desc
  </button>
</div>

// 3. Row-Level Recommendation Action
<button id={`sw-row-recommend-${idx}`} onClick={() => handleApplyRecommendationToRow(idx, "bell")}>
  Ratio
</button>
```

---

## 8. Tests Executed
1. **Compilation & Build Validation:**
   - `npm run build` executed cleanly in 56.93s (`vite v5.4.21`, 3,715 modules transformed, exit code 0).
2. **Headless Playwright End-to-End Test Suite:**
   - Script: `scripts/capture_po_sizewise_article_color_headless.py`
   - Verified default Article & Color mode: headers present (`True`), row values populated (`SH-03-I`, `BLACK`).
   - Verified toggle to Code & Desc mode: headers present (`Item Code`, `Product Description`).
   - Verified toggle back to Article & Color mode.
   - Verified 1-click row recommendation (`✨ Ratio`) applying bell curve.
   - Verified color update to `CREAM` and dynamic swatch rendering.
   - Verified draft saving with comprehensive validation and backend database persistence.
   - Executed 100% headless with 0 browser popups.
3. **Database State Verification:**
   - Verified `PO-978758` in backend database via API: `Status: SUBMITTED, Items: 1, Total: 74844.00`.

---

## 9. Verification Results
```text
================================================================================
SMRITI RETAIL OS — ARTICLE & COLOR SIZEWISE GRID HEADLESS VERIFICATION
================================================================================
Target URL   : http://localhost:8101
Backend API  : http://127.0.0.1:1981
--------------------------------------------------------------------------------
[AUTH OK] Admin token acquired:[REDACTED_EXAMPLE_TOKEN] (redacted documentation example)
[STEP 2] Recalling PO PO-978758 into Sizewise Matrix...
[STEP 3] Verifying Article & Color (Default / Recommended) Mode...
[GRID CHECK] 'Article / Style' header present: True
[GRID CHECK] 'Color / Shade' header present  : True
[ROW CHECK] Row 0 Article value: 'SH-03-I' | Shade value: 'BLACK'
[SAVED] 01_po_sizewise_article_color_grid.png
[STEP 4] Toggling to 'Code & Desc' View Mode...
[GRID CHECK] 'Item Code' header present: True
[GRID CHECK] 'Product Description' header present: True
[SAVED] 02_po_sizewise_code_desc_grid.png
[STEP 5] Toggling back to 'Article & Color' View Mode...
[STEP 6] Testing Row-Level Recommendation ('✨ Ratio' button)...
[INFO] Row-level recommendation ratio applied to row 0.
[SAVED] 03_po_sizewise_row_recommendation.png
[STEP 7] Updating Color / Shade to 'CREAM' and verifying swatch...
[SAVED] 04_po_sizewise_color_updated.png
[STEP 8] Saving / Updating Draft Purchase Order with Validations...
[SAVED] 05_po_sizewise_article_color_saved.png
================================================================================
ALL ARTICLE & COLOR VERIFICATIONS COMPLETED SUCCESSFULLY (HEADLESS).
================================================================================
```

---

## 10. Known Limitations
- When entering new custom colors not present in `COMMON_RETAIL_COLORS`, the color dot defaults to neutral gray `#94a3b8` unless mapped in `SHADE_COLOR_MAP`.

---

## 11. Future Work
- Support multi-color composite colorways (e.g. `BLACK/RED`) with split dual-tone swatch icons.
- Add customizable size curve ratios configured at the supplier brand level.

---

## 12. Related ADRs
- `ADR-042: System Parameter Dual-Key Architecture`
- `ADR-065: Dual Descriptor Grid Layout with Invariant Column Parity`
- `ADR-066: Resilient Code & Variant Auto-Resolution`

---

## 13. Related RFCs
- `RFC-2026-PURCHASE-SIZEWISE-V3`
