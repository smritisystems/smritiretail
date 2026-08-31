---
title: "Sprint 23: Reports Portal Gap Closure (Shoper9 Sales & Audit Report Parity)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 23 — Reports Portal Gap Closure (Shoper9 Sales & Audit Parity)

## 1. Purpose
This sprint eliminates the functional and structural gaps between legacy Shoper9 POS/Back-Office Sales & Audit reporting suites (`MnuNo 410` and `MnuNo 470`) and SMRITI Retail OS. It completes end-to-end parity across FastAPI backend services, REST endpoints, Pydantic response models, database query engines, and the React 18 Report Designer interactive UI.

## 2. Scope
- **Backend Response Schemas**: Pydantic models for all missing Shoper9 sales/audit reports in `backend/app/schemas/reports.py`.
- **Backend Service Implementation**: Async query routines joining `SalesInvoice`, `SalesInvoiceItem`, `SalesReturn`, `SalesReturnItem`, and `Product` with tenant isolation and date constraints in `backend/app/services/reports.py`.
- **REST Endpoints**: FastAPI endpoints mounted under `/api/v1/reports/` with security validation and OpenAPI documentation.
- **Database Migrations**: Alembic convergence across `smriti001`, `smriti002`, and `smritisys` executing `v1371` through `v1375_backfill_sales_return_cust`.
- **Frontend Report Designer (`src/components/ReportDesignerTab.tsx`)**: High-contrast, responsive React data tables with KPI summary banners, real-time fetching, and multi-format (`XLSX`, `CSV`, `TXT`, `PDF`) exports.
- **Automated Verification**: End-to-end integration test suite `backend/tests/t_reports_parity.py` testing all 9 reports.

## 3. Files Created
- [`backend/tests/t_reports_parity.py`](file:///F:/SMRITRretailNX/backend/tests/t_reports_parity.py) — 9-part test suite verifying all Shoper9 reports.
- [`scripts/migrate_tenant_dbs.py`](file:///F:/SMRITRretailNX/scripts/migrate_tenant_dbs.py) — Tenant database Alembic migration runner.
- [`docs/walkthrough/reports/Sprint23_Reports_Portal_Gap_Closure_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/reports/Sprint23_Reports_Portal_Gap_Closure_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/schemas/reports.py`](file:///F:/SMRITRretailNX/backend/app/schemas/reports.py) — Added schemas for `BillWiseItemsReport`, `DiscountSummaryReport`, `ItemWiseReturnsReport`, `AttributeSizeSalesReport`.
- [`backend/app/services/reports.py`](file:///F:/SMRITRretailNX/backend/app/services/reports.py) — Implemented `bill_wise_sales`, `item_wise_sales`, `tax_register`, `bill_wise_items`, `discount_summary`, `item_wise_returns`, and `attribute_size_sales`.
- [`backend/app/api/v1/reports.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/reports.py) — Exposed 4 new endpoints `/bill-wise-items`, `/discount-summary`, `/item-wise-returns`, `/attribute-size-sales`.
- [`backend/alembic/versions/v1375_backfill_sales_return_cust.py`](file:///F:/SMRITRretailNX/backend/alembic/versions/v1375_backfill_sales_return_cust.py) — Fixed migration identifiers.
- [`src/components/ReportDesignerTab.tsx`](file:///F:/SMRITRretailNX/src/components/ReportDesignerTab.tsx) — Wired `loadReportsData()` and rendered 9 interactive table components with KPI banners and export integration.
- [`docs/legacy/shoper/SH9_PARITY_GAPS.md`](file:///F:/SMRITRretailNX/docs/legacy/shoper/SH9_PARITY_GAPS.md) — Updated MnuNo 410 and 470 parity statuses to `VERIFIED`.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Added Sprint 23 certification entry per Rule 11.

## 5. Architecture Decisions
- **Eager Loading Optimization**: Used SQLAlchemy's `selectinload(SalesInvoice.items)` and direct `JOIN` queries to prevent greenlet/MissingGreenlet I/O exceptions in async contexts.
- **Tenant Context Isolation**: Maintained strict company database routing via `_tenant_filter` ensuring cross-tenant data leak prevention.
- **Universal Export Engine**: Integrated `genericReportData.lines` directly into `GlobalExportService` allowing seamless one-click export into Excel (`XLSX`), `CSV`, or `TXT` format.

## 6. Design Rationale
In legacy Shoper9, sales reports were fragmented across independent compiled executables (`SR202000.EXE`, `SR202100.EXE`, `SR202200.EXE`, `SR202300.EXE`, `SR202400.EXE`, `SR210200.EXE`, `SR214100.EXE`, `SR236300.EXE`, `SR238400.EXE`). SMRITI consolidates these disparate utilities into a unified, responsive BI Report Studio while preserving exact calculation formulas (tax rates, discounts, returns, attribute matrices).

## 7. Implementation Summary
- **RPT-TAX-001 (SR202300)**: Tax Register with breakdown of Taxable, CGST, SGST, IGST, and Total Tax.
- **RPT-TAX-002 (SR202400)**: Bill-wise Sales Register detailing gross sales, concessions, net revenue, and items count.
- **RPT-TAX-003 (SR202200)**: Item-wise Sales breakdown aggregated across products with HSN and quantity totals.
- **RPT-TAX-004 (SR210200)**: Cancelled Bills Audit log tracking voided transactions, reasons, and operators.
- **RPT-TAX-005 (SR202000)**: Bill-wise Items Detail with line-by-line item rate, quantity, discount, GST %, and line net.
- **RPT-MIS-005 (SR238400)**: Salesperson-wise Discount breakdown tracking individual salesperson discount concessions.
- **RPT-OPS-001 (SR202100)**: Discount Given Summary with overall concession percentage across all discounted invoices.
- **RPT-MRC-003 (SR214100)**: Item-wise Sales Returns register linked to original invoices and refund amounts.
- **RPT-MRC-001 (SR236300)**: Attribute+Size wise sales matrix grouping transactions by Category, Brand, Color, and Size.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/t_reports_parity.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 9 items

tests/t_reports_parity.py::test_tax_register_report_endpoint PASSED      [ 11%]
tests/t_reports_parity.py::test_bill_wise_sales_report_endpoint PASSED   [ 22%]
tests/t_reports_parity.py::test_item_wise_sales_report_endpoint PASSED   [ 33%]
tests/t_reports_parity.py::test_cancelled_bills_report_endpoint PASSED   [ 44%]
tests/t_reports_parity.py::test_bill_wise_items_report_endpoint PASSED   [ 55%]
tests/t_reports_parity.py::test_salesperson_discount_report_endpoint PASSED [ 66%]
tests/t_reports_parity.py::test_discount_summary_report_endpoint PASSED  [ 77%]
tests/t_reports_parity.py::test_item_wise_returns_report_endpoint PASSED [ 88%]
tests/t_reports_parity.py::test_attribute_size_sales_report_endpoint PASSED [100%]

======================= 9 passed, 8 warnings in 11.66s ========================
```

## 10. Known Limitations
- Multi-branch consolidation (`SR231900 Node-wise Details`) requires active multi-branch replication sync daemon configuration.

## 11. Future Work
- Sprint 24: Customer Offtake (`MnuNo 490`) and MIS Analytics (`MnuNo 470`) remaining gaps.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-POS-002`: Financial Transaction Forward-Only Integrity

## 13. Related RFCs
- `RFC-RPT-001`: Unified Business Intelligence & Flexi Report Studio Architecture
