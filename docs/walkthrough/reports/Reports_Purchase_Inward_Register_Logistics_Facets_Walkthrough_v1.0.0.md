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

# Walkthrough: SMRITI Retail OS — Reports & BI: Purchase Inward Register (GRN) Interactive Logistics Facet Filter Chips & Dynamic KPI Drilldown

## 1. Purpose
This document details the design and implementation of the interactive, multi-dimensional logistics facet filter bar for the **Purchase Inward Register (GRN)** report (`RPT-PUR-001`) in `src/components/ReportDesignerTab.tsx`. It provides store managers, procurement teams, and accounts auditors with instantaneous 1-click filtering by commercial delivery terms, carriers, and collections, paired with real-time KPI card re-calculation and active filter count badges.

---

## 2. Scope
- **Interactive Facet Filter State & Logic (`src/components/ReportDesignerTab.tsx`):**
  - Added dedicated facet state hooks: `grnDeliveryTermFilter` (`"all" | "door_delivery" | "ex_factory"`), `grnTransporterFilter` (carrier name), and `grnCollectionFilter` (collection name).
  - Dynamically discovered unique carriers (`availableTransporters`) and collections (`availableCollections`) from live receipt line items.
  - Implemented real-time facet counters (`grnFacetCounts`) tracking the number of `Door Delivery` and `Ex-Factory` line items.
  - Upgraded `filteredGrnLines` to perform compound filtering across delivery terms, carrier, collection, and free-text search queries.
- **Logistics Command Bar Presentation Layer (`src/components/ReportDesignerTab.tsx`):**
  - Implemented segmented pill buttons for Delivery Terms with status badge styling (emerald for `Door Delivery`, amber for `Ex-Factory`) and live count badges.
  - Added native styled dropdowns for Carrier and Collection facet selection.
  - Introduced 1-click `Reset Filters` action button when any filter or search query is active.
  - Enhanced search input placeholder and added 1-click `Clear Search` (X) button.
- **Automated Verification Suite (`src/tests/reportsPurchaseInwardLogisticsFacets.test.ts`):**
  - Created 8 automated Vitest unit tests verifying facet discovery, counter badge calculation, single-facet filtering, carrier dropdown selection, and compound multi-facet queries.

---

## 3. Files Created
1. `docs/implementation/reports/Reports_Purchase_Inward_Register_Logistics_Facets_Plan_v1.0.0.md` — Formal 19-section IPGP implementation plan.
2. `src/tests/reportsPurchaseInwardLogisticsFacets.test.ts` — Automated Vitest test suite.
3. `docs/walkthrough/reports/Reports_Purchase_Inward_Register_Logistics_Facets_Walkthrough_v1.0.0.md` — This WGP walkthrough document.

---

## 4. Files Modified
1. `src/components/ReportDesignerTab.tsx` — Added logistics facet filter bar, filter states, facet discovery hooks, and clear action.
2. `docs/implementation/README.md` — Updated implementation plan index table.
3. `docs/walkthrough/README.md` — Updated walkthrough master index with version `v3.141.0`.
4. `CHANGELOG.md` — Documented release notes under version `[6.99.9]`.

---

## 5. Architecture Decisions
1. **Zero-Latency In-Memory React Reactive Pipeline:**
   - Rather than executing new backend API queries for every facet toggle, the filter bar leverages React's `useMemo` pipeline on the existing `purchaseInwardData.lines` in-memory array. Toggling between `Ex-Factory` and `Door Delivery` or filtering by carrier happens at 0ms latency without network round-trips.
2. **Dynamic Facet Option Discovery:**
   - Instead of hardcoding carrier names or merchandise collections, options are extracted dynamically (`availableTransporters`, `availableCollections`) from the lines present in the active date range. Only carriers and collections actually present in the current dataset appear in the dropdowns.
3. **Reactive KPI Recalculation:**
   - All 4 operational KPI summary cards (Total GRNs Inwarded, Total Received Qty, Total Inward GST, Total Landed Value) and table footer aggregates derive directly from `filteredGrnLines`. Consequently, filtering by `Ex-Factory` instantly shows the exact landed value and pieces inwarded under buyer freight liability.

---

## 6. Design Rationale
- **Auditing Efficiency:**
  Finance auditors verifying freight bills previously had to type "ex-factory" or carrier names into a generic search bar. The new segmented pill buttons and carrier dropdown reduce audit scoping to a single click.
- **Visual Clarity & Error Prevention:**
  The `Reset Filters` button appears only when active filters exist, preventing operators from forgetting that a filter is currently constraining the visible inward lines.

---

## 7. Implementation Summary
```tsx
// Segmented Terms Filter with Badges
<button
  type="button"
  onClick={() => setGrnDeliveryTermFilter("ex_factory")}
  className={...}
>
  Ex-Factory
  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/10 text-amber-600 font-bold">
    {grnFacetCounts.exFactoryCount}
  </span>
</button>

// Carrier & Collection Selectors
<select
  value={grnTransporterFilter}
  onChange={(e) => setGrnTransporterFilter(e.target.value)}
>
  <option value="all">All Carriers ({availableTransporters.length})</option>
  {availableTransporters.map((t) => <option key={t} value={t}>{t}</option>)}
</select>
```

---

## 8. Tests Executed
1. `npx vitest run src/tests/reportsPurchaseInwardLogisticsFacets.test.ts`
   - Test 1: Extracts unique available transporters and collections.
   - Test 2: Computes delivery terms facet counter badges.
   - Test 3: Filters correctly when Ex-Factory facet chip is selected.
   - Test 4: Filters correctly when Door Delivery facet chip is selected.
   - Test 5: Filters by carrier dropdown (e.g. `TCI Express`).
   - Test 6: Filters by collection dropdown (e.g. `Festive & Wedding`).
   - Test 7: Compound filters: Ex-Factory + V-Trans Logistics + Search 'Wedge'.
   - Test 8: Compound filters: Ex-Factory + TCI Express returns empty array.
2. `npx vitest run src/tests/reportsPurchaseInwardLogistics.test.ts` (4/4 passed).
3. `npx vitest run src/tests/grnLogisticsAndTerms.test.tsx` (4/4 passed).
4. `npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx` (15/15 passed).
5. `npx tsc --noEmit` — Clean compilation with 0 errors.

---

## 9. Verification Results
- **Automated Test Suite:** 31/31 tests passed across all related test suites.
- **TypeScript Static Verification:** 0 errors reported by `tsc --noEmit`.
- **UI Responsiveness:** Facet pills, dropdowns, and search input operate smoothly with instant reactivity.

---

## 10. Known Limitations
- When receipts have empty or missing transporter names, they are grouped under `All Carriers` and do not appear as a distinct empty option in the dropdown.

---

## 11. Future Work
- Add one-click export of the active filtered subset as a pre-formatted Transporter Freight Reconciliation Sheet.
- Support multi-carrier checkbox selection in the carrier facet.

---

## 12. Related ADRs
- `ADR-0045`: Single-Store Daily Operational Reporting Architecture.
- `ADR-0061`: GRN Inward Landed Cost Multi-Component Allocation Architecture.

---

## 13. Related RFCs
- `RFC-2026-RPT-008`: Operational Retail Register Standardization & Multi-Format Export.
- `RFC-2026-PUR-004`: Purchase Order to GRN Commercial Logistics Inheritance.

