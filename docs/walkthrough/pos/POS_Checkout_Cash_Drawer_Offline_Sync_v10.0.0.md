<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 10.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Point of Sale (POS) & Counter Operations — Unified POS Checkout, Cash Drawer Session & Offline Sync Queue Engine
**Walkthrough Version:** v10.0.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (94/94 PASSED)

---

## 1. Purpose

Establishes the enterprise **Unified POS Checkout, Cash Drawer Session & Offline Sync Queue Engine** in SMRITI Retail OS. Manages terminal cash drawer sessions (`PosSession`) with opening float verification, processes high-speed counter sales checkouts with cash/card/UPI multi-mode tender and change calculation, reconciles cash drawer closing counts with variance reporting, and provides an offline transaction sync engine (`PosOfflineSyncQueue`) with client transaction UUID deduplication.

---

## 2. Scope

- New Alembic DDL migration: `v1000_pos_checkout_drawer_sync.py` — creates `pos_sessions`, `pos_transactions`, `pos_transaction_items`, and `pos_offline_sync_queue` tables with full `BaseEntity` audit columns.
- Unified ORM models in `app/models/pos.py`: `PosSession`, `PosTransaction`, `PosTransactionItem`, `PosOfflineSyncQueue`.
- New `PosEngine` domain service (`app/services/pos_engine.py`):
  - `open_session()`: opens a new cash drawer session (`status="OPEN"`) for a cashier/terminal with opening float balance.
  - `process_checkout()`: executes high-speed counter sale, deducts product stock directly, calculates change due, updates cumulative session cash/card/UPI sales.
  - `close_session()`: reconciles expected cash (`opening_balance + cash_sales`) against actual cash count, calculates cash variance (`actual - expected`), sets status to `CLOSED`.
  - `process_offline_sync_batch()`: ingests offline transaction batches, checks `client_tx_uuid` uniqueness, creates sales records, and handles duplicate submissions idempotently.
- New REST API router: `/api/v1/pos` (`POST /sessions/open`, `POST /sessions/{id}/checkout`, `POST /sessions/{id}/close`, `POST /sync`, `GET /sessions/{id}`).
- Pydantic DTO schemas: `PosSessionOpenReq`, `PosSessionResponse`, `PosCheckoutReq`, `PosTransactionResponse`, `PosSessionCloseReq`, `PosOfflineSyncBatchReq`, `PosOfflineSyncResultItem`.
- 6 integration test assertions verifying session open/close with variance calculation, counter checkout with stock deduction & change due calculation, closed session rejection, offline batch sync ingestion & deduplication, insufficient stock rejection, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v1000_pos_checkout_drawer_sync.py` | Alembic DDL migration — creates `pos_sessions`, `pos_transactions`, `pos_transaction_items`, `pos_offline_sync_queue` tables |
| `backend/app/models/pos.py` | Unified POS ORM models — PosSession, PosTransaction, PosTransactionItem, PosOfflineSyncQueue |
| `backend/app/services/pos_engine.py` | PosEngine domain service — session lifecycle, checkout, drawer reconciliation, and offline sync batch engine |
| `backend/app/schemas/pos.py` | Pydantic DTO schemas for sessions, checkouts, transactions, and offline sync |
| `backend/app/api/v1/pos.py` | REST API gateway: `/pos/sessions/open`, `/pos/sessions/{id}/checkout`, `/pos/sessions/{id}/close`, `/pos/sync` |
| `backend/app/tests/test_pos.py` | 6 integration test assertions for complete POS checkout, session reconciliation, and offline sync queue |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Exported `PosSession`, `PosTransaction`, `PosTransactionItem`, `PosOfflineSyncQueue` |
| `backend/app/repositories/pos.py` | Updated repository reference to `PosSession` model |
| `backend/app/repositories/__init__.py` | Exported `PosSessionRepository` |
| `backend/app/main.py` | Imported and mounted `pos.router` under `/api/v1` |
| `docs/walkthrough/README.md` | Appended v10.0.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: Cash Drawer Session Reconciliation & Variance Tracking
- Evaluates `expected_cash = opening_balance + total_cash_sales`.
- Calculates `cash_variance = actual_cash_count - expected_cash`.

### AD-02: Offline Sync Queue Idempotency
- Enforces strict deduplication using `client_tx_uuid`. Repeat sync submissions return `status="DUPLICATE"` without duplicate stock deduction or revenue double-counting.

---

## 6. Implementation Summary

### Database Schema

```text
pos_sessions
    id, uuid, tenant_id, company_id, branch_id, session_no, cashier_id, terminal_id, opened_at, closed_at,
    opening_balance, total_cash_sales, total_card_sales, total_upi_sales, total_sales, expected_cash,
    actual_cash_count, cash_variance, status (OPEN/CLOSED/RECONCILED), notes

pos_transactions
    id, uuid, tenant_id, company_id, branch_id, session_id, receipt_no, client_tx_uuid, customer_id,
    subtotal, tax_total, discount_amount, grand_total, payment_method (CASH/CARD/UPI/MIXED),
    tendered_amount, change_due, status (COMPLETED/VOIDED/REFUNDED), transaction_time, is_offline_synced

pos_transaction_items
    id, uuid, tenant_id, company_id, branch_id, transaction_id, product_id, product_code, product_name,
    quantity, unit_price, tax_amount, line_total

pos_offline_sync_queue
    id, uuid, tenant_id, company_id, branch_id, client_tx_uuid, terminal_id, payload_json,
    sync_status (PENDING/SYNCED/FAILED/DUPLICATE), synced_transaction_id, error_message, submitted_at, synced_at
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/pos/sessions/open` | Open new cashier drawer session |
| `POST` | `/api/v1/pos/sessions/{id}/checkout` | Execute counter sale checkout transaction |
| `POST` | `/api/v1/pos/sessions/{id}/close` | Reconcile cash count and close session |
| `POST` | `/api/v1/pos/sync` | Ingest offline store transaction batch |
| `GET` | `/api/v1/pos/sessions/{id}` | Get session details |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py app/tests/test_sales_invoicing.py app/tests/test_sales_return.py app/tests/test_stock_audit.py app/tests/test_stock_transfer.py app/tests/test_replenishment.py app/tests/test_pos.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_open_and_close_pos_session_with_cash_reconciliation` | **PASSED** |
| 2 | `test_pos_checkout_deducts_inventory_and_calculates_change` | **PASSED** |
| 3 | `test_checkout_fails_on_closed_session` | **PASSED** |
| 4 | `test_offline_sync_batch_ingestion_and_deduplication` | **PASSED** |
| 5 | `test_insufficient_stock_rejects_pos_checkout` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_pos_sessions` | **PASSED** |

**Overall Result: 94/94 PASSED across complete procurement, receiving, sales fulfillment, invoicing, returns, stock audit, stock transfer, replenishment, and POS stack**

**Verification Status: Done**
