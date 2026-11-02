<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-11-02
  Modified     : 2026-11-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough (WGP-v1.0)
-->

# Statutory Sales Register: Store Code & Product Variant Matrix Walkthrough v1.1.0

## 1. Purpose
This walkthrough documents the incorporation of Store Code (delivery site identifier / SIS code) and product variant matrix attributes (Article style code, Color, and Size) into the SMRITI Business Ledger (`BusinessLedgerTab.tsx`, module ID: `business-ledger`). This enhancement empowers enterprise retail accountants and Modern Trade supply chain auditors to verify physical delivery store destinations and item variant assortments without corrupting statutory tax invoice totals or bloating the sales register table.

## 2. Scope
- **Store Code Integration:**
  - Added optional toggleable `Store Code` column to the main Invoice Register table via the `Columns` dropdown.
  - Implemented column sorting on `sis_code`.
  - Added search indexing for `sis_code` and `site_name` in the global register search bar.
  - Added Store Code and Site / Store Name to CSV data export.
  - Displayed prominent Store Code and destination store name badges in the Selected Invoice details summary.
- **Article, Color, and Size Variant Matrix:**
  - Implemented canonical SKU token parser `parseSkuTokens(code, name)` extracting `article`, `color`, and `size`.
  - Upgraded Tab 2 ("Item Details") in the Selected Invoice inspector into a high-density variant table featuring:
    - `#` (Row index)
    - `Article` (Blue monospace styled style code)
    - `Color` (Neutral badge with tag icon)
    - `Size` (Emerald/slate rounded pill badge)
    - `Description / HSN`
    - `Qty` (Right-aligned numeric quantity)
    - `Rate` (Right-aligned INR rate)
    - `Total` (Right-aligned bold INR line total)
  - Integrated inline instant search input inside the Item Details tab to filter line items by Article or Color.

## 3. Files Created
- `docs/walkthrough/accounting/evidence/business_ledger_item_details.png`: High-resolution visual proof of the Item Details tab showing Article, Color, and Size columns.
- `docs/implementation/accounting/Accounting_Business_Ledger_Store_Code_And_Variants_Plan_v1.1.0.md`: Formal IPGP implementation plan.
- `docs/walkthrough/accounting/Accounting_Business_Ledger_Store_Code_And_Variants_v1.1.0.md`: This walkthrough document.

## 4. Files Modified
- `src/components/BusinessLedgerTab.tsx`: Added Store Code column, search indexing, CSV export, and Item Details variant breakdown.
- `src/tests/businessLedgerTab.test.tsx`: Added unit test suites for `parseSkuTokens` and Store Code search filtering.
- `docs/implementation/README.md`: Appended new implementation plan entry to master index.
- `docs/walkthrough/README.md`: Appended new walkthrough entry to master index.

## 5. Architecture Decisions
1. **Statutory Register Integrity:** Exploding product variants (101 items / 152 pairs per invoice) onto the primary invoice register table would transform 110 invoices into 11,000 rows, corrupting statutory page totals and breaking GST sales register alignment. Consequently, Store Code was placed at the Invoice Header level, while Article, Color, and Size were placed at the Line-Item Variant level inside the "Item Details" Tab.
2. **Canonical SKU Tokenization:** Footwear and apparel SKUs follow deterministic tokenization `<ARTICLE>-<COLOR>-<SIZE>`. The parser reliably isolates the Article style code, Colorway, and Size without requiring database schema changes or extra backend endpoints.
3. **Toggleable Column Visibility:** Store Code is integrated via the existing `visibleColumns` preference state (`storeCode: false` by default, easily enabled via the `Columns` dropdown), preserving the exact default layout matching the authoritative design reference.

## 6. Design Rationale
- **Dual-Level Visibility:** Supply chain auditors need to quickly confirm which Reliance Retail or Trent store received an invoice (`1888 - RRL FOOTPRINT RKB PATH DIBRUGARH AS`). Store Code on the invoice card and optional table column provides immediate clarity.
- **Micro Typography & Pill Badges:** Monospace styling for Article codes guarantees immediate readability; rounded badges for Color and Size ensure instant visual scannability during invoice auditing.
- **Zero Network Overhead:** Line-item variant filtering and column toggling are performed instantaneously in client state at 0ms latency.

## 7. Implementation Summary
- **Header / Register:** Added `Store Code` column with sort toggle; enriched `filteredInvoices` filter with `inv.sis_code` and `inv.site_name` matching; updated `handleExportCsv` with `Store Code` and `Site / Store Name`.
- **Destination Card:** Added `<Store className="w-3.5 h-3.5 text-blue-600" /> Store: {selectedInvoice.sis_code}` and destination address chip.
- **Item Details Tab:** Replaced basic 5-column table with an 8-column variant matrix (`#`, `Article`, `Color`, `Size`, `Description / HSN`, `Qty`, `Rate`, `Total`) and added an inline filter input (`itemSearchQuery`).

## 8. Tests Executed
Executed Vitest test suite `src/tests/businessLedgerTab.test.tsx`:
```bash
npx vitest run src/tests/businessLedgerTab.test.tsx
```
Terminal Output:
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/businessLedgerTab.test.tsx (13 tests) 68ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  20:07:52
   Duration  1.82s (transform 230ms, setup 0ms, import 1.36s, tests 68ms, environment 0ms)
```

Executed TypeScript Static Analysis:
```bash
npx tsc --noEmit
```
Terminal Output: `exit 0` (0 errors).

Executed Vite Production Build:
```bash
npm run build
```
Terminal Output:
```
✓ 3751 modules transformed.
dist/assets/BusinessLedgerTab-DWyaRNRf.js  104.28 kB │ gzip:  14.65 kB
✓ built in 1m 08s
```

## 9. Verification Results
Automated visual verification was captured using headless Playwright:
- **Visual Artifact:** `docs/walkthrough/accounting/evidence/business_ledger_item_details.png`
- **Confirmation:** The Item Details tab displays the live invoice items with Article (`CH-24-G`), Color badge (`BLACK`), Size pill (`36`), HSN (`64039990`), and calculated line totals in high definition.

## 10. Known Limitations
- SKU codes lacking the standard `<ARTICLE>-<COLOR>-<SIZE>` hyphenation fallback gracefully to displaying the full code in the Article column with `—` for color and size.

## 11. Future Work
- Add batch barcode printing directly from the Item Details tab for inwarded retail stock.
- Introduce size-curve matrix view (pivot table of Article x Size with Qty cells) for bulk footwear consignments.

## 12. Related ADRs
- `ADR-005`: Statutory Tax Invoice Amendment & Lifecycle Policy
- `ADR-012`: Sole Backend System of Record (FastAPI + Postgres)

## 13. Related RFCs
- `RFC-089`: High-Density Enterprise Sales & Statutory Ledger Canvas Standard
- `RFC-094`: Footwear & Apparel SKU Tokenization and Variant Matrix Standard
