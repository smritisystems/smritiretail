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

# Walkthrough: Item Master Phase 4 — Service Decomposition & Domain Modularization v6.70.0

## 1. Purpose
Document the complete service decomposition of `UniversalItemMasterService` (`item_master_svc.py`, originally a 1,500+ line monolith) into 5 focused, highly cohesive domain sub-services housed within `backend/app/services/item/`, while providing a zero-downtime, backward-compatible facade in `backend/app/services/item_master_svc.py`.

## 2. Scope
- Package initialization and composite class facade (`backend/app/services/item/__init__.py`).
- CRUD and catalog lifecycle management (`ItemCatalogService`).
- Cartesian product matrix variant generation (`VariantMatrixService`).
- 5-tier optical barcode scanner resolution (`BarcodeResolverService`).
- Contract pricing, price book tiers, and statutory GST slab splits (`ItemPricingService`).
- 5-bucket Available-To-Promise (ATP) inventory resolution and batch tracking (`ItemTrackingService`).
- Multitenant barcode scoping fixes in `item_catalog_svc.py`.
- Execution and verification of all 37 regression tests across 4 test suites.

## 3. Files Created
1. `backend/app/services/item/__init__.py`: Package export file defining `UniversalItemMasterService` composite and sub-service exports.
2. `backend/app/services/item/item_catalog_svc.py`: `ItemCatalogService` handling catalog item CRUD, variant persistence, and barcode association.
3. `backend/app/services/item/variant_matrix_svc.py`: `VariantMatrixService` generating Cartesian matrix variants without synthetic barcodes.
4. `backend/app/services/item/barcode_resolver_svc.py`: `BarcodeResolverService` providing 5-tier scanner resolution with exact match priority.
5. `backend/app/services/item/item_pricing_svc.py`: `ItemPricingService` executing contract pricing, customer price books, and statutory GST splits.
6. `backend/app/services/item/item_tracking_svc.py`: `ItemTrackingService` executing 5-bucket ATP calculations and batch tracking.
7. `docs/implementation/catalog/Item_Master_Phase4_Service_Decomposition_Plan_v6.70.0.md`: Phase 4 19-section implementation plan.
8. `docs/walkthrough/catalog/Item_Master_Phase4_Service_Decomposition_v6.70.0.md`: This 13-section walkthrough document.

## 4. Files Modified
1. `backend/app/services/item_master_svc.py`: Reduced to clean backward-compatible facade re-exporting from `app.services.item`.
2. `backend/app/services/item/item_catalog_svc.py`: Added explicit `company_id` scoping to barcode queries and updated `.scalar_one_or_none()` calls to `.scalars().first()`.
3. `docs/implementation/README.md`: Registered Phase 4 implementation plan in master index.
4. `docs/walkthrough/README.md`: Registered Phase 4 walkthrough in master index.

## 5. Architecture Decisions
1. **Facade Pattern Preservation**:
   - `UniversalItemMasterService` is preserved as a composite class that inherits from or delegates to each sub-service.
   - `backend/app/services/item_master_svc.py` directly re-exports `UniversalItemMasterService` and all sub-services, preventing breakage of existing callers across API routers and tests.
2. **Company-Scoped Barcode Lookups**:
   - In multitenant databases, identical barcode numbers may exist across tenants or in legacy seed data.
   - Scoping queries with `ItemBarcode.company_id == (company_id or "COMP-001")` and selecting `.scalars().first()` prevents SQLAlchemy `MultipleResultsFound` exceptions.
3. **Invariable Identity Separation**:
   - `item_variants.id` = technical primary key.
   - `item_variants.variant_sku` = canonical business identity.
   - `item_barcodes` = optical scanner lookup table only (never a primary key or transactional identity).

## 6. Design Rationale
- **Single Responsibility Principle**: Separating catalog management, pricing calculations, inventory availability formulas, barcode resolution, and matrix generation allows each domain area to evolve without risking regression in unrelated workflows.
- **Maintainability**: Reduced individual file sizes from 1,500+ lines to manageable, domain-focused modules (300–700 lines each).
- **Zero Disruption**: External API routes (`item_domain.py`, `items.py`) and legacy test suites (`t_item_master.py`, `t_univ_item.py`) continue to import from `app.services.item_master_svc` without modifying their import statements.

## 7. Implementation Summary
```text
┌──────────────────────────────────────────────────────────┐
│         backend/app/services/item_master_svc.py          │
│                  (Backward-Compatible Facade)            │
└────────────────────────────┬─────────────────────────────┘
                             │ Delegates / Re-exports
┌────────────────────────────▼─────────────────────────────┐
│                 backend/app/services/item/               │
├──────────────────────────┬───────────────────────────────┤
│ ItemCatalogService       │ Catalog CRUD, Variants, Sync  │
│ VariantMatrixService     │ Cartesian Matrix Generation   │
│ BarcodeResolverService   │ 5-Tier Scanner Resolution     │
│ ItemPricingService       │ Contract Pricing & GST Splits │
│ ItemTrackingService      │ 5-Bucket ATP & Batch Tracking │
└──────────────────────────┴───────────────────────────────┘
```

## 8. Tests Executed
Literal terminal test execution command:
```bash
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest \
  backend/tests/t_item_master.py \
  backend/tests/t_univ_item.py \
  backend/app/tests/test_item_master_phase2.py \
  backend/app/tests/test_item_master_domain_refactor.py -v
```

Terminal Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 37 items

