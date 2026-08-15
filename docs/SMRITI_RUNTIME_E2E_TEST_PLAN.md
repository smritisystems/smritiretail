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
  Classification: Internal Runtime Test Plan
-->

# SMRITI RETAIL OS — PHASE 2 RUNTIME E2E TEST PLAN

## 1. Test Architecture & Environment Prerequisites
- **Frontend Target**: `http://localhost:3000` (Vite 5 / React 18 layout engine)
- **Backend System-of-Record**: `http://127.0.0.1:8000/api/v1` (FastAPI + PostgreSQL)
- **Test Harness**: Vitest unit/integration suite (`src/tests/`) + Playwright/Browser E2E runtime runner.
- **UI/UX Change Freeze Policy**: Active — 0 visual, layout, or database schema changes permitted.

---

## 2. Core Business Journey E2E Test Specifications

### Journey 1: POS Retail Billing Journey
```text
Login ➔ Billing Desk ➔ Select Customer ➔ Scan Barcode ➔ Set Quantity ➔ Apply Discount ➔ Verify GST ➔ Tender Payment ➔ Save Invoice ➔ PostgreSQL Ledger Verification ➔ Print Preview
```
- **Step 1**: Authenticate via `LoginScreen` (`POST /api/v1/auth/token`).
- **Step 2**: Open `PosTerminalTab`. Verify walk-in customer default.
- **Step 3**: Focus barcode input (`F2`), scan item SKU. Verify item inserted into cart with price and tax calculated.
- **Step 4**: Modify quantity to 2, apply 5% discount.
- **Step 5**: Click Tender Payment (`F8`), select Cash tender.
- **Step 6**: Submit transaction (`POST /api/v1/pos/bill`). Capture returned invoice number.
- **Step 7**: Verify `sales_invoices`, `stock_movements`, and `payment_receipts` in PostgreSQL.
- **Step 8**: Launch `PrintPreviewModal`, verify Tax Invoice rendering.

---

### Journey 2: Procurement & GRN Goods Receipt Journey
```text
Login ➔ Purchase Studio ➔ Select Supplier ➔ Select PO / Items ➔ Pricing ➔ GST ➔ Save GRN ➔ Stock Increase Verification ➔ Payable Ledger Verification
```
- **Step 1**: Open `PurchaseStudioTab`.
- **Step 2**: Select supplier, enter purchase order line items.
- **Step 3**: Save GRN receipt (`POST /api/v1/purchase/grn`).
- **Step 4**: Query PostgreSQL `grn_receipts` and `stock_movements` (Type: IN).
- **Step 5**: Retrieve document by number in Purchase Studio table.

---

### Journey 3: Stock Audit & Inventory Adjustment Journey
```text
Item Lookup ➔ Barcode ➔ Warehouse Selection ➔ Current Stock Check ➔ Stock Adjustment ➔ Submit ➔ Database Ledger Verification ➔ UI State Refresh
```
- **Step 1**: Open `StockLedgerTab` / `ItemMasterTab`.
- **Step 2**: Query SKU stock balance.
- **Step 3**: Execute stock adjustment (`POST /api/v1/inventory/adjust`).
- **Step 4**: Verify updated stock level in database and refresh UI ledger table.

---

### Journey 4: Customer Master Onboarding & History Journey
```text
Create Customer ➔ Save ➔ Capture ID ➔ Retrieve ➔ Edit Profile ➔ Save ➔ Search ➔ Transaction History
```
- **Step 1**: Open `CustomerMasterTab`. Click New Customer.
- **Step 2**: Fill customer name, phone, GSTIN, credit limit. Click Save (`POST /api/v1/crm/customers`).
- **Step 3**: Retrieve customer in search table, edit credit limit, save update.
- **Step 4**: Verify persistence in PostgreSQL `customers` table.
