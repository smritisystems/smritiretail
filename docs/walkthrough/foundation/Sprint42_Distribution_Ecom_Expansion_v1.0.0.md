<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Sprint 42 — Section 8 Distribution Core & eCommerce Expansion

## 1. Purpose
This walkthrough documents the end-to-end design, implementation, and certification of Blueprint Section 8: **P2 Distribution and eCommerce Expansion**. It establishes authoritative multi-tier wholesale distribution workflows (primary vs secondary orders, route-based dispatch, loading sheet aggregation, claims, and financial settlements) alongside pluggable omnichannel eCommerce adapters (Shopify, WooCommerce, Amazon, Flipkart, Internal Store, Customer Portal) with zero-drift stock reservation and financial reconciliation.

## 2. Scope
- **Distribution Core**:
  - Territory and dealer assignments with credit limit and credit days enforcement.
  - Delivery routes with ordered sequence retailer drop stops and GPS geocoordinates.
  - Dual-mode Primary (HQ to Distributor) and Secondary (Distributor to Retailer) distribution orders with statutory GST place-of-supply calculations and governance snapshot IDs.
  - Multi-order vehicle loading sheet consolidation advancing to `LOADED`.
  - Dealer claims workflow with dispute reason adjudication and authoritative Credit Note generation (`CN-YYYYMMDD-HEX`).
  - Driver trip route settlement balancing Cash, Cheque, UPI, Credit, and Returned Stock against loaded sheet value.
- **eCommerce Omnichannel Engine**:
  - 6 Pluggable Marketplace Adapters (`Internal Store`, `Shopify`, `WooCommerce`, `Amazon SP-API`, `Flipkart`, `Customer Portal`).
  - Strict HMAC SHA-256 webhook signature validation across all external channels.
  - Idempotent order deduplication (`{channel_code}_{external_order_id}`).
  - Atomic stock reservation via `SELECT FOR UPDATE` row locks preventing overselling.
  - Asynchronous order convergence transforming imported payloads into authoritative SMRITI `SalesInvoice` records with trigger-managed stock movements.
  - Dead Letter Queue (DLQ) retry cycle with exponential backoff (`max_retries = 3`).
  - Channel revenue reconciliation ledger computing GMV discrepancies and commission variances.

