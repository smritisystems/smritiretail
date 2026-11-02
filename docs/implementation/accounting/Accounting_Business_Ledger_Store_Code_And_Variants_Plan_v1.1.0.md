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
  Classification: Implementation Plan (IPGP-v1.0)
-->

# Business Ledger Store Code & Item Variant Matrix Implementation Plan v1.1.0

## 1. Objective
Incorporate Store Code (SIS Code / delivery site identifier) and product variant dimensions (Article style code, Color, and Size) into the statutory Business Ledger (`BusinessLedgerTab.tsx`), preserving statutory sales register integrity, reference layout compliance, and high-performance search capabilities.

## 2. Business Motivation
In Modern Trade (B2B retail chains like Reliance Retail, Tata Trent, Aditya Birla), centralized purchase orders bill to a single parent company entity but dispatch merchandise across hundreds of discrete physical stores (SIS - Shop-in-Shop, footprint outlets). Accountants and logistics auditors must:
1. Identify store delivery destinations immediately without losing invoice-level aggregation.
2. Inspect footwear/apparel SKU items broken down by style Article, Colorway, and Size without exploding the master sales register rows into tens of thousands of fragmented lines.

## 3. Scope
- **Header / Register Level (Store Code):**
  - Add Store Code (`sis_code`) as a toggleable column via the `Columns` dropdown.
  - Support instant sorting on Store Code.
  - Index Store Code and Site Name into the register search filter (`1888`, `DIBRUGARH`, `FORTUNE CENTRAL`, etc.).
  - Include Store Code and Site / Store Name in the CSV export dataset.
  - Display Store Code and Site Name badges in the Selected Invoice destination card.
- **Line-Item Variant Level (Article, Color, Size):**
  - Canonical SKU token parser (`parseSkuTokens`) extracting Article code, Color, and Size from standard formatted codes (e.g. `CH-24-G-BLACK-36` -> `CH-24-G`, `BLACK`, `36`).
  - Upgrade "Item Details" Tab (Tab 2) in the right-hand invoice inspector with dedicated columns: `#`, `Article` (mono font), `Color` (visual badge), `Size` (pill badge), `Description / HSN`, `Qty`, `Rate`, `Total`.
  - Add an inline item search filter input to quickly search across line items by Article or Color.

## 4. Current State
- `BusinessLedgerTab.tsx` implemented the statutory sales register v1.0.0 based on live PostgreSQL data.
- The master register API returns `sis_code` and `site_name` for each invoice.
- The invoice items endpoint returns canonical SKU codes (`CH-24-G-BLACK-36`) in the line items.
- Line items previously rendered in a generic 5-column table (`#`, `Item / Description`, `Qty`, `Rate`, `Amount`) without variant decomposition.

## 5. Gap Analysis
- **Missing Delivery Site Visibility:** Operators had to open invoice details to view the delivery store location.
- **Variant Flattening:** Footwear and apparel items were displayed as concatenated strings rather than structured matrix tokens (Article, Color, Size).
- **Search Limitation:** Register search only queried invoice number, customer name, and GSTIN, omitting delivery store codes (`1888`).

## 6. Architecture Impact
- **No Schema Changes Required:** Leveraged existing `sales_invoices.sis_code`, `site_name`, and `sales_invoice_items.sku_code` fields.
- **No API Changes Required:** Reused `/api/v1/reports/tax-invoices-master-register` and `/api/v1/sales/invoices/by-number/{invoice_no}`.
- **Zero Register Distortion:** Master invoice register maintains 1-row-per-tax-invoice statutory invariant; variant breakdown is strictly confined to the line-item inspector tab.

## 7. Proposed Design
- Header register adds `storeCode: false` default column visibility, toggled via `Columns` popover.
- Selected invoice card surfaces `<Store className="w-3.5 h-3.5" /> Store: {invoice.sis_code}` and destination address.
- Item Details tab renders:
  ```
  | # | Article | Color | Size | Description / HSN | Qty | Rate | Total |
  ```
- Sub-filters allow instantaneous in-memory search across up to hundreds of invoice line items.

## 8. Files Created
- `docs/walkthrough/accounting/evidence/business_ledger_item_details.png`: High-resolution visual proof of the Item Details tab showing Article, Color, and Size columns.
- `docs/implementation/accounting/Accounting_Business_Ledger_Store_Code_And_Variants_Plan_v1.1.0.md`: This implementation plan.
- `docs/walkthrough/accounting/Accounting_Business_Ledger_Store_Code_And_Variants_v1.1.0.md`: Formal WGP walkthrough.

## 9. Files Modified
- `src/components/BusinessLedgerTab.tsx`: Added Store Code column, search indexing, CSV export, and Item Details variant breakdown.
- `src/tests/businessLedgerTab.test.tsx`: Added unit test suites for `parseSkuTokens` and Store Code search filtering.
- `docs/implementation/README.md`: Appended plan entry to master index.
- `docs/walkthrough/README.md`: Appended walkthrough entry to master index.

## 10. Dependencies
- `lucide-react`: `Store`, `Tag` icons.
- `apiFetchV1`: Transactional API client.
- Vitest: Unit test runner.

## 11. Risks
- *Risk:* Non-standard SKU codes failing regex tokenization.
  *Mitigation:* `parseSkuTokens` includes safe fallback logic returning the raw code as article and `—` for color/size.

## 12. Rollback Strategy
- Revert git commit to restore previous `BusinessLedgerTab.tsx` v1.0.0 without database migrations or schema adjustments.

## 13. Verification Plan
- Unit tests validating `parseSkuTokens` across standard styles (`CH-24-G-BLACK-36`, `SND-01-C-GOLD-38`, `CH-18-E-BROWN-40`).
- Register search tests verifying matches on `sis_code` and `site_name`.
- Headless Playwright automated browser verification capturing rendered Item Details tab.

## 14. Test Plan
- Run `npx vitest run src/tests/businessLedgerTab.test.tsx` (13/13 passing).
- Run `npx tsc --noEmit` (0 errors).
- Run `npm run build` (production asset compilation).

## 15. Documentation Impact
- Update `docs/walkthrough/README.md`.
- Update `docs/implementation/README.md`.
- Generate WGP walkthrough `Accounting_Business_Ledger_Store_Code_And_Variants_v1.1.0.md`.

## 16. Deployment Plan
- Push to branch `smritiNX`.
- Deploy automatically via CI/CD test runner.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-005`: Statutory Tax Invoice Amendment & Lifecycle Policy
- `ADR-012`: Sole Backend System of Record (FastAPI + Postgres)

## 19. Related Walkthroughs
- `docs/walkthrough/accounting/Business_Ledger_UX_Transformation_v1.0.0.md`
- `docs/walkthrough/accounting/Accounting_Business_Ledger_Store_Code_And_Variants_v1.1.0.md`
