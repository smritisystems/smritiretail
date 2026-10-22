<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.5
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Master Data Audit Register
  Policy ID    : UADHP-v1.0
-->

# SMRITI Master Data-to-UX Connectivity & Integrity Register

## 1. Executive Summary & Objective
This register establishes the authoritative audit inventory and connectivity status of every major module, screen, tab, and UX element across SMRITI Retail OS. It enforces the core architectural mandate:
**No fabricated business data in production UX. No silent mock-data fallback. No false claims of database connectivity.**

Every displayed business entity must trace through the validated communication hierarchy:
```text
PostgreSQL Schema Tables → SQLAlchemy Query/Repository → FastAPI Route Service (/api/v1/*) → React apiFetchV1 Hooks → UX Components
```

---

## 2. Classification Taxonomy
Every audited UI data element is classified under one of the 9 strict governance states:
1. `LIVE_DATABASE`: Directly fetched from authoritative PostgreSQL tenant tables.
2. `DERIVED_DATABASE`: Computed/aggregated deterministically from verified database records.
3. `STATIC_CONFIGURATION`: Fixed statutory or configuration metadata (e.g., GST slabs, state codes, standard unit types).
4. `EXPLICIT_DEMO_DATA`: Isolated fixtures shown only when a test/demo flag is explicitly active.
5. `PLACEHOLDER`: Instructional empty-state text or input placeholders.
6. `HARDCODED_BUSINESS_DATA`: Hardcoded business numbers, customer details, or inventories embedded in code.
7. `MOCK_OR_FIXTURE_DATA`: Test fixtures or mock datasets surfaced in production code paths.
8. `DISCONNECTED_OR_BROKEN`: Broken API routes, missing query parameters, or unhandled errors.
9. `UNVERIFIED`: Data flow could not be verified against the database.

---

## 3. Customer 360° / PSV Screen Forensic Audit (Audit Target Analysis)

Target Screen: `Home > CRM & Engagement > Customer Master Directory > Customer 360° Dashboard (PSV Stock Tab)`  
Customer Analyzed: `Reliance Retail Limited` (`RRL-001` / `cust-rrl-192b561d`)  
Database Analyzed: PostgreSQL `smriti001` (Tenant `COMP-001`)  

| Visible UI Element | Audited Value | Database Reality in `smriti001` | Initial Classification | Remediated Classification | Root Cause / Verification Method |
|---|---|---|---|---|---|
| **Customer Name** | Reliance Retail Limited | `Reliance Retail Limited` (`customers.name`) | `LIVE_DATABASE` | `LIVE_DATABASE` | Direct match in `customers` table for `id = 'cust-rrl-192b561d'`. |
| **Customer Code** | RRL-001 | `RRL-001` (`customers.code`) | `LIVE_DATABASE` | `LIVE_DATABASE` | Direct match in `customers` table. |
| **Status Badge** | Active | `Active` (`customers.status`) | `LIVE_DATABASE` | `LIVE_DATABASE` | Valid active record. |
| **Account Badges** | Corporate B2B, Parent, Key Account | `Customer.customer_type = 'Corporate B2B'` | `DERIVED_DATABASE` | `DERIVED_DATABASE` | Identity badges derived from corporate account classifications. |
| **Child Customers Count** | 0 Child Customers | 0 dependants in `customer_relationships` | `LIVE_DATABASE` | `LIVE_DATABASE` | Match. Reliance Retail operates as a direct single-tier parent account. |
| **Stores / Outlets Count** | 68 Stores / Outlets | **7 Active stores** (66 total in table, 59 soft-deleted) | `MOCK_OR_FIXTURE_DATA` | `LIVE_DATABASE` | 68 was hardcoded in test fixture `Array.from({ length: 68 })`. Remediated to live `liveStoreNetwork.length` (7 active). |
| **Credit Limit** | ₹ 9,99,99,999 | No company credit limit set (`0.00` default) | `MOCK_OR_FIXTURE_DATA` | `LIVE_DATABASE` | ₹9.99 Cr was from test fixture `credit_limit: 99999999`. Remediated to `CustomerCompanyRelationship` / `CustomerGroup` lookup. |
| **Outstanding Balance** | ₹ 2,54,38,746.1 | Ledger balance: **₹155.24**; Unpaid Invoices: **₹24,432,019.28** | `MOCK_OR_FIXTURE_DATA` | `DERIVED_DATABASE` | Unpaid invoices total ₹2.44 Cr across 263 invoices. Remediated to live calculation from `customers.outstanding`. |
| **Document Qty Tile** | 5,420 | Live company document qty: **26,800.00**; RRL-001 qty: **2,694.00** | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Hardcoded literal `5,420` in JSX. Remediated to `/api/v1/psv/reconciliation` live aggregate. |
| **Received Qty Tile** | 5,180 | Live physical received qty: **0.00** | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Hardcoded literal `5,180` in JSX. Remediated to `/api/v1/psv/reconciliation` live aggregate. |
| **Approved Qty Tile** | 4,980 | Live approved received qty: **0.00** | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Hardcoded literal `4,980` in JSX. Remediated to `/api/v1/psv/reconciliation` live aggregate. |
| **Pending Approval Tile**| 240 | Live pending inspection qty: **0.00** | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Hardcoded literal `240` in JSX. Remediated to `/api/v1/psv/reconciliation` live aggregate. |
| **Shortage Tile** | 120 | Live shortage qty: **26,800.00** (Company) / **2,694.00** (RRL-001) | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Hardcoded literal `120` in JSX. Remediated to `/api/v1/psv/reconciliation` live aggregate. |
| **Excess Tile** | 80 | Live excess qty: **0.00** | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Hardcoded literal `80` in JSX. Remediated to `/api/v1/psv/reconciliation` live aggregate. |
| **Total Records Counter**| 125 Total Records | Live active line items: **16,633** (Company) / **1,882** (RRL-001) | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Hardcoded text string in JSX. Remediated to dynamic `{totalItems} Total Records`. |
| **Document Numbers** | PO-2026-001 to 005 | Real invoices: `INV-592609`, `INV-930369`, `INV-TEST02`, etc. | `MOCK_OR_FIXTURE_DATA` | `LIVE_DATABASE` | PO numbers were fictional constants. Remediated to live `SalesInvoice.invoice_no`. |
| **Store Codes** | REL-MUM-001, 002 | Real store codes: `T9IM`, `S4NN/8319`, `TEST-MUM-001`, etc. | `MOCK_OR_FIXTURE_DATA` | `LIVE_DATABASE` | Remediated to live `delivery_store_code` from delivery locations. |
| **Barcodes** | 8901234567890 - 4 | In DB, 8901234567890 = `Regular Sandal 36 Beige` (Footwear) | `MOCK_OR_FIXTURE_DATA` | `LIVE_DATABASE` | Mock assigned apparel labels ("Men's T-Shirt"). Remediated to live `Product` catalog attributes. |
| **Filter Dropdowns** | Hardcoded `<option>` | Live stores & attribute collections | `HARDCODED_BUSINESS_DATA` | `DERIVED_DATABASE` | Replaced with dynamic maps over `liveStoreNetwork` and live reconciliation items. |

