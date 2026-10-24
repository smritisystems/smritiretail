<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Walkthrough: Report Designer Intelligent Auto-Consolidation & Dynamic Server-Side Grouping

## 1. Purpose
This walkthrough details the architecture, design, and implementation of **Intelligent Row Auto-Consolidation** within the **SMRITI BI & Reporting Center → Report Designer / Report Builder** (`ReportBuilder.tsx`). When multiple database records share identical values across selected report columns, the reporting engine dynamically consolidates them into a single row at the database/query layer instead of rendering repetitive lines, while preserving accurate measure aggregations and preventing Cartesian join inflation.

## 2. Scope
- **Centralized Metadata Registry (`ReportFieldRegistry`)**: Created in `backend/app/services/report_field_registry.py` classifying fields into Grouping Dimensions, Additive Measures (`SUM`), Non-Additive Measures (`AVG`, weighted rates, balances), and Counts.
- **SQLAlchemy Query Auto-Consolidation & Grouping Engine**: Updated `ReportsService.query_report_builder` in `backend/app/services/reports.py` with dynamic `GROUP BY` construction across `auto`, `detailed`, and `groupby` modes.
- **Cartesian Join Inflation Elimination**: Cured item count and monetary inflation by replacing 1:N outer joins on bills with correlated scalar subqueries (`bill_subquery`).
- **Pydantic Contract Extensions**: Updated `ReportBuilderResponse` and API parameters in `backend/app/schemas/reports.py` and `backend/app/api/v1/reports.py` to support `consolidation_mode`, `selected_columns`, and `group_by_columns`.
- **Frontend Studio UX**: Updated `src/components/reports/ReportBuilder.tsx` with Row Consolidation mode selector (`Auto Consolidation`, `Detailed Rows`, `Custom Group By`), dynamic column re-querying, visual consolidation pill badge (`N lines`), and drill-down drawer/modal showing raw underlying lines.
- **Test Certification**: Comprehensive integration tests in backend Pytest (`test_report_builder_auto_consolidation.py`) and frontend Vitest (`reportBuilderAutoConsolidation.test.ts`).

## 3. Files Created
- `backend/app/services/report_field_registry.py` — Centralized semantic classification and aggregation rules for reporting fields.
- `backend/app/tests/test_report_builder_auto_consolidation.py` — Multi-scenario integration test verifying consolidation, dimension splitting, and join inflation protection.
- `src/tests/reportBuilderAutoConsolidation.test.ts` — Vitest suite verifying client-side consolidation query generation and dimension splitting.
- `docs/implementation/reports/Report_Designer_Auto_Consolidation_Plan_v1.0.0.md` — 19-section IPGP implementation plan.
- `docs/walkthrough/reports/Report_Designer_Auto_Consolidation_Walkthrough_v1.0.0.md` — This WGP walkthrough document.

## 4. Files Modified
- `backend/app/schemas/reports.py` — Extended schema with `consolidation_mode` and `group_by_dimensions`.
- `backend/app/api/v1/reports.py` — Added query parameters for `consolidation_mode`, `selected_columns`, and `group_by_columns`.
- `backend/app/services/reports.py` — Implemented server-side grouping, aggregation, inflation-safe scalar subquery, and consolidated indicators.
- `src/components/reports/ReportBuilder.tsx` — Added consolidation selector, reactive dependencies on column toggling, consolidated row pill badge, and drill-down modal.
- `docs/implementation/README.md` — Updated master implementation plan index.
- `docs/walkthrough/README.md` — Updated master walkthrough index.
- `CHANGELOG.md` — Documented changes under release `6.99.6`.

## 5. Architecture Decisions
1. **Server-Side Grouping & Aggregation Over Client DOM Hiding**:
   - *Rationale*: Downloading thousands of raw un-aggregated records to the browser and grouping them in client memory wastes network bandwidth, degrades browser responsiveness, and breaks pagination and server grand totals. Grouping in SQL (`GROUP BY ...`) executes natively in PostgreSQL in milliseconds.
2. **Deterministic Metadata Registry (`ReportFieldRegistry`)**:
   - *Rationale*: Never blindly sum all numeric columns (e.g. Size `8`, `9`, `10` or Tax Rate `18%` must NOT be summed to `27` or `54%`). The field registry classifies columns explicitly: dimensions (Supplier, PO No, Article, Color, Size, Branch, Date), additive measures (Quantity, Net Amount, Tax Amount -> `SUM`), non-additive rates (Unit Price, MRP -> `AVG`), and records count (`COUNT`).
3. **Correlated Scalar Subquery for Bill Linkage**:
   - *Rationale*: A purchase order item belongs to one order, but an order can have multiple bills. An outer join `JOIN purchase_bills` causes a Cartesian multiplication of item rows. Using `select(PurchaseBill.bill_no).where(PurchaseBill.order_id == PurchaseOrder.id).limit(1).scalar_subquery()` completely cures join inflation while preserving the bill number.

