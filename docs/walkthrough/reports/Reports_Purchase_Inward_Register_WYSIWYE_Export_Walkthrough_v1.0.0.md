<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail OS — Reports & BI: Purchase Inward Register (GRN) WYSIWYE Export Parity & 1-Click Sub-Ledger Download

## 1. Purpose
This document details the implementation of complete What-You-See-Is-What-You-Export (WYSIWYE) fidelity for the **Purchase Inward Register (GRN)** report (`RPT-PUR-001`) in `src/components/ReportDesignerTab.tsx`. It ensures that all export channels (Excel/XLSX, CSV, JSON, HTML, and Google Sheets) dynamically adapt to the active view mode (`Detailed Line Items View` vs `GRN Summary View`), honor all active logistics facet filters (`Door Delivery` vs `Ex-Factory`, carrier, collection, search query), and provides a prominent 1-click **Export (XLSX)** action directly in the logistics facet command bar.

---

## 2. Scope
- **WYSIWYE Export Parity (`src/components/ReportDesignerTab.tsx`):**
  - Upgraded `handleOpenInGoogleSheets` for `RPT-PUR-001`:
    - When `grnViewMode === "grn_summary"`: exports receipt-level aggregated rows from `grnSummaryList` with summary columns (`itemCount`, `totalQty`, `totalTax`, `totalLanded`, `delivery_terms`, `transporter_name`).
    - When `grnViewMode === "detailed"`: exports line-item SKU rows from `filteredGrnLines` including all logistics columns (`delivery_terms`, `transporter_name`, `lr_number`, `collection_type`).
  - Upgraded `handleTriggerExport`:
    - Automatically sets `activeData` to `grnViewMode === "grn_summary" ? grnSummaryList : filteredGrnLines` when `selectedReport?.id === "RPT-PUR-001"`.
  - Filter Integrity:
    - Any active facet filter (`Door Delivery`, `Ex-Factory`, carrier dropdown, collection dropdown, or text search) is strictly preserved in the exported dataset.
- **Logistics Command Bar 1-Click Action:**
  - Added a dedicated 1-click **Export (XLSX)** button with live count tooltip next to the `Reset Filters` action in the command bar.
- **Automated Verification Suite (`src/tests/reportsPurchaseInwardWysiwyeExport.test.ts`):**
  - Created 5 automated Vitest unit tests verifying detailed vs summary export resolution, filtered subset export parity, and aggregate sum consistency.

---

## 3. Files Created
1. `docs/implementation/reports/Reports_Purchase_Inward_Register_WYSIWYE_Export_Plan_v1.0.0.md` — Formal 19-section IPGP implementation plan.
2. `src/tests/reportsPurchaseInwardWysiwyeExport.test.ts` — Comprehensive Vitest automated test suite.
3. `docs/walkthrough/reports/Reports_Purchase_Inward_Register_WYSIWYE_Export_Walkthrough_v1.0.0.md` — This WGP walkthrough document.

---

## 4. Files Modified
1. `src/components/ReportDesignerTab.tsx` — Added WYSIWYE export branching and 1-click Export (XLSX) command bar button.
2. `docs/implementation/README.md` — Updated master index table with plan status.
3. `docs/walkthrough/README.md` — Updated walkthrough master index with version `v3.142.0`.
4. `CHANGELOG.md` — Logged release notes under version `[6.99.10]`.

---

## 5. Architecture Decisions
1. **View-Aware Dynamic Schema Resolution:**
   - In traditional reporting, export triggers frequently dump the underlying raw SQL table regardless of the active UI grid mode. By conditioning schema resolution on `grnViewMode`, SMRITI Retail OS guarantees that an operator looking at receipt summary totals receives a receipt summary spreadsheet, while an operator looking at SKU-level breakdown receives SKU-level lines.
2. **Filter-Constrained In-Memory Export:**
   - Export payloads are generated from the active `useMemo` states (`filteredGrnLines` and `grnSummaryList`), ensuring zero round-trip lag and 100% parity between table rows on screen and rows in the downloaded workbook.
3. **High-Affordance Sub-ledger Extraction:**
   - Placing the 1-click Excel export button directly within the facet command bar allows finance auditors to toggle a carrier or delivery term and download the sub-ledger in two clicks without scrolling to top navigation menus.

---

## 6. Design Rationale
- **Carrier Bill Reconciliation:**
  When a transporter submits a bill for `Ex-Factory` shipments, accounts clerks filter by that carrier and `Ex-Factory`, then click **Export (XLSX)**. The resulting workbook contains only the relevant LR numbers and landed costs, ready for immediate vendor sign-off.
- **Auditing Integrity:**
  Eliminates accidental transmission of unfiltered or extraneous company procurement data to third-party logistics auditors.

---

## 7. Implementation Summary
```tsx
// handleTriggerExport WYSIWYE resolution
} else if (purchaseInwardData) {
  if (selectedReport?.id === "RPT-PUR-001") {
    activeData = grnViewMode === "grn_summary" ? grnSummaryList : filteredGrnLines;
  } else if (Array.isArray(purchaseInwardData)) {
    activeData = purchaseInwardData;
  }
...
```

---

## 8. Tests Executed
1. `npx vitest run src/tests/reportsPurchaseInwardWysiwyeExport.test.ts`
   - Test 1: Detailed view export generates SKU-level rows with logistics columns.
   - Test 2: Summary view export generates receipt-aggregated rows with item count and totals.
   - Test 3: WYSIWYE parity: exporting filtered Ex-Factory subset exports only Ex-Factory rows.
   - Test 4: WYSIWYE parity: exporting filtered carrier subset exports only matching carrier rows.
   - Test 5: Mathematical consistency: summary totals sum identically to detailed line totals.
2. `npx vitest run src/tests/reportsPurchaseInwardLogisticsFacets.test.ts` (8/8 passed).
3. `npx vitest run src/tests/reportsPurchaseInwardLogistics.test.ts` (4/4 passed).
4. `npx vitest run src/tests/grnLogisticsAndTerms.test.tsx` (4/4 passed).
5. `npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx` (15/15 passed).
6. `npx tsc --noEmit` — Clean compilation with 0 errors.

---

## 9. Verification Results
- **Automated Test Suite:** 36/36 tests passed across all related test suites.
- **TypeScript Static Verification:** 0 errors reported by `tsc --noEmit`.
- **Export Verification:** Verified that Detailed view, GRN Summary view, and active facet subsets export with exact column and row parity.

---

## 10. Known Limitations
- When exporting to PDF, printable pagination rules apply based on standard page margins; large datasets with > 500 rows should prefer XLSX or CSV.

---

## 11. Future Work
- Add scheduled automated email delivery of the carrier-reconciled sub-ledger to third-party freight auditors.

---

## 12. Related ADRs
- `ADR-0045`: Single-Store Daily Operational Reporting Architecture.
- `ADR-0061`: GRN Inward Landed Cost Multi-Component Allocation Architecture.

---

## 13. Related RFCs
- `RFC-2026-RPT-008`: Operational Retail Register Standardization & Multi-Format Export.
- `RFC-2026-PUR-004`: Purchase Order to GRN Commercial Logistics Inheritance.
