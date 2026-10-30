<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Visual Reports Walkthrough (WGP-v1.0)
-->

# SMRITI Visual Reports — Database-to-UX Audit & Auto-Fix Walkthrough

## 1. Purpose
This walkthrough documents the comprehensive database-to-UX audit, data binding repair, and synchronization of the Visual Reports Dashboard (`Home > Visual Reports` / `VisualReportsDashboardTab.tsx`). It details the diagnosis, architectural alignment, query engineering, and verified data flow connecting PostgreSQL transactional ledgers to the frontend React interface across all 7 dashboard components.

## 2. Scope
- **Subsystem**: Reports & Business Intelligence (`REPORTS` domain).
- **Backend Service**: `backend/app/services/visual_reports_service.py` (`VisualReportsService`).
- **Backend API**: `backend/app/api/v1/reports.py` (`GET /api/v1/reports/visual-dashboard/summary`).
- **Frontend Component**: `src/components/reports/VisualReportsDashboardTab.tsx`.
- **Test Suites**: `src/tests/visualReportsDashboard.test.ts` (Vitest), `backend/app/tests/test_visual_reports_dashboard.py`, `test_visual_reports_followup.py`, `test_visual_reports_signed_quantities.py` (Pytest).

## 3. Files Created
- `docs/implementation/reports/Visual_Reports_Database_To_UX_Audit_And_Autofix_Plan_v1.0.0.md`
- `docs/walkthrough/reports/Visual_Reports_Database_To_UX_Audit_And_Autofix_v1.0.0.md`

## 4. Files Modified
- `backend/app/services/visual_reports_service.py`
- `src/components/reports/VisualReportsDashboardTab.tsx`
- `src/tests/visualReportsDashboard.test.ts`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Dual-Ledger Inventory Alignment (StockSynchronizer Invariant E-001)**:
   Rather than querying exclusively from `stock_movements` (which caused negative on-hand totals due to audit write-offs), `VisualReportsService` adheres to the canonical dual-ledger invariant:
   - For batch-tracked products, the authoritative ledger is `product_batch_stocks` (`SUM(quantity - damaged_quantity)`).
   - For non-batch products, stock resolves from `Product.stock` (`SUM(GREATEST(stock, 0))`).
   - Category positions and total on-hand reflect this combined reality, yielding 200,989 authentic units across 19 categories.
2. **Real Transactional Fulfillment Stream Aggregation**:
   Eradicated empty fulfillment stream (`[]`). Implemented live indexed queries across 4 core fulfillment documents:
   - `sales_orders` (Type SO): 25 recent orders with status, total pairs, and value.
   - `packing_slips` (Type PS): 25 recent slips with status, total packages, and invoice value.
   - `dispatches` (Type DS): 25 recent dispatches with courier partner, tracking number, and delivery status.
   - `sales_invoices` (Type INV): 25 recent invoices with customer name, items summary, and payment mode.
3. **Donut-Center Counter Mathematical Synchronization**:
   Constrained packing slip status donut slices to the active date filter window (`ps_date_expr >= s_date AND ps_date_expr <= e_date`) with fallback to overall distribution when range is empty, ensuring donut slice counts match `total_packing_slips_count` and center donut metric.
4. **Dynamic Applied Filter Count**:
   Replaced hardcoded `Filters: 3 applied` button with dynamically evaluated memoized count (`appliedFilterCount`) inspecting `selectedCompanyId`, `selectedLocation`, and `dateRangePreset`.
5. **Location Parameter Propagation**:
   Enhanced `loadDashboardData()` in the React client to append `store_location_id` to query parameters whenever a specific store/warehouse location is selected.

## 6. Design Rationale
- **Mathematical Integrity**: KPI On-Hand (200,989) equals the exact sum of all Category Stock Positions (103,707 Footwear + 79,834 General + 5,969 Industrial + 4,667 Apparel + ...).
- **Graceful Retail/POS Handling**: For Order-to-Invoice Progress, when direct POS retail invoices exceed sales orders, percentages are capped at 100% and subtexts reflect authentic invoice counts rather than anomalous 3600% ratios.
- **Top Reserved SKUs Fallback**: When separate reservation records are inactive, the query falls back to open sales order pending line items (`sales_order_items.pending_quantity > 0`), surfacing genuine footwear articles (`TATLD FORMAL CHAPPAL`, `TATLD ETHNIC SANDAL`).

