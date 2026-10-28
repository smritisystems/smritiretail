<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail OS — Standard Daily Retail Reports & Presentation Center Refactoring

## 1. Purpose
This document details the refactoring and standardization of SMRITI Retail OS daily operational reports. It eliminates user confusion arising from technical jargon, misaligned B2B wholesale orders, and inconsistent ledger properties by introducing a prominent, 1-click **"Standard Daily Retail Reports"** dashboard featuring standard retail ERP registers (Daily Sales Register, Daily Cashier & Payment Summary, Purchase Inward Register, and Current Stock on Hand & Valuation) with itemized SKU clarity (Invoice #, Date, Customer, Article No, Barcode, Size, Qty, Rate, Discount, GST, Net Total, and Tender Mode).

---

## 2. Scope
- **Frontend Presentation Layer (`src/components/ReportDesignerTab.tsx`):**
  - Introduction of the **Standard Daily Retail Reports** hero section with 4 high-priority 1-click ERP register cards.
  - Implementation of instant 1-click date presets: `[Today]`, `[Yesterday]`, `[This Week]`, `[This Month]`, and `[FY 2026-27]`.
  - Normalization of multi-contract sales data (`lines` vs `bills` from `/reports/bill-wise-items` and `/sales-reports/bill-items-live`) into a standard line-item register schema.
  - Dedicated interactive views for:
    - **Daily Sales Register:** KPI metrics (Total Bills, Sold Qty, Discounts Given, Tax Collected, Net Sales), view toggles (`Detailed Line Items View` vs `Bill Summary View`), live in-report keyword search, and totals summary footer.
    - **Cashier & Tender Summary:** Real payment breakdown cards (`💵 CASH IN HAND`, `📱 UPI / QR ONLINE`, `💳 CARD (DEBIT / CREDIT)`, `📒 CUSTOMER CREDIT / DUE`) and shift-level reconciliation table replacing dummy mock division rows.
    - **Current Stock on Hand & Valuation:** Live inventory valuation register with category, on-hand pieces, unit cost, and total value.
- **Backend Studio Catalog Organization (`backend/app/api/v1/reports.py`):**
  - Reorganization of `sales_studio` reports to elevate retail POS registers (`RPT-SAL-001`, `RPT-TAX-005`, `RPT-TAX-002`, `RPT-TAX-003`, `RPT-SAL-007`) to the top.
  - Reclassification of wholesale indent orders (`RPT-SO-001` to `RPT-SO-009`) under `"Wholesale Orders (B2B Indents)"` with clear labels, preventing counter retail staff from navigating to warehouse dispatch indents.
- **Docker Production Deployments (`smriti-web` & `smriti-api`):**
  - Full container re-build and re-deployment on `http://localhost:8101` and `http://localhost:1981`.

---

## 3. Files Created
1. `scratch/verify_standard_retail_reports.py` — End-to-end headless Playwright browser verification suite for standard retail reports.
2. `scratch/reports_verification/01_reports_dashboard.png` — Screenshot of Standard Daily Retail Reports hero section.
3. `scratch/reports_verification/02_daily_sales_register.png` — Screenshot of Daily Sales Register detailed line items view.
4. `scratch/reports_verification/03_bill_summary_view.png` — Screenshot of Daily Sales Register bill summary view.
5. `scratch/reports_verification/04_sales_search_inv.png` — Screenshot of live in-report keyword filter.
6. `scratch/reports_verification/05_cashier_tender_summary.png` — Screenshot of Cashier & Tender Summary with real collections.
7. `scratch/reports_verification/06_stock_valuation_register.png` — Screenshot of Current Stock on Hand & Valuation register.

---

## 4. Files Modified
1. `src/components/ReportDesignerTab.tsx` — Added standard retail reports dashboard, quick date presets, multi-contract sales line normalizer, in-report filter controls, and dedicated register views.
2. `backend/app/api/v1/reports.py` — Re-ordered `sales_studio` reports catalog and re-labeled wholesale order indents.
3. `docs/walkthrough/README.md` — Master walkthrough index updated.

---

## 5. Architecture Decisions
- **AD-RPT-001: Separation of Retail Counter POS from Wholesale B2B Indents**
  Counter retail operations require immediate itemized cash register accountability (Article No, Barcode, Size, Qty, Rate, Discount, GST, Tender). Enterprise wholesale indents (`RPT-SO-*`) with fulfillment metrics and multi-truck dispatches are separated into an explicit B2B sub-group to eliminate operator ambiguity.
- **AD-RPT-002: Dual Contract Normalization Layer**
  To support legacy and current backend endpoints transparently, a client-side memoized normalizer inspects whether the payload is flat (`BillWiseItemsResponse.lines`) or nested (`LiveBillItemsResponse.bills[].lines[]`), converting both into standard `StandardSalesLine` records with deterministic property resolution (`rate`, `discount`, `line_total`, `gstRate`).
- **AD-RPT-003: Single Store Operational Default with Progressive Location Management**
  Over 90% of retail merchants operate a single physical store. Displaying branch selectors by default clutters the UI and causes operator confusion at billing and reporting counters. Single Store Mode is established as the default operational posture (`[ 📍 Main Store · Single Store ]` badge, zero empty dropdowns). Multi-outlet selectors (`All Stores Consolidated` / branch switcher) are revealed progressively only when `locations_management_enabled === true` or multiple active branches exist. All backend queries transparently bind to the active single store (`MAIN` / Branch 001) without requiring user intervention.

---

## 6. Design Rationale
Retail cashiers, store managers, and auditors require four fundamental daily questions answered in one click:
1. *What did we sell today by item, barcode, and size?* -> **Daily Sales Register**
2. *How much cash, UPI, and card money is in the drawer?* -> **Daily Cashier & Payment Summary**
3. *What stock arrived from suppliers today?* -> **Purchase Inward Register (GRN)**
4. *What is our stock on hand and valuation right now?* -> **Current Stock on Hand & Valuation**

Presenting these four registers prominently at the very top with 1-click date filters (`Today`, `Yesterday`, `This Week`, `This Month`, `FY 2026-27`) streamlines daily operational opening and closing workflows.

---

## 7. Implementation Summary
- **Standard Daily Retail Reports Hero Cards:** Added 4 responsive cards styled with standard SMRITI design tokens, Lucide icons (`Receipt`, `Coins`, `Truck`, `Boxes`), badges, and 1-click launcher actions.
- **Unified Sales Register Viewer:** Created an interactive register featuring 4 KPI cards (Total Bills, Qty Sold, Total Discount, Net Turnover), view mode switch buttons (`Detailed Line Items View` vs `Bill Summary View`), real-time text filter, and a comprehensive table with exact columns: `Invoice #`, `Date`, `Customer`, `Article / SKU`, `Item Description`, `Barcode`, `Size`, `Qty`, `Rate (₹)`, `Disc (₹)`, `GST Rate`, `Net Total (₹)`, and `Tender`.
- **Payment Tender Cards & Table:** Connected `RPT-SAL-001` to live API data displaying cash drawer, digital UPI/QR, card batches, and customer dues with live total collection reconciliation.
- **Stock Valuation Matrix:** Connected `RPT-INV-001` to `/inventory-reports/balance?zero_stock=true` with article code, item description, category, on-hand count, unit cost, and stock valuation.

---

## 8. Tests Executed
1. **TypeScript Static Compilation:**
   ```powershell
   npm.cmd run lint
   # Output: tsc --noEmit passed with 0 errors
   ```
2. **React Regression Test Suite:**
   ```powershell
   npm.cmd test -- --run src/tests/persistentGlobalNavigationContextualSubmenus.test.tsx
   # Output: 12/12 passed
   ```
3. **Backend Reporting Integration Suites:**
   ```powershell
   pytest backend/tests/test_reporting_api_endpoints.py -q
   # Output: 7/7 passed
   pytest backend/tests/t_reports_parity.py -q
   # Output: 9/9 passed
   pytest backend/tests/test_scheduled_reports_engine.py -q
   # Output: 6/6 passed
   pytest backend/tests/test_report_registry_governance.py -q
   # Output: 6/6 passed
   ```
4. **End-to-End Headless Playwright Browser Suite (`scratch/verify_standard_retail_reports.py`):**
   ```powershell
   python scratch/verify_standard_retail_reports.py
   # Output: 10/10 test gates passed (SINGLE_STORE_DEFAULT_BADGE, MULTI_STORE_DROPDOWN_HIDDEN, HERO_SECTION, 4 Core Cards, Sales Columns, Cashier Tender Cards, Stock Columns)
   ```

---

## 9. Verification Results
| Verification Item | Status | Evidence |
|---|---|---|
| Single Store Default Mode Badge | Done | `SINGLE_STORE_DEFAULT_BADGE: PASS` (badge rendered: `Main Branch · Single Store`) |
| Multi-Store Dropdown Hidden in Single Store Mode | Done | `MULTI_STORE_DROPDOWN_HIDDEN: PASS` (0 dropdown clutter) |
| Standard Daily Reports Hero Section | Done | `scratch/reports_verification/01_reports_dashboard.png` |
| 4 Core Register Cards Rendered | Done | Headless Playwright test passed all 4 card locators |
| 1-Click Date Presets | Done | Tested `Today`, `Yesterday`, `This Week`, `This Month`, `FY 2026-27` |
| Daily Sales Register Line Items View | Done | `scratch/reports_verification/02_daily_sales_register.png` |
| Daily Sales Register Bill Summary View | Done | `scratch/reports_verification/03_bill_summary_view.png` |
| Live In-Report Search Filter | Done | `scratch/reports_verification/04_sales_search_inv.png` |
| Cashier Tender Summary Cards | Done | `scratch/reports_verification/05_cashier_tender_summary.png` |
| Current Stock on Hand & Valuation | Done | `scratch/reports_verification/06_stock_valuation_register.png` |
| Container Image Re-build & Deploy | Done | `smriti-web` (healthy:8101), `smriti-api` (healthy:1981) |

---

## 10. Known Limitations
- When the date range spans multiple dates, the Daily Cashier Summary API currently aggregates across the entire requested period or defaults to the start date if `report_date` is omitted.

---

## 11. Future Work
- Add multi-branch store selection filter dropdown to the Standard Daily Retail Reports hero section.
- Add direct Excel / PDF quick export buttons inside the Daily Sales Register table header toolbar.

---

## 12. Related ADRs
- `ADR-0082`: Universal Reporting Engine & Metric Ingestion Architecture
- `ADR-0104`: FastAPI Transactional SoR & Postgres Data Models

---

## 13. Related RFCs
- `RFC-2026-RPT-001`: Standard Retail Operational Registers Standardization

