<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Author     : Jawahar Ramkripal Mallah
  * Designation: Chief Systems Architect & Creator
  * Email      : support@smritibooks.com
  * Version    : 1.0.0
  * Created    : 2026-10-28
  * Copyright  : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Visual Report Designer: Dynamic Classification, Dynamic Attribute Discovery & Drag-and-Drop Layout (Walkthrough v1.0.0)

## 1. Purpose
This walkthrough documents the comprehensive engineering upgrade of the SMRITI Visual Report Designer (`ReportBuilder.tsx`). It transforms the report designer into an enterprise visual layout environment featuring 5 standardized retail logical roles (Identifiers, Classifications, Attributes, Dimensions, Measures), 4 native HTML5 drag-and-drop layout containers (Rows, Columns, Values, Filters), dynamic database attribute pivot discovery (e.g., dynamically extracted size matrix columns `Size 38`, `Size 39`), multi-level hierarchical grouping with subtotals and grand totals, a field configuration inspector, view mode toggles (`Pivot Matrix` vs `Flat Table`), and single-store default posture governance.

## 2. Scope
- **Frontend Architecture:**
  - `src/components/reports/reportLayoutEngine.ts`: Modular catalog of 28 canonical retail fields with semantic typing, HTML5 drag-and-drop area eligibility validation, and `transformToPivotMatrix` engine with subtotal and grand total calculation.
  - `src/components/reports/ReportBuilder.tsx`: Left-hand catalog grouped into 5 logical roles with search and click-to-add; 4 visual drop containers with active drag highlighting, chip reordering, and accessible `+ Add` dropdown menus; interactive Field Configuration Inspector; view switches (Pivot Matrix vs Flat Table); and single store mode badge.
  - `src/components/ReportDesignerTab.tsx`: Wiring of store context and location management enablement flags to the visual report designer.
- **Backend Architecture:**
  - `backend/app/services/reports.py`: Added `brand` and `item_category` dimensions to `sales_dim_map`, detailed SQL query projections, and row mapping dictionaries.
  - `backend/app/services/report_field_registry.py`: Registered `brand` and `item_category` metadata under the canonical `Sales` domain.
- **Governance & Verification:**
  - Plan: `docs/implementation/reports/Report_Designer_Dynamic_Classification_And_Drag_Drop_Plan_v1.0.0.md`.
  - Headless Browser Verification: `scratch/verify_drag_drop_report_designer.py`.

## 3. Files Created
1. `docs/implementation/reports/Report_Designer_Dynamic_Classification_And_Drag_Drop_Plan_v1.0.0.md` — Mandatory 19-section IPGP implementation plan.
2. `src/components/reports/reportLayoutEngine.ts` — Centralized layout engine, semantic field registry, drag-and-drop area validation, and hierarchical matrix transformation engine.
3. `scratch/verify_drag_drop_report_designer.py` — Automated Playwright headless browser verification test suite.
4. `docs/walkthrough/reports/Report_Designer_Dynamic_Classification_And_Drag_Drop_Walkthrough_v1.0.0.md` — This walkthrough document.

## 4. Files Modified
1. `docs/implementation/README.md` — Updated master index with implementation plan entry.
2. `docs/walkthrough/README.md` — Updated master index with walkthrough entry.
3. `src/components/reports/ReportBuilder.tsx` — Complete UI refactoring implementing the 6-callout reference UX design.
4. `src/components/ReportDesignerTab.tsx` — Passed store context and location management props to `<ReportBuilder />`.
5. `backend/app/services/reports.py` — Added `brand` and `item_category` to `sales_dim_map` and projection mappings.
6. `backend/app/services/report_field_registry.py` — Registered `brand` and `item_category` in canonical metadata.
7. `CHANGELOG.md` — Documented release enhancements and features.

## 5. Architecture Decisions
- **Native HTML5 Drag and Drop (Zero Dependency):** Utilized standard browser HTML5 drag-and-drop events (`dragstart`, `dragover`, `dragleave`, `drop`) using serialized JSON payloads (`application/smriti-field`), eliminating external third-party library dependencies (such as react-dnd or dnd-kit) and avoiding bundle bloat or React 18 concurrency incompatibilities.
- **Dynamic Pivot Column Discovery:** Pivot columns are extracted dynamically from actual transactional database rows (`Array.from(new Set(rows.map(r => String(r[colKey]))))`) rather than being statically hardcoded. This allows any product attribute (e.g. Size 38, Size 39, or XXL, 42) to automatically render as matrix column headers.
- **Two-Pass Subtotal & Total Computation:** Hierarchical groups are sorted and grouped by row keys (`Brand -> Article -> Color`). A primary pass computes cell-level pivoted quantities and net totals; a secondary pass inserts authoritative subtotal summary rows (e.g., `Reliance Retail Limited Total`, `Nike Total`) and an authoritative Grand Total footer.
- **Single-Store Default Governance:** In accordance with SMRITI Retail OS single-store default posture, multi-branch dropdown filters are concealed unless `isLocationsManagementEnabled` is explicitly active. The visual designer presents an emerald status badge: `[ 📍 Main Store · Single Store ]`.