## 7. Implementation Summary
- **Dual-Ledger Stock Queries**: Implemented `stmt_batch_stock` and `stmt_non_batch` in `VisualReportsService.get_dashboard_summary()`.
- **Category Stock Position**: Aggregated batch stock and non-batch stock by `Product.category`, filtering out zero/negative entries and sorting by total units descending.
- **Top SKUs**: Integrated reservation query with fallback to `sales_order_items.pending_quantity > 0`.
- **Fulfillment Stream**: Structured 4 query blocks populating `FulfillmentStreamItem` objects with color codes, human-readable dates, next actions, and icons.
- **Frontend Filter Pill**: Bound `Filters: {appliedFilterCount} applied` dynamically in `VisualReportsDashboardTab.tsx`.
- **Frontend Query Params**: Added `params.append("store_location_id", selectedLocation)` when `selectedLocation !== "all" && selectedLocation !== "All Locations"`.

## 8. Tests Executed
1. **Direct Backend Service Verification (`verify_visual_reports.py`)**:
   - Company: Tattly Threads (`COMP-001`).
   - On-Hand: 200,989 pairs.
   - Reserved: 16,919 pairs.
   - Available: 184,070 pairs.
   - Sales Orders: 21.
   - Packing Slips: 37.
   - Dispatches: 32.
   - Invoices: 779.
   - Packing Donut: 37 slips (25 DISPATCHED / 67.6%, 12 PACKED / 32.4%).
   - Top SKUs: 10 authentic items populated with pending order quantities.
   - Fulfillment Stream: 100 live documents (25 SO, 25 PS, 25 DS, 25 INV).
   - Drift Status: 25 products drifting (2,108.0 units divergence), matching `StockSynchronizer.detect_stock_drift`.
2. **Backend Automated Pytest Suite**:
   - `pytest app/tests/test_visual_reports_dashboard.py app/tests/test_visual_reports_followup.py app/tests/test_visual_reports_signed_quantities.py -v`: 7/7 passed.
3. **Frontend Automated Vitest Suite**:
   - `npm test -- --run reports`: 20/20 passed across 3 test files.
4. **TypeScript Typecheck**:
   - `npx tsc --noEmit`: 0 errors.

## 9. Verification Results
```text
Backend Pytest Results:
app/tests/test_visual_reports_dashboard.py::test_visual_dashboard_summary_api PASSED
app/tests/test_visual_reports_dashboard.py::test_visual_dashboard_config_get_and_post PASSED
app/tests/test_visual_reports_followup.py::test_inventory_reports_signed_quantities_positive_sale_negative_ecom PASSED
app/tests/test_visual_reports_followup.py::test_visual_reports_drift_badge_offsetting_products_and_location_filter PASSED
app/tests/test_visual_reports_followup.py::test_stock_ledger_query_unclassified_movement_types PASSED
app/tests/test_visual_reports_signed_quantities.py::test_visual_reports_signed_quantities_and_timeline_reconciliation PASSED
app/tests/test_visual_reports_signed_quantities.py::test_visual_reports_pos_flow_no_zero_division PASSED
================== 7 passed, 24 warnings in 99.99s ==================

Frontend Vitest Results:
 ✓ src/tests/procurementAndReportsAudit.test.ts (3 tests)
 ✓ src/tests/visualReportsDashboard.test.ts (7 tests)
 ✓ src/tests/procurementVisualReports.test.ts (10 tests)
 Test Files  3 passed (3)
      Tests  20 passed (20)

TypeScript Compilation:
npx tsc --noEmit -> Exit Code 0 (0 errors)
```

## 10. Known Limitations
- When a date preset with zero transactions is selected (e.g., "Today" outside business hours), document counts honestly display 0, and the Fulfillment Stream displays the honest empty state.
- Dispatch items without monetary rate data calculate invoice value via linked packing slip invoices.

## 11. Future Work
- Add client-side CSV/Excel export for the 100-row Active Fulfillment Stream.
- Integrate direct deep-links from document preview modals to dedicated invoice and packing slip edit views.

## 12. Related ADRs
- `ADR-0021`: Canonical FastAPI + PostgreSQL Backend Architecture.
- `ADR-0045`: Single-Door Stock Ledger Architecture and Dual-Ledger Invariant.

## 13. Related RFCs
- `RFC-0089`: Visual Reports Dashboard KPI & Stream Specification.
