<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 8.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Inventory Control & Warehouse Management — Physical Stock Audit & Cycle Counting Engine
**Walkthrough Version:** v8.0.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (76/76 PASSED)

---

## 1. Purpose

Establishes the enterprise **Inventory Physical Stock Audit & Cycle Counting Engine** in SMRITI Retail OS. Provides automated creation of warehouse cycle count sessions (`StockCount`), blind or visible physical stock count entry (`StockCountItem`), automated system-vs-physical stock variance calculation (quantity and financial value), posting of reconciled stock adjustment vouchers (`StockAdjustment`), and real-time updates to `Product.stock` with complete audit tracking.

---

## 2. Scope

- New Alembic DDL migration: `v800_stock_count_cycle_audit.py` — creates `stock_counts`, `stock_count_items`, and `stock_adjustments` tables with full `BaseEntity` audit columns.
- Unified ORM models in `app/models/inventory.py`: `StockCount`, `StockCountItem`, `StockAdjustment`.
- New `StockAuditEngine` domain service (`app/services/stock_audit_engine.py`):
  - `create_stock_count()`: creates a draft cycle count audit session (`Full` or `Selective`), snapshotting current system stock and unit costs across targeted products.
  - `record_physical_counts()`: records verified physical count quantities per line item and computes quantity variances (`variance_qty = physical_count - system_stock`) and financial value variances (`variance_value`).
  - `reconcile_and_adjust_stock()`: reconciles physical stock audit, updates `Product.stock` directly to match physical counts, posts a `StockAdjustment` voucher, and sets session status to `Completed`.
- New REST API router: `/api/v1/inventory` (`POST /stock-counts`, `POST /stock-counts/{id}/counts`, `POST /stock-counts/{id}/reconcile`, `GET /stock-counts/{id}`, `GET /stock-adjustments/{id}`).
- Pydantic DTO schemas: `StockCountCreate`, `StockCountResponse`, `PhysicalCountsRequest`, `StockCountReconcileRequest`, `StockAdjustmentResponse`.
- 6 integration test assertions verifying count session creation, physical count entry & variance computation, direct `Product.stock` reconciliation, adjustment voucher generation, duplicate reconciliation rejection, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v800_stock_count_cycle_audit.py` | Alembic DDL migration — creates `stock_counts`, `stock_count_items`, `stock_adjustments` tables |
| `backend/app/services/stock_audit_engine.py` | StockAuditEngine domain service — audit session management, variance calculation, stock adjustment reconciliation |
| `backend/app/schemas/stock_audit.py` | Pydantic DTO schemas for stock count sessions, physical counts, reconciliation requests, and adjustment vouchers |
| `backend/app/api/v1/stock_audit.py` | REST API gateway: `/inventory/stock-counts`, `/inventory/stock-counts/{id}/counts`, `/inventory/stock-adjustments/{id}` |
| `backend/app/tests/test_stock_audit.py` | 6 integration test assertions for complete warehouse physical stock audit and cycle count lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/inventory.py` | Unified `StockCount`, `StockCountItem`, and `StockAdjustment` ORM models |
| `backend/app/main.py` | Imported and mounted `stock_audit.router` under `/api/v1` |
| `docs/walkthrough/README.md` | Appended v8.0.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: System Stock Snapshotting
- At count creation, `system_stock` and `unit_cost` are snapshotted on `StockCountItem`.
- Ensures accurate variance calculation even if sales or procurement movements occur during counting.

### AD-02: Direct Stock Reconciliation & Audit Vouchers
- Reconciling a stock count session immediately posts a `StockAdjustment` voucher recording `total_adjustment_qty` and `total_adjustment_value`.
- Sets `Product.stock` directly to the verified physical count quantity.

---

## 6. Implementation Summary

### Database Schema

```text
stock_counts
    id, uuid, tenant_id, company_id, branch_id, count_no, name, count_type (Full/Selective/ABC),
    status (Draft/Counting/Reconciled/Completed/Cancelled), scheduled_date, completed_date, notes,
    total_items, total_variance_qty, total_variance_value

stock_count_items
    id, uuid, tenant_id, company_id, branch_id, count_id, product_id,
    system_stock, physical_count, variance_qty, unit_cost, variance_value,
    status (Pending/Counted/Reconciled), notes

stock_adjustments
    id, uuid, tenant_id, company_id, branch_id, adjustment_no, count_id,
    adjustment_date, reason, total_adjustment_qty, total_adjustment_value, status, notes
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/inventory/stock-counts` | Create draft stock count session |
| `POST` | `/api/v1/inventory/stock-counts/{id}/counts` | Record physical counts & calculate variances |
| `POST` | `/api/v1/inventory/stock-counts/{id}/reconcile` | Reconcile stock & post adjustment voucher |
| `GET` | `/api/v1/inventory/stock-counts/{id}` | Get stock count session details |
| `GET` | `/api/v1/inventory/stock-adjustments/{id}` | Get stock adjustment voucher details |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py app/tests/test_sales_invoicing.py app/tests/test_sales_return.py app/tests/test_stock_audit.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_create_stock_count_session` | **PASSED** |
| 2 | `test_record_physical_counts_calculates_variance` | **PASSED** |
| 3 | `test_reconcile_stock_count_updates_product_stock` | **PASSED** |
| 4 | `test_stock_adjustment_voucher_generation` | **PASSED** |
| 5 | `test_cannot_reconcile_already_completed_count` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_stock_audit` | **PASSED** |

**Overall Result: 76/76 PASSED across complete procurement, receiving, sales fulfillment, invoicing, returns, and stock audit stack**

**Verification Status: Done**
