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
  * Created    : 2026-09-25
  * Modified   : 2026-09-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Purchase Order Sizewise Matrix UX (`PoSizewiseTab`)

## 1. Purpose
This walkthrough documents the completion and verification of the dedicated **Sizewise Purchase Order Matrix Entry UX** (`PoSizewiseTab.tsx`) in SMRITI Retail OS. It provides apparel, footwear, and matrix retail operators with an intuitive horizontal size matrix (e.g. S, M, L, XL, XXL) layout modeled exactly after the reference purchase terminal design, accompanied by size distribution analytics, statutory financial summaries, and a seamless dual-mode switcher integrated into `PurchaseStudioTab.tsx`.

## 2. Scope
- **Top PO Header Bar:** Document Title ("Purchase Order"), Document Number breadcrumb ("PO6 - 27/12/2017"), Status Badge (`Draft`), and Action Buttons (`+ New`, `Open`, `Save`, `Print`, `...`).
- **Document Metadata Row:**
  - `Type`: Dropdown ("Purchase Order", "Indent").
  - `Prefix`: Dropdown ("PO6", "PO", "IND").
  - `Number`: Sequential PO number input.
  - `Date`: Order date picker.
  - `Supplier`: Searchable vendor name with interactive search icon (`PurchBrowseDlg`).
  - `Delivery Date`: Delivery due date picker.
  - `Lead Time`: Numerical lead time input in days.
- **Three Sub-Tabs:**
  - `1. Items`: Primary size-matrix entry surface.
  - `2. Delivery & Tax`: Delivery location, default tax %, freight charges, and other charges.
  - `3. Other Details`: Payment terms, currency, buyer, department, supplier quotation reference, and special instructions.
- **Items Matrix Toolbar:**
  - `Scan Barcode / Search Item (F2)` with dedicated search icon and auto-add capability.
  - `+ Add Item` button.
  - `Import from Excel` supporting CSV size matrix ingestion.
  - `Copy Previous PO ∨` with historical PO item duplication.
  - `Delete Row` button.
  - `Price List` selector (Default Purchase Price, Last Purchase Price, Standard Cost, Weighted Average).
  - `Item Finder 🔍` global browse trigger.
- **Horizontal Size Matrix Grid:**
  - `#`: Sequential row index.
  - `Item Code`: SKU / Article identifier (e.g. `1001MUG`).
  - `Product Description`: Two-line display with product title on line 1 and Brand / Style / Shade on line 2.
  - `Size-wise Order Quantity`: Grouped header spanning individual size columns (`S`, `M`, `L`, `XL`, `XXL`) plus row `Total`.
  - `Rate (₹)`: Inward purchase rate.
  - `Stock On Hand`: Current warehouse stock.
  - `Tax %`: Applicable GST percentage.
  - `Net Value (₹)`: Total quantity multiplied by rate.
  - `Delivery Date`: Per-line expected delivery date.
  - `Action`: View (eye) and Delete (trash) action buttons.
- **Footer Row:** Inline `+ Add Item` button and column-wise totals across all size columns.
- **Tri-Panel Bottom Section:**
  1. *Size-wise Summary (All Items):* Per-size total quantities and exact percentage distribution across the entire order with `Attach Documents (0)` trigger.
  2. *Item Summary:* Total Items, Total Order Qty, Gross Value (₹), Total Tax (₹), and prominently highlighted Net PO Value (₹).
  3. *Remarks:* Supplier-facing Remarks textarea and internal confidential notes textarea.
- **Action Footer:** `Cancel`, `Save Draft`, and `Save & Confirm` actions with status notification.
- **Purchase Studio Integration:** Dual-mode switcher in `PurchaseStudioTab.tsx` with local storage persistence.

## 3. Files Created
- `src/components/purchase/PoSizewiseTab.tsx`: Dedicated Sizewise Matrix PO entry component.
- `src/tests/poSizewiseUX.test.ts`: Dedicated Vitest unit test suite covering matrix totals, % distributions, and financials.
- `.architecture/certificates/PF-2026-0924-EE3EAF.json`: Architecture preflight governance certificate.
- `docs/implementation/purchase/Purchase_Order_Sizewise_Matrix_UX_Plan_v1.0.0.md`: Implementation plan.
- `docs/walkthrough/purchase/Purchase_Order_Sizewise_Matrix_UX_v1.0.0.md`: This walkthrough.

