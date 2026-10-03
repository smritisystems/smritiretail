<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-09-30
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Purchase Studio Phase 3 — Article Image Binding, Visual Catalog Lookbook, Assortment Curve Intelligence & Landscape Printout

## 1. Purpose
This walkthrough documents the design, implementation, and verification of **Purchase Studio Phase 3** in SMRITI Retail OS. It delivers four interconnected retail purchasing capabilities:
1. **Article & Item-Code-Wise Product Image Binding**: Enabling buyers to bind local files or remote URLs to specific line items, item codes, or whole article series.
2. **Dedicated Visual Lookbook Sub-Tab (`2. Images & Articles`)**: Providing visual lookbook cards with high-resolution imagery, shade/colorway swatches, article code badges, embedded interactive size matrices, and real-time order value calculation.
3. **Mathematical Size Assortment Engine ("Or Recommend")**: Empowering buyers to automatically distribute target quantities across sizes using retail curves (Gaussian Bell Curve, Core-Heavy Curve, or Uniform) with mathematical integer guarantees (`sum === targetQty`).
4. **Statutory Landscape Print Layout**: Ensuring that size-intensive footwear and apparel purchase orders render on A4 Landscape (`297mm × 210mm`) with photo thumbnails, article specifications, and uncompressed size matrix columns.

---

## 2. Scope
- **User Interface**: `src/components/purchase/PoSizewiseTab.tsx`
  - Added dedicated sub-tab `2. Images & Articles (NEW)` with badge counter.
  - Added Dual View Mode: `Card View` (Visual lookbook cards) and `Table View` (dense grid with 40px photo thumbnails).
  - Added colorway/shade swatches row per article card.
  - Added direct editable numeric inputs inside card size matrices.
  - Added Article Image Upload & Binding Modal with scope selection (`Article`, `Item Code`, or `Row Only`).
  - Added High-Resolution Zoom Lightbox for article inspection.
  - Added inline 28px photo thumbnail button in the main `1. Items` table.
- **Mathematical Curve Utility**: Pure exported helper `recommendSizeAssortment()` in `PoSizewiseTab.tsx`.
- **Print Engine & Statutory Vouchers**:
  - `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`: Added `orientation: "landscape" | "portrait"` support, defaulting to `"landscape"` (`297mm × 210mm`), rendering photo thumbnails, technical specs, and 16-column matrix layouts.
  - `src/print_engine/templates/SizePivotMatrixA4.tsx`: Added `orientation` support and `PHOTO` thumbnail column.
  - `src/components/purchase/POPrintPreviewModal.tsx`: Added `Layout: [Landscape] [Portrait]` switcher in the top customizer toolbar and injected `@page { size: A4 landscape; margin: 8mm; }`.
- **Testing**: Added unit tests 22–26 in `src/tests/poSizewiseUX.test.ts`.
- **Evidence Capture**: Added automated headless Playwright execution capturing 12 screenshots (0 browser windows opened).

---

## 3. Files Created
1. `docs/implementation/purchase/Purchase_Studio_Phase_3_Plan_v1.0.0.md` (Formal 19-section IPGP Implementation Plan)
2. `docs/walkthrough/purchase/Purchase_Studio_Phase_3_v1.0.0.md` (This document)
3. Headless Verification Screenshots in `docs/walkthrough/purchase/evidence/`:
   - `09_po_visual_catalog_tab.png`
   - `10_po_article_image_modal.png`
   - `11_po_recommended_assortment.png`
   - `12_po_print_preview_landscape.png`

---

## 4. Files Modified
1. `src/components/purchase/types.ts`:
   - Added `imageUrl?: string; photoUrl?: string;` to `PurchaseOrderSizePivotRow`.
2. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`:
   - Added `orientation?: "portrait" | "landscape"` to `FootwearPurchaseOrderData`.
   - Updated root container class to `w-[297mm] min-h-[210mm]` when landscape.
   - Injected `@page { size: A4 landscape; margin: 8mm; }` print styles.
   - Updated table photo cell to render `<img src={item.photoUrl} ... />`.
3. `src/print_engine/templates/SizePivotMatrixA4.tsx`:
   - Added `orientation` prop and landscape dimensions.
   - Added dynamic `PHOTO` column rendering article image thumbnail.
4. `src/components/purchase/POPrintPreviewModal.tsx`:
   - Added `orientation: "landscape" | "portrait"` state (default `"landscape"`).
   - Added `Layout: [Landscape] [Portrait]` switcher to top toolbar.
   - Propagated `orientation` and `photoUrl` to `FootwearPurchaseOrderA4` and `SizePivotMatrixA4`.
5. `src/components/purchase/PoSizewiseTab.tsx`:
   - Exported pure mathematical utility `recommendSizeAssortment()`.
   - Added `articleNo?: string; imageUrl?: string;` to `SizewisePOLine`.
   - Updated `populateProductToLine` to bind article numbers and image URLs.
   - Added sub-tab `2. Images & Articles (${populatedCount}) NEW`.
   - Implemented Card View lookbook, shade swatches, size matrix inputs, and recommendation assistant.
   - Implemented Article Image Modal and Zoom Lightbox.
   - Added inline photo thumbnail trigger in the matrix items table.
6. `src/tests/poSizewiseUX.test.ts`:
   - Added unit tests 22–26 covering Bell curve, Core sizes curve, Uniform curve, 100-iteration mathematical sum invariant, and Landscape layout.
7. `scripts/capture_purchase_studio_headless.py`:
   - Added Steps 9–12 capturing visual catalog, article image modal, assortment recommendation, and landscape printout.
8. `docs/walkthrough/README.md` & `docs/implementation/README.md`:
   - Updated chronological indexes.

---

## 5. Architecture Decisions
1. **Zero Fraction Remainder Sorting**:
   - The size assortment engine distributes whole integer pairs. To eliminate rounding drift, raw values are floored and remaining units are allocated strictly in order of largest decimal fraction:
     $$\text{fractions.sort}((a, b) \implies b.\text{remainder} - a.\text{remainder})$$
   - This mathematically guarantees $\sum \text{allocated} \equiv \text{targetQty}$ across all test cases.
2. **Three-Tier Scope for Image Propagation**:
   - In retail footwear, Article numbers (e.g. `SND-10001-A`) span multiple sizes and colors. The image modal allows the buyer to apply an uploaded photo at the **Article level** (applying to all variants sharing the article), the **Item Code level**, or the **single row level**.
3. **Landscape Default for Footwear Purchasing**:
   - A Footwear Purchase Order voucher includes up to 16 columns (Code, Photo, Model, Materials, 6–9 Size columns, Cartons, Pairs, Rate, Tax, Total). In portrait A4 (210mm), columns are compressed. In Landscape A4 (297mm), the document displays photo thumbnails and full technical specifications cleanly.

---

## 6. Design Rationale
- **Merchandiser Lookbook vs Data Operator Table**: Merchandising managers review assortments visually to balance colorways and styles across a collection, while data operators need high-speed matrix keyboard entry. Providing a `[Card View]` / `[Table View]` toggle satisfies both user personas without cluttering the screen.
- **Colorway Swatches**: Wholesale footwear orders are organized by style and color. Placing 4 interactive colorway swatches beneath each main photo allows buyers to toggle active shades instantly without leaving the card.

---

## 7. Implementation Summary
- **Mathematical Assortment**:
  - `recommendSizeAssortment(sizes, targetQty, "bell")`: Gaussian distribution with $\mu = (n-1)/2, \sigma = (n-1)/3.5$.
  - `recommendSizeAssortment(sizes, targetQty, "core")`: 75% mid-size concentration.
  - `recommendSizeAssortment(sizes, targetQty, "uniform")`: Even division.
- **Card Matrix Interactivity**: Direct numeric inputs with `updateSizeQty(idx, sz, value)` recalculating row total and order net value in real time.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/poSizewiseUX.test.ts
```
**Terminal Output:**
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/poSizewiseUX.test.ts (28 tests) 26ms

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Start at  20:24:46
   Duration  731ms (transform 368ms, setup 0ms, import 450ms, tests 26ms, environment 0ms)
```

```bash
npx tsc --noEmit
```
**Terminal Output:** Exit Code 0 (0 errors, clean compilation).

---

## 9. Verification Results & Visual Evidence
Automated headless Playwright run (`python scripts/capture_purchase_studio_headless.py`) executed with exit code 0 (zero physical browser windows opened, strictly headless Chromium):

| Step | Artifact Name | Description | Verified Status |
|---|---|---|---|
| Step 1 | `01_po_sizewise_empty_state.png` | Empty PO state with composite read-only identity | **Done** |
| Step 2 | `02_po_toolbar_overflow_menu.png` | Toolbar overflow menu with CSV and Copy actions | **Done** |
| Step 3 | `03_po_sizewise_matrix_populated.png` | Populated sizewise grid with 50 pairs & summary bar | **Done** |
| Step 4 | `04_scale_change_confirmation_modal.png` | Scale change warning modal preserving data integrity | **Done** |
| Step 5 | `05_row_delete_confirmation_modal.png` | Governed row delete warning modal | **Done** |
| Step 6 | `06_statutory_print_preview_pivot.png` | Size Pivot Matrix statutory voucher preview | **Done** |
| Step 7 | `07_statutory_print_preview_footwear.png` | Footwear A4 Statutory PO voucher preview | **Done** |
| Step 8 | `08_po_saved_confirmation.png` | Post-save confirmation dialog | **Done** |
| Step 9 | `09_po_visual_catalog_tab.png` | Dedicated Lookbook Tab (Card View) with Color Badges & Swatches | **Done** |
| Step 9b | `09b_po_visual_table_view.png` | Lookbook Tab (Table View) with Color / Shade Column | **Done** |
| Step 10 | `10_po_article_image_modal.png` | Product Image Binding Modal with Color Reference & Composite Scope | **Done** |
| Step 11 | `11_po_recommended_assortment.png` | Mathematical Assortment Curve Recommendation applied | **Done** |
| Step 12 | `12_po_print_preview_landscape.png` | Statutory Footwear PO in A4 Landscape (297mm x 210mm) | **Done** |

---

## 10. Known Limitations
- External image URLs require valid CORS or public hosting to render in canvas exports if printed via external rasterizers.

---

## 11. Future Work
- Integration with mobile device camera for direct barcode and shoe sample snapshot capture on the showroom floor.
- Custom ratio preset saving (e.g. saving vendor-specific carton ratios like `6-12-18-18-12-6`).

---

## 12. Related ADRs
- `ADR-0042`: Purchase Studio Architecture & Dual-Mode Generation
- `ADR-0051`: Statutory Print Engine Landscape Layout Standards

---

## 13. Related RFCs
- `RFC-2026-09`: Retail Size Curve Assortment & Visual Procurement Specification
