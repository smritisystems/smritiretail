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
  Classification: Walkthrough — Procurement Universal Attribute-Based Visual Analytics
-->

# SMRITI Retail OS — Procurement Universal Attribute-Based Visual Analytics Walkthrough

**Module:** Procurement Visual Reports Dashboard (`procurement-visual-reports`)  
**Version:** v1.0.0  
**Status:** Completed  
**Capability:** `@SmritiCapability("REPORTS", "PROCUREMENT_VISUAL_REPORTS_DASHBOARD")`

---

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the Universal Attribute-Based Visual Analytics capability in SMRITI Retail OS. The system enables retail merchandisers to monitor procurement commitments, spend velocity, order status, and supplier fulfillment through business dimensions (**Article / Style**, **Color**, **Size**, Category, Brand, Season, Supplier) rather than raw barcodes, while providing an interactive 4-tab dashboard customization experience with 8 chart types and zero mock data fallbacks.

---

## 2. Scope
- Implementation of multi-select attribute filters (Article, Color, Size) and dropdown dimensions (Supplier, Category, Brand, Season).
- Delivery of 3 primary analytics decks and bottom 12-column Active Procurement Stream table matching the approved visual specification:
  - **Deck 1:** Purchase Spend Trend (By Article; Stacked Bar / Grouped Bar / Line / Area), Purchase-to-Receipt Progress (4 stages with Qty/Value toggle), Purchase Order Status Donut (with centered count).
  - **Deck 2:** Top Articles by Spend (MTD) ranking, Spend by Color (Top 5) pie chart, Order vs Receipt Qty (By Size) grouped bar chart, Reorder Alert (By Article / Color / Size) 7-column table.
  - **Deck 3:** Supplier Performance dual-axis combo chart, Article-Color Heatmap 2D matrix (ordered qty with gradient legend), Supplier Lead Time vs Order Value scatter/bubble plot.
  - **Deck 4:** 12-column Active Procurement Stream table with tabs (`All`, `PO`, `GR`, `PI`), search, filters, columns, export, and document preview modal.
- Implementation of the Customize Dashboard right-side drawer with 4 tabs (`Charts & Data`, `Filters`, `Layout`, `Theme`), 8 chart types (`Bar`, `Line`, `Area`, `Donut`, `Treemap`, `Heatmap`, `Scatter`, `Table`), primary/secondary grouping, measure pills, time grouping, top-N, and configuration persistence to `/api/v1/reports/procurement-dashboard/config`.

---

## 3. Files Created
- `docs/implementation/procurement/Procurement_Visual_Reports_Attribute_Analytics_Plan_v1.0.0.md`: Formal 19-section implementation plan.
- `docs/walkthrough/procurement/Procurement_Visual_Reports_Attribute_Analytics_v1.0.0.md`: Formal 13-section walkthrough document.

---

## 4. Files Modified
- `backend/app/schemas/procurement_visual_reports.py`: Added attribute DTOs (`ArticleSpendItem`, `ColorSpendItem`, `SizeBreakdownItem`, `AttributeReorderAlertItem`, `ArticleColorHeatmap`, `SupplierLeadTimeScatterPoint`, `FilterOptions`) and configuration fields.
- `backend/app/api/v1/reports.py`: Added query parameters for `articles`, `colors`, `sizes`, `category`, `brand`, `season`, `top_n`.
- `backend/app/services/procurement_visual_reports_service.py`: Reconciled line-item aggregations, dynamic filter options from live catalog, 2D heatmap matrix, and lead-time scatter points.
- `src/components/procurement/procurementVisualReportsTypes.ts`: Synchronized frontend TypeScript interfaces with backend DTOs.
- `src/components/procurement/ProcurementVisualReportsTab.tsx`: Rendered 2-row filter strip, all 10 visual widgets, and 4-tab Customize Dashboard panel.
- `src/tests/procurementVisualReports.test.ts`: Expanded frontend test suite to 10 comprehensive verification steps.
- `backend/tests/test_procurement_visual_reports.py`: Added backend test coverage for attribute filters, heatmap, and scatter data contracts.
- `docs/implementation/README.md`: Appended master implementation index.
- `docs/walkthrough/README.md`: Appended master walkthrough index.
- `CHANGELOG.md`: Logged release changes.
- `RELEASE_NOTES.md`: Logged release highlights.

---

