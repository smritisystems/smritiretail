<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-29
  Classification: Internal
-->

# SMRITI Retail OS Implementation Plan: Reports & BI — Purchase Inward Register (GRN) Interactive Logistics Facet Filter Chips & Dynamic KPI Drilldown v1.0.0

## 1. Objective
Enhance the **Purchase Inward Register (GRN)** report (`RPT-PUR-001`) in `src/components/ReportDesignerTab.tsx` with an interactive, multi-dimensional logistics facet filter bar. Operators must be able to perform 1-click filtering by `Delivery Terms` (`All`, `Door Delivery`, `Ex-Factory`), filter by dynamic `Transporter` and `Collection` dropdown selectors, view dynamic line-item count badges on each filter chip, and observe real-time re-calculation of the 4 operational inward KPI cards (GRNs, Quantity, GST, Landed Value) and summary footers.

---

## 2. Business Motivation
1. **Rapid Freight Auditing**: Rather than manually searching for "Ex-Factory" in the search box, store managers and accounts auditors can toggle `Ex-Factory` with a single click to instantly see all shipments where the buyer is liable for freight landed costs.
2. **Transporter Concentration Analysis**: By selecting a specific carrier (e.g. `V-Trans`, `TCI Express`) from the carrier facet, logistics heads can immediately inspect the total volume (pieces) and landed value inwarded via that carrier during the selected accounting period.
3. **Seasonal Collection Inward Progress**: Merchandising controllers can filter by collection (e.g. `Spring / Summer 2026`, `Festive & Wedding`) to monitor whether incoming shipments align with seasonal promotional launches.
4. **Real-time Recalculation**: Live KPIs reflect the active facet selection, providing instant answers to commercial audit queries without manual spreadsheet calculations.

---

## 3. Scope
- **Interactive Facet Filter State & Logic (`src/components/ReportDesignerTab.tsx`)**:
  - `grnDeliveryTermFilter`: `"all" | "door_delivery" | "ex_factory"`.
  - `grnTransporterFilter`: `"all"` or specific transporter name.
  - `grnCollectionFilter`: `"all"` or specific collection name.
  - `availableTransporters`: Unique, sorted list of carriers discovered from live receipt lines.
  - `availableCollections`: Unique, sorted list of merchandise collections discovered from live receipt lines.
  - `grnFacetCounts`: Real-time counts for `Door Delivery` and `Ex-Factory` lines.
  - `filteredGrnLines`: Compound filtering across delivery terms, carrier, collection, and free-text search.
- **UI Presentation Layer (`src/components/ReportDesignerTab.tsx`)**:
  - High-density logistics filter bar above the table.
  - Segmented delivery terms pill buttons with colored active indicators and counter badges.
  - Compact styled dropdowns for carrier and collection facets.
  - One-click `Clear Filters` action button displaying active filter count.
  - Enhanced search bar placeholder reflecting all searchable dimensions.
- **Automated Verification Suite (`src/tests/reportsPurchaseInwardLogisticsFacets.test.ts`)**:
  - Unit tests verifying multi-dimensional compound filtering, facet count calculation, and KPI aggregation.
- **Governance & Documentation**:
  - Update `docs/implementation/README.md`.
  - Create WGP walkthrough: `docs/walkthrough/reports/Reports_Purchase_Inward_Register_Logistics_Facets_Walkthrough_v1.0.0.md`.
  - Update `docs/walkthrough/README.md` (`v3.141.0`).
  - Update `CHANGELOG.md` (`[6.99.9]`).

---

## 4. Current State
- The Purchase Inward Register currently relies solely on a single free-text input (`reportSearchQuery`).
- To filter by delivery terms or transporter, operators must type terms manually into the search box.
- The 4 KPI cards and summary footer calculate totals for the filtered results, but there are no quick 1-click filter chips, no carrier select dropdowns, and no facet line count indicators.

---

