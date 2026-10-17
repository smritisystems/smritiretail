<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.96.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan — Procurement Universal Attribute-Based Visual Analytics
-->

# SMRITI Retail OS — Universal Attribute-Based Visual Analytics Implementation Plan

**Module:** Procurement Visual Reports Dashboard (`procurement-visual-reports`)  
**Version:** v1.0.0  
**Status:** Completed  
**Capability:** `@SmritiCapability("REPORTS", "PROCUREMENT_VISUAL_REPORTS_DASHBOARD")`

---

## 1. Objective
Implement universal attribute-based visual analytics in the Procurement Visual Reports module matching the approved user visual reference. Establish business attributes (**Article / Style**, **Color**, **Size**, Category, Brand, Season, Supplier) as primary reporting dimensions rather than raw barcodes, while providing a configurable dashboard panel with 8 chart types, multidimensional grouping, measure selection, time grouping, top-N ranking, and 100% authoritative database reconciliation.

---

## 2. Business Motivation
In retail procurement (especially footwear and apparel), merchandising decisions, vendor commitments, and inventory replenishment are planned and evaluated at the style/article, color, and size-curve level. Evaluating procurement solely by individual SKU or barcode obscures category trends, color velocity, and size-band fulfillment ratios. Merchandisers require an interactive, attribute-driven visual dashboard with configurable chart views, heatmaps, and supplier lead-time scatter plots grounded strictly in live PostgreSQL ledger records.

---

## 3. Scope
- **Attribute-Level Reporting:** Article/Style, Color, Size, Category, Brand, Season, Supplier filters and multi-select pill strips.
- **Visual Analytics Decks:**
  - **Deck 1:** Purchase Spend Trend (By Article; Stacked Bar / Grouped Bar / Line / Area), Purchase-to-Receipt Progress (4 stages with Qty/Value toggle), Purchase Order Status Donut (with centered count).
  - **Deck 2:** Top Articles by Spend (MTD) ranking, Spend by Color (Top 5) pie chart, Order vs Receipt Qty (By Size) grouped bar chart, Reorder Alert (By Article / Color / Size) 7-column table.
  - **Deck 3:** Supplier Performance dual-axis combo chart, Article-Color Heatmap 2D matrix (ordered qty with gradient legend), Supplier Lead Time vs Order Value scatter/bubble plot.
  - **Deck 4:** 12-column Active Procurement Stream table with tabs (`All`, `PO`, `GR`, `PI`), search, filters, columns, export, and document preview modal.
- **Customize Dashboard Panel:** 4 tabs (`Charts & Data`, `Filters`, `Layout`, `Theme`), widget selector, 8 chart-type grid buttons, primary/secondary grouping, measure pills, time grouping, top-N, and configuration persistence to `/api/v1/reports/procurement-dashboard/config`.

---

## 4. Current State
The initial procurement visual reports module established basic PO counts, spend totals, supplier lists, and 12-column stream tracking. However, it lacked attribute-level dimensions (Article, Color, Size), 2D heatmap matrix analysis, lead-time scatter plots, and the full 8-icon chart configuration panel from the UX visual reference.

---

## 5. Gap Analysis
1. **Dimension Modeling:** Missing attribute grouping across line items (style codes, colors, size distributions).
2. **Chart Variety:** Missing 2D Heatmap matrix (Article × Color) and Scatter/Bubble plot (Lead Time vs Order Value).
3. **Filter Strip:** Lacked Row 2 multi-select pill inputs for Article, Color, Size, Category, Brand, Season.
4. **Configuration Engine:** Drawer lacked 8-icon chart-type selector, primary/secondary grouping dropdowns, measure pill selectors, and top-N input.

---

## 6. Architecture Impact
- **Backend:** Pure query and aggregation additions in `ProcurementVisualReportsService` and `reports.py` router. Zero database schema migrations or mutations required. Canonical models `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseReceipt`, `Product`, `Supplier`, and `Dashboard` are reused.
- **Frontend:** Extended DTO types in `procurementVisualReportsTypes.ts` and enhanced `ProcurementVisualReportsTab.tsx` with Recharts components and responsive matrix grids.

---

## 7. Proposed Design
1. **Dynamic Filter Catalog:** Queried product master to extract real distinct articles, colors, sizes, categories, and brands to populate filter dropdowns.
2. **Attribute Aggregators:** Reconciled line-item quantities and spend amounts by style code, color, and size.
3. **2D Heatmap Matrix:** Responsive flex/grid table with normalized cell shading based on relative quantity and a vertical gradient legend (`High` to `Low`).
4. **Scatter Plot:** Dual-axis numerical coordinates mapping average vendor delivery lead time against total purchase commitment.

---

## 8. Files Created
- `docs/implementation/procurement/Procurement_Visual_Reports_Attribute_Analytics_Plan_v1.0.0.md`
- `docs/walkthrough/procurement/Procurement_Visual_Reports_Attribute_Analytics_v1.0.0.md`

---

## 9. Files Modified
- `backend/app/schemas/procurement_visual_reports.py`
- `backend/app/services/procurement_visual_reports_service.py`
- `backend/app/api/v1/reports.py`
- `src/components/procurement/procurementVisualReportsTypes.ts`
- `src/components/procurement/ProcurementVisualReportsTab.tsx`
- `src/tests/procurementVisualReports.test.ts`
- `backend/tests/test_procurement_visual_reports.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

---

## 10. Dependencies
- React 18, Recharts 2.12.7, Lucide-React, Tailwind CSS.
- FastAPI, SQLAlchemy 2.0, PostgreSQL, Pydantic v2.

---

## 11. Risks
- *Risk:* Heavy line-item aggregations impacting response latency on large catalogs.  
  *Mitigation:* Indexed joins on `order_id` and `company_id`; in-memory python grouping for top-N ranking within tenant boundary.

---

## 12. Rollback Strategy
Revert frontend component `ProcurementVisualReportsTab.tsx` and service additions via Git. Since zero database migrations were introduced, rollback carries zero schema risk.

---

## 13. Verification Plan
- Vitest unit & integration test suite (`src/tests/procurementVisualReports.test.ts`).
- Pytest backend test suite (`backend/tests/test_procurement_visual_reports.py`).
- TypeScript compiler verification (`npx tsc --noEmit`).
- Architecture duplication check (`npm run architecture:check`).
- Registry validator (`npm run validate-registry`).
- Launchpad validator (`npm run validate-launchpad`).
- Vite production build (`npm run build`).

---

## 14. Test Plan
- Verify attribute filtering for Article, Color, Size, Supplier, Category.
- Verify 2D Heatmap cell values, max quantity normalization, and color ratios.
- Verify Supplier Lead Time vs Order Value scatter plot data points.
- Verify 4-tab Customize Dashboard drawer and configuration persistence.
- Verify graceful empty state when filtering for non-existent attributes.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Update `docs/walkthrough/README.md` master index.
- Create comprehensive walkthrough document.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`.

---

## 16. Deployment Plan
Commit and push from `D:\Smriti_Retail_OS\apps\smriti_retail_os` on branch `smritiNX`, then sync to testing environment `F:\Smriti9` via `git pull`.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-0042`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-0056`: Canonical UI Configuration Engine and Dashboard Layout Persistence.

---

## 19. Related Walkthroughs
- `docs/walkthrough/procurement/Procurement_Visual_Reports_Attribute_Analytics_v1.0.0.md`
- `docs/walkthrough/procurement/Procurement_Visual_Reports_Dashboard_v1.0.0.md`