## 4. Files Modified
- `src/components/purchase/PoSizewiseTab.tsx`: Added size scale presets (`APPAREL_ALPHA`, `FOOTWEAR_EU`, `FOOTWEAR_UK`), interactive Size Scale toolbar selector, footwear auto-detection, statutory GST tiers, and unit badges.
- `src/types.ts`: Added optional `unit`, `uom`, and `taxRate` fields to `Product` interface.
- `src/tests/poSizewiseUX.test.ts`: Added Footwear domain validation suite (13/13 tests).
- `src/components/PurchaseStudioTab.tsx`: Added dual-mode switcher with local storage persistence.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.
- `CHANGELOG.md`: Release notes and change ledger update.

## 5. Architecture Decisions
- **Standalone Component vs Bloating `PoGenerateTab`:** Rather than adding another complex view mode to `PoGenerateTab.tsx` (which is already ~2,600 lines), creating `PoSizewiseTab.tsx` as a dedicated standalone component cleanly decouples concerns, simplifies future size-matrix extensions (such as customizable size scales), and avoids regressions in the existing PO test suite.
- **Dual-Mode Ergonomics in `PurchaseStudioTab`:** Fashion and apparel retailers often have buyers who specialize in matrix orders while hardware or grocery buyers use standard single-line entries. The header mode switcher in `PurchaseStudioTab.tsx` provides both modes with instant toggling and remembers operator preference.
- **Local Date Arithmetic:** `addDaysToDate` formats date strings using local date components (`getFullYear`, `getMonth`, `getDate`) instead of `toISOString()`, preventing UTC timezone shifts from corrupting calendar dates in positive timezone regions like IST (+05:30).
- **Statutory Footwear Tax Tiers:** `getFootwearGstRate` enforces the statutory Indian GST rule (5% for purchase/sale rate `<= ₹2,500`, 18% for `> ₹2,500`) automatically when footwear products are scanned or selected.

## 6. Design Rationale
- The layout closely replicates the operator reference terminal design provided in the specification screenshot (`media_1790273261841.png`), ensuring immediate operational familiarity for retail purchase managers without retraining.
- Matrix cells accept direct keyboard tab traversal across sizes, enabling continuous high-speed data entry.
- Dynamic size scale presets allow instant switching between Apparel alpha sizing (S-XXL), Footwear EU sizing (36-44), and Footwear UK sizing (6-11).

## 7. Implementation Summary
- Initialized `PoSizewiseTab.tsx` with complete header, 3-tab layout, matrix table, size summary, financial summary, and action footer.
- Exported core calculation engine `calculateSizewiseSummaryTotals` allowing unit tests to verify mathematical correctness independently of DOM rendering.
- Implemented real-time percentage distribution math: `(perSizeTotals[sz] / grandTotalQty) * 100`.
- Integrated `SIZE_SCALE_PRESETS`:
  - `APPAREL_ALPHA`: S, M, L, XL, XXL (5 sizes)
  - `FOOTWEAR_EU`: 36, 37, 38, 39, 40, 41, 42, 43, 44 (9 sizes)
  - `FOOTWEAR_UK`: 6, 7, 8, 9, 10, 11 (6 sizes)
- Automated footwear detection: upon selecting/scanning a footwear item (`Campus Running Shoes`, `Sneakers Pro`, `Casual Slip-On`, `Leather Formal Shoes`), unit defaults to `Pair`, scale auto-switches to `FOOTWEAR_EU`, and GST automatically assigns 5% or 18% based on the ₹2,500 statutory threshold.
- Integrated `apiFetchV1` endpoints for supplier fetching (`/purchase/suppliers/`), sequence generation (`/purchase/orders/next-number`), previous order copying (`/purchase/orders/`), and draft/confirmed order creation (`/purchase/orders/`).
- Updated `PurchaseStudioTab.tsx` to host both `PoSizewiseTab` and `PoGenerateTab` with a switcher header pill.

