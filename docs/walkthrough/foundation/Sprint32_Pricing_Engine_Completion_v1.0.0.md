---
title: "Sprint 32: Section 7 Shared Business Engines: Pricing Engine Completion"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 32 — Section 7 Shared Business Engines: Pricing Engine Completion

## 1. Purpose
This sprint fulfills **Blueprint Section 7: P1/P2 Shared Business Engines (Pricing Engine Completion)**. It implements an authoritative, multi-tier, hierarchical Pricing Engine supporting price books across sales channels (POS, Retail, Wholesale, B2B, eCommerce), customer price tiers, volume break curves (`min_quantity`), date validity gating (`valid_from` to `valid_to`), multi-line bulk cart calculation, and immutable transaction pricing snapshot generation for zero-drift historical replay.

## 2. Scope
- **Hierarchical Price Resolution Precedence**:
  1. Price Book Entry volume break match (`quantity >= min_quantity`) with date validity gating.
  2. Customer Price Tier percentage discount modifier.
  3. ItemVariant master baseline (`ItemVariant.selling_price`).
  4. Item master baseline (`Item.selling_price`).
  5. Fallback Product master price (`Product.price`).
- **Date Validity Gating**: Active date checking (`valid_from <= as_of_date <= valid_to`); expired or future price books fall back cleanly.
- **Bulk Order / Cart Pricing**: `calculate_bulk_pricing` computes line subtotals, MRPs, total savings, and line-level custom discount percentages.
- **Immutable Transaction Snapshot**: `generate_pricing_snapshot` creates a frozen snapshot of calculations to store with Sales Invoices/Orders for replay.
- **REST Endpoints**: Mounted at `/api/v1/pricing/*`.
- **Verification**: 6/6 tests passing in `backend/tests/t_pricing_engine.py` (75/75 platform regression tests green).

## 3. Files Created
- [`backend/app/schemas/pricing.py`](file:///F:/SMRITRretailNX/backend/app/schemas/pricing.py) — Pydantic schemas for price books, volume entries, customer tiers, resolution, and snapshots.
- [`backend/app/api/v1/pricing.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/pricing.py) — REST API router for pricing operations.
- [`backend/tests/t_pricing_engine.py`](file:///F:/SMRITRretailNX/backend/tests/t_pricing_engine.py) — Integration test suite.
- [`docs/walkthrough/foundation/Sprint32_Pricing_Engine_Completion_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint32_Pricing_Engine_Completion_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/services/pricing_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/pricing_engine.py) — Full pricing engine implementation.
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py) — Mounted `/api/v1/pricing` router.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 7 Pricing Engine to `DONE / VERIFIED` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 32 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.48.0`.

## 5. Architecture Decisions
- **Strict Precedence Hierarchy**: Price points are evaluated hierarchically so custom contractual agreements or volume breaks supersede standard catalog list prices.
- **Temporal Decoupling via Snapshots**: Transactions capture complete pricing source and rule metadata so future price list updates never mutate historical financial records.

## 6. Design Rationale
Retail and wholesale operations require flexible pricing strategies (volume breaks, customer loyalty tiers, seasonal sales) while maintaining deterministic price calculation and historical replay integrity.

## 7. Implementation Summary
- **Create Price Book**: `POST /api/v1/pricing/books`
- **List Price Books**: `GET /api/v1/pricing/books`
- **Add Price Book Entry**: `POST /api/v1/pricing/books/{book_id}/entries`
- **Create Customer Tier**: `POST /api/v1/pricing/tiers`
- **List Customer Tiers**: `GET /api/v1/pricing/tiers`
- **Resolve Item Price**: `POST /api/v1/pricing/resolve`
- **Resolve Bulk Pricing**: `POST /api/v1/pricing/resolve/bulk`
- **Generate Pricing Snapshot**: `POST /api/v1/pricing/snapshot`

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/t_pricing_engine.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 6 items

tests/t_pricing_engine.py::test_base_item_and_variant_price_resolution PASSED [ 16%]
tests/t_pricing_engine.py::test_price_book_volume_breaks_resolution PASSED [ 33%]
tests/t_pricing_engine.py::test_customer_price_tier_discount_percentage PASSED [ 50%]
tests/t_pricing_engine.py::test_price_book_date_validity_gating PASSED   [ 66%]
tests/t_pricing_engine.py::test_bulk_pricing_and_transaction_snapshot PASSED [ 83%]
tests/t_pricing_engine.py::test_api_pricing_endpoints PASSED             [100%]

======================== 6 passed, 8 warnings in 9.06s ========================
```

## 10. Known Limitations
- Promotions engine (coupons, bundles, stacking rules) is addressed in Sprint 33.

## 11. Future Work
- Sprint 33: `Section 7 Promotions Engine Completion (Conditions, actions, stacking policies, coupons, bundle discounts)`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-008`: Hierarchical Price Resolution & Immutable Transaction Pricing Snapshots

## 13. Related RFCs
- `RFC-ENG-001`: Shared Business Engines & Multi-Channel Pricing Architecture