## 5. Architecture Decisions
1. **Business Attributes as Primary Dimensions:** SKU and barcode are reserved strictly for operational line-level drill-down. Aggregations, rankings, and filters operate natively on Style Code, Color, and Size.
2. **Dual Parameter Support:** Backend query handlers normalize both repeated query params (`?articles=A&articles=B`) and comma-separated params (`?articles=A,B`) via a shared normalization helper.
3. **No External Chart Library Overhead:** Built 2D Heatmap with responsive flex/grid tables and CSS HSL/RGB interpolation, ensuring zero extra dependencies while matching the visual reference's vertical gradient bar (`High` to `Low`).
4. **Authoritative Ledger Source:** All metrics derive strictly from PostgreSQL `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_bills`, `products`, and `suppliers`.

---

## 6. Design Rationale
- **Two-Row Filter Strip:** Row 1 isolates enterprise scope (Company, Store, Date, Quick Presets, Reset). Row 2 isolates merchandising dimensions (Article, Color, Size, Supplier, Category, Brand, Season), preventing horizontal clutter and cognitive overload.
- **8-Icon Chart Type Grid:** Provides visual, clickable card buttons in the customization drawer matching modern BI studios (PowerBI, Looker, Tableau).
- **Graceful Truthful Degradation:** When filters yield zero records, the dashboard displays an informative empty card allowing the user to reset filters in one click, strictly eliminating fake mock-data fallbacks.

---

## 7. Implementation Summary
- **Backend Service:** Implemented `ProcurementVisualReportsService.get_dashboard_summary` with dynamic catalog inspection (extracting distinct styles, colors, sizes, categories, brands). Applied multi-attribute filtering across line items and POs. Implemented aggregations for `top_articles`, `spend_by_color`, `order_vs_receipt_by_size`, `article_color_heatmap`, `supplier_lead_time_vs_value`, `reorder_alerts_detailed`, and multi-series `spend_trend.article_breakdown`.
- **Frontend Tab Component:** Built `ProcurementVisualReportsTab.tsx` with:
  - Header: Breadcrumbs, search bar (`Ctrl+K`), store selector, notifications, user avatar.
  - Filter Strip: 2-row layout with quick-search multi-select dropdowns and removable chip pills (`x`).
  - Deck 0: 6 KPI cards with trend indicators and progress bars.
  - Deck 1: Multi-series Stacked Bar / Grouped Bar / Line / Area spend trend, 4-stage Purchase-to-Receipt pipeline tracker, and centered PO status donut.
  - Deck 2: Horizontal Top Articles ranking, Spend by Color pie chart, Order vs Receipt by Size grouped bar chart, and 7-column Reorder Alert table.
  - Deck 3: Dual-axis Supplier Performance combo chart, 2D Article-Color Heatmap with vertical gradient bar, and Supplier Lead Time vs Order Value scatter plot.
  - Deck 4: 12-column Active Procurement Stream table with tabs, search, filter, columns, and document preview modal.
  - Configuration Drawer: 4 tabs with widget selector, 8-icon chart grid, primary/secondary grouping, measure pills, time grouping, top N, and persistent backend storage.

---

## 8. Tests Executed
1. `npx vitest run src/tests/procurementVisualReports.test.ts`: 10/10 tests passed (100% green).
2. `.venv\Scripts\python.exe -m pytest backend/tests/test_procurement_visual_reports.py`: 4/4 tests passed (100% green).
3. `npx tsc --noEmit`: 0 TypeScript compiler errors.
4. `npm run validate-launchpad`: 55/55 launchpad tiles validated.
5. `npm run validate-registry`: 98/98 form components validated.
6. `npm run architecture:check`: 11/11 architecture checks passed with 0 violations.
7. `npm run build`: Vite production build passed with 0 errors.

---

## 9. Verification Results
- **Evidence Level:** Level A (Directly Observable Automated Test & Build Logs).
- **Status:** Done per Rule 7.
- **Metrics:**
  - 10/10 Vitest tests green.
  - 4/4 Pytest tests green.
  - 0 TypeScript compiler errors.
  - 0 Architecture duplication violations.
  - Clean production Vite bundle generated.

---

## 10. Known Limitations
- Heatmap display is optimized for the top 5–10 articles and top 5–10 colors. Catalogs with over 100 styles scroll horizontally within the matrix container.

---

## 11. Future Work
- Add Excel / CSV export for the 2D Heatmap matrix and Supplier Lead Time scatter coordinates.
- Support user-defined color themes saved per user profile.

---

## 12. Related ADRs
- `ADR-0042`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-0056`: Canonical UI Configuration Engine and Dashboard Layout Persistence.

---

## 13. Related RFCs
- `RFC-0182`: Merchandising Visual Analytics & Footwear Attribute Matrix Specifications.