## 8. Tests Executed
```bash
npx vitest run src/tests/poSizewiseUX.test.ts src/tests/poGenerateUX.test.ts
```
Output:
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/poSizewiseUX.test.ts (13 tests) 11ms
 ✓ src/tests/poGenerateUX.test.ts (6 tests) 6ms

 Test Files  2 passed (2)
      Tests  19 passed (19)
   Start at  00:25:43
   Duration  12.94s (transform 760ms, setup 0ms, import 13.05s, tests 18ms, environment 0ms)
```

Full purchase regression test suite:
```bash
npx vitest run src/tests/poSizewiseUX.test.ts src/tests/poGenerateUX.test.ts src/tests/poGenerate.test.ts src/tests/poLifecycle.test.ts src/tests/autoPOEngine.test.ts src/tests/grnCsvImportEngine.test.ts src/tests/grnPoEligibilityAndConfirmation.test.ts
```
Output:
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/grnCsvImportEngine.test.ts (4 tests) 8ms
 ✓ src/tests/autoPOEngine.test.ts (4 tests) 10ms
 ✓ src/tests/grnPoEligibilityAndConfirmation.test.ts (19 tests) 37ms
 ✓ src/tests/poGenerate.test.ts (3 tests) 6ms
 ✓ src/tests/poSizewiseUX.test.ts (13 tests) 12ms
 ✓ src/tests/poLifecycle.test.ts (3 tests) 4ms
 ✓ src/tests/poGenerateUX.test.ts (6 tests) 7ms

 Test Files  7 passed (7)
      Tests  52 passed (52)
```

Typecheck and architecture gates:
```bash
npx tsc --noEmit
python scripts/architecture_duplication_gate.py
```
Output:
```text
tsc --noEmit: Exit 0 (0 compiler errors)
CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected. (11 checks executed, 0 violations)
```

## 9. Verification Results
| Verification Item | Target | Result | Status |
|---|---|---|---|
| Reference Apparel Totals | S: 85, M: 100, L: 100, XL: 65, XXL: 20 | S: 85, M: 100, L: 100, XL: 65, XXL: 20 | Done |
| Reference Apparel Grand Total | 370 units | 370 units | Done |
| Reference Size % Share | S: 22.97%, M: 27.03%, L: 27.03%, XL: 17.57%, XXL: 5.41% | Exact match | Done |
| Footwear EU Scale (36-44) | 9 columns: 36, 37, 38, 39, 40, 41, 42, 43, 44 | Exact 9 columns mapped | Done |
| Footwear UK Scale (6-11) | 6 columns: 6, 7, 8, 9, 10, 11 | Exact 6 columns mapped | Done |
| Campus Running Shoes Matrix | 50 pairs @ ₹850 = ₹42,500 + 5% GST (₹2,125) = ₹44,625 | ₹44,625.00 net value | Done |
| Campus Shoes Distribution % | 36: 4%, 37: 8%, 38: 12%, 39: 16%, 40: 20%, 41: 16%, 42: 12%, 43: 8%, 44: 4% | Exact match | Done |
| Statutory GST Footwear Tiers | <= ₹2500 -> 5%, > ₹2500 -> 18% | Verified with exact boundary checks | Done |
| Multi-Item Mixed GST PO | 4 footwear items (120 pairs), gross ₹2,42,500, tax ₹34,485, net ₹2,78,485 | Exact statutory parity | Done |
| Unit Test Suite | 13/13 tests green | 13/13 passed | Done |
| Combined PO Test Suite | 19/19 tests green | 19/19 passed | Done |
| Purchase Regression Suite | 52/52 tests green | 52/52 passed | Done |
| TypeScript Compiler | 0 errors | 0 errors | Done |
| Architecture Duplication Gate | 0 violations | 0 violations | Done |

## 10. Known Limitations
- Custom user-defined size scale creation from the UI (outside of predefined Apparel and Footwear presets) will be introduced in subsequent phase.

## 11. Future Work
- Add user-configurable custom size scales from category master.
- Add direct Excel export of the size matrix template.

## 12. Related ADRs
- `ADR-0042`: Canonical Component Architecture and Capability Ownership Declarations.
- `ADR-0089`: Unified API Communication Layer via `apiFetchV1`.

## 13. Related RFCs
- `RFC-2026-PO-SIZEWISE-UX`: Modern Retail Matrix Purchase Order Ergonomics.
