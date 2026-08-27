<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-27
  Modified     : 2026-08-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Universal Reporting Engine (SURE) & Multi-Format Exporter Architecture Plan (v1.0.0)

## 1. Objective
To design, build, and deploy a centralized, schema-driven **Universal Reporting Engine (SURE)** in SMRITI Retail OS. This module enables any business user (cashier, store manager, accountant, auditor, executive) to query, filter by multi-dimensional ranges (date presets, multi-store, party, style), visualize via live KPI cards / interactive grids / charts, and export in 1-click to native multi-sheet binary Excel (`.xlsx`), vector PDF, RFC 4180 CSV, and Google Sheets (`sheets.new`).

---

## 2. Business Motivation
- **Self-Service Operational Intelligence**: Eliminate technical friction for store managers and accountants who need immediate access to sales, tax, PO, inventory, and backorder data.
- **Data Integrity & Zero JSON Leakage**: Prevent raw technical JSON payloads or empty fallbacks from being exported when users download reports.
- **Statutory Audit Readiness**: Provide instantaneous reconciliation for GST (GSTR-1, GSTR-3B), HSN summaries, and Tax Invoice registers.

---

## 3. Scope
- **Backend Components**:
  - `backend/app/services/reports.py`: Universal envelope formatting (`metadata`, `summary`, `columns`, `rows`, `total_count`).
  - `backend/app/api/v1/reports.py`: Universal report query endpoint and binary openpyxl Excel exporter.
- **Frontend Components**:
  - `src/components/reports/SmritiReportEngine.tsx`: The primary self-service reporting component with sticky filter bar, preset date buttons, multi-store picker, live KPI cards, interactive table grid with grouping/sorting, chart toggle, and universal export center.
  - `src/components/ReportDesignerTab.tsx`: Refactored to seamlessly host the universal reporting suite across all SMRITI studios.
  - `src/services/globalExportService.ts`: Object and nested array flattening formatter ensuring human-readable cell output.

---

## 4. Current State
- `ReportDesignerTab.tsx` contains hardcoded conditional JSX render blocks for specific report IDs (`RPT-SAL-001`, `RPT-PUR-002`, `RPT-SO-008`, `RPT-SO-009`, etc.).
- Filter controls were disparate and state binding was fragmented across separate state variables.

---

## 5. Gap Analysis
- Lack of a single standardized response envelope from backend report services.
- Need for universal date presets (*Today, Yesterday, This Week, MTD, QTD, FYTD, Custom Range*).
- Need for multi-level grouping (e.g. Group by Store ➔ Group by Style ➔ Item Rows).

---

## 6. Architecture Impact
- Standardizes all reporting traffic to `GET /api/v1/reports/*` under a predictable schema envelope.
- Enforces strict role-based access control (RBAC Level 2 for Report Users, Cashier restrictions per Rule 10).

---

## 7. Proposed Design
1. **Universal Report Definition Schema (`SmritiReportDefinition`)**:
   - Declares ID, title, category, role permissions, filter capabilities, and column metadata.
2. **Interactive Range & Parameter Bar**:
   - Date presets + Custom range datepicker + Multi-store / site code selector + Party typeahead.
3. **Live KPI Metric Cards**:
   - Dynamically calculated from summary totals (Grand Total ₹, Units, Tax Total, Variance %).
4. **Adaptive Hierarchical Data Grid**:
   - Accordion grouping, live in-table search, column sorting, and chart visualization toggle.
5. **Universal Exporter**:
   - Direct download of native openpyxl binary `.xlsx`, RFC 4180 `.csv`, formatted `.txt`, vector `.pdf`, and clipboard-enabled Google Sheets.

---

## 8. Files Created
- `docs/implementation/reports/SMRITI_Universal_Report_Engine_Plan_v1.0.md`
- `src/components/reports/SmritiReportEngine.tsx`

---

## 9. Files Modified
- `src/components/ReportDesignerTab.tsx`
- `src/services/globalExportService.ts`
- `docs/implementation/README.md`

---

## 10. Dependencies
- FastAPI + PostgreSQL backend.
- Lucide React icons, Motion/React, openpyxl, Vite.

---

## 11. Risks & Mitigations
- **Large Dataset Export Latency**: Mitigated via backend pagination and direct streaming openpyxl binary file generation.
- **Browser Memory Limits on Huge Client Arrays**: Mitigated via chunked rendering and direct backend file download links.

---

## 12. Rollback Strategy
- Preserved existing dedicated studio report handlers while layering `SmritiReportEngine` on top.

---

## 13. Verification Plan
- Verify all date preset selections generate valid ISO date queries.
- Verify multi-store filtering correctly filters dataset.
- Verify native `.xlsx` downloads open cleanly in Microsoft Excel / LibreOffice without XML warnings.
- Verify zero TypeScript compiler errors on `npm run build`.

---

## 14. Test Plan
- Run automated test suite: `pytest -s backend/tests/test_sales_orders_full.py backend/tests/test_sales_order_reports.py`.
- Run frontend build: `npm run build`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Generate walkthrough upon completion.

---

## 16. Deployment Plan
- Build frontend `dist` bundle.
- Rebuild and launch Docker containers (`smriti-web`, `smriti-api`, `smriti-db`).

---

## 17. Status
Approved — In Progress

---

## 18. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture.
- `ADR-028`: Dual-Engine Print & Golden CSS Specification.

---

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Sales_Order_Fulfillment_Variance_And_Matrix_Suite_v3.30.0.md`
