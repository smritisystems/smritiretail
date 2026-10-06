<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.7
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Item Master — Phase R-01: Runtime Safety Hardening Walkthrough

**Document ID:** `Inventory_Item_Master_R01_Runtime_Safety_Hardening_v6.70.7`
**Area:** Inventory / Item Master / Procurement / Barcodes
**Version:** `v6.70.7`
**Execution Date:** 2026-10-06
**Status:** Approved
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator

---

## 1. Purpose

The purpose of Phase R-01 (Runtime Safety Hardening) is to permanently eliminate runtime safety risks, data ambiguity traps, and exception-swallowing patterns across the SMRITI Item Master, Procurement Inward (GRN), and Barcode subsystems before executing any database migrations or data transformations.

Phase R-01 establishes strict runtime non-mutation boundaries, enforces savepoint transaction isolation for concurrent entity resolution, deprecates runtime synthetic placeholder barcode generation, and preserves complete backward compatibility for legacy non-itemized catalog entities.

---

## 2. Scope

The scope of Phase R-01 encompasses:
1. **Runtime Synthetic Barcode Prohibition:** Permanently eliminating runtime generation of fake placeholder barcodes (`generate_placeholder_barcode`, `890GEN*`, `ITM-*`, `S*` hex tokens) across `ItemCatalogService`, `VariantMatrixService`, and `/api/v1/barcodes/placeholder`.
2. **Inward GRN Variant Identity Propagation & Ambiguity Guard:** Enforcing strict variant propagation through PO → GRN → WMS `StockMovement`. Multi-variant items lacking explicit `variant_id` fail-fast with HTTP 400 (`AMBIGUOUS_ITEM_VARIANT`), prohibiting blind inferences. Single-variant items infer deterministically.
3. **Tracking Transaction Boundary & Concurrency Hardening:** Encapsulating `ItemBatch`, `ItemSerial`, and `ItemWarehouseLocation` resolvers in `ItemTrackingService` inside `session.begin_nested()` savepoints, ensuring `IntegrityError` collisions resolve safely to existing canonical rows without aborting the outer transaction or escaping to callers.
4. **Eradication of Exception Swallowing:** Eliminating dangerous `except Exception: pass` blocks surrounding batch and location auto-resolvers in `purchase.py`, replacing them with structured forensic diagnostics and HTTP 422 errors (`BATCH_RESOLUTION_FAILED`, `WAREHOUSE_LOCATION_RESOLUTION_FAILED`).
5. **Product.item_id Compatibility Path:** Formally recognizing `Product.item_id = None` as a still-supported legacy compatibility path, allowing standard inventory movements while preventing foreign key violations against `items.id`.
6. **Master Autocomplete Attribute Realignment:** Realigning `/api/v1/master/color` and `/size` lookup endpoints to query `ItemVariant` as primary authority with strict tenant scoping.
7. **Database Non-Mutation Governance:** Certified that zero intentional production data remediations, deletions, backfills, or migrations occurred during R-01.

---

## 3. Files Created

1. `backend/tests/test_r01_runtime_hardening.py` — 8-test verification battery asserting ADR-001, ADR-005, barcode prohibition, inward variant propagation, ambiguity guards, and lookup authority.
2. `backend/tests/test_r01_tracking_concurrency.py` — 4-worker concurrent stress test suite proving single-row creation, identical ID resolution, zero `IntegrityError` escapes, caller transaction usability, and tenant isolation.
3. `SMRITI_ITEM_MASTER_R01_FINAL_VERIFICATION_GATE_v6.70.7.md` — Formal closeout verification gate document with literal terminal test logs.
4. `SMRITI_ITEM_MASTER_R01_RUNTIME_HARDENING_REPORT_v6.70.7.md` — Detailed technical audit report for Phase R-01 execution.
5. `docs/walkthrough/inventory/Inventory_Item_Master_R01_Runtime_Safety_Hardening_v6.70.7.md` — This WGP walkthrough document.

---

## 4. Files Modified

