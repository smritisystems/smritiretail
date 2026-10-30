<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.75.4
  Created      : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Purchase Order Sizewise to Standard Mode Conversion

**Version:** 6.75.4  
**Date:** 2026-10-14  
**Status:** Done  
**Area:** Purchase / Procurement  
**Capability:** `@SmritiCapability("PURCHASE", "PO_MODE_CONVERSION")`

---

## 1. Purpose

In footwear and fashion retail procurement, merchandisers work with two distinct yet mathematically equivalent views of the same Purchase Order:
1. **Sizewise Matrix View:** An article-and-color centric horizontal distribution matrix where quantities are populated across size scales (e.g. Article `SH-03-I`, Color `BLACK`, 108 pairs across EU sizes 36–44).
2. **Standard Item Variant View:** A barcode- and SKU-centric vertical line item grid where each non-zero variant represents an individual order row with its mapped barcode, SKU, size, quantity, purchase rate, and statutory tax.

This walkthrough documents the design, implementation, and automated headless verification of the bidirectional, lossless, and idempotent projection engine connecting the **Sizewise** and **Standard** modes in SMRITI Retail OS.

---

## 2. Scope

- **Sizewise to Standard Unpacking:** Conversion of horizontal size matrices into individual, barcode-wise line items (`PurchaseOrderLineItem[]`).
- **Standard to Sizewise Regrouping:** Consolidation of discrete variant rows by `(article, color)` composite key into horizontal matrix rows (`SizewisePOLine[]`).
- **Data Preservation:** Zero quantity loss, exact rate/tax preservation, UOM mapping, and document header synchronization (PO #, Supplier, Order Date, Delivery Date, Delivery Location, Payment Terms, Freight, Remarks).
- **Zero-Quantity Exclusion:** Automatic exclusion of zero-quantity size variants when switching to Standard mode.
- **Auto Scale Detection:** Dynamic recognition of size scales (Footwear EU 36–44, Footwear UK 6–11, Apparel Alpha S–XXL) during reverse projection.
- **Bidirectional Edits & Idempotency:** Changes in either mode (e.g. editing size 40 quantity in Standard mode from 20 to 25) cleanly reflect back in the other mode without duplicate rows or orphaned data upon repeated switching.

---

## 3. Files Created

1. `src/components/purchase/poModeConversion.ts` — Mathematical projection engine containing:
   - `convertSizewiseToStandardLines`
   - `convertStandardToSizewiseLines`
   - `syncSizewiseHeaderToStandard`
   - `syncStandardHeaderToSizewise`
   - `detectSizesFromLines`
   - `findMatchingVariantProduct`
2. `src/tests/poModeConversion.test.ts` — Vitest unit test suite validating 108-pair expansion, zero exclusion, regrouping, edit preservation, idempotency, and header synchronization.
3. `scripts/verify_po_sizewise_to_standard_headless.py` — End-to-end headless Playwright verification script capturing visual evidence.
4. `docs/walkthrough/purchase/evidence/01_po_sizewise_108_pairs_matrix.png` — Screenshot of initial Sizewise matrix with 108 pairs.
5. `docs/walkthrough/purchase/evidence/02_po_standard_9_barcode_rows.png` — Screenshot of Standard mode displaying 9 expanded barcode-wise rows.
6. `docs/walkthrough/purchase/evidence/03_po_standard_size40_edited.png` — Screenshot of Standard mode with size 40 edited from 20 to 25.
7. `docs/walkthrough/purchase/evidence/04_po_sizewise_after_return.png` — Screenshot of Sizewise matrix displaying regrouped rows and updated 113-pair total.

---

## 4. Files Modified

1. `src/components/PurchaseStudioTab.tsx`:
   - Elevated unified document state: `sharedSizewiseLines`, `sharedStandardLines`, `sharedSizewiseHeader`, `sharedStandardHeader`, `sharedSizes`.
   - Wired bidirectional conversion in `handleModeChange(mode)`.
   - Passed state and synchronization callbacks to `<PoSizewiseTab />` and `<PoGenerateTab />`.
2. `src/components/purchase/PoSizewiseTab.tsx`:
   - Exported `SizewisePOHeader` interface.
   - Updated `PoSizewiseTabProps` with `initialLines`, `initialHeader`, `onLinesChange`, `onHeaderChange`, `onSizesChange`.
   - Synchronized internal state with parent via reactive `useEffect` hooks.
   - Added `id="sw-rate-${idx}"` for automated testability.
3. `src/components/purchase/PoGenerateTab.tsx`:
   - Updated `PurchaseOrderGenerationTabProps` with `initialLineItems`, `initialHeader`, `onLineItemsChange`, `onHeaderChange`.
   - Initialized `activeTab` to `"items"` when active line items are present.
   - Synchronized line items and header modifications back to parent.

---

## 5. Architecture Decisions

- **Single Document Truth, Dual Projections:** Sizewise and Standard are not independent datasets; they are two complementary projections of a single purchase commitment. State is maintained at the parent level (`PurchaseStudioTab.tsx`) and projected on demand.
- **Pure Reversible Projection:** Both conversion functions are pure functions satisfying the mathematical idempotency identity:
  $$\text{convertStandardToSizewise}(\text{convertSizewiseToStandard}(M)) = M$$
- **Automatic Sub-Tab Routing:** When transitioning to Standard mode with converted variants, `PoGenerateTab` initializes directly to the `"items"` sub-tab rather than `"general"`, presenting the line items table immediately to the merchandiser.

---

## 6. Design Rationale

- **Zero-Quantity Exclusion:** Retail orders often have size scales spanning 9–15 sizes, but only 4–6 sizes may be ordered for a given colorway. Generating empty Standard rows creates database bloat and clutters warehouse picking lists; excluding zero-qty rows keeps the standard document clean.
- **Composite Key Grouping:** Regrouping from Standard to Sizewise uses the normalized composite key `(article, color)`:
  `groupKey = `${article.toUpperCase()}::${color.toUpperCase()}``
  This reliably recombines all sizes of the same article/color back into a single matrix row.

---

## 7. Implementation Summary

### Sizewise -> Standard Conversion

```typescript
export function convertSizewiseToStandardLines(
  sizewiseLines: SizewisePOLine[],
  products: Product[] = [],
  defaultTaxPercent = 5
): PurchaseOrderLineItem[]
```
Iterates through each matrix row, extracts non-zero sizes from `line.sizeQuantities`, finds matching product variants by SKU/barcode, and creates individual `PurchaseOrderLineItem` rows preserving rate, UOM, delivery date, and statutory GST slab.

### Standard -> Sizewise Regrouping

```typescript
export function convertStandardToSizewiseLines(
  standardLines: PurchaseOrderLineItem[],
  sizes?: string[],
  defaultDeliveryDate = "",
  defaultTaxPercent = 5
): SizewisePOLine[]
```
Extracts article and color, groups rows by `groupKey`, maps individual line quantities to size columns, detects size scale (EU 36–44, UK 6–11, Alpha S–XXL), recalculates `totalQty` and `netValue`, and returns consolidated `SizewisePOLine[]`.

---

## 8. Tests Executed

1. **Vitest Unit Tests (`src/tests/poModeConversion.test.ts`):**
   - Test 1: Sizewise to Standard conversion (108 pairs -> 9 rows).
   - Test 2: Zero quantity exclusion.
   - Test 3: Standard to Sizewise reverse conversion.
   - Test 4: Preservation of edits made in Standard mode.
   - Test 5: Idempotency over multiple consecutive switches.
   - Test 6: Bidirectional header synchronization.
2. **Headless Playwright E2E (`scripts/verify_po_sizewise_to_standard_headless.py`):**
   - Populated Article `SH-03-I`, Color `BLACK`, 108 pairs across sizes 36–44.
   - Switched to Standard mode and verified 9 rows with exact quantities and rate 660.
   - Modified size 40 quantity from 20 to 25.
   - Switched back to Sizewise mode and verified size 40 = 25 and total = 113.
   - Tested 3 consecutive switch cycles for idempotency.

---

## 9. Verification Results

```text
================================================================================
SMRITI RETAIL OS — PURCHASE ORDER: SIZEWISE TO STANDARD MODE VERIFICATION
================================================================================
Target URL   : http://localhost:8101
Backend API  : http://127.0.0.1:1981
Output Dir   : F:\SMRITRretailNX\docs\walkthrough\purchase\evidence
--------------------------------------------------------------------------------
[AUTH OK] Admin token acquired:[REDACTED_EXAMPLE_TOKEN]

[STEP 1] Pre-seeding authenticated local storage on domain...
[NAVIGATING] http://localhost:8101/?tab=purchase...

[STEP 2] Initializing Sizewise Mode with Footwear EU scale...

[STEP 3] Entering Article SH-03-I, Color BLACK, 108 pairs across sizes 36-44...
[SAVED] 01_po_sizewise_108_pairs_matrix.png
[SIZEWISE TOTAL] Measured Total Qty: 108

[STEP 4] Switching from Sizewise to Standard Mode...

[STEP 5] Verifying Standard Mode Barcode-wise Variant Rows...
[STANDARD ROWS] Rendered table rows: 15
[STANDARD ROWS INSPECTION] Verified 9 rows:
  Row 1: Qty = 4
  Row 2: Qty = 8
  Row 3: Qty = 14
  Row 4: Qty = 18
  Row 5: Qty = 20
  Row 6: Qty = 18
  Row 7: Qty = 14
  Row 8: Qty = 8
  Row 9: Qty = 4
[SAVED] 02_po_standard_9_barcode_rows.png

[STEP 6] Modifying Size 40 Quantity in Standard Mode from 20 -> 25...
[SAVED] 03_po_standard_size40_edited.png

[STEP 7] Switching back to Sizewise Mode...

[STEP 8] Verifying Sizewise Matrix after switching back...
[SIZEWISE VERIFY] Size 40 Qty in Matrix: 25
[SIZEWISE VERIFY] Recalculated Matrix Total: 113
[SAVED] 04_po_sizewise_after_return.png

[STEP 9] Verifying Idempotency over 3 consecutive mode switches...
[IDEMPOTENCY CHECK] Matrix Total after 3 cycles: 113

================================================================================
[SUCCESS] ALL VERIFICATIONS PASSED 100% GREEN WITH ZERO LOSS!
================================================================================
```

---

## 10. Known Limitations

- Mixed apparel and footwear articles within the same Purchase Order use dynamic multi-scale detection when regrouping, defaulting to the predominant scale in the row group.

---

## 11. Future Work

- Support per-row custom size scale overrides when multi-category apparel/footwear lines coexist in a single order.

---

## 12. Related ADRs

- `ADR-0044`: Dual View Single-Store Document Pattern for Fashion & Footwear Procurement.
- `ADR-0042`: Item Master Variant Architecture and SKU Normalization.

---

## 13. Related RFCs

- `RFC-2026-PO-01`: Purchase Order Horizontal Size Matrix and Barcode Decomposition Standard.
