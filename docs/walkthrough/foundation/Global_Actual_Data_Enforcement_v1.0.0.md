<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.98.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Walkthrough Document
-->

# Walkthrough: Global Actual-Data Enforcement Across SMRITI Retail OS v1.0.0

## 1. Purpose
This walkthrough documents the full-scale audit, remediation, and verification across SMRITI Retail OS enforcing the global architectural rule: **Every production screen, KPI, chart, report, table, dropdown, dashboard, search result, document preview, and operational workflow must strictly use actual persisted business data from the authoritative PostgreSQL database or an explicitly identified authoritative service.** All mock data fallbacks, fake statutory credentials in catch blocks, synthetic variant generators, and hardcoded baseline numbers have been permanently eliminated from production code paths.

## 2. Scope
Global remediation across frontend components and backend services:
- **Sales & Statutory Compliance**: `ComplianceDispatchModal.tsx`, `DispatchInvoicingStudioTab.tsx`.
- **Pricing & Merchandising**: `BulkPriceRevisionWorkflow.tsx`.
- **Billing & POS**: `ProPosLoyaltyLooku.tsx`, `ProPosReconciliationDlg.tsx`, `SmritiBillingStudio.tsx`.
- **Reports & Visual Analytics**: `visual_reports.py`, `visual_reports_service.py`, `visualReportsTypes.ts`, `VisualReportsDashboardTab.tsx`.
- **Inventory & WMS**: `SmartReplenishmentModal.tsx`.
- **Procurement**: `SupplierScorecardModal.tsx`.

## 3. Files Created
- `docs/implementation/foundation/GLOBAL_ACTUAL_DATA_ENFORCEMENT_v1.0.0.md`
- `docs/walkthrough/foundation/Global_Actual_Data_Enforcement_v1.0.0.md`

## 4. Files Modified
1. `backend/app/schemas/visual_reports.py`
2. `backend/app/services/visual_reports_service.py`
3. `src/components/billing/SmritiBillingStudio.tsx`
4. `src/components/billing/propos/ProPosLoyaltyLooku.tsx`
5. `src/components/billing/propos/ProPosReconciliationDlg.tsx`
6. `src/components/inventory/SmartReplenishmentModal.tsx`
7. `src/components/pricing/BulkPriceRevisionWorkflow.tsx`
8. `src/components/purchase/SupplierScorecardModal.tsx`
9. `src/components/reports/VisualReportsDashboardTab.tsx`
10. `src/components/reports/visualReportsTypes.ts`
11. `src/components/sales/DispatchInvoicingStudioTab.tsx`
12. `src/components/sales/components/ComplianceDispatchModal.tsx`
13. `docs/implementation/README.md`
14. `docs/walkthrough/README.md`
15. `CHANGELOG.md`
16. `RELEASE_NOTES.md`

## 5. Architecture Decisions
- **Decision 1: Elimination of Synthetic Gateway Payloads in Catch Blocks**:
  In `ComplianceDispatchModal.tsx`, failure to contact the NIC / GSTN gateway previously resulted in synthetic IRN, Ack No, QR payload, and E-Way Bill numbers being injected into state. This was replaced with strict error handling that logs the underlying exception and displays an actionable error toast to the user.
- **Decision 2: Authoritative Database Derivation for Visual Reports**:
  `visual_reports_service.py` replaced hardcoded metric baselines with real-time asynchronous SQLAlchemy queries against PostgreSQL (`StockMovement`, `SalesOrderReservation`, `SalesOrder`, `PackingSlip`, `Dispatch`, `SalesInvoice`, `Product`, `Company`).
- **Decision 3: Triple-State UI Standard (Loading / Error / Empty)**:
  Instead of disguising empty datasets or network failures with synthetic models, all components now implement:
  1. Asynchronous Loading (spinners / skeletons).
  2. Error State with explicit Retry action.
  3. Truthful Empty State explaining that 0 records exist and guiding next operational steps.

## 6. Design Rationale
In enterprise accounting and ERP software, synthetic data fallbacks create dangerous illusions of operational activity. Operators may believe inventory exists when it does not, or assume that statutory compliance documents have been transmitted to the government when in fact network timeouts occurred. By enforcing truthful reporting, the system prevents inventory discrepancies, eliminates statutory non-compliance penalties, and exposes genuine backend and connectivity issues immediately.

## 7. Implementation Summary
1. **Compliance Statutory Gateway (`ComplianceDispatchModal.tsx`)**:
   - Removed fake IRN generation (`IRN_MOCK_...`), fake Ack No (`ACK-12345678`), fake Signed QR code string, and fake EWB-01 generation from `catch` blocks.
   - Replaced fake success toasts with truthful error toasts displaying the actual gateway failure reason.
2. **Dispatch Invoicing Studio (`DispatchInvoicingStudioTab.tsx`)**:
   - Removed `sampleComplianceInvoice` ("TT/26-27/0001", "Reliance Retail Ltd - Central Hub").
   - Rewrote statutory action button to inspect `batchResult.generated_invoices`. If empty, it renders an actionable warning rather than creating fake records.
3. **Bulk Price Revision Workflow (`BulkPriceRevisionWorkflow.tsx`)**:
   - Completely deleted `generateMockSandals()` (which generated 124 synthetic variants of `SND-18-V`).
   - Removed mock fallbacks from search and catch blocks. When database queries return 0 items, a clean and truthful empty state is rendered.