## 5. Gap Analysis
| Feature | Current State | Target State |
|---|---|---|
| **Delivery Terms Filtering** | Manual text typing (`"ex-factory"`) | 1-click segmented pill buttons with counter badges |
| **Carrier Filtering** | Manual text typing | Dynamic dropdown populated with detected carriers |
| **Collection Filtering** | Manual text typing | Dynamic dropdown populated with detected collections |
| **Active Filters Indicator** | None | Visible badge showing count with 1-click reset |
| **Visual Affordance** | Generic search input | High-density logistics command bar |

---

## 6. Architecture Impact
- **Purely Additive Frontend Reactive Architecture**: Utilizes existing React `useMemo` pipelines without backend database schema or API alterations.
- **Zero Latency**: All facet calculations and filtering operate in-memory on the fetched `purchaseInwardData.lines` array.
- **Seamless Export Parity**: Triggering Excel, CSV, or Google Sheets export naturally exports the active filtered dataset.

---

## 7. Proposed Design
```tsx
// 1. Facet States
const [grnDeliveryTermFilter, setGrnDeliveryTermFilter] = useState<"all" | "door_delivery" | "ex_factory">("all");
const [grnTransporterFilter, setGrnTransporterFilter] = useState<string>("all");
const [grnCollectionFilter, setGrnCollectionFilter] = useState<string>("all");

// 2. Extracted Facets
const availableTransporters = useMemo(() => ...);
const availableCollections = useMemo(() => ...);
const grnFacetCounts = useMemo(() => ...);

// 3. Multi-Dimensional Filter
const filteredGrnLines = useMemo(() => {
  // Apply delivery term filter
  // Apply transporter filter
  // Apply collection filter
  // Apply text query
});
```

---

## 8. Files Created
- `docs/implementation/reports/Reports_Purchase_Inward_Register_Logistics_Facets_Plan_v1.0.0.md`
- `src/tests/reportsPurchaseInwardLogisticsFacets.test.ts`
- `docs/walkthrough/reports/Reports_Purchase_Inward_Register_Logistics_Facets_Walkthrough_v1.0.0.md` (upon completion)

---

## 9. Files Modified
- `src/components/ReportDesignerTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- React 18 hooks (`useState`, `useMemo`).
- Lucide React icons (`Filter`, `RotateCcw`, `Truck`, `Tag`, `PackageCheck`).
- Tailwind CSS utility classes.

---

## 11. Risks
- *Risk*: A dataset where all receipts have empty or missing delivery terms.
- *Mitigation*: Fallback counters show `0` gracefully, and clicking `All Terms` displays all lines without filtering out missing values.

---

## 12. Rollback Strategy
- Non-destructive UI change. Reverting `src/components/ReportDesignerTab.tsx` restores the previous single-input search bar.

---

## 13. Verification Plan
- Vitest test suite `src/tests/reportsPurchaseInwardLogisticsFacets.test.ts`.
- Full regression suite execution.
- `npx tsc --noEmit` clean compile (0 errors).

---

## 14. Test Plan
- Test 1: Delivery terms facet filtering (`Door Delivery` vs `Ex-Factory` vs `All`).
- Test 2: Carrier facet dropdown filtering.
- Test 3: Collection facet dropdown filtering.
- Test 4: Compound multi-facet filtering (Delivery Term + Transporter + Text Query).
- Test 5: Dynamic KPI recalculation for active facets.

---

## 15. Documentation Impact
- Update `CHANGELOG.md` (`[6.99.9]`).
- Master index registration in `docs/implementation/README.md` and `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
- Commit & push to `origin/smritiNX` on `F:\SMRITRretailNX` (DEV).
- Pull into `F:\Smriti9` (TEST).

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0045`: Single-Store Daily Operational Reporting Architecture.
- `ADR-0061`: GRN Inward Landed Cost Multi-Component Allocation Architecture.

---

## 19. Related Walkthroughs
- `Reports_Purchase_Inward_Register_Logistics_Alignment_Walkthrough_v1.0.0.md`
- `Reports_Purchase_Inward_Register_Logistics_Facets_Walkthrough_v1.0.0.md`
