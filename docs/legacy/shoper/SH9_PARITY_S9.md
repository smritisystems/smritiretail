<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sprint 9 — Sales Reports, Finance Extensions & CRM Parity Gap Registry
## Shoper9 MnuNo 100/410/460/612/613/650 → SMRITI Gap Analysis

**Date:** 2026-08-24  
**Source:** Live `smriti_legacy_menu_map` + code inspection  
**Total entries analysed:** 40 rows (SALES + FINANCE + CRM + ADMIN modules)

**Files Inspected:**
- `backend/app/api/v1/reports.py` (17 endpoints — 5 from Sprint 8a + 12 pre-existing)
- `backend/app/api/v1/sales.py` (556 lines, 27 functions — billing/order/return)
- `backend/app/api/v1/crm.py` (201 lines, 8 functions — CRUD only)
- `backend/app/api/v1/finance.py` (411 lines, 5 endpoints — Sprint 8b)
- No staff management API file exists

---

## MnuNo 100 — Sales Workspace (9 entries)

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 100/101 | Billing | SR130000 | MAPPED | `create_sales_invoice_contract` | ✅ VERIFIED |
| 100/104 | Sales Advice Slips | SR115500 | MERGED | `create_sales_quotation` | ✅ VERIFIED |
| 100/105 | Service Order | SR115500 | MERGED | `create_sales_order` | ✅ VERIFIED |
| 100/106 | Sales Order | SR115500 | MAPPED | `create_sales_order` | ✅ VERIFIED |
| 100/107 | Sales Order Conversion | SR131400 | MAPPED | `convert_quotation_to_invoice` | ✅ VERIFIED |
| 100/108 | Walk-in Entry | SR120100 | MAPPED | `crm.py` — no walk-in register endpoint | ⚠️ GAP |
| 100/109 | Change Payment Mode | SR323300 | MAPPED | `sales.py` update invoice | ✅ VERIFIED |
| 100/110 | Pending Order Closure | SE101100 | MAPPED | `sales.py` cancel/update sales order | ✅ VERIFIED |
| 100/111 | Excise Invoice | SR440100 | DEPRECATED | Pre-GST — not applicable | ✅ N/A |

**MnuNo 100 Score: 7 VERIFIED / 1 GAP / 1 N/A**

---

## MnuNo 410 — Sales Reports (13 entries)

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 410/411 | Daily Sales Book | SR213600 | MAPPED | `/reports/daily-sales` (pre-existing) | ✅ VERIFIED |
| 410/412 | Bill-wise Sales | SR202400 | MAPPED | `/reports/bill-wise-sales` (Sprint 8a) | ✅ VERIFIED |
| 410/413 | Item-wise Sales | SR202200 | MAPPED | `/reports/item-wise-sales` (Sprint 8a) | ✅ VERIFIED |
| 410/414 | Tax Register | SR202300 | MAPPED | `/reports/tax-register` (Sprint 8a) | ✅ VERIFIED |
| 410/415 | Bill-wise Items | SR202000 | MAPPED | No bill-wise items endpoint | ⚠️ GAP |
| 410/416 | Discount Given | SR202100 | MAPPED | `/reports/salesperson-discount` (Sprint 8a partial) | ✅ VERIFIED (partial) |
| 410/418 | Top Selling Items | SR209600 | MAPPED | No top-selling-items endpoint | ⚠️ GAP |
| 410/419 | Salesperson Sales | SR210000 | MAPPED | No salesperson-sales detail endpoint | ⚠️ GAP |
| 410/420 | Cancelled Bills | SR210100 | MAPPED | `/reports/cancelled-bills` (Sprint 8a) | ✅ VERIFIED |
| 410/421 | Returned Bills | SR210200 | MAPPED | `list_sales_returns` in sales.py — no report | ⚠️ GAP |
| 410/422 | Attribute+Size wise | SR236300 | MAPPED | No attribute/size sales report | ⚠️ GAP |
| 410/423 | Day-wise Sales Summary | SR209500 | MAPPED | No day-wise summary endpoint | ⚠️ GAP |
| 410/425 | Item-wise Sales Returns | SR214100 | MAPPED | No item-wise returns report | ⚠️ GAP |
| 410/426 | Salesperson Summary | SR221600 | MAPPED | No salesperson summary endpoint | ⚠️ GAP |
| 410/427 | Node-wise Details | SR231900 | MAPPED | No node/branch-wise sales detail | ⚠️ GAP |

**MnuNo 410 Score: 6 VERIFIED / 9 GAP**

---

