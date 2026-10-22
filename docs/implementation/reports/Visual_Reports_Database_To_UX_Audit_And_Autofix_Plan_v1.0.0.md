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
  Classification: Canonical Visual Reports Implementation Plan (IPGP-v1.0)
-->

# Visual Reports Dashboard — Database-to-UX Audit & Auto-Fix Implementation Plan

## 1. Objective
Establish complete, authentic, mathematically balanced, and verified data flow for the Visual Reports Dashboard (`Home > Visual Reports` / `VisualReportsDashboardTab.tsx`). Ensure all 7 dashboard components (KPI Cards, Order-to-Invoice Progress, Category Stock Position, Packing Slip Status Donut, Dispatch & Invoice Summary, Active Fulfillment Stream, and Dashboard Controls) are genuinely connected to PostgreSQL tables through the FastAPI backend service layer and frontend React hooks with zero dummy/prototype artifacts.

## 2. Business Motivation
In an enterprise retail and distribution environment, operational managers rely on the Visual Reports dashboard for real-time inventory visibility, fulfillment velocity tracking, and stock drift detection. Disconnected widgets, unpopulated fulfillment feeds, hardcoded filter badges, and discrepancies between donut chart slices and counter metrics undermine operational integrity. Synchronizing the dashboard with authoritative batch and movement ledgers ensures decision-grade accuracy.

## 3. Scope
- **Backend Service**: `backend/app/services/visual_reports_service.py` (`VisualReportsService`).
- **Backend Router**: `backend/app/api/v1/reports.py` (`/visual-dashboard/summary`).
- **Frontend Component**: `src/components/reports/VisualReportsDashboardTab.tsx`.
- **Frontend Verification Suite**: `src/tests/visualReportsDashboard.test.ts`.
- **Backend Verification Suite**: `backend/app/tests/test_visual_reports_dashboard.py`, `test_visual_reports_signed_quantities.py`, `test_visual_reports_followup.py`.

## 4. Current State
- Component A (KPIs) & Component C (Category Positions): `total_on_hand` relied solely on `StockMovement` signed quantities, ignoring authoritative `product_batch_stocks` ledger and turning negative when historical audit test write-offs were present.
- Component B (Order-to-Invoice Progress): Division by sales order count resulted in anomalous percentages (e.g., 3643%) when direct POS retail and counter pickup invoices exceeded wholesale orders.
- Component D (Packing Slip Status): Donut query was not constrained by selected date range, causing a mismatch between donut slice totals (70) and center counter metric (`ps_count` = 2).
- Component F (Active Fulfillment Stream): `fulfillment_stream: List[FulfillmentStreamItem] = []` was literally an empty list in `visual_reports_service.py`, never querying the underlying transactional tables.
- Component G (Controls): Filter button text was hardcoded to `Filters: 3 applied` regardless of active filters, and `loadDashboardData()` failed to pass `store_location_id` to the backend.

## 5. Gap Analysis
1. **Fulfillment Stream Gap**: Missing queries for `sales_orders`, `packing_slips`, `dispatches`, and `sales_invoices`.
2. **Dual-Ledger Invariant Gap**: Violation of Section 7 / StockSynchronizer invariant by querying only `stock_movements` rather than `product_batch_stocks` for batch-tracked inventory.
3. **Filter Count Hardcoding**: Static string in JSX rather than dynamic memoized evaluation.
4. **Parameter Omission**: Store location selector omitted from backend query string.
5. **Stage Subtext Semantics**: Failure to distinguish direct POS invoices from sales-order-originated invoices.

## 6. Architecture Impact
Adheres strictly to SMRITI Architecture Hierarchy:
`React 18 + Vite (Frontend Client Layer) -> Reverse Proxy (/api/v1) -> FastAPI Core + PostgreSQL (Transactional System-of-Record Backend)`.
Maintains zero schema mutations (Case A: 100% schema reuse). Conforms to `StockSynchronizer` invariant (E-001): batch-tracked items resolve from `product_batch_stocks`, non-batch items resolve from positive `Product.stock`.

## 7. Proposed Design
1. **Authoritative On-Hand Calculation**: Combine `ProductBatchStock` (`SUM(quantity - damaged_quantity)`) with non-batch `Product.stock` (`SUM(GREATEST(p.stock, 0))`), with fallback to signed movements.
2. **Active Fulfillment Stream Query**: Concurrently query recent documents across `sales_orders`, `packing_slips`, `dispatches`, and `sales_invoices`, joining customer names, item summaries, quantities, amounts, and statuses into `FulfillmentStreamItem`.
3. **Category Stock Positions**: Aggregate batch stock + non-batch stock grouped by `Product.category`, ensuring 100% parity with total on-hand inventory.
4. **Donut-Center Synchronization**: Apply consistent date and location filters to donut query and synchronize `total_packing_slips_count`.
5. **Dynamic Filter Pill**: Compute `appliedFilterCount` from active `selectedCompanyId`, `selectedLocation`, and `dateRangePreset`.
6. **Query Parameter Binding**: Pass `store_location_id` in `loadDashboardData` whenever `selectedLocation` is set.

## 8. Files Created
- `docs/implementation/reports/Visual_Reports_Database_To_UX_Audit_And_Autofix_Plan_v1.0.0.md`
- `docs/walkthrough/reports/Visual_Reports_Database_To_UX_Audit_And_Autofix_v1.0.0.md`

## 9. Files Modified
- `backend/app/services/visual_reports_service.py`
- `src/components/reports/VisualReportsDashboardTab.tsx`
- `src/tests/visualReportsDashboard.test.ts`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy 2.0+ (asyncpg)
- PostgreSQL 16+
- React 18 + Vite
- Vitest 4.1+
- Lucide React

## 11. Risks
- Performance of fulfillment stream queries across high-volume tables: mitigated by indexed lookups, indexed `created_at DESC` ordering, and `LIMIT 25` per document category.
- Stale or negative stock values from manual test runs: mitigated by dual-ledger aggregation and non-batch positive bounding.

## 12. Rollback Strategy
Git revert of commit restores previous behavior cleanly. Zero database migration or structural DDL rollback required.

## 13. Verification Plan
- Live backend verification: execute `VisualReportsService.get_dashboard_summary()` against PostgreSQL database `smriti001`.
- Backend automated tests: run Pytest suite (`test_visual_reports_dashboard.py`, `test_visual_reports_followup.py`, `test_visual_reports_signed_quantities.py`).
- Frontend automated tests: run Vitest suite (`npm test -- --run reports`).
- TypeScript compiler verification: run `npx tsc --noEmit`.

## 14. Test Plan
- Unit tests: verify `computeAppliedFilters` with various permutations of company, location, and date preset.
- Integration tests: verify URL query parameter serialization with `store_location_id`.
- Regression tests: ensure all existing KPI card, stock flow timeline, and configuration persistence tests remain green.

## 15. Documentation Impact
- Update `docs/walkthrough/README.md` master index.
- Update `docs/implementation/README.md` master index.
- Update `CHANGELOG.md` under v6.99.1.

## 16. Deployment Plan
Commit and push changes on branch `smritiNX`. Pull into test environment `F:\Smriti9` as required by Environment Rules.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-0021`: FastAPI + PostgreSQL Canonical Backend System of Record.
- `ADR-0045`: Single-Door Stock Ledger Architecture and Dual-Ledger Invariant.

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Visual_Reports_Database_To_UX_Audit_And_Autofix_v1.0.0.md`
- `docs/walkthrough/reports/Report_Builder_Live_Data_Binding_Walkthrough_v1.1.0.md`