---

## 4. Application-Wide Module Inventory & Connectivity Status

| Module / Area | Screens / Tabs | Data Source Classification | Backend Endpoint | PostgreSQL Tables | Status |
|---|---|---|---|---|---|
| **Customer Master & 360°** | `Customer360DashboardView.tsx`, `CorporateCustomer360.tsx` | `LIVE_DATABASE` / `DERIVED_DATABASE` | `GET /crm/customers/{id}/corporate-360`, `GET /psv/reconciliation` | `customers`, `customer_delivery_locations`, `sales_invoices`, `psv_stock_events` | **`Done`** |
| **Party Stock Visibility (PSV)** | `PsvTab.tsx` | `LIVE_DATABASE` | `GET /psv/parties`, `GET /psv/reconciliation` | `psv_parties`, `psv_stock_balances`, `psv_stock_events` | **`Done`** |
| **Visual Reports Dashboard** | `VisualReportsDashboardTab.tsx` | `LIVE_DATABASE` / `DERIVED_DATABASE` | `GET /visual-reports/summary` | `product_batch_stocks`, `sales_orders`, `packing_slips`, `dispatches`, `sales_invoices` | **`Done`** |
| **Report Builder** | `ReportBuilder.tsx` | `LIVE_DATABASE` | `POST /reports/run-adhoc`, `GET /reports/` | Dynamic domain models via `ReportExecutionEngine` | **`Done`** |
| **Product & Item Master** | `ItemMasterWs.tsx`, `App.tsx` | `LIVE_DATABASE` | `GET /inventory/products`, `GET /items/` | `products`, `items`, `product_batch_stocks` | **`Done`** (Removed dummy injection) |
| **Purchase & Procurement** | `PurchaseStudioTab.tsx`, `PoSizewiseTab.tsx` | `LIVE_DATABASE` | `GET /purchase/orders`, `GET /procurement/` | `purchase_orders`, `purchase_order_items`, `suppliers` | **`Done`** |
| **Sales & Billing Studio** | `SmritiBillingStudio.tsx`, `DispatchInvoicingStudioTab.tsx` | `LIVE_DATABASE` | `GET /sales/orders`, `GET /sales/invoices` | `sales_orders`, `sales_invoices`, `customers` | **`Done`** |
| **WMS & Warehouse** | `WmsStudioTab.tsx`, `StockTransferStudioModal.tsx` | `LIVE_DATABASE` | `GET /wms/warehouses`, `GET /wms/batch-stocks` | `warehouses`, `locations`, `product_batch_stocks` | **`Done`** |
| **Security & Permissions** | `UsersView.tsx`, `SecurityAccessShell.tsx` | `LIVE_DATABASE` | `GET /users/`, `GET /roles/` | `users`, `roles`, `branches`, `companies` | **`Done`** |

---

## 5. Remediation Action Summary
1. **Scaped PSV Reconciliation Querying:**
   - Extended `PSVProjectionService.get_quantity_reconciliation()` to accept `customer_id`, `store_code`, `start_date`, and `end_date`.
   - Filtered `SalesInvoice` records by `customer_id` and store code to compute live item rows and metric sums.
2. **Eliminated JSX Hardcoded Metric Tiles:**
   - Bound PSV KPI cards to live summary totals (`total_document_qty`, `total_received_qty`, `total_approved_qty`, `total_pending_approval_qty`, `total_short_qty`, `total_excess_qty`).
3. **Replaced Reference Rows with Live Document Stream:**
   - Rendered real Sales Invoices and physical receiving rows instead of `PO-2026-001` through `PO-2026-005`.
4. **Eliminated Silent Mock Product Injection in Core App:**
   - Removed `mappedProducts.push({ id: "dummy-master-0001", code: "DUMMY-001", ... })` from `src/App.tsx`.
