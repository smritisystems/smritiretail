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
  Classification: Internal Implementation Plan
-->

# Implementation Plan: Global Actual-Data Enforcement Across SMRITI Retail OS v1.0.0

## 1. Objective
Enforce the global engineering mandate across the entire SMRITI Retail OS application: **Every production screen, KPI, chart, report, table, dropdown, dashboard, search result, document preview, and operational workflow must strictly use actual persisted business data from the authoritative PostgreSQL database or an explicitly identified authoritative service.** Completely eliminate all hardcoded mock records, synthetic seed arrays, silent error-catch mock fallbacks, and manufactured statutory credentials from production code paths, while preserving genuine test fixtures in `tests/`, template layouts in `PrintStudioTab.tsx`, sample CSV generator templates, and explicit user-requested demo actions.

## 2. Business Motivation
SMRITI Retail OS is an enterprise retail ERP and Point of Sale platform managing real statutory GST tax liabilities, financial ledgers, inventory movements, and supply chain fulfillment. In earlier rapid UI/UX prototyping phases, several components introduced client-side synthetic arrays (`MOCK_LOYALTY_CUSTOMERS`, `generateMockSandals`, `SAMPLE_INVENTORY`, `sampleComplianceInvoice`, `posq_mock_01`) or hardcoded baseline metrics as fallbacks when network requests failed or when empty datasets were returned. In production, silent fallbacks disguise database disconnection errors, display misleading financial or stock figures to cashiers and store managers, and risk generating invalid statutory tax reports. Enforcing 100% actual persisted data guarantees accounting integrity, auditable statutory compliance, and truthful system observability.

## 3. Scope
Comprehensive software-wide audit, remediation, and verification across 6 core operational modules:
1. **Sales & Compliance Invoicing**:
   - `src/components/sales/components/ComplianceDispatchModal.tsx`
   - `src/components/sales/DispatchInvoicingStudioTab.tsx`
2. **Pricing & Merchandising**:
   - `src/components/pricing/BulkPriceRevisionWorkflow.tsx`
3. **Point of Sale (POS) Billing & Customer Loyalty**:
   - `src/components/billing/propos/ProPosLoyaltyLooku.tsx`
   - `src/components/billing/propos/ProPosReconciliationDlg.tsx`
   - `src/components/billing/SmritiBillingStudio.tsx`
4. **Reports & Visual Analytics**:
   - `backend/app/schemas/visual_reports.py`
   - `backend/app/services/visual_reports_service.py`
   - `src/components/reports/visualReportsTypes.ts`
   - `src/components/reports/VisualReportsDashboardTab.tsx`
5. **Inventory & Warehouse Management (WMS)**:
   - `src/components/inventory/SmartReplenishmentModal.tsx`
6. **Procurement & Vendor Governance**:
   - `src/components/purchase/SupplierScorecardModal.tsx`

## 4. Current State
Prior to remediation:
- `ComplianceDispatchModal.tsx`: When e-Invoice or e-Way Bill generation failed against NIC / GSTN gateway APIs, catch blocks populated synthetic IRN, Ack No, Signed QR code payload, and fake EWB-01 numbers, falsely notifying the user of success.
- `DispatchInvoicingStudioTab.tsx`: Contained a hardcoded `sampleComplianceInvoice` ("TT/26-27/0001", Reliance Retail Ltd) triggered by the toolbar compliance action when batch dispatch results were empty.
- `BulkPriceRevisionWorkflow.tsx`: Contained `generateMockSandals()` generating 124 synthetic variants of `SND-18-V` when searches returned 0 records or when network calls threw errors.
- `ProPosLoyaltyLooku.tsx`: Contained `MOCK_LOYALTY_CUSTOMERS` ("Farida Jameel", "Rajesh Sharma", "Ananya Roy") served in place of live customer records.
- `ProPosReconciliationDlg.tsx`: Contained `mockItems` (`posq_mock_01`, `posq_mock_02`) in catch blocks when the reconciliation queue endpoint failed.
- `SmritiBillingStudio.tsx`: Unknown barcode scans fell back to silently matching and injecting `INITIAL_DEMO_CART_ITEMS` into the cart.
- `visual_reports_service.py`: Used hardcoded baseline values (`base_on_hand = 12580`, `base_reserved = 3240`, `base_so = 48`, etc.) and synthetic category percentages instead of live SQL aggregations.
- `VisualReportsDashboardTab.tsx`: Company selector and date range header hardcoded "SMRITI FOOTWEAR PVT LTD" and "01 Apr 2025 - 30 Apr 2025", with hardcoded tab and donut badge counts.
- `SmartReplenishmentModal.tsx`: Rendered static `SAMPLE_INVENTORY` array with hardcoded August 2026 dates instead of live inventory items.
- `SupplierScorecardModal.tsx`: Automatically fell back to `dataMode = "demo"` (Kapoor Textiles Ltd., Mehta Synthetics Pvt.) when database returned 0 suppliers.

