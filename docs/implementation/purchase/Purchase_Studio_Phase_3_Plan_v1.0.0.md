<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-09-30
  * Modified   : 2026-09-30
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Purchase Studio Phase 3 — Article-Wise Image Management & Visual Sourcing Catalog

## 1. Objective
Enable visual procurement workflows within the Purchase Studio Sizewise Matrix (`PoSizewiseTab.tsx`) by introducing:
1. Article/item-code-wise product image attachment and storage (supporting local file uploads and remote image URLs).
2. A dedicated **Visual Catalog & Article Gallery** sub-tab presenting each article with its photo, article number, brand/style specs, horizontal size breakdown, total quantity, and commercial value.
3. An intelligent **Retail Size Assortment Recommendation Engine** (offering Bell Curve, Core-Sizes Heavy, and Uniform ratio distributions).
4. Direct propagation of article images into the statutory Footwear Purchase Order A4 printout (`FootwearPurchaseOrderA4`).

## 2. Business Motivation
In footwear and apparel procurement, buying decisions, assortment planning, and supplier communications are fundamentally visual. Procurement managers, merchandisers, and vendors rely heavily on sample photographs, silhouette views, and colorway references alongside numerical size runs. A purely text-and-numerical matrix creates ambiguity, increases the risk of erroneous style/color ordering, and forces buyers to maintain separate offline lookbooks. By embedding article-wise imagery directly into the Sizewise PO interface alongside mathematical ratio recommendation curves, SMRITI empowers merchandising teams to plan, verify, and print visually enriched, error-free purchase orders.

## 3. Scope
The Phase 3 implementation encompasses four core capabilities:
1. **Article & Item-Code Image Binding:**
   - Attach, upload (via `FileReader` data URL), or link remote image URLs per line or unified by `articleNo` / `itemCode`.
   - Auto-population of images from the master catalog (`product.primaryImageUrl` or `product.imageUrl`) upon F2 or browse selection.
2. **Dedicated Visual Catalog Sub-Tab (`2. Visual Catalog`):**
   - High-fidelity visual cards for every PO line item displaying Article No, Item Code, Brand, Style, Shade, and Category.
   - Comprehensive size-wise order quantity breakdown pills and total pair/piece count.
   - Financial totals (Cost Rate, GST %, Total Line Value).
   - Instant image preview, zoom modal, and photo replacement actions.
3. **Retail Size Assortment Recommendation Engine:**
   - Deterministic algorithm calculating size distributions based on industry-standard procurement curves:
     - `bell`: Gaussian / Normal Distribution weighting middle sizes.
     - `core`: Core Sizes Focus allocating ~70% volume to peak demand sizes (e.g. EU 40-42, Apparel M-L).
     - `uniform`: Equal carton / pair allocation across all active columns.
   - One-click "Apply Recommended Assortment" directly updating working matrix line quantities.
4. **Print Engine Synchronization:**
   - Feeding article image URLs directly into `POPrintPreviewModal` and `FootwearPurchaseOrderA4` so printable vouchers reflect real article photographs.

## 4. Current State
- `PoSizewiseTab.tsx` provides three sub-tabs: `1. Items`, `2. Delivery & Tax`, and `3. Other Details`.
- Line items in `SizewisePOLine` lack an `imageUrl` or `articleNo` property.
- The matrix grid is purely numerical without inline thumbnail indicators or visual inspection tools.
- Assortment quantities must be keyed in manually per cell without curve-based ratio recommendations.

## 5. Gap Analysis
| Feature | Current State | Target State (Phase 3) |
|---|---|---|
| Line Item Imagery | No image support | `imageUrl?: string` and `articleNo?: string` in `SizewisePOLine` |
| Image Association | None | Article-wise & item-code-wise image attachment map |
| Visual Inspection | None (text grid only) | Dedicated `2. Visual Catalog` tab with rich article cards |
| Size Recommendations | Manual cell input | Automated Bell Curve, Core-Sizes, and Uniform ratio generator |
| Statutory Print Photos | Default placeholder images | Real uploaded article photos populated into Footwear A4 voucher |

## 6. Architecture Impact
- **Component Layer:** `src/components/purchase/PoSizewiseTab.tsx` gains the `visual` sub-tab view, an Article Image Uploader modal, inline thumbnail badges in the matrix grid, and the assortment recommendation modal/dropdown.
- **Data Model:** `SizewisePOLine` extended with optional `imageUrl` and `articleNo`.
- **Statutory Template Pipeline:** `POPrintPreviewModal` receives lines with real image URLs mapped to `FootwearPurchaseOrderItem.photoUrl`.
- **Algorithms:** `recommendSizeAssortment()` pure mathematical utility added and exported for deterministic testing.

