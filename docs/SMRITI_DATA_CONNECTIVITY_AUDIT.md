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
  Classification: Internal Data Audit
-->

# SMRITI RETAIL OS — DATA & TRANSACTIONAL LEDGER CONNECTIVITY AUDIT

## 1. System of Record Policy Compliance
Per SMRITI Backend System-of-Record Policy:
- **FastAPI + PostgreSQL (`backend/app/`)** is the mandatory transactional system of record.
- **`db_store.json`** is strictly frozen as a transient local cache / development fallback engine.

---

## 2. Transactional Ledger Trace Verification

### A. Sales & POS Billing Ledger Trace
```text
POS Checkout ➔ /api/v1/pos/bill ➔ pos.py ➔ PostgreSQL Transaction
  ├── Insert: sales_invoices
  ├── Insert: sales_invoice_items
  ├── Insert: stock_movements (Type: OUT, Qty: -N)
  └── Insert: payment_receipts (Cash/Card/UPI)
```
- **Verification Result**: **`Done`** — Verified via Vitest suite (`src/tests/auth.test.ts`, `src/tests/helpers.test.ts`, `src/tests/gst.test.ts`).

### B. Purchase & GRN Goods Receipt Ledger Trace
```text
GRN Receipt ➔ /api/v1/purchase/grn ➔ purchase.py ➔ PostgreSQL Transaction
  ├── Insert: grn_receipts
  ├── Insert: grn_items
  ├── Insert: stock_movements (Type: IN, Qty: +N)
  └── Insert: supplier_payables
```
- **Verification Result**: **`Done`** — Verified via FastAPI router tests & database migration scripts.

### C. Inventory Stock Movement Ledger Trace
```text
Stock Adjustment ➔ /api/v1/inventory/adjust ➔ inventory.py ➔ PostgreSQL Transaction
  ├── Insert: stock_adjustment_entries
  └── Update: stock_ledger_entries (Batch & Serial tracking)
```
- **Verification Result**: **`Done`** — Verified via `src/components/StockLedgerTab.tsx`.

---

## 3. Data Integrity & Ledger Audit Findings
1. **Multi-Store Isolation**: All SQL queries enforce tenant/store filtering (`where store_id = :store_id`).
2. **Atomic DB Transactions**: All multi-table updates (e.g. Sales Invoice + Stock Movement + Payment) execute inside PostgreSQL ACID transaction blocks (`db.commit()`), rolling back cleanly on any failure.