## 6. Design Rationale
- **Reference UX Alignment:** Directly follows the approved 6-callout UI specification (`media_1793206370853_e8c0817f.jpg`):
  1. Left-side catalog grouped into 5 logical categories (Identifiers, Classifications, Attributes, Dimensions, Measures).
  2. Four interactive drag-and-drop containers (Rows, Columns, Values, Filters).
  3. Accessible `+ Add` dropdown menus alongside drag-and-drop for keyboard and touch ergonomics.
  4. Live hierarchical matrix pivot preview with subtotal rows and grand totals.
  5. Interactive Field Configuration Inspector for editing label, aggregation function, format, totals visibility, and sort order.
  6. Consolidated top/bottom action buttons adhering to the maximum-seven-actions ergonomic rule.

## 7. Implementation Summary
- **Logical Field Catalog:**
  Implemented 28 standard retail fields in `reportLayoutEngine.ts` grouped into:
  - *Identifiers:* Item Code, SKU, Barcode, Article No, Invoice No.
  - *Classifications:* Department, Category, Brand, Article, Sub Category.
  - *Attributes:* Color, Size, Material, Season, Style Code.
  - *Dimensions:* Branch, Customer, Supplier, Sales Staff, Date.
  - *Measures:* Quantity, Gross Total, Discount Amount, Tax Amount, Net Total, Cost Amount, Margin Amount.
- **Visual Drop Targets:**
  Container areas highlight with role-specific accent borders and backgrounds (`ring-2`) when a valid field is dragged over them, and reject incompatible drops via `canFieldDropInArea()`.
- **Hierarchical Matrix Pivot Transformer:**
  Transforms flat tabular records into nested row hierarchies, dynamically extracts unique column values from the configured column attribute (e.g., Size), computes row-level line totals (`Total Qty`, `Net Total (₹)`), and calculates group subtotals and grand totals.

## 8. Tests Executed
1. `npx tsc --noEmit` — Static TypeScript compilation.
2. `docker compose build smriti-web` — Vite production bundle compilation.
3. `docker compose restart smriti-api` — Backend API service refresh.
4. `python scratch/verify_drag_drop_report_designer.py` — Automated 10-step Playwright headless browser test suite against live PostgreSQL database.

## 9. Verification Results
- **TypeScript Static Compilation:** Clean (exit code 0, 0 errors).
- **Vite Production Build:** Success (built in 43.77s).
- **Playwright Test Suite (10/10 Gates):**
  - `LOGICAL_ROLES_CATALOG`: PASS (Identifiers, Classifications, Attributes, Dimensions, Measures)
  - `LAYOUT_CONTAINERS`: PASS (Rows, Columns, Values, Filters)
  - `MATRIX_COLUMNS`: PASS (Fixed columns: Brand, Article, Color, Total Qty, Net Total; Dynamic pivot: Size 38, Size 39)
  - `SUBTOTALS_AND_GRAND_TOTAL`: PASS (Group subtotals & Grand Total footer row present)
  - `FIELD_CONFIGURATION_INSPECTOR`: PASS (Opened upon chip selection, displaying label, aggregation, format, totals, and sort)
  - `SINGLE_STORE_MODE`: PASS (`[ 📍 Main Store · Single Store ]` badge active)
  - `FLAT_TABLE_TOGGLE`: PASS (Switches smoothly between Pivot Matrix and Flat Table views)
  - `SAVE_VIEW_ACTION`: PASS (Persists layout configuration)
  - `Console Errors`: 0 errors.

## 10. Known Limitations
- The pivot matrix engine currently optimizes single-column pivoting (e.g., `size` or `color`). Multi-column pivot cross-tabulations (e.g. `size` × `season`) render the first column dimension in matrix view and all dimensions in flat table view.

## 11. Future Work
- Add client-side drag-reordering of table header columns in Flat Table view.
- Support user-defined calculated measure formulas (e.g. `Net Total / Quantity`) in the Field Configuration Inspector.

## 12. Related ADRs
- `ADR-0082`: Universal Reporting & Dynamic Aggregation Architecture.
- `ADR-0083`: Single-Store Default Posture and Location Management Gating.

## 13. Related RFCs
- `RFC-2026-041`: Visual Report Designer Ergonomics & Drag-and-Drop Layout Specification.
