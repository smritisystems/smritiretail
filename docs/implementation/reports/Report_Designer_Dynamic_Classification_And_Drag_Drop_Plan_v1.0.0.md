<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Visual Report Designer: Dynamic Classification, Attribute Grouping & Drag-and-Drop Layout Implementation Plan

## 1. Objective
Upgrade the SMRITI Visual Report Designer (`src/components/reports/ReportBuilder.tsx` and associated services) so retail business operators can build custom operational and analytical reports without technical knowledge. Implement dynamic classification and attribute grouping (Identifiers, Classifications, Attributes, Dimensions, Measures), four interactive drag-and-drop layout containers (Rows / Group By, Columns / Pivot By, Values / Show As, Filters / Optional), a dedicated field configuration inspector, matrix/pivot rendering with hierarchical subtotals and grand totals, and persistent saved views.

## 2. Business Motivation
In apparel and footwear retail ERPs, operators must frequently slice and analyze sales and purchases by Brand, Category, Article, Color, and Size. When reports only offer flat tables or unstructured column pickers without clear distinction between grouping keys and calculated measures, users face column confusion and unorganized data. Implementing standard BI report designer ergonomics (Rows, Columns, Values, Filters) enables business users to generate matrix reports (e.g., Brand → Article → Color × Size matrix with automated quantities and revenue subtotals) cleanly and intuitively.

## 3. Scope
- **Classification & Field Model**:
  - Categorize available fields into 5 logical retail roles: Identifiers, Classifications, Attributes, Dimensions, and Measures.
  - Dynamically discover attributes (Color, Size, Material, Season, Style Code) and classifications (Department, Category, Brand, Article, Sub Category) from canonical metadata.
  - Expose stable IDs, labels, data types, and supported aggregation functions (SUM, COUNT, AVG, MIN, MAX).
- **Layout & Drag-and-Drop UX**:
  - 4 interactive layout containers: Rows (Group by), Columns (Pivot by), Values (Show as), Filters (Optional).
  - Native HTML5 drag-and-drop support with visual drop targets and reordering.
  - Accessible click-to-add (`+ Add` button per container) and keyboard alternatives.
  - Keep compact field selection synchronized with the report layout definition.
- **Field Configuration Inspector**:
  - Interactive configuration panel for selected fields: Display Label, Aggregation Function, Formatting (Number, Currency, Date, Percentage), Show in Total toggle, and Sorting (None, Ascending, Descending).
- **Matrix & Hierarchical Report Engine**:
  - Hierarchical row grouping with expandable tree rows.
  - Dynamic matrix/pivot columns when attribute fields (e.g., Size) are placed in Columns (Pivot by).
  - Mathematical subtotals per classification group (e.g., Nike Total, Adidas Total) and authoritative Grand Total row.
- **Single Store Default & Saved Views**:
  - Preserve Single Store default posture (`isLocationsManagementEnabled`, Single Store badge).
  - Save View persistence and multi-format exports (CSV, Excel, PDF, Print).

## 4. Current State
- `ReportBuilder.tsx` displays fields categorized strictly by underlying database domain (Purchase, Sales, Inventory, Items, Customers, Suppliers, Finance).
- Fields are toggled into a single flat list (`selectedFieldKeys`) rendered as horizontal chips across the top.
- There is no distinction between row grouping dimensions, pivot columns, and aggregated measure values.
- No drag-and-drop or visual layout containers exist; users cannot construct a matrix report (e.g., Brand × Size pivot) directly.

## 5. Gap Analysis
| Functional Area | Current Implementation | Target Enhanced Implementation |
| :--- | :--- | :--- |
| **Field Organization** | Domain-based (Purchase, Sales, Inventory) | 5 Logical Retail Roles (Identifiers, Classifications, Attributes, Dimensions, Measures) |
| **Layout Configuration** | Flat list of selected column chips | 4 Configurable Containers: Rows (Group by), Columns (Pivot by), Values (Show as), Filters (Optional) |
| **Interaction Model** | Click checkbox on left panel only | Native Drag & Drop + Click-to-Add `+ Add` + Accessible Keyboard Controls |
| **Field Inspector** | Modal with limited table-wide density | Contextual Field Configuration panel (Label, Aggregation, Format, Subtotals, Sorting) |
| **Pivot & Matrix View** | Flat table grid with optional auto-consolidation | Dynamic matrix pivot table (e.g. Size 40, Size 41...) with expandable tree rows and group subtotals |
| **Data Integrity** | Client totals over flat rows | Authoritative aggregation preventing Cartesian inflation across 1:N joins |

