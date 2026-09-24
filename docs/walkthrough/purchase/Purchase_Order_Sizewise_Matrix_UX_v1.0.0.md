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
- `src/components/PurchaseStudioTab.tsx`: Added dual-mode switcher with local storage persistence.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.
- `CHANGELOG.md`: Release notes and change ledger update.

## 5. Architecture Decisions
- **Standalone Component vs Bloating `PoGenerateTab`:** Rather than adding another complex view mode to `PoGenerateTab.tsx` (which is already ~2,600 lines), creating `PoSizewiseTab.tsx` as a dedicated standalone component cleanly decouples concerns, simplifies future size-matrix extensions (such as customizable size scales), and avoids regressions in the existing PO test suite.
- **Dual-Mode Ergonomics in `PurchaseStudioTab`:** Fashion and apparel retailers often have buyers who specialize in matrix orders while hardware or grocery buyers use standard single-line entries. The header mode switcher in `PurchaseStudioTab.tsx` provides both modes with instant toggling and remembers operator preference.
- **Local Date Arithmetic:** `addDaysToDate` formats date strings using local date components (`getFullYear`, `getMonth`, `getDate`) instead of `toISOString()`, preventing UTC timezone shifts from corrupting calendar dates in positive timezone regions like IST (+05:30).

## 6. Design Rationale
- The layout closely replicates the operator reference terminal design provided in the specification screenshot (`media_1790273261841.png`), ensuring immediate operational familiarity for retail purchase managers without retraining.
- Matrix cells accept direct keyboard tab traversal across sizes S through XXL, enabling continuous high-speed data entry.

## 7. Implementation Summary
- Initialized `PoSizewiseTab.tsx` with complete header, 3-tab layout, matrix table, size summary, financial summary, and action footer.
- Exported core calculation engine `calculateSizewiseSummaryTotals` allowing unit tests to verify mathematical correctness independently of DOM rendering.
- Implemented real-time percentage distribution math: `(perSizeTotals[sz] / grandTotalQty) * 100`.
- Integrated `apiFetchV1` endpoints for supplier fetching (`/purchase/suppliers/`), sequence generation (`/purchase/orders/next-number`), previous order copying (`/purchase/orders/`), and draft/confirmed order creation (`/purchase/orders/`).
- Updated `PurchaseStudioTab.tsx` to host both `PoSizewiseTab` and `PoGenerateTab` with a switcher header pill.

## 8. Tests Executed
```bash
npx vitest run src/tests/poSizewiseUX.test.ts src/tests/poGenerateUX.test.ts
```
Output:
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/poSizewiseUX.test.ts (7 tests) 8ms
 ✓ src/tests/poGenerateUX.test.ts (6 tests) 7ms

 Test Files  2 passed (2)
      Tests  13 passed (13)
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
 ✓ src/tests/poSizewiseUX.test.ts (7 tests) 9ms
 ✓ src/tests/poLifecycle.test.ts (3 tests) 4ms
 ✓ src/tests/poGenerateUX.test.ts (6 tests) 7ms

 Test Files  7 passed (7)
      Tests  46 passed (46)
```

Typecheck and architecture gates:
```bash
npm run lint
python scripts/architecture_duplication_gate.py
python scripts/ci_ux_field_governance_guard.py
```
Output:
```text
> tsc --noEmit (Exit 0)
CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected. (11 checks executed, 0 violations)
CI GUARD RESULT: PASS WITH EXPLICIT EXCEPTIONS (Critical/Error Violations: 0)
```

## 9. Verification Results
| Verification Item | Target | Result | Status |
|---|---|---|---|
| Size Column Totals | S: 85, M: 100, L: 100, XL: 65, XXL: 20 | S: 85, M: 100, L: 100, XL: 65, XXL: 20 | Done |
| Grand Total Quantity | 370 units | 370 units | Done |
| Size Percentage Share | S: 22.97%, M: 27.03%, L: 27.03%, XL: 17.57%, XXL: 5.41% | Exact match | Done |
| Gross Order Value | ₹37,140.00 | ₹37,140.00 | Done |
| Total GST Tax | ₹6,685.20 | ₹6,685.20 | Done |
| Net PO Value | ₹43,825.20 | ₹43,825.20 | Done |
| Unit Test Suite | 7/7 tests | 7/7 passed | Done |
| Purchase Regression Suite | 46/46 tests | 46/46 passed | Done |
| TypeScript Compiler | 0 errors | 0 errors | Done |
| Architecture Duplication Gate | 0 violations | 0 violations | Done |

## 10. Known Limitations
- The default size scale is fixed to `S, M, L, XL, XXL`. Future iterations will allow dynamic size scale selection (e.g. numeric footwear sizes `6, 7, 8, 9, 10, 11` or kidswear `2, 4, 6, 8, 10`).

## 11. Future Work
- Add user-configurable custom size scales from category master.
- Add direct Excel export of the size matrix template.

## 12. Related ADRs
- `ADR-0042`: Canonical Component Architecture and Capability Ownership Declarations.
- `ADR-0089`: Unified API Communication Layer via `apiFetchV1`.

## 13. Related RFCs
- `RFC-2026-PO-SIZEWISE-UX`: Modern Retail Matrix Purchase Order Ergonomics.