backend\tests\t_item_master.py::test_generated_placeholder_barcode_prefix_is_uppercase_s PASSED [  2%]
backend\tests\t_item_master.py::test_extract_vendor_article_codes_from_po_text_splits_style_and_article_tokens PASSED [  5%]
backend\tests\t_item_master.py::test_vendor_code_allocator_stays_within_five_characters PASSED [  8%]
backend\tests\t_item_master.py::test_generated_placeholder_barcode_configurable_policy PASSED [ 10%]
backend\tests\t_item_master.py::test_create_item_with_variants_and_barcodes PASSED [ 13%]
backend\tests\t_item_master.py::test_duplicate_item_code_cannot_overwrite_original_details PASSED [ 16%]
backend\tests\t_item_master.py::test_barcode_cannot_be_reused_for_another_item PASSED [ 18%]
backend\tests\t_item_master.py::test_matrix_variant_generator_cartesian PASSED [ 21%]
backend\tests\t_item_master.py::test_fast_4_tier_scanner_resolver PASSED [ 24%]
backend\tests\t_item_master.py::test_batch_registration_and_tracking PASSED [ 27%]
backend\tests\t_item_master.py::test_legacy_product_adapter PASSED       [ 29%]
backend\tests\t_item_master.py::test_api_item_endpoints PASSED           [ 32%]
backend\tests\t_univ_item.py::test_create_and_fetch_universal_item_with_variants PASSED [ 35%]
backend\tests\t_univ_item.py::test_lookup_by_barcode_canonical_item PASSED [ 37%]
backend\tests\t_univ_item.py::test_item_tenant_isolation PASSED          [ 40%]
backend\tests\t_univ_item.py::test_five_bucket_inventory_resolution PASSED [ 43%]
backend\tests\t_univ_item.py::test_temporal_and_contract_governed_pricing PASSED [ 45%]
backend\tests\t_univ_item.py::test_pricing_negative_unauthorized_and_inactive_customer PASSED [ 48%]
backend\tests\t_univ_item.py::test_pricing_negative_invalid_dates_and_currency_mismatch PASSED [ 51%]
backend\tests\t_univ_item.py::test_pricing_statutory_gst_split_and_slabs PASSED [ 54%]
backend\tests\t_univ_item.py::test_five_bucket_inventory_atp_formula_enterprise_calculation PASSED [ 56%]
backend\tests\t_univ_item.py::test_committed_vs_reserved_semantic_separation_and_anti_doubling PASSED [ 59%]
backend\app\tests\test_item_master_phase2.py::test_uom_master_prs_and_alias_pair PASSED [ 62%]
backend\app\tests\test_item_master_phase2.py::test_item_uom_settings_invariants PASSED [ 64%]
backend\app\tests\test_item_master_phase2.py::test_item_prices_invariants_and_historical_zero_price_compatibility PASSED [ 67%]
backend\app\tests\test_item_master_phase2.py::test_item_tax_profiles_and_legacy_hsn_detection PASSED [ 70%]
backend\app\tests\test_item_master_phase2.py::test_item_supplier_settings_and_purchasing_authority PASSED [ 72%]
backend\app\tests\test_item_master_phase2.py::test_item_sales_settings_commercial_policy PASSED [ 75%]
backend\app\tests\test_item_master_phase2.py::test_item_inventory_policy_strict_policy_only PASSED [ 78%]
backend\app\tests\test_item_master_phase2.py::test_item_readiness_engine_lifecycle_and_blocking_reasons PASSED [ 81%]
backend\app\tests\test_item_master_phase2.py::test_item_master_phase2_e2e_persistence_and_relationships PASSED [ 83%]
backend\app\tests\test_item_master_domain_refactor.py::test_item_master_domain_migration_and_model_aliases PASSED [ 86%]
backend\app\tests\test_item_master_domain_refactor.py::test_item_style_create_and_tenant_isolation PASSED [ 89%]
backend\app\tests\test_item_master_domain_refactor.py::test_physical_variant_identity_decoupled_from_mrp PASSED [ 91%]
backend\app\tests\test_item_master_domain_refactor.py::test_barcode_uniqueness_enforcement PASSED [ 94%]
backend\app\tests\test_item_master_domain_refactor.py::test_governed_master_lookup_catalog PASSED [ 97%]
backend\app\tests\test_item_master_domain_refactor.py::test_rest_api_item_domain_endpoints PASSED [100%]

================= 37 passed, 23 warnings in 89.65s (0:01:29) ==================
```

Frontend Compiler Check:
```bash
npx tsc --noEmit
# Exit code 0, 0 errors
```

## 9. Verification Results
- `backend/tests/t_item_master.py`: 12/12 PASSED.
- `backend/tests/t_univ_item.py`: 10/10 PASSED.
- `backend/app/tests/test_item_master_phase2.py`: 9/9 PASSED.
- `backend/app/tests/test_item_master_domain_refactor.py`: 6/6 PASSED.
- Total: 37/37 PASSED (100% green).
- Frontend TypeScript type check: 0 errors.

## 10. Known Limitations
- The facade re-export pattern retains backward compatibility for all existing callers, but direct sub-service imports (`from app.services.item.item_catalog_svc import ItemCatalogService`) should be favored in new feature modules to reduce coupling.
- High-volume POS scanning benchmarks with 100,000+ barcode records will be conducted in a dedicated stress test suite.

## 11. Future Work
- Phase 5: Bulk item import / export engine leveraging `ItemCatalogService` with background asynchronous job processing.
- Direct barcode scanner hardware integration protocols for continuous POS barcode stream processing.

## 12. Related ADRs
- `ADR-0042`: Universal Item Master Architecture and Domain Segregation.
- `ADR-0043`: Frozen SKU and Optical Barcode Separation Invariants.
- `ADR-0045`: Five-Bucket Inventory Accounting and Available-to-Promise (ATP) Semantics.

## 13. Related RFCs
- `RFC-0028`: Item Master Modularization and Domain Service Decoupling.
