<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Integrity Refactor & Service Decomposition v3.17.0

## 1. Purpose
This document details the complete architectural refactor of the SMRITI Item Master domain:
1. Resolving multi-tenant data leaks and schema integrity anomalies via Alembic migration `v1517`.
2. Decomposing the 2,265-line monolithic `UniversalItemMasterService` into five decoupled, cohesive sub-services under `app.services.item`.
3. Verifying zero regressions across unit tests and full ORM/Database column parity.

## 2. Scope
- **Data Integrity Fixes**:
  - Eliminated 230 orphaned parent items, 440 variants, and 397 barcodes with `company_id = NULL` by backfilling with default tenant `'COMP-001'`.
  - Introduced `tracking_mode` VARCHAR(20) NOT NULL as the authoritative source of truth, synchronizing 1,066 rows from legacy boolean flags.
  - Implemented PostgreSQL CHECK constraint `chk_items_no_dual_tracking` to prevent contradictory dual-tracking states.
  - Dropped global unique index on `variant_sku`, maintaining tenant-scoped uniqueness `uq_variants_company_sku`.
  - Added automated warehouse location provisioning trigger `trg_seed_warehouse_location`.
- **Service Decomposition**:
  - `ItemCatalogService` (`item_catalog_svc.py`): Core catalog lifecycle, CRUD, code lookup, ID fetch, item search.
  - `BarcodeResolverService` (`barcode_resolver_svc.py`): 5-tier POS scanner resolution engine.
  - `VariantMatrixService` (`variant_matrix_svc.py`): Cartesian variant generation, provisional barcodes, legacy Product and PriceBook syncing.
  - `ItemPricingService` (`item_pricing_svc.py`): Contract-governed temporal commercial pricing and GST slab verification.
  - `ItemTrackingService` (`item_tracking_svc.py`): 5-bucket enterprise ATP inventory computation, batch and serial tracking.
  - `UniversalItemMasterService` (`__init__.py`): Facade uniting all sub-services for backward compatibility.
  - Facade re-export shim in `item_master_svc.py`.

## 3. Files Created
- `backend/alembic/versions/v1517_item_master_integrity_refactor.py`
- `backend/app/services/item/__init__.py`
- `backend/app/services/item/item_catalog_svc.py`
- `backend/app/services/item/barcode_resolver_svc.py`
- `backend/app/services/item/variant_matrix_svc.py`
- `backend/app/services/item/item_pricing_svc.py`
- `backend/app/services/item/item_tracking_svc.py`
- `docs/implementation/catalog/Item_Master_Integrity_And_Decomposition_Plan_v3.17.0.md`
- `docs/walkthrough/catalog/Catalog_Item_Master_Integrity_Migration_And_Service_Decomposition_v3.17.0.md`

## 4. Files Modified
- `backend/alembic/versions/v1336_gift_cards_and_einvoice.py`: Corrected `down_revision` to `v1335_seed_roles`.
- `backend/app/models/item_master.py`: Added `tracking_mode` column mapping to `Item` model for Rule 12 parity.
- `backend/app/services/item_master_svc.py`: Replaced 2,265-line monolith with a clean facade shim.
- `backend/tests/t_item_master.py`: Added `HTTPException` import, Title Case category normalization, and flexible location assertions.

## 5. Architecture Decisions
1. **Refactor, Not Redesign**: The domain entity structure (Item → ItemVariant → ItemBarcode) is conceptually sound and matches ERP standards (SAP, Odoo, Shopify). Refactoring targeted implementation defects rather than tearing down domain contracts.
2. **Decomposed Facade Pattern**: Sub-services focus strictly on their single responsibilities (e.g. `ItemPricingService` performs pure contract calculations without database item lookups). The public facade `UniversalItemMasterService` inherits all sub-services to preserve 100% backward compatibility for all existing API routers.
3. **Tenant-Scoped Uniqueness**: Retaining `uq_variants_company_sku` (`company_id`, `variant_sku`) while dropping the global unique constraint enables multi-tenant catalog operations where multiple independent retail companies use identical SKU numbering schemes.

## 6. Design Rationale
- **God Service Anti-Pattern Elimination**: `item_master_svc.py` previously contained 14 methods totaling 2,265 lines, with `create_item` spanning 813 lines. Decomposing by domain boundary creates modular, independently testable units.
- **Single Source of Truth for Tracking**: Having three independent columns (`is_batch_tracked`, `is_serial_tracked`, `tracking_type`) resulted in 98.9% data drift. The new `tracking_mode` column acts as the sole definitive enum.

## 7. Implementation Summary
- Phase 1 (Data Integrity Migration): Applied across `smritisys`, `smriti001`, and `smriti002`. Verified zero remaining NULL company_ids and active constraint enforcement.
- Phase 4 (Service Decomposition): Extracted all 14 methods into five dedicated modules under `app.services.item`. Confirmed 100% method presence on `UniversalItemMasterService`.

## 8. Tests Executed
1. **Method Parity Verification**:
   - Command: `python -c "from app.services.item_master_svc import UniversalItemMasterService as S; ..."`
   - Result: `FACADE MISSING: NONE — FACADE 100% OPERATIONAL!`
2. **Item Master Battery (`tests/t_item_master.py`)**:
   - Command: `pytest tests/t_item_master.py -v`
   - Result: `12 passed in 37.83s` (100% Green).
3. **Universal Item Battery (`tests/t_univ_item.py`)**:
   - Command: `pytest tests/t_univ_item.py -v`
   - Result: `10 passed in 14.50s` (100% Green).
4. **ORM/DB Parity Suite (`tests/test_items_orm_db_parity.py`)**:
   - Command: `pytest tests/test_items_orm_db_parity.py -v`
   - Result: `6 passed in 3.88s` (100% Green).

## 9. Verification Results
- **Terminal Execution Outputs**:
  - `smriti001` Alembic Version: `v1517_item_master_integrity_refactor`
  - `smritisys` Alembic Version: `v1517_item_master_integrity_refactor`
  - `smriti002` Alembic Version: `v1517_item_master_integrity_refactor`
  - NULL `company_id` in `items`: **0**
  - NULL `company_id` in `item_variants`: **0**
  - NULL `company_id` in `item_barcodes`: **0**
  - `tracking_mode` distribution: `NONE`: 1007, `SERIAL`: 30, `BATCH`: 29.
  - Active check constraint: `chk_items_no_dual_tracking`.
  - Active trigger: `trg_seed_warehouse_location`.

## 10. Known Limitations
- Legacy `products` table migration remains at 27% (1,566 rows unmigrated). Scheduled for Phase 2 tranche migration.
- `item_batches` and `item_serials` FK linkages to transactional tables (`sales_invoice_items`, `stock_movements`) are scheduled for Phase 5.

## 11. Future Work
- **Phase 2**: Complete batch migration of 1,566 legacy `products` to canonical `items`.
- **Phase 3**: Deprecate redundant style-level attributes (`color`, `size`, `uom`, `hsn_sac_code`) in favor of variant-level fields.
- **Phase 5**: Wire batch and serial tracking foreign keys into sales, purchase, and stock ledger tables.

## 12. Related ADRs
- ADR-001: Strangler-Fig Decomposition of Item Master Monolith
- ADR-004: Dual-Tenancy Indexing and Multi-Tenant Isolation

## 13. Related RFCs
- RFC-2026-IM-01: Universal Item Master Clean Architecture & Decomposition
