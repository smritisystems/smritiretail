<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.18.0
  Created      : 2026-09-13
  Modified     : 2026-09-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Master Lookup → Attribute Group → SKU Matrix Governance & Cost Hardening Walkthrough

## 1. Purpose
This walkthrough documents the complete governance hardening, end-to-end integration test coverage, and cost fallback elimination across the Master Lookup, Attribute Group, Variant Template, and SKU Matrix generation pipeline. It eliminates the obsolete 60% fallback heuristic for buying costs (`selectedTemplate.basePrice * 0.6`), ensures 100% of production and seeded Attribute Groups carry non-null Size Group and Color Group mappings, and verifies fleet migration idempotency.

## 2. Scope
- **Backend Migrations:**
  - `backend/alembic/versions/v1440_link_attribute_groups_to_size_groups.py`: Comprehensive size group backfill for footwear (`FOOTWEAR_EU`) and apparel/general (`APPAREL_ALPHA`), split for `asyncpg` execution.
  - `backend/alembic/versions/v1441_add_dedicated_size_group_tables.py`: Idempotent table-existence guards for `size_groups` and `size_group_values`.
  - `backend/alembic/versions/v1442_add_variant_template_base_cost_price.py`: Column existence guard for `base_cost_price`.
  - `backend/alembic/versions/v1443_add_color_groups.py`: Comprehensive color group backfill (`COLOR_BASIC`).
  - `backend/alembic/versions/v1444_backfill_all_attribute_groups_governed_dimensions.py`: Guaranteeing 100% coverage across all tenant databases.
- **Service & API Layer:**
  - `backend/app/services/attributes.py`: Enforcing governed defaults on `create_group` and `load_industry_template`.
  - `backend/app/api/v1/attributes.py`: Eliminating 60% fallback on variant creation/updates so `base_cost_price = 0.00` is strictly respected.
- **Frontend UI & Calculation Layer:**
  - `src/components/VariantTemplateSec.tsx`: Eliminating `selectedTemplate.basePrice * 0.6` fallback across lines 182, 728, and 800.
- **Testing & Verification:**
  - `backend/tests/test_master_lookup_attribute_group_sku_matrix_e2e.py`: Automated 5-step integration suite covering Master Lookup → Attribute Group → SKU matrix.
  - `src/tests/variantTemplateCostHardening.test.ts`: Vitest unit test suite covering zero cost preservation.

## 3. Files Created
- `backend/alembic/versions/v1444_backfill_all_attribute_groups_governed_dimensions.py`
- `backend/tests/test_master_lookup_attribute_group_sku_matrix_e2e.py`
- `src/tests/variantTemplateCostHardening.test.ts`
- `docs/walkthrough/catalog/Master_Lookup_Attribute_Group_SKU_Matrix_Governance_v4.18.0.md`

## 4. Files Modified
- `backend/alembic/versions/v1440_link_attribute_groups_to_size_groups.py`
- `backend/alembic/versions/v1441_add_dedicated_size_group_tables.py`
- `backend/alembic/versions/v1442_add_variant_template_base_cost_price.py`
- `backend/alembic/versions/v1443_add_color_groups.py`
- `backend/app/api/v1/attributes.py`
- `backend/app/services/attributes.py`
- `src/components/VariantTemplateSec.tsx`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Decision 1: Zero Cost Preservation over Arbitrary Fallbacks:**
  - In retail operations, promotional items, samples, and donated goods legitimately carry a cost price of `0.00`. The legacy heuristic `Math.round(selectedTemplate.baseCostPrice || selectedTemplate.basePrice * 0.6)` coerced `0.00` into `60%` due to JavaScript falsy evaluation (`0 || ...`). All resolution points now explicitly check for numeric validity (`!== undefined && !== null && !isNaN(...)`), ensuring `0.00` is strictly preserved.
- **Decision 2: Fleet Migration Idempotency:**
  - Multi-tenant tenant databases created or provisioned out-of-band may already contain physical tables (`size_groups`). Adding `inspector = sa.inspect(bind)` table and column existence checks prevents `DuplicateTableError` and allows `tools/migrate_fleet.py` to upgrade all databases across the fleet smoothly.
- **Decision 3: Mandatory Governance on Attribute Group Creation:**
  - `AttributesService.create_group` and `load_industry_template` now automatically assign governed `size_group_id` (`FOOTWEAR_EU` or `APPAREL_ALPHA`) and `color_group_id` (`COLOR_BASIC`), ensuring unmapped attribute groups cannot be created.

## 6. Design Rationale
- Decoupling variant templates from static fallback values ensures that when new variants are generated, their attributes and prices are deterministic reflections of governed master lookup definitions and user-entered template values.

## 7. Implementation Summary
1. Patched migrations `v1440` through `v1443` with existence guards and asyncpg single-statement execution.
2. Added migration `v1444` to backfill missing `size_group_id` and `color_group_id` across all company databases.
3. Migrated `smritisys` and `smriti001` to revision `v1444_backfill_all_attribute_groups_governed_dimensions`.
4. Updated `backend/app/services/attributes.py` to set governed size and color groups in industry templates and `create_group`.
5. Removed 60% fallback in `backend/app/api/v1/attributes.py` and `src/components/VariantTemplateSec.tsx`.
6. Created and verified `test_master_lookup_attribute_group_sku_matrix_e2e.py` (5/5 passed).
7. Created and verified `variantTemplateCostHardening.test.ts` (4/4 passed).
8. Executed `npm run lint` (`tsc --noEmit`: 0 errors), `npm run build` (built in 25.90s), and restarted Docker containers (`smriti-web`, `smriti-api`).

## 8. Tests Executed
- `pytest tests/test_master_lookup_attribute_group_sku_matrix_e2e.py -v` (5/5 passed in 4.94s)
- `pytest tests/test_size_group_sync.py tests/test_master_article_ownership.py tests/test_vendor_code_governance_e2e.py -v` (7/7 passed in 8.11s)
- `npx vitest run src/tests/vendorMasterWsLoopGuard.test.ts src/tests/variantTemplateCostHardening.test.ts` (7/7 passed in 322ms)
- `npm run lint` (`tsc --noEmit`, 0 errors)
- `npm run build` (clean production bundle generated)
- `python tools/migrate_fleet.py --db smriti001` (SUCCESS: v1435 -> v1444 in 1744.8 ms)
- `verify_attribute_groups.py` (0 unmapped groups across smritisys and smriti001)

## 9. Verification Results
All automated integration tests, unit tests, linters, and fleet migration runners completed with 100% success. Zero unmapped attribute groups exist in production or tenant databases.

## 10. Known Limitations
- Master Lookup currently defines `APPAREL_ALPHA` and `FOOTWEAR_EU` size groups, and `COLOR_BASIC` and `COLOR_NEUTRAL` color groups. Specialized industry sizing (e.g. neck/sleeve collar dress shirts, UK/US footwear) should be added as Master Lookup values as retail categories expand.

## 11. Future Work
- Add custom color group creator in the Master Registry UI.
- Support dynamic multi-dimensional variant grids (e.g. Size × Color × Fit 3D matrix).

## 12. Related ADRs
- `docs/adr/ADR-0042-Master-Data-Governance-Single-Canonical-Owner.md`
- `docs/adr/ADR-0038-Variant-Template-Cost-Price-Architecture.md`

## 13. Related RFCs
- `RFC-2026-09-08-Fleet-Migration-Orchestration`
- `RFC-2026-09-12-Item-Master-Lookup-Integration`
