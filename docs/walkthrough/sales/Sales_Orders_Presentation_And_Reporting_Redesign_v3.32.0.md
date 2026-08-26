<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Sales Orders Presentation & Reporting Redesign v3.32.0

## 1. Purpose
To deliver a clean, business-first presentation across the Sales Orders ledger, Order Detail side pane, and BI Reporting Studios in SMRITI Retail OS, eliminating technical clutter while preserving 100% of the underlying PostgreSQL transactional records and PO reconciliation data.

## 2. Scope
- Sales Orders list table presentation overhaul.
- Sales Order detail side drawer restructuring with customer/PO cards, financial summaries, item lines, related tax invoices, and expandable Technical Details.
- Executive KPI card label refinement and INR 2-decimal currency formatting.
- Addition of 7 explicit, business-friendly Sales Order report studios in the backend metadata and UI report catalog.
- Enhanced empty-state messaging displaying context-aware dates instead of raw zeros.

## 3. Files Created
- `src/utils/normalizeSales.ts`
- `src/tests/salesAuditAndFormatters.test.ts`
- `backend/tests/test_sales_orders_api.py`
- `docs/user_guide/SALES_ORDER_QUOTATION_HELP.md`
- `docs/walkthrough/sales/Sales_Orders_Presentation_And_Reporting_Redesign_v3.32.0.md`

## 4. Files Modified
- `backend/app/schemas/sales.py`
- `backend/app/services/sales.py`
- `backend/app/api/v1/reports.py`
- `src/types.ts`
- `src/utils/formatters.ts`
- `src/components/SalesStudioTab.tsx`
- `src/components/ReportDesignerTab.tsx`
- `docs/user_guide/USER_GUIDE.md`

## 5. Architecture Decisions
1. **Separation of Business Layer vs Technical Metadata**: High-level business users see clear commercial fields (Order No, PO Number, Customer, Date, Items/Qty, Order Value, Billed Value, Pending Value, Status). Internal IDs (`id`, `company_id`, `branch_id`, `source_quotation_id`), raw `po_metadata`, and system audit timestamps are safely placed inside an expandable "Technical Details" accordion.
2. **Dual-Case Normalization & Schema Resilience**: Python Pydantic schemas and TypeScript client utilities implement bidirectional case translation, ensuring robust serialization across REST boundaries.
3. **Safe Numeric Guarding**: All currency arithmetic routes through `safeNumber()` and `safeDivision()` with finite number fallbacks, preventing `NaN`, `Infinity`, and undefined formatting errors.

## 6. Design Rationale
Eliminating raw database UUIDs and developer terms from primary operational tables reduces friction for sales operators, billing clerks, and store managers while keeping comprehensive audit traces accessible on demand.

## 7. Implementation Summary
- Refactored `SalesStudioTab.tsx` Sales Orders table with 10 structured columns.
- Re-architected Order Detail side pane with Customer & PO information cards, financial breakdown, scrollable item rows, invoice allocation records, and expandable audit details.
- Updated KPI summary cards: `TOTAL BOOKED REVENUE` → `TOTAL SALES ORDER VALUE`, `0 converted from Quotations` → `Converted Orders`, `Confirmed Bookings` → `Sales Orders`.
- Registered 7 dedicated Sales Order reports in `SMRITI_STUDIOS["sales_studio"]`.
- Added friendly dynamic empty report banner: `No invoices found for 26 Aug 2026`.

## 8. Tests Executed
- `vitest`: 43 test suites, 338 tests passed.
- `pytest`: 6 backend test modules, 25 tests passed.
- `tsc --noEmit`: 0 TypeScript compiler errors.
- `vite build`: Production build completed successfully in 28.99s.

## 9. Verification Results
- Status: **Done** — fully verified against local PostgreSQL database (`smriti001`) and frontend build artifacts.

## 10. Known Limitations
- Historical PO invoice allocation matching is currently read-only for Phase 1. Interactive manual invoice re-allocation will be enabled in Phase 2.

## 11. Future Work
- Real-time stock reserve allocations during delivery dispatch protocols.
- Automated E-Way Bill generation directly from Sales Order allocations.

## 12. Related ADRs
- `ADR-0042`: FastAPI PostgreSQL Canonical System of Record.
- `ADR-0056`: Unified Accounting Ledger & Dual-Case Normalization.

## 13. Related RFCs
- `RFC-2026-08-01`: Historical PO Ingestion & Reliance Retail Invoice Reconciliation.