## 7. Proposed Design
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header: PO-37067 | Supplier: Sameer Bhai | Date: 2026-09-30                 │
│ Sub-Tabs: [1. Items Matrix] [2. Visual Catalog] [3. Delivery] [4. Other]    │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
    [1. Items Matrix Tab]                          [2. Visual Catalog Tab]
    ┌──────────────────────────────┐              ┌──────────────────────────────┐
    │ Row 1: [IMG] FW-NK-9921      │              │ Article Card: FW-NK-9921     │
    │ 36:2 37:4 38:6 ... Tot: 50   │              │ [Photo: Nike Pegasus 40]     │
    │ Inline Thumbnail & Upload    │              │ Sizes: 36:2 37:4 38:6 ...    │
    └──────────────────────────────┘              │ Total: 50 Prs | ₹ 1,12,500   │
                                                  │ [Recommend Assortment ▼]     │
                                                  │ [Upload / Change Image]      │
                                                  └──────────────────────────────┘
```

## 8. Files Created
1. `docs/implementation/purchase/Purchase_Studio_Phase_3_Plan_v1.0.0.md` (This document)
2. `docs/walkthrough/purchase/Purchase_Studio_Phase_3_v1.0.0.md` (Post-implementation walkthrough)

## 9. Files Modified
1. `src/components/purchase/PoSizewiseTab.tsx` (Sub-tab navigation, image uploader, visual catalog view, recommendation engine)
2. `src/tests/poSizewiseUX.test.ts` (Unit test suite for recommendation algorithms and visual catalog state)
3. `docs/implementation/README.md` (Master implementation index update)
4. `docs/walkthrough/README.md` (Master walkthrough index update)

## 10. Dependencies
- React 18 + TypeScript
- Lucide / Material Symbols iconography
- Playwright Python (for headless visual verification)
- Vitest (for unit test suite)

## 11. Risks
- **Memory Footprint with Large Images:** Reading uncompressed camera images via `FileReader` could bloat state.
  *Mitigation:* Limit file upload sizes, recommend compressed WebP/JPEG, and support external image URLs.
- **Matrix Row Height Distortion:** Adding image thumbnails to table rows could disrupt dense matrix scrolling.
  *Mitigation:* Keep table thumbnail compact (24×24px with hover preview) while keeping full-size imagery in the dedicated Visual Catalog tab.

## 12. Rollback Strategy
All changes are self-contained within `PoSizewiseTab.tsx` and its test suite. Reverting to commit `b20af618` restores Phase 2 without backend or schema changes.

## 13. Verification Plan
1. Vitest test suite executing unit tests for `recommendSizeAssortment` across all curve modes.
2. `npx tsc --noEmit` clean compilation with exit code 0.
3. Headless Playwright script verifying:
   - Image attachment and visual catalog rendering.
   - Sub-tab switching between `1. Items Matrix` and `2. Visual Catalog`.
   - Size quantity and total quantity display with recommendation application.

## 14. Test Plan
- Unit tests verifying:
  - `recommendSizeAssortment` with Bell Curve across 5 and 9 size scales.
  - `recommendSizeAssortment` with Core-Sizes mode.
  - `recommendSizeAssortment` with Uniform mode.
  - Handling of zero and odd total targets.
  - `SizewisePOLine` with `imageUrl` integrity.

## 15. Documentation Impact
- Update `docs/walkthrough/purchase/` with a comprehensive Phase 3 walkthrough document.
- Update master README indices in `docs/implementation/README.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
Pure frontend progressive enhancement; fully backward-compatible with all existing purchase order endpoints and JSON payloads.

## 17. Status
Completed — Verified with 28/28 passing Vitest tests (exit code 0), clean TypeScript compilation (`npx tsc --noEmit` exit code 0), and 13 automated headless Playwright visual evidence captures.

## 18. Related ADRs
- `ADR-0042`: SMRITI Purchase Order System of Record and Matrix UX Architecture
- `ADR-0068`: Print Engine Universal Statutory Voucher Pipeline

## 19. Related Walkthroughs
- `Purchase_Studio_Phase_1_v1.0.0.md`
- `Purchase_Studio_Phase_2_v1.0.0.md`
- `Purchase_Studio_Phase_3_v1.0.0.md`