## 6. Design Rationale
- Retail users frequently need to toggle between bird's-eye supplier/PO summaries and granular SKU/size-level manifests.
- In Auto mode, the reporting engine inspects the user's active column selections. If the user only selects Supplier, PO No, Article, and Color, all size rows collapse into a single consolidated row with summed quantity and net amount.
- As soon as the user checks "Size", the grouping key expands to include Size, naturally splitting the rows without requiring manual SQL queries.
- Clicking the consolidated badge ("2 lines") pops up an interactive drill-down showing the exact raw item lines that produced the aggregate row.

## 7. Implementation Summary
1. **Field Registry**: Implemented `ReportFieldRegistry` with semantic type mappings (`DIMENSION`, `ADDITIVE_MEASURE`, `NON_ADDITIVE_RATE`, `COUNT`) and methods `partition_columns`, `is_dimension`, `is_additive_measure`, and `get_aggregation_type`.
2. **Engine Grouping Logic**:
   - Evaluated `consolidation_mode` (`auto`, `detailed`, `groupby`).
   - Built dynamic `GROUP BY` list from selected dimensions.
   - For additive measures: applied `func.sum()`.
   - For non-additive measures: applied `func.avg()`.
   - Included synthetic metadata columns: `_record_count` (`func.count(distinct(PurchaseOrderItem.id))`) and `_is_consolidated` (`case((func.count(...) > 1, True), else_=False)`).
3. **Frontend Integration**:
   - Added `consolidationMode` state to `ReportBuilder.tsx` defaulting to `"auto"`.
   - Built a sleek consolidation dropdown selector in the top toolbar with quick mode switching.
   - Linked column selection toggles to reload live query data dynamically.
   - Rendered consolidated badges and drill-down drawer with line-level details.

## 8. Tests Executed
1. **Backend Integration Suite**:
   - Command: `.\.venv\Scripts\pytest.exe backend/app/tests/test_report_builder_auto_consolidation.py`
   - Verified:
     - Field classification across all report categories.
     - Auto-consolidation of multiple size lines into 1 PO-level row with exact quantity and net amount sums.
     - Dimension splitting when `article_sku` / size is selected.
     - Curing of Cartesian join inflation on orders with multiple bills.
   - Output: **3 passed, 28 warnings in 46.33s**.
2. **Frontend Vitest Suite**:
   - Command: `npx vitest run src/tests/reportBuilderAutoConsolidation.test.ts`
   - Verified: Field classification helper, parameter generation for auto-consolidation, size splitting, detailed rows mode, and custom group by mode.
   - Output: **5 passed in 614ms**.
3. **Existing Vitest Suites Regression Check**:
   - Command: `npx vitest run src/tests/reportBuilder.test.ts src/tests/reportBuilderLiveData.test.ts`
   - Output: **20 passed in 623ms**.
4. **TypeScript Compiler Check**:
   - Command: `npx tsc --noEmit`
   - Output: **0 errors**.

## 9. Verification Results
| Verification Item | Target | Result | Status |
|---|---|---|---|
| Auto-Consolidation (Same Supplier + PO + Article) | 1 row, Quantity=15.0, Net Amount=11800.0 | Verified in live DB and test suite | **Done** |
| Dynamic Splitting on Size / SKU | 2 rows for SKU-01 and SKU-02 | Verified in live DB and test suite | **Done** |
| Cartesian Inflation Protection | Line count = 2 even with 2 bills | Verified in live DB and test suite | **Done** |
| Frontend React Reactive Grouping | Parameters emitted & live data bound | Verified via Vitest & TS compile | **Done** |
| Interactive Drill-Down Modal | Shows raw transactional items | Verified in ReportBuilder component | **Done** |

## 10. Known Limitations
- Custom `Group By` mode currently supports dimension columns registered in `ReportFieldRegistry`; non-registered calculated formula fields will fallback to detailed row representation until formula expression trees are mapped to SQL dialects.

## 11. Future Work
- Extend auto-consolidation grouping to Sales, POS Shifts, and Inventory movement reports using the same `ReportFieldRegistry` foundation.
- Support multi-level hierarchical drill-down trees directly within the table grid view.

## 12. Related ADRs
- `docs/adr/ADR_REPORT_BUILDER_PRODUCTION_QUERY_ENGINE.md` — FastAPI + PostgreSQL live query engine.
- `docs/adr/ADR_UNIVERSAL_REPORT_REGISTRY.md` — Field registry and column schema governance.

## 13. Related RFCs
- `RFC-2026-REP-003` — Report Designer Intelligent Consolidation & Dimension Aggregation.
