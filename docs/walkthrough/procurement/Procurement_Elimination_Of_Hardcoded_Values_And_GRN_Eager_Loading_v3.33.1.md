<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.33.1
  * Created    : 2026-09-20
  * Modified   : 2026-09-20
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Elimination of Hardcoded Values & GRN Studio Eager Loading

## 1. Purpose
To eradicate all legacy in-memory and hardcoded mock data structures, static margin estimation heuristics, static branch strings, and hardcoded tax jurisdictions from the Procurement module, replacing them with dynamic multi-tier PostgreSQL queries, and resolving the HTTP 500 error on `GET /api/v1/purchase/receipts/` in the Goods Receipt Note (GRN) Studio through explicit SQLAlchemy async eager loading (`selectinload`).

## 2. Scope
- Backend Purchase Service (`backend/app/services/purchase.py`).
- Backend Purchase API Router (`backend/app/api/v1/purchase.py`).
- Landed Cost Verification Script (`scripts/verify_inward_landed_cost_engine.py`).
- Go-Live Phase 3 Automated Suite (`backend/app/tests/test_golive_phase3.py`).

## 3. Files Created
*No new files created.*

## 4. Files Modified
- [`backend/app/services/purchase.py`](file:///f:/SMRITRretailNX/backend/app/services/purchase.py)
- [`backend/app/api/v1/purchase.py`](file:///f:/SMRITRretailNX/backend/app/api/v1/purchase.py)
- [`scripts/verify_inward_landed_cost_engine.py`](file:///f:/SMRITRretailNX/scripts/verify_inward_landed_cost_engine.py)
- [`CHANGELOG.md`](file:///f:/SMRITRretailNX/CHANGELOG.md)
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md)

## 5. Architecture Decisions
1. **Complete Eradication of `REORDER_SPECS`**: The static dictionary mapping mock keys `"p1"`..`"p10"` to suppliers `"sup-1"`..`"sup-3"` was completely removed. Reorder thresholds are now queried dynamically in order:
   - Primary: `PurchaseReorderConfig` (`purchase_reorder_configs` table in PostgreSQL).
   - Secondary: `ItemWarehouseLocation` (`item_warehouse_locations` table).
   - Tertiary: `Product.attributes` JSON in PostgreSQL.
2. **Database Sourcing for Reorder Rate Suggestions**: Replaced arbitrary 40% margin calculation `prod.price * 0.6` with:
   - Prior confirmed Purchase Order item `cost_price` for that supplier and product.
   - `Product.cost_price` from the database.
   - `Product.buying_price` from the database.
   - `ProductCostValuation` from the database.
3. **Dynamic Database Branch Resolution**: Replaced static fallback string `"BR-MAIN-001"` with `get_effective_branch_id()`, querying the `branches` table in PostgreSQL for the active branch of the company.
4. **Dynamic Company Tax Jurisdiction Resolution**: Replaced static state `"DL"` with `get_jurisdiction()`, querying `PurchaseJurisdictionConfig` and `Company.gst_number` prefix via `GST_STATE_CODES`.
5. **SQLAlchemy Async Eager Loading**: In `list_purchase_receipts()` and `get_purchase_receipt()`, pre-loaded relationships `items` and `cost_components` using `.options(selectinload(PurchaseReceipt.items), selectinload(PurchaseReceipt.cost_components))`. This prevents `MissingGreenlet` exceptions during Pydantic serialization when responding to `GET /api/v1/purchase/receipts/`.

## 6. Design Rationale
- SMRITI Retail OS is an enterprise retail ERP backed strictly by PostgreSQL as its sole system of record. Hardcoded dictionaries from legacy Express prototypes violated this policy and prevented real database products from participating in automated reorder calculations.
- In async SQLAlchemy, accessing relationships on an ORM model without explicit `selectinload` when building Pydantic response models with `from_attributes=True` raises `MissingGreenlet` exceptions, causing HTTP 500 errors in browser clients like the Goods Receipt Note Studio.

## 7. Implementation Summary
- Deleted `REORDER_SPECS` definition and reference in `backend/app/services/purchase.py`.
- Replaced `list_reorder_suggestions()` specification lookup with hierarchical DB queries.
- Added `get_effective_branch_id()` and converted synchronous callers to async DB queries.
- Updated `get_jurisdiction()` to query `Company` GSTIN from PostgreSQL.
- Corrected column names in `get_supplier_default_rate()` (`receipt_id`, `order_id`, `cost_price`) and added Product Master fallback.
- Added `selectinload` for `items` and `cost_components` on `PurchaseReceipt`.
- Updated `verify_inward_landed_cost_engine.py` to ensure tenant-scoped supplier lookups.

## 8. Tests Executed
1. `pytest backend/app/tests/test_golive_phase3.py -v` (6/6 tests passed).
2. `python scripts/verify_inward_landed_cost_engine.py` (6/6 steps passed).
3. `npm run lint` (`tsc --noEmit`) (0 errors).
4. `python scripts/architecture_duplication_gate.py` (11/11 checks passed, 0 debt).

## 9. Verification Results
- `GET /api/v1/purchase/receipts/` serializes all existing receipts with 0 errors and zero HTTP 500 responses.
- `list_reorder_suggestions()` operates 100% against PostgreSQL database tables with no static dict dependencies.
- All Phase 3 test cases (`test_grn_receipt_flow`, `test_purchase_bill_from_grn`, `test_debit_note_creation`, `test_sales_return_credit_note`, `test_eway_bill_dispatch_record`, `test_kpi_endpoints_live`) passed 100% green.

## 10. Known Limitations
None.

## 11. Future Work
Expand machine-learning-driven dynamic safety stock recommendations once historical transaction volume is populated.

## 12. Related ADRs
- `ADR-042`: SMRITI Canonical Parameter Namespace.
- `ADR-038`: SMRITI Unified Identity Control Plane.

## 13. Related RFCs
- `RFC-009`: Inward Landed Cost & Freight Allocation Engine.
