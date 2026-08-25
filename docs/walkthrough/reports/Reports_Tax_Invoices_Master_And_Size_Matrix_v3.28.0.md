<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.28.0
  * Created    : 2026-08-25
  * Modified   : 2026-08-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Statutory GST Tax Invoices Master Register & Size Matrix Reports (v3.28.0)

## 1. Purpose
To integrate statutory GST Tax Invoice master registers, cross-tabulated footwear variant size curves (Sizes 36–42), store-wise SIS distribution metrics, and multi-sheet streaming Excel exports as standard, first-class built-in reports in SMRITI Retail OS (`RPT-TAX-006`, `RPT-MRC-005`, `RPT-OPS-006`).

## 2. Scope
- **Statutory Audit Master Register (`RPT-TAX-006`)**: All 120 tax invoices (Bills 18 to 137, including active and cancelled), with 31 GST columns (Supplier & Buyer GSTINs, Place of Supply, Reverse Charge, PO/E-Way references, billing/shipping addresses, round-offs, and Amount in Words).
- **Article, Color & Size Matrix (`RPT-MRC-005`)**: Cross-tabulated size distribution across sizes 36, 37, 38, 39, 40, 41, and 42 for every Article + Color footwear style, with unit counts, taxable value, IGST 5%, and gross sales.
- **Store-Wise SIS Tax Register (`RPT-OPS-006`)**: Store-level breakdown across all 61 SIS store locations with total invoices, completed vs cancelled counts, pairs sold, and revenue.
- **Direct Excel Streaming Export (`/api/v1/reports/export/tax-invoices-excel`)**: Live generated 6-sheet `.xlsx` workbook formatted with professional openpyxl corporate styles.
- **Frontend Studio Integration (`src/components/ReportDesignerTab.tsx`)**: Prebuilt responsive report viewers with KPI summary cards, tabular data, and 1-click Excel download buttons.

## 3. Files Created
1. `docs/walkthrough/reports/Reports_Tax_Invoices_Master_And_Size_Matrix_v3.28.0.md`
2. `scratch/generate_full_tax_invoices_excel.py` (offline verification generator)

## 4. Files Modified
1. `backend/app/schemas/reports.py`: Added Pydantic schemas for `TaxInvoiceMasterRegisterReport`, `ArticleColorSizeMatrixReport`, and `StoreWiseSummaryReport`.
2. `backend/app/services/reports.py`: Implemented reporting services, variant parsing, number-to-words engine, and dynamic OpenPyXL streaming workbook builder.
3. `backend/app/api/v1/reports.py`: Registered `RPT-TAX-006`, `RPT-MRC-005`, `RPT-OPS-006` in `SMRITI_STUDIOS` and added REST endpoints.
4. `src/components/ReportDesignerTab.tsx`: Added frontend fetch handlers and dedicated UI viewers with Fiori-compliant styling.
5. `backend/app/tests/test_reports.py`: Added comprehensive unit test coverage for all standard reports and streaming Excel endpoints.
6. `docs/walkthrough/README.md`: Appended new walkthrough entry to the master index.

## 5. Architecture Decisions
- **FastAPI + PostgreSQL Sole Backend**: Reports query transactional tables (`sales_invoices`, `sales_invoice_items`, `customers`, `companies`, `branches`) directly in PostgreSQL.
- **Memory-Efficient Dynamic Excel Generation**: The Excel export compiles all 6 sheets directly into an in-memory `io.BytesIO` buffer via `openpyxl`, returning binary streaming HTTP responses without writing temporary files to the disk.
- **Strict Size Binning**: Footwear size attributes are parsed directly from SKU codes (`<Article>-<Color>-<Size>`) and mapped deterministically into sizes 36 through 42.

## 6. Design Rationale
- Providing statutory GST compliance out-of-the-box eliminates manual ledger assembly during audits.
- Footwear retail operations depend heavily on size curve analysis; the matrix view gives instantaneous visibility into which sizes drive revenue and inventory depletion.

## 7. Implementation Summary
- **Backend Service Engine**: Added `tax_invoices_master_register`, `article_color_size_matrix`, `store_wise_summary`, and `export_tax_invoices_master_excel` in `ReportsService`.
- **API Endpoints**: Exposed `/tax-invoices-master-register`, `/article-color-size-matrix`, `/store-wise-summary`, and `/export/tax-invoices-excel` in `backend/app/api/v1/reports.py`.
- **Frontend Studio**: Enhanced `ReportDesignerTab.tsx` with customized viewers, KPI cards, and instant export action.

## 8. Tests Executed
```bash
pytest backend/app/tests/test_reports.py -v
```

## 9. Verification Results
```
backend\app\tests\test_reports.py::test_stock_valuation_report PASSED    [  8%]
backend\app\tests\test_reports.py::test_stock_valuation_empty_tenant PASSED [ 16%]
backend\app\tests\test_reports.py::test_daily_sales_report_by_mode PASSED [ 25%]
backend\app\tests\test_reports.py::test_daily_sales_report_different_date_excluded PASSED [ 33%]
backend\app\tests\test_reports.py::test_supplier_ledger_purchase_and_payment PASSED [ 41%]
backend\app\tests\test_reports.py::test_supplier_ledger_not_found PASSED [ 50%]
backend\app\tests\test_reports.py::test_purchase_summary PASSED          [ 58%]
backend\app\tests\test_reports.py::test_studios_catalog_has_statutory_reports PASSED [ 66%]
backend\app\tests\test_reports.py::test_tax_invoices_master_register_report PASSED [ 75%]
backend\app\tests\test_reports.py::test_article_color_size_matrix_report PASSED [ 83%]
backend\app\tests\test_reports.py::test_store_wise_summary_report PASSED [ 91%]
backend\app\tests\test_reports.py::test_export_tax_invoices_excel PASSED [100%]
====================== 12 passed, 72 warnings in 15.24s =======================
```

## 10. Known Limitations
- SMRITI auto-detects footwear size binning for sizes 36–42. Non-standard or apparel-specific sizes (S, M, L, XL) fall back to generic attribute reports.

## 11. Future Work
- Add automated scheduled emailing of the statutory tax register directly to accounting and auditor emails at month-end.

## 12. Related ADRs
- `ADR-008`: Single Backend Architecture (FastAPI + Postgres).
- `ADR-019`: Reports Studio Standardization & Multi-Dimensional Pivot Engine.

## 13. Related RFCs
- `RFC-2026-08-GST`: Statutory Goods and Services Tax Compliance Reporting.
