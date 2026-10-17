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

# Implementation Plan: Item Master Integrity Refactor & Service Decomposition v3.17.0

## 1. Objective
Eliminate critical data integrity discrepancies (NULL company_id leaks, inconsistent tracking flags, global SKU uniqueness conflicts) and decompose the 2,265-line `UniversalItemMasterService` monolith into 5 focused domain sub-services following Domain-Driven Design (DDD) and Single Responsibility Principle (SRP), while preserving 100% backward-compatible API surfaces.

## 2. Business Motivation
The item master is the foundational domain entity for the entire ERP/retail operating system. Audits of live transactional data revealed:
- 230 parent items, 440 variants, and 397 barcodes with `company_id = NULL`, creating silent multi-tenant data leaks.
- 98.9% of items with `tracking_type = NULL` despite boolean tracking flags being set.
- Global unique constraints on `variant_sku` preventing multi-tenant SKU reuse.
- A 2,265-line God service (`item_master_svc.py`) with an 813-line `create_item` function that hindered maintainability and automated testability.

## 3. Scope
- **Database Schema & Data Migration (Alembic v1517)**:
  - Backfill `company_id = 'COMP-001'` for all orphaned `items`, `item_variants`, and `item_barcodes`.
  - Add canonical `tracking_mode` column (VARCHAR 20, NOT NULL, default 'NONE') as the single source of truth.
  - Backfill `tracking_mode` from boolean flags `is_batch_tracked` and `is_serial_tracked`.
  - Add CHECK constraint `chk_items_no_dual_tracking` to prevent items from being both batch and serial tracked.
  - Drop global unique constraint on `variant_sku`, retaining tenant-scoped unique index `uq_variants_company_sku`.
  - Add trigger `trg_seed_warehouse_location` to auto-provision default location on active item creation.
- **Service Decomposition (`backend/app/services/item/`)**:
  - `ItemCatalogService`: Item lifecycle, CRUD, unique code lookup, ID fetch, listing.
  - `BarcodeResolverService`: 5-tier resolution (Barcode, Variant SKU, Buyer Code, Item Code, Serial).
  - `VariantMatrixService`: Cartesian product matrix generation with barcode auto-assignment and PriceBook synchronisation.
  - `ItemPricingService`: Contract-governed temporal commercial pricing evaluation and statutory GST split computation.
  - `ItemTrackingService`: 5-bucket ATP inventory computation, batch creation, serial registration.
  - Unified facade `UniversalItemMasterService` re-exporting all capabilities.
  - Backward-compatibility shim in `app.services.item_master_svc`.

## 4. Current State
Before execution:
- Monolithic `backend/app/services/item_master_svc.py` (2,265 lines).
- Both `smritisys` and `smriti001` databases at Alembic revision `v1516_role_tenancy_constraints`.
- 1,066 items in `smriti001`, 230 with `company_id = NULL`.
- 440 item variants and 397 barcodes with `company_id = NULL`.

## 5. Gap Analysis
| Defect / Architectural Flaw | Pre-Refactor State | Post-Refactor State |
|---|---|---|
| Multi-tenant company leak | 230 items, 440 variants, 397 barcodes NULL | 0 NULL company_id across all tables |
| Tracking mode truth | Dual booleans + unpopulated string | Canonical `tracking_mode` NOT NULL column |
| Dual-tracking violation | Allowed in schema | Enforced by CHECK constraint `chk_items_no_dual_tracking` |
| SKU multi-tenancy | Blocked by global unique index | Scoped to company via `uq_variants_company_sku` |
| Service SRP | 2,265-line monolith | 5 decomposed, single-responsibility services |

## 6. Architecture Impact
- **Database Layer**: Zero breaking changes to existing columns. Added `tracking_mode` column, `chk_items_no_dual_tracking` constraint, and default location trigger.
- **ORM Models**: Added `tracking_mode` to `Item` in `app/models/item_master.py`.
- **Service Layer**: Fully modularized package `app.services.item` with backward-compatible facade `UniversalItemMasterService`.

## 7. Proposed Design
```text
backend/app/services/item/
├── __init__.py               (UniversalItemMasterService Facade combining all 5 sub-services)
├── item_catalog_svc.py       (ItemCatalogService: CRUD, listing, code lookup, create_item)
├── barcode_resolver_svc.py   (BarcodeResolverService: 5-tier barcode/SKU scanner resolver)
├── variant_matrix_svc.py     (VariantMatrixService: Cartesian matrix generator)
├── item_pricing_svc.py       (ItemPricingService: Contract pricing & statutory GST slabs)
└── item_tracking_svc.py      (ItemTrackingService: 5-bucket ATP & batch/serial tracking)
```

## 8. Files Created
- `backend/alembic/versions/v1517_item_master_integrity_refactor.py`
- `backend/app/services/item/__init__.py`
- `backend/app/services/item/item_catalog_svc.py`
- `backend/app/services/item/barcode_resolver_svc.py`
- `backend/app/services/item/variant_matrix_svc.py`
- `backend/app/services/item/item_pricing_svc.py`
- `backend/app/services/item/item_tracking_svc.py`

## 9. Files Modified
- `backend/alembic/versions/v1336_gift_cards_and_einvoice.py`
- `backend/app/models/item_master.py`
- `backend/app/services/item_master_svc.py`
- `backend/tests/t_item_master.py`

## 10. Dependencies
- Alembic migration engine on Postgres (port 2781).
- Python 3.11 virtual environment (`.venv`).
- SQLAlchemy 2.0 async engine + asyncpg.

## 11. Risks
- Potential regression in legacy callers importing `item_master_svc`. Mitigated by complete 14-method parity shim in `app.services.item_master_svc`.
- Migration downgrade safety. Mitigated by explicit `downgrade()` implementation restoring indexes and constraints.

## 12. Rollback Strategy
- Database: `alembic -x target=tenant -x db=<db> downgrade v1516_role_tenancy_constraints`.
- Code: Git checkout on `item_master_svc.py`.

## 13. Verification Plan
- Live PostgreSQL query audit on `smriti001`, `smriti002`, and `smritisys`.
- Method parity check confirming all 14 methods on `UniversalItemMasterService`.
- 100% green execution of `t_item_master.py` (12 tests) and `t_univ_item.py` (10 tests).
- Column/AST parity validation via `test_items_orm_db_parity.py`.

## 14. Test Plan
- Run `pytest tests/t_item_master.py -v`.
- Run `pytest tests/t_univ_item.py -v`.
- Run `pytest tests/test_items_orm_db_parity.py -v`.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create walkthrough document in `docs/walkthrough/catalog/`.
- Update `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Step 1: Run Alembic migration `v1517` across control and tenant databases.
- Step 2: Deploy new `app/services/item/` package and updated `item_master_svc.py` shim.
- Step 3: Run automated test suite to confirm operational readiness.

## 17. Status
**Completed** — Fully verified with live test and database evidence.

## 18. Related ADRs
- ADR-001: Strangler-Fig Decomposition of Item Master Monolith
- ADR-004: Dual-Tenancy Indexing and Multi-Tenant Isolation

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Catalog_Item_Master_Integrity_Migration_And_Service_Decomposition_v3.17.0.md`
