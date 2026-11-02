<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-11-02
  Modified     : 2026-11-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan (IPGP-v1.0)
-->

# SMRITI Business Ledger UX Transformation Implementation Plan v1.0.0

## 1. Objective
Transform the SMRITI Business Ledger (`BusinessLedgerTab.tsx`, module ID: `business-ledger`) into a modern, high-density, reference-exact Statutory Sales Register and Tax Invoice intelligence dashboard matching the authoritative reference UX specification. The interface must provide statutory accounting visibility, KPI metric rollups, interactive invoice exploration, deep 5-tab invoice inspection, and monthly revenue/count bar chart visualization while operating entirely against live PostgreSQL tax invoice records.

## 2. Business Motivation
Statutory tax accounting and B2B audit compliance require finance teams, store controllers, and auditors to inspect posted sales tax invoices rapidly without navigating away from the ledger canvas. The previous ledger implementation lacked visual hierarchy, lacked synchronized item/tax breakdowns, and had no monthly trend visualization or flexible export mechanisms. The updated design delivers immediate financial visibility, precise GST liability tracking, and frictionless tax invoice inspection.

## 3. Scope
- **Header & Filter Suite:**
  - Standardized title: "Business Ledger"
  - Statutory subtitle: "Statutory Sales Register (Tax Invoices)"
  - Period selector with predefined ranges and custom date boundaries
  - Customer selection dropdown populated dynamically from live invoices
  - Invoice status dropdown (`All Status`, `Submitted`, `Draft`, `Cancelled`)
  - Filter Reset and Apply actions
- **KPI Summary Ribbon:**
  - 4 cards: Gross Invoice Value, Tax Invoices, GST Invoiced, Average Invoice Value
  - Contextual help tooltips and period-over-period comparative trend chips
  - Financial exclusion: Cancelled invoices excluded from statutory monetary totals
- **Two-Column Responsive Split Canvas:**
  - **Left Column:** Interactive Invoice Register table with selectable rows, sorting, search filter (invoice number, customer name, GSTIN), column visibility manager, export menu (CSV, Excel, JSON), print trigger, and pagination controls.
  - **Right Column Top:** Selected Invoice Details inspector featuring 5 active tabs (`Invoice Details`, `Item Details`, `Tax Breakdown`, `Payments`, `Activity`), customer identity card with copyable GSTIN, grand total callout, financial breakdown, and logistics badges.
  - **Right Column Bottom:** Monthly Invoice Totals bar chart featuring Indian currency axes (`₹ Cr`, `₹ L`, `₹ K`), tooltips, bar value labels, and Value/Count toggle.

## 4. Current State
The pre-existing `src/components/BusinessLedgerTab.tsx` was a skeletal table with limited filtering, no interactive detail panel, no monthly chart aggregation, and incomplete GST breakdown synchronization.

## 5. Gap Analysis
1. **Visual Alignment:** The legacy view did not conform to the modern SMRITI enterprise design tokens.
2. **KPI Mathematical Consistency:** No automated rollup of active posted invoices with period-over-period trend indicators.
3. **Detail Inspection:** Users had to leave the ledger or trigger separate modals to view items, tax splits, or payment statuses.
4. **Data Visualisation:** Absence of a monthly aggregation chart reflecting seasonality and billing volume.
5. **Formatting:** Missing standardized Indian numbering formatting (`en-IN`) across chart axes and financial values.

## 6. Architecture Impact
- **Frontend Architecture:** Replaced monolithic legacy component with modular sub-components and reactive state hooks in `src/components/BusinessLedgerTab.tsx`.
- **Backend Architecture:** Reused authoritative FastAPI endpoints:
  - `GET /api/v1/reports/tax-invoices-master-register` for register rollups.
  - `GET /api/v1/sales/invoices/by-number/{invoice_no}` and `GET /api/v1/sales/invoices/{id}` for 5-tab detail hydration.
- **Database Architecture:** Zero schema changes required; operates directly on PostgreSQL `sales_invoices`, `sales_invoice_items`, `customers`, and `companies` tables.

## 7. Proposed Design
- Recharts-powered responsive bar chart with custom tooltips and Indian numbering formatting.
- 5-tab selected invoice inspector with reactive state:
  - Tab 1: Invoice Details (Taxable value, GST rate breakdown, round-off, grand total, items/quantity, supply type, place of supply).
  - Tab 2: Item Details (Tabular SKU, HSN, quantity, price, tax, line total).
  - Tab 3: Tax Breakdown (CGST, SGST, IGST statutory matrix).
  - Tab 4: Payments (Settlement method, paid amount, ledger balance).
  - Tab 5: Activity (Audit trail, timestamps, user attribution).

## 8. Files Created
1. `src/tests/businessLedgerTab.test.tsx` — 12 Vitest unit tests verifying calculations, formatters, filters, and rendering.
2. `scratch/capture_business_ledger.py` — Automated headless Playwright visual verification script.
3. `docs/walkthrough/accounting/Business_Ledger_UX_Transformation_v1.0.0.md` — WGP-compliant walkthrough document.
4. `docs/implementation/accounting/Business_Ledger_UX_Transformation_Plan_v1.0.0.md` — This implementation plan.

## 9. Files Modified
1. `src/components/BusinessLedgerTab.tsx` — Complete reference-exact UX rewrite.
2. `docs/implementation/README.md` — Chronological master index update.
3. `docs/walkthrough/README.md` — Chronological master walkthrough index update.

## 10. Dependencies
- React 18.3.1
- Recharts 2.12.7
- Lucide React 0.395.0
- Vitest 4.1.11
- FastAPI backend on port 1981

## 11. Risks
- Large invoice datasets (>5,000 records) could cause client-side rendering lag if pagination is bypassed.
- Mitigation: Enforced client/server pagination with fixed 10-row page sizes and memoized aggregation.

## 12. Rollback Strategy
If regressions occur, revert git commit on `src/components/BusinessLedgerTab.tsx` via `git checkout HEAD~1 -- src/components/BusinessLedgerTab.tsx`. Backend and database remain completely unimpacted.

## 13. Verification Plan
1. Static analysis: `npx tsc --noEmit` exit 0.
2. Unit tests: `npx vitest run src/tests/businessLedgerTab.test.tsx` (12/12 passing).
3. Production bundling: `npm run build` exit 0.
4. Visual verification: Automated headless Playwright screenshot comparison against reference specification.

## 14. Test Plan
- Test KPI formula correctness (Gross, Tax Invoices count, GST invoiced, Average invoice value).
- Test cancelled invoice exclusion rule from financial sums.
- Test Indian currency formatters (`formatINR`, `formatIndianShortCurrency`).
- Test search filtering by invoice number, customer name, and GSTIN.
- Test monthly aggregation for value and count.
- Test 5-tab detail payload structure.

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Update `docs/walkthrough/README.md`
- Create walkthrough under `docs/walkthrough/accounting/`

## 16. Deployment Plan
Standard CI/CD merge to `smritiNX` branch and build artifact deployment.

## 17. Status
**Completed** (Verified per Rules 1–12 of `AGENTS.md`).

## 18. Related ADRs
- `ADR-005`: Statutory Tax Invoice Amendment & Lifecycle Policy
- `ADR-012`: Sole Backend System of Record (FastAPI + Postgres)

## 19. Related Walkthroughs
- `docs/walkthrough/accounting/Business_Ledger_UX_Transformation_v1.0.0.md`
- `docs/walkthrough/reports/Report_Builder_Collapsible_Panels_And_Focus_Mode_v1.0.0.md`

