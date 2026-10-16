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

  * Version    : 6.84.2
  * Created    : 2026-10-16
  * Modified   : 2026-10-16
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Purchase Studio Live Sizewise Grid Grouping, 120-Day Default Payment Terms & Universal PO Business Terms Printing

**Document ID:** `SMRITI-WGP-PROC-20261016-02`  
**Area:** Procurement & Purchase Studio (`procurement`)  
**Version:** `v6.84.2`  
**Date:** 2026-10-16  
**Status:** Completed & Certified  
**Classification:** Internal System Walkthrough  

---

## 1. Purpose
This walkthrough documents the end-to-end engineering implementation of two interconnected procurement capabilities in SMRITI Retail OS:
1. **Live Purchase Studio Sizewise Grid Consolidation:** Consolidating live Purchase Studio workspace grids (`1. Items` table, `2. Images & Articles` lookbook cards, and visual table view) so that multiple per-size variant records of the same Article/Style and Color/Shade render as a single consolidated row across EU size columns 36–44, without destructively altering underlying SKU/variant records.
2. **120-Day Default Payment Terms & Universal Business Terms Printing:** Standardizing default payment terms to strictly 120 Days across Vendor Master and Purchase Order creation, adding a dedicated "Business Terms & Statutory Conditions" drawer under Commercial Terms with standard wholesale credit contract templates, and printing these statutory conditions across all 3 Purchase Order printing formats.

---

## 2. Scope
1. **Live Purchase Studio Matrix (`PoSizewiseTab.tsx`):**
   - Pure functional presentation grouping via `buildGroupedSizewiseLines(lines, sizes, defaultTaxPercent)`.
   - Dynamic binding of `groupedDisplayLines` in `1. Items` matrix table, `2. Images & Articles` Card View, and Table View.
   - Preserving distinct colors (e.g. `CREAM` vs `BLACK`) and distinct articles on separate rows.
   - Non-destructive cell editing: modifying any EU size quantity (36–44) routes directly to the underlying variant line index via `group.sizeToLineIndex[sz]`.
   - Preserving blank/unconfigured rows with unique keys (`__blank_${id}`).
   - Batch and single-item curve distribution (`handleApplyBatchRecommendation`, `handleApplyRecommendationToGroup`) operating cleanly across grouped rows.
2. **Vendor Master 120-Day Payment Terms (`VendorMasterWs.tsx`):**
   - Normalization fallback: `comm.paymentTermsDays ?? comm.payment_terms_days ?? 120`.
   - Initial state, form submission, and form reset defaulting to `120` days.
3. **Commercial Delivery Drawer & Header (`CommercialDeliveryDrawer.tsx`, `types.ts`, `PoGenerateTab.tsx`):**
   - Added `businessTerms?: string;` to `PurchaseOrderHeader`.
   - Embedded Section 4: "Business Terms & Statutory Conditions" with standard 120-day wholesale credit clause template and "Load Standard Terms" action.
   - Defaulted payment terms to `"120 Days"`.
4. **Universal PO Print Format Integration:**
   - `PurchaseOrderPrintA4.tsx`: Added Section 5.1 `BUSINESS TERMS & STATUTORY CONDITIONS`.
   - `FootwearPurchaseOrderA4.tsx`: Added Section 4.1 `BUSINESS TERMS & STATUTORY CONDITIONS`.
   - `SizePivotMatrixA4.tsx`: Added `BUSINESS TERMS & STATUTORY CONDITIONS` section before signatures and updated footer payment terms fallback to `"120 Days"`.
   - `POPrintPreviewModal.tsx`: Resolved business terms from header or default template, propagating to all 3 print formats.

---

## 3. Files Created
- None (All changes enhanced existing core procurement components and extended the automated test suite).

---