## 3. Files Created
- [`backend/app/models/ecom.py`](file:///F:/SMRITRretailNX/backend/app/models/ecom.py) — PostgreSQL models: `EcomChannel`, `EcomSkuMapping`, `EcomOrderImport`, `EcomStockSyncLog`, `EcomReconciliation`.
- [`backend/app/schemas/distribution.py`](file:///F:/SMRITRretailNX/backend/app/schemas/distribution.py) — Pydantic schemas for territories, dealer assignments, routes, loading sheets, claims review, and route settlements.
- [`backend/app/schemas/ecom.py`](file:///F:/SMRITRretailNX/backend/app/schemas/ecom.py) — Pydantic schemas for channels, SKU mappings, webhook payloads, order convergence, DLQ retry, and reconciliations.
- [`backend/app/services/ecom_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/ecom_engine.py) — Marketplace adapters, signature verifiers, idempotency guards, atomic reservation, order convergence, DLQ retries, and reconciliation.
- [`backend/tests/t_distribution.py`](file:///F:/SMRITRretailNX/backend/tests/t_distribution.py) — 7 integration tests for distribution lifecycle.
- [`backend/tests/t_ecom_connect.py`](file:///F:/SMRITRretailNX/backend/tests/t_ecom_connect.py) — 7 integration tests for eCommerce connector suite.

## 4. Files Modified
- [`backend/app/models/distribution.py`](file:///F:/SMRITRretailNX/backend/app/models/distribution.py) — Added `DistributionRoute`, `RouteStop`, `LoadingSheet`, `LoadingSheetItem`, `DistributionClaim`, `DistributionSettlement`.
- [`backend/app/services/distribution_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/distribution_svc.py) — Added route planning, stop ordering, loading sheet aggregation, claim credit notes, and trip settlement.
- [`backend/app/api/v1/distribution.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/distribution.py) — Mounted distribution routes, loading sheets, claims review, and trip settlements.
- [`backend/app/api/v1/ecom.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/ecom.py) — Implemented Section 8 eCommerce REST API endpoints.
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py) — Registered `ecom.router` under `/api/v1/ecom`.
- [`backend/tests/t_dist_pricing.py`](file:///F:/SMRITRretailNX/backend/tests/t_dist_pricing.py) — Standardized async HTTP client and models.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Certified Section 8 as `Done / Verified` per Rule 11.

## 5. Architecture Decisions
- **ADR-ECOM-001: Adapters Without Duplicate Authority**: External channels (Shopify, Amazon, Flipkart) act purely as intake channels. Authoritative inventory and financial ledger records reside strictly in SMRITI PostgreSQL (`products`, `sales_invoices`, `stock_movements`).
- **ADR-DIST-001: Dual-Mode Order Segregation**: Primary distribution orders (HQ to Distributor) and Secondary distribution orders (Distributor to Retailer) share the canonical `DistributionOrder` schema with distinct billing and credit validations.
- **ADR-RES-001: Two-Phase Inventory Reservation**: Inbound eCommerce orders immediately reserve stock via `Product.reserved_stock` using `with_for_update()`. Upon convergence to `SalesInvoice`, the reservation is released and converted to outward stock movement.

## 6. Design Rationale
- **Atomic Concurrency Protection**: High-volume sales events across multi-channel marketplaces require row-level database locking to eliminate overselling without external distributed lock managers.
- **Postgres Trigger Cohesion**: Utilizing the established `trg_inventory_state_reconciliation` trigger on `stock_movements` guarantees that ledger inserts and physical stock balances stay synchronized automatically.

## 7. Implementation Summary
- **Distribution DDL & Engine**: Multi-tenant schema migration across `smriti001` and `smriti002` adding routes, stops, loading sheets, claims, and settlements.
- **eCommerce Adapters & Routers**: Implemented 6 marketplace adapters with HMAC SHA-256 signature verification, inbound payload normalization, and REST endpoints for webhook ingress, order convergence, DLQ management, and channel financial reconciliation.

## 8. Tests Executed
```powershell
python -m pytest tests/t_distribution.py tests/t_dist_pricing.py tests/t_ecom_connect.py tests/t_ecom_webhooks.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
collected 23 items

tests/t_distribution.py::test_territory_and_dealer_assignment_lifecycle PASSED [  4%]
tests/t_distribution.py::test_route_and_route_stops_ordered_sequence PASSED [  8%]
tests/t_distribution.py::test_primary_and_secondary_distribution_orders_gst PASSED [ 13%]
tests/t_distribution.py::test_loading_sheet_aggregation_and_order_status_progression PASSED [ 17%]
tests/t_distribution.py::test_claims_submission_review_and_credit_note_generation PASSED [ 21%]
tests/t_distribution.py::test_route_trip_financial_and_stock_settlement PASSED [ 26%]
tests/t_distribution.py::test_api_distribution_endpoints PASSED          [ 30%]
tests/t_dist_pricing.py::test_unified_pricing_engine_volume_breaks_and_tiers PASSED [ 34%]
tests/t_dist_pricing.py::test_distribution_order_creation_gst_and_governance_snapshots PASSED [ 39%]
tests/t_dist_pricing.py::test_distribution_order_dispatch_and_authoritative_stock_movement PASSED [ 43%]
tests/t_dist_pricing.py::test_api_distribution_endpoints PASSED          [ 47%]
tests/t_ecom_connect.py::test_ecom_channel_configuration_and_sku_mapping PASSED [ 52%]
tests/t_ecom_connect.py::test_hmac_signature_verification_across_adapters PASSED [ 56%]
tests/t_ecom_connect.py::test_inbound_order_deduplication_and_stock_reservation PASSED [ 60%]
tests/t_ecom_connect.py::test_insufficient_stock_failure_and_dlq_retries PASSED [ 65%]
tests/t_ecom_connect.py::test_order_convergence_to_sales_invoice PASSED  [ 69%]
tests/t_ecom_connect.py::test_channel_financial_reconciliation PASSED    [ 73%]
tests/t_ecom_connect.py::test_api_ecom_endpoints PASSED                  [ 78%]
tests/t_ecom_webhooks.py::test_resolver_omits_credentials_and_connection_urls PASSED [ 82%]
tests/t_ecom_webhooks.py::test_ecom_webhook_ingress_requires_authentication PASSED [ 86%]
tests/t_ecom_webhooks.py::test_ecom_shopify_webhook_hmac_verification_and_idempotency PASSED [ 91%]
tests/t_ecom_webhooks.py::test_ecom_woocommerce_webhook_signature_and_cross_company_denial PASSED [ 95%]
tests/t_ecom_webhooks.py::test_production_security_configuration_fails_closed PASSED [100%]

====================== 23 passed, 13 warnings in 17.93s =======================
```

## 10. Known Limitations
- External marketplace REST API mocks are used for automated CI test runs. Direct production webhook callbacks require live public HTTPS tunnels or registered gateway callbacks.

## 11. Future Work
- Proceed to Sprint 43: Section 9 P2 PSV (Projected Stock Visibility), CGE (Commercial Growth Engine), and PDT (Predictive Distribution Twin) Unification.

## 12. Related ADRs
- `ADR-ECOM-001`: eCommerce Omnichannel Adapters
- `ADR-DIST-001`: Primary vs Secondary Distribution Architecture
- `ADR-RES-001`: Atomic Two-Phase Inventory Reservation

## 13. Related RFCs
- `RFC-SMRITI-2026-DIST-01`: Enterprise Distribution Management System
- `RFC-SMRITI-2026-ECOM-01`: Multi-Marketplace Omnichannel Convergence
