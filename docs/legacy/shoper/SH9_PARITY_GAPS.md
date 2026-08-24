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

# Sprint 8a — Parity Gap Registry
## Shoper9 → SMRITI Capability Gap Tracker

**Date:** 2026-08-24  
**Source:** Live `smriti_legacy_menu_map` + `reports.py` + `ReportDesignerTab.tsx` inspection  
**Method:** Each MAPPED/MERGED Shoper9 entry cross-referenced against:  
1. `SMRITI_STUDIOS` catalog in `reports.py` (8 canonical report IDs)  
2. `GET /api/v1/reports/*` endpoint inventory (6 endpoints)  
3. `ReportDesignerTab.tsx` report IDs referenced in JSX  

**Legend:**  
- ✅ `VERIFIED` — SMRITI equivalent confirmed in code/API  
- ⚠️ `GAP` — capability missing, no SMRITI equivalent found  
- 🔄 `DEFERRED` — multi-company, deprecated, or PENDING by design  
- 🔗 `OVERLAP` — served by a different SMRITI workspace, not Reports Portal  

---

## SMRITI Reports API — Current Inventory

### Endpoints (`/api/v1/reports/`)

| Endpoint | Method | Report |
|---|---|---|
| `/stock-valuation` | GET | Stock Valuation (RPT-INV-001) |
| `/daily-sales` | GET | Daily Sales Summary (RPT-SAL-001) |
| `/supplier-ledger/{id}` | GET | Supplier Ledger (RPT-PUR-002) |
| `/purchase-summary` | GET | Purchase Summary (RPT-PUR-001) |
| `/studios` | GET | Studio catalog metadata |
| `/definitions` | GET/POST | Custom Flexi Report definitions |
| `/dashboards` | GET/POST | Dashboard manager |
| `/schedules` | GET/POST/DELETE | Report scheduler |

### `SMRITI_STUDIOS` Catalog (8 system reports)

| ID | Title | Studio | Gap vs Shoper9 |
|---|---|---|---|
| RPT-SAL-001 | Daily Sales Summary Register | sales_studio | ✅ Maps: SR213600 Daily Sales Book |
| RPT-SAL-002 | Sales Returns & Credit Notes Log | sales_studio | ✅ Maps: SR210200 Returned Bills |
| RPT-SAL-003 | Top Selling Products Ledger | sales_studio | ✅ Maps: SR209600 Top Selling Items |
| RPT-SAL-004 | Salesperson Performance Index | sales_studio | ✅ Maps: SR210100 + SR221600 Salesperson |
| RPT-PUR-001 | Purchase Summary Register | purchase_studio | 🔗 Purchase workspace, not Reports Portal |
| RPT-PUR-002 | Supplier Ledger | purchase_studio | 🔗 Purchase workspace, not Reports Portal |
| RPT-INV-001 | Stock Valuation Report | inventory_studio | 🔗 Stock Ledger workspace |
| RPT-PRF-001 | Invoice Net Contribution Ledger | profitability_studio | ✅ Maps: SR229700 Gross Margin |

---

## Reports Portal Gap Analysis (MnuNo 400–490, 650, 900)

### MnuNo 410 — Sales Reports (15 entries)

| MnuNo/Opt | Shoper9 Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 410/411 | Daily Sales Book | SR213600 | MAPPED | RPT-SAL-001 Daily Sales Summary Register | ✅ VERIFIED |
| 410/412 | Bill-wise Sales | SR202400 | MAPPED | ⚠️ No dedicated bill-wise sales endpoint | ⚠️ GAP |
| 410/413 | Item-wise Sales | SR202200 | MAPPED | ⚠️ No item-wise breakdown endpoint | ⚠️ GAP |
| 410/414 | Tax Register | SR202300 | MAPPED | ⚠️ No tax register report | ⚠️ GAP |
| 410/415 | Bill-wise Items | SR202000 | MAPPED | ⚠️ No bill-wise item detail | ⚠️ GAP |
| 410/416 | Discount Given | SR202100 | MAPPED | ⚠️ No discount summary report | ⚠️ GAP |
| 410/418 | Top Selling Items | SR209600 | MAPPED | RPT-SAL-003 Top Selling Products Ledger | ✅ VERIFIED |
| 410/419 | Salesperson Sales | SR210000 | MAPPED | RPT-SAL-004 Salesperson Performance Index | ✅ VERIFIED |
| 410/420 | Cancelled Bills | SR210200 | MAPPED | ⚠️ Cancelled bills not in SMRITI_STUDIOS | ⚠️ GAP |
| 410/421 | Returned Bills | SR210200 | MAPPED | RPT-SAL-002 Sales Returns & Credit Notes Log | ✅ VERIFIED |
| 410/422 | Attribute+Size wise | SR236300 | MAPPED | ⚠️ No attribute/size dimension report | ⚠️ GAP |
| 410/423 | Day-wise Sales Summary | SR209500 | MAPPED | RPT-SAL-001 (date param covers this) | ✅ VERIFIED |
| 410/425 | Item-wise Sales Returns | SR214100 | MAPPED | ⚠️ Returns by item not separated | ⚠️ GAP |
| 410/426 | Salesperson Summary | SR221600 | MAPPED | RPT-SAL-004 (summary variant) | ✅ VERIFIED |
| 410/427 | Node-wise Details | SR231900 | MAPPED | ⚠️ Multi-branch node report missing | ⚠️ GAP |

