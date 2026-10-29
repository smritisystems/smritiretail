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

# SMRITI Retail OS Implementation Plan: Reports & BI — Purchase Inward Register (GRN) WYSIWYE Export Parity & 1-Click Sub-Ledger Download v1.0.0

## 1. Objective
Establish complete What-You-See-Is-What-You-Export (WYSIWYE) fidelity for the **Purchase Inward Register (GRN)** report (`RPT-PUR-001`) in `src/components/ReportDesignerTab.tsx`. All export targets (Excel XLSX, CSV, JSON, HTML, and Google Sheets) must dynamically honor the operator's active view mode (`Detailed Line Items View` vs `GRN Summary View`), export only the active filtered dataset (`filteredGrnLines` / `grnSummaryList`), and provide a prominent 1-click **Export Sub-ledger** action button directly in the logistics facet command bar.

---

## 2. Business Motivation
1. **Auditing & Carrier Reconciliation Fidelity**: When finance auditors filter the register to examine only `Ex-Factory` shipments or isolate a specific transporter (e.g. `V-Trans Logistics`), clicking "Export" currently dumps unfiltered database lines. Delivering WYSIWYE ensures exported sheets match exactly what is visible on the screen.
2. **Dual-View Mode Export Parity**: In `GRN Summary View`, operators analyze receipt-level aggregates (receipt number, supplier, delivery terms, carrier, item count, total pieces, tax, landed total). Exporting detailed itemized lines when in summary mode causes confusion. The export engine must automatically adapt columns and rows to the active view mode.
3. **1-Click Logistics Workflow**: Rather than navigating into the multi-step generic export dropdown, logistics operators can click the dedicated **Export Sub-ledger** button directly in the command bar to immediately download an Excel spreadsheet of the active filtered subset.

---

