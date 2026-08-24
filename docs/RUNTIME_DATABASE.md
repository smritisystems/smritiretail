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
  Classification: Internal Database Verification Audit
-->

# SMRITI RETAIL OS — RUNTIME DATABASE VERIFICATION

## 1. System-of-Record Policy Compliance
- **Transactional Database**: PostgreSQL (`backend/app/db/session.py`).
- **ORM / Migrations**: SQLAlchemy 2.0 + Alembic (`backend/alembic/`).
- **Development Cache**: `db_store.json` (Strict feature freeze; used only as transient fallback).

---

## 2. Table Persistence Verification Matrix

| Table Name | Transactional Domain | Primary Keys / Indexes | Verified API Endpoint | Status |
|---|---|---|---|---|
| `users` | Auth & Staff | `id`, `email`, `role_id` | `POST /api/v1/auth/token` | **`Done`** |
| `sales_invoices` | Billing Ledger | `id`, `invoice_no`, `store_id` | `POST /api/v1/pos/bill` | **`Done`** |
| `sales_invoice_items`| Billing Cart Items | `id`, `invoice_id`, `product_id`| `POST /api/v1/pos/bill` | **`Done`** |
| `stock_movements` | Inventory Ledger | `id`, `movement_type`, `sku` | `POST /api/v1/pos/bill` | **`Done`** |
| `grn_receipts` | Procurement Goods Receipt| `id`, `grn_no`, `supplier_id` | `POST /api/v1/purchase/grn` | **`Done`** |
| `products` | Master SKU Catalog | `id`, `sku_code`, `hsn_code` | `POST /api/v1/attributes/products` | **`Done`** |
| `customers` | Customer Ledger | `id`, `phone`, `gstin` | `POST /api/v1/crm/customers` | **`Done`** |

---

## 3. Transaction Safety & Isolation
1. **Multi-Tenant Store Filtering**: All SQL queries bind `store_id` parameter to prevent cross-tenant data leakage.
2. **ACID Transaction Boundaries**: Multi-step workflows execute inside explicit transaction blocks (`with db.begin():`). If stock deduction fails, billing invoice creation is aborted cleanly.
