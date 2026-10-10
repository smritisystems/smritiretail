<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.0
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Item Master Phase 4 — Service Decomposition & Domain Modularization Plan v6.70.0

## 1. Objective
Decompose the monolithic `UniversalItemMasterService` (`item_master_svc.py`, formerly 1,500+ lines) into 5 high-cohesion, low-coupling domain sub-services housed under `backend/app/services/item/`:
1. `ItemCatalogService`: Item style, parent catalog, and variant CRUD lifecycle.
2. `VariantMatrixService`: Cartesian product generation across matrix dimensions (Color, Size, Fit).
3. `BarcodeResolverService`: 5-tier optical barcode and SKU scanning resolution engine.
4. `ItemPricingService`: Contract-governed pricing, temporal price resolution, and statutory GST slab calculation.
5. `ItemTrackingService`: 5-bucket ATP (Available-To-Promise) formula computation and batch/serial ledger tracking.
Provide a clean backward-compatibility facade in `backend/app/services/item_master_svc.py` to preserve existing callers and ensure 100% test passing across all legacy and universal item test suites.

## 2. Business Motivation
As the SMRITI Retail OS Item Master evolved across Phases 1 and 2, `UniversalItemMasterService` accumulated divergent responsibilities:
- Catalog creation, variant persistence, and tenant isolation.
- Barcode uniqueness enforcement and 5-tier fast scanner lookups.
- Dynamic matrix expansion for multi-attribute footwear and apparel.
- Statutory GST calculations and customer price list resolution.
- Real-time stock availability formulas across 5 ledger buckets.

Conflating these critical enterprise capabilities in a single monolithic file degraded maintainability, increased cognitive load, and created circular dependency risks. Decomposing these responsibilities into dedicated domain sub-services isolates business logic, clarifies transactional boundaries, and simplifies testing.

## 3. Scope
- **Decomposition**:
  - `backend/app/services/item/__init__.py`: Export package symbols and composite `UniversalItemMasterService` class.
  - `backend/app/services/item/item_catalog_svc.py`: `ItemCatalogService` handling item/variant CRUD, primary barcode binding, and soft deletion.
  - `backend/app/services/item/variant_matrix_svc.py`: `VariantMatrixService` generating Cartesian matrix variants without synthetic barcodes.
  - `backend/app/services/item/barcode_resolver_svc.py`: `BarcodeResolverService` providing 5-tier scanner resolution with exact match priority.
  - `backend/app/services/item/item_pricing_svc.py`: `ItemPricingService` executing contract pricing, customer price books, and statutory GST splits.
  - `backend/app/services/item/item_tracking_svc.py`: `ItemTrackingService` executing 5-bucket ATP calculations (`ATP = On-Hand - Reserved - Committed + In-Transit`) and batch tracking.
- **Backward-Compatibility Facade**:
  - `backend/app/services/item_master_svc.py`: Re-exports all sub-services and `UniversalItemMasterService` for seamless integration.
- **Tenant Isolation & Barcode Query Scoping**:
  - Scope all barcode lookups to `ItemBarcode.company_id == (company_id or "COMP-001")` and use `.scalars().first()` to avoid `MultipleResultsFound` exceptions.
- **Verification & Test Parity**:
  - Verify complete passing of `backend/tests/t_item_master.py` (12 tests) and `backend/tests/t_univ_item.py` (10 tests).
  - Verify complete passing of Phase 2 test suites `test_item_master_phase2.py` (9 tests) and `test_item_master_domain_refactor.py` (6 tests).

## 4. Current State
- `backend/app/services/item/` contains all 5 sub-services and package `__init__.py`.
- `backend/app/services/item_master_svc.py` operates as a re-export facade.
- Tenant database on port 2781 (`smriti001`) with Alembic migration `v1519` applied.
- All 37 regression tests passing cleanly.

## 5. Gap Analysis
| Architecture Dimension | Pre-Phase 4 Monolith | Post-Phase 4 Decomposed Architecture |
|---|---|---|
| Service Structure | Single 1,500+ line `item_master_svc.py` | 5 focused sub-services under `backend/app/services/item/` |
| Catalog Lifecycle | Entangled with pricing, barcode, and ATP | Isolated in `ItemCatalogService` |
| Variant Matrix Generation | Embedded private helper | Dedicated `VariantMatrixService` with validation |
| Barcode & Scanner Lookup | Mixed with CRUD operations | Dedicated `BarcodeResolverService` with 5-tier priority |
| Pricing & GST Logic | Embedded inside item service | Isolated in `ItemPricingService` with contract resolution |
| ATP & Inventory Resolution | Ad-hoc queries in catalog service | Isolated in `ItemTrackingService` with 5-bucket ATP semantics |
| Import Compatibility | Single module imports | Facade re-export in `item_master_svc.py` preventing caller breakage |

## 6. Architecture Impact
- **Decoupled Responsibilities**: Each sub-service is independently maintainable and testable.
- **Zero Breaking Changes**: Any existing caller importing `from app.services.item_master_svc import UniversalItemMasterService` functions identically.
- **Tenant Isolation**: Barcode lookups scoped with `company_id` filter, preventing cross-tenant barcode collision or test-suite pollution.
- **Frozen Architecture Compliance**: No change to SKU/Barcode invariant: `item_variants.id` = technical PK, `item_variants.variant_sku` = canonical business identity, `item_barcodes` = optical lookup only.