## MnuNo 460 — Business Ledger / Finance Extensions (11 entries)

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 460/461 | Cash Transaction | SR203100 | MAPPED | `/finance/cash-transactions` (Sprint 8b) | ✅ VERIFIED |
| 460/462 | Submission/Realisation List | SR203300 | MAPPED | No submission list endpoint | ⚠️ GAP |
| 460/463 | Pending Submissions | SR203200 | MAPPED | No pending submissions endpoint | ⚠️ GAP |
| 460/464 | Counter-wise Details | SR210600 | MAPPED | `/finance/counter-wise` (Sprint 8b) | ✅ VERIFIED |
| 460/465 | Credit Note Status | SR212700 | MAPPED | `/finance/credit-note-status` (Sprint 8b) | ✅ VERIFIED |
| 460/466 | Counter Summary | SR212900 | MAPPED | `/finance/counter-summary` (Sprint 8b) | ✅ VERIFIED |
| 460/467 | Advance Receipt Status | SR234400 | MAPPED | `/finance/advance-receipts` (Sprint 8b) | ✅ VERIFIED |
| 460/469 | Reconciliation Report | SR239600 | MAPPED | No reconciliation report endpoint | ⚠️ GAP |
| 460/470 | Till Status Report | SR239600 | MAPPED | No till status report endpoint | ⚠️ GAP |
| 460/471 | Till Activity Log | SR240400 | MAPPED | No till activity log endpoint | ⚠️ GAP |
| 460/4702 | Credit Sale | SR242900 | MAPPED | No credit sale report endpoint | ⚠️ GAP |

**MnuNo 460 Score: 5 VERIFIED / 6 GAP**

---

## MnuNo 612/613/650 — CRM & Staff (7 entries)

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 612/6121 | Personnel Catalogue | SR442900 | MAPPED | No staff/personnel API file exists | ⚠️ GAP |
| 612/6124 | Incentive Definition | SR443900 | MAPPED | No incentive API | ⚠️ GAP |
| 613/6132 | Customer Catalogue | SR442300 | MAPPED | `list_customers` (basic) — no catalogue | ✅ VERIFIED (partial) |
| 613/6133 | Customer Mailer | SR430900 | MAPPED | No customer mailer endpoint | ⚠️ GAP |
| 613/6134 | Print Address Labels | SR323600 | MERGED | Frontend print action — no API needed | ✅ N/A |
| 650/658 | Customers Report | SR242500 | MAPPED | `list_customers` — basic list exists | ✅ VERIFIED (partial) |
| 500/581 | Activity Log | SR435600 | MAPPED | `security.py` audit log | ✅ VERIFIED |

**MnuNo 612/613/650 Score: 4 VERIFIED / 3 GAP / 1 N/A**

---

## Sprint 9 Summary Scorecard

| Group | Total | ✅ VERIFIED | ⚠️ GAP | N/A |
|---|---|---|---|---|
| MnuNo 100 — Sales Workspace | 9 | 7 | 1 | 1 |
| MnuNo 410 — Sales Reports | 15 | 6 | 9 | 0 |
| MnuNo 460 — Finance Extensions | 11 | 5 | 6 | 0 |
| MnuNo 612/613/650 — CRM & Staff | 7 | 4 | 3 | 1 |
| **TOTAL** | **42** | **22** | **19** | **2** |

---

## P1 Endpoints Implemented (Sprint 9)

### sales_reports.py [NEW] — 6 endpoints
| Gap | EXE | Endpoint |
|---|---|---|
| Top Selling Items | SR209600 | `GET /api/v1/sales-reports/top-selling` |
| Day-wise Sales Summary | SR209500 | `GET /api/v1/sales-reports/day-wise` |
| Salesperson Sales | SR210000 | `GET /api/v1/sales-reports/salesperson-sales` |
| Salesperson Summary | SR221600 | `GET /api/v1/sales-reports/salesperson-summary` |
| Returned Bills | SR210200 | `GET /api/v1/sales-reports/returned-bills` |
| Node-wise Details | SR231900 | `GET /api/v1/sales-reports/node-wise` |

### finance.py extended — 4 new endpoints (Sprint 9 additions)
| Gap | EXE | Endpoint |
|---|---|---|
| Reconciliation Report | SR239600 | `GET /api/v1/finance/reconciliation` |
| Till Status Report | SR239600 | `GET /api/v1/finance/till-status` |
| Till Activity Log | SR240400 | `GET /api/v1/finance/till-activity` |
| Credit Sale Report | SR242900 | `GET /api/v1/finance/credit-sale` |

## P2 Gaps (Future Sprint)
Personnel catalogue, incentive definition, customer mailer, bill-wise items, attribute/size-wise sales, item-wise returns — deferred to Sprint 10.
