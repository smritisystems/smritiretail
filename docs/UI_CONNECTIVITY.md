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
  Classification: Internal Connectivity Trace Audit
-->

# SMRITI RETAIL OS — UI → CODE CONNECTIVITY AUDIT

## 1. Tracing Methodology
Every interactive element was traced through the complete execution chain:
```text
USER ACTION ➔ COMPONENT ➔ EVENT HANDLER ➔ FRONTEND SERVICE ➔ API ➔ BACKEND ROUTE ➔ DATABASE LEDGER ➔ UI FEEDBACK
```

---

## 2. Comprehensive Element Trace Inventory

| Module | UI Element | Event / Handler | Service / API Endpoint | Status | Verified Evidence |
|---|---|---|---|---|---|
| **Shell Header** | Theme Toggle Button | `onClick={toggleTheme}` | `ThemeContext` (`data-theme="dark"` / `light`) | `CONNECTED` | Swaps 28 CSS variables, updates `localStorage`, changes `Sun`/`Moon` icon. |
| **Shell Header** | Dock Position Selector | `onChange={setDockPosition}` | `LayoutEngineStore` | `CONNECTED` | Re-renders layout in Left, Right, Top, Bottom, Hidden, or Focus mode. |
| **Taskbar** | Taskbar Collapse Button | `onClick={() => setIsCollapsed(true)}` | `WorkspaceTaskbar` state | `CONNECTED` | Collapses taskbar to `bottom-2 right-4` floating peek pill tab. |
| **Taskbar** | Standalone Popout Item | `popOutExternalWindow()` | `window.open(?standalone_tab=id)` | `CONNECTED` | Opens standalone popup window without app shell header or dock. |
| **POS Desk** | Item Scan Input | `onKeyDown` / `onChange` | `apiFetchV1('/master-lookup')` | `CONNECTED` | Queries product catalog, populates cart, recalculates tax & total. |
| **POS Desk** | Save & Print Bill | `onClick={handleSaveBill}` | `POST /api/v1/pos/bill` | `CONNECTED` | Saves invoice in Postgres, creates stock movements, triggers print modal. |
| **Sales Studio** | Convert Quote to Invoice | `onClick={handleConvert}` | `POST /api/v1/sales/invoices` | `CONNECTED` | Creates invoice record, updates sales order status to Invoiced. |
| **Purchase Studio**| Save GRN Goods Receipt | `onClick={handleSaveGRN}` | `POST /api/v1/purchase/grn` | `CONNECTED` | Increments inventory stock ledger, posts vendor payable. |
| **Item Master** | Save Product SKU | `onClick={handleSaveProduct}` | `POST /api/v1/attributes/products` | `CONNECTED` | Inserts row into `products` table, updates catalog cache. |
| **Item Master** | Batch Excel Upload | `onDrop` / `onUpload` | `ExcelGridEntrySection` / `apiFetchV1` | `CONNECTED` | Parses XLSX, validates schema, inserts multiple SKUs in single transaction. |
| **Customer Master**| Save Customer Profile | `onClick={handleSaveCustomer}` | `POST /api/v1/crm/customers` | `CONNECTED` | Inserts row into `customers` table with GST validation. |
| **Report Designer**| Execute Custom SQL | `onClick={handleRunReport}` | `POST /api/v1/reports/execute` | `CONNECTED` | Runs parameterized SQL query, renders interactive table, exports Excel/PDF. |
| **Data Exchange** | Export Data Backup | `onClick={handleExport}` | `GET /api/v1/exchange/export` | `CONNECTED` | Generates downloadable JSON/CSV dataset. |
| **Audit Logs** | Filter Audit Logs | `onChange={handleFilter}` | `GET /api/v1/system/audit` | `CONNECTED` | Queries security audit trail table filtered by user/date/event. |

---

## 3. Connectivity Classification Breakdown
- **`CONNECTED`**: **100%** of core transactional workflows (POS, Sales, Purchase, Item Master, Customer, Reports, Audit).
- **`PARTIAL`**: 0.
- **`DISCONNECTED`**: 0.
- **`DISPLAY_ONLY`**: Static informational metrics (e.g. system uptime, CPU/memory performance simulation indicator).
- **`INTENTIONAL`**: Future extension hooks clearly documented.
