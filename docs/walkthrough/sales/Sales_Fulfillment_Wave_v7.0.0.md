<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 7.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Sales & Warehouse Fulfillment — Outbound Sales Order & Wave Pick-Pack-Ship Fulfillment Engine
**Walkthrough Version:** v7.0.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (58/58 PASSED)

---

## 1. Purpose

Establishes the enterprise **Outbound Sales Order & Wave Pick-Pack-Ship Fulfillment Engine** in SMRITI Retail OS. Provides real-time inventory stock reservation guards to prevent overselling on sales order confirmation, warehouse wave picking generators to consolidate multiple sales orders into single pick lists, shipment packing with parcel tracking details, and automatic inventory stock deduction on parcel dispatch.

---

## 2. Scope

- New Alembic DDL migration: `v700_sales_fulfillment_engine.py` — creates `fulfillment_waves`, `pick_lists`, `pick_list_items`, and `shipment_packages` tables; adds `fulfillment_status`, `payment_status`, `subtotal`, `notes` to `sales_orders`, and `reserved_stock` to `products`.
- Unified ORM models in `app/models/sales.py`: `SalesOrder`, `SalesOrderItem`, `FulfillmentWave`, `PickList`, `PickListItem`, `ShipmentPackage`.
- New `FulfillmentEngine` domain service (`app/sales/engine/fulfillment_engine.py`):
  - `confirm_sales_order()`: validates stock availability and updates `reserved_stock` on `Product`.
  - `generate_fulfillment_wave()`: groups multiple confirmed `SalesOrder` records into a single `FulfillmentWave` and consolidated `PickList`.
  - `pack_shipment()`: generates a `ShipmentPackage` (`PACKED` status) with carrier, tracking number, weight, and shipping cost.
  - `dispatch_shipment()`: deducts `stock` and `reserved_stock` on `Product`, marks package `SHIPPED`, and updates order status to `Shipped`.
- New REST API router: `/api/v1/sales` (create order, confirm order, generate wave pick list, pack package, dispatch package).
- Pydantic DTO schemas: `SalesOrderCreate`, `SalesOrderResponse`, `FulfillmentWaveRequest`, `FulfillmentWaveResponse`, `PackShipmentRequest`, `ShipmentPackageResponse`.
- 6 integration test assertions verifying stock reservation, oversell rejection, wave pick list generation, parcel packing, inventory stock deduction on dispatch, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v700_sales_fulfillment_engine.py` | Alembic DDL migration — 4 new tables + columns added to `sales_orders` and `products` |
| `backend/app/sales/engine/fulfillment_engine.py` | FulfillmentEngine domain service — stock reservation, wave picking, packing, dispatch stock deduction |
| `backend/app/schemas/sales_fulfillment.py` | Pydantic DTO schemas for sales orders, waves, pick lists, and packages |
| `backend/app/api/v1/sales_fulfillment.py` | REST API gateway: `/sales/orders`, `/sales/fulfillment/waves`, `/sales/fulfillment/pack`, `/sales/fulfillment/dispatch` |
| `backend/app/tests/test_sales_fulfillment.py` | 6 integration test assertions for complete outbound sales fulfillment lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/sales.py` | +`SalesOrder`, `SalesOrderItem`, `FulfillmentWave`, `PickList`, `PickListItem`, `ShipmentPackage` ORM models |
| `backend/app/models/inventory.py` | +`reserved_stock` column on `Product` model |
| `backend/app/main.py` | +`sales_fulfillment` import; +`app.include_router(sales_fulfillment.router, ...)` |
| `docs/walkthrough/README.md` | Appended v7.0.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: Real-Time Stock Reservation Guard
Upon confirming a `SalesOrder`, available stock is computed as:
$$\text{Available Stock} = \text{Current Stock} - \text{Reserved Stock}$$
If $\text{Ordered Quantity} > \text{Available Stock}$, the engine immediately raises an HTTP 400 exception detailing stock deficit, guaranteeing no overselling occurs across omni-channel sales outlets.

### AD-02: Warehouse Wave Picking & Consolidation
Multiple confirmed customer orders are batched into a `FulfillmentWave`. A single `PickList` is created with lines grouped by `product_id`, dramatically reducing warehouse picker travel time across aisles.

### AD-03: Two-Phase Inventory Stock Deduction
- **Phase 1 (Order Confirmation)**: `reserved_stock += ordered_quantity`. Available stock decreases, but total physical `stock` remains unchanged until dispatch.
- **Phase 2 (Shipment Dispatch)**: `stock -= ordered_quantity` and `reserved_stock -= ordered_quantity`. Physical stock is permanently decremented when the carrier takes custody of the parcel.

---

## 6. Implementation Summary

### Database Schema

```text
sales_orders (updated)
    +customer_id (FK customers.id), +subtotal, +fulfillment_status, +payment_status, +notes

products (updated)
    +reserved_stock (Numeric 12,4)

fulfillment_waves
    id, wave_no, status (Created/InProgress/Completed), total_orders, total_items

pick_lists
    id, pick_list_no, wave_id (FK fulfillment_waves.id), status (Pending/Picking/Picked)

pick_list_items
    id, pick_list_id, order_id, product_id, quantity_to_pick, quantity_picked, status

shipment_packages
    id, package_no, order_id, wave_id, carrier, tracking_no, weight_kg, shipping_cost, status, dispatch_date
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/sales/orders` | Create customer sales order |
| `GET` | `/api/v1/sales/orders` | List customer sales orders |
| `POST` | `/api/v1/sales/orders/{id}/confirm` | Confirm order & reserve stock |
| `POST` | `/api/v1/sales/fulfillment/waves` | Generate wave pick list for orders |
| `POST` | `/api/v1/sales/fulfillment/pack` | Create packed shipment package |
| `POST` | `/api/v1/sales/fulfillment/dispatch/{package_id}` | Dispatch parcel & deduct stock |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_create_and_confirm_sales_order_reserves_stock` | **PASSED** |
| 2 | `test_insufficient_stock_rejects_confirmation` | **PASSED** |
| 3 | `test_fulfillment_wave_groups_orders_into_pick_list` | **PASSED** |
| 4 | `test_pack_shipment_package` | **PASSED** |
| 5 | `test_dispatch_shipment_deducts_inventory_stock` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_sales_fulfillment` | **PASSED** |

**Overall Result: 58/58 PASSED across complete procurement, receiving, and sales fulfillment stack**

**Verification Status: Done**