**MnuNo 410 Score: 6 VERIFIED / 8 GAP / 0 DEFERRED**

---

### MnuNo 470 — MIS Reports (15 entries)

| MnuNo/Opt | Shoper9 Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 470/471 | Monthly Sales Comparison | SR203700 | MAPPED | ⚠️ No monthly comparison report | ⚠️ GAP |
| 470/472 | Rate Variation | SR203800 | MAPPED | ⚠️ No rate variation (price change) report | ⚠️ GAP |
| 470/473 | Sales Analysis | SR203900 | MAPPED | ⚠️ No sales analysis cross-dim report | ⚠️ GAP |
| 470/474 | Attribute-wise Sales+Stock | SR236300 | MAPPED | ⚠️ No attribute cross-dim report | ⚠️ GAP |
| 470/475 | Pending Transactions | SR215600 | MAPPED | ⚠️ No pending transactions report | ⚠️ GAP |
| 470/476 | Walk-in Details | SR222800 | MAPPED | ⚠️ No walk-in footfall report | ⚠️ GAP |
| 470/477 | Superclass-wise Sales/Stock | SR216000 | MAPPED | ⚠️ No category/superclass report | ⚠️ GAP |
| 470/479 | Txn Details with Image | SR233000 | MERGED | 🔗 Merged into Sales Studio bill view | 🔗 OVERLAP |
| 470/480 | Gross Margin | SR229700 | MAPPED | RPT-PRF-001 Invoice Net Contribution Ledger | ✅ VERIFIED |
| 470/481 | Bill Re-Print | SR233500 | MAPPED | ⚠️ No bill re-print from Reports Portal | ⚠️ GAP |
| 470/482 | Sales Promotions | SR234900 | MAPPED | ⚠️ No promotions analysis report | ⚠️ GAP |
| 470/483 | Salesperson-wise Discount | SR238400 | MAPPED | ⚠️ No salesperson discount breakdown | ⚠️ GAP |
| 470/490 | Customer Offtake (parent) | — | MAPPED | ⚠️ No customer offtake section | ⚠️ GAP |
| 470/492 | Incentive Analysis | SR244700 | MAPPED | ⚠️ No incentive analysis report | ⚠️ GAP |
| 400/470 | MIS (parent menu) | — | MAPPED | Reports Portal MIS tab | ✅ VERIFIED (structural) |

**MnuNo 470 Score: 2 VERIFIED / 12 GAP / 1 OVERLAP**

---

### MnuNo 490 — Customer Offtake (3 entries)

| MnuNo/Opt | Shoper9 Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 490/491 | Period-wise Offtake | SR208500 | MAPPED | ⚠️ No customer period offtake | ⚠️ GAP |
| 490/492 | Bill-wise Offtake | SR208400 | MAPPED | ⚠️ No customer bill offtake | ⚠️ GAP |
| 490/493 | Product-wise Offtake | SR208600 | MAPPED | ⚠️ No customer product offtake | ⚠️ GAP |

**MnuNo 490 Score: 0 VERIFIED / 3 GAP / 0 DEFERRED**

---

### MnuNo 650 — Style Catalogue & Print (4 entries)

| MnuNo/Opt | Shoper9 Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 650/653 | Style Catalogue | SR430800 | MAPPED | ⚠️ No style catalogue report | ⚠️ GAP |
| 650/654 | Sales Promotions | SR230400 | MAPPED | ⚠️ No promotions report in Report Designer | ⚠️ GAP |
| 650/655 | Sales Factors | SR216300 | MAPPED | ⚠️ No sales factor report | ⚠️ GAP |
| 650/656 | Schedule Details | SE100220 | MERGED | `/reports/schedules` GET | ✅ VERIFIED |