## 7. Proposed Design
```text
backend/app/services/
├── item_master_svc.py (Facade re-exporting UniversalItemMasterService & sub-services)
└── item/
    ├── __init__.py (Composite class & symbol export)
    ├── item_catalog_svc.py (ItemCatalogService — CRUD & lifecycle)
    ├── variant_matrix_svc.py (VariantMatrixService — Cartesian generator)
    ├── barcode_resolver_svc.py (BarcodeResolverService — 5-tier resolution)
    ├── item_pricing_svc.py (ItemPricingService — Contract pricing & GST)
    └── item_tracking_svc.py (ItemTrackingService — 5-bucket ATP & tracking)
```

## 8. Files Created
1. `backend/app/services/item/__init__.py`: Modular package init and composite facade.
2. `backend/app/services/item/item_catalog_svc.py`: Catalog lifecycle sub-service.
3. `backend/app/services/item/variant_matrix_svc.py`: Variant matrix generator sub-service.
4. `backend/app/services/item/barcode_resolver_svc.py`: 5-tier barcode resolver sub-service.
5. `backend/app/services/item/item_pricing_svc.py`: Pricing and statutory GST sub-service.
6. `backend/app/services/item/item_tracking_svc.py`: 5-bucket ATP and batch tracking sub-service.
7. `docs/implementation/catalog/Item_Master_Phase4_Service_Decomposition_Plan_v6.70.0.md`: This implementation plan.
8. `docs/walkthrough/catalog/Item_Master_Phase4_Service_Decomposition_v6.70.0.md`: Phase 4 walkthrough document.

## 9. Files Modified
1. `backend/app/services/item_master_svc.py`: Reduced to backward-compatible re-export facade.
2. `backend/app/services/item/item_catalog_svc.py`: Fixed `ItemBarcode.company_id` scoping and `.scalars().first()` queries.
3. `docs/implementation/README.md`: Master implementation plan registry update.
4. `docs/walkthrough/README.md`: Master walkthrough registry update.

## 10. Dependencies
- Python 3.11+ / SQLAlchemy 2.0 async session.
- PostgreSQL 16+ on port 2781 (`smriti001`).
- Alembic migration head `v1519`.
- Pydantic v2 domain schemas (`backend/app/schemas/item_master.py`).

## 11. Risks
- **Multiple Barcode Results**: Across multiple companies or test fixtures, scanning without `company_id` scoping raised `MultipleResultsFound`.
  - *Mitigation*: Scoped all queries with `company_id` and used `.scalars().first()`.
- **Async Greenlet Leaks on Relationship Access**: Accessing un-eager-loaded relationships on freshly created ORM models.
  - *Mitigation*: Use `.options(selectinload(...))` or check attributes on persistent instances only.

## 12. Rollback Strategy
If service decomposition causes regression in calling modules, the original monolithic `item_master_svc.py` can be restored from git history (`git checkout HEAD -- backend/app/services/item_master_svc.py`). No database schema changes were introduced in Phase 4.

## 13. Verification Plan
1. Run `t_univ_item.py` suite (10 tests) to verify multi-tenant isolation, 5-bucket ATP, and contract pricing.
2. Run `t_item_master.py` suite (12 tests) to verify variant generation, barcode prefixing, and API endpoints.
3. Run Phase 2 test suites (`test_item_master_phase2.py`, `test_item_master_domain_refactor.py`) (15 tests).
4. Run frontend compiler check (`npx tsc --noEmit`) to verify 0 frontend TypeScript errors.

## 14. Test Plan
- `backend/tests/t_item_master.py`: 12/12 passing.
- `backend/tests/t_univ_item.py`: 10/10 passing.
- `backend/app/tests/test_item_master_phase2.py`: 9/9 passing.
- `backend/app/tests/test_item_master_domain_refactor.py`: 6/6 passing.
- Total regression test footprint: 37/37 passed.

## 15. Documentation Impact
- Updated `docs/implementation/README.md` with Phase 4 entry.
- Created `docs/walkthrough/catalog/Item_Master_Phase4_Service_Decomposition_v6.70.0.md` and updated `docs/walkthrough/README.md`.
- Developer guides reference the new modular package `backend/app/services/item/`.

## 16. Deployment Plan
1. Ensure `backend/app/services/item/` is deployed to development environment.
2. Verify all pytest test suites execute green.
3. Sync test environment via standard git pull workflow (Environment Rule: DEV vs TEST).

## 17. Status
**Completed** — Fully implemented and verified with 37/37 tests green and clean frontend compilation.

## 18. Related ADRs
- `ADR-0042`: Universal Item Master Architecture and Domain Segregation.
- `ADR-0043`: Frozen SKU and Optical Barcode Separation Invariants.
- `ADR-0045`: Five-Bucket Inventory Accounting and Available-to-Promise (ATP) Semantics.

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Item_Master_Phase2_UOM_Pricing_Tax_Policies_v6.70.0.md`
- `docs/walkthrough/catalog/Item_Master_Phase4_Service_Decomposition_v6.70.0.md`
