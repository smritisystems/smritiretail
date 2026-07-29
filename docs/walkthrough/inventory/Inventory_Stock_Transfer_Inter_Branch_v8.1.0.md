<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 8.1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Inventory Control & Warehouse Management — Stock Movement & Inter-Branch Transfer Order Engine
**Walkthrough Version:** v8.1.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (82/82 PASSED)

---

## 1. Purpose

Establishes the enterprise **Stock Movement & Inter-Branch Transfer Order Engine** in SMRITI Retail OS. Manages inter-branch and inter-warehouse inventory transfers (`StockTransfer`), verifies stock availability at the originating source branch, dispatches goods into in-transit status (`InTransit`) while deducting source stock, receives stock at the destination branch (`Received`), and tracks multi-branch parcel shipments with audit compliance.

---

## 2. Scope

- New Alembic DDL migration: `v810_stock_transfer_orders.py` — creates `stock_transfers`, `stock_transfer_items`, and `stock_transfer_shipments` tables with full `BaseEntity` audit columns.
- Unified ORM models in `app/models/inventory.py`: `StockTransfer`, `StockTransferItem`, `StockTransferShipment`.
- New `StockTransferEngine` domain service (`app/services/stock_transfer_engine.py`):
  - `create_transfer_order()`: creates a draft transfer order between distinct source and destination branches, calculating total line values based on unit costs.
  - `approve_transfer_order()`: approves transfer order after verifying sufficient product stock at the source branch.
  - `dispatch_transfer()`: deducts product stock from the source branch, creates a `StockTransferShipment` parcel tracking record, and sets status to `InTransit`.
  - `receive_transfer()`: receives stock at the destination branch, adds product stock to the destination branch, and sets status to `Received`.
- New REST API router: `/api/v1/inventory` (`POST /transfers`, `POST /transfers/{id}/approve`, `POST /transfers/{id}/dispatch`, `POST /transfers/{id}/receive`, `GET /transfers/{id}`).
- Pydantic DTO schemas: `StockTransferCreate`, `StockTransferResponse`, `StockTransferDispatchReq`, `StockTransferReceiveReq`, `StockTransferShipmentResponse`.
- 6 integration test assertions verifying transfer creation & approval, source stock deduction on dispatch, destination stock addition on receipt, insufficient stock rejection, identical branch transfer rejection, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v810_stock_transfer_orders.py` | Alembic DDL migration — creates `stock_transfers`, `stock_transfer_items`, `stock_transfer_shipments` tables |
| `backend/app/services/stock_transfer_engine.py` | StockTransferEngine domain service — transfer creation, stock reservation, dispatch deduction, and destination receipt |
| `backend/app/schemas/stock_transfer.py` | Pydantic DTO schemas for stock transfers, line items, dispatch requests, and shipments |
| `backend/app/api/v1/stock_transfer.py` | REST API gateway: `/inventory/transfers`, `/inventory/transfers/{id}/approve`, `/inventory/transfers/{id}/dispatch`, `/inventory/transfers/{id}/receive` |
| `backend/app/tests/test_stock_transfer.py` | 6 integration test assertions for complete inter-branch stock movement and transfer order lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/inventory.py` | Unified `StockTransfer`, `StockTransferItem`, and `StockTransferShipment` ORM models |
| `backend/app/main.py` | Imported and mounted `stock_transfer.router` under `/api/v1` |
| `docs/walkthrough/README.md` | Appended v8.1.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: Two-Step Dispatch and Receipt Workflow
- **Dispatch**: Immediately deducts salable stock from source branch `Product.stock` and creates an in-transit shipment record (`StockTransferShipment`).
- **Receipt**: Adds received stock to destination branch `Product.stock` upon physical receipt confirmation.

### AD-02: Strict Branch Boundary Enforcement
- Source and destination branch IDs must belong to the same tenant company but cannot be identical (`source_branch_id != destination_branch_id`).

---

## 6. Implementation Summary

### Database Schema

```text
stock_transfers
    id, uuid, tenant_id, company_id, branch_id, transfer_no, source_branch_id, destination_branch_id,
    transfer_date, status (Draft/Approved/InTransit/Received/Cancelled), carrier, tracking_no, notes,
    total_transfer_qty, total_transfer_value

stock_transfer_items
    id, uuid, tenant_id, company_id, branch_id, transfer_id, product_id,
    requested_qty, shipped_qty, received_qty, unit_cost, line_total, status (Pending/Shipped/Received)

stock_transfer_shipments
    id, uuid, tenant_id, company_id, branch_id, shipment_no, transfer_id,
    dispatch_date, receipt_date, carrier, tracking_no, status (DISPATCHED/DELIVERED), notes
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/inventory/transfers` | Create draft stock transfer order |
| `POST` | `/api/v1/inventory/transfers/{id}/approve` | Approve transfer order |
| `POST` | `/api/v1/inventory/transfers/{id}/dispatch` | Dispatch transfer shipment into in-transit |
| `POST` | `/api/v1/inventory/transfers/{id}/receive` | Receive transfer stock at destination branch |
| `GET` | `/api/v1/inventory/transfers/{id}` | Get transfer order details |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py app/tests/test_sales_invoicing.py app/tests/test_sales_return.py app/tests/test_stock_audit.py app/tests/test_stock_transfer.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_create_and_approve_stock_transfer` | **PASSED** |
| 2 | `test_dispatch_transfer_deducts_source_stock` | **PASSED** |
| 3 | `test_receive_transfer_adds_destination_stock` | **PASSED** |
| 4 | `test_insufficient_source_stock_rejects_approval` | **PASSED** |
| 5 | `test_same_source_destination_branch_rejected` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_stock_transfers` | **PASSED** |

**Overall Result: 82/82 PASSED across complete procurement, receiving, sales fulfillment, invoicing, returns, stock audit, and stock transfer stack**

**Verification Status: Done**
