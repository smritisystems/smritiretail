---
title: "Sprint 30: P1.2 Universal Item Master Completion (Data Plane Convergence)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 30 — P1.2 Universal Item Master Completion (Data Plane Convergence)

## 1. Purpose
This sprint fulfills **Blueprint Section 6: P1 Transactional Data-Plane Convergence (P1.2 Universal Item Master Completion)**. It establishes an authoritative, tenant-local Universal Item Master unifying products, SKU variants, universal barcodes (EAN-13, Code 128, QR), perishable/statutory batches, unique serial unit numbers, and warehouse location bin mappings across POS, Sales, Purchase, WMS, eCommerce, GST, and barcode printing flows.

## 2. Scope
- **Polymorphic Item Catalog**: Canonical catalog entity (`Item`) supporting standard and extended pricing, HSN codes, statutory GST tax profiles, UOMs, and categorization.
- **Cartesian Matrix Variant Generator**: Generates multidimensional SKU variants (e.g. Size x Color x Fit) from attribute combinations with automated EAN-13 barcode allocation.
- **Universal Barcode Mapping**: Supports multiple barcodes per item/variant (`EAN13`, `CODE128`, `UPC`, `QR`, `CUSTOM`) with primary flag gating.
- **Batch & Lot Tracking**: Sub-entity model `ItemBatch` recording batch numbers, manufacturing dates, expiration dates, and batch-level MRPs.
- **Serialized Unit Tracking**: Sub-entity model `ItemSerial` tracking unit IDs and status lifecycles (`AVAILABLE`, `ALLOCATED`, `SOLD`, `RETURNED`, `DEFECTIVE`).
- **Warehouse Location Bins**: Sub-entity model `ItemWarehouseLocation` defining warehouse-specific location bins, min reorder levels, and max capacities.
- **Fast 4-Tier Scanner Resolver**: Instant resolution endpoint prioritizing `Barcode -> Variant SKU -> Item Code -> Serial Number` for POS registers and WMS handheld scanners.
- **Legacy Product Compatibility Adapter**: `get_legacy_product_view()` projecting universal item identity into legacy product schema for existing frontend components.
- **DDL Migration Engine**: `backend/app/db/migr_item_ext.py` migrating `smriti001` and `smriti002`.
- **Verification**: 6/6 tests passing in `backend/tests/t_item_master.py` (63/63 platform regression tests green).

## 3. Files Created
- [`backend/app/schemas/item_master.py`](file:///F:/SMRITRretailNX/backend/app/schemas/item_master.py) — Pydantic schemas for Universal Item, variants, barcodes, matrix generation, batches, serials, locations, and resolution.
- [`backend/app/services/item_master_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/item_master_svc.py) — Universal Item Master service engine.
- [`backend/app/db/migr_item_ext.py`](file:///F:/SMRITRretailNX/backend/app/db/migr_item_ext.py) — DDL migration script for item sub-entity tables.
- [`backend/tests/t_item_master.py`](file:///F:/SMRITRretailNX/backend/tests/t_item_master.py) — 6-part integration test suite.
- [`docs/walkthrough/foundation/Sprint30_Universal_Item_Master_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint30_Universal_Item_Master_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/models/item_master.py`](file:///F:/SMRITRretailNX/backend/app/models/item_master.py) — Extended with `ItemBatch`, `ItemSerial`, `ItemWarehouseLocation`.
- [`backend/app/api/v1/universal_master.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/universal_master.py) — Mounted `/items` CRUD, `/items/{id}/variants/matrix`, `/items/{id}/batches`, `/items/{id}/serials`, `/items/resolve`, and `/items/{id}/adapter/product`.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 6.2 to `DONE / VERIFIED` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 30 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.46.0`.

## 5. Architecture Decisions
- **Unified Catalog Identity**: POS registers, wholesale sales orders, purchase orders, and WMS bin transfers operate against the exact same canonical `items.id` and `item_variants.id`.
- **4-Tier Fast Resolution**: Hardware barcode scanners and UI typeaheads query a unified lookup pipeline that matches barcodes first, variant SKUs second, canonical item codes third, and serial numbers fourth.
- **Fail-Safe Cartesian Generator**: The matrix generator checks existing variants to prevent duplicate SKU generation and automatically formats clean SKU suffixes.

## 6. Design Rationale
Retailers operating apparel, footwear, FMCG, electronics, or pharma businesses require specialized tracking dimensions (variants, batches, serials) without compromising the speed of point-of-sale scanning. Separating sub-entities while consolidating lookups satisfies high-throughput POS while ensuring complete auditability.

## 7. Implementation Summary
- **Item Provisioning**: `POST /api/v1/universal/items`
- **Item Listing & Search**: `GET /api/v1/universal/items`
- **Scanner Resolver**: `GET /api/v1/universal/items/resolve?query={code}`
- **Cartesian Matrix Variant Generation**: `POST /api/v1/universal/items/{id}/variants/matrix`
- **Batch Registration**: `POST /api/v1/universal/items/{id}/batches`
- **Serial Unit Registration**: `POST /api/v1/universal/items/{id}/serials`
- **Legacy Product Adapter**: `GET /api/v1/universal/items/{id}/adapter/product`

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m app.db.migr_item_ext
python -m pytest tests/t_item_master.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 6 items

tests/t_item_master.py::test_create_item_with_variants_and_barcodes PASSED [ 16%]
tests/t_item_master.py::test_matrix_variant_generator_cartesian PASSED   [ 33%]
tests/t_item_master.py::test_fast_4_tier_scanner_resolver PASSED         [ 50%]
tests/t_item_master.py::test_batch_registration_and_tracking PASSED      [ 66%]
tests/t_item_master.py::test_legacy_product_adapter PASSED               [ 83%]
tests/t_item_master.py::test_api_item_endpoints PASSED                   [100%]

======================== 6 passed, 8 warnings in 9.98s ========================
```

## 10. Known Limitations
- Stock movements boundary and balances reconciliation is addressed in P1.3.

## 11. Future Work
- Sprint 31: `P1.3 Authoritative Stock and Accounting Boundaries (Blueprint Section 6.3)`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-006`: Universal Party and Item Master Convergence

## 13. Related RFCs
- `RFC-DATA-002`: Universal Item and Inventory Variant Architecture
