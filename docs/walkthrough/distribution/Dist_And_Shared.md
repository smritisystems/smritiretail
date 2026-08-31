<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Unified Shared Business Engines (Section 7) & Distribution Core (Section 8)

## 1. Purpose
This document establishes the implementation, database convergence, and test verification for SMRITI Retail OS Shared Business Engines (Pricing, Volume Breaks, Customer Tiers, GST Calculation Policy) and Distribution Operations (Territories, Dealer Assignments, Primary/Secondary Distribution Orders, Delivery Challan Dispatches, and Authoritative Outward Stock Movements).

## 2. Scope
- **Section 7 Shared Business Engines:**
  - `PricingEngine` supporting baseline item prices, price books (`STANDARD`, `WHOLESALE`, `DEALER`), volume discount break points, and customer price tier percentage modifiers.
  - Statutory GST Tax Policy evaluation (CGST/SGST intrastate vs IGST interstate) with deterministic decimal arithmetic.
- **Section 8 Distribution Core:**
  - Forward-only database migration `v1365_distribution_core` establishing `distribution_territories`, `dealer_assignments`, `distribution_orders`, and `distribution_order_items`.
  - Service layer `DistributionService` covering territory hierarchy, dealer territorial assignments, credit limits, distribution order lifecycle, and delivery challan dispatching.
  - Authoritative inventory integration writing `StockMovement` (OUTWARD_SALE) on order dispatch.
  - Transaction reproducibility version snapshotting (`governance_snapshot_id`, `rule_snapshots`).
- **REST API Endpoints:**
  - `/api/v1/distribution/territories`
  - `/api/v1/distribution/dealers/assign`
  - `/api/v1/distribution/orders`
  - `/api/v1/distribution/orders/{order_id}/dispatch`

## 3. Files Created
- `backend/app/models/distribution.py`: SQLAlchemy database models for territories, dealer assignments, distribution orders, and line items.
- `backend/alembic/versions/v1365_distribution_core.py`: Forward-only migration creating distribution tables with `BaseEntity` contract.
- `backend/app/services/pricing_engine.py`: Unified pricing resolver for price books, volume breaks, and customer tiers.
- `backend/app/services/distribution_svc.py`: Distribution business engine handling orders, credit checks, and stock movement dispatch.
- `backend/app/api/v1/distribution.py`: FastAPI REST API endpoints for distribution domain.
- `backend/tests/t_dist_pricing.py`: Automated pytest verification suite covering pricing breaks, distribution orders, stock movements, and API endpoints.

## 4. Files Modified
- `backend/app/models/__init__.py`: Exported Distribution models (`DistributionTerritory`, `DealerAssignment`, `DistributionOrder`, `DistributionOrderItem`).
- `backend/app/main.py`: Registered `distribution.router` under prefix `/api/v1/distribution`.
- `backend/alembic/versions/v1364_party_item_snapshots.py`: Added clean-slate table creation for Universal Party, Item, and Pricing models.
- `backend/tests/t_tenant_migr.py`: Added distribution tables and head revision assertion for `v1365_distribution_core`.

## 5. Architecture Decisions
- **ADR-DIST-001 (Unified Order Structure):** Primary (Manufacturer to Distributor) and Secondary (Distributor to Retailer) flows use a single canonical `DistributionOrder` entity differentiated by `order_type`, avoiding duplicate schemas while isolating operational flows.
- **ADR-DIST-002 (Authoritative Stock Ledger on Dispatch):** Outward stock movements are immutably posted at the exact moment of distribution order dispatch with unique delivery challan reference numbers (`DC-XXXX`).

## 6. Design Rationale
- **Decoupled Pricing Resolution:** Pricing logic resolves dynamically across multiple layers (base item price -> price book volume tier -> customer tier discount) without mutating master catalog data.
- **Immutable Transaction Snapshots:** Each distribution order captures an exact JSONB snapshot of the rule and tax policy versions active at creation time (`rule_snapshots`), satisfying Section 1.5 governance requirements.

## 7. Implementation Summary
- Applied `v1365_distribution_core` forward migration across `smritisys`, `smriti001`, and `smriti002`.
- Implemented `PricingEngine.calculate_effective_price` with quantity-based volume break lookup.
- Implemented `DistributionService.create_distribution_order` and `DistributionService.dispatch_distribution_order`.
- Added comprehensive unit and integration tests.

## 8. Tests Executed
```bash
python -m pytest tests/t_dist_pricing.py tests/t_univ_converge.py tests/t_gov_logic.py tests/t_menu_registry.py tests/t_cap_registry.py tests/t_ref_data_loc.py tests/t_tenant_migr.py tests/t_pricing_eng.py tests/t_sales_ledger.py tests/t_unified_ledger.py tests/t_pos_shift_gl.py -v --tb=short
```

## 9. Verification Results
- **11 Domain Suites Executed:** 73 passed, 0 failed, 19 deprecation warnings in 69.03s.
- **Distribution & Pricing Suite:** 4 passed, 0 failed.
- **Ephemeral Tenant Clean-Slate Harness:** 6 passed, 0 failed.

## 10. Known Limitations
- Warehouse routing in distribution currently resolves default storage locations; advanced bin-level allocation will integrate with WMS in Section 9.

## 11. Future Work
- Integration of Distribution Orders with NIC E-Way Bill generating pipelines (Section 9).
- Offline-first caching for mobile salesman order booking app.

## 12. Related ADRs
- `ADR-DIST-001`: Universal Distribution Order Model
- `ADR-DIST-002`: Authoritative Stock Dispatch Boundary

## 13. Related RFCs
- `RFC-DIST-2026-01`: Distribution Management & Commercial Growth Engine