## 3. Scope
- **Frontend Presentation Layer (`src/components/ReportDesignerTab.tsx`)**:
  - In `handleOpenInGoogleSheets`:
    - When `selectedReport?.id === "RPT-PUR-001"`:
      - If `grnViewMode === "grn_summary"`: map columns and rows from `grnSummaryList` (GRN #, Date, Supplier, PO #, Delivery Terms, Carrier, Items Count, Total Qty, Total Tax, Landed Total, Status).
      - If `grnViewMode === "detailed"`: map columns and rows from `filteredGrnLines` (GRN #, Date, Supplier, PO #, Delivery Terms, Transporter, LR #, Collection, Article/SKU, Description, Qty, Cost Rate, GST %, Tax, Line Total, Status).
  - In `handleTriggerExport`:
    - When `selectedReport?.id === "RPT-PUR-001"`:
      - If `grnViewMode === "grn_summary"`: set `activeData = grnSummaryList`.
      - If `grnViewMode === "detailed"`: set `activeData = filteredGrnLines`.
  - In Logistics Facet Command Bar:
    - Add an **Export Sub-ledger** 1-click button (`Download` icon) next to the `Reset Filters` button.
- **Automated Verification Suite (`src/tests/reportsPurchaseInwardWysiwyeExport.test.ts`)**:
  - Unit tests verifying row and column resolution for detailed vs summary export modes and active facet filtering.
- **Documentation & Walkthrough**:
  - Update `docs/implementation/README.md`.
  - Create WGP walkthrough: `docs/walkthrough/reports/Reports_Purchase_Inward_Register_WYSIWYE_Export_Walkthrough_v1.0.0.md`.
  - Update `docs/walkthrough/README.md` (`v3.142.0`).
  - Update `CHANGELOG.md` (`[6.99.10]`).

---

## 4. Current State
- `handleOpenInGoogleSheets` and `handleTriggerExport` fall back to `purchaseInwardData.lines` (the full raw response from the backend), ignoring:
  1. The user's active search query (`reportSearchQuery`).
  2. The active delivery terms facet (`grnDeliveryTermFilter`).
  3. The active carrier facet (`grnTransporterFilter`).
  4. The active collection facet (`grnCollectionFilter`).
  5. The active view mode (`grnViewMode === "grn_summary"`).

---

## 5. Gap Analysis
| Scenario | Current Export Behavior | Target WYSIWYE Export Behavior |
|---|---|---|
| **Filtered by Ex-Factory** | Exports all lines (including Door Delivery) | Exports only Ex-Factory lines |
| **Filtered by Carrier (V-Trans)** | Exports all carriers | Exports only V-Trans lines |
| **GRN Summary View active** | Exports detailed line items table | Exports receipt-level summary table |
| **1-Click Export Access** | Nested under top generic Export dropdown | Dedicated button in facet command bar |

---

## 6. Architecture Impact
- **Client-Side Reactive Pipeline**: Reuses already-computed `filteredGrnLines` and `grnSummaryList` from React `useMemo`, requiring zero additional network requests.
- **GlobalExportService Integration**: Passes formatted column definitions and data arrays directly into `GlobalExportService.exportCustomData` and `GlobalExportService.openInGoogleSheets`.

---

## 7. Proposed Design
```tsx
// handleTriggerExport
if (selectedReport?.id === "RPT-PUR-001") {
  activeData = grnViewMode === "grn_summary" ? grnSummaryList : filteredGrnLines;
}

// handleOpenInGoogleSheets
if (selectedReport?.id === "RPT-PUR-001") {
  if (grnViewMode === "grn_summary") {
    columns = [
      { key: "receipt_no", label: "GRN #" },
      { key: "receipt_date", label: "Date" },
      { key: "supplier_name", label: "Supplier" },
      { key: "order_no", label: "PO #" },
      { key: "delivery_terms", label: "Delivery Terms" },
      { key: "transporter_name", label: "Carrier" },
      { key: "itemCount", label: "Items Count", isSummary: true },
      { key: "totalQty", label: "Total Qty (Pcs)", isSummary: true },
      { key: "totalTax", label: "Tax (INR)", isSummary: true },
      { key: "totalLanded", label: "Landed Total (INR)", isSummary: true },
      { key: "status", label: "Status" },
    ];
    rows = grnSummaryList;
  } else {
    // detailed columns with filteredGrnLines
    rows = filteredGrnLines;
  }
}
```

---

## 8. Files Created
- `docs/implementation/reports/Reports_Purchase_Inward_Register_WYSIWYE_Export_Plan_v1.0.0.md`
- `src/tests/reportsPurchaseInwardWysiwyeExport.test.ts`
- `docs/walkthrough/reports/Reports_Purchase_Inward_Register_WYSIWYE_Export_Walkthrough_v1.0.0.md` (upon completion)

---

## 9. Files Modified
- `src/components/ReportDesignerTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- `GlobalExportService` (`src/services/globalExportService.ts`).
- React 18, Lucide React icons (`Download`).

---

## 11. Risks
- *Risk*: Empty dataset when filters are excessively restrictive.
- *Mitigation*: Graceful notification ("No records match the current filter selection").

---

## 12. Rollback Strategy
- Non-destructive client modification. Reversion restores standard raw array export.

---

## 13. Verification Plan
- Automated unit test suite `src/tests/reportsPurchaseInwardWysiwyeExport.test.ts`.
- Full Vitest regression suite.
- `npx tsc --noEmit` zero compilation errors.

---

## 14. Test Plan
- Test 1: Detailed view export exports `filteredGrnLines` with detailed schema.
- Test 2: Summary view export exports `grnSummaryList` with aggregated receipt schema.
- Test 3: Filtered Ex-Factory active subset export excludes Door Delivery records.
- Test 4: Filtered carrier active subset export contains only selected carrier records.

---

## 15. Documentation Impact
- Update `CHANGELOG.md` (`[6.99.10]`).
- Register in `docs/implementation/README.md` and `docs/walkthrough/README.md`.

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
- `Reports_Purchase_Inward_Register_Logistics_Facets_Walkthrough_v1.0.0.md`
- `Reports_Purchase_Inward_Register_WYSIWYE_Export_Walkthrough_v1.0.0.md`
