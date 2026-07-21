<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 9.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Inventory Control & Warehouse Management — Automated Warehouse Replenishment & Reorder Suggestions Engine
**Walkthrough Version:** v9.0.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (88/88 PASSED)

---

## 1. Purpose

Establishes the enterprise **Automated Warehouse Replenishment & Reorder Suggestions Engine** in SMRITI Retail OS. Scans product salable inventory (`stock`) and reserved quantities (`reserved_stock`) against SKU safety stock levels and reorder thresholds (`reorder_level`), dynamically resolves preferred vendor catalog sourcing and contract pricing, structures draft `ReplenishmentPlan` documents, and automatically converts approved plans into vendor-grouped draft `PurchaseOrder` records.

---

## 2. Scope

- New Alembic DDL migration: `v900_replenishment_reorder.py` — creates `replenishment_plans` and `replenishment_items` tables with full `BaseEntity` audit columns.
- Unified ORM models in `app/models/inventory.py`: `ReplenishmentPlan`, `ReplenishmentItem`.
- New `ReplenishmentEngine` domain service (`app/services/replenishment_engine.py`):
  - `generate_reorder_suggestions()`: identifies low-stock SKUs where `available_stock <= reorder_level`, calculates `suggested_qty = target_stock - available_stock`, and resolves preferred vendor & unit cost via `ProductVendor` catalog.
  - `create_replenishment_plan()`: creates a `ReplenishmentPlan` document in `Draft` status with estimated total cost.
  - `convert_plan_to_purchase_orders()`: groups replenishment plan line items by preferred vendor and creates draft `PurchaseOrder` and `PurchaseOrderItem` records, setting plan status to `Converted`.
- New REST API router: `/api/v1/inventory/replenishment` (`GET /suggestions`, `POST /plans`, `POST /plans/{id}/convert`, `GET /plans/{id}`).
- Pydantic DTO schemas: `ReorderSuggestionResponse`, `ReplenishmentPlanCreate`, `ReplenishmentPlanResponse`, `ConvertedPurchaseOrderSummary`.
- 6 integration test assertions verifying low-stock SKU detection, preferred vendor resolution, plan creation, vendor-grouped auto PO conversion, healthy stock SKU exclusion, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v900_replenishment_reorder.py` | Alembic DDL migration — creates `replenishment_plans` and `replenishment_items` tables |
| `backend/app/services/replenishment_engine.py` | ReplenishmentEngine domain service — reorder calculation, vendor resolution, plan creation, and auto PO conversion |
| `backend/app/schemas/replenishment.py` | Pydantic DTO schemas for reorder suggestions, replenishment plans, and PO summaries |
| `backend/app/api/v1/replenishment.py` | REST API gateway: `/inventory/replenishment/suggestions`, `/inventory/replenishment/plans`, `/inventory/replenishment/plans/{id}/convert` |
| `backend/app/tests/test_replenishment.py` | 6 integration test assertions for automated warehouse replenishment and reorder engine |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/inventory.py` | Added `ReplenishmentPlan` and `ReplenishmentItem` ORM models |
| `backend/app/main.py` | Imported and mounted `replenishment.router` under `/api/v1` |
| `docs/walkthrough/README.md` | Appended v9.0.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: Available Stock vs Reorder Level Evaluation
- Evaluates `available_stock = current_stock - reserved_stock`.
- If `available_stock <= reorder_level`, calculates `suggested_qty = max(1.0, target_stock - available_stock)`.

### AD-02: Supplier Grouping for Purchase Order Generation
- When converting a replenishment plan, items are grouped by `preferred_vendor_id`. A separate draft `PurchaseOrder` is generated per vendor with vendor-specific lines.

---

## 6. Implementation Summary

### Database Schema

```text
replenishment_plans
    id, uuid, tenant_id, company_id, branch_id, plan_no, name, plan_date,
    status (Draft/Converted/Cancelled), total_items, total_estimated_cost, notes

replenishment_items
    id, uuid, tenant_id, company_id, branch_id, plan_id, product_id, preferred_vendor_id,
    current_stock, reorder_level, suggested_qty, unit_price, line_total, purchase_order_id, status (Pending/Converted)
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `GET` | `/api/v1/inventory/replenishment/suggestions` | Generate live reorder suggestions |
| `POST` | `/api/v1/inventory/replenishment/plans` | Create draft replenishment plan |
| `POST` | `/api/v1/inventory/replenishment/plans/{id}/convert` | Convert plan to vendor-grouped Purchase Orders |
| `GET` | `/api/v1/inventory/replenishment/plans/{id}` | Get replenishment plan details |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py app/tests/test_sales_invoicing.py app/tests/test_sales_return.py app/tests/test_stock_audit.py app/tests/test_stock_transfer.py app/tests/test_replenishment.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_generate_reorder_suggestions_detects_low_stock` | **PASSED** |
| 2 | `test_reorder_suggestions_vendor_contract_resolution` | **PASSED** |
| 3 | `test_create_replenishment_plan` | **PASSED** |
| 4 | `test_convert_plan_to_purchase_orders_groups_by_vendor` | **PASSED** |
| 5 | `test_sufficient_stock_skus_excluded_from_reorder` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_replenishment` | **PASSED** |

**Overall Result: 88/88 PASSED across complete procurement, receiving, sales fulfillment, invoicing, returns, stock audit, stock transfer, and replenishment stack**

**Verification Status: Done**