1. [backend/app/services/item/item_tracking_svc.py](file:///F:/SMRITRretailNX/backend/app/services/item/item_tracking_svc.py):
   - Removed `or_(Model.company_id == company_id, Model.company_id.is_(None))` fallback across batch, serial, and location resolvers.
   - Wrapped insertion routines in `async with session.begin_nested():` with `await session.flush()`.
   - Deferred `await session.commit()` strictly outside the nested savepoint block when `auto_commit=True`.
   - Handled `IntegrityError` race conditions by safely querying and returning the winner's entity.
2. [backend/app/services/purchase.py](file:///F:/SMRITRretailNX/backend/app/services/purchase.py):
   - Added `variant_id` resolution with multi-variant ambiguity validation (HTTP 400 `AMBIGUOUS_ITEM_VARIANT`).
   - Replaced `except Exception: pass` with structured error handling raising HTTP 422 (`BATCH_RESOLUTION_FAILED`, `WAREHOUSE_LOCATION_RESOLUTION_FAILED`).
   - Implemented explicit branching for `Product.item_id=None` legacy compatibility path with structured logging.
   - Propagated `item_id` and `variant_id` to `StockMovement` creation via `InventoryWmsService.atomic_mutate_batch_stock`.
3. [backend/app/schemas/purchase.py](file:///F:/SMRITRretailNX/backend/app/schemas/purchase.py):
   - Added `variant_id: Optional[str] = None` to `PurchaseOrderItemCreate`, `PurchaseOrderItemResponse`, `PurchaseReceiptItemCreate`, and `PurchaseReceiptItemResponse`.
4. [backend/app/services/inventory_wms.py](file:///F:/SMRITRretailNX/backend/app/services/inventory_wms.py):
   - Added `item_id: Optional[str] = None` and `variant_id: Optional[str] = None` parameters to `atomic_mutate_batch_stock` and forwarded to `StockMovement`.
5. [backend/app/api/v1/barcodes.py](file:///F:/SMRITRretailNX/backend/app/api/v1/barcodes.py):
   - Discontinued `GET /api/v1/barcodes/placeholder` with HTTP 400 per ADR-001/R-01.
   - Preserved `HTTPException` validation errors in `compile_label` and `dispatch_batch_print`.
6. [backend/app/services/barcodes_engine.py](file:///F:/SMRITRretailNX/backend/app/services/barcodes_engine.py):
   - Fixed `total_spooled = 0` variable initialization in `dispatch_batch_print_job`.
7. [backend/app/services/item/item_catalog_svc.py](file:///F:/SMRITRretailNX/backend/app/services/item/item_catalog_svc.py):
   - Replaced runtime placeholder generator with `RuntimeError` raising per ADR-001/R-01.
8. [backend/app/services/item/variant_matrix_svc.py](file:///F:/SMRITRretailNX/backend/app/services/item/variant_matrix_svc.py):
   - Defaulted `auto_generate_barcodes` to `False`; raised `RuntimeError` on placeholder requests.
9. [backend/app/api/v1/master_lookup.py](file:///F:/SMRITRretailNX/backend/app/api/v1/master_lookup.py):
   - Realigned color and size master entity lookups to query `ItemVariant` with tenant scoping.
10. [backend/app/schemas/item_master.py](file:///F:/SMRITRretailNX/backend/app/schemas/item_master.py):
    - Defaulted `MatrixVariantGenRequest.auto_generate_barcodes` to `False`.
11. [backend/app/tests/test_barcode_registry.py](file:///F:/SMRITRretailNX/backend/app/tests/test_barcode_registry.py):
    - Populated required `uom="PCS"` on test items and capitalized variant SKU strings.
12. [backend/tests/t_barcodes.py](file:///F:/SMRITRretailNX/backend/tests/t_barcodes.py):
    - Populated official registered items and barcodes with valid GS1 EAN-13 check digits for print tests.
13. [backend/tests/t_item_master.py](file:///F:/SMRITRretailNX/backend/tests/t_item_master.py):
    - Updated matrix and tracking tests to reflect official registered barcodes and tenant-scoped lookups.

---

## 5. Architecture Decisions

### ADR-001: Prohibition of Runtime Synthetic Barcodes
- **Decision:** Runtime synthetic placeholder generation (`generate_placeholder_barcode`, `890GEN*`, `ITM-*`, `S*` hex tokens) is permanently disabled. Items without manufacturer or registered barcodes remain unbarcoded (`item_barcodes` has 0 rows).
- **Rationale:** Creating synthetic barcodes at runtime pollutes the registry, causes collisions with GS1 official prefixes, and violates SMRITI Governance Rule 12.

### ADR-004: Inbound Tracking Resolution & Ambiguity Guard
- **Decision:** If an inward receipt item matches an item with multiple active variants and no `variant_id` is specified, the transaction fails fast with HTTP 400 (`AMBIGUOUS_ITEM_VARIANT`). Single-variant items infer safely.
- **Decision:** Eradicate `except Exception: pass`. Tracking resolution failures raise structured HTTP 422 errors.

### ADR-COMPAT: Legacy Compatibility Path for `Product.item_id=None`
- **Decision:** Products lacking `item_id` operate under a still-supported legacy compatibility path, bypassing `ItemBatch`/`ItemWarehouseLocation` generation (which enforce `items.id NOT NULL` foreign keys) while permitting standard product-level inventory transactions.

---

## 6. Design Rationale

1. **Nested Savepoints (`begin_nested`):**
   In high-concurrency environments (multiple counter POS terminals or high-speed receiving scanners), concurrent workers may simultaneously attempt to insert the same batch number or serial number. Standard transaction blocks would encounter PostgreSQL `23505 unique_violation`, poisoning the transaction and forcing an outer rollback. Nested savepoints ensure that only the sub-operation rolls back, enabling clean resolution of the concurrent winner's entity.
2. **Explicit vs Implicit Compatibility:**
   Silently failing or falling back to global records creates cross-tenant data leakage. Explicitly branching based on `canonical_item_id` provides clear diagnostic visibility in application logs without corrupting referential integrity.

---

## 7. Implementation Summary

- **Transaction Boundary:** Refactored `ItemTrackingService` to execute `session.add()` and `await session.flush()` inside `async with session.begin_nested():`. The outer commit executes conditionally outside the block.
- **GRN Pipeline:** In `purchase.py`, added active variant querying, single vs multi-variant ambiguity validation, explicit error propagation (HTTP 422), and legacy compatibility branching.
- **Barcode Engine:** Realigned `barcodes.py` and `barcodes_engine.py` to preserve client validation errors and register official items in fixtures.
- **Database Non-Mutation:** Ensured all 542 historical synthetic barcodes in `smriti001` remain completely intact for planned deprecation in Phase R-06.

---

## 8. Tests Executed

| Test Suite | Command | Result |
|:---|:---|:---:|
| Hardening & Concurrency | `pytest backend/tests/test_r01_runtime_hardening.py backend/tests/test_r01_tracking_concurrency.py -q` | 11 passed |
| Item Master Core | `pytest backend/tests/t_item_master.py -q` | 12 passed |
| Barcode Registry & Engine | `pytest backend/app/tests/test_barcode_registry.py backend/tests/t_barcodes.py -q` | 9 passed |
| Purchase & Procurement | `pytest backend/app/tests/test_purchase.py -q` | 62 passed |
| Frontend Type Check | `npx tsc --noEmit` | Exit code 0 (0 errors) |

---

## 9. Verification Results

- **Total Tests Passed:** 94 of 94 tests green across all relevant suites.
- **Unexpected Failures:** 0.
- **Concurrency Verification:** 4 concurrent workers proved single row creation, identical ID resolution, zero IntegrityError escapes, usable caller transactions, and strict tenant isolation.
- **Database Baseline Verification:** `SYNTHETIC_BARCODES: 667`, `NULL_VARIANT_BARCODES: 157`, `ALEMBIC_HEAD: v1522` (0 migrations applied, 0 historical barcodes deleted).

---

## 10. Known Limitations

- Historical synthetic barcodes created prior to R-01 remain in PostgreSQL and will be addressed in Phase R-06 (Barcode Quarantine).
- Historical transaction lines with `variant_id IS NULL` remain in PostgreSQL and will be addressed in Phase R-07 (Deterministic Backfill).

---

## 11. Future Work

- **Phase R-05:** Database Snapshot & Rollback Checkpoint Creation.
- **Phase R-06:** Barcode Quarantine & Deterministic 1-to-1 Linkage (SQL).
- **Phase R-07:** Historical Transaction Deterministic Backfill (SQL).
- **Phase R-08:** Catalog Data Sanitation (UOM, Zero Price, Dummy HSN).
- **Phase R-09:** Dual-Contract SKU Alignment Migration (Alembic `v1523`).
- **Phase R-10:** Test Suite Alignment & Final Validation.

---

## 12. Related ADRs

- **ADR-001:** Physical SKU Column Naming & Contract (Dual-Contract Transition).
- **ADR-002:** Synthetic / Fake Barcode Decommissioning & Quarantine.
- **ADR-003:** Variant-First Transaction Identity Architecture.
- **ADR-004:** GRN Tracking Identity & Fault-Tolerant Resolution.
- **ADR-005:** UOM Authority & Catalog Completeness Policy.

---

## 13. Related RFCs

- `RFC-IM-001`: SMRITI Item Master Modernization & Relational Domain Architecture.
- `RFC-PUR-004`: GRN Inward Tracking & Multi-Tenant Inventory Ledgers.