## 6. Architecture Impact
- **Frontend Architecture**:
  - Upgrades `ReportBuilder.tsx` to include layout drop zones, drag-and-drop event handlers, field configuration state, and matrix pivot transformer.
  - Creates modular helper `reportLayoutEngine.ts` handling layout validation, pivot matrix calculations, and subtotal aggregations.
- **Backend Architecture**:
  - Reuses existing `/api/v1/reports/builder/query` and `ReportFieldRegistry`.
  - Supports explicit `group_by_columns` and selected measures with authoritative SQL aggregations.
- **Single Store Posture**:
  - Fully honors `isLocationsManagementEnabled` and active store context.

## 7. Proposed Design
1. **Catalog Classification**:
   - `Identifiers`: Item Code, SKU, Barcode, Article No, Invoice No.
   - `Classifications`: Department, Category, Brand, Article, Sub Category.
   - `Attributes`: Color, Size, Material, Season, Style Code.
   - `Dimensions`: Branch, Customer, Supplier, Sales Staff, Date.
   - `Measures`: Quantity, Gross Total, Discount Amount, Tax Amount, Net Total, Cost Amount, Margin Amount.
2. **Layout Containers**:
   - `Rows`: Receives Classifications, Dimensions, Attributes, or Identifiers.
   - `Columns`: Receives Attributes or Classifications (triggers pivot matrix).
   - `Values`: Receives Measures with aggregation (SUM, COUNT, AVG, MIN, MAX).
   - `Filters`: Receives Dimensions, Classifications, or Attributes.
3. **Rendering Modes**:
   - Detailed Table Mode: Standard tabular grid.
   - Hierarchical Pivot Mode: When Rows, Columns, and Values are configured, computes pivot matrix with subtotals and grand totals.

## 8. Files Created
- `docs/implementation/reports/Report_Designer_Dynamic_Classification_And_Drag_Drop_Plan_v1.0.0.md`
- `src/components/reports/reportLayoutEngine.ts`
- `scratch/verify_drag_drop_report_designer.py`

## 9. Files Modified
- `src/components/reports/ReportBuilder.tsx`
- `src/components/reports/reportBuilderDomain.ts`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18 / Lucide Icons / Tailwind CSS design tokens.
- Native HTML5 Drag and Drop API (zero external runtime dependencies).
- FastAPI `/api/v1/reports/builder/query` backend endpoint.

## 11. Risks
- **Over-complex UI for simple users**: Mitigated by providing clear default layouts and compact view toggle.
- **Pivot data sparseness**: Mitigated by zero-filling missing dimension cells with `-` and computing accurate column totals.
- **State desynchronization**: Layout state is maintained in a single canonical configuration object.

## 12. Rollback Strategy
- All changes are localized to `src/components/reports/`. Standard git reversion restores the previous flat-chip UI if required.

## 13. Verification Plan
1. Linter verification: `npm.cmd run lint` / `tsc --noEmit`.
2. Backend API test suite: `pytest backend/tests/test_reporting_api_endpoints.py`.
3. Headless Playwright browser automation verifying:
   - Rendering of 5 logical categories (Identifiers, Classifications, Attributes, Dimensions, Measures).
   - Drag-and-drop and `+ Add` interactions into Rows, Columns, Values, Filters.
   - Field configuration panel with label, aggregation, and format editing.
   - Hierarchical matrix pivot view with subtotals and grand totals.
   - Single Store default badge and hidden multi-store dropdown.
   - Screenshot capture into brain artifact directory.

## 14. Test Plan
- Unit tests for layout engine partitioning and matrix pivoting.
- Integration tests for `/api/v1/reports/builder/query`.
- End-to-end browser tests in `scratch/verify_drag_drop_report_designer.py`.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with new plan entry.
- Create walkthrough under `docs/walkthrough/reports/`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Code edited in development workspace `F:\SMRITRretailNX`.
- Container rebuild via `docker compose build smriti-web`.
- Headless verification and browser screenshots.

## 17. Status
Approved / In Progress.

## 18. Related ADRs
- `docs/adr/ADR-0042_Universal_Reporting_And_Analytics_Engine.md`
- `docs/adr/ADR-0048_Report_Builder_Dynamic_Consolidation_And_Field_Registry.md`

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Reports_Standard_Daily_Retail_Registers_v1.0.0.md`