## 5. Gap Analysis
| Component | Prior Defect / Mock Pattern | Remediation Strategy |
| :--- | :--- | :--- |
| `ComplianceDispatchModal.tsx` | Fake IRN, Ack No, QR, EWB in catch block | Remove mock fallbacks; propagate truthful NIC error toasts with error details |
| `DispatchInvoicingStudioTab.tsx` | Synthetic `sampleComplianceInvoice` object | Delete mock object; check real batch dispatch results and show actionable warning |
| `BulkPriceRevisionWorkflow.tsx` | `generateMockSandals()` 124 synthetic items | Query live catalog via `apiFetchV1` or return truthful `[]` empty state |
| `ProPosLoyaltyLooku.tsx` | Static `MOCK_LOYALTY_CUSTOMERS` array | Wire live `GET /crm/customers/search?q=...` with loading and empty states |
| `ProPosReconciliationDlg.tsx` | Fake `posq_mock_01/02` in catch block | Propagate real network error with error banner and retry action |
| `SmritiBillingStudio.tsx` | Barcode fallback to `INITIAL_DEMO_CART_ITEMS` | Scanned barcodes must strictly match live products or display "Barcode Not Found" |
| `visual_reports_service.py` | Hardcoded synthetic metric baselines | Live PostgreSQL queries across `StockMovement`, `SalesOrderReservation`, `SalesOrder`, etc. |
| `VisualReportsDashboardTab.tsx` | Hardcoded company options & static counts | Dynamic company binding, live date presets, dynamic stream counts, error banner |
| `SmartReplenishmentModal.tsx` | Static `SAMPLE_INVENTORY` demo array | Live `GET /inventory?page_size=100` fetching actual products and stock thresholds |
| `SupplierScorecardModal.tsx` | Auto-fallback to demo vendors | Truthful empty state when 0 suppliers found; explicit opt-in for benchmark model |

## 6. Architecture Impact
- **Backend Service Layer**: `visual_reports_service.py` now executes live asynchronous SQLAlchemy queries against `StockMovement`, `SalesOrderReservation`, `SalesOrder`, `PackingSlip`, `Dispatch`, `SalesInvoice`, `Product`, and `Company`.
- **API Contracts**: Preserved 100% backward compatibility of `/api/v1/reports/visual-dashboard/*` and `/api/v1/crm/customers/search`. Made `trend_percentage` nullable in schemas.
- **Frontend State Management**: Eliminated silent mock substitutions. Introduced three mandatory UI states across all affected components:
  1. Asynchronous Loading State (spinner / skeleton).
  2. Truthful Error State with explicit Retry action.
  3. Truthful Empty State with domain-specific explanations and guidance.
- **Zero Schema Mutations**: No Alembic database migrations required; leverages existing normalized PostgreSQL schema.

## 7. Proposed Design
1. **Compliance Statutory Gateway**:
   - Eliminate synthetic IRN generation (`IRN_MOCK_...`).
   - Propagate portal HTTP response codes and official error descriptions.
2. **Dispatch Invoicing Studio**:
   - Remove `sampleComplianceInvoice`. Inspect `batchResult.generated_invoices`.
   - If empty, display an amber warning badge stating no invoices are available for dispatch.
3. **Price Revision Workflow**:
   - Query `/api/v1/pricing/search` or `/api/v1/item-domain/products`.
   - If no items match query, render clean empty grid stating "No matching products found".
4. **POS Reconciliation & Loyalty**:
   - Connect loyalty lookup to live `/api/v1/crm/customers/search`.
   - Handle reconciliation queue errors with an alert banner and "Retry" trigger.
