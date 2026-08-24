<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal API Audit
-->

# SMRITI RETAIL OS — API & BACKEND ROUTE CONNECTIVITY AUDIT

## 1. API Architecture Summary
SMRITI Retail OS employs a dual API communication strategy:
1. `src/lib/apiFetch.ts`: Routing gateway targeting Express (`/api/*`) for transient UI caching & migration proxy.
2. `src/lib/apiFetchV1.ts`: Direct transactional gateway targeting FastAPI + PostgreSQL (`/api/v1/*`) as the system of record.

---

## 2. FastAPI Endpoint Audit Matrix (`backend/app/api/v1`)

| Endpoint Path | HTTP Method | Frontend Caller | Request Schema | Backend Handler | Database Action | Verification Status |
|---|---|---|---|---|---|---|
| `/api/v1/auth/token` | `POST` | `LoginScreen.tsx` | `OAuth2PasswordRequestForm` | `backend/app/api/v1/auth.py` | Validates hash, issues JWT session token | **`Done`** |
| `/api/v1/auth/me` | `GET` | `App.tsx` | Bearer Token Header | `backend/app/api/v1/auth.py` | Queries `users` table, returns user profile | **`Done`** |
| `/api/v1/pos/bill` | `POST` | `PosTerminalTab.tsx` | `POSBillCreate` | `backend/app/api/v1/pos.py` | Inserts `sales_invoices`, posts stock movements | **`Done`** |
| `/api/v1/master-lookup` | `GET` | `PosTerminalTab.tsx` | Query param `q` | `backend/app/api/v1/master_lookup.py` | Queries `products` & `variants` table | **`Done`** |
| `/api/v1/sales/invoices` | `GET/POST` | `SalesStudioTab.tsx` | `SalesInvoiceSchema` | `backend/app/api/v1/sales.py` | Inserts/queries `sales_invoices` table | **`Done`** |
| `/api/v1/purchase/grn` | `POST` | `PurchaseStudioTab.tsx` | `GRNCreateSchema` | `backend/app/api/v1/purchase.py` | Inserts `grn_receipts`, updates stock ledger | **`Done`** |
| `/api/v1/attributes/products`| `GET/POST` | `ItemMasterTab.tsx` | `ProductCreateSchema` | `backend/app/api/v1/attributes.py` | Inserts/queries `products` table | **`Done`** |
| `/api/v1/crm/customers` | `GET/POST` | `CustomerMasterTab.tsx` | `CustomerSchema` | `backend/app/api/v1/crm.py` | Inserts/queries `customers` table | **`Done`** |
| `/api/v1/reports/execute` | `POST` | `ReportDesignerTab.tsx` | `ReportQuerySchema` | `backend/app/api/v1/reports.py` | Runs SQL query, returns dataset | **`Done`** |
| `/api/v1/numbering/series` | `GET/POST` | `DocumentSeriesTab.tsx` | `DocumentSeriesSchema` | `backend/app/api/v1/numbering.py` | Manages voucher sequence reset rules | **`Done`** |
| `/api/v1/dev-tracker/metrics`| `GET` | `DevTrackerTab.tsx` | None | `backend/app/api/v1/dev_tracker.py` | Queries git commit metrics & quality scores | **`Done`** |

---

## 3. Error Handling & Response Mapping
- **Error Translation**: Handled via SMRITI Human-Readable Error Policy (HREP). Raw tracebacks are suppressed in UI; business-friendly alerts are returned with reference IDs.
- **Authentication Resilience**: Auto-refreshes session tokens or redirects to `LoginScreen` upon 401 Unauthorized responses.