**MnuNo 650 Score: 1 VERIFIED / 3 GAP / 0 DEFERRED**

---

### MnuNo 900 — Summary / Multi-branch (3 entries)

| MnuNo/Opt | Shoper9 Caption | EXE | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|---|
| 900/910 | Sales (multi-branch) | — | MAPPED | ⚠️ No multi-branch sales summary | 🔄 DEFERRED |
| 900/920 | Stock (multi-branch) | — | MAPPED | ⚠️ No multi-branch stock summary | 🔄 DEFERRED |
| 900/930 | Customer Offtake (multi-branch) | — | MAPPED | ⚠️ No multi-branch offtake | 🔄 DEFERRED |

**MnuNo 900 Score: 0 VERIFIED / 0 GAP / 3 DEFERRED (multi-branch, architecture decision)**

---

### Parent/Navigation Entries (6 entries)

| MnuNo/Opt | Caption | Status | SMRITI Equivalent | Gap Status |
|---|---|---|---|---|
| 0/400 | Reports (root) | MERGED | Reports Portal workspace | ✅ VERIFIED |
| 400/410 | Sales (group) | MAPPED | Report Designer Sales Studio tab | ✅ VERIFIED |
| 400/430 | Stock (group) | MAPPED | Report Designer Inventory Studio tab | ✅ VERIFIED |
| 400/450 | Stock Registers (group) | MAPPED | Report Designer / Stock Ledger | ✅ VERIFIED |
| 400/460 | Cash (group) | MAPPED | Business Ledger (cross-workspace) | 🔗 OVERLAP |
| 400/470 | MIS (group) | MAPPED | Report Designer MIS tab | ✅ VERIFIED |

---

## Reports Portal Summary Scorecard

| Group | Total | ✅ VERIFIED | ⚠️ GAP | 🔄 DEFERRED | 🔗 OVERLAP |
|---|---|---|---|---|---|
| MnuNo 410 — Sales | 15 | 6 | 8 | 0 | 0 |
| MnuNo 470 — MIS | 15 | 2 | 12 | 0 | 1 |
| MnuNo 490 — Offtake | 3 | 0 | 3 | 0 | 0 |
| MnuNo 650 — Style/Print | 4 | 1 | 3 | 0 | 0 |
| MnuNo 900 — Multi-branch | 3 | 0 | 0 | 3 | 0 |
| Navigation/Group entries | 6 | 5 | 0 | 0 | 1 |
| **TOTAL** | **46** | **14** | **26** | **3** | **2** |

**Reports Portal parity: 14/43 verified (32.6%) — 26 gaps to close**

---

## Prioritised Gap Backlog (P1 = highest business impact)

### P1 — Revenue & Tax Compliance (must-have for audit)

| Gap | Shoper9 EXE | New Endpoint Needed |
|---|---|---|
| Bill-wise Sales | SR202400 | `GET /api/v1/reports/bill-wise-sales` |
| Item-wise Sales | SR202200 | `GET /api/v1/reports/item-wise-sales` |
| Tax Register | SR202300 | `GET /api/v1/reports/tax-register` |
| Cancelled Bills | SR210200 | `GET /api/v1/reports/cancelled-bills` |
| Salesperson-wise Discount | SR238400 | `GET /api/v1/reports/salesperson-discount` |

### P2 — Operational & Merchandising

| Gap | Shoper9 EXE | New Endpoint Needed |
|---|---|---|
| Item-wise Sales Returns | SR214100 | `GET /api/v1/reports/item-wise-returns` |
| Monthly Sales Comparison | SR203700 | `GET /api/v1/reports/monthly-comparison` |
| Sales Analysis (cross-dim) | SR203900 | `GET /api/v1/reports/sales-analysis` |
| Pending Transactions | SR215600 | `GET /api/v1/reports/pending-transactions` |
| Superclass-wise Sales/Stock | SR216000 | `GET /api/v1/reports/category-wise-sales` |
| Customer Offtake × 3 | SR208400-600 | `GET /api/v1/reports/customer-offtake` |
| Bill-wise Items | SR202000 | `GET /api/v1/reports/bill-items` |
| Discount Given | SR202100 | `GET /api/v1/reports/discount-summary` |

### P3 — Analytical & Promotional