4. **POS Reconciliation Conflict Queue (`ProPosReconciliationDlg.tsx`)**:
   - Removed `mockItems` (`posq_mock_01`, `posq_mock_02`) from `catch` blocks.
   - Added an error banner with a "Retry" button when `/sync/reconciliation-queue` fails.
5. **POS Loyalty & Rewards Lookup (`ProPosLoyaltyLooku.tsx`)**:
   - Eliminated `MOCK_LOYALTY_CUSTOMERS` ("Farida Jameel", "Rajesh Sharma", "Ananya Roy").
   - Connected component directly to live endpoint `GET /crm/customers/search?q=...` via `apiFetchV1` with loading spinner and empty search state.
6. **Counter POS Barcode Lookup (`SmritiBillingStudio.tsx`)**:
   - Removed fallback that silently matched and injected `INITIAL_DEMO_CART_ITEMS` into the cart when an unknown barcode was scanned. Scanned barcodes now strictly match database products or report "Barcode Not Found".
7. **Visual Reports Service & Schemas (`visual_reports_service.py`, `visual_reports.py`)**:
   - Made `trend_percentage: Optional[str] = None` in schema to support neutral metrics.
   - Queried live PostgreSQL metrics for `COMP-001`:
     - On-hand stock: `SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE company_id = 'COMP-001'` -> exactly `23,064.00` pairs.
     - Reserved stock: `SELECT COALESCE(SUM(reserved_quantity - released_quantity - consumed_quantity), 0) FROM sales_order_reservations WHERE company_id = 'COMP-001' AND status = 'ACTIVE'` -> `0.0` pairs.
     - Available stock: `23,064.00` pairs.
     - Sales orders: `0`, Packing slips: `0`, Dispatches: `0`, Invoices: `0`.
     - Company Name: Dynamically queried from `companies` table (`"My Retail Store"` for `COMP-001`).
     - Category stock positions: Dynamic group by `Product.category` joined with `StockMovement`.
8. **Visual Reports Frontend Dashboard (`VisualReportsDashboardTab.tsx`)**:
   - Replaced hardcoded company `<option>` tags with dynamic company selector bound to `selectedCompanyId` and `selectedCompany`.
   - Replaced static date label with dynamic presets (`Today`, `Last 7 Days`, `MTD`).
   - Replaced hardcoded donut chart count `<span ...>62</span>` with dynamic `totalPackingSlips` memo.
   - Replaced hardcoded tab counts with dynamic `streamCounts` memo.
   - Added connection error banner with "Retry Connection" action.
   - Added truthful empty state rows for Category Positions, Top SKUs, and Active Fulfillment Stream table when PostgreSQL returns 0 records.
9. **Smart Replenishment Engine (`SmartReplenishmentModal.tsx`)**:
   - Removed static `SAMPLE_INVENTORY` demo array and hardcoded August 2026 date.
   - Wired live `apiFetchV1("/inventory?page_size=100")` fetching authoritative catalog items.
   - Added loading animation, error alert, and truthful empty state.
10. **Supplier Scorecard & Vendor SLA Audit (`SupplierScorecardModal.tsx`)**:
    - Eliminated automatic fallback to `dataMode = "demo"` when database returns 0 suppliers.
    - Truthfully displays "No supplier records found in active database" with an explicit opt-in button to load the benchmark simulation model if desired.

## 8. Tests Executed
1. `vitest run src/tests/visualReportsDashboard.test.ts`
2. `vitest run src/tests/p0BillingRemediationAndUx.test.ts src/tests/procurementVisualReports.test.ts src/tests/printLabelsStudio.test.ts`
3. `python -m pytest backend/tests/test_procurement_visual_reports.py`
4. Backend Visual Reports Live Verification against PostgreSQL (`smritisys` database)
5. `npx tsc --noEmit`
6. `npm run architecture:check`
7. `npm run validate-registry`
8. `npm run validate-launchpad`
9. `npm run build` (Vite production bundle)

## 9. Verification Results
- Vitest suites: **69/69 tests passed** across all test runs.
- Pytest suite: **2/2 tests passed**.
- Live PostgreSQL Query Verification: Passed (Company: "My Retail Store", On-Hand: 23,064 pairs, Available: 23,064 pairs, Reserved: 0 pairs).
- TypeScript Compilation: **0 errors** (`npx tsc --noEmit` exit 0).
- Architecture Check: **0 violations** (11 checks executed).
- Registry Validation: **98/98 form components verified**.
- Launchpad Validation: **55 catalog tiles, 137 app render cases verified**.
- Production Build: **Exit code 0** (built in 47.73s).

## 10. Known Limitations
- When a company has no sales orders, packing slips, or dispatches (such as a newly onboarded tenant), the Active Fulfillment Stream table truthfully displays 0 rows. This is intended behavior and reflects the true database state.
- In offline mode, network endpoints will surface the error retry banner until network connectivity to FastAPI is restored.

## 11. Future Work
- Implement WebSocket progress streaming for high-volume inventory reorder calculations in `SmartReplenishmentModal`.
- Introduce tenant-level benchmark simulation toggles in System Settings for sales demonstrations.

## 12. Related ADRs
- `ADR-001`: Sole Backend System of Record (FastAPI + PostgreSQL).
- `ADR-004`: Zero Silent Mock Data Fallback Policy.
- `ADR-012`: Statutory Gateway Audit & Strict Error Propagation.

## 13. Related RFCs
- `RFC-2026-08`: Universal Actual-Data Enforcement in Production Runtimes.
- `RFC-2026-11`: Statutory Gateway Fault Tolerance and Immutable Auditing.
