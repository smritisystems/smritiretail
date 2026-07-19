<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.14.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Reports — Reports Module — Walkthrough v3.14.0

**Date:** 2026-07-11  
**Status:** Done

---

## 1. Purpose

Implement a suite of read-only business reports to support operational audit, inventory evaluation, daily sales tracking, and supplier ledger reconciliation.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Stock Valuation (cost price × current stock per product) | Interactive charts and graphs |
| Daily Sales Summary (aggregated sales by mode + shift breakdown) | Exporting reports to Excel/PDF |
| Supplier Ledger (chronological purchases and payments with running balance) | Tax reports (GST filings) |
| Purchase Summary (totals ordered, received, and outstanding per supplier) | - |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/schemas/reports.py` | Reporting API input/output serialization Pydantic schemas |
| `backend/app/services/reports.py` | Query logic and in-memory aggregation of report statistics |
| `backend/app/api/v1/reports.py` | API endpoints router under `/api/v1/reports` |
| `backend/app/tests/test_reports.py` | 7 automated report validation tests |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/main.py` | Registered `/reports` router and updated VERSION |
| `backend/app/core/config.py` | Bumped VERSION to `3.14.0` |

---

## 5. Architecture Decisions

### A. Read-only service design
Reports do not modify state. They execute direct read-only queries.

### B. Use of standard `created_at` for purchase chronology
As `PurchaseOrder` and `PurchaseReceipt` models lack explicit date columns, `created_at` is utilized as the date reference for chronological tracking and optional filtering.

---

## 6. Design Rationale

- Kept calculations inside python service layer to allow clean unit testing without depending on complex DB-side store procedures.
- Handled tenant isolation filtering for all reporting queries.

---

## 7. Implementation Summary

### API Surface

```
GET    /api/v1/reports/stock-valuation     → 200 StockValuationReport
GET    /api/v1/reports/daily-sales         → 200 DailySalesSummary
GET    /api/v1/reports/supplier-ledger/{id} → 200 SupplierLedger
GET    /api/v1/reports/purchase-summary    → 200 List[PurchaseSummaryLine]
```

---

## 8. Tests Executed

**Command:**
```
python -m pytest app/tests/test_reports.py -v
```

**Output:**
```
app/tests/test_reports.py::test_stock_valuation_report PASSED
app/tests/test_reports.py::test_stock_valuation_empty_tenant PASSED
app/tests/test_reports.py::test_daily_sales_report_by_mode PASSED
app/tests/test_reports.py::test_daily_sales_report_different_date_excluded PASSED
app/tests/test_reports.py::test_supplier_ledger_purchase_and_payment PASSED
app/tests/test_reports.py::test_supplier_ledger_not_found PASSED
app/tests/test_reports.py::test_purchase_summary PASSED
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| Stock Valuation aggregates correctly | Done |
| Daily Sales filters and groups correctly | Done |
| Supplier Ledger calculates running balance | Done |
| Tenant isolation respected | Done |
| All 7 tests passed | Done |

---

## 10. Known Limitations

- No DB indexing optimization done for large-scale data queries.

---

## 11. Future Work

- Pagination for supplier ledger entries.
- Excel/CSV download capability.

---

## 12. Related ADRs

None.

---

## 13. Related RFCs

None.