5. **Visual Reports Engine**:
   - Compute `on_hand_stock` from `SELECT SUM(quantity) FROM stock_movements WHERE company_id = :cid`.
   - Compute `reserved_stock` from `sales_order_reservations`.
   - Calculate available stock as `on_hand - reserved`.
   - Dynamically aggregate Category Stock Positions and Top SKUs by Reserved Qty.
   - Bind company selection and date filter ranges dynamically.
6. **Smart Replenishment & Vendor Scorecard**:
   - Fetch real catalog stock via `/api/v1/inventory`.
   - Show truthful empty states when 0 low-stock items or 0 suppliers exist.

## 8. Files Created
- `docs/implementation/foundation/GLOBAL_ACTUAL_DATA_ENFORCEMENT_v1.0.0.md` (This document)
- `docs/walkthrough/foundation/Global_Actual_Data_Enforcement_v1.0.0.md` (Formal walkthrough)

## 9. Files Modified
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

## 10. Dependencies
- FastAPI + PostgreSQL backend runtime (`backend/app/`).
- React 18 + TypeScript frontend runtime.
- SQLAlchemy 2.0 async engine.
- Existing core tables: `stock_movements`, `sales_orders`, `sales_order_reservations`, `packing_slips`, `dispatches`, `sales_invoices`, `products`, `companies`, `parties`.

## 11. Risks
| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| Disconnected backend displays empty screens | Medium | Low | Added clean error banners with explicit retry buttons and truthful empty state explanations |
| Database performance on large stock aggregations | Low | Medium | Scoped queries by `company_id` with existing indexes on `stock_movements (company_id, product_id)` |
| Breakage of test suites relying on mock behavior | Medium | High | Verified and executed all test suites; legitimate test fixtures in `tests/` remain untouched |

## 12. Rollback Strategy
All changes are strictly version-controlled under Git branch `smritiNX`. In the unlikely event of an operational regression, a single git revert on the target commit will cleanly restore the previous files without database schema drift, as no migrations were introduced.

## 13. Verification Plan
1. **Visual Reports Query Parity**: Execute live Python verification script against PostgreSQL database `smritisys` verifying company `COMP-001` metrics (23,064 pairs on-hand stock, 0 reserved, 23,064 available).
2. **TypeScript Compilation**: Run `npx tsc --noEmit` to verify zero type mismatches or missing properties across frontend code.
3. **Architecture Guard**: Run `npm run architecture:check` to confirm zero P0/P1 architecture duplication violations.
4. **Registry Validator**: Run `npm run validate-registry` to confirm form component compliance.
5. **Launchpad Validator**: Run `npm run validate-launchpad` to verify tile definitions and app render cases.
6. **Production Bundle Build**: Run `npm run build` to confirm Vite production bundle builds without errors.

## 14. Test Plan
- Unit tests:
  - `vitest run src/tests/visualReportsDashboard.test.ts`
  - `vitest run src/tests/p0BillingRemediationAndUx.test.ts src/tests/procurementVisualReports.test.ts src/tests/printLabelsStudio.test.ts`
  - `python -m pytest backend/tests/test_procurement_visual_reports.py`
- End-to-end and manual verification of empty states, loading indicators, and live searches across affected dialogs and tabs.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with entry for `GLOBAL_ACTUAL_DATA_ENFORCEMENT_v1.0.0.md`.
- Update `docs/walkthrough/README.md` with entry for `Global_Actual_Data_Enforcement_v1.0.0.md`.
- Update `CHANGELOG.md` with version `[6.98.0] - 2026-10-17`.
- Update `RELEASE_NOTES.md` with Release v6.98.0 details.

## 16. Deployment Plan
1. Commit all modified files and governance documentation to branch `smritiNX`.
2. Push to upstream origin repository.
3. Pull into testing environment `F:\Smriti9\apps\smriti_retail_os` per Environment Rule.
4. Run regression test suite and verify live PostgreSQL connections.

## 17. Status
**Completed** (Verified with automated test execution, live database queries, and production build).

## 18. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Canonical Backend System of Record.
- `ADR-004`: Zero Silent Mock Data Fallback Policy.
- `ADR-012`: Statutory Gateway Audit & Strict Error Propagation.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Global_Actual_Data_Enforcement_v1.0.0.md`
- `docs/walkthrough/reports/Reports_Visual_Reports_Dashboard_v1.0.0.md`
- `docs/walkthrough/billing/Billing_Studio_Preloaded_SKU_Root_Cause_Fix_v1.0.0.md`