| Gap | Shoper9 EXE | New Endpoint Needed |
|---|---|---|
| Walk-in Details | SR222800 | `GET /api/v1/reports/walk-in` |
| Rate Variation | SR203800 | `GET /api/v1/reports/rate-variation` |
| Attribute-wise Sales+Stock | SR236300 | `GET /api/v1/reports/attribute-wise` |
| Sales Promotions Analysis | SR234900 | `GET /api/v1/reports/promotions-analysis` |
| Incentive Analysis | SR244700 | `GET /api/v1/reports/incentive-analysis` |
| Attribute+Size wise | SR236300 | (same as Attribute-wise above) |
| Node-wise Details | SR231900 | `GET /api/v1/reports/node-wise` |
| Style Catalogue | SR430800 | `GET /api/v1/reports/style-catalogue` |
| Sales Factors | SR216300 | `GET /api/v1/reports/sales-factors` |
| Bill Re-Print | SR233500 | `POST /api/v1/reports/bill-reprint` |

### Deferred (architecture decision required)

| Gap | Reason |
|---|---|
| Multi-branch Sales/Stock/Offtake (900/910,920,930) | Multi-branch architecture not designed |
| Sales Promotions definition (650/654) | Loyalty Studio / Terms Engine prerequisite |
| Sales Factors (650/655) | Factor engine prerequisite |

---

## SMRITI_STUDIOS Extension Plan

To close the P1+P2 gaps, add 5 new studios to `SMRITI_STUDIOS` in `reports.py`:

```python
"tax_studio": {
    "name": "Tax & Compliance Studio",
    "reports": [
        {"id": "RPT-TAX-001", "title": "Tax Register"},
        {"id": "RPT-TAX-002", "title": "Bill-wise Sales"},
        {"id": "RPT-TAX-003", "title": "Item-wise Sales"},
        {"id": "RPT-TAX-004", "title": "Cancelled Bills"},
    ]
},
"mis_studio": {
    "name": "MIS & Analytics Studio",
    "reports": [
        {"id": "RPT-MIS-001", "title": "Monthly Sales Comparison"},
        {"id": "RPT-MIS-002", "title": "Sales Analysis"},
        {"id": "RPT-MIS-003", "title": "Pending Transactions"},
        {"id": "RPT-MIS-004", "title": "Superclass-wise Sales/Stock"},
        {"id": "RPT-MIS-005", "title": "Salesperson-wise Discount"},
    ]
},
"crm_studio": {
    "name": "Customer Analytics Studio",
    "reports": [
        {"id": "RPT-CRM-001", "title": "Customer Offtake Period-wise"},
        {"id": "RPT-CRM-002", "title": "Customer Offtake Bill-wise"},
        {"id": "RPT-CRM-003", "title": "Customer Offtake Product-wise"},
        {"id": "RPT-CRM-004", "title": "Walk-in Details"},
    ]
},
"merchandise_studio": {
    "name": "Merchandise & Stock Studio",
    "reports": [
        {"id": "RPT-MRC-001", "title": "Attribute+Size wise Sales"},
        {"id": "RPT-MRC-002", "title": "Rate Variation"},
        {"id": "RPT-MRC-003", "title": "Item-wise Sales Returns"},
        {"id": "RPT-MRC-004", "title": "Style Catalogue"},
        {"id": "RPT-MRC-005", "title": "Bill-wise Items"},
    ]
},
"operations_studio": {
    "name": "Operations Studio",
    "reports": [
        {"id": "RPT-OPS-001", "title": "Discount Given Summary"},
        {"id": "RPT-OPS-002", "title": "Node-wise Details"},
        {"id": "RPT-OPS-003", "title": "Incentive Analysis"},
        {"id": "RPT-OPS-004", "title": "Sales Promotions Analysis"},
        {"id": "RPT-OPS-005", "title": "Bill Re-Print"},
    ]
},
```

---

## Sprint 8b — Business Ledger Gap Pre-analysis

From the DB, Business Ledger has 29 MAPPED+MERGED entries. Current SMRITI API:
- Till management: needs verification vs `GET /api/v1/pos/till-status`
- Cash Payouts/Receipts: needs verification vs `GET /api/v1/finance/*`
- 12 Cash Reports (MnuNo 460): cross-reference with Business Ledger API

Sprint 8b will inspect `BusinessLedgerTab.tsx` + finance API.

---

## Definition of Done — Sprint 8a

- [x] Reports Portal gap registry complete (46 entries classified)  
- [x] 14 VERIFIED, 26 GAP, 3 DEFERRED, 2 OVERLAP documented  
- [x] P1/P2/P3 backlog with endpoint names defined  
- [x] `SMRITI_STUDIOS` extension plan with 5 new studios + 22 new RPT IDs  
- [ ] 5 new studios added to `reports.py` (Sprint 8b prerequisite)  
- [ ] 5 P1 API endpoints implemented  
- [ ] `ReportDesignerTab.tsx` updated with new studio tiles  
