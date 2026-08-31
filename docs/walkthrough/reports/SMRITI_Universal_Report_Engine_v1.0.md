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

# SMRITI Universal Report Engine (SURE) & Multi-Format Exporter Architecture (v1.0.0)

## 1. Purpose
This walkthrough documents the delivery and verification of the **SMRITI Universal Reporting Engine (SURE)** in SMRITI Retail OS, resolving client-side export fallback issues (JSON leakage) and providing a self-service interactive reporting interface with date presets, multi-store filtering, live KPI cards, accordion grouping, in-table sorting, and 1-click multi-format exports.

---

## 2. Scope
- **Frontend Components**:
  - `src/components/reports/SmritiReportEngine.tsx`: Standalone self-service universal report viewer component with 7 date presets (`Today`, `Yesterday`, `This Week`, `Month to Date`, `Quarter`, `FY 2026-27`, `Custom Range`), Store/Site code filter, status dropdown, universal text search, dynamic KPI metric summary cards, multi-level accordion grouping, in-table sorting, column chooser, and 1-click multi-format export (`.xlsx`, `.csv`, `.pdf`, `.gsheet`).
  - `src/components/ReportDesignerTab.tsx`: Integrated `SmritiReportEngine` for all generic/dynamic datasets and refactored `handleTriggerExport` to dynamically inspect all report state variations (`genericReportData.orders`, `.lines`, `.bills`, `.invoices`, `.items`, `.stores`, `.styles`, `purchaseReportData`, `salesReportData`, `stockValuationData`) and route to direct backend binary openpyxl `.xlsx` endpoints.
  - `src/services/globalExportService.ts`: Upgraded `formatCellValue` to flatten nested objects and arrays into human-readable text rather than raw JSON strings.
- **Documentation**:
  - `docs/implementation/reports/SMRITI_Universal_Report_Engine_Plan_v1.0.md`
  - `docs/implementation/README.md`
  - `docs/walkthrough/reports/SMRITI_Universal_Report_Engine_v1.0.md`
  - `docs/walkthrough/README.md`

---

## 3. Files Created
- `src/components/reports/SmritiReportEngine.tsx`
- `docs/implementation/reports/SMRITI_Universal_Report_Engine_Plan_v1.0.md`
- `docs/walkthrough/reports/SMRITI_Universal_Report_Engine_v1.0.md`

---

## 4. Files Modified
- `src/components/ReportDesignerTab.tsx`
- `src/services/globalExportService.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
1. **Dynamic Tabular Extraction**:
   - Rather than assuming all reports contain a `.lines` array, the export and viewer engines dynamically check `.orders`, `.bills`, `.invoices`, `.items`, `.stores`, `.styles`, `purchaseReportData`, and `salesReportData`.
2. **Object & Array Cell Flattening**:
   - Any nested object or array is converted into a human-readable summary (e.g. `Invoice1, Invoice2` or `Key: Value`) instead of dumping technical JSON strings (`{"foo":"bar"}`).
3. **Direct Native Binary Excel Routing**:
   - Master registers (`RPT-TAX-001` and `RPT-SO-008`) directly download native backend-generated openpyxl multi-sheet `.xlsx` files.

---

## 6. Design Rationale
- Non-technical store managers and accountants require 1-click operational date presets (e.g., Month-to-Date or Quarter) without manually typing ISO dates.
- Accordion grouping (by Store Code, Customer, Style, or Category) allows instant top-level summary reviews with drilldown capability.

---

## 7. Implementation Summary
- Standalone `SmritiReportEngine.tsx` built and connected into `ReportDesignerTab.tsx`.
- All export formats (`.xlsx`, `.csv`, `.pdf`, `.gsheet`, `.json`, `.txt`) verified.

---

## 8. Tests Executed
1. `pytest -s backend/tests/test_sales_orders_full.py backend/tests/test_sales_order_reports.py`
2. `npm run build`

---

## 9. Verification Results
- **Pytest**: `14 passed, 8 warnings in 89.80s` (100% green).
- **Vite Build**: `built in 29.42s` (0 TypeScript / bundling errors).

---

## 10. Known Limitations
- Machine learning forecasting remains scaffolded until real operational transaction volume accumulates per Rule 3.

---

## 11. Future Work
- Visual pivot table drag-and-drop designer for executive ad-hoc queries.

---

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture.
- `ADR-028`: Dual-Engine Print & Golden CSS Specification.

---

## 13. Related RFCs
- `RFC-REP-005`: Universal Self-Service Reporting Engine & Multi-Format Exporter.