## 4. Files Modified
1. `src/components/vendor/VendorMasterWs.tsx`
2. `src/components/purchase/types.ts`
3. `src/components/purchase/CommercialDeliveryDrawer.tsx`
4. `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
5. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
6. `src/print_engine/templates/SizePivotMatrixA4.tsx`
7. `src/components/purchase/POPrintPreviewModal.tsx`
8. `src/components/purchase/PoGenerateTab.tsx`
9. `src/components/purchase/PoSizewiseTab.tsx`
10. `src/tests/poSizewiseGrouping.test.tsx`

---

## 5. Architecture Decisions
1. **Decoupled Presentation Model (`buildGroupedSizewiseLines`):**
   Rather than collapsing the underlying `lines: SizewisePOLine[]` array destructively—which would cause loss of individual SKU barcodes, ERP variant IDs, or stock-on-hand metadata—the architecture implements a pure memoized presentation layer `groupedDisplayLines = useMemo(() => buildGroupedSizewiseLines(lines, sizes, tax), [lines, sizes, tax])`.
2. **Reverse Pointer Mapping (`sizeToLineIndex`):**
   Each grouped display row maintains a lookup dictionary `sizeToLineIndex: Record<string, number>` referencing the canonical line index for each size column. When an operator updates a cell (e.g., size 38), the handler writes to `lines[group.sizeToLineIndex["38"]]` or falls back to `group.primaryLineIndex`.
3. **Blank Row Identity Preservation:**
   Blank/unpopulated rows added via `+ Add Row` are tagged with synthetic keys `__blank_${id}` so that multiple empty rows remain separate rather than collapsing into one row.
4. **Universal Fallback Hierarchy for Business Terms:**
   Business terms are resolved through an authoritative fallback chain:
   `header.businessTerms` → `header.business_terms` → `vendor.commercial.business_terms` → `DEFAULT_BUSINESS_TERMS`.

---

## 6. Design Rationale
- **Footwear Wholesale Procurement Ergonomics:** Buyers think in terms of "Article + Color" pairs with a size breakdown (EU 36–44). Displaying separate rows for every size cluttered the workspace and made quantity verification error-prone.
- **Credit Policy Statutory Protection:** Indian wholesale footwear manufacturing standard credit is 120 days. Providing pre-configured statutory clauses directly on the PO printout protects buyers against premature payment demands and establishes clear defect-replacement terms (15-day QC replacement window, GS1 barcoding requirements, and Mumbai court jurisdiction).

---

## 7. Implementation Summary
- **Matrix Grid Consolidation:** Replaced `lines.map` with `groupedDisplayLines.map` across `PoSizewiseTab.tsx` table bodies.
- **Lookbook Card & Table View:** Updated Tab 2 (`2. Images & Articles`) to iterate over `groupedDisplayLines`, wiring group-level shade modifications, image modals, and deletion actions.
- **Batch Ratio Distribution:** Enhanced `handleApplyBatchRecommendation` to apply Gaussian bell curves, core sizes, or uniform curves across all size columns of each grouped article.
- **Universal Print Engine:** Injected `businessTerms` into `PurchaseOrderPrintA4`, `FootwearPurchaseOrderA4`, and `SizePivotMatrixA4` before signature authorization blocks.

---

## 8. Tests Executed
1. `src/tests/poSizewiseGrouping.test.tsx`:
   - Multiple single-size variant rows consolidate into 1 row with EU 36–44 populated.
   - Different colors of same article remain on separate rows.
   - Different articles remain on separate rows.
   - SizePivotMatrixA4 template grouping.
   - `buildGroupedSizewiseLines` variant aggregation, total quantity summation, and `sizeToLineIndex` pointer validation.
   - Business Terms & Statutory Conditions rendering across `PurchaseOrderPrintA4`, `FootwearPurchaseOrderA4`, and `SizePivotMatrixA4`.
2. `src/tests/poPrintBrandingAndTerms.test.tsx`:
   - Tattly Threads corporate coordinates and official image placeholder.
   - Default payment terms of 120 Days.
   - Dynamic 5% footwear GST calculation.
3. TypeScript compiler check (`npx tsc --noEmit`): 0 errors across entire codebase.
4. UX Field Governance Guard (`python scripts/ci_ux_field_governance_guard.py`): 0 critical violations.

---

## 9. Verification Results
```text
✓ Vitest Suite: 11/11 tests passed (poSizewiseGrouping.test.tsx, poPrintBrandingAndTerms.test.tsx)
✓ TypeScript Compilation: 0 errors (npx tsc --noEmit exited with code 0)
✓ Governance Guard: CI Field Governance Guard PASSED (0 critical violations)
✓ Code Diffs: Literal git diffs produced for all 10 modified files
```

---

## 10. Known Limitations
- If a vendor supplies custom non-numeric size codes (e.g., "S", "M", "L") outside the active size chart, they will appear in the matrix only if that custom size chart is selected in the Size Chart dropdown.

---

## 11. Future Work
- Add rich-text formatting (bold, bullet points) support for Business Terms in the print engine while preserving plain-text backwards compatibility.
- Integrate vendor-specific credit scorecards into the Commercial Drawer to suggest payment terms dynamically.

---

## 12. Related ADRs
- `ADR-0042`: Pure Functional Presentation Grouping for Multi-Variant Grids
- `ADR-0028`: Universal Document Print Engine Architecture

---

## 13. Related RFCs
- `RFC-2026-08`: Purchase Studio Live Matrix Consolidation and Commercial Contract Clauses
